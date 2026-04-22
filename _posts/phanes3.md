---
title: 'Phanes: (Part 3 — Work Stealing)'
excerpt: 'Per-thread queues, load imbalance, and stealing from your neighbours'
coverImage: '/assets/blog/worksteal.jpeg'
date: '2026-04-24T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/worksteal.jpeg'
---

In [Part 2](/posts/phanes2/), the introduction of thread pool gave us real parallelism, but all those threads were sharing a single task queue protected by a single mutex. Every submit and every pop required acquiring the same lock, and under load that contention became a heavy tax on throughput.

I proposed a solution earlier: to give each thread its own queue. This means the threads would only talk to their own queue and mostly ignore each other, so the 
lock contention problem largely goes away.

But a new problem surfaces immediately. What happens when one thread picks up a deep, wide directory subtree and its local queue fills up with hundreds of subdirectory tasks, while other threads, having picked shallower subtrees, drain their queues and go idle? You have traded contention for load imbalance. The work exists, the threads exist, but the work and the idle threads are in different places.

Well `Work stealing` is the solution. An idle thread does not just go to sleep the moment its queue is empty, it first looks at the queues of other threads and tries to take some of their pending tasks. If thread B is sitting on 200 tasks and thread A has nothing to do, thread A reaches into thread B's queue and takes half. Now they  both have work to do.

The concept is not new, it has been a staple of production schedulers ever since. The interesting questions are in the implementation details: which thread do you steal from, how much do you steal, and what do you do when there is nothing to steal?

---

## What changed from Part 2

In Part 2 the threadpool had one struct doing everything: one queue, one mutex, shared by all threads. THere in Part 3 pool splits that into a `Worker` struct that each 
thread owns exclusively, plus a global queue that remains as a fallback:

```cpp
struct Worker
{
    std::thread thread;
    std::mutex guard;
    std::deque<std::function<void()>> tasks;
};
```

The `deque` instead of `queue` is load-bearing: a `std::queue` only lets you push to the back and pop from the front. A `std::deque` lets you pop from 
either end and work stealing specifically takes from the *back* of a victim's queue while the owner works from the *front*. That separation reduces the chance 
that the owner and the thief ever touch the same task, which means less lock contention even when stealing is happening.

Each worker gets its own `guard` mutex, so a thread doing local work never contends with any other thread. Only during stealing, which is the exception, not the 
rule, requires briefly locking someone else's queue.

---

## The three-tier lookup

Every worker loop now follows the same priority order on every iteration:

**1. Check local queue first**

```cpp
{
    auto& w = *workers[id];
    std::lock_guard lock(w.guard);
    if (!w.tasks.empty())
    {
        task = std::move(w.tasks.front());
        w.tasks.pop_front();
    }
}
```

This is the fast path. The worker locks only its own queue, which no other thread is pushing to, so this lock is almost never contended.

**2. Fall back to the global queue**

```cpp
if (!task)
{
    std::lock_guard lock(global_guard);
    if (!global_queue.empty())
    {
        task = std::move(global_queue.front());
        global_queue.pop();
    }
}
```

The global queue still exists for tasks submitted from outside the pool, the initial root directory task, for example, comes from the main thread, not from a worker. Workers check it only when their local queue is empty.

**3. Try to steal**

```cpp
if (!task)
{
    for (size_t i = 0; i < STEAL_ATTEMPTS && !task; ++i)
    {
        task = try_steal(id);
        if (!task)
            std::this_thread::yield();
    }
}
```

Only if both the local and global queues are empty does the thread attempt stealing, here it tries up to 64 times before giving up and sleeping, because going 
to sleep the instant stealing fails once is too aggressive. A thread might fail to steal simply because all victims were locked at that exact moment, and a moment later there could be hundreds of tasks available.

---

## How stealing works

