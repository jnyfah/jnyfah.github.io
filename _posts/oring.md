---
title: 'io_uring vs IoRing'
excerpt: 'Windows 11 has its own completion-based I/O ring, openly modeled on io_uring. Same mental model, very different amount of trust in you'
coverImage: '/assets/blog/ooring.jpeg'
date: '2026-07-22T18:22:41.000Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/ooring.jpeg'
---

[_Last time_](/posts/uring) I built an io_uring file reader with no liburing, straight against the syscalls, and wired it into the duplicate scanner in [Phanes](https://github.com/jnyfah/phanes). But Phanes also runs on Windows, and everything in that post from`io_uring_setup`, to `mmap` is Linux-only.

Well, good news is Windows 11 shipped its own ring too, literally called **I/O Rings**, and it is openly modeled on linux io_uring. 

Microsoft designed I/O Rings around the same core ideas as io_uring: a submission queue, a completion queue, shared memory between user and kernel, a `UserData` tag on every operation. [Yarden Shafir's comparison](https://windows-internals.com/ioring-vs-io_uring-a-comparison-of-windows-and-linux-implementations/) is the canonical writeup on how close the two really are, and the [MSDN docs](https://learn.microsoft.com/en-us/windows/win32/api/ioringapi/) cover the API surface.

So Phanes now has two file reader files: `uring.cpp` and `oring.cpp` 😌. Both export the same `phanes_io` module with the same `Ring` class and functions, the [duplicate scanner](https://github.com/jnyfah/phanes/blob/main/src/analyzer/duplicates.cpp) genuinely does not know which one it got. Same prefilter, same chunked hashing, same completion-driven pipeline, zero `#ifdef`s in the analyzer.

Which makes this a fun comparison i guess ..?? 

> The one-line summary of the comparison.. Linux hands you the ring and says "you know the rules." whilst Windows keeps the ring and hands you functions.

---
#### Setup:
Remember setup on Linux? Call `io_uring_setup`, get back an `io_uring_params` struct full of byte offsets, then you compute the ring sizes yourself from those offsets, do up to three `mmap`s, then initialize local pointers by adding offsets to the mapped base.

Here is the entire Windows equivalent:

```cpp
auto init(unsigned entries) -> std::expected<void, ErrorKind>
{
    IORING_CREATE_FLAGS flags{};
    flags.Required = IORING_CREATE_REQUIRED_FLAGS_NONE;
    flags.Advisory = IORING_CREATE_ADVISORY_FLAGS_NONE;

    // submission + completion queue both sized to entries
    HRESULT hr = ::CreateIoRing(IORING_VERSION_3, flags, entries, entries, &handle);
    if (FAILED(hr))
    {
        return std::unexpected(ErrorKind::IOError);
    }
    sq_entries = entries;
    return {};
}
```

That's it, that is the whole thing! 😅.

The shared memory still exists, the kernel still maps the queues into your address space, because i mean, that's the entire point of a ring but for windows you'll never see it. 

`CreateIoRing` creates the ring and writes a `HIORING` opaque handle into the output parameter. That handle represents the ring, and every interaction with the ring goes through API functions that take it. You never see the underlying queues: no offsets, no `mmap`, no pointer wiring, and no way to reach into the ring directly even if you wanted to.

- **`IORING_VERSION_3:`** The version tells Windows which feature set of I/O Rings you want to use. Version 1 could only read while write and flush came in later versions, and the enum goes up to IORING_VERSION_4 and counting as of this post. Older versions remain valid while newer versions add capabilities.
- **Separate SQ and CQ sizes:** Windows lets you choose both queue capacities when creating the ring. Linux takes your requested submission queue size, then calculates the final queue sizes internally and reports them back through `io_uring_params`.

#### Submitting:
On Linux, submitting meant doing everything by hand: read the tail, mask it into an index, `memset` the SQE, fill seven fields, poke the indirection array, then publish the tail with a release store so the kernel sees a complete SQE before it sees the new tail, a lot if work!!, unless ofcourse you are using liburing.

But on Windows:

```cpp
auto queue_read(size_t tag, HANDLE fd, size_t len, int64_t offset) -> bool
{
    auto fileRef = IoRingHandleRefFromHandle(fd);
    auto bufRef = IoRingBufferRefFromPointer(buffer[tag].buf.data());
    HRESULT hr = ::BuildIoRingReadFile(handle,
                                       fileRef,
                                       bufRef,
                                       static_cast<UINT32>(len),
                                       static_cast<UINT64>(offset),
                                       static_cast<UINT_PTR>(tag),
                                       IOSQE_FLAGS_NONE);
    if (FAILED(hr))
    {
        return false;
    }
    pending++;
    return true;
}
```

`BuildIoRingReadFile` is the Windows equivalent of filling an SQE by hand. It's **not a syscall**, it writes the entry into the shared submission queue in user mode, exactly like the linux version did, just behind an API that also does the tail-publishing ordering for you. 

Same fields too, if you squint you can see the file, buffer, length, offset, `UserData` (our tag, unchanged), flags etc.

Since `BuildIoRingReadFile` does not take a HANDLE or a raw pointer directly, we first wrap the file handle and buffer pointer into the types it expects: `IORING_HANDLE_REF` and `IORING_BUFFER_REF`. That's exactly what the two `...RefFrom...` helper functions do.

One thing does change on the caller's side. On Linux the SQ-full check compared the tail against the kernel's head reading shared state directly, with an acquire load. You can't do that when you can't see the head, so the Windows version just counts locally: `pending >= sq_entries` means stop. Cruder but works 🙂.

#### Enter vs Submit

On linux, the design folded submitting and waiting into one syscall, `io_uring_enter(fd, to_submit, min_complete, IORING_ENTER_GETEVENTS)`. Windows has the same fold:

```cpp
UINT32 submitted = 0;
HRESULT s = ::SubmitIoRing(handle, waitOperations, timeoutMs, &submitted);
```

- `waitOperations` is `min_complete` with a different name, and there's a timeout parameter thrown in.
- **No `to_submit`**  here, `SubmitIoRing` hands the kernel *everything* queued, no partial submission. Which also kills a whole failure mode from last time where i did `pending -= ret`, because Linux could accept fewer SQEs than you offered and you had to track the remainder yourself. On Windows it's just `pending = 0` after every submit. One less thing to worry about 🤷🏾‍♀️.
- **HRESULT, not errno.** Of course.

#### Reaping:

The Linux `next()` was built on reading the completion tail with acquire, comparing against the head, indexing the CQE array, and bumping the head with a release store when done. But for the Windows we have:

```cpp
auto next() -> std::expected<Result, ErrorKind>
{
    for (;;)
    {
        IORING_CQE cqe{};
        HRESULT hr = ::PopIoRingCompletion(handle, &cqe);
        if (hr == S_OK) // a completion was available
        {
            // flush any still-queued reads without waiting
            if (pending > 0)
            {
                UINT32 submitted = 0;
                ::SubmitIoRing(handle, 0, 0, &submitted);
                pending = 0;
            }

            int res = SUCCEEDED(cqe.ResultCode) ? static_cast<int>(cqe.Information) : -1;
            return Result{static_cast<size_t>(cqe.UserData), res};
        }

        // completion queue empty: submit queued reads and block for at least one
        UINT32 submitted = 0;
        HRESULT s = ::SubmitIoRing(handle, 1, INFINITE, &submitted);
        pending = 0;
        if (FAILED(s))
        {
            return std::unexpected(ErrorKind::IOError);
        }
    }
}
```

`PopIoRingCompletion` returns `S_OK` when a completion was waiting and `S_FALSE` when the queue is empty and like the build call, popping happens in user mode against the shared ring, so the fast path (a completion is already sitting there) costs no syscall. 

The structure of the loop is recognizably the same design: if something's ready, take it and opportunistically flush queued work with `waitOperations = 0`; if nothing's ready, submit and block for one with `waitOperations = 1`.

#### Where did all the acquire/release go?

For [linux iouring blog](/posts/uring), an entire section was about memory ordering, and the rule behind it: *who owns which pointer*. Acquire on the pointers the kernel writes, release on the pointers you write, because you (the user) and the kernel are touching the same memory and someone has to keep the writes ordered.

That section has no Windows equivalent. Not because the problem went away, the shared queues still have heads and tails and the same ordering requirements but because you can't touch them. 

`BuildIoRingReadFile` publishes the tail, `PopIoRingCompletion` advances the head, and whatever fences that any requires are inside functions Microsoft owns. The whole game from last time is still being played, just not by you.

And that's most of the trade in one sentence. 

The Linux design trusts you with the ring and in exchange you must understand memory ordering or corrupt the queue. The Windows design keeps the ring and in exchange you get an API that is very hard to use wrong and nothing to learn from 😂. 

If part one taught you anything, it's *because* Linux made you do it. 😏

[Full code at oring.cpp](https://github.com/jnyfah/phanes/blob/main/src/io/oring.cpp), and `uring.cpp` from last time is right next to it.

Is the Windows one less fun to write? Yes! 🌚. Was it done in an afternoon because part one already forced me to understand what a ring *is*? Also yes. Do the hard version first, the easy version becomes obvious.