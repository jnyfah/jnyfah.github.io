---
title: 'Compiler Curious ??'
excerpt: 'Are compilers same as interpreters?? whats the difference ??'
coverImage: '/assets/blog/curious.jpg'
date: '2022-09-02T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/curious.jpg'

---
For a few years now, I have had this urge to write a compiler, just for the fun of it or maybe because i am bored who knows ..

uhhmm, why am I doing this??? Why not ?

- I love solving challenging problems and learning how things work in-depth.
- I don’t just want to be a consumer, I also want to contribute!, i love [LLVM](https://llvm.org/) and i want to be an active contributor. 
- I think working on this will enhance my C++ and programming skills.

Oh well, a compiler is one components in a toolchain of programs used to create executables from source code 

![toolchain](/assets/blog/tools.jpg)

To learn more about the toolchain, [check previous post](/_posts/buildsystems2.md).

A compiler literally just takes input from the preprocessor in form of translation unit and outputs an assembly code specific to your target architecture.

Compilers exist not only to translate programs, but also to improve them, it also assists a programmer by finding errors in a program at compile time, so that the user does not have to encounter them at runtime.

The compiler also has different stages

![Compiler](/assets/blog/toolchain.png)

- Scanner: consumes the source file program and groups them together to form tokens
- Parser: consumes tokens and groups them together to form complete expressions as guided by a grammar and outputs an AST
- Semantic - traverses the AST abd derives semantics, output is an IR
- Code generator- consumes IR and transforms it to concrete assembly language

And I am going to be building each stage from scratch and obviously blogging about it and its challenges too (pray for me). 

I will be using C++ obviously, i plan not to use any 3rd party library, just cmake for easy cross-platform management and google test for writing unit tests, i am also going to target the x86 or ARM architecture or even both, i don't know yet!

I would call it `CuriousX` because i am curious to how compilers work!, it would be a very simple compiler, i don't want to complicate things (i am obviously new to this) and its features would include 

1. Print: just like the python print function `print()`
2. Variables (strings, integer and float)
3. if/else statements
4. Expressions (add, subtract, divide, and multiply)
5. Operator precedence
6.  Operator comparisons : >, <, >=, <=, != and ==
7.  Statements

For example a program with curiousX would look something like this
```C
x = 2.54 + 3 * 5 - (8 / 3)
y = #curious#
if(x == 9){
print(#testing # x)
}
print(# y is # y);
```

The `#` sign would be used to specify that this is a string and not a variable, i don't want to use the famous `""` sign, lets be different, in a weird way.

ohhh, github link to [CuriousX Project ](https://github.com/jnyfah/CuriousX)

#### Are compilers same as interpreters?

While both programs have the same ultimate goal of translating written code into machine code that a computer can use, the two programs function a bit differently. 

For example, a compiler can translate an entire program or batch of code at once
For an interpreter, translating code statements can often take longer. 

This is because interpreters translate one statement of code at a time, even if a program contains multiple lines or batches. 

- A compiler translates source code to machine code, but does not execute the source or object code.
- An interpreter executes source code one instruction at a time, but does not translate the source code
- compiler takes quite a long time to translate the source program to native machine code, but subsequent execution is fast
- An interpreter starts executing the source program immediately, but execution is slow
