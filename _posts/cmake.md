---
title: 'Build systems -CMake'
excerpt: 'You must first understand how to build a code. what does it actually mean to build a code ?, how diffrent is it from compiling and running ??? I just hope this blog dosent get too long 💀💀😂'
coverImage: '/assets/blog/cmake.png'
date: '2022-04-10T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/cmake.png'
---

> CMake is an open-source, cross-platform family of tools designed to build, test and package software. CMake is used to control the software compilation process using simple platform and compiler independent configuration files, and generate native makefiles and workspaces that can be used in the compiler environment of your choice.


CMake does not build the project, it generates the files needed by your build tool(make, ninja etc). This means CMake is a build script generator and acts as a generator for other build systems such as Make, Xcode and Ninja. As we saw in the previous blog, writing cross platform makefiles are daunting, cmakes comes to the rescure here.
Cmake also handles dependency management. lets look at a simple example, you can quickly download and install cmake from [cmake.org](https://cmake.org/download/)

Like Make, which looks for a file named Makefile , CMake looks for a file named
CMakeLists.txt

```
$ tree BuildSystems
BuildSystems/
├── CMakeLists.txt
├── main.cpp
└── test
  ├── test.hpp
  └── test.cpp

```


Note that CMake
is not limited to C and C++ and can be used in projects using various programming
languages.



