---
title: 'Phanes: (Part 4 — Lock-Free)'
excerpt: 'Removing the last locks, one memory order at a time'
coverImage: '/assets/blog/lockfree.jpeg'
date: '2026-04-25T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/lockfree.jpeg'
---

In [Part 3](/posts/phanes3/), work stealing gave each thread its own queue and let idle threads steal tasks from busy ones. The happy path got genuinely better, a thread working through its own queue touches no other thread's lock at all. But the stealing path, which is the exact path that activates when load imbalance is highest, was still acquiring and releasing mutexes in a tight loop. On Windows, that overhead was bad enough to make Part 3 slower than the plain thread pool from Part 2.

The fix is to make the deque itself lock-free.

---

## What lock-free actually means

Lock-free does not mean no synchronization. It means no mutexes. The threads still coordinate, they just do it with atomic operations and memory ordering guarantees instead of locks.

The deque needs three operations just like the normal deque:

- `push_back` — the owner thread adds a task to the back
- `pop_back` — the owner thread takes a task from the back
- `steal_front` — a thief thread takes a task from the front

Owner operations happen at the back, stealing happens at the front as before so it means the owner and thieves are usually touching different ends of the deque and do not interfere with each other at all.

The one hard case is when there is exactly one item left. Both the owner popping from the back and a thief stealing from the front want the same slot. In Part 3 this was not a problem because the mutex on the deque meant only one thread could be inside the operation at a time, so whoever got the lock got the item and the other thread just saw an empty deque. Here there is no mutex. Both threads can be mid-operation simultaneously, having already read the same state. Only one of them can win, and both need to know who won without anything serializing them. That is where the interesting memory ordering work lives, and we will get to it.

---

## The Buffer — a circular array

The deque is backed by a dynamically resizable circular buffer:

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

## False sharing and alignas(64)

Before we look at the member variables, there is a hardware detail worth understanding because it directly shapes the design.

Modern CPUs do not read and write individual bytes from memory. They work in chunks called **cache lines**  typically 64 bytes on x86. When a CPU core reads a variable, it loads the entire cache line containing it into its L1 cache. When it writes to that variable, it marks the entire cache line as modified and invalidates copies of it in every other core's cache.

This becomes a problem when two threads are writing to *different* variables that happen to live on the *same* cache line. Neither thread is actually sharing data they are writing to separate variables but the CPU does not know that. Every write by one thread invalidates the cache line for the other, forcing a cache miss on the next access. This is **false sharing**, and it is a silent performance killer in multithreaded code.

