---
title: 'Phanes'
excerpt: 'I was bored, had just finished Advent of Code, and needed an excuse to use C++23 modules. What started as a tiny project turned into a deep dive through DFS, thread pools, work-stealing, and lock-free data structures.'
coverImage: '/assets/blog/preset.jpeg'
date: '2026-04-04T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/preset.jpeg'
---

I was bored and had just finished 2025 Advent of Code on C++23 features and I thought to myself, I **must** use modules!! So I decided to work on a tiny project where I can learn something new and also implement what I learnt during Advent, well, let's say it was not so tiny.

I built a directory analyzer: a tool that scans a filesystem path, __builds an in-memory tree representation of it__, and then runs different analyses on top of that tree. Things like a summary of total files and sizes, the largest files, the largest directories, extension statistics, recently modified files, empty directories — you get the idea.

At a high level, the project has two jobs:

1. It scans a directory and turns what it finds into a tree of directories and files.
2. It runs analysis on that tree.

The main meat of the code (CHANGE THIS) was in building the tree. Every time a user inputs a directory path, the tool has to walk the entire thing and construct the in-memory representation before any analysis can happen. The first version did this with a plain iterative Depth First Search, and it was slow and single threaded, visiting one directory at a time while the CPU mostly just waited on the filesystem.

So I thought multithreading could make this faster. I went ahead and built a thread pool to do the DFS in parallel, which was indeed much faster than the plain single-threaded version. But I soon discovered that my thread pool had a load balancing problem, so many workers sitting idle while others had a pile of work, so I converted it to a work-stealing thread pool where idle threads can grab work from their busier siblings. That was better, but it was full of mutexes, so eventually I replaced those with a lock-free implementation. (SO MANY "SO")

This is just a series where I work through all of that, the pros and cons, what broke, what I learned about memory ordering, and hopefully at the end I can push the project further. Maybe find duplicate files across directories? Well, let's not walk faster than our shadows. For now the directory analyzer is done and you can check it out [here (Phanes)](https://github.com/jnyfah/phanes). Every stage of the evolution is a separate commit, so you can always go back and see exactly what the code looked like at each step.

---

**Series overview:**
- Part 1 (this post) — naive DFS, what the project does, and why single-threaded is not enough
- Part 2 — introducing a thread pool
- Part 3 — work-stealing to fix load imbalance
- Part 4 — going lock-free

---

## First version: the naive DFS

The first version built the directory tree with an iterative DFS. It starts at the root, maintains a stack of directory IDs still to be visited, then pops them one by one — reading each directory's contents, adding files to the tree, and pushing any subdirectories it finds back onto the stack:

```cpp
std::stack<DirectoryId> toprocess;
toprocess.push(root_id);

while (!toprocess.empty())
{
    auto curID = toprocess.top();
    toprocess.pop();

    for (auto& entry : directory_iterator(tree.directories[curID].path))
    {
        if (entry is a directory)
            toprocess.push(new_dir_id);   // visit later
        else
            tree.files.push_back(new_file_node);
    }
}
```

Simple enough. For every directory it reads, it collects file metadata — size, modification time, whether it's a symlink — and stores everything in flat vectors that the analyzer will work over later.

The problem shows up when you run it against a real filesystem. I benchmarked it on both Windows (C:\) and Linux (/home), doing a cold run first then five warm runs after the OS page cache was populated:

**Windows — C:\\**

| | |
|---|---|
| Directories | 223,414 |
| Files | 1,225,260 |
| Total size | 667 GB |
| Cold run | 65,836 ms |
| Warm mean | 65,204 ms (min 65,057 / max 65,347 / stddev 107 ms) |
| Warm throughput | ~41,153 entries/s |

**Linux — /home**

| | |
|---|---|
| Directories | 547,997 |
| Files | 1,937,334 |
| Total size | 281 GB |
| Cold run | 17,124 ms |
| Warm mean | 15,660 ms (min 15,503 / max 16,101 / stddev 224 ms) |
| Warm throughput | ~158,728 entries/s |

A few things stand out here. Linux scanned about 3.8× more entries than Windows but finished in less than half the time — NTFS directory enumeration is just slower than ext4/btrfs for this kind of sequential walk. But thats not the focus here, we are not focused on system and yes system does influnce how fast or slow but our directory tree build using DFS is very slow (Make this better)


## A note on modules and CMake

Since the whole point of this project was to practice C++23 features, everything is written as named modules, each component exports a module interface (`.ixx` file) and has a matching implementation (`.cpp`). The builder interface, for example, is just:

```cpp
export module builder;
import core;
export DirectoryTree build_tree(const std::filesystem::path& root);
```

Getting this to work with CMake took some patience. The combination that gave the most consistent results was **CMake 3.28+ with Ninja** as the generator — Ninja handles module dependency scanning well and avoids a lot of the friction that comes up with other generators. If you are trying to use C++23 modules in a real project today, that's the path of least resistance.

That said, the interesting part of this project is not the build system — it's what happens at runtime.

slow build to introduce Part 2 here ????
