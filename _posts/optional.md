---
title: 'Revolutionizing Null-Handling with std::optional'
excerpt: 'C++23 features are out already and i am still battling with C++17, and who knows, maybe by the time I have mastered C++17, C++26 will already be here! 😅'
coverImage: '/assets/blog/optional.jpg'
date: '2023-01-31T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/optional.jpg'
---


Trust me, you don't have to say it I know, i get it, you are not alone ! 😔

C++23 features are out already and i am still battling with C++17, and who knows, maybe by the time I've mastered C++17, C++26 will already be here! 😅

Well, in this beginner's guide, I'll be diving into what std::optional is, how it works, when to use it, and why it's such a crucial tool for any C++ programmer.

But before we dive in, let's take a step back and talk about the problem std::optional solves

Have you ever encountered a situation where you have a variable that might or might not contain a value?. In C++, there are many situations where we need to represent an absence of a value. 

For example, let's consider a function that tries to find and return the index of a specific value in an array. If the value is not found, the function should return a value indicating that the value was not found. One common approach to solve this problem is to use a `-1` to represent the absence of a value. 

However, this approach has several drawbacks:

1.  The absence of value is not explicitly indicated in the type system.
2.  The absence of value and the actual value are mixed together, making it difficult to understand the code and leading to potential errors.
3.  There's no way to differentiate between a valid value of -1 and an absence of value.

The std::optional was designed to solve these problems. It's a type that can either hold a value of a specific type or nothing. It provides a way to represent the absence of a value in the type system, making the code more readable and less error-prone.

Take a look at this example 

```c++
int findIndex(std::vector<int>vec, int num) {
  for (int i = 0; i < vec.size(); i++) {
      return i;
    }
  return -1;
}
```
Another way to write this using `std::pair`

```c++
std::pair<int bool>findIndex(std::vector<int>vec, int num) {
    for (int i = 0; i < vec.size(); i++) {
      return std::pair(i, true);
    }

    return std::pair(-1, false);
}
```

The above example shows how to use a std::pair<int, bool> to represent an optional value of type int. 

In the function findIndex, the return value indicates whether a value was found (by setting the second bool member to true) or not (by setting it to false). 

This approach can become frustrating because it requires manual management of the absence of a value, and the code can become verbose and error-prone, especially when dealing with multiple optional values.

This is where std::optional comes in. It's a type that represents a value that might or might not be there. It's like a boosted version of a pointer, with a lot of additional features that make it easier to use and safer.

With the introduction of std::optional in C++17, these issues can be avoided, making it easier and more convenient to write clean, concise, and safe code.

So, how does it work? Simply put, std::optional is a template that takes a type as a parameter. For example, std::optional can represents an optional integer.

You can create an std::optional and assign a value to it, just like any other variable. You can also check whether an std::optional has a value or not, and access the value if it's there.

```c++
#include <iostream>
#include <optional>

std::optional<int> findIndex(std::vector<int>vec, int num) {
    for (int i = 0; i < vec.size(); i++) {
      return i;
    }
    return std::nullopt;
}
```

The above example shows how to use std::optional to represent an optional value of type int. 

In the function findIndex, the return value indicates whether a value was found by returning the index directly or an absent state by returning std::nullopt. 

This approach is easier because it provides a built-in mechanism for representing the absence of a value, and the code is much more concise, readable, and less error-prone compared to using std::pair<T,bool>. 

Additionally, std::optional provides a variety of member functions for accessing and manipulating the value, making it more convenient to use compared to manual management

-  __operator* and operator->__ allow one to access the contained value directly, just like with a regular object.

```c++
std::optional opt = 42; 
if (opt) { 
  int value = *opt; 
  std::cout << "Value: " << value << std::endl; 
  }
```
-  __value() and value_or()__ allows the access the contained value with or without a default value.

```c++
std::optional opt; 
int value = opt.value_or(0); 
std::cout << "Value: " << value << std::endl;
```

-  __emplace()__  constructs the contained value in-place, reducing the need for separate construction and assignment operations.
```c++
std::optionalstd::string opt; 
opt.emplace("Hello, world!"); 
std::cout << "Value: " << *opt << std::endl;
```

-  __swap() and reset()__ give one access manipulate the state of the std::optional object.

```c++
std::optional opt = 42; 
opt.reset(); 
std::cout << "Has value: " << (bool)opt << std::endl;
```

```c++
std::optional opt1 = 42, 
opt2 = 21; opt1.swap(opt2); 
std::cout << "Value 1: " << *opt1 << std::endl; 
std::cout << "Value 2: " << *opt2 << std::endl;
```