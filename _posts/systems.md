---
title: 'Systems Programming'
excerpt: 'The best way to think of "system programming" is the software that talks to hardware'
coverImage: '/assets/blog/systems.jpg'
date: '2022-08-24T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/systems.jpg'

---
For a while now I have found it hard to explain to people what I do, especially to non-programmers. They ask questions like, ohh you are a software engineer right? so do you major in frontend?, backend?? or cloud ?? ... and I am like "nope, I do systems programming" and they'll be like huh ???? 😕😕

What the heck is a systems programming ??, so I guess this is systems programming 101 😁...

> Julie Haugh from Quora said: 
>> The best way to think of "system programming" is the "software that talks to hardware". It is also, typically, "software that software uses, not software that people use." 

Lets look at it this way......

Using food analogy, a system programmer can be thought as the farmer who does the planting, cultivating and rearing of animals, whilst application engineers are the chefs 👨‍🍳 that take the farmers produce and makes delicious dishes for the consumers. 🍴🥄

One core thing to note about systems programming is the fact that it requires a great degree of hardware awareness and its goal is to achieve efficient use of available resources, either because the software itself is performance critical or because even small efficiency improvements directly transform into significant savings of time or money.

Ohh I love this wikipedia's definition 💡

> According to wikipedia, The primary distinguishing characteristic of systems programming when compared to application programming is that application programming aims to produce software which provides services to the user directly (e.g. word processor), whereas systems programming aims to produce software and software platforms which provide services to other software, are performance constrained, or both

So you can see that backend, frontend, fullstack etc are all application programming because they directly aim to provide features to users by developing softwares that help users perform beneficial tasks (such as mobile apps, web apps, etc).

On the other hand, system programming creates frameworks for application programs. Instead of giving features to the user, it gives them to the application programmer, so systems programmers basically develop tools for other programmers.


__But how does this make any sense__ 🤔??

The computer system consists of several hardware devices connected internally or externally, every system also has an operating system that manages and serves as a link between the hardware and software resources, application programs interact with the system via the OS and in turn the OS interacts with the hardware with the help of system programs. 

And just like we have `API's` for application programming, system programming has something called `system calls`, a method that allows a program to request services from the operating system.

With system programming, one can basically write softwares that extends or enhances the functions of an operating system, like drivers, system utilities, emulators, compilers or even new Operating systems.

This system programs are written in low level programming language's such as C/C++, Rust, Swift, Go, Ada, Pascal [see full list](https://en.wikipedia.org/wiki/System_programming_language#Major_languages)

since system programming gives access to various system calls, you can write programs that performs actions like:

- process scheduling and management,
- I/O handling,
- physical and virtual memory management,
- device management,
- File management,
- signaling and inter-process communication,
- multi-threading,
- multi-tasking,
- real-time signaling and scheduling, and
- networking services

This actions helps one write performance critical and low latency programs with high security, stability and low resource usage as it enables efficient management of hardware resources. 💨💨