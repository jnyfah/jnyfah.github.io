---
title: 'Phanes: (Part 2 — The Thread Pool)'
excerpt: 'Parallel traversal, a shared queue, and the mutex tax'
coverImage: '/assets/blog/threading.jpeg'
date: '2026-04-20T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/threading.jpeg'
---

---

In [Part 1](_posts/phanes.md), I benchmarked a single-threaded DFS traversal against real filesystems and landed on an obvious conclusion: scanning thousands of entries on one thread does not make any sense atall. Directory traversal is independent, the contents of one directory have nothing to do with the contents of another, so there is no reason they have to be visited one at a time.

The next fix is a thread pool.

---

## What is a thread pool?

A thread pool is exactly what it sounds like: a fixed set of threads that sit alive for the lifetime of your program, sleeping when there is nothing to do and waking up to pull work off a queue when there is.

The alternative to this would be spawning a new thread for every task, this works fine for occasional work but falls apart under load as thread creation is not free: there is stack allocation, OS scheduler registration, etc etc. When you are dispatching tens of thousands of directory scan tasks, paying that cost per task is not viable to create and destroy threads just like that thats to expensive 


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

**2. The worker loop**

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

Each worker thread runs this loop forever. It acquires the lock, waits on the condition variable until either a task appears or the pool shuts down, pops the task, releases the lock, then runs it. The lambda predicate passed to `condition.wait` guards against spurious wakeups — if the thread wakes up and the queue is still empty and the pool is still active, it goes back to sleep.

**3. Startup — initializing the workers**

```cpp
explicit ThreadPool(size_t threads = 8)
{
    workers.reserve(threads);
    for (size_t i = 0; i < threads; i++)
        workers.emplace_back(&ThreadPool::worker_loop, this);
}
```

All threads start in `worker_loop` immediately. They will just block on the condition variable until the first task arrives.

**4. Shutdown — draining and joining**

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

Setting `is_active = false` and broadcasting wakes every sleeping thread. Each one re-checks the condition, drains any remaining tasks, then exits the loop when it sees `!is_active && tasks.empty()`. The destructor waits for all of them to finish before returning.

Note: The copy and move constructors are always deleted. A thread pool owns OS resources and has threads holding a pointer to `this` so copying or moving it makes no sense.


---

## Applying this to directory traversal

The interesting thing here in our case is that the threads are acting as both **producers** and **consumers** of tasks.

In the DFS version, discovering a subdirectory just pushed it onto a local stack. In the thread pool version, discovering a subdirectory means submitting a new scan task to the pool. So thread A picks up directory `/home/user`, scans it, finds subdirectories `Documents`, `Downloads`, and `Pictures`, and submits three new tasks which threads B, C, and D can immediately pick up and start working on in parallel.

The results reflect that:

linux
Scan Summary
------------------

Directories       : 583302
Files             : 1985817
Symlinks          : 7837
Errors            : 0
Total Size        : 352.12 GB
Largest File      : .browse.VC.db-wal (59.95 GB)
Max Depth         : 22
Max Depth dir     : v1
Scan Duration     : 12s

============================================================
  Phanes build_tree benchmark  [multithreaded]
  Path          : /home
  Warm runs     : 5
  Pool threads  : 22 (hardware_concurrency)
  Note: ThreadPool is created fresh per build_tree() call
        so thread startup cost is included in every timing
============================================================

[1/3] Cold run (first call, OS page cache may be empty)...
  Result    : 583337 dirs, 1978162 files, 7837 symlinks, 0 errors
  Cold time : 14839.2 ms

[2/3] Warm runs (OS page cache populated)...
  run  1/ 5... 10914.9 ms
  run  2/ 5... 10754.4 ms
  run  3/ 5... 9611.1 ms
  run  4/ 5... 9538.3 ms
  run  5/ 5... 9335.3 ms
------------------------------------------------------------

[3/3] Summary
------------------------------------------------------------
  Cold (1 run)
    time       : 14839.2 ms
    throughput : 173145 entries/s

  Warm (5 runs)
  wall-clock    mean= 10030.8 ms  min=  9335.3 ms  max= 10914.9 ms  stddev= 664.5 ms
                throughput ~256145 entries/s
============================================================

Note: cold >> warm means I/O bound (disk/kernel readdir latency).
      cold ~= warm means CPU/allocation bound (tree construction).


windows 

Scan Summary
------------------

Directories       : 227279
Files             : 1249148
Symlinks          : 29
Errors            : 116
Total Size        : 461.27 GB
Largest File      : pagefile.sys (34.18 GB)
Max Depth         : 20
Max Depth dir     : lib
Scan Duration     : 7s


============================================================
  Phanes build_tree benchmark  [multithreaded]
  Path          : C:\
  Warm runs     : 5
  Pool threads  : 32 (hardware_concurrency)
  Note: ThreadPool is created fresh per build_tree() call
        so thread startup cost is included in every timing
============================================================

[1/3] Cold run (first call, OS page cache may be empty)...
  Result    : 227394 dirs, 1250305 files, 29 symlinks, 116 errors
  Cold time : 10320.0 ms

[2/3] Warm runs (OS page cache populated)...
  run  1/ 5... 8000.7 ms
  run  2/ 5... 6627.3 ms
  run  3/ 5... 6821.5 ms
  run  4/ 5... 6368.1 ms
  run  5/ 5... 7469.9 ms
------------------------------------------------------------

[3/3] Summary
------------------------------------------------------------
  Cold (1 run)
    time       : 10320.0 ms
    throughput : 143191 entries/s

  Warm (5 runs)
  wall-clock    mean=  7057.5 ms  min=  6368.1 ms  max=  8000.7 ms  stddev= 595.9 ms
                throughput ~209385 entries/s
============================================================

Note: cold >> warm means I/O bound (disk/kernel readdir latency).
      cold ~= warm means CPU/allocation bound (tree construction).


// add results 

The improvement is real, but it comes with a cost that the numbers will start to reveal on larger inputs.


--

## The problem: everyone is fighting over one lock

The pool has a single task queue and a single mutex protecting it.

Every time a thread wants to submit a new directory task, it has to acquire that mutex. Every time a thread wants to pull the next task, it has to acquire that mutex. When you have eight threads all discovering subdirectories in parallel and submitting work at the same time as other threads are trying to consume it, they all end up queuing for the same lock.

This is called `mutex contention`, and it is a tax on every unit of work the pool does. The threads are not spending that time scanning directories, they are spending it waiting to touch the queue !.

On smaller inputs it barely shows. On the kind of inputs we have (over a million files, hundreds of thousands of directories), it starts to matter. The workers are busy enough that lock contention on the shared queue becomes a meaningful fraction of runtime.

The obvious fix is to give each thread its own local queue, so threads are not competing for the same lock on every operation. A thread works from its local queue first, only falls back to the global queue when its own is empty, and the contention problem shrinks significantly.

But then a new problem surfaces. A thread that picks up a deep, wide subtree fills its local queue and works through it alone. Meanwhile, threads that got shallower subtrees finish quickly and sit idle, waiting for the global queue to have something. You've traded lock contention for load imbalance.

oh well, that is the problem Part 3 solves — with work stealing, where idle threads can reach into a busy thread's local queue and take tasks off the other end.
