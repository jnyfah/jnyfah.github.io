---
title: 'io_uring without liburing'
excerpt: 'io_uring is a Linux kernel interface for submitting many I/O operations asynchronously and collecting the results later, without blocking'
coverImage: '/assets/blog/uring.jpeg'
date: '2026-07-17T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/uring.jpeg'
---

A while back I added a duplicate file finder as an addon feature for my toy project [Phanes](https://github.com/jnyfah/phanes), mainly because I wanted to play around with writing my own hash algorithm.

A quick overview of how the duplicate detection works, because the problem is what motivates the solution.

Let's say we have a root folder with a bunch of files and subfolders, and every file in the root and in every subfolder has been flattened into a 1D array, so the array indexes each file and its metadata. The task is to find which files are byte-for-byte identical.

- **Step 1:** group the files by size and throw away any file whose size is unique. A file with a one-of-a-kind size can't have a duplicate, so that's free elimination.
- **Step 2:** within each group, hash and compare the files to find the actual duplicates.

Step 2 is where the work is: every file has to be opened, read all the way through, and hashed.

To speed things up I used a thread pool where each thread grabs a size group, reads and hashes each file in the group.

Look at it this way: `thread A` grabs a group, picks the first file `F1`, opens it, and asks the kernel to read it. While the kernel reads F1, **thread A sits idle**, waiting for the bytes to come back before it can hash them and move on to F2.

Now imagine a 500MB group of about 100 files. Spreading files across threads does help, but every thread you add is another one sitting blocked, and you need a lot of them before the disk is busy. You just pay for it with more threads (stacks, scheduling, context switches) while each thread still blocks on its own read.

> How do you ask the kernel to handle massive amounts of I/O concurrently without blocking the thread that asked?

---
There are older answers, and each has a catch.
- **Thread-pool offload** (glibc AIO, or a homegrown pool of blocking readers like mine) hides the wait behind more threads, but you still pay for the threads.
- **`epoll`** is readiness-based: it tells you when a socket is ready to read without blocking, which is great for network sockets and useless for regular files, because a disk file is always "ready", so `epoll` never helps you overlap disk reads.
- **POSIX AIO** exists but it's clunky and often just a thread pool underneath.

io_uring is different:
- It's **completion-based**, not readiness-based, and it works for regular file reads, the exact workload where epoll provides no useful I/O overlap.
- It's a **shared-memory ring** between your program and the kernel. Requests and completions live in memory both sides can see, so submitting work doesn't necessarily require a syscall per operation.
- It **batches**: queue up F1..F20 and hand them all to the kernel in one go (or, with polling modes, in zero syscalls). The thread stops waiting on one file and starts waiting on the whole batch, and the thread can even go prepare the next batch while the kernel works.

Most of the mechanics below follow the [kernel docs](https://man7.org/linux/man-pages/man7/io_uring.7.html) and [io_uring By Example by Shuveb Hussain](https://unixism.net/2020/04/io-uring-by-example-article-series/), which is worth reading for more depth.

And the honest advice: for ease, use [liburing](https://github.com/axboe/liburing). This post does it *without* the library, straight against the syscalls, just to see what's underneath.

---
#### How io_uring works, roughly

io_uring is a Linux kernel interface for submitting many I/O operations asynchronously and collecting the results later, without blocking. The moving parts:

- **Submission Queue (SQ):** where your program puts I/O requests.
- **Completion Queue (CQ):** where the kernel puts finished operations.
- **user_data:** a tag you attach to each request, handed back to you on completion, so you know *which* operation finished.


Instead of Thread A blocking on F1, it can batch-submit F1..F20 to the submission queue, each uniquely tagged, then tells the kernel "do the work", and the thread sleeps or does some other tasks until at least one completion shows up. When something lands in the completion queue the thread wakes, reads the result, and uses the `user_data` tag to know which submission that result belongs to.

That's just the overview. Everything after this (how many to batch, whether to batch at all, how many completions to wait for before waking, what to use as the tag) is specific to your workload.

For the duplicate scanner, each worker thread owns its own io_uring instance and uses it to read the files of one size group in batches. When it's done with a group it grabs the next, and so on until there are no groups left.

__Two things to get familiar with first__

I know I mentioned the submission and completion queues, but you don't push the *file* and its properties into the submission queue directly. Stay with that thought, it'll make sense once the two-level structure is clear.

This is what the submission queue's ring (SQ) looks like:

```cpp
struct SqRing
{
    __u32* head{};
    __u32* tail{};
    __u32* mask{};
    __u32* entries{};
    __u32* flags{};
    __u32* array{};
};
```

Like any other ring buffer, there is a pointer to the `head`, `tail` and `mask` to be used to calculate the actual index. `entries` is the total capacity of the submission queue, `flags` contains status flags set by the kernel, and `array` is an array of indices into the SQEs, which we will get to soon.

I know that last part sounds weird, but think of it this way: the `array` holds *indices* into a separate array of submission-queue entries (SQEs), and the SQE is where the actual request lives. So two levels: the ring's `array` points into the SQE array.

And the completion queue ring (CQ):

```cpp
struct CqRing
{
    __u32* head{};
    __u32* tail{};
    __u32* mask{};
    __u32* entries{};
    void* cqes{};
};
```

Same idea as the submission ring with one difference: instead of indices, `cqes` points straight at the completion-queue entries themselves.

The second thing to keep at the back of your mind the whole time: the kernel and user space are touching the *same* memory. Not always modifying it, but always reading it.

For the submission queue, the user pushes work in and the kernel pops it off. So the user advances the **tail** (and only reads the head), the kernel advances the **head** (and only reads the tail). Neither side writes the other's pointer.

For the completion queue it's mirrored: the kernel pushes results in, so it advances the **tail** (and reads the head); the user pops results off, so it advances the **head** (and reads the tail).

> Who owns which pointer is the whole game, and it's also why the memory ordering later on matters.

#### Setting the ring up

To get started you have to set the ring up. I guess this is where using libraries is better, because then you don't have to deal with all of this 🥲


```cpp
auto init(unsigned entries) -> std::expected<void, ErrorKind>
{
    ring = io_uring_setup(entries, &param);
    if (ring < 0)
    {
        ring = -1;
        return std::unexpected(ErrorKind::IOError);
    }

    // size of each ring = byte offset to its last field + (element count * element size)
    sring_size = param.sq_off.array + (param.sq_entries * sizeof(unsigned));
    cring_size = param.cq_off.cqes + (param.cq_entries * sizeof(io_uring_cqe));

    // can both rings fit in one MMAP?
    if (param.features & IORING_FEAT_SINGLE_MMAP)
    {
        sring_size = std::max(sring_size, cring_size);
        cring_size = sring_size;
    }

    void* p =
        ::mmap(nullptr, sring_size, PROT_READ | PROT_WRITE, MAP_SHARED | MAP_POPULATE, ring, IORING_OFF_SQ_RING);
    if (p == MAP_FAILED)
    {
        return std::unexpected(ErrorKind::IOError);
    }
    sq_ptr = static_cast<std::byte*>(p);

    if (param.features & IORING_FEAT_SINGLE_MMAP)
    {
        cq_ptr = sq_ptr;
    }
    else
    {
        p = ::mmap(nullptr,
                    cring_size,
                    PROT_READ | PROT_WRITE,
                    MAP_SHARED | MAP_POPULATE,
                    ring,
                    IORING_OFF_CQ_RING);
        if (p == MAP_FAILED)
        {
            return std::unexpected(ErrorKind::IOError);
        }
        cq_ptr = static_cast<std::byte*>(p);
    }

    sqes_sz = param.sq_entries * sizeof(io_uring_sqe);
    p = ::mmap(nullptr, sqes_sz, PROT_READ | PROT_WRITE, MAP_SHARED | MAP_POPULATE, ring, IORING_OFF_SQES);
    if (p == MAP_FAILED)
    {
        return std::unexpected(ErrorKind::IOError);
    }
    sqe = static_cast<io_uring_sqe*>(p);

    // fill user data
    // address of shared memory + offset
    sring.head = reinterpret_cast<__u32*>(sq_ptr + param.sq_off.head);
    sring.tail = reinterpret_cast<__u32*>(sq_ptr + param.sq_off.tail);
    sring.entries = reinterpret_cast<__u32*>(sq_ptr + param.sq_off.ring_entries);
    sring.flags = reinterpret_cast<__u32*>(sq_ptr + param.sq_off.flags);
    sring.mask = reinterpret_cast<__u32*>(sq_ptr + param.sq_off.ring_mask);
    sring.array = reinterpret_cast<__u32*>(sq_ptr + param.sq_off.array);

    cring.head = reinterpret_cast<__u32*>(cq_ptr + param.cq_off.head);
    cring.tail = reinterpret_cast<__u32*>(cq_ptr + param.cq_off.tail);
    cring.entries = reinterpret_cast<__u32*>(cq_ptr + param.cq_off.ring_entries);
    cring.mask = reinterpret_cast<__u32*>(cq_ptr + param.cq_off.ring_mask);
    cring.cqes = reinterpret_cast<io_uring_cqe*>(cq_ptr + param.cq_off.cqes);

    return {};
}
```

`io_uring_setup(entries, &param)` is the first syscall. It asks the kernel to create a ring sized for `entries` submission slots and hands back a file descriptor for it. It isn't exposed in libc as a plain function, so it's called straight through `syscall`:

```cpp
static auto io_uring_setup(unsigned entries, io_uring_params* p) -> int
{
    return static_cast<int>(::syscall(SYS_io_uring_setup, entries, p));
}
```

The second argument, `io_uring_params`, is how the kernel talks back. You pass it in zeroed and the kernel fills it in:

```cpp
struct io_uring_params {
  __u32 sq_entries;
  __u32 cq_entries;
  __u32 flags;
  __u32 sq_thread_cpu;
  __u32 sq_thread_idle;
  __u32 resv[5];
  struct io_sqring_offsets sq_off;
  struct io_cqring_offsets cq_off;
};
```

The important fields coming back are `sq_entries` / `cq_entries` (the real sizes the kernel chose, since it rounds up to a power of two) and `sq_off` / `cq_off`, which are **byte offsets** telling you where inside the shared region each pointer (head, tail, mask, array, cqes...) lives.

Next, the sizes. Annoyingly, the kernel sets the rings up but doesn't hand you their byte size, so you compute it from the offsets it gave you:

```cpp
sring_size = param.sq_off.array + (param.sq_entries * sizeof(unsigned));
cring_size = param.cq_off.cqes  + (param.cq_entries * sizeof(io_uring_cqe));
```

Read that as: (offset from the start of the ring to its last field) + (element count × element size) = total bytes.

Now the main thing, `mmap`. The rings live in the kernel, but the goal is to read and write them from user space *without* a syscall each time, so that kernel memory gets mapped into the process's address space.

After the map, a write through your pointer **is** a write the kernel sees, and vice versa. That shared window is the entire point of io_uring.

Newer kernels can put the SQ ring and CQ ring in a single mapping, that's the `IORING_FEAT_SINGLE_MMAP` feature. When it's set, map one region big enough for both and point `cq_ptr` at the same place; otherwise map them separately.

The SQE array gets its own mapping (`IORING_OFF_SQES`), that's the array of actual request slots the ring's `array` indexes into.

One thing that *doesn't* get its own mapping is the CQE array, because the completion ring already carries a pointer straight to the CQEs (that `cqes` field).

Finally, fill in the local `SqRing` / `CqRing` structs by adding each offset to the mapped base. After this, `sring.tail` and the kernel's tail are literally the same memory.

Whew. That's the setup, and [liburing](https://github.com/axboe/liburing) does make this easier.

> One tip if you're doing this from scratch: wrap those `mmap`s in RAII 🫵🏽.

---
#### Submitting a read

The rings are mapped and the local structs point at shared memory. So how do we actually submit a read?

```cpp
auto submit(const std::filesystem::path& file, size_t len, int64_t offset) -> 
std::expected<size_t, ErrorKind>
{
    if (sq_full())
    {
        return std::unexpected(ErrorKind::IOError);
    }

    int fd = ::open(file.c_str(), O_RDONLY);
    if (fd < 0)
    {
        return std::unexpected(ErrorKind::FileError);
    }
    size_t tag = alloc_slot(len);
    buffer[tag].fd = fd; // slot owns this fd

    auto tail = *sring.tail;
    const auto index = tail & *sring.mask;

    auto* sqentry = &sqe[index];
    std::memset(sqentry, 0, sizeof(*sqentry));
    sqentry->fd = fd;
    sqentry->opcode = IORING_OP_READ;
    sqentry->len = static_cast<__u32>(len);
    sqentry->addr = reinterpret_cast<std::uint64_t>(buffer[tag].buf.data());
    sqentry->user_data = tag;
    sqentry->off = static_cast<__u64>(offset);
    sring.array[index] = index;

    // release so the kernel can observe the write
    std::atomic_ref<__u32>(*sring.tail).store(tail + 1, std::memory_order_release);
    pending++; // queued, but not yet submitted to the kernel
    return tag;
}
```

- **SQ-full guard.** The SQ has a fixed capacity (the `entries` from setup). If the tail has run a full lap ahead of the head, there's no free slot:

```cpp
  auto sq_full() -> bool
  {
      auto head = std::atomic_ref<__u32>(*sring.head).load(std::memory_order_acquire);
      return (*sring.tail - head) >= param.sq_entries;
  }
```

- **Open the file** read-only. (This is the single-shot convenience path; the full class also has an open-once, read-many overload, `submit(handle, len, offset)`, which the duplicate scanner uses.)
- **Grab a slot** for the buffer and fd, sized to the read length. `tag` is that slot's index, and it doubles as the `user_data`.
- **Fill the SQE.** Zero it, then set the fields: the fd, the opcode (`IORING_OP_READ`), how many bytes (`len`), *where* to put what has been read (`addr`), the file `offset`, and `user_data = tag`.
- **The two-level indirection.** `sring.array[index] = index`, this is the bit that looked weird earlier. The request lives in the SQE array at `index`; the ring's `array` at the same slot is set to point there. In simple code they're the same number, but the indirection is what lets the ring and the SQE storage be decoupled.
- **Publish the tail** with a **release** store. The tail is yours to write, and release guarantees the SQE you just filled is visible to the kernel *before* the kernel sees the bumped tail. Fill first, publish second.
- `pending++` counts SQEs that are queued in the ring but not yet handed to the kernel.

#### Reaping completions

Notice `submit` never actually tells the kernel to go. It fills a slot and bumps the tail, nothing more. The kernel isn't poked until the completion side asks for results, which folds the submit and the wait into a single syscall. That's `next()`:

```cpp
auto next() -> std::expected<Result, ErrorKind>
{
    auto head = *cring.head;

    for (;;)
    {
        // user does not own tail, so read with acquire
        const auto tail = std::atomic_ref<__u32>(*cring.tail).load(std::memory_order_acquire);

        if (head != tail)
        {
            // a completion is ready. push any queued SQEs to the kernel on the
            // way past, but do not block for them.
            if (pending > 0)
            {
                int ret = io_uring_enter(ring, pending, 0, IORING_ENTER_GETEVENTS);
                if (ret >= 0)
                {
                    pending -= static_cast<unsigned>(ret);
                    inflight += static_cast<unsigned>(ret);
                }
                else if (errno != EINTR && errno != EAGAIN && errno != EBUSY)
                {
                    return std::unexpected(ErrorKind::IOError);
                }
            }
            break; // leave the for loop
        }

        if (pending == 0 && inflight == 0)
        {
            return std::unexpected(ErrorKind::Unknown);
        }

        int ret = io_uring_enter(ring, pending, 1, IORING_ENTER_GETEVENTS);
        if (ret < 0)
        {
            // failure
            if (errno == EINTR)
            {
                continue;
            }
            return std::unexpected(ErrorKind::IOError);
        }
        pending -= static_cast<unsigned>(ret);
        inflight += static_cast<unsigned>(ret);
    }

    const auto* cqe = &reinterpret_cast<io_uring_cqe*>(cring.cqes)[head & *cring.mask];
    const auto tag = cqe->user_data;
    const auto res = cqe->res; // bytes read, or a negative errno

    --inflight;

    std::atomic_ref<__u32>(*cring.head).store(head + 1, std::memory_order_release);

    return Result{static_cast<size_t>(tag), res};
}
```

The syscall it leans on, again raw:

```cpp
static auto io_uring_enter(int ring_fd, unsigned to_submit, unsigned min_complete, unsigned flags) -> int
{
    return static_cast<int>(::syscall(SYS_io_uring_enter, ring_fd, to_submit, min_complete, flags, nullptr, 0));
}
```

`io_uring_enter` does two jobs at once: it submits `to_submit` queued SQEs, and (with `IORING_ENTER_GETEVENTS`) waits until at least `min_complete` completions are available. It returns how many SQEs it *actually* submitted, which can be fewer than you asked for.

The loop has exactly three outcomes:

- **A completion is already sitting there.** `break` immediately and consume it. **No syscall at all**
- **The CQ is empty and there's work outstanding.** Submit whatever is queued and block for at least one result.
- **The CQ is empty and there is nothing queued and nothing in flight.** Return `Unknown`.



#### About all that acquire/release

The memory ordering in both functions comes back to one rule: who owns which pointer.

- The pointers the **kernel** writes (the SQ head, the CQ tail) are loaded with **acquire**, this stops the loads that come after it (the CQE contents at `head & mask`) from being hoisted above it. Without that, user could observe the bumped tail announcing a completion, and then read a CQE the kernel hasn't finished writing.
- The SQ **tail** is yours to write, published with **release** so the SQE you filled is visible to the kernel before it ever sees the new tail value. Fill first, publish second.
- The CQ **head** is also yours to write, but the release there does a subtly different job: you didn't *write* anything into the CQE, you *read* from it. Release keeps that read from being reordered past the head bump, so the kernel can't recycle the slot and overwrite the CQE while you're still reading it. Read first, release second.


#### How the duplicate scanner actually uses this

The walkthrough above showed the simplest path on purpose: one file, one read, one completion. The real scanner layers a little more on top of the same primitive:

- **Sample prefilter first.** Before fully hashing anything, each file in a size group gets three 4KB reads front, middle, back sharing one open handle. Files whose sample hashes don't match anything can't be duplicates, so most of the group gets eliminated for 12KB of I/O per file instead of the whole file.
- **Chunked full hashing for survivors.** Files that pass the prefilter get read in 4MB chunks against an open handle, feeding a streaming hash. Only a bounded window of chunks is in flight at once, so peak memory is `threads × window × chunk`.
- **Short reads fall out for free.** `res` is the number of bytes *actually* read, and it can be less than what was asked for. Since the next chunk is always submitted at `offset += res` the real position, not the assumed one a short read just means the next read starts where the last one truly stopped. No special case.
- **Completions drive the pipeline.** Every completion either advances a file (submit its next chunk) or finishes it (digest the hash, close the handle, and pull the next waiting file into the freed slot). The window stays full without anyone ever blocking on a single file, which is the whole answer to the question the intro asked.

The full duplicate scanner code is in [duplicates.cpp](https://github.com/jnyfah/phanes/blob/main/src/analyzer/duplicates.cpp).

---

#### So was any of it worth it?

Same machine, 22 physical cores, NVMe SSD. Synthetic corpus of 256 files across 64 size groups, ~301 MB total. 

Two builds of the same scanner: one on the thread pool with blocking `pread`, one on the ring. Five repetitions each, medians reported. Cold runs evict the corpus from the page cache with posix_fadvise(POSIX_FADV_DONTNEED) before every timed run 

**Cold cache** 

| threads | thread pool | io_uring | ring advantage |
|--------:|------------:|---------:|---------------:|
| 1  | 302 ms | **127 ms** | 2.38× |
| 2  | 181 ms | **91.6 ms** | 1.98× |
| 4  | 122 ms | **65.5 ms** | 1.86× |
| 8  | 81.1 ms | **59.0 ms** | 1.37× |
| 16 | 60.1 ms | 59.2 ms | 1.02× |
| 22 | 56.8 ms | 59.5 ms | 0.95× |
| 44 | 55.5 ms | 59.3 ms | 0.94× |


Both approaches converge on about **5 GiB/s**, and that's the SSD, not the API. Neither can go faster. What differs is the *cost of getting there*: the ring saturates the device at **8 threads**, the blocking pool needs **22**.

And look at the ring's plateau: 59.0, 59.2, 59.5, 59.3 across 8 to 44 threads. That's a 0.8% spread. Once it's at the device ceiling, adding 36 more threads changes nothing. The blocking pool climbs the whole way, 5.4× from 1 thread to 44.

So io_uring didn't buy me bandwidth. It bought me **thread efficiency**: same ceiling, a quarter of the threads. At 1 thread it's 2.4× faster; by 16 threads the difference is gone.

---

That's a working io_uring file reader with no liburing anywhere: set up the ring, `mmap` the shared queues, fill an SQE and bump the tail to submit, call `io_uring_enter` to hand it all to the kernel and wait, then read the CQE and its tag to know what finished. [Full code in uring.cpp](https://github.com/jnyfah/phanes/blob/main/src/io/uring.cpp)

Is it worth doing by hand? For production, maybe not, I really don't know, it's all up to you, but [liburing](https://github.com/axboe/liburing) exists, it's tested, and it spares the stress.


#### Going further: zero syscalls with SQPOLL

Earlier I mentioned that batching can go all the way down to zero syscalls with polling modes, that's `IORING_SETUP_SQPOLL`. The idea is that when you set that flag at `io_uring_setup` time, the kernel spins up a dedicated poller thread that watches your submission queue's tail on its own. Instead of you calling io_uring_enter to tell the kernel "go look," the poller thread notices the tail moved and just picks the work up.

Reads aren't the only thing that can go through the ring either, `IORING_OP_OPENAT` lets the *open* itself be an async submission, and `IOSQE_IO_LINK` can chain it to the read so one SQE's result feeds the next. So, you can tailor io_uring to your needs!