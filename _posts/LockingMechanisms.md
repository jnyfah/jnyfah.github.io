---
title: 'C++ Locking Mechanisms'
excerpt: 'Its multithreading monday 🚀!'
coverImage: '/assets/blog/road.jpeg'
date: '2024-11-13T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/road.jpeg'

---
Multithreading can be tricky, especially when managing access to shared resources. To make it safer and easier, C++ provides several RAII-style locking mechanisms 
that automatically handle the acquisition and release of locks. 
In addition to `std::lock_guard`, `std::unique_lock` and `std::shared_lock`, we also have `std::lock`, `std::scoped_lock`, `std::try_lock`.

Let's dive into these locking mechanisms, exploring how they differ and when to use each one.


1. __std::lock_guard:__  is a basic RAII-style lock that locks a mutex upon creation and unlocks it when it goes out of scope. It's ideal for straightforward, 
one-scope exclusive locking where you don't need any special control over locking and unlocking. The lock is acquired immediately upon creation, and there's no way to 
unlock it manually. It's ideal for “lock and forget” situations where you want the lock for the scope of a single function.
  - Use Case: Use `std::lock_guard` when you need a straightforward, exclusive lock without any special requirements, like conditionally locking or unlocking

```cpp
void safeIncrement(int& counter, std::mutex& mtx) {
    std::lock_guard<std::mutex> lock(mtx);
    ++counter;  // Safe modification
}
```

2. __std::unique_lock:__ offers more flexibility than `std::lock_guard`, it is still a RAII style lock but still allows you to lock and unlock manually and transfer ownership of the lock if needed. It also works
 well with condition variables for thread synchronization. Best for situations needing deferred locking, manual control, or compatibility with condition variables.
  - Use Case: Use `std::unique_lock` when you need more control over locking behavior, especially for condition variables or multi-stage operations.

```cpp
void safeIncrementWithControl(int& counter, std::mutex& mtx) {
    std::unique_lock<std::mutex> lock(mtx, std::defer_lock);  // Deferred locking
    do_something();
    lock.lock();
    ++counter;  // Safe modification
    lock.unlock();  // Optionally unlock before scope ends, even if you dont unlock its RAII :)
}
```

3. __std::shared_lock:__  is a specialized lock for shared (read) access. It allows multiple threads to acquire shared access simultaneously while blocking writers. 
This lock is ideal for situations with frequent reads and infrequent writes. it allows multiple threads to hold shared access (read-only), but only one thread can hold exclusive access (write).
  - Use Case: Use `std::shared_lock` with `std::shared_mutex` to allow multiple threads to safely read shared data.

```cpp
int readData(const std::string& key, const ConcurrentMap& cmap) {
    std::shared_lock<std::shared_mutex> lock(cmap.mutex);
    auto it = cmap.map.find(key);
    return it->second;
}
```

4. __std::lock:__ s a function used to lock multiple mutexes at once, ensuring deadlock-free locking order. It doesn't unlock the mutexes automatically (as it is not a RAII style locking mechanism), 
so it's typically used with `std::lock_guard` or `std::unique_lock` with the `std::adopt_lock` tag to manage the locked state. Mostly used for acquiring multiple mutexes 
simultaneously to prevent deadlock since It locks multiple mutexes in a safe order, but you'll need additional RAII mechanisms to handle unlocking.
  - Use Case: Use `std::lock` when working with multiple mutexes that must be locked together to avoid deadlock.
```cpp
void safeTransfer(int& from, int& to, std::mutex& mtx1, std::mutex& mtx2) {
    std::lock(mtx1, mtx2);  // Locks both without deadlock risk
    std::lock_guard<std::mutex> lock1(mtx1, std::adopt_lock);
    std::lock_guard<std::mutex> lock2(mtx2, std::adopt_lock);
    from -= 10;
    to += 10;
}
```

5. __std::scoped_lock:__  is a C++17 addition that provides a simple RAII-style lock for multiple mutexes. It's like `std::lock_guard`, but it can lock multiple 
mutexes simultaneously without requiring `std::adopt_lock` like `std::lock`. it is the safe version of `std::lock`. it is best for deadlock-free locking of multiple mutexes in a single step, since it locks all specified mutexes 
upon creation and unlocks them upon destruction. 
  - Use Case: Use std::scoped_lock when you need to lock multiple mutexes easily and safely.
