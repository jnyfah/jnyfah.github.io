---
title: 'Threaded Map (Part 1)'
excerpt: 'Its multithreading monday 🚀!'
coverImage: '/assets/blog/trainng.jpeg'
date: '2024-11-11T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/trainng.jpeg'

---

As the name suggests, this project, Threaded Map, is all about exploring the fundamentals of multithreading by creating a simple, thread-safe map in C++. 

I started this mini-project partly out of curiosity and partly out of boredom, hoping to gain a clearer understanding of how threads work in practice. 

My goal is to dig into core concepts like concurrency, atomicity, and async operations—and maybe even experiment with a lock-free data structure down the line. Will I achieve all of that? I’m not entirely sure yet, but finding out is part of the fun! 🫵🏼

>> If you're also curious about multithreading in C++, this project can serve as a beginner’s guide.

I often hear concurrency and parallelism used interchangeably, but they aren’t quite the same thing. To make sure I do justice to these terms, I recommend checking out [Tech with Tim’s in-depth explanation](https://www.youtube.com/watch?v=olYdb0DdGtM) for a deeper dive.

In simple terms, here’s how I understand it: Concurrency in computers can be thought of as fast task switching—where the system quickly alternates between multiple tasks, giving the illusion that they’re happening simultaneously. 

On the other hand, parallelism is about running things at the same time, where tasks are truly executed simultaneously across multiple cores or processors.

---

There are different ways to achieve concurrency, and one key approach is thread-based concurrency, where programmers have direct control over threads. Within thread-based concurrency, we typically see two setups:
- Multi-Core, Multi-Threaded Concurrency: This setup leverages multiple cores, with each core capable of running threads independently. In multi-core systems, tasks can truly run in parallel, with resources shared efficiently across cores. This is ideal for high-performance applications where tasks can be distributed across cores to improve speed and responsiveness.
- Single-Core, Multi-Threaded Concurrency: Here, we only have one core, so tasks can’t actually run in parallel. Instead, the system rapidly switches between threads, giving the appearance of simultaneous execution. This is sometimes used to maintain responsiveness in environments where only a single core is available.

Imagine you’re the CEO of a company, and you’ve just rented an office space. Now you’re deciding between two layouts: an open office (single-core) or separate sections for each department (multi-core).

In an open office setup (single-core), everyone shares the same space, using a single copier and other communal resources. This layout has the advantage of simplicity—everyone has access to shared resources, and there’s no need for extra equipment. However, it also comes with drawbacks. Since everyone shares the copier, only one person can use it at a time. Others have to wait, which can lead to slowdowns and bottlenecks, especially during busy times.

On the other hand, with separate sections for each department (multi-core), each team has its own dedicated space and equipment, including its own copier. This setup allows each department to work independently, so they can all make copies simultaneously without waiting for others. However, this setup requires more equipment and coordination. When different departments need to share information, it adds complexity because resources (like documents or data) might need to be synchronized between departments to ensure everyone has the latest version.

For beginners, we are starting with single-core, multi-threaded concurrency is a helpful way to learn the basics. Its multithreading monday! 🚀

---
You might wonder: what’s the point of multithreading if it’s just concurrency? After all, if threads aren’t truly running simultaneously on the same core but are instead being switched in and out, why bother with the complexity of multiple threads? The answer often comes down to separation of concerns and responsiveness.

In an application with multiple tasks, for example, you might want one thread handling user interactions while another performs background computations. By dividing tasks between threads, you keep your application responsive and organized, even if only one thread is running at a time on a single core.

However, as the saying goes, with great power comes great responsibility. Each thread has its own call stack for managing local variables, function calls, and recursion, but threads share the heap—a common memory space. This shared access allows threads to interact with the same data. For instance, if Thread A allocates memory, Thread B can access, read, and write to that memory.

This shared access is where the challenges of multithreading arise, as the threads’ independence introduces new problems like data races and deadlocks.

#### Data Races

A data race occurs when two or more threads access shared data at the same time without proper synchronization, leading to unpredictable behavior. Here’s an example:

Imagine two threads, A and B, both trying to increment a shared counter:

1. Thread A reads the current counter value (say, 10) into a register.
2. Before Thread A can finish incrementing and saving the result, it gets paused.
3. Now, Thread B starts. It reads the same counter value (10), increments it to 11, and saves it.
4. When Thread A resumes, it increments its original read value (also 10) and writes 11, overwriting Thread B's update.

This conflict results in a data race, where both threads tried to update the counter independently, and one thread’s update overwrote the other. Without proper synchronization, data races can lead to unpredictable results and bugs that are hard to reproduce or diagnose.

#### Deadlocks

Another common issue in multithreading is the deadlock. A deadlock occurs when two or more threads are each waiting for resources held by the other, leading to an indefinite waiting loop. Here’s an example:

Imagine two threads again (sorry for the constant imagination), A and B, each need two resources to complete their tasks: Resource 1 and Resource 2.

1. Thread A locks Resource 1 and begins its work.
2. Thread B locks Resource 2 and begins its work.
3. Now, Thread A needs Resource 2 to continue, but it’s held by Thread B.
4. At the same time, Thread B needs Resource 1 to continue, but it’s held by Thread A.

Both threads end up waiting indefinitely, each holding one resource and waiting for the other, resulting in a deadlock. Deadlocks can completely halt program execution and are notoriously difficult to debug.

#### Managing Shared Data

To prevent issues like data races and deadlocks, multithreaded programming requires careful synchronization. This is where synchronization primitives like `mutex` come in (I know, it sounds intimidating). 

Think of a mutex as one such primitive—it’s like a key to a restroom. When you enter, you lock the door so no one else can come in, ensuring exclusive access. When you’re done, you unlock the door so others can use it.

In our example with threads incrementing a shared counter, a mutex can prevent data races. If Thread A locks the counter when it reads the value (say, 10), no other thread, including Thread B, can access it until Thread A completes its increment and releases the lock. This way, Thread A’s changes are preserved, and when Thread B finally accesses the counter, it sees the updated value, not an outdated one.

So, mutexes provide exclusive access to shared data by allowing you to lock and unlock resources. However, similar to manually managing memory allocations, mutexes come with risks—namely, forgetting to unlock a mutex after locking it, which can lead to deadlocks and other issues. 

To address this, C++ offers RAII-style mutex owners like std::lock_guard, std::unique_lock, and std::shared_lock. These classes automatically acquire a lock when they’re created and release it when they go out of scope, making mutex management safer and easier to handle.

Now, let’s look at some code to see this in action!. Here’s a thread-safe, concurrent map implementation that uses a shared_mutex to handle both read and write operations safely:

```cpp

class ConcurrentMap {
public:
int read(const std::string &key) {
  std::shared_lock<std::shared_mutex> lock(m_mutex);
  auto it = map.find(key);
  if (it != map.end()) {
    return it->second;
  }
  return {};
}

void write(const std::string &key, const int&value) {
  std::unique_lock<std::shared_mutex> lock(m_mutex);
  map[key] = value;
}

size_t size() const {
  std::shared_lock<std::shared_mutex> lock(m_mutex);
  return map.size();
}

private:
  std::unordered_map<std::string, int> map;
  mutable std::shared_mutex m_mutex;
};
```

First, let’s look at the private data members of ConcurrentMap:

- map: This is the underlying std::unordered_map that stores the key-value pairs.
- m_mutex: This is a mutable shared_mutex used to synchronize access to map.

__Why mutable and shared?__

- Mutable: Even though size() is a const method, it still needs to lock the mutex to ensure thread-safe access to map. By making m_mutex mutable, we allow const methods to lock and unlock it as needed without modifying the ConcurrentMap itself.
- Shared Mutex: Traditional mutexes only allow exclusive access, meaning only one thread can hold the lock at any time. However, with a shared_mutex, we get more flexibility:
    - Multiple Readers: Several threads can acquire a shared lock simultaneously, allowing concurrent reads. This is safe because read operations don’t modify the data, so they don’t interfere with each other.
    - Single Writer: Only one thread can acquire a unique lock at a time, which is necessary for write operations. This ensures that while a thread is writing, no other threads can access the map.

In the ConcurrentMap example, we use std::shared_lock and std::unique_lock:
- std::shared_lock: Used in read() and size() to allow multiple threads to hold a shared lock when they only need read access.
- std::unique_lock: Used in write() to ensure exclusive access for modifying the map, preventing data races.

By using these RAII-style locks, we avoid the risk of forgetting to unlock the mutex—when the lock goes out of scope, it’s automatically released.

SO we have subtly introduced out Concurrent Map Data structure, over time we will build on it and hopefully make it lock free (to be honest i dont even know what this truly means but lets go! 😂)
             