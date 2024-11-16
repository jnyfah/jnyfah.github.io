---
title: 'Threaded Map (Part 2)'
excerpt: 'But creating and destroying threads repeatedly for every task can be expensive!'
coverImage: '/assets/blog/threadpool.jpeg'
date: '2024-11-16T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/threadpool.jpeg'

---

In [Part 1](_posts\ThreadedMap.md), we introduced the idea of a thread-safe map that can handle concurrent reads and writes using mutexes. While this ensures data safety, one question remains:

*How do we efficiently execute tasks that interact with the map?*

Well its easy, create a thread when ever we need to use the map and destroy when done. 

But creating and destroying threads repeatedly for every task can be expensive. Each thread requires memory for its stack and incurs overhead from system calls for creation and teardown. If we need to process many tasks, this approach is inefficient and can overwhelm system resources.

Enters the Thread Pool: a mechanism for managing a fixed set of worker threads that execute tasks from a shared queue. Instead of creating new threads for each task, we reuse existing threads from the pool, saving time and resources.

---
A thread pool is a collection of worker threads that are created once and reused to perform tasks from a shared Task Queue. The pool remains active for the lifetime of your program (or until you shut it down). When a task is submitted:

1. It is added to the Task Queue.
2. A worker thread picks up the task and executes it.
3. The thread becomes available for new tasks once it finishes.

![image](/assets/blog/test.png)

This model ensures efficient use of system resources and improves performance, especially in applications where tasks are short-lived or frequent.

__*What Do We Need to Build a Thread Pool?*__

Building a basic thread pool involves three main components:
1. Task Queue:
    A thread-safe queue where tasks are stored until a worker thread is available to process them.
2. Worker Threads:
    These are the threads in the pool that execute tasks.
3. Synchronization Mechanisms:
    To ensure safe access to the shared task queue, we need mutexes and condition variables.

So here's the plan:
- Implement a TaskQueue: A thread-safe queue for storing tasks.
- Create a ThreadPool: A class that initializes worker threads, manages the task queue, and handles task execution.
- Test the ThreadPool with the ConcurrentMap from Part 1

