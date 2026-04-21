---
title: 'Phanes: (Part 1 — The DFS)'
excerpt: 'I was bored, and needed an excuse to use C++23'
coverImage: '/assets/blog/preset.jpeg'
date: '2026-04-17T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/preset.jpeg'
---

I was bored and had just finished 2025 Advent of Code on C++23 features, and I thought to myself, I **must** use modules!!

So I decided to work on a tiny project where I could learn something new and also apply what I had learned during Advent.

Well, let’s just say it did not stay tiny 😅.

I built a directory analyzer: a tool that scans a filesystem path, **builds an in-memory tree representation of it**, and then runs different analyses on top of that tree. Things like summary information, largest files, largest directories, extension statistics, recently modified files, and empty directories.

At a high level, the project has two jobs:

1. Scan a directory and turn what it finds into a tree of directories and files.
2. Run analysis on that tree.

The expensive part is building that tree. Every time a user passes in a directory path, the tool has to walk the entire thing and construct the in-memory representation before any analysis can happen.

The first version did this with a plain iterative Depth First Search. It was single-threaded, visited one directory at a time, and on larger inputs it was slow enough to be annoying.

That was where the whole rabbit hole started.

> I first built a thread pool to run the traversal in parallel, which was definitely faster than the plain single-threaded version. But then I ran into load-balancing problems: some workers sat idle while others had a pile of work. So I moved to a work-stealing thread pool, where idle workers could steal tasks from busier ones. That improved things, but the design still had a lot of mutex contention, so eventually I replaced the locking hot paths with a lock-free approach .

This series is basically me working through all of that: what changed, what broke, what got better, and what I learned along the way about scheduling, contention, and memory ordering.

Maybe later I’ll push the project further and turn it into something like a duplicate file finder across directories. But let’s not walk faster than our shadows 🤪.

For now, the directory analyzer itself is done, and you can check it out [here (Phanes)](https://github.com/jnyfah/phanes). Every stage of the project is a separate commit, so you can always go back and see exactly what the code looked like at each point.

---

**Series overview**

Part 1 is this post: the naive DFS builder, what the project does, and why single-threaded traversal was not enough.

Part 2 introduces a basic thread pool.

Part 3 moves to work-stealing to fix load imbalance.

Part 4 goes lock-free.

---

### First version: the naive DFS

The first version built the directory tree with an iterative DFS. It starts at the root, maintains a stack of directory IDs still to be visited, then pops them one by one, reading each directory’s contents, adding files to the tree, and pushing any subdirectories it finds back onto the stack.

If you want to explore the full code for this initial version, you can browse the repository at this point here: (commit [`6930b62`](https://github.com/jnyfah/phanes/tree/6930b625c33d82465d7a691b8744e0202a32d4e8))

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
Simple enough. For every directory it reads, it collects file metadata like size, modification time, and whether the file is a symlink, then stores everything in flat vectors that the analyzer works over later.

The problem shows up when you run it against a real filesystem. I benchmarked it on both Windows (C:\) and Linux (/home), doing a cold run first then five warm runs after the OS page cache was populated:

**Windows — C:\\**

| | |
|---|---|
| Directories | 223,414 |
| Files | 1,225,260 |
| Total size | 667 GB |
| Cold run | 65,836 ms|
| Warm mean | 65,204 ms|
| Warm throughput | ~41,153 entries/s |

**Linux — /home**

| | |
|---|---|
| Directories | 547,997 |
| Files | 1,937,334 |
| Total size | 281 GB |
| Cold run | 17,124 ms |
| Warm mean | 15,660 ms|
| Warm throughput | ~158,728 entries/s |

A few things stand out here. Linux scanned far more entries than Windows and still finished nearly four times faster on a per-entry basis. That gap is worth pausing on, even if it is not the main point of this post.

Some of it is almost certainly NTFS. Every `directory_iterator` call on Windows has to go through the NTFS metadata layer, which stores file attributes, timestamps, and security descriptors in a B-tree structure that requires more I/O per directory read than ext4's comparatively flat directory format. The security descriptor lookups alone add overhead that has no direct equivalent on Linux.

Page cache behavior also differs. By the warm runs, Linux had most of the directory metadata cached in the VFS entry and inode caches, which are tuned to serve repeated stat-heavy workloads quickly. Windows has an analogous cache, but it tends to be more conservative with memory and is competing with more background services on a typical desktop install.

None of this changes the conclusion: single-threaded traversal is the bottleneck either way. But the gap is a good reminder that "filesystem traversal speed" is not a single number, it is a function of the OS, the filesystem driver, the hardware, and how warm the cache is. 

The point is that scanning each subdirectory is completely independent, the contents of one directory have nothing to do with the other, so there is no reason they have to be visited one at a time, well this version of the project does not just know that yet.


## A note on modules and CMake

Since the whole point of this project was to practice C++23 features, everything is written as named modules. Each component exports a module interface in an .ixx file and has a matching implementation file.

The builder interface, for example, is just:

```cpp
export module builder;
import core;
export DirectoryTree build_tree(const std::filesystem::path& root);
```

Getting this working with CMake took some patience. The combination that gave me the most consistent results was CMake 4.0+ with Ninja as the generator. Ninja handled module dependency scanning much better and avoided a lot of the friction I ran into with other setups.

That said, the interesting part of this project is not the build system 😏.

It is what happens at runtime.

And in the next part, that runtime gets its first upgrade: adding a threadpool to this DFS traversal