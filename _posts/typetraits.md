---
title: 'Type Traits -C++'
excerpt: 'With type traits, you can write code that adapts to different types, and performs different actions depending on the characteristics of those types.'
coverImage: '/assets/blog/traits.jpg'
date: '2023-05-04T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/traits.jpg'
---

In C++, a `type` is a set of values that a variable can hold. For example, the int type represents a set of whole numbers that can be stored in a variable, then we have floats, char, bool etc.

Type traits are basically a way to just examine these types and get information about them. For example, you might want to know whether a type is a pointer or a reference, or whether it is const-qualified.

Using type traits, you can ask questions about a type at compile time (when the code is being translated into machine code), rather than at runtime (when the program is actually running).

Well, type traits are a huge part of template metaprogramming in C++ because they provide a way to inspect and manipulate types at compile time, which is essential for template metaprogramming. 

With type traits, you can write code that adapts to different types, and performs different actions depending on the characteristics of those types. You can use type traits to check whether a type is a pointer or a reference, whether it is an integer or a floating-point number, whether it has a certain set of member functions or not, and so on.

Here's a simple example. Let's say you want to write a function that takes a pointer to an object and returns the value of that object. You might write something like this:

```c++
template <typename T>
T getValueFromPointer(T* ptr)
{
    return *ptr;
}
```

This function takes a pointer to an object of type T, dereferences the pointer to get the value of the object, and returns that value.

But what if someone passes in a reference instead of a pointer? The function will still compile, but it will fail at runtime, because you can't dereference a reference like you can a pointer.

To avoid this problem, you can use a type trait to make sure that the argument is actually a pointer:

```c++
template <typename T>
T getValueFromPointer(T* ptr)
{
    static_assert(std::is_pointer<T>::value, "Argument must be a pointer");
    return *ptr;
}
```
Now, if someone tries to pass in a reference, the program will fail to compile, because the static_assert will cause an error.

Another simple example, you might want to write a template function that can work with any arithmetic type. You can use type traits to check whether the type of the argument is an arithmetic type or not, and perform different actions accordingly. Here's an example:

```c++
#include <iostream>
#include <type_traits>

template <typename T>
typename std::enable_if<std::is_arithmetic<T>::value, T>::type
multiply(T x, T y)
{
    return x * y;
}

template <typename T>
typename std::enable_if<!std::is_arithmetic<T>::value, T>::type
multiply(T x, T y)
{
    std::cout << "Cannot multiply non-arithmetic types" << std::endl;
    return T();
}

int main()
{
    int x = 3, y = 4;
    float a = 2.5f, b = 3.7f;
    std::string s1 = "hello", s2 = "world";

    std::cout << multiply(x, y) << std::endl; // Output: 12
    std::cout << multiply(a, b) << std::endl; // Output: 9.25
    multiply(s1, s2); // Output: Cannot multiply non-arithmetic types

    return 0;
}
```
In this example, the multiply() function takes two arguments of type T, and returns their product. This means the user can try to multiply any type, maybe a string or char. However, it uses type traits to check whether the type of T is an arithmetic type (i.e., an integer or a floating-point number), before attempting to multiply the arguments. 

If T is an arithmetic type, the function returns the product of the arguments. If T is not an arithmetic type, the function outputs a message indicating that it cannot multiply non-arithmetic types. 


In summary type traits can be useful for a few reasons:

- It allows you to catch certain errors at compile time, rather than at runtime. For example, if you try to call a function that expects a pointer, but pass in a reference instead, the program will fail at runtime. But if you use a type trait to check whether the argument is a pointer or a reference, you can catch this error at compile time and fix it before the program is even run.

- It allows you to write more generic code. For example, you might write a function template that works for any type that is a pointer, rather than having to write a separate version of the function for each specific type of pointer.