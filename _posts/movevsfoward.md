---
title: 'std::move vs std::forward'
excerpt: 'std::move doesnt move anything, like what???'
coverImage: '/assets/blog/movef.jpg'
date: '2024-08-15T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/movef.jpg'
---

---
`std::forward` and `std::move` are C++ utility functions that are closely related, i use both in my code most times without worrying about what happens internally until sometime in cppcon when `Klaus Iglberger` said std::move doesn't move anything, like what 😳???

Yep, thats right std::move is basically a semantic transfer of ownership not a real move, how it works basically is: it casts the object to an rvalue reference.


__But what exactly is an rvalue reference?__

Let's break it down with a simple example:
```cpp
int x = 10;       // 'x' is an lvalue, '10' is an rvalue
int y = x + 10;  // 'y' is an lvalue, 'x + 10' is an rvalue
x = y;          // Both 'x' and 'y' are lvalues
```

In this example:
- Lvalue: A named object that has a specific memory location (like x and y).
- Rvalue: A temporary object that doesn’t have a specific memory location and is typically about to be destroyed (like 10 or x + 10).

So, we can say that an rvalue is a temporary object, while an lvalue is an object with an identifiable location in memory.

__Rvalue References in Function Parameters__

Consider the following function:

```cpp
void foo(int& x) {
    std::cout << x;
}

int main() {
    int x = 10;
    foo(x);    // This works
    foo(10);  // Error: Cannot bind non-const lvalue reference to an rvalue
}
```

Calling `foo(10)` results in an error: `invalid initialization of non-const reference of type 'int&' from an rvalue of type 'int'.` This happens because foo expects an lvalue reference (int&), but 10 is an rvalue.

__but if we pass:__
```cpp
void foo(int&& x) {
    std::cout << x;
}

int main() {
    int x = 10;
    foo(x);   // Error: Cannot bind rvalue reference to an lvalue
    foo(10);  // This works
}
```
Here, `foo(10)` works because 10 is an rvalue, and foo now accepts an rvalue reference `(int&&)`. But why would you ever want to pass a parameter by rvalue reference? Let’s explore a practical example.

__Take a look at this:__
```cpp
void foo(int& x) {
    std::cout << x;
}

int main() {
    std::vector<int> vec;
    foo(vec.size());  // Error: Cannot bind non-const lvalue reference to an rvalue
}
```

This code throws an error because `vec.size()` returns a temporary value (an rvalue), and foo expects an lvalue reference. To fix this, you can either:
1. Assign vec.size() to a variable first, or
2. Modify foo to accept a const lvalue reference:

```cpp
void foo(const int& x) {
    std::cout << x;
}

int main() {
    std::vector<int> vec;
    foo(vec.size());  // Works fine
}
```

Well, you might ask since `const reference (const int&)` can handle it why do we still use `rvalue reference`??, using a const reference `(const int&)` allows the function to accept both lvalues and rvalues without copying the object. 

However, since the reference is const, the object cannot be modified within the function. This is why `const &` is commonly used for function parameters when you want to avoid copying large objects but still ensure that the function cannot modify the passed object.

But what if you want to modify the object passed as an rvalue? This is where rvalue references `(int&&)` shine. By using rvalue references, you can take ownership of resources from temporary objects, avoiding unnecessary copying and potentially modifying them.

---
## std::move

In C++, rvalue references are key to move semantics, which allows you to transfer resources from temporary objects efficiently, avoiding the overhead of deep copies. so this means 

```cpp
int x = 10;
int y = std::move(x);
```
- Rvalue Reference Cast: std::move(x) casts x to an rvalue reference (int&&).
- Assignment: The value of x (which is 10) is then assigned to y.

However, for primitive types like `int`, the concept of moving doesn't actually save any resources or involve transferring ownership of anything complex. This is because `int` is just a simple, small data type that the compiler can easily copy. 

After this assignment, `x` still holds the value `10`. For primitive types like `int`, "moving" is essentially equivalent to copying. The state of `x` is not altered or invalidated by the move, making it pointless to use `std::move` for primitive values like `int`, `char`, or `float`.

For comparison, let's see what happens with a more complex type:
```cpp
std::string str1 = "Hello";
std::string str2 = std::move(str1);
```
- Rvalue Reference Cast: `std::move(str1)` casts `str1` to an rvalue reference.
- Move Assignment: The move assignment transfers the internal data (like the pointer to the string data) from `str1` to `str2`, leaving `str1` in a "moved-from" state (usually empty).

In this case, using `std::move` makes a significant difference. It allows the transfer of the underlying resources (such as dynamic memory) from `str1` to `str2` without the need to copy the data, which can be a costly operation.

This demonstrates the real power of move semantics when working with more complex types that manage resources.

---
## std::forward


> Unlike `std::move`, `std::forward` does not cast an object to an rvalue. Instead, it adapts to the type of the argument it is given.

`std::forward` preserves the "nature" of the argument—if it's an lvalue, `std::forward` treats it as an lvalue; if it's an rvalue, it treats it as an rvalue.

In template metaprogramming, `std::forward` is primarily used to preserve the value category (lvalue or rvalue) of the arguments passed to a function template. This is especially important when dealing with `universal references`.

A universal reference is a reference to template parameter of the form `T&&`, which differs from specific rvalue references like `int&&` or `std::string&&`. While specific rvalue references only binds to rvalues, `T&&` can bind to both lvalues and rvalues (just like const&). This is what makes it a universal reference.

Let's consider a scenario to understand why preserving the value category is important:
```cpp
void process(int& x) {
    std::cout << "Lvalue reference: " << x << std::endl;
}

void process(int&& x) {
    std::cout << "Rvalue reference: " << x << std::endl;
}

template <typename T>
void wrapper(T&& arg) {
    process(arg);  // Always treats `arg` as an lvalue
}

int main() {
    int a = 5;
    wrapper(a);    // Calls process(int& x)
    wrapper(10);   // Should call process(int&& x), but it doesn't
}
```

- `process(int& x)`: This function is called when you pass an lvalue (something that has a name and can be assigned to, like a).
- `process(int&& x)`: This function is called when you pass an rvalue (a temporary value, like 10).

In the wrapper function, we want to forward `arg` to `process` as-is. If `arg` is an lvalue, we want to call `process(int& x)`. If `arg` is an rvalue, we want to call `process(int&& x)`.
However, in the example above, `process(arg);` inside wrapper always treats arg as an lvalue. So even when you pass 10 (an rvalue), it doesn’t call the `process(int&& x)` function. Instead, it calls `process(int& x)`.

We can fix this issue by using `std::forward`:

```cpp
template <typename T>
void wrapper(T&& arg) {
    process(std::forward<T>(arg));  // Now forwards correctly
}
```

In summary, in a deduced context, std::forward<T>(x) will return the exact same category (l-valuenes or r-valueness) of x as was passed in the function's argument, whereas std::move will always return an r-value reference, even if passed an l-value reference.

if you are still confused or want to go deeper check out this 2 part talk by Klaus Iglberger 🚀 on [move semantics at cppcon 2019](https://youtu.be/St0MNEU5b0o?si=Urkz-iKkilff0KSI)