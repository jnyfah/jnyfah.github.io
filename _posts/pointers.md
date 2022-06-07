---
title: 'Smart Pointers 🤓'
excerpt: 'But in as much as they are tremendously powerful, they are also extremely dangerous as a single overlook can devastate your entire app. 🥲🥲'
coverImage: '/assets/blog/pointers.jpg'
date: '2022-06-03T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/string.jpg'
---

To become a proficient C++ programmer, you must have a thorough understanding of pointers and how they work as they are one of the most essential ideas in memory management, and despite their simple syntax, when used incorrectly, they have the potential to be disastrous. 

Any type of pointer works on the same principle; it's just a simple variable that stores a memory address. But in as much as they are tremendously powerful, they're also extremely dangerous as a single overlook can devastate your entire app. 🥲🥲 

The issue with pointers is that you are solely responsible for their administration which means every dynamically allocated object requires a manual deallocation and if you forget to do so, you'll have a memory leak. This challenges you to keep track of what you've allocated in your head and call the appropriate operator.🤷🏽‍♂️

A simple example of pointers in action:

```c++
MyObject* ptr = new MyObject();                                        
ptr->DoSomething();                      
delete ptr;                                                            
```


This is obviously the annoying problem smart pointers are trying to solve! - with smart pointers you have an automatic memory management where you don't have to worry about deallocation the memory it points to is deallocated automatically.

>A smart pointer is a class that wraps a 'raw' (or 'bare') C++ pointer, to manage the lifetime of the object being pointed to. 
Smart pointers are just classes that wrap the raw pointer and overload the -> and * operators; this allows them to offer the same syntax as a raw pointer

##### Types of smart pointers in modern C++

The "memory" header of the Standard Library defines three types of smart pointers in C++11. They are as follows: 

__Unique_ptr__ - using unique_ptr means no other smart pointers can point to the item it points to because it is its exclusive property. The object is removed when the std::unique ptr is no longer in scope. 

```c++
#include <memory>
#include <iostream>
using namespace std;


int main() {
  std::unique_ptr<int> ptr = std::make_unique<int>(4);
  std::cout<< *ptr <<std::endl;
}
```
__Shared_ptr__ - this owns the item it references, but unlike unique ptr, it enables multiple references. Shared pointer has an internal counter that is decremented each time a std::shared ptr referring to the same resource goes out of scope, until the final one is destroyed, at which point the counter resets to zero and the data is deallocated.

When you wish to distribute your dynamically allocated data around in the same way that you would with raw pointers or references, this form of smart pointer comes in handy. 

```c++
#include <iostream>
#include <memory>

int main() { 
  std::shared_ptr<int> p1(new int(10));  

  // Both pointer now point to same memory
  std::shared_ptr<int> p2 = p1; 
  
  p1.reset();  
  // p2 still points to the memory.
  cout<<*p2<<endl;

  // Deletes the memory, since no one else owns the memory.
  p2.reset(); 
}
```

__Weak_ptr__ - is similar to a std::shared ptr, but it does not increase the number of references. Rather than pointing to a resource directly, they point to another pointer (weak or shared). Weak pointers can't access an object directly, but they can tell whether the object still exists or if it has expired. A weak pointer can be temporarily converted to a shared pointer to access the pointed-to object (provided it still exists).

Here is a perfect example i got from educative.io
```c++
#include <iostream>
#include <memory>


int main() {
  std::shared_ptr<int> p1(new int(23));
  // make a weak pointer to p1
  std::weak_ptr<int> wp1 {p1};

  {
    std::shared_ptr<int> p2 = wp1.lock();  // Now p1 and p2 own the memory.
    if (p2) {
      cout<<*p2<<endl;
    }
  }
  // p2 gets destroyed since out of scope.
  // only p1 holds the memory now

  // Delete p1.
  p1.reset();  

  std::shared_ptr<int> p3 = wp1.lock(); 
  // code will not execute since p3 doesn't point to anything
  if (p3) {
      cout<<*p3<<endl;    
  }
  else{
    cout<<"p3 can't be printed since p1 no longer holds a memory"<<endl;
  }
}
```


###### We should get rid of new/delete and use smart pointers forever !! 😈

One common thing about cpp folks is- they love being in charge and well sometimes one can choose to write a custom container or anything where you would love to manage your memory manually and also when using shared_ptr there is a little speed penalty due to the reference count, just a little 😏
