---
title: 'Build systems - CMake'
excerpt: 'CMake does not build the project, it generates the files needed by your build tool(make, ninja etc). This means CMake is a build script generator and acts as a generator for other build systems'
coverImage: '/assets/blog/cmake.png'
date: '2022-04-10T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/cmake.png'
---

> CMake is an open-source, cross-platform family of tools designed to build, test and package software. CMake is used to control the software compilation process using simple platform and compiler independent configuration files, and generate native makefiles and workspaces for your target platform.


CMake does not build the project, it generates the files needed by your build tool(make, ninja etc). This means CMake is a build script generator and acts as a generator for other build systems such as Make, Xcode and Ninja. As we saw in the previous blog, writing cross platform makefiles are daunting, cmakes comes to the rescue here. Cmake also handles dependency management. 

lets look at a simple example to help understand better, you can quickly download and install cmake from [cmake.org](https://cmake.org/download/)

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
To use CMake, you create a CMakeLists.txt file, usually located in the root folder of your project. This file defines the source configuration, compiler and linker options, plus anything else needed to build and, if required, install your project.
```
cmake_minimum_required(VERSION 3.8)
project(BuildSystems
    VERSION 1.0
    DESCRIPTION
    LANGUAGES CXX)
add_executable(myApp, main.cpp)
target_compile_features(BuildSystems PRIVATE cxx_std_20)
```

The first line defines the CMake version required for the current project, Modern CMake starts from version 3.0.0 onwards.

The second instruction a CMakeLists.txt file must contain is the project name, description and language defined by the project(). To add a CMake target: the executable defined by the add_executable() command, tells CMake to create an executable from a list of source files.

The target compile feature tells cmake to enforce c++20 or any version of your choice.

The full list of available C++ compiler features is available [here](https://cmake.org/cmake/help/latest/prop_gbl/CMAKE_CXX_KNOWN_FEATURES.html#prop_gbl:CMAKE_CXX_KNOWN_FEATURES).

you can run CMake to build the project with this command
```
cmake ..
```

Another thing is CMake allows you to determine the platform you're working on and adjust your actions accordingly. This is accomplished by looking at CMAKE SYSTEM NAME, one of CMake's many internal variables. 

CMake also supports conditionals, which are the standard if-else statements. The work is rather simple with these tools in place. 

```
if (CMAKE_SYSTEM_NAME STREQUAL "Windows")
    target_compile_options(myApp PRIVATE /W4)
elseif (CMAKE_SYSTEM_NAME STREQUAL "Linux")
    target_compile_options(myApp PRIVATE -Wall -Wextra -Wpedantic)
elseif (CMAKE_SYSTEM_NAME STREQUAL "Darwin")
    # other macOS-specific flags for Clang
endif()
```

For testing purposes, you may want to create an executable with debugging information and optimizations disabled.Other times, a release-ready optimized build will suffice. The following build types are supported by CMake: 
- Debug — debugging information, no optimization;
- Release — no debugging information and full optimization;
- RelWithDebInfo — same as Release, but with debugging information;
- MinSizeRel — a special Release build optimized for siz

```
cmake -DCMAKE_BUILD_TYPE=Debug ..
```

__Sources to get more in-depth on CMake:__

[Jason Turner — C++ Weekly - Ep 208 - The Ultimate CMake / C++ Quick Start](https://www.youtube.com/watch?v=YbgH7yat-Jo)

[tuannguyen68.gitbooks.io](https://tuannguyen68.gitbooks.io/learning-cmake-a-beginner-s-guide/content/chap1/chap1.html)

[CMake by Example](https://mirkokiefer.com/cmake-by-example-f95eb47d45b1)

[Pablo Arias — It's Time To Do CMake Right](https://pabloariasal.github.io/2018/02/19/its-time-to-do-cmake-right/)



