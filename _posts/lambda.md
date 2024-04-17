---
title: 'Lambda in Cpp'
excerpt: 'Think of lambdas as a shorthand for writing a functor without needing to define a struct or class'
coverImage: '/assets/blog/lambda.jpg'
date: '2024-02-19T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/lambda.jpg'
---


We have previously looked at [Functors](/posts/functor/) and [Function Pointers](/posts/functionpointer/), next is Lambdas
> A lambda expression in C++ is a way to define an anonymous function right at the place where it is needed


_Think of lambdas as a shorthand for writing a functor without needing to define a struct or class._

##### Basic Structure

A lambda expression looks like this:

```py

[ /* capture list */ ]( /* parameters */ ) -> /* return type */ {
    // function body
}
```

- __Capture List:__ Specifies which variables from the outside scope you want to use inside the lambda. You can capture by value (copying the value) or by reference.
- __Parameters:__ Just like function parameters, these are the inputs to your lambda.
- __Return Type:__ This is optional. Most of the time, the compiler can deduce the return type based on the code inside your lambda.
- Function Body: The code that gets executed when the lambda is called.

From the previous post with functors we can have a custom sort like this:

```c++
struct DescendingOrder {
    bool operator()(int a, int b) {
        return a > b;
    }
};

std::vector<int> myVector = {1, 5, 3, 4, 2};
std::sort(myVector.begin(), myVector.end(), DescendingOrder());
```

Now, let's use a lambda to do the same thing more concisely:

```c++
std::vector<int> myVector = {4, 1, 3, 5, 2};
std::sort(myVector.begin(), myVector.end(), [](int a, int b) {
    return a > b;
});
```

Here, `[](int a, int b) { return a > b; }` is the lambda expression. It's a compact, anonymous function that we pass directly to std::sort

*Breaking Down the Lambda*

[]: This is the capture list. Since we're not using any external variables inside the lambda, it's empty.

(int a, int b): These are parameters, just like in any function. Our lambda takes two integers to compare.

{ return a > b; }: This is the function body. It performs the comparison.

---
##### Capture List in Detail

The capture list controls how the lambda can access variables from its surrounding scope:

- [=]: Capture all external variables by value.
- [&]: Capture all external variables by reference.
- [x]: Capture variable x by value.
- [&x]: Capture variable x by reference.
- [=, &x]: Capture most variables by value, but capture x by reference.

##### Why Use Lambdas?

Lambdas are handy for short, one-off functions, especially when using algorithms that expect function objects or when you need a quick callback. They keep your code concise and readable by keeping the logic right where it's used, avoiding the need to jump around the codebase to understand what's happening.

_*okay I know you might be wondering, when do I use function pointers, functors and when do I use Lambdas ??*_

###### My guidelines for choosing
1. For simple, stateless calls where performance is critical, and the function will not change, a function pointer might be appropriate.
2. When maintaining state or when the operation is complex enough to warrant its named type, consider a functor.
3. For inline, possibly stateful operations that are concise and local to where they are used, lambdas are often the best choice.'
