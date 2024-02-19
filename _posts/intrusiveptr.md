---
title: 'Intrusive Pointers'
excerpt: 'But how does it keep track of how many shared_ptr are owning the object and all that ??, with the help of a control block of course!'
coverImage: '/assets/blog/intrusiveptr.jpg'
date: '2023-11-29T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/intrusiveptr.jpg'
---

> Basically, an Intrusive pointer is a type of smart pointer(not in C++ standard), that offers a distinct approach to managing the lifetime of dynamically allocated objects. While they share the basic concept of reference counting with shared pointers, its implementation is slightly different.

The fundamental difference between intrusive pointers and shared pointers lies in the location and management of the reference count. With shared pointers, the reference counting is external, handled by a separate control block. While, intrusive pointers integrate this reference counting mechanism directly within the object itself.

__What does this mean exactly ??__ 🤷🏽‍♂️

lets go back to shared pointers a bit, what do we know actually about them 🫠..

Well, from [cpprefrence](https://en.cppreference.com/w/cpp/memory/shared_ptr), shared_ptr is a smart pointer that retains shared ownership of an object through a pointer several shared_ptr objects may own the same object. The object is destroyed and its memory deallocated when either of the following happens:
- the last remaining shared_ptr owning the object is destroyed;
- the last remaining shared_ptr owning the object is assigned another pointer via operator= or reset

But how does it keep track of how many shared_ptr are owning the object and all that ??, with the help of a control block of course!

Control block is separate block of memory that stores:
- Reference Count: the number of shared_ptr instances managing the object.
- Weak Count: the number of weak_ptr instances associated with the same object, which do not contribute to the reference count but need to be aware of the object's existence.
- Managed Object: Either the object itself or a pointer to it.

This means, when a new shared_ptr is created from another or assigned to another, the reference count in the control block is incremented, when a shared_ptr is destroyed, the count decreases.

The object is deleted once the reference count reaches zero, ensuring safe and automatic memory management.

With Intrusive pointers its a bit different, Intrusive pointers embed the reference counting mechanism within the object they manage. This means:
- Inherent Reference Counting: Each object must inherently possess the ability to keep track of how many pointers are referencing it. This often requires modifying the object's class to include reference counting logic.
- Direct Management: The object itself is responsible for incrementing and decrementing its reference count as intrusive pointers are created or destroyed.
- Self-Deletion: The object knows when to delete itself, which occurs when its internal reference count drops to zero.

---
*Lets use an analogy incase you are still a bit confused* 🙂

Think of a shared_ptr as a library book that can be checked out by multiple patrons. Each time a patron checks out the book, the library records this on a separate log sheet, noting how many people currently have the book.

Every time someone borrows the book, the count on the log sheet increases. When they return it, the count decreases. If the count goes to zero (no one has the book), the library knows it's safe to put the book back on the shelf (the book is 'deleted' from circulation).

 The log sheet, which is separate from the book, keeps track of the number of current borrowers

Now, imagine a book in a book club where the book itself has a sign-up sheet attached to its cover. This sheet is a part of the book. Club members write their name on the sheet when they take the book and cross it out when they return it. 

The book monitors on its own how many people are currently reading it. Once everyone has read it and crossed out their names (no current readers), the book decides it's time to retire itself to a storage (gets 'deleted') 

The sign-up sheet is an integral part of the book. The book itself manages the count of how many people are using it.


From the analogy you can see that intrusive pointers are more memory efficient since they dont have an overhead control block, but this comes at a cost of needing direct modifications to the objects they manage (intrusiveness) and a limitation in the types of objects they can manage (reduced flexibility). 😅

Check out an implementation of Intrusive pointers [here](https://github.com/JeanPhilippeKernel/RendererEngine/blob/develop/ZEngine/include/ZEngine/Helpers/IntrusivePtr.h) 🙂