If you want to see the full code before we start [be my guest!](https://github.com/jnyfah/Algorithms-and-Data-Structures/tree/v1_multithreading/ThreadedMap)

---
__Task Queue__

The TaskQueue ensures that we can safely add task to the queue and threads can retrieve tasks and work on them without conflicts

```cpp
class TaskQueue {
public:
    void addTask(T&& task) {
        {
            std::lock_guard<std::mutex> lock(m_mutex); // Ensure safe access to the queue
            m_tasks.push(std::forward<T>(task)); // Add the task to the queue
        }
        m_condition.notify_one(); // Wake up one waiting thread to process the task
    }

    bool getTask(T &task, const std::atomic<bool> &shutdown) {
        std::unique_lock<std::mutex> lock(m_mutex);
        m_condition.wait(lock, [this, &shutdown] {
            return !m_tasks.empty() || shutdown; // Wait until a task is available or shutdown is triggered
        });

        if (m_tasks.empty()) {
            return false; // If the queue is empty and shutdown is signaled, return false
        }

        task = std::move(m_tasks.front()); // Retrieve the task
        m_tasks.pop(); // Remove the task from the queue
        return true;
    }

private:
    std::queue<T> m_tasks; // Queue of tasks
    std::mutex m_mutex; // Mutex to ensure synchronization
    std::condition_variable m_condition; // Condition variable to manage thread coordination
};
```

This is just a sneak peak into the essentials of the taskqueue, you can check the full code [here on github](https://github.com/jnyfah/Algorithms-and-Data-Structures/blob/v1_multithreading/ThreadedMap/ThreadedMap/TaskQueue.hpp)

The TaskQueue class contains three key member variables:
1. *A queue of tasks:* This stores the tasks (usually as std::function<void()> objects) that need to be executed.
2. *A mutex:* Ensures synchronization by locking the queue, allowing only one thread to modify or access it at a time.
3. *A condition variable:* Coordinates between threads. Threads waiting for tasks are notified when a new task is added to the queue, so they can wake up and start processing.

__How It Works__

`addTask()` __Function__

The `addTask()` function adds a new task to the queue. Here’s how it works:
- Parameters: It takes a task by rvalue reference `(T&&)` for efficiency and uses `std::forward` to handle both lvalue and rvalue tasks properly.
- Mutex Locking: It locks the mutex using `std::lock_guard`. This ensures that only one thread (be it the main program or another thread) can add a task to the queue at a time. Without this lock, concurrent writes to the queue could corrupt its state.
- Condition Variable Notification: After adding the task, `notify_one()` wakes up one of the threads waiting for a task. This ensures tasks don’t sit idle in the queue if worker threads are available.

`getTask()` __Function__

The `getTask()` function retrieves a task from the queue for execution. Here’s how it works:

- Parameters:
    1. `T& task`: A reference to store the retrieved task.
    2. `const std::atomic<bool>& shutdown`: A flag to indicate if the thread pool is shutting down.
- Mutex Locking: It uses `std::unique_lock` because the condition variable requires it. The lock ensures that only one thread can retrieve a task at a time.
- Waiting for Tasks: The `wait()` function pauses the thread until:
    1. A task is available in the queue (`!m_tasks.empty()`).
    2. A shutdown signal is received, here If the shutdown flag is `true` and the queue is empty, The function returns `false`, indicating that no tasks are available and shutdown is active. If the shutdown flag is `true` but the queue has tasks, The function retrieves and processes tasks until the queue is empty. You can also adjust the behavior to discard pending tasks immediately when shutdown is triggered.
- Condition Check: If the queue is empty after shutdown is triggered, it returns `false`. Otherwise, it retrieves the next task using `std::move` and removes it from the queue.

---
__ThreadPool__

The ThreadPool class initializes worker threads, manages the task queue, and handles task execution.
```cpp 
class ThreadPool {
public:
    ThreadPool(size_t numThreads)
        : m_shutdown(false) {
        startWorkerThreads(numThreads);
    }

    void submit(std::function<void()> task) {
        if (!m_shutdown) {
            m_taskQueue.addTask(std::move(task));
        }
    }

    void shutdown() {
        std::cout << "ThreadPool shutdown initiated\n";
        m_shutdown = true;
        m_taskQueue.notifyAll();  // Wake up all threads
        
        for (auto& worker : m_workers) {
            std::cout << "Joining worker thread\n";
            if (worker.joinable()) {
                worker.join();
            }
        }
        std::cout << "ThreadPool shutdown complete\n";
    }

private:
    TaskQueue<std::function<void()>> m_taskQueue;
    std::vector<std::thread> m_workers;
    std::atomic<bool> m_shutdown;

    void startWorkerThreads(size_t numThreads) {
        m_workers.reserve(numThreads);
        for (size_t i = 0; i < numThreads; ++i) {
            m_workers.emplace_back([this, i] {
                std::cout << "Worker " << i << " started\n";
                while (!m_shutdown) {
                    std::function<void()> task;
                    if (!m_taskQueue.getTask(task, m_shutdown)) {
                        continue;  // Either queue is empty or shutdown was signaled
                    } 
                    task();
                }
                std::cout << "Worker " << i << " exiting\n"; });
        }
    }
};
```
Again full code is [here](https://github.com/jnyfah/Algorithms-and-Data-Structures/blob/v1_multithreading/ThreadedMap/ThreadedMap/ThreadPool.hpp) 

The ThreadPool class has three main components:

1. A queue of tasks (TaskQueue): Stores the tasks (typically as `std::function<void()>` objects) that need to be executed and ensures thread-safe access using a mutex and condition variable.
2. A vector of workers (`std::vector<std::thread>`): Contains the threads in the pool. These threads continuously check for tasks in the queue, execute them, and then look for more tasks.
3. A shutdown flag (`std::atomic<bool>`): Signals when the thread pool is shutting down and prevents new tasks from being submitted and ensures worker threads exit gracefully.

__How It Works__

`startWorkerThreads` __Function__

The `startWorkerThreads` function is called during the thread pool’s initialization by the constructor. It creates and starts the worker threads.
- Reserve Memory: Reserves space in the `m_workers` vector for the specified number of threads (`numThreads`).
- Create Threads: For each worker thread, a lambda function is added to the m_workers vector using emplace_back, inside the lambda, the thread continuously checks for tasks in the TaskQueue: 
    - If a task is available, the thread retrieves it using getTask() and executes it.
    - If the queue is empty but the m_shutdown flag is set to true, the thread exits the loop.
    - If the queue is empty but m_shutdown is false, the thread waits until: A task is added to the queue (`notify_one()` wakes it up), or shutdown is initiated
- Shutdown Handling: During shutdown, the worker threads gracefully finish any remaining tasks before exiting.

`submit` __Function__
The submit function allows tasks to be added to the task queue.
- Checks the Shutdown Flag: If `m_shutdown` is `true`, the function ignores the task, preventing new tasks from being added.
- Adds the Task: If the thread pool is active, the task is forwarded to the TaskQueue using `addTask()`.

`shutdown` __Function__
The shutdown function is responsible for stopping the thread pool and cleaning up resources. If `shutdown()` hasn’t been called explicitly, the destructor automatically shuts down the thread pool to prevent resource leaks.
- Set the Shutdown Flag: Marks m_shutdown as true, signaling to all threads that no more tasks will be processed.
- Notify All Threads: Calls `notifyAll()` on the TaskQueue to wake up any threads waiting for tasks. If the queue is empty, this prevents threads from waiting indefinitely.
- Join Threads: Iterates through the m_workers vector, calling `join()` on each thread. This ensures all threads complete their tasks and terminate safely before the pool is destroyed.

---
__Testing: main Function__

```cpp
int main() {
  const int TOTAL_TASKS = 7;

  ThreadPool pool(3);

  std::cout << "Created thread pool with" << TOTAL_TASKS << " workers\n\n";

  ConcurrentMap inventory;
  inventory.write("Laptop", 5);
  inventory.write("Phone", 3);
  std::cout << "Initial inventory:\n";
  std::cout << "Laptops: " << inventory.read("Laptop") << "\n";
  std::cout << "Phones: " << inventory.read("Phone") << "\n\n";
  std::cout << "Starting to process orders...\n\n";

  // Submit tasks
  pool.submit([&]() { processOrder(1, inventory, "Laptop"); });
  pool.submit([&]() { processOrder(2, inventory, "Phone"); });
  pool.submit([&]() { processOrder(3, inventory, "Laptop"); });
  pool.submit([&]() { processOrder(4, inventory, "Laptop"); });
  pool.submit([&]() { processOrder(5, inventory, "Laptop"); });
  pool.submit([&]() { processOrder(7, inventory, "Phone"); });
  pool.submit([&]() { processOrder(8, inventory, "Phone"); });

  // Wait for all tasks to complete with timeout and progress indicator
  const auto startTime = std::chrono::steady_clock::now();
  const auto timeout = std::chrono::seconds(10);

  while (completedTasks.load(std::memory_order_acquire) < TOTAL_TASKS) {
    if (std::chrono::steady_clock::now() - startTime > timeout) {
      std::cout << "Timeout waiting for tasks to complete! Completed: "
                << completedTasks.load() << "/" << TOTAL_TASKS << "\n";
      return 1;
    }
    simulateWork(100);
    std::cout << "Waiting... Completed tasks: " << completedTasks.load() << "/"
              << TOTAL_TASKS << "\r" << std::flush;
  }
  std::cout << "\nAll tasks completed!\n";
  std::cout << "\nFinal inventory:\n";
  std::cout << "completedTasks: " << completedTasks << "\n";
  std::cout << "Laptops: " << inventory.read("Laptop") << "\n";
  std::cout << "Phones: " << inventory.read("Phone") << "\n";

  // Explicit shutdown, not necessary because shutdown is called in the threadpool destructor 
  pool.shutdown();
  std::cout << "\nProgram completed successfully!\n";

  return 0;
}
```

The main function tests the functionality of the ThreadPool and ConcurrentMap by simulating an inventory processing system. Here's a breakdown of what happens:

1. ThreadPool Initialization: A thread pool is created with 3 worker threads to handle tasks concurrently.
2. Inventory Setup: A ConcurrentMap is initialized to store the inventory of "Laptop" and "Phone," starting with quantities of 5 and 3, respectively.
3. Task Submission: Seven tasks are submitted to the thread pool, each representing an order for either a "Laptop" or a "Phone." These tasks call the processOrder function, which decrements the inventory for the specified item.
4. Task Completion Monitoring: A loop monitors the completion of tasks using the completedTasks counter. A timeout mechanism is included to ensure the program doesn't hang indefinitely if tasks fail to complete. While tasks are being processed, the program periodically displays progress by printing the number of completed tasks.
5. Final Output: Once all tasks are completed, the program prints the final state of the inventory, showing the updated quantities of "Laptop" and "Phone." The thread pool is explicitly shut down, although this is redundant because the destructor already handles it.

