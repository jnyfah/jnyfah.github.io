---
title: 'Phanes: (Part 2 — The Thread Pool)'
excerpt: 'Parallel traversal, a shared queue, and the mutex tax'
coverImage: '/assets/blog/threading.jpeg'
date: '2026-04-21T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/threading.jpeg'
---

---

In [Part 1](_posts/phanes.md), I benchmarked a single-threaded DFS traversal against real filesystems and landed on an obvious conclusion: scanning thousands of entries on one thread does not make any sense atall. Directory traversal is independent, this means the contents of one directory have nothing to do with the contents of another, so there is no reason they have to be visited one at a time.

The natural fix is a thread pool. 😑

---

## What is a thread pool?

A thread pool is exactly what it sounds like: a fixed set of threads that sit alive for the lifetime of your program, sleeping when there is nothing to do and waking up to pull work off a shared queue when there is.

The alternative to this would be spawning a new thread for every task, this works fine for occasional work but falls apart under load as thread creation is not free: there is stack allocation, OS scheduler registration, etc etc. When you are dispatching tens of thousands of directory scan tasks, paying that cost per task is not viable.


A thread pool reduces that cost. You pay for thread creation once at startup, and from then on submitting work is just a queue push and a condition variable signal.

The implementation has four moving parts:

**1. The task queue and a way to add to it**

```cpp
std::queue<std::function<void()>> tasks;

void submit(std::function<void()> task)
{
    {
        std::lock_guard lock(guard);
        if (!is_active)
            throw std::runtime_error("ThreadPool stopped");
        tasks.push(std::move(task));
    }
    condition.notify_one();
}
```

`submit` locks the queue (to avoid data race), pushes the task, then signals one sleeping worker to wake up. The `std::function<void()>` wrapper lets us store any callable, be it lambdas, function pointers without the pool caring what the task actually does.

**2. Constructor: initializing the workers**

```cpp
explicit ThreadPool(size_t threads = std::thread::hardware_concurrency())
{
    workers.reserve(threads);
    for (size_t i = 0; i < threads; i++)
        workers.emplace_back(&ThreadPool::worker_loop, this);
}
```

All threads start in `worker_loop` immediately. They will just block on the condition variable until the first task arrives. The default argument  `std::thread::hardware_concurrency()` queries the OS for the number of logical cores on the machine, so the pool automatically scales to the hardware it runs on without any manual tuning.

**3. The worker loop**

```cpp
void worker_loop()
{
    while (true)
    {
        std::function<void()> task;
        {
            std::unique_lock lock(guard);
            condition.wait(lock, [this] { return !is_active || !tasks.empty(); });
            if (!is_active && tasks.empty())
                return;
            task = std::move(tasks.front());
            tasks.pop();
        }
        task();
    }
}
```

Each worker thread runs this loop for its entire lifetime. It acquires the lock, waits on the condition variable until either the pool shuts down or a task appears, then it pops the task, releases the lock, then runs it. The lambda predicate passed to `condition.wait` guards against unnecessary  wakeups, if a thread wakes up and the queue is still empty and the pool is still active, it goes straight back to sleep.

**4. Shutdown**

```cpp
~ThreadPool()
{
    {
        std::lock_guard lock(guard);
        is_active = false;
    }
    condition.notify_all();
    for (auto& worker : workers)
        worker.join();
}
```

Setting `is_active = false` and broadcasting wakes every sleeping thread. Each one re-checks the condition, drains any remaining tasks, then exits the loop when it sees `!is_active && tasks.empty()`. The destructor then waits for all of them to finish before returning.

Note: The copy and move constructors are deleted. A thread pool owns OS resources and has threads holding a pointer to `this` so copying or moving it makes no sense.


---

## Applying this to directory traversal

The interesting thing here in our case is that the threads are acting as both **producers** and **consumers** of tasks.

In the DFS version, discovering a subdirectory just pushed it onto a local stack. In the thread pool version, discovering a subdirectory means submitting a new scan task to the pool. So thread A picks up directory `/home/user`, scans it, finds subdirectories `Documents`, `Downloads`, and `Pictures`, and submits three new tasks which threads B, C, and D can immediately pick up and start working on in parallel.

If you want to browse the full code for this version, you can explore the repository at this commit: [`a78093f`](https://github.com/jnyfah/phanes/tree/a78093f423111557474de9add4d92c696a015437)

Here is how that plays out on the same machines from Part 1:

**Linux — /home** *(22 threads- hardware_concurrency)*

| | |
|---|---|
| Directories | 583,302 |
| Files | 1,985,817 |
| Symlinks | 7,837 |
| Cold run | 14,839 ms |
| Warm mean | 10,031 ms |
| Warm throughput | ~256,145 entries/s |
| Speedup vs DFS Part 1 | **~1.56x** |

**Windows — C:\\** *(32 threads - hardware_concurrency)*

| | |
|---|---|
| Directories | 227,279 |
| Files | 1,249,148 |
| Symlinks | 29 |
| Cold run | 10,320 ms |
| Warm mean | 7,058 ms |
| Warm throughput | ~209,385 entries/s |
| Speedup vs DFS Part 1 | **~9.2x** |

Linux improved modestly. Windows improved dramatically, nearly 9x faster than the single-threaded baseline. That gap makes sense when you think back to Part 1: Windows was already paying a heavy per-entry cost through the NTFS metadata layer, that gave parallelism more room to help, while Linux was already efficient enough that gains were smaller.

One number worth flagging: on both platforms, the cold run is noticeably slower than the warm runs. That is the OS page cache at work, the first traversal hits disk for every directory read, while subsequent runs find most of the  metadata already cached in memory. The thread pool does not change that fundamental I/O cost, it just uses the available time more efficiently once the cache is warm.

---

## The problem: everyone is fighting over one lock

The improvement is good, but the design still has a structural problem that the benchmark numbers only hint at.

The pool has a single task queue and a single mutex protecting it. Every time a thread wants to submit a new directory task, it has to acquire that mutex. Every time a thread wants to pull the next task, it has to acquire that mutex. When you have threads all discovering subdirectories in parallel and submitting work at the same time as other threads are trying to consume it, they all end up queuing for the same lock.

This is `mutex contention`: a tax on every unit of work the pool does. The threads are not spending that time scanning directories, they are spending it just waiting to touch the queue.

On smaller inputs it barely shows. On inputs like ours, over a million files and hundreds of thousands of directories, it starts to matter. The workers are busy enough that lock contention on the shared queue becomes a meaningful fraction of total runtime.

The obvious fix is to give each thread its own local queue so threads are not competing for the same lock on every operation. A thread works from its local queue first, only falling back to the global queue when its own is empty that way contention shrinks significantly.

But then a new problem surfaces. A thread that picks up a deep, wide subtree fills its local queue and works through it alone. Meanwhile, threads that got shallower subtrees finish quickly and sit idle.
 You have traded lock contention for load imbalance. 😅

That is the problem Part 3 addresses, with work stealing, where idle threads can reach into a busy thread's local queue and steal tasks off the other end.
