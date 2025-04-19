---
title: 'Memory Management in Game Engines: What I’ve Learned (So Far)'
excerpt: 'Here’s what I’ve learned — and what Im still figuring out — while building custom memory allocators for my game engine'
coverImage: '/assets/blog/memory.jpeg'
date: '2025-04-15T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/memory.jpeg'
---


This post is a note-to-self as we figure out what memory management looks like for [RendererEngine](https://github.com/JeanPhilippeKernel/RendererEngine). It documents what I’ve learned so far — and where we are still unsure.

__*Why Memory Management Matters in Games*__

Game development is often about simulating real-world movement — and that means performance really matters. Most games aim to run at 60 FPS, which gives you roughly 16 milliseconds per frame to handle game logic, physics, AI, rendering, and more. That’s not a lot of time and every microsecond counts.

And that’s where memory allocation becomes a big deal. Standard allocation approaches can introduce performance problems that are unacceptable in real-time applications.
```cpp
GameObject* enemy = new GameObject();  
// ... game logic ...
delete enemy; 
```
The standard `new` and `delete` call the system heap allocators like `malloc` under the hood and these heap allocators are mostly designed for safety not speed, Unlike `malloc`, new doesn't just give you memory, it initializes the object too (via constructor calls), that adds a performance cost. 

Well, you can fix this by using `malloc` but you still risk memory fragmentation which will slow down future allocation still. And in game dev, you don’t have time to spare, or memory to waste either.

After researching various approaches, I've found several strategies, each with distinct advantages and disadvantages:

1. Memory Arenas
Memory arenas involve allocating a large block upfront and then managing allocations within that space.

Pros:
-  Fast allocation (often just a pointer increment)
-  No fragmentation within the arena
-  Simple implementation

Cons:
-  Objects with different lifetimes share the same arena, which can waste memory
-  Doesn't work well with varying object sizes
-  Usually requires manual destruction of objects

2. Object Pools
Object pools pre-allocate fixed-size objects of the same type.

Pros:
- Very fast allocation and deallocation
- No fragmentation
- Excellent for frequently allocated/deallocated objects of the same type

Cons:
- Fixed object size limits flexibility
- Can waste memory if pool is too large
- Requires knowing object types and counts beforehand

3. Free Lists
Free lists track available memory blocks for reuse.

Pros:
- Reuses memory efficiently
- Can handle varied allocation sizes
- Reduces fragmentation compared to general allocators

Cons:
- More complex implementation
- Still susceptible to some fragmentation
- Slower than pools or arenas

4. Custom Allocators
Building purpose-specific allocators for different subsystems.

Pros:
- Optimized for specific use patterns
- Can be tuned for performance or memory efficiency
- More control over memory usage

Cons:
- Significantly more complex to implement and maintain
- Different systems may need different allocators
- Requires deep understanding of memory usage patterns


__*Current Implementation in RendererEngine*__

Currently, RendererEngine uses a hybrid approach combining arena allocation and pool allocation:

```cpp
// Simplified example of our current approach
struct ArenaAllocator {
    void* Allocate(size_t size);
    void Clear();
    
    uint8_t* m_memory;
    size_t m_current_offset;
};

struct PoolAllocator {
    void* Allocate();
    void Free(void* ptr);
    
    PoolFreeNode* head;
    size_t chunk_size;
};

// Temporary arena for frame allocations
struct ArenaTemp {
    ArenaAllocator* Arena;
    size_t SavedOffset;
};

ArenaTemp BeginTempArena(ArenaAllocator* arena);
void EndTempArena(ArenaTemp temp);
```
We initialize a global arena at startup, then create subsystem-specific pools and sub-arenas. This gives fast per-frame allocation without fragmentation, reuse of memory across frames and simplified reset semantics

But there are still big gaps to resolve:
1. What to do when an arena runs out mid-frame
2. How to size memory pools to avoid both under- and over-allocation

__*Key Questions I'm Still Wrestling With*__

1. Memory Reservation Strategy
- Should I preallocate a fixed-size region?
- What if it’s too small or too large?
- Should I reserve virtual memory and commit pages as needed?
- What’s the overhead of dynamic commitment vs. precommit?

2. Mixing Allocation Strategies
- How do I combine arenas + pools + TLSF cleanly?
- Which systems benefit most from specialization?
- What happens if allocations cross subsystem boundaries?

3. Growth Strategy
- When should memory grow?
- How much should I grow by? (50%, double?)
- How do I avoid stalling the frame while growing?

I don’t have all the answers yet. This post is a snapshot of what I’ve figured out — and what I haven’t. My current approach works, but I know it won’t scale forever. I’ll keep refining it, benchmarking, and documenting the journey.