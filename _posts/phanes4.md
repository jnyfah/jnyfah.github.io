---
title: 'Phanes: (Part 4 — Lock-Free)'
excerpt: 'Removing the last locks, one memory order at a time'
coverImage: '/assets/blog/lockfree.jpeg'
date: '2026-05-01T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/lockfree.jpeg'
---

In [Part 3](/posts/phanes3/), work stealing gave each thread its own queue and let idle threads steal tasks from busy ones, this meant a thread working through its own queue touches no other thread's lock at all. But the stealing path, the exact path that matters when load imbalance is highest was still acquiring and releasing mutexes in a tight loop. On Windows, that overhead was bad enough to make Part 3 slower than the plain thread pool from Part 2.

The fix is to make the deque itself lock-free so there will be no mutex contention when stealing

---

## What lock-free actually means

Lock-free does not mean no synchronization it just means no mutexes. The threads still coordinate, they just do it with atomic operations and memory ordering guarantees instead of locks. I have added links to resources at the end of this post for more insights to atomic operations.

The deque needs three operations just like the normal deque:

- `push_back` — the owner thread adds a task to the back
- `pop_back` — the owner thread takes a task from the back
- `steal_front` — a thief thread takes a task from the front

Owner operations happen at the back, stealing happens at the front as before so it means the owner and thieves are usually touching different ends of the deque and do not interfere with each other at all.

The one hard case is when there is exactly one item left. Both the owner popping from the back and a thief stealing from the front want the same slot. In [Part 3](/posts/phanes3/) this was not a problem because the mutex on the deque meant only one thread could be inside the operation at a time, so whoever got the lock got the item and the other thread just saw an empty deque. 

Here there is no mutex. Both threads can be mid-operation simultaneously, having already read the same state. Only one of them can win, and both need to know who won without anything serializing them. That is where the interesting memory ordering work lives, and we will get to it. 

---

### The Buffer

The deque uses a dynamically resizable circular buffer:

```cpp
struct Buffer
{
    std::int64_t capacity;
    std::int64_t mask;
    std::unique_ptr<T[]> data;

    explicit Buffer(std::int64_t c)
        : capacity(c), mask(c - 1), data(std::make_unique<T[]>(c))
    {
        assert(capacity && (!(capacity & (capacity - 1))) && 
               "Capacity must be a power of 2!");
    }

    auto resize(std::int64_t f, std::int64_t b) const -> std::unique_ptr<Buffer>
    {
        auto next = std::make_unique<Buffer>(capacity * 2);
        for (std::int64_t i = f; i < b; ++i)
            next->data[i & next->mask] = data[i & mask];
        return next;
    }
};
```

Two things worth explaining here.

**Why circular?** A plain dynamic array would need to shift elements or reallocate frequently as the deque shrinks and grows. A circular buffer reuses slots, `front` and `back` are unbounded integers that just keep incrementing, and the mask wraps them into valid array indices. The buffer only needs to grow when `back - front >= capacity`, i.e. when it is genuinely full, not just because the indices got large.

**Why power of 2?** To index into a circular buffer you need to wrap the index around when it exceeds the capacity. The obvious way is modulo: `index % capacity`. But modulo is a division, and division is slow. If capacity is always a power of 2, you can replace `index % capacity` with `index & (capacity - 1)`, a single bitwise AND. That is what `mask` is: `capacity - 1`, precomputed once and reused on every access.

For example, with capacity 8 (binary `1000`), the mask is 7 (binary `0111`). Any index ANDed with `0111` gives you the bottom three bits exactly the remainder you would get from `% 8`, but without the division.

---

### False sharing and alignas(64)

Before we look at the member variables, there is a hardware detail worth understanding first.

Modern CPUs do not read and write individual bytes from memory. They work in chunks called **cache lines**  typically 64 bytes on x86. When a CPU core reads a variable, it loads the entire cache line containing it into its L1 cache. When it writes to that variable, it marks the entire cache line as modified and invalidates copies of it in every other core's cache.

This becomes a problem when two threads are writing to *different* variables that happen to live on the *same* cache line. Neither thread is actually sharing data they are writing to separate variables but the CPU does not know that. Every write by one thread invalidates the cache line for the other, forcing a cache miss on the next access. This is **false sharing**, and it is a silent performance killer in multithreaded code.

[Scott Meyers talk on Cpu Caches and Why You Care](https://youtu.be/WDIkqP4JbkE?si=TDwcUloUJQt_nKZS) goes deep in details about this.

In our deque, `front` is written by thieves and `back` is written by the owner. They are completely independent variables, but if they land on the same cache line, every time a thief updates `front` it invalidates the owner's cached copy of `back` and vice versa even though neither actually cares about the other's variable.

The fix is `alignas(64)`:

```cpp
alignas(64) std::atomic<std::int64_t> front{0};
alignas(64) std::atomic<std::int64_t> back{0};
alignas(64) std::atomic<Buffer*> buffer;
```

`alignas(64)` tells the compiler to place each variable at a 64-byte boundary, which guarantees it occupies its own cache line. Now when a thief writes `front`, it invalidates only the cache line holding `front` the owner's `back` is on a completely separate line and stays cached. The coordination still happens, but without the false sharing tax on every operation.

---

### Memory ordering

Memory ordering is the trickiest part of this deque, but understanding the basics is enough to follow the design. Links at the end for more insights

CPUs and compilers are allowed to reorder instructions for performance. On a single thread this is invisible the result is always the same as if everything 
ran in order. 

For example, a compiler might reorder these two lines:

```cpp
int x = compute();   // expensive
log_start = true;    // flag
```

The compiler might reorder this by storing `log_start` first, then computing `x`. On a single thread you would never notice because no one else is watching. But if another thread is waiting for `log_start` to be true before reading `x`, it might read `x` before it has been computed, hat is the problem memory ordering prevents.

On multiple threads, reordering in one thread can become visible to another thread in ways that break correctness. Memory ordering is how you tell the compiler and CPU which reorderings are not allowed.

C++ has six memory orderings in total, well actually 5 because one of them have been depreciated :

**`memory_order_relaxed`** — this means the operation is atomic yes but the compiler and CPU can reorder it freely relative to other operations. Use this when you only need the atomicity, not any ordering guarantee. Reads and writes with relaxed ordering are the cheapest.

**`memory_order_acquire`** — no memory operation *after* this load in program order can be reordered to appear *before* it. Think of it as a one-way barrier: everything below stays below.

**`memory_order_release`** — no memory operation *before* this store in program order can be reordered to appear *after* it. Everything above stays above.

>Acquire and release work as a pair. If thread A does a release store on variable X and thread B does an acquire load on X and sees the value A stored, then B is guaranteed to see *everything A wrote before the release store*. This is the fundamental handshake that lets one thread safely pass data to another.

**`memory_order_seq_cst`** — sequential consistency. Every seq_cst operation participates in a single global total order that all threads agree on. This is the strongest and most expensive ordering.

**`memory_order_acq_rel`** — both acquire and release at once. This is used on read-modify-write operations, where a single operation both reads and writes. The acquire side prevents reordering of operations after it, the release side prevents reordering of operations before it. 

**Fences** — `std::atomic_thread_fence` applies an ordering constraint without attaching it to a specific atomic variable. Where acquire and release are tied to a single load or store, a fence covers *all* memory operations around it.

### Why seq_cst global ordering matters:

Consider four threads running simultaneously each thread runs each function:

```cpp
std::atomic<bool> x{false}, y{false};
int r1, r2;

void writer_a() { x.store(true, std::memory_order_seq_cst); }
void writer_b() { y.store(true, std::memory_order_seq_cst); }

void reader_c() {
    while (!x.load(std::memory_order_seq_cst));
    r1 = y.load(std::memory_order_seq_cst);
}
void reader_d() {
    while (!y.load(std::memory_order_seq_cst));
    r2 = x.load(std::memory_order_seq_cst);
}
```

`reader_c` waits until it sees `x == true`, then reads `y`. `reader_d` waits until it sees `y == true`, then reads `x`. Can we end up with both `r1 == 0` and `r2 == 0`?

Thread 3 runs `reader_c`, it spins until it sees `x == true`, then reads `y`. Thread 4 runs `reader_d`, it spins until it sees `y == true`, then reads `x`.

Let us think through what can go wrong without a global order. 

Without a global ordering, thread 3 could see the stores in the order `x, y`: it unblocks on `x`, reads `y`, and gets `r1 = 0` because from its perspective `y` has not been stored yet. Simultaneously, thread 4 could see the stores in the order `y, x`: it unblocks on `y`, reads `x`, and gets `r2 = 0` for the same reason. Both readers are observing a different order of the same two stores, and both walk away with the wrong answer at the same time.

With seq_cst, every operation joins a single global timeline. Either `x.store` comes before `y.store` in that timeline or the other way around but all threads agree on which. If `x` comes first, then by the time `reader_d` sees `y == true`, `x == true` is already earlier in the global order, so `r2` must be 1. The same logic applies the other way around for `r1`. Both `r1 == 0` and `r2 == 0` becomes impossible.


---

### push_back: the owner adds a task

```cpp
auto push_back(T item) -> void
{
    const auto b = back.load(std::memory_order_relaxed);
    const auto f = front.load(std::memory_order_acquire);

    auto* buf = buffer.load(std::memory_order_relaxed);
    if (b - f >= buf->capacity)
    {
        auto next = buf->resize(f, b);
        Buffer* next_raw = next.get();
        oldBuffer.push_back(std::move(next));
        buffer.store(next_raw, std::memory_order_release);
        buf = next_raw;
    }

    buf->data[b & buf->mask] = item;
    back.store(b + 1, std::memory_order_release);
}
```

**`back` load is relaxed** because `back` is only ever written by the owner thread. The owner reading its own variable has no synchronization requirement no other thread is racing to change it at this point.

**`front` load is acquire** because thieves write `front` when they steal. The owner needs to see the most up-to-date value of `front` to know how much space is available. The acquire pairs with the seq_cst CAS in `steal_front`, if a thief has advanced `front`, the owner's acquire load is guaranteed to see it.

**`buffer` store is release** because before storing the new buffer pointer, the owner has written data into it. The release ensures that any thread which subsequently loads the buffer pointer with an acquire sees the fully initialized buffer contents, not a partially written one.

**`back` store is release** for the same reason the owner has just written `item` into the buffer. The release ensures that a thief who loads `back` with an acquire sees the item that was written before `back` was advanced.

---

## pop_back: the owner takes a task

```cpp
auto pop_back() noexcept -> std::optional<T>
{
    auto b = back.load(std::memory_order_relaxed);
    b = b - 1;
    back.store(b, std::memory_order_relaxed);

    std::atomic_thread_fence(std::memory_order_seq_cst);

    auto f = front.load(std::memory_order_relaxed);

    if (f > b)
    {
        back.store(f, std::memory_order_relaxed);
        return std::nullopt;
    }

    auto* buf = buffer.load(std::memory_order_relaxed);

    if (f == b) // last item
    {
        if (!front.compare_exchange_strong(f, f + 1,
                std::memory_order_seq_cst,
                std::memory_order_relaxed))
        {
            back.store(f, std::memory_order_relaxed);
            return std::nullopt;
        }
        back.store(f + 1, std::memory_order_relaxed);
        return buf->data[b & buf->mask];
    }

    return buf->data[b & buf->mask];
}
```

This function has two cases: more than one item, and exactly one item.

**More than one item** is straightforward. The owner decrements `back`, checks that the deque is not empty (`f > b`), and returns the item at the new `back`. No thieves are racing for this item because thieves only touch `front`.

**Exactly one item** (`f == b`) is the race condition. Both the owner trying to pop from the back and a thief trying to steal from the front want this same item. The CAS on `front` resolves it: whoever successfully advances `front` from `f` to `f + 1` wins. If the owner wins, it returns the item. If the thief wins first, the owner's CAS fails and it returns `nullopt`.

**The fence.** The seq_cst fence between `back.store(b)` and `front.load()` is the most subtle part of the whole deque. Here is why it is necessary.

TODO this whole section is slightly off because seq cst global order is btwe the back sotre and front load, the cas front on pop the cas on steal, the banc and front load on steal, so when explaaining why fence is there, we ned to make it makes sense not just cuz we want back soted before we load fence but cuz we dont want unnecsaaery cas fails even tho CAS catches all


The owner decrements `back` to signal "I am claiming this slot." A thief loads `back` to check if there is anything to steal. Without the fence, threads may make decisions from stale views and perform unnecessary retries / failed CAS attempts


The seq_cst fence establishes a point in the global order. The owner's `back.store` happens before the fence; the owner's `front.load` happens after. The thief's seq_cst fence in `steal_front` does the same. The global order guarantee means at least one of them sees the other's write — the race resolves correctly, and the CAS ensures only one of them claims the item.

One thing worth being honest about: without the fence, the CAS would still prevent both threads from claiming the same item. The CAS is the true safety net — only one thread can successfully advance `front`, so correctness is preserved either way.



The fence is about performance, not safety. Without it, a thread might decrement `back`, fail to see the thief's update to `front` due to reordering, conclude the deque is empty, then proceed to the CAS only to lose it  wasting the round trip to the CAS entirely. The fence ensures that by the time either thread checks the other's index, they are seeing a consistent enough view of the world to make a good decision before committing. Fewer wasted CAS attempts means less contention on `front`,which matters when you have 32 threads all potentially stealing at.once.


---

## `steal_front` — the thief's view

```cpp
auto steal_front() noexcept -> std::optional<T>
{
    auto f = front.load(std::memory_order_relaxed);
    std::atomic_thread_fence(std::memory_order_seq_cst);
    auto b = back.load(std::memory_order_acquire);

    if (f >= b)
        return std::nullopt;

    auto* buf = buffer.load(std::memory_order_relaxed);
    const T value = buf->data[f & buf->mask];

    if (!front.compare_exchange_strong(f, f + 1,
            std::memory_order_seq_cst,
            std::memory_order_relaxed))
        return std::nullopt;

    return value;
}
```

**`front` load is relaxed before the fence** because the fence itself provides the ordering. Loading `front` with acquire instead would also be correct, but the 
fence covers all memory operations around it attaching acquire to the load would be redundant.

**`back` load is acquire** to sync with the owner's release store in `push_back`. If the owner has pushed items and released `back`, the thief's acquire load guarantees it sees those items in the buffer before deciding whether to steal.

**The CAS on `front`** is the commitment. The thief reads the value at `f`, then tries to advance `front` from `f` to `f + 1`. If another thief or the owner has already advanced `front`, the CAS fails and the thief returns `nullopt` and tries again. If the CAS succeeds, the thief has claimed the item.

**Is there an ABA problem?** ABA is a classic lock-free hazard: a variable changes from A → B → A between your read and your CAS, so the CAS succeeds even though the world changed underneath you. Here it cannot happen. `front` is monotonically increasing — it only ever moves forward. Once it advances past a value it never returns to it, so a thief reading `f` and CAS-ing `f → f + 1` is always safe. If the CAS succeeds, `front` really was still `f`.

---

## Old buffers and why we never free them

When `push_back` grows the buffer, the old one goes into `oldBuffer` and stays there for the lifetime of the deque:

```cpp
std::vector<std::unique_ptr<Buffer>> oldBuffer;
```

This looks like a wasting memory but it is not, well it is in a way though, but it is a deliberate safety decision. When the owner grows the buffer, a thief might still be in the middle of `steal_front`, having loaded the old buffer pointer but not yet read the item from it. If the owner freed the old buffer immediately, the thief would be reading freed memory.

The safe solution is to keep all old buffers alive. In our case the deque is owned by a single worker for its lifetime, so the buffers are freed when the worker is destroyed.

---

## The results

**Linux — /home** *(22 threads — hardware_concurrency | Clang + Ninja)*

| | |
|---|---|
| Directories | 596,587 |
| Files | 1,985,366 |
| Symlinks | 7,918 |
| Cold run | 2,815 ms |
| Warm mean | 2,839 ms |
| Warm throughput | ~912,314 entries/s |
| Speedup vs Part 3 | **~2.97x** |

**Windows — C:\\** *(32 threads — hardware_concurrency | MSVC)*

| | |
|---|---|
| Directories | 233,107 |
| Files | 1,275,311 |
| Symlinks | 30 |
| Cold run | 6,225 ms |
| Warm mean | 6,265 ms |
| Warm throughput | ~240,771 entries/s |
| Speedup vs Part 3 | **~2.02x** |

The Linux number is the one that stands out. Nearly 3x faster than Part 3 and almost 6x faster than the single-threaded baseline from Part 1 — from removing mutexes on a path that was already parallel. That is how much the lock overhead was costing on the steal path.

Windows tells a cleaner story than Part 3 did. The warm runs are remarkably consistent — the cold run and warm mean are almost identical, which means the bottleneck is no longer the page cache or the mutex lottery but something predictable and steady. The lock-free steal path removed the variance that made Part 3's Windows numbers so noisy.

It is also worth noting that Linux's cold run (2,815ms) is essentially the same as the warm mean (2,839ms). That is a sign the workload has shifted from I/O bound to CPU/allocation bound — the traversal is now fast enough that the page cache barely matters. The tree construction and memory allocation are the remaining bottleneck,not the filesystem reads.


---

## How far we have come

| Version | Linux (warm) | Windows (warm) |
|---|---|---|
| Part 1 — Single-threaded DFS | 15,660 ms | 65,204 ms |
| Part 2 — Thread pool | 10,031 ms | 7,058 ms |
| Part 3 — Work stealing (mutex) | 8,452 ms | 12,540 ms |
| Part 4 — Work stealing (lock-free) | 2,839 ms | 6,265 ms |


On Linux, what took nearly 16 seconds on a single thread now finishes in under 3. On Windows, what took over a minute now takes 6 seconds.

Part 2 gave the biggest structural jump on Windows by introducing parallelism at all. Part 4 gave the biggest jump on Linux by getting the steal path out of the way of the threads that were already working well together. Part 3 was the awkward middle child on both platforms — better load distribution on paper, but the mutex overhead was eating the gains


---



## Further reading

I promised links and here they are. These are the resources that actually helped me understand this rather than just cargo-cult the memory orders:


- **Scott Meyers** - [Cpu Caches and Why You Care](https://youtu.be/WDIkqP4JbkE?si=TDwcUloUJQt_nKZS)

- **Fedor Pikus — "C++ atomics, from basic to advanced"** (CppCon 2017)  [youtu.be/ZQFzMfHIxng](https://youtu.be/ZQFzMfHIxng?si=eCx1JM_sFqHQRsbU) — the most thorough walkthrough of what atomics actually do at the hardware level.

- **Herb Sutter — "Lock-Free Programming", Parts I & II** (CppCon 2014)  [Part I](https://youtu.be/c1gO9aB9nbs?si=GU29iRlrW_BjGVZ0) · [Part II](https://youtu.be/CmxkPChOcvw?si=p_Cf_-w4p2pGO0xe) — the razor blades talk. Part II is where the deque-style reasoning lives.

- **Alex Dathskovsky — "C++11 to C++23 in the C++ Memory Model"** (C++Now 2024)  [youtu.be/VWiUYbtSWRI](https://youtu.be/VWiUYbtSWRI?si=-IP4ZD2e1K5JQJEz) — good for seeing how the model has evolved and where it is going.

- **Michael Wong — "C++11/14/17 atomics and memory model"** (CppCon 2015)  [youtu.be/DS2m7T6NKZQ](https://youtu.be/DS2m7T6NKZQ?si=J3jQJDMPBxG_Fih3)

- **Mara Bos — "Rust Atomics and Locks", Chapter 3: Memory Ordering**  [mara.nl/atomics/memory-ordering.html](https://mara.nl/atomics/memory-ordering.html) 

- **Chase & Lev — "Dynamic Circular Work-Stealing Deque"** (2005)  [dl.acm.org/doi/10.1145/1073970.1073974](https://dl.acm.org/doi/10.1145/1073970.1073974) — the original paper. Short and worth reading once the code makes sense.