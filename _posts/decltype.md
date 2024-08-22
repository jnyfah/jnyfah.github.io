---
title: 'decltype and declval'
excerpt: 'In simple terms, std::declval can't be used on its own! 😆'
coverImage: '/assets/blog/decltype.jpeg'
date: '2024-08-24T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/decltype.jpeg'
---
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;[*image: Nike store Lekki, Lagos*]


---

> decltype and declval are two keywords you would see a lot when working with template metaprogramming in C++, because they help in determining and manipulating types at compile-time, enabling more flexible and powerful generic programming


### decltype
decltype is used when you want the compiler to deduce a type based on an expression or variable. For an expression it deduces the type without evaluating it by analyzing the expression's [value category](https://en.cppreference.com/w/cpp/language/value_category) and type.

you can have `decltype (entity)` or `decltype (expression)`	where this entity or expression can be parenthesized or unparenthesized (stay with me 😂😂)


When you apply decltype to an **unparenthesized** entity or expression `decltype(parameter)`, decltype returns the exact type of the variable as it was declared.

This means that if the variable was declared as a reference (either lvalue or rvalue reference), decltype will preserve that reference in the result. 
```cpp
int x = 5;
int& y = x;

decltype(x) a; // `a` is of type `int`
decltype(y) b = a; // `b` is of type `int&
```
- In this example, decltype(x) returns int because x was declared as an int.
- decltype(y) returns int& because y was declared as an int&

But when decltype is applied to a **parenthesized** entity or expression `decltype((parameter))`, it follows a different set of rules to deduce the type.

The rules for parenthesized decltype are as follows:
- If the expression is an lvalue, decltype returns `T&`, where `T` is the underlying type of the expression.
- If the expression is a prvalue (pure rvalue, a subset of rvalues, Temporary values with no specific memory address. I like to call them the real rvalues), decltype returns the underlying type `T` without any reference qualifiers.
- If the expression is an xvalue (eXpiring value, object that is about to be moved or is near the end of its lifetime), decltype returns `T&&`, where `T `is the underlying type of the expression.

```cpp
int a = 10;                  // `a` is an lvalue
int b = a + 20;              // `a + 20` is a prvalue (temporary result)
int&& c = std::move(a);      // `std::move(a)` is an xvalue

int x = 5;

decltype(x + 0) d; // `d` is of type `int` (prvalue)
decltype((x)) e = d; // `e` is of type `int&` (lvalue)
decltype(std::move(x)) f = 10; // `f` is of type `int&&` (xvalue)
```
- `decltype(x + 0)` returns `int` because `x + 0` is a prvalue (a temporary value).
- `decltype((x))` returns int& because `(x)` is an lvalue expression.

__*Why Use decltype When We Can Use auto?*__

This brings up an important question: Why use `decltype` when we can just use `auto`? 🤷🏻

Well, while both `decltype` and `auto` are used for type deduction, they serve different purposes and have different behaviors, particularly when it comes to handling references.

When you use auto to deduce the type of a variable, it generally strips away references unless you explicitly instruct it to keep them. This means that if the expression is an `lvalue` reference, `auto` will usually deduce it as the base type rather than maintaining the reference

Example:
```cpp
int x = 42;
int& ref_x = x;

auto a = ref_x;    // `a` is deduced as `int`, not `int&`
a = 100;           // Modifies `a`, but `ref_x` (and `x`) remain unchanged

decltype(ref_x) b = ref_x;  // `b` is deduced as `int&`, exactly matching `ref_x`
b = 100;                    // Modifies `b`, which also modifies `x`
```

In this example, `auto` deduces `a` as an `int`, even though `ref_x` is an `int&`. The reference is stripped, and a becomes a separate `int` variable, independent of `ref_x`.

`decltype(ref_x)` deduces `b` as `int&`, preserving the reference. Any modification to b directly affects `x` because `b` is a reference to `x`.


__*Using decltype in Functions*__

You can use decltype in functions to deduce return types based on the function's arguments or expressions.

```cpp
template<typename T>
auto fcn (T i) -> decltype(i) {
    return i;
}

template<typename T>
decltype(auto) fcn (T i) {
    return i;
}
```

Both versions work, but why use `decltype(auto)` when you can use `decltype(expression)`? `decltype(expression)` is more explicit, making it clearer what type you're dealing with, but both approaches are valid and functionally equivalent.

To get more insights on decltype look at *[C++ value categories and decltype demystified](https://www.scs.stanford.edu/~dm/blog/decltype.html)*

---
### declval

`std::declval` is a utility that creates a "fake" instance of a type by returning an rvalue reference to that type. 

However, this fake instance does not actually exist in memory, it’s just a conceptual tool that the compiler uses to deduce types

This means that `std::declval` can only be used in unevaluated contexts. If you tried to evaluate an expression involving `std::declval`, the code would attempt to access a non-existent object, leading to undefined behavior or a compilation error.

Therefore, `std::declval` must only be used in contexts where the expression is analyzed for its type without actually being executed.

In C++, certain contexts allow you to inspect or deduce types without actually performing the operations involved. These are known as "unevaluated contexts." 

Examples of unevaluated contexts include:

- `decltype:` Used to deduce the type of an expression without evaluating the expression.
- `sizeof:` Determines the size of a type or expression without evaluating the expression.
- `noexcept:` Checks whether an expression can throw an exception without evaluating the expression.


_*In simple terms, std::declval can't be used on its own!*_ 😆

```cpp
#include <utility>

int main() {
    auto obj = std::declval<int>();  // Error: `std::declval` cannot be used here
}
```
- Here, we are trying to use `std::declval<int>()` as if it were a real object, but since `std::declval` does not actually create an object, this code is invalid and will result in an error.


__Using std::declval with decltype:__
```cpp
#include <utility>
struct MyClass {
    int foo() const { return 42; }
};

// Here, `std::declval<MyClass>()` is used in an unevaluated context
// to deduce the return type of `foo()` without creating an actual `MyClass` object.

decltype(std::declval<MyClass>().foo()) x;  // Deduces `x` as `int`
```
- In this example, `std::declval<MyClass>()` is used within `decltype`, which is an unevaluated context. The compiler determines the return type of `foo()` (which is int) without ever creating an instance of `MyClass`.


__Using std::declval with sizeof:__
```cpp
#include <utility>
struct MyClass {
    void someMethod() {}
};

// `sizeof` checks the size of the return type of `someMethod`
// without actually calling `someMethod` or creating a `MyClass` object.

constexpr size_t size = sizeof(std::declval<MyClass>().someMethod());
```
- Here, `sizeof` is an unevaluated context. It calculates the size of the return type of someMethod without invoking the method or creating a `MyClass` object.


__Using std::declval with noexcept:__
```cpp
#include <utility>
struct MyClass {
    void someMethod() noexcept {}
};

// `noexcept` checks if `someMethod` can throw an exception
// without calling `someMethod` or creating a `MyClass` object.

constexpr bool isNoExcept = noexcept(std::declval<MyClass>().someMethod());
```
- In this case, `noexcept` is an unevaluated context. It checks if someMethod is marked as `noexcept` (indicating it won't throw an exception) without actually calling the method.