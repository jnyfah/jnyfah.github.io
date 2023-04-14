---
title: 'Register Allocation - CuriousX'
excerpt: 'In the same way, a computer processor is like a chef in a restaurant kitchen, and registers are like the small work area where the processor can keep the data it needs to work with most frequently'
coverImage: '/assets/blog/register.jpg'
date: '2023-03-23T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/register.jpg'
---

I know i have been MIA 😑, yup, been struggling with the code generation part of CuriousX.

I mean we have the Abstract Syntax Tree, what next??? how do we convert this to Assembly for out target architecture, and yea you guessed it right i am as confused as you are 😂

when it comes to codegen, a lot of things come into play such as Register allocation, Instruction selection, Control flow, so i decided lets understand these things first before we can start writing the codegen because i literally don't know how to start 🥲.

---
What is actually register? 
> A register is a small, high-speed memory location inside a computer processor that can be used to hold a value temporarily during program execution. 

Registers are a crucial component of a computer's central processing unit (CPU) and play a critical role in speeding up the execution of programs. They are different from memory in several ways such that they are smaller and faster than memory. While a typical computer may have several gigabytes of memory, it typically has only a few dozen registers. 

Another thing, registers are built directly into the processor and are accessed much more quickly than memory, which is usually located on separate chips on the motherboard. This is why they are used to store temporary values that the processor needs to perform operations, while memory is used to store larger amounts of data that the program needs to access less frequently.

Lets look at it this way, imagine you are a chef in a busy restaurant, you have a lot of different ingredients you need to use to make delicious meals, like vegetables, meats, and spices. To make your cooking faster and more efficient, you have a small work area where you can keep the ingredients you need most frequently, like salt, pepper, and oil. This way, you don't have to run back and forth to the pantry every time you need something.

![skill-pancake](https://media.giphy.com/media/l0HFjaGmrbHanFXNe/giphy.gif)


In the same way, a computer processor is like a chef in a restaurant kitchen, and registers are like the small work area where the processor can keep the data it needs to work with most frequently. Registers are small, high-speed storage areas that the processor uses to hold information it needs to perform calculations and execute instructions quickly.

Registers are different from memory in that memory is like the pantry in the restaurant kitchen, where all of the ingredients are stored but they are not as easily accessible as the ones in the small work area. Registers are much faster than memory because they are located inside the processor itself and can be accessed and manipulated more quickly.

Registers are important in computer systems because they allow for faster access times and reduced memory traffic. When the processor needs to access data, it first checks the registers. If the data is already stored in a register, it can quickly access it without having to fetch it from the memory. This reduces the amount of time and resources needed to access the data, making the system run faster and more efficiently.

---
#### Register Allocation 

why are we allocating registers and what does that even mean, well I think this will be better explained with an example 

We have this AST from last time `x = a + b + * c`
```
             =
            / \
           x   +
               / \
              a   *
                 / \
                b   c

```
This AST has 4 variable: `x, a, b, c` variables and 2 intermediate or temporary variables: ` + , * `, okay let me explain.

A variable is a named storage location in the memory of a computer that stores a value (we all know that 🤷🏼‍♂️). Well, intermediate variables, also known as temporary variables, are variables that are used to hold intermediate results during a computation. 

In the given expression `x = a + b * c`, an intermediate variable will be used to hold the result of the multiplication operation ` b * c` before it is added to the value of a. The intermediate variable is `stored` in a register during the computation. This intermediate  variables are not part of the original source code written by the programmer, but are instead introduced by the compiler during the translation of the source code into machine code.

This is what a typical abstract assembly for the above AST would look like 

```
LOAD r1, b     ; Load the value of b into register r1
LOAD r2, c     ; Load the value of c into register r2
MUL r1, r2     ; Multiply r1 with r1 and store the result in r3
LOAD r4, a     ; Load the value of a into register r4
ADD r3, r4     ; Multiply r3 with r4 and store the result in r5
STORE r5       ; Store the result in the variable x
```
Well from the name abstract, you already know its not the real assembly 😅

I would say abstract assembly is a type of Intermediate representation 
so why are we transforming to abstract assembly first why not transform to the real platform dependent assembly code immediately like ARM of X86 ??

Now, you may be wondering why we need IR in the first place. Can't we just generate code directly from the source language? Well, we could, but that would hinder portability and modularity. Suppose we want to build compilers for n source languages and m target machines. If we didn't have IR, we would need a separate compiler for each source language/target machine combination, resulting in n * m compilers. However, if we use IR, we only need n front-ends and m back-ends, making the process much more manageable.

so one thing to note is when we talk about IR (Intermediate Representation), we often assume that we have an infinite number of registers available, this registers are called `virtual registers`. This is done to simplify the process of code generation and optimization and simplifies the process of code generation and optimization, making it easier to write efficient and portable compilers.

In reality, the number of registers available in a CPU is limited. For example, most x86 processors have only a few general-purpose registers (around 16) that can be used for various operations. However, when generating IR code, we assume that we have an infinite number of registers available. This allows us to write more abstract and general algorithms without worrying about the specific constraints of the target machine.

So i guess you understand from the abstract assembly what intermediate registers are, temporary result holders, now that is just one line of code and we've used 5 registers, imagine how many registers a real program need to sort it self out, meanwhile a typical ARM has just 16 registers!

The job of the register allocator is to map virtual registers (used in IR code) to physical registers (available in the target machine). The allocator tries to minimize the number of physical registers needed to execute the code, while ensuring that each virtual register is mapped to a physical register that is not already in use.

so the job of the register allocator is to map the virtual registers to the physical registers, i think an example will be better, using the abstract assembly generated earlier lets say out target architecture only has 2 registers, so how does the register allocator map those 5 virtual registers to the 2 physical registers ??

Assuming that there are only two physical registers P1 and P2 available for our target architecture, the mapping of the abstract assembly to physical registers can be as follows:

```
LOAD P1, b     ; Load the value of b into register P1
LOAD P2, c     ; Load the value of c into register P2
MUL P1, P2     ; Multiply P1 with P2 and store the result in P1
LOAD P2, a     ; Load the value of a into register P2
ADD P1, P2     ; Add P1 with P2 and store the result in P1
STORE P1       ; Store the result in the variable x
```

This works, we were able to manage 2 physical registers for 5 virtual registers, well thats not always the case, sometimes the physical registers are not enough, so what do we do ?? 

__Register Spilling!__, 

Register spilling is a technique used by compilers to manage the limited number of physical registers available in a processor. When the number of registers required by a program exceeds the number of available physical registers, some of the registers need to be spilled, i.e., their contents need to be saved to memory, so that they can be reused for other purposes. 

This process of spilling registers to memory is called register spilling. When the spilled registers are needed again, their contents are loaded back from memory into physical registers. 

The process of spilling registers to memory and reloading them back from memory can add significant overhead to the program's execution time, which is why compilers try to minimize the number of spills

This is one of the challenges of register allocation, There are several algorithms and strategies used for register allocation, such as graph coloring, linear scan, and live range splitting, as well as hybrid approaches that combine multiple strategies. 