```cpp
auto try_steal(size_t self) -> std::function<void()>
{
    std::uniform_int_distribution<size_t> dist(0, N - 1);

    for (size_t attempt = 0; attempt < N; ++attempt)
    {
        size_t victim_id = dist(rng);
        if (victim_id == self) continue;

        auto& victim = *workers[victim_id];
        std::unique_lock lock(victim.guard, std::try_to_lock);

        if (!lock || victim.tasks.empty()) continue;

        size_t steal_count = std::max<size_t>(1, victim.tasks.size() / 2);
        // move tasks from victim's back to stealer's front ...
    }
    return {};
}
```

Three decisions are worth unpacking here:

**Random victim selection.** The stealer does not scan workers in order, it picks a random victim each attempt. Ordered scanning would cause every idle 
thread to pile onto the same busy worker simultaneously. Randomizing spreads the stealing pressure across all busy threads. ( Future me here: How true is this ?? well in the end i figured this did not make any diffrence for my code so i changed it no none randomized)

**`try_to_lock` instead of blocking.** If the victim's lock is already held, the stealer skips it and tries another. Blocking would mean an idle thread waiting on a busy thread's mutex, which reintroduces exactly the contention we were trying to avoid.

**Stealing half, not one.** Taking half the victim's remaining tasks means the stealer arrives with enough work to stay busy for a while, rather than stealing one task, finishing it in microseconds, and immediately needing to steal again.

---

## Submitting tasks: local vs global

There is one more change from Part 2 that is easy to miss. In Part 2, `submit` always pushed to the shared global queue. In Part 3, `submit` checks whether the caller is itself a worker thread:

```cpp
void submit(std::function<void()> task)
{
    pending_tasks.fetch_add(1, std::memory_order_relaxed);
    if (current_worker_id == NO_WORKER_ID)
    {
        // caller is external — push to global queue
        std::lock_guard lock(global_guard);
        global_queue.push(std::move(task));
        condition.notify_one();
    }
    else
    {
        // caller is a worker — push to its own local queue
        auto& worker = *workers[current_worker_id];
        std::lock_guard lock(worker.guard);
        worker.tasks.push_back(std::move(task));

        if (local_size > 1 && idle_workers.load(std::memory_order_relaxed) > 0)
        {
            condition.notify_one();
        }
    }
}
```

The `current_worker_id` thread-local variable is set when each worker starts its loop. If `submit` is called from a worker thread — which happens every time a directory scan discovers subdirectories — the new tasks go directly into that worker's local queue, skipping the global queue and its mutex entirely. Only tasks submitted from outside the pool (like the initial root scan) touch the global queue.

This is the key difference that makes the per-thread queue design actually reduce contention. In our traversal, the vast majority of task submissions come from worker threads discovering subdirectories — so the vast majority of submissions now happen without any cross-thread lock at all.

---

## A note on memory_order_relaxed

You will notice the atomics in this version use `memory_order_relaxed` rather than the default sequential consistency:

```cpp
pending_tasks.fetch_add(1, std::memory_order_relaxed);
idle_workers.fetch_add(1, std::memory_order_relaxed);
```

`memory_order_relaxed` means the atomic operation itself is atomic — no other thread will see a half-updated value — but the compiler and CPU are free to reorder it relative to other memory operations. That sounds dangerous, but here it is safe: these counters are hints, not hard synchronization points. The actual synchronization — the guarantee that a sleeping thread sees new tasks before waking — is provided by the condition variable and its associated mutex, which give us the full memory barrier we need. The relaxed atomics are just cheap counters riding alongside that existing synchronization.

__Part 4 will revisit memory ordering in much more depth when the mutexes themselves go away.__

---

## The results

*(Add your benchmarks here — same format as Parts 1 and 2)*

---

## What is still not ideal

This design is genuinely better than Part 2 under load imbalance. But it still has mutexes everywhere — on every local queue, on the global queue, on every steal attempt. For most workloads that is fine. But the stealing path in particular — which is the hot path when imbalance is highest — acquires and releases locks on other threads' queues in a tight loop.

Part 4 replaces the per-thread `deque` with a lock-free structure that lets the owner push and pop without any lock at all, and lets stealers operate with only a single atomic CAS rather than a mutex acquisition. That is where the memory ordering discussion gets serious.