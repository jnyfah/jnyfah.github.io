---
title: 'std::function'
excerpt: 'std::function is to Function Pointers, what smart pointers is to raw pointers'
coverImage: '/assets/blog/stdfunction.jpg'
date: '2024-02-28T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/stdfunction.jpg'
---


_Before we start just have this as the back of your mind that "std::function is to [Function Pointers](/posts/functionpointer/), what [smart pointers](/posts/pointers) is to raw pointers"._

> [cpprefrence](https://en.cppreference.com/w/cpp/utility/functional/function) says  std::function is a general-purpose polymorphic function wrapper

I know, I know, like what the heck is that ???? 😂😂

When we say _std::function_ is a polymorphic function wrapper, it means that std::function is like a box (wrapper) that can hold and use any kind of function or callable object (any kind here is the polymorphic attribute). 

No matter if you put a regular function, a lambda, a functor, or a member function inside it, you can call it in the same way through the std::function interface. (I hope that is a better explanation 😁).

---
The std::function template is part of the C++ Standard Library _functional_ header and is used to wrap callable entities. Its syntax:

```cpp
std::function<ReturnType(ArgumentTypes...)>
```

- ReturnType is the type of value returned by the function.
- ArgumentTypes... represents the types of the arguments that the function accepts.

_But what is the point, we already have function pointers that can hold and and invoke callable entities like functions, why do we need another one_ ??? 🥲

Basically std::function offers a more flexible, safer alternative to function pointers by abstracting callable entities and providing type-erasure capabilities.

I wrote about **[function pointers](/posts/functionpointer/)** earlier, they are a direct, low-level way to reference functions. 

They allow the program to dynamically invoke functions, pass functions as arguments, and store them for later use. However, they are limited by their strict type requirements and inability to directly encapsulate state or manage lifetimes of captured scopes.
 
std::function here provides a higher-level, more flexible interface for working with callable entities. It can wrap any callable that matches its signature, regardless of whether it's a plain function, a lambda (with or without captures), a functor, or a bound member function. 

std::function uses [type erasure](https://en.wikipedia.org/wiki/Type_erasure) to achieve this flexibility, allowing it to manage callable entities more safely and conveniently, including those that capture state.

---
Yes, std::function can do all that function pointers do like storing function in an array, passing to function as arguments, assigning functions as variables etc etc and makes its safe. 

But it still offers several advantages and additional features compared to raw function pointers, making it more powerful and versatile in many scenarios. 

Here are some key aspects where std::function goes beyond what function pointers can do:

1. **Flexibility with Callable Types**

    Versatility: std::function can wrap not just plain functions but also lambdas, function objects (functors), and member functions. This versatility allows for greater flexibility in how functions are defined and used.

```cpp
#include <iostream>
#include <functional> // Required for std::function

// Function
int multiply(int a, int b) {
    return a * b;
}

// Lambda
auto add = [](int a, int b) -> int {
    return a + b;
};

// Function Object
struct Subtract {
    int operator()(int a, int b) {
        return a - b;
    }
};

int main() {
    // Using std::function with a function pointer
    std::function<int(int, int)> funcPtr = multiply;
    std::cout << "Multiplying 3 and 4 using a function pointer: " << funcPtr(3, 4) << std::endl;

    // Using std::function with a lambda
    std::function<int(int, int)> lambda = add;
    std::cout << "Adding 5 and 6 using a lambda: " << lambda(5, 6) << std::endl;

    // Using std::function with a functor
    std::function<int(int, int)> functor = Subtract();
    std::cout << "Subtracting 10 from 15 using a functor: " << functor(15, 10) << std::endl;
}
```

2. **Stateful Lambdas and Functors**

    Statefulness: Unlike raw function pointers, std::function can hold stateful lambdas or functors. This means you can use std::function to store and invoke callable entities that have internal state, enabling more complex and powerful behavior.

```cpp
#include <iostream>
#include <functional>

int main() {
    int capturedValue = 10;

    // Stateful lambda that captures 'capturedValue' by value
    auto addCapturedValue = [capturedValue](int x) -> int {
        return x + capturedValue;
    };

    // Storing and using the stateful lambda with std::function
    std::function<int(int)> addFunction = addCapturedValue;

    std::cout << "Adding 5 to the captured value (10): " << addFunction(5) << std::endl;

    // Demonstrating the statefulness
    // Even if we change 'capturedValue' now, it won't affect the lambda, as it captured the value at the point of its creation
    capturedValue = 20;
    std::cout << "After changing captured value to 20, adding 5: " << addFunction(5) << std::endl;
}
```

3. Type Safety and Error Checking

    Type Safety: std::function is type-safe. If you try to assign a callable with a mismatched signature to a std::function, you get a compile-time error, whereas with raw function pointers, mismatches might only be caught at runtime or lead to undefined behavior.
    Error Checking: std::function can be checked for emptiness (i.e., whether it holds a callable entity or not) using its boolean conversion operator. This allows for safer code by checking whether a std::function is callable before invoking it.

In this example with raw function pointers, we use _reinterpret_cast_ to force a mismatched signature, which is highly unsafe. 

The compiler may not prevent this, leading to potential runtime errors or undefined behavior.
```cpp
// Using Raw Function Pointers (Less Type Safe)
void process(int a, double b) {
    // Some processing
    std::cout << "Processing int and double: " << a << ", " << b << std::endl;
}

// Suppose we accidentally declare a pointer to a function with a different signature
void (*ptr)(double, int);

int main() {
    ptr = reinterpret_cast<void (*)(double, int)>(process); // Unsafe casting, compiler might not catch this
    ptr(5.5, 10); // This could lead to undefined behavior
}
```
Lets try same with std::function 

```cpp
// Attempting a Signature Mismatch with std::function
#include <iostream>
#include <functional>

void process(int a, double b) {
    std::cout << "Processing int and double: " << a << ", " << b << std::endl;
}

int main() {
    // Attempting to assign 'process' to a std::function with a mismatched signature
    std::function<void(double, int)> func = process; // This line will not compile

    return 0;
}
```

Unlike raw function pointers where type mismatches can be obscured through unsafe casts like reinterpret_cast, std::function enforces type safety at compile time. If the signatures don't match, the code will not compile.

This compile-time enforcement helps prevent scenarios that could lead to runtime errors or undefined behavior due to calling a function with the wrong types or an incorrect order of arguments.

---
**_so when to use std::function and when to use function pointers?_**

Even tho Function pointers are a bit more lightweight than std::function in terms of performance overhead but to be safe std::function is your guy, its safer and has way more cool features and offers more choices like the ones i've just shown you, you cant store state or pass lambdas in function pointers 😏

You can check out some more reasons here [should i use std::function or a function pointer](https://stackoverflow.com/questions/25848690/should-i-use-stdfunction-or-a-function-pointer-in-c)
