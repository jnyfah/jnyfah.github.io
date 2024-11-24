---
title: 'Threaded Map (Part 3) - Futures, Promises and Async '
excerpt: 'these tools arent mutually exclusive - they often work best in combination'
coverImage: '/assets/blog/async.jpeg'
date: '2024-11-24T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/async.jpeg'

---

In Part 2, we explored thread pools as an efficient way to manage concurrent tasks. However, one crucial aspect remained unaddressed: how do we handle return values from these tasks? Enter futures, promises, and async programming.

---
##### Future 

Imagine you're ordering food from a restaurant. When you place your order, you get a receipt with an order number. This receipt is like a std::future - it's a promise that you'll get something later. You can check if your order is ready (`.wait_for()`), wait until it's done (`.get()`), or do other things while waiting.

There are two types of futures in C++:

1. __*std::future: The Private Jet Model*__
- Exclusive access to the result
- Only one thread can retrieve the value
- Once .get() is called, the future is consumed
- Perfect for one-to-one async operations
```cpp
std::future<int> calculateValue() {
    return std::async([]() {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        return 42;
    });
}

int main() {
    auto future = calculateValue();
    // Do other work while value is being calculated
    int result = future.get(); // Blocks until value is ready
    std::cout << "Result: " << result << std::endl;
}
```

2. __*std::shared_future: The Commercial Airline Model*__
- Multiple threads can access the same result
- Calling .get() doesn't consume the future
- Perfect for broadcast scenarios where multiple threads need the same result
```cpp
std::shared_future<int> sharedCalculation() {
    auto future = std::async([]() {
        std::this_thread::sleep_for(std::chrono::seconds(2));
        return 42;
    });
    return future.share(); // Convert to shared_future
}

void waitForResult(std::shared_future<int> future, int id) {
    int result = future.get(); // Multiple threads can call get()
    std::cout << "Thread " << id << " got result: " << result << std::endl;
}

int main() {
    auto shared_future = sharedCalculation();
    
    std::vector<std::thread> threads;
    for (int i = 0; i < 3; ++i) {
        threads.emplace_back(waitForResult, shared_future, i);
    }
    
    for (auto& t : threads) t.join();
}
```

---
##### Packaged Task
You can think of `std::packaged_task` as an asynchronous `std::function` that produces result via std::future 

while std::function is a general purpose callable wrapper, std::packaged_task is a callable wrapper for asynchronous functions, it basically wraps an callable so that it can be invoked asynchronously or synchronously depending on where the task is called from. It lets you:
- Wraps a callable and binds it to a std::future.
- You manually invoke the task when you’re ready using task().
- Used when you want explicit control over the task’s execution.

```cpp
std::packaged_task<int(int, int)> task([](int a, int b) {
    std::this_thread::sleep_for(std::chrono::seconds(1));
    return a + b;
});

// Get the future before running the task
std::future<int> result = task.get_future();

// Run the task in a separate thread
std::thread t(std::move(task), 2, 3);
t.detach();

// Wait for and get the result
std::cout << "Result: " << result.get() << std::endl;
```
---
##### Async 
`std::async` provides a high-level way to run a function asynchronously. It abstracts thread creation, lifecycle management, and result handling. This makes it an excellent choice when you want to execute a task asynchronously without the hassle of manually managing threads. Unlike `std::packaged_task`, it automatically starts execution as soon as it's called.
- Takes a callable (function, lambda, etc.) and automatically runs it.
- Returns a std::future to access the result.
- Optionally supports deferred or immediate execution (std::launch::deferred or std::launch::async).

```cpp
enum class TaskType { Fast, Slow };

std::future<std::string> processTask(TaskType type) {
    // Launch policy can be:
    // - std::launch::async (run in new thread)
    // - std::launch::deferred (run when get() is called)
    // - std::launch::async | std::launch::deferred (system decides)
    return std::async(std::launch::async, [type]() {
        if (type == TaskType::Slow) {
            std::this_thread::sleep_for(std::chrono::seconds(2));
            return std::string("Slow task completed");
        } else {
            return std::string("Fast task completed");
        }
    });
}

int main() {
    auto slowTask = processTask(TaskType::Slow);
    auto fastTask = processTask(TaskType::Fast);
    
    // Fast task completes first
    std::cout << fastTask.get() << std::endl;
    std::cout << slowTask.get() << std::endl;
}
```
---
##### Promise 
`std::promise` represents the producer side of an asynchronous computation. While std::future lets you retrieve a result, a promise gives you manual control over how and when that result is produced (I know sounds like mumbo jumbo 😂).
Think of planning a birthday party with friends over a group chat:
- Jennifer promises to bring the cake (she creates a `std::promise`)
- Everyone in the chat knows cake is coming (they have the `std::future`)
- When Jennifer buys the cake, she updates the chat (she sets the promise's value)
- The party can't start until the cake arrives (other threads wait on the future)
```cpp
// Jennifer planning the party
void jennifer_cake_duty(std::promise<std::string>&& cake_promise) {
    try {
        // Jennifer goes to the bakery
        std::this_thread::sleep_for(std::chrono::seconds(2));
        
        // She got a chocolate cake!
        cake_promise.set_value("🎂 Chocolate Cake");
        
    } catch (const BakeryClosedException& e) {
        // Oh no, bakery was closed!
        cake_promise.set_exception(std::current_exception());
    }
}

// The party organizer
void party_organizer(std::future<std::string>&& cake_future) {
    try {
        std::cout << "Waiting for cake..." << std::endl;
        std::string cake = cake_future.get();  // Waits for Jennifer
        std::cout << "Great! " << cake << " has arrived! Party can start!" << std::endl;
    } catch (const std::exception& e) {
        std::cout << "Bad news: " << e.what() << std::endl;
        std::cout << "Need a backup plan!" << std::endl;
    }
}
```

##### How Each Tool Fits into the Broader Concurrency Ecosystem
- `std::future`: Provides a mechanism to retrieve the result of an asynchronous computation. Best used when there’s a one-to-one relationship between the producer and consumer of the result.
- `std::shared_future`: Extends std::future for scenarios where multiple consumers need access to the same result, making it ideal for broadcast-style workflows.
- `std::packaged_task`: Offers manual control over the execution of a callable. It is particularly useful when tasks need to be scheduled explicitly, decoupled from thread creation.
- `std::promise`: Gives developers manual control over how a result is delivered to a future. Promises are ideal for coordinating tasks when the result depends on an external event or callback.
- `std::async`: Provides a high-level abstraction that combines thread management and future handling in one package, making it the simplest tool for fire-and-forget async operations.

Remember, these tools aren't mutually exclusive - they often work best in combination, each handling the part of the problem they're best suited for.
