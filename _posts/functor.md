---
title: 'Function Objects (Functors)'
excerpt: 'Functors are basically instances of classes that implement the operator() method '
coverImage: '/assets/blog/functor.jpg'
date: '2024-02-13T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/functor.jpg'
---

its crazy how i struggled to grasp what funtors are in my early days of learning C++, funtion objects, functors, lambda all sounded soo difficult to me 

its literally just a simple one line concept 😭😭😭

If you're coming from Python, you might have seen something similar with the `__call__` method in classes, allowing instances to be called like functions. C++ functors work on a similar principle but with their own unique flavor.

> Functors are basically instances of classes that implement the operator() method. 

Thats just it, a class or struct that overloads the `()` operator 

This allows objects of such classes to be used as if they were functions and can maintain state across calls and can have multiple overloaded versions of operator()

Imagine wanting a function that remembers how many times it's been called. Here's how a functor makes it a breeze:

```c++
class Counter {
public:
    Counter() : count(0) {}

    int operator()() {
        return ++count;
    }

private:
    int count;
};
```
Creating and using our Counter looks like this:
```c++
Counter myCounter;
std::cout << myCounter() << std::endl;  // Increments and outputs: 1
std::cout << myCounter() << std::endl;  // Increments and outputs: 2
```

Just overloading of `operator()` makes the class instance behaves like a function


The real power of functors unfolds with the Standard Template Library (STL). Here, they're not just useful; they're indispensable. 

Custom sorting, for example, becomes intuitive:

```c++
struct DescendingOrder {
    bool operator()(int a, int b) {
        return a > b;
    }
};

std::vector<int> myVector = {1, 5, 3, 4, 2};
std::sort(myVector.begin(), myVector.end(), DescendingOrder());
```
See this code looks more readable and maintainable 

Yea i know you would say but we can literally do this with function pointers, so want the point !!. well there is a catch ! 😏😏

Lets use a better example, say we want to keep count of how many comparisons our sort algorithm makes just to sort the vector 

with Function Objects, we can do this:

```c++
struct CountingComparator {
    long long count = 0; // State to keep track of comparisons

    bool operator()(int a, int b) {
        ++count; // Increment count on each comparison
        return a < b; // For ascending order, switch to a > b for descending
    }
};

std::vector<int> myVector = {4, 1, 3, 2, 5};
CountingComparator comparator;
std::sort(myVector.begin(), myVector.end(), comparator);

std::cout << "Total comparisons made: " << comparator.count << std::endl;

```

Here we can see the functor's ability to maintain state in this case, the count of comparisons—across multiple calls during the sorting process

---
Now doing same to do same with `Function Pointers` we need to use global or static variables to track the state (the count of comparisons), as function pointers themselves cannot maintain state

```c++
long long globalComparisonCount = 0;

bool compareAndCount(int a, int b) {
    ++globalComparisonCount;
    return a < b;
}

globalComparisonCount = 0; // Reset before use
std::sort(myVector.begin(), myVector.end(), compareAndCount);
std::cout << "Total comparisons made: " << globalComparisonCount << std::endl;
```

The functor example clearly shows how encapsulating both behavior (comparison logic) and state (comparison count) within the same object makes the code more cohesive, readable, and maintainable. 

Functors offer a significant advantage over function pointers when you need to maintain and manipulate state across calls, especially in scenarios where such state is closely tied to the behavior being implemented. 

Overall you can see that Functors are not just fancy syntax; they offer several advantages:

- Statefulness: They can carry and manipulate data across calls.
- Inline Optimization: Compilers can optimize calls to functors, potentially inlining them for faster execution.
- Flexibility: Functors can be passed to algorithms or functions expecting callable objects, with custom behavior and state.
- Overloading: You can overload operator() multiple times within the same class for different parameter types
