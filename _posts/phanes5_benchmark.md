---
title: 'Phanes: (Part 5 — Benchmarking)'
excerpt: 'How do you know it is actually faster? You measure it properly'
coverImage: '/assets/blog/benchmark.jpeg'
date: '2026-05-07T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/benchmark.jpeg'
---

Across the first four parts of this series, I kept dropping benchmark numbers as evidence that each version was faster or slower than the last. But I never explained how those numbers were produced or why I trusted them.

That is what this post is about.

The wall-clock timings in Parts 1 through 4 were useful for telling the high-level story: "this version takes 3 seconds, the previous one took 8." But they do not tell you *why*. Is the deque fast? Does false sharing actually hurt? Does the thread pool scale? Wall-clock timings on a real filesystem scan cannot answer those questions cleanly because too many things are happening at once.

For that you need microbenchmarks, and for that i used [Google Benchmark](https://github.com/google/benchmark).

---

## Why Google Benchmark over a raw timer

The naive approach to benchmarking is:

```cpp
auto start = std::chrono::high_resolution_clock::now();
do_the_thing();
auto end = std::chrono::high_resolution_clock::now();

time_taken = end - start;
```

This has several problems.

**The compiler will optimize away work it can prove has no effect.** If `do_the_thing()` produces a result you never use, the compiler is allowed to delete it entirely and your benchmark runs in nanoseconds because it does nothing.

**One run is not enough.** A single measurement includes OS scheduling noise, CPU frequency scaling, cache cold-start effects, and whatever else happened to be running on the machine. You need many runs and you need to know the distribution, not just the mean.

**CPU frequency scaling corrupts time measurements.** Modern CPUs run at different clock speeds depending on thermal state and load. A benchmark that warms the CPU partway through will see the early iterations run slower than the later ones, and a raw timer has no way to account for this.

Google Benchmark handles all of this. It runs each benchmark in a loop until it has enough iterations to produce a stable measurement. It provides `DoNotOptimize` and `ClobberMemory` to prevent the compiler from eliding work. It reports wall time and CPU time separately so you can spot when they diverge and it lets you parameterize benchmarks cleanly so you can sweep across different input sizes with one function.

---

## What we are benchmarking

The benchmark suite covers three distinct things:

- **The lock-free deque itself** — push/pop throughput, and how it degrades under steal contention
- **False sharing** — a direct comparison of packed vs padded atomics to validate the `alignas(64)` decision
- **The builder** — thread overhead, task granularity, different tree shapes, and thread count scaling

Each category has a different goal. The deque benchmarks answer "is the data structure fast in isolation." The false sharing benchmark answers "does the hardware penalty we described actually show up in measurements." The builder benchmarks answer "how does the full system behave under different workloads."

---

## Benchmarking the deque

### Fresh vs steady state

The first split in the deque benchmarks is between fresh and steady state:

```cpp
// Fresh: construction + any resize path included
static void BM_Deque_PushPop_Fresh(benchmark::State& state)
{
    const auto N = static_cast<std::size_t>(state.range(0));
    for (auto _ : state)
    {
        LockFreeDeque<std::size_t> deque;
        for (std::size_t i = 0; i < N; ++i)
        {
            deque.push_back(i);
        }
        benchmark::ClobberMemory();
        for (std::size_t i = 0; i < N; ++i)
        {
            benchmark::DoNotOptimize(deque.pop_back());
        }
        benchmark::ClobberMemory();
    }
    state.SetItemsProcessed(state.iterations() * static_cast<int64_t>(N) * 2);
}
```

```cpp
// Steady: pre-grow the deque once, then time only the push/pop
static void BM_Deque_PushPop_Steady(benchmark::State& state)
{
    const auto N = static_cast<std::size_t>(state.range(0));
    LockFreeDeque<std::size_t> deque;

    // warm up, force any resize to happen outside the timed loop
    for (std::size_t i = 0; i < N; ++i) deque.push_back(i);
    for (std::size_t i = 0; i < N; ++i) deque.pop_back();

    for (auto _ : state)
    {
        for (std::size_t i = 0; i < N; ++i)
        {
            deque.push_back(i);
        }
        benchmark::ClobberMemory();
        for (std::size_t i = 0; i < N; ++i)
        {
            benchmark::DoNotOptimize(deque.pop_back());
        }
        benchmark::ClobberMemory();
    }
    state.SetItemsProcessed(state.iterations() * static_cast<int64_t>(N) * 2);
}
```

The fresh benchmark includes construction and the buffer resize path. The steady benchmark isolates just the push/pop operations on an already-allocated buffer. If fresh is significantly slower than steady, allocation, resizing, or construction costs are significant. If they are similar, there is little overhead from allocation or resizing relative to push/pop.

`benchmark::ClobberMemory()` acts as a compiler memory barrier, forcing the optimizer to assume that memory may have changed in unknown ways and preventing reordering or caching of memory accesses across that point.

`benchmark::DoNotOptimize()` marks a value as observable, preventing the compiler from deleting the operation that produced it.

`state.SetItemsProcessed()` lets Google Benchmark compute throughput automatically. Each push and each pop is one item, so we pass `N * 2`.

**Results:**

| Benchmark | N | Linux | Windows |
|---|---|---|---|
| Fresh | 64 | 1,486 ns | 856 ns |
| Fresh | 512 | 7,117 ns | 5,543 ns |
| Fresh | 4096 | 58,225 ns | 46,583 ns |
| Steady | 64 | 878 ns | 673 ns |
| Steady | 512 | 7,111 ns | 7,111 ns |
| Steady | 4096 | 57,561 ns | 44,596 ns |

Fresh and steady are almost identical at N=512 and above. The resize overhead is there but small, it is a one-time allocation that amortizes quickly. At N=64 the fresh case is noticeably slower on both platforms because you are paying construction cost for only 128 total operations.

---

### Steal contention

This is the most important deque benchmark because it reflects what actually happens during a directory traversal under load imbalance:

```cpp
static void BM_Deque_StealContention(benchmark::State& state)
{
    const auto num_thieves = static_cast<int>(state.range(0));
    constexpr std::size_t N = 512;

    LockFreeDeque<std::size_t> deque;
    std::atomic start{false};
    std::atomic stop{false};

    std::vector<std::jthread> thieves;
    for (int t = 0; t < num_thieves; ++t)
    {
        thieves.emplace_back([&]() noexcept {
            while (!start.load(std::memory_order_acquire))
            {
                std::this_thread::yield();
            }
            while (!stop.load(std::memory_order_relaxed))
            {
                benchmark::DoNotOptimize(deque.steal_front());
            }
        });
    }
    start.store(true, std::memory_order_release);

    for (auto _ : state)
    {
        for (std::size_t i = 0; i < N; ++i) deque.push_back(i);
        benchmark::ClobberMemory();
        for (std::size_t i = 0; i < N; ++i)
        {
            benchmark::DoNotOptimize(deque.pop_back());
        }
        benchmark::ClobberMemory();
    }

    stop.store(true, std::memory_order_relaxed);
    state.SetItemsProcessed(state.iterations() * static_cast<int64_t>(N) * 2);
}
```

The thieves are created and started *outside* the timed loop. Only the owner's push/pop is measured. This is intentional because we want to see how contention from 
concurrent `steal_front` calls affects the owner's throughput, not how long it takes to spin up threads.

The `start` atomic with acquire/release ensures all thieves are actually running before the timed loop begins. Without it, the first few iterations of the benchmark would have fewer active thieves than intended.

**Results:**

| Thieves | Linux | Windows |
|---|---|---|
| 0 | 7,350 ns | 5,368 ns |
| 1 | 32,749 ns | 59,997 ns |
| 4 | 88,932 ns | 167,565 ns |
| 8 | 203,791 ns | 252,033 ns |

Even lock-free, contention scales roughly linearly with the number of simultaneous thieves. Each failed CAS is a retry, and with 8 threads racing on 
`front` simultaneously, most of them are retrying most of the time. This is the cost you pay for not having a mutex instead of one thread blocking, you get 
many threads spinning.

It is also why the steal-half strategy from Part 3 still matters in the lock-free version. Fewer total steal operations means less CAS pressure on `front`. You want thieves to steal enough work to stay busy for a while, not steal one item, finish it in microseconds, and immediately contend again.

---

## False sharing

This benchmark directly validates the `alignas(64)` decision from Part 4. Two structs, both with two atomic counters, one packed and one padded:

```cpp
struct PackedCounters
{
    std::atomic<std::uint64_t> a{0};
    std::atomic<std::uint64_t> b{0};
    // a and b likely share a cache line
};

struct PaddedCounters
{
    alignas(64) std::atomic<std::uint64_t> a{0};
    alignas(64) std::atomic<std::uint64_t> b{0};
    // a and b are guaranteed to be on separate cache lines
};
```

Two threads run simultaneously, one increments `a` one million times, the other increments `b`. They are writing to completely different variables. The question is purely whether sharing a cache line costs anything.

**Results:**

| | Linux | Windows |
|---|---|---|
| Packed (false sharing) | 50,563 µs | 8,480 µs |
| Padded (alignas 64) | 10,484 µs | 8,441 µs |

On Linux the false sharing penalty is nearly **5x**. `alignas(64)` eliminates it almost completely.

On Windows the difference is negligible, 8,480 µs vs 8,441 µs. This does not mean false sharing does not exist on Windows. It means the specific combination of CPU topology (32 logical cores across two physical dies), cache hierarchy (two separate L3 domains), and MSVC's atomic codegen probably absorbs or masks the effect 
in this particular test. A different machine or a different access pattern could show the penalty clearly.

The practical lesson: `alignas(64)` is cheap, it costs nothing at runtime and just changes how the compiler lays out the struct. There is no reason not to use it on variables that you know different threads will be writing to independently.

---

## Benchmarking the builder

### Thread overhead

```cpp
static void BM_BuildTree_ThreadOverhead(benchmark::State& state)
{
    const auto dirs = static_cast<int>(state.range(0));
    const auto root = make_unique_bench_path("phanes_bench_overhead");
    create_flat_tree(root, dirs, 1); // 1 file per directory — minimal work

    for (auto _ : state)
        benchmark::DoNotOptimize(build_tree(root));

    state.SetItemsProcessed(state.iterations() * dirs);
    fs::remove_all(root);
}
```

This benchmark creates very small trees just 1 file per directory to measure how much of the total time is just the cost of running the thread pool at all, independent of actual scan work. If thread overhead dominates at small sizes, that is a signal that the pool is too expensive to spin up for tiny jobs.

**Results:**

| Dirs | Linux | Windows |
|---|---|---|
| 1 | 0.716 ms | 3.07 ms |
| 5 | 0.750 ms | 3.09 ms |
| 20 | 0.717 ms | 3.54 ms |
| 100 | 0.916 ms | 4.07 ms |

Linux thread overhead is around 0.7ms and barely grows with directory count, the thread pool cost is fixed and the actual scan work at this scale is negligible. Windows is around 3ms even for a single directory. MSVC's thread creation and the Windows scheduler are heavier than Linux's, and it shows at small scales.

---

### Task granularity

```cpp
BENCHMARK(BM_BuildTree_Granularity)
    ->Args({10, 200})   // 10 dirs, 200 files each — few tasks, lots of work per task
    ->Args({100, 20})   // 100 dirs, 20 files each
    ->Args({500, 4})    // 500 dirs, 4 files each — many tasks, little work per task
    ->Args({1000, 2})   // 1000 dirs, 2 files each — maximum task count, minimum work
```

This sweeps across the same total file count with different distributions, few heavy tasks vs many light tasks. Work stealing is supposed to handle both well. If it does not, you will see the many-light-tasks case get significantly worse.

**Results (Linux):**

| Dirs | Files/dir | Time | Throughput |
|---|---|---|---|
| 10 | 200 | 1.29 ms | 2.21M items/s |
| 100 | 20 | 1.94 ms | 1.44M items/s |
| 500 | 4 | 2.92 ms | 1.30M items/s |
| 1000 | 2 | 5.21 ms | 828k items/s |

Throughput drops as tasks get finer. At 1000 directories with 2 files each, each task does almost no work but still pays the full cost of task submission, queue operations, and thread wakeups. This is the fundamental tradeoff in task parallelism: tasks need to be coarse enough that the work they do outweighs the overhead of scheduling them. Directory traversal is a good fit because real directories tend to have enough files that each scan task does meaningful work.

---

### Tree shape

Four different filesystem shapes, each with roughly the same total entry count:

```cpp
BM_BuildTree_Flat     // 100 dirs × 100 files, all at the same level
BM_BuildTree_Nested   // 10×10 grid of subdirectories, 100 files each
BM_BuildTree_Balanced // same as flat — sanity check
BM_BuildTree_Skewed   // 1 heavy dir with 800 files + 100 light dirs with 2 files each
```

The skewed case is the adversarial input for work stealing, one thread picks up the heavy directory and has far more work than everyone else. This is exactly the load imbalance scenario the whole stealing mechanism exists to solve.

**Results (Linux):**

| Shape | Time | Throughput |
|---|---|---|
| Flat | 5.21 ms | 4.77M items/s |
| Nested | 5.08 ms | 4.71M items/s |
| Balanced | 5.08 ms | 4.77M items/s |
| Skewed | 4.74 ms | 800k items/s |

Flat, nested, and balanced are all essentially the same, the tree shape does not matter much when the total work is evenly distributed. The skewed case is faster in wall time (4.74ms vs 5.08ms) but much lower throughput because `SetItemsProcessed` only counts the 1000 entries in the skewed tree vs the 10,000 in the others.

The important result is that skewed is not dramatically slower than flat which means stealing is doing its job. A thread that picks up the heavy directory pushes its subdirectories into its local queue, other idle threads steal from it, and the load distributes.

---

### Thread scaling

```cpp
BENCHMARK(BM_BuildTree_ThreadScaling)
    ->Arg(1)->Arg(2)->Arg(4)->Arg(8)->Arg(16)
```

This runs the same workload with increasing thread counts to see whether more threads actually help and where the returns diminish.

**Results:**

| Threads | Linux | Windows |
|---|---|---|
| 1 | 45.3 ms | 40.3 ms |
| 2 | 26.4 ms | 21.5 ms |
| 4 | 14.7 ms | 12.7 ms |
| 8 | 7.87 ms | 8.15 ms |
| 16 | 5.31 ms | 8.76 ms |

Linux scales cleanly all the way to 16 threads, each doubling roughly halves the time. Windows scales well up to 8 threads then stops. At 16 threads on Windows, the time actually increases slightly compared to 8.

---

## A few things worth knowing about Google Benchmark

**The CPU scaling warning.** The Linux results include:

WARNING CPU scaling is enabled, the benchmark real time measurements
may be noisy and will incur extra overhead.

This means the CPU frequency was not pinned during the run. For publication quality benchmarks you would disable frequency scaling first. For a project 
like this, the warning is worth acknowledging but does not invalidate the results, the relative comparisons hold even if the absolute numbers shift slightly.


---

## The full benchmark code

The microbenchmarks are in the [`benchmark directory`](https://github.com/jnyfah/phanes)If you want to run them yourself, the only dependency beyond the project itself is Google Benchmark, which CMake will fetch automatically.