[Scott Meyers talk on Cpu Caches and Why You Care](https://youtu.be/WDIkqP4JbkE?si=TDwcUloUJQt_nKZS) goes deep in details about this 

In our deque, `front` is written by thieves and `back` is written by the owner. They are completely independent variables, but if they land on the same cache line, every time a thief updates `front` it invalidates the owner's cached copy of `back` and vice versa even though neither actually cares about the other's variable.

The fix is `alignas(64)`:

```cpp
alignas(64) std::atomic<std::int64_t> front{0};
alignas(64) std::atomic<std::int64_t> back{0};
alignas(64) std::atomic<Buffer*> buffer;
```

`alignas(64)` tells the compiler to place each variable at a 64-byte boundary, which guarantees it occupies its own cache line. Now when a thief writes `front`, it invalidates only the cache line holding `front` the owner's `back` is on a completely separate line and stays cached. The coordination still happens, but without the false sharing tax on every operation.

---

## Memory ordering — just enough to read the code

This is the part I said I would not skip, and I meant it. You do not need to understand the full C++ memory model to follow what comes next, but you do need to understand what problem memory ordering is solving.

CPUs and compilers are allowed to reorder instructions for performance. On a single thread this is invisible the result is always the same as if everything 
ran in order. 

TODO: give and example of compiler reordering on single thread and how it does not affect 

But on multiple threads, reordering in one thread can become visible to another thread in ways that break correctness. Memory ordering is how you tell the compiler and CPU which reorderings are not allowed.

There are four orderings we use in this deque:

**`memory_order_relaxed`** — the operation is atomic yes but the compiler and CPU can reorder it freely relative to other operations. Use this when you only need the atomicity, not any ordering guarantee. Reads and writes with relaxed ordering are the cheapest.

**`memory_order_acquire`** — no memory operation *after* this load in program order can be reordered to appear *before* it. Think of it as a one-way barrier: everything below stays below.

**`memory_order_release`** — no memory operation *before* this store in program order can be reordered to appear *after* it. Everything above stays above.

>Acquire and release work as a pair. If thread A does a release store on variable X and thread B does an acquire load on X and sees the value A stored, then B is guaranteed to see *everything A wrote before the release store*. This is the fundamental handshake that lets one thread safely pass data to another.

**`memory_order_seq_cst`** — sequential consistency. Every seq_cst operation participates in a single global total order that all threads agree on. This is the strongest and most expensive ordering.

TODO : do better in the paragraph
**Fences** — `std::atomic_thread_fence` applies an ordering constraint without attaching it to a specific atomic variable. A `seq_cst` fence establishes a point in the global order that all threads can reason about, regardless of which variables they are operating on.

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

TODO: frame better 
lets see, remember they are all running on different threads, thread 1 runs writer_a, thread 2 runs writer_b, thread 3 runs reader_c and thread 4 runs reader_d

now imagine thread 3 sees this 
x = 1 then y =1 next 
since it sees x =1 firsts the while loop passes and sets r1 to 0

but what thread 4 sees is 
y =1 and then x = 1
here it sees y -1 first and sets r2 to 0 too 

so you see thread 3 and 4 need to agree, on an order to which they see things, are we seeing x before y or y before x,lets pick one and agree on, it does not matter which other we pick but lets just agree on one certain order 


With seq_cst, no. Every seq_cst operation joins a single global timeline. Either 
`x.store` comes before `y.store` in that timeline or the other way around. If 
`x` comes first, then by the time `reader_d` sees `y == true`, `x == true` is 
already in the global order before it, so `r2` must be 1. If `y` comes first, 
the same argument applies for `r1`.

Without seq_cst — say, with just acquire/release — there is no global timeline. 
Each thread has its own view of the order in which stores happened, and those 
views can disagree. It becomes possible for `reader_c` to see `x` but not yet 
`y`, and simultaneously for `reader_d` to see `y` but not yet `x`, yielding both 
`r1 == 0` and `r2 == 0`. Both readers would be wrong about the state of the 
world at the same time.


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

## `pop_back` — the owner takes a task

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

The owner decrements `back` to signal "I am claiming this slot." A thief loads `back` to check if there is anything to steal. Without the fence, the CPU could reorder the owner's `back.store` and `front.load` — the owner might read `front` before its store to `back` is visible to the thief. At the same time, the thief might have already read `back` before the owner's store, decided the deque was empty, and given up. Both threads walk away thinking the deque is empty when 
there was actually one item. A task gets lost.

The seq_cst fence establishes a point in the global order. The owner's `back.store` happens before the fence; the owner's `front.load` happens after. The thief's seq_cst fence in `steal_front` does the same. The global order guarantee means at least one of them sees the other's write — the race resolves correctly, and the CAS ensures only one of them claims the item.

todo: do we need to add that without the fence, nothing actually happens like they both wont et the smae lement, CAS will catch everything  ?? but the fence just makes sure the loser dont not waste time going to CAS, there by derailing performance 

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

Todo: is there a point of talking about ABA problem ?????? 
**Is there an ABA problem?** ABA is when a variable changes from A to B and back 
to A between your read and your CAS, making the CAS succeed even though the world 
has changed. Here it cannot happen: `front` is monotonically increasing. Once it 
advances past a value, it never returns to it. A thief reading `f` and then 
CAS-ing `f → f + 1` is safe — if the CAS succeeds, `front` really was still `f`.

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

linux
============================================================
  Phanes build_tree benchmark  [multithreaded]
  Path          : /home
  Warm runs     : 5
  Pool threads  : 22 (hardware_concurrency)
  Note: ThreadPool is created fresh per build_tree() call
        so thread startup cost is included in every timing
============================================================

[1/3] Cold run (first call, OS page cache may be empty)...
  Result    : 596587 dirs, 1985366 files, 7918 symlinks, 0 errors
  Cold time : 2815.3 ms

[2/3] Warm runs (OS page cache populated)...
  run  1/ 5... 2424.6 ms
  run  2/ 5... 2777.8 ms
  run  3/ 5... 2783.9 ms
  run  4/ 5... 3139.6 ms
  run  5/ 5... 3068.1 ms
------------------------------------------------------------

[3/3] Summary
------------------------------------------------------------
  Cold (1 run)
    time       : 2815.3 ms
    throughput : 919930 entries/s

  Warm (5 runs)
  wall-clock    mean=  2838.8 ms  min=  2424.6 ms  max=  3139.6 ms  stddev= 253.5 ms
                throughput ~912314 entries/s
============================================================

Note: cold >> warm means I/O bound (disk/kernel readdir latency).
      cold ~= warm means CPU/allocation bound (tree construction).

jennifer-chukwu@jennifer-chukwu:~/phanes$ c

windows 

./build/msvc/bench/release/phanes_bench.exe C:\
============================================================
  Phanes build_tree benchmark  [multithreaded]
  Path          : C:\
  Warm runs     : 5
  Pool threads  : 32 (hardware_concurrency)
  Note: ThreadPool is created fresh per build_tree() call
        so thread startup cost is included in every timing
============================================================

[1/3] Cold run (first call, OS page cache may be empty)...
  Result    : 233107 dirs, 1275311 files, 30 symlinks, 0 errors
  Cold time : 6224.5 ms

[2/3] Warm runs (OS page cache populated)...
  run  1/ 5... 6298.9 ms
  run  2/ 5... 6305.4 ms
  run  3/ 5... 6128.6 ms
  run  4/ 5... 6391.0 ms
  run  5/ 5... 6201.5 ms
------------------------------------------------------------

[3/3] Summary
------------------------------------------------------------
  Cold (1 run)
    time       : 6224.5 ms
    throughput : 242341 entries/s

  Warm (5 runs)
  wall-clock    mean=  6265.1 ms  min=  6128.6 ms  max=  6391.0 ms  stddev=  90.9 ms
                throughput ~240771 entries/s
============================================================

Note: cold >> warm means I/O bound (disk/kernel readdir latency).
      cold ~= warm means CPU/allocation bound (tree construction).

PS C:\phanes>


---

## How far we have come

| Version | Linux throughput | Windows throughput |
|---|---|---|
| Part 1 — DFS | ~158,728/s | ~41,153/s |
| Part 2 — Thread pool | ~256,145/s | ~209,385/s |
| Part 3 — Work stealing | ~307,085/s | ~118,971/s |
| Part 4 — Lock-free | | |

---

## Further reading

If this post left you wanting to go deeper, these are the resources that actually helped me understand this stuff rather than just copy it, i know its alot sorryyy :

CppCon 2017: Fedor Pikus “C++ atomics, from basic to advanced. What do they really do?”  https://youtu.be/ZQFzMfHIxng?si=eCx1JM_sFqHQRsbU


C++11 to C++23 in the C++ Memory Model - Alex Dathskovsky - C++Now 2024 https://youtu.be/VWiUYbtSWRI?si=-IP4ZD2e1K5JQJEz


CppCon 2014: Herb Sutter "Lock-Free Programming (or, Juggling Razor Blades), Part I" https://youtu.be/c1gO9aB9nbs?si=GU29iRlrW_BjGVZ0

CppCon 2014: Herb Sutter "Lock-Free Programming (or, Juggling Razor Blades), Part II"  https://youtu.be/CmxkPChOcvw?si=p_Cf_-w4p2pGO0xe


CppCon 2015: Michael Wong “C++11/14/17 atomics and memory model..."  https://youtu.be/DS2m7T6NKZQ?si=J3jQJDMPBxG_Fih3

https://mara.nl/atomics/memory-ordering.html  Rust Atomics and Locks Chapter 3. Memory Ordering

chase lev paper https://dl.acm.org/doi/10.1145/1073970.1073974