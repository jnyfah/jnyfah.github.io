---
title: 'Bazel from the Eyes of a Cpp dev'
excerpt: 'After trying this out, I really wish I could easily integrate Bazel with vcpkg just like cmake does, but unfortunately 🫠'
coverImage: '/assets/blog/bazel.jpg'
date: '2023-07-22T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/bazel.jpg'
---

> Build Systems are tools used to automate the build process of projects while avoiding common build-related errors.

To be honest, I have always been a fan of CMake 😂. I don't think I have ever used any other build tools for C++ except CMake. By the way, I recently wrote a blog about it. [Feel free to check it out!](_posts/cmake.md) 

sooo, we are changing that today!😏, for the past few weeks I have been trying out Bazel (a friend introduced me to it) and honestly its not bad atall, really impressive IMO.
 
So yea coming from a cmake fan I would be giving you a beginner friendly intro to Bazel, will tell you what you should look out for, why I love it or why I dont ??? lets see ! 

>Bazel is an open-source build and test tool made by Google similar to Make, Maven, and Gradle. It uses a human-readable, high-level build language. Bazel supports projects in multiple languages and builds outputs for multiple platforms. 

Okay lets get into it! 🫵🏽

first you have to install Bazel for both linux and windows, I would recommend downloading the bazel binary method, but hey, your choice!, [check out installation methods and instructions here](https://bazel.build/install)

The first example is a simple C++ program with the following file structure

```sh
my_project/
   ├── WORKSPACE
   ├── BUILD
   ├── main.cc
   └── math/
        ├── math.h
        └── math.cc

```
the `WORKSPACE` file is a special configuration file used to define the workspace and external dependencies for your project (more on external dependencies later). 
It is typically placed at the root of your project's directory structure and named `WORKSPACE` (all uppercase) with no file extension, serves as the entry point for Bazel

WORKSPACE
```c
workspace(name = "my_project")
```

Bazel also has `BUILD` files, which are somewhat similar to CMakeLists.txt, it allows you to have build files in different folders within your project directory.

These BUILD files are configuration files that define how your software components should be built and how they depend on each other it contains rules and declarations for the targets (e.g., libraries, executables, tests) in that directory. The BUILD files specify the source files, dependencies, and other build-related information for each target.

--- 
math/math.h:
```c++
#ifndef MATH_H
#define MATH_H

int add(int a, int b);

#endif  // MATH_H```

main.cc:
```c++
#include <iostream>
#include "math/math.h"

int main() {
    int result = add(2, 3);
    std::cout << "Result: " << result << std::endl;
    return 0;
}
```

math/math.cc:
```c++
#include "math/math.h"

int add(int a, int b) {
    return a + b;
}
```

BUILD
```c
cc_library(
    name = "math",
    srcs = ["math/math.cc"],
    hdrs = ["math/math.h"],
    visibility = ["//visibility:public"],
)

cc_binary(
    name = "main",
    srcs = ["main.cc"],
    deps = [
        ":math",
    ],
) 

```

In this Bazel BUILD file snippet, two targets were defined: a C++ library named `math` and a binary executable named `main`.

The cc_library target, named `math` represents a C++ library and includes the source files from the "math/math.cc" file and header files from the "math/math.h" file. 

The cc_binary target, named `main,` represents an executable binary and includes the source files from `main.cc.` It depends on the `math` library, specified by the `deps` attribute with the value [":math"].

The visibility attribute is set to ["//visibility:public"], which means that the "math" library is intended to be visible and accessible to other parts of the project or external projects.

In Bazel, the visibility attribute plays a crucial role in controlling which targets can depend on and access other targets in the build graph just like Cmake too. It helps manage the visibility and encapsulation of targets within a project. [More on Bazel visibilities](https://bazel.build/concepts/visibility)

That's basically just it! simple and clear 😅

Alright lets try another example but this time with external dependencies with same file structure, first we will be modifying the `WORKSPACE` file 

```c
workspace(name = "my_project")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

all_content = """filegroup(name = "all", srcs = glob(["**"]), visibility = ["//visibility:public"])"""

http_archive(
    name = "rules_foreign_cc",
    sha256 = "2a4d07cd64b0719b39a7c12218a3e507672b82a97b98c6a89d38565894cf7c51",
    strip_prefix = "rules_foreign_cc-0.9.0",
    url = "https://github.com/bazelbuild/rules_foreign_cc/archive/refs/tags/0.9.0.tar.gz",
)
load("@rules_foreign_cc//foreign_cc:repositories.bzl", "rules_foreign_cc_dependencies")

# This sets up some common toolchains for building targets. For more details, please see
# https://github.com/bazelbuild/rules_foreign_cc/tree/main/docs#rules_foreign_cc_dependencies

rules_foreign_cc_dependencies()
_ALL_CONTENT = """\
filegroup(
    name = "all_srcs",
    srcs = glob(["**"]),
    visibility = ["//visibility:public"],
)
"""
http_archive(
    name = "fmt",
    build_file_content = all_content,
    sha256 = "a664c00bd4cb05419c058194b27e70218771f68e1c7deafb5887efbcef245101", 
    strip_prefix = "fmt-master",
    urls = ["https://github.com/fmtlib/fmt/archive/master.zip"],
    workspace_file_content = "",
)
```

To incorporate external dependencies with foreign build system in Bazel, you must use the [rules_foreign_cc](https://bazelbuild.github.io/rules_foreign_cc/0.1.0/index.html), from a cmake point of view I would say it is a bit akin to CMake's ExternalProject, It simplifies the process of managing external dependencies and allows seamless use of foreign libraries in Bazel-based C++ projects.

`rules_foreign_cc` is not an inbuilt function like `load`, infact the repository says *not an officially supported Google product*, so to use this, one has to download the repo (I know what you are thinking, calm down 😅, I dont know why too) 

The line `load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")` is used to load the http_archive rule from the `http.bzl` file, which is part of the Bazel tools repository `(@bazel_tools)`. The `http archive` a built-in Bazel rule that allows you to download and extract archives is used to achieve this.

Next the necessary rules for common toolchains used in foreign build system integration is loaded from the line `load("@rules_foreign_cc//foreign_cc:repositories.bzl", "rules_foreign_cc_dependencies")`.

These rules provide the magic that makes it easy to incorporate external libraries into our Bazel project.

With the workspace configured and the necessary rules loaded, the external library is ready to included with this line of code:

```c
http_archive(
    name = "fmt",
    build_file_content = """filegroup(name = "all", srcs = glob(["**"]), visibility = ["//visibility:public"])""",
    sha256 = "a664c00bd4cb05419c058194b27e70218771f68e1c7deafb5887efbcef245101", 
    strip_prefix = "fmt-master",
    urls = ["https://github.com/fmtlib/fmt/archive/master.zip"],
    workspace_file_content = "",
)
```

With the `fmt` library added to the project, we can now easily use it in our C++ code. Simply specify the dependency in the build target of the BUILD file, and Bazel will handle the rest.

```c
load("@rules_foreign_cc//foreign_cc:defs.bzl", "cmake")

cmake(
    name = "fmt",
    cache_entries = {
        "CMAKE_BUILD_TYPE": "Release",
        "BUILD_STATIC_LIBS": "on",
        "BUILD_SHARED_LIBS": "on",
    },
    lib_source = "@fmt//:all",

    out_shared_libs = [
        "libfmt.so",
        "libfmt.so.10",
        "libfmt.so.10.0.1",
    ],
    # Everything should be able to reference this dependency.
    visibility = ["//visibility:public"],
)

cc_library(
    name = "math",
    srcs = ["math/math.cc"],
    hdrs = ["math/math.h"],
    deps = [":fmt"], 
)

cc_binary(
    name = "main",
    srcs = ["main.cc"],
    deps = [
        ":math",
    ],
)
```

`load("@rules_foreign_cc//foreign_cc:defs.bzl", "cmake"): This line imports the CMake rule provided by `rules_foreign_cc,`` allowing us to use CMake to manage the external dependency.

`cmake(...)` This block defines the CMake rule to configure and build the "fmt" library. The parameters inside the cmake(...) block specify various settings and options for building the library

Lastly we incorporate fmt into our cpp file 🙂

```c++
#include "math/math.h"
#include <fmt/core.h> // Include the fmt library

int main() {
    int result = math::add(5, 7);
    fmt::print("The result of the addition is: {}\n", result); // Use fmt::print to format output
    return 0;
}

```

After trying this out, I really wish I could easily integrate Bazel with vcpkg just like cmake does, but unfortunately 🫠, currently to me integrating C++ external libraries with foreign build systems in Bazel is a hassel 🥲

---
__Features I absolutely love about Bazel__ ❤️

- __Sandboxing:__ Building with Peace of Mind
    Bazel's sandboxing keeps C++ projects safe and predictable. It's like having separate workspaces for each task, so changes in one part won't disrupt others. This isolation ensures that builds are consistent and free from unexpected side effects. I can confidently build, test, and experiment without worrying about interfering with other code.
- __Built-in Testing:__ Catching Bugs at the Source
    Bazel's built-in testing is a game-changer for C++ developers like me. It's like having a dedicated testing team embedded in the build process. I can easily write and run tests without external dependencies, ensuring that my code is solid and bug-free. It saves me time and gives me peace of mind, knowing that my changes won't break existing functionality.
- __Multi-Language Support:__ Embracing Versatility
    Bazel's multi-language support is a huge advantage for C++ developers working in diverse environments. It's like having a universal translator for programming languages. I can seamlessly integrate C++, Java, Python, and more into the same project. Bazel bridges the language gap, making collaboration with teammates using different languages a breeze.
- __Hermetic Docker Builds:__ Building Once, Running Anywhere
    Bazel's hermetic Docker builds ensure consistent builds, no matter where I work. It's like packaging my development environment in a portable container. This reliability allows me to build my C++ projects with confidence, knowing they'll behave the same way on any machine.
- __Remote Caching and Execution:__ Speeding Up Development
    Bazel's remote caching and execution are like having a supercharged build engine. It caches build outputs, avoiding redundant work and accelerating build times. With remote execution, tasks are distributed across a network, slashing build times for large C++ projects. I can iterate faster and stay in the flow, thanks to Bazel's speed and efficiency.


okay its a wrap!, will I start using Bazel for my project?? lets see how it goes ..I hope to write a more indept Bazel blog soon 😁

for more checkout [Bazel for a Complex C++ Build System by Alexander Neben](https://www.alexanderneben.com/2021/10/05/bazel-part-1.html)

[External C++ dependency management in Bazel by Harvey Tuch](https://blog.envoyproxy.io/external-c-dependency-management-in-bazel-dd37477422f5)