```cpp
void safeMultiLock(int& shared1, int& shared2, std::mutex& mtx1, std::mutex& mtx2) {
    std::scoped_lock lock(mtx1, mtx2);  // Locks both mutexes safely
    shared1++;
    shared2++;
}
```

6. __std::try_lock:__ attempts to acquire multiple locks without blocking. If any of the locks are unavailable, it fails, and unlocks any lock it has previously locked. Best for non-blocking
locking attempts across multiple mutexes and returns immediately without acquiring locks if any are already locked.
  - Use Case: Use `std::try_lock` in situations where you don't want to wait for locks but want to proceed only if all locks are available.
```cpp
void safeTryLock(int& shared1, int& shared2, std::mutex& mtx1, std::mutex& mtx2) {
    // Try to lock both mutexes without blocking
    if (std::try_lock(mtx1, mtx2) == -1) {  // -1 indicates success in locking both
        std::lock_guard<std::mutex> lock1(mtx1, std::adopt_lock);  // Adopt the first lock
        std::lock_guard<std::mutex> lock2(mtx2, std::adopt_lock);  // Adopt the second lock
        shared1++;
        shared2++;
    } else {
        // If either mutex couldn't be locked, handle failure here
        std::cout << "Could not acquire both locks, skipping update." << std::endl;
    }
}
```

#### Lock Tags (Locking Strategies)

In addition to these lock mechanisms, C++ provides lock tags (`std::defer_lock`, `std::try_to_lock`, `std::adopt_lock`) that allow you to control locking behavior:
- `std::defer_lock`: Creates the lock object without immediately locking the mutex. Useful when you want to lock later or use `std::lock()` to lock multiple mutexes
```cpp
void processWithDefer(std::mutex& mtx) {
    std::unique_lock<std::mutex> lock(mtx, std::defer_lock); // Doesn't lock yet
    
    // Do some preparation work without the lock
    prepareData();
    
    lock.lock();   // Now explicitly lock
    // Critical section
    processData();
    lock.unlock(); // Explicitly unlock if needed
}
```
- `std::try_to_lock`: Attempts to lock without blocking. If the lock can't be acquired immediately, continues without waiting useful when you don't want to wait for a lock.
```cpp
bool processIfAvailable(std::mutex& mtx, int& shared_data) {
    std::unique_lock<std::mutex> lock(mtx, std::try_to_lock);
    
    if (!lock.owns_lock()) {
        // Mutex was locked, return without waiting
        return false;
    }
    
    // We got the lock, safe to modify data
    shared_data++;
    return true;
}
```
- `std::adopt_lock`: Assumes the mutex is already locked and adopts it. Useful when the mutex was locked manually or by `std::lock()`.
```cpp
void transferWithAdopt(int& from, int& to, std::mutex& mtx1, std::mutex& mtx2) {
    // First manually lock both mutexes
    std::lock(mtx1, mtx2);  // Locks both without deadlock
    
    // Create guards that adopt existing locks
    std::lock_guard<std::mutex> lock1(mtx1, std::adopt_lock);
    std::lock_guard<std::mutex> lock2(mtx2, std::adopt_lock);
    
    // Safe to perform transfer
    from -= 100;
    to += 100;
    // Guards automatically release locks when destroyed
}
```

These tags give you fine-grained control over when and how locks are acquired, especially in more complex multithreaded scenarios.

__Best Practices that have helped me__

1. Use the Simplest Lock That Meets Your Needs
    - Start with `std::lock_guard`
    - Move to `std::unique_lock` only when needed
    - Use `std::shared_lock` for read-heavy scenarios
2. Minimize Critical Sections
    - Keep locked regions as small as possible
    - Don't perform I/O or lengthy computations while holding a lock
3. Consider Lock Ordering
    - Always acquire multiple locks in the same order
    - Use `std::scoped_lock` when possible
4. Be Careful with Nested Locks
    - Avoid nested locks when possible
    - Use hierarchical mutexes if nesting is necessary