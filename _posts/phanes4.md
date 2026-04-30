---
title: 'Phanes: (Part 4 — LockFree)'
excerpt: 'Per-thread queues, load imbalance, and stealing from your neighbours'
coverImage: '/assets/blog/lockfree.jpeg'
date: '2026-04-25T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/lockfree.jpeg'
---


how do we start, fron where we stoped in part 3 and where did we stop???, work stealing but with mutexes, so to further make things better remove mutexes , we are going to try to make the dequeu lock free, becuase there is still lock contention when the stealing is happeing , 2 theives can even be stealing from one owner at same time and then all of them both theive and owner are contendng for one lock, becasue in our system there is no way to know hey, a thief is already steaing from this guy, go and look for someone else to steal from , so 2 or more theives can be trying to steal from one owner at same time, and they are all contending for one lock to the deque, so to make things easy we can make the deque lock free, using the chese lev deque

we only need 3 main functions, push back by owner thread, pop back by owner still and steal front by the theives, all this will work seamlessly the only time issue arises is when there is just one item left to pick from the deque who gets it first ?? the theif or the owner, lets see!!!


first thing first to we define that our deque container only holds trivial datatypes because as you know atomics class can oly hold types that are trivially constructible or destructible

concept DequeElement = std::is_trivially_copyable_v<T> && std::is_trivially_destructible_v<T>;


sorry i will not be explaning atomics here how they work or what they are, thats beyond my capacity, but i will give you links to talks and books that help me get a good grasp of how atomics works and how the cpu see atomics too 

that aside we have defined what type of datatype we want out dequeue to hold, next it what type of deque is this static or dynamic??? i would say dynamic because i mean we cant tell the max number of direcotries each thread will handle i mean if we could we might not even need work stealing in the first place but hey you get th point, but to make it memory efficient, we will use circular buffers, that way we can save memory by only resizing when necessay since as cirular array we get to reuse slots 

```c++
    struct Buffer
    {
        std::int64_t capacity;
        std::int64_t mask;
        std::unique_ptr<T[]> data;

        explicit Buffer(std::int64_t c)
            : capacity(c), mask(c - 1), data(std::make_unique<T[]>(static_cast<std::size_t>(c)))
        {
            assert(capacity && (!(capacity & (capacity - 1))) && "Capacity must be buf power of 2!");
        }

        auto resize(std::int64_t f, std::int64_t b) const -> std::unique_ptr<Buffer>
        {
            auto next = std::make_unique<Buffer>(capacity * 2);
            for (std::int64_t i = f; i < b; ++i)
            {
                next->data[i & next->mask] = data[i & mask];
            }
            return next;
        }

        Buffer(const Buffer&) = delete;
        auto operator=(const Buffer&) -> Buffer& = delete;
    };
```

what to explain here ???? the mask?? for rounding ?? why is it c-1, and why must capacity be power of 2 ???


next is 
```
  private:
    alignas(64) std::atomic<std::int64_t> front{0};
    alignas(64) std::atomic<std::int64_t> back{0};
    alignas(64) std::atomic<Buffer*> buffer;
```

why do we do align as?? explain false sharing and cache lines and how cache invalidation slows down things 

then to the mian thing, memory orders before we go into the main functions must be understood

how do i explain 

memory order acquire 
memory order release
memory order relaxed 
memory order seq_cst --  also mention the global ordering
then fences too 

then we go into th emain functions 

the push back 

why is back load relaxed and front acquire 
why relase store and buffer ??


the pop back 
why the front load is relaxed and the back is relaxed too ??
how the fence maintains rhe global order btw the pop CAS on front the back relase on pop and the steal CAS on front and its loads back
how do we even explain what gloabal orders are and how they can important, maybe wwe explain bfre the fucntions in the memory order section using 

using 
std::atomic<bool> x{false}, y{false};
int r1, r2;

// these four functions run on four different threads
void writer_a() { x.store(true, std::memory_order_seq_cst); }
void writer_b() { y.store(true, std::memory_order_seq_cst); }

void reader_c() {
    while (!x.load(std::memory_order_seq_cst));   // wait for x
    r1 = y.load(std::memory_order_seq_cst);       // is y true too?
}

void reader_d() {
    while (!y.load(std::memory_order_seq_cst));   // wait for y
    r2 = x.load(std::memory_order_seq_cst);       // is x true too?
}

??? 4 threads running this and explicitly outline 2 one of the diffrent orders they can take as there is no fence  and how they will arrive at r1 == 0 && r2 == 0


then steal front ?? explain that front load can be acq too but why use relaxed, is ABA issue here ??? does CAS solve that ??