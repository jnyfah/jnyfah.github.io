---
title: 'OCaml for n00bs'
excerpt: 'As software grows more complex and we depend on it more for activities ranging from simple tasks to life saving tasks, OCaml is designed in a way to tame complexities and help us write correct software'
coverImage: '/assets/blog/ocmal.jpg'
date: '2022-08-26T11:37:01.491Z'
author:
  name: Gaga
  picture: '/assets/blog/authors/gaga.jpg'
ogImage: '/assets/blog/ocmal.jpg'

---


#### What is OCaml?

> OCaml is a general-purpose, industrial-strength programming language with an emphasis on expressiveness and safety.

Broadly speaking, I think this epitomizes the essence of OCaml. But let's get  more specific: OCaml is a statically typed functional programming language which also supports imperative and object-oriented programming. Being statically typed brings about the *safety* ("well-typed programs cannot go wrong"). Functional programming is a very declarative style of constructing programs which encourages *expressiveness*, and finally OCaml compiles to native code with a very predictable performance. 


#### Functional programming  ??? 
First of there are 2 classes of programming paradigm's, okay i know you are confused 😂...

Programming paradigms are kind of like a style of programming, it does not refer to a specific language, but rather it refers to the way you write code or a program (there are so many ways to kill a roach 🤷).

There is the __Imperative programming paradigm__ which includes procedural and object oriented programming and then the ___Declarative programming paradigm__ such as functional, logic and Data driven programming approach.

you can read more about it here ... [What exactly is a programming paradigm?](https://www.freecodecamp.org/news/what-exactly-is-a-programming-paradigm/)

Functional programming is a style of programming which admonishes that we write programs in a composable and modular way using function application and function composition; it also dictates that we avoid mutation and side effects in our programs (If we avoid side effects completely, we have a sub-paradigm known as purely functional programming). The rationale is to make programs more declarative and easier to reason about. 

For example, say we had a linked list data structure and we want to implement a function to find it's length

In C++ we could have:
```cpp
    struct Node {
        int data;
        Node* next;
    };

    int length (Node* list) {
        int len = 0;
        auto node = list;  
        while (node != nullptr) {
            len += 1; 
            node = node->next;
        }
        return len;
    }
```
In a functional language like OCaml, we would have:
```ml
    type node = Data of int * node | Empty
    let rec length node = 
        match node with 
        | Empty -> 0
        | Data (_, next) -> 1 + length next 
```


We tend to define functions recursively rather than using loops (which inherently use mutation for the loop counter); this works well in practice because recursion *generalizes* loops, and most functional programming language support tail-call optimization. Another interesting property of functions defined recursively is that they can, most times, be proven correct by mathematical induction (I think only structurally recursive functions can be proven correct with induction); this is because pure functions (i.e functions without any side effect) can be thought of as mathematical functions, and then we can use other theorems and lemmas to prove invariants about said function. 

This is just a taste of functional programming, and If you find this remotely interesting, you'd probably be interested in learning more — More resources are at the end of this post 🙂.


#### Why OCaml? 
As software grows more complex and we depend on it more for activities ranging from simple tasks to life saving tasks,
now more than ever, we need programming languages which can tame these complexities and ease the creation of *correct*
software. 

OCaml is designed in a way to tame complexities and help us write correct software. Let me explain with these 
points:

1. Declarative program construction / expressiveness
   
   As software engineers, we spend most of our time *reading* code, rather than *writing* code.
   Programs written in OCaml are very declarative mostly because of pattern matching and the FP style of programming.
   This means that OCaml programs are easier to read and reason about, easier to maintain, and hence would be less prone to 
   specific kinds of errors.
2. Safety / Security
   
   There are a lot of caveats with Programming Language security and safety. I would just talk about memory safety and type safety 
   here. OCaml has a very strong and expressive type systems that can catch a lot of type errors, which can lead to 
   severe security vulnerabilities, at compile time. Also, being a programming language with a garbage collector and 
   secure runtime system we don't have to worry about common pointer or memory management issues.
3. Immutable data structures
   
   This is no secret: immutability in data structures (or just plain data in general) rules out certain kinds of 
   bugs that can occur in programs (e.g race conditions, updating a structure when you shouldn't have, 
   deleting data by mistake etc)
4. Concurrency
   
   As Moore's law comes to an end, [free lunch is over!](http://www.gotw.ca/publications/concurrency-ddj.htm)
   We need languages with built in concurrency to deal with these changing software needs. OCaml 5 comes with 
   novel approach to concurrency using *effect handlers*.
5. Abstractions / Modularity 
   
   Every programming languages needs some shinny features specifically there to deal with modularity or
   abstraction problems. Java has OOP, Generics, etc. Rust has traits, Generics, fancy types, etc. 
   Haskell has type classes and other type level machinery. C++ has a 
   [turing complete](http://citeseerx.ist.psu.edu/viewdoc/summary?doi=10.1.1.14.3670) template system. 
   OCaml has something *equally* as powerful as traits in Rust and type classes in Haskell known as *functors*. 
   Functors are modules that take in modules and return modules (think: functions, but instead of 
   taking expression as arguments, they take in module). A lot of nice abstractions can be created 
   with functors, and OCaml takes it a step further to include *first class module*, where modules 
   can be packaged into an expression and vice versa and a powerful abstractions can be made with these.


Also, here are some other reasons why I think OCaml should be used more:
* Very fast compiler and build system
* A nice REPL
* Fancy / powerful type system
* Native binaries
* Automatic memory management 

See also this [chapter](https://dev.realworldocaml.org/prologue.html#why-ocaml) from the Real World OCaml book.


#### What is OCaml best for? 

1. Writing system software (e.g unix utilities or heck, even [operating systems](https://mirage.io/))
2. Writing compilers / interpreters (or any software artifact that traverses an abstract syntax tree)
3. Financial software
4. Rapid prototyping
5. Domain modelling 
6. Basically any software you want to be correct.

OCaml can be used for writing other kinds of software like frontend (yes, there is a JS compiler and a nice framework), backend (yes, there is a nice library), but it is not really common. Hopefully, it would be more common in the future because these kinds of applications can be really nice if written in a functional programming language 💁.

#### Why is OCaml not popular?
Language popularity is a very tricky business. How "well designed" a language is doesn't necessarily scale linearly with respect to popularity (for some definition of "well designed"). A lot of factors go into language popularity, ranging from *good* marketing (e.g Sun Microsystems spent millions of dollars to market Java in the 90s) to *good* developer tooling (e.g Visual Studio in the early 2000s for C#). For OCaml, however, there are several reasons I think it is not as popular as other "mainstream" programming languages:
* No big tech corp. backing the language
    
    I think this is a fairly straight forward point. Most major programming languages in use today are backed by big (or relatively big) tech companies. Microsoft backs C# and F# and gives first class treatment for then in Visual Studio and on Azure. Google backs Go (with similar treatment on Google Cloud) and Dart. Apple backs Swift with proper tooling in Xcode. Sun Microsystems/Orace backed/back Java. Mozilla backs Rust. JetBrains (and Google) backs Kotlin. OCaml was birthed in a research lab in France. While it has a lot of industry backing now, it doesn't equate to what these programming languages have. 
* Originally from and mostly used within academic circles
    
    "Academic" programming languages like Haskell, OCaml and Racket are usually seen as not real world (Fun anecdote: I was once in a coding interview and I wanted to use OCaml, and the interviewer told me to use something that can solve "real" problems lol). This give programming languages like OCaml bad press among developers / software engineers. 
* Previous lack of tooling 
    
    Initially, OCaml had extremely poor tooling (compared to today's standards in dev tooling). I can only wonder how many potential users this drove away from the community. That said, OCaml now has excellent tooling in VS Code, Emacs, and Vim.
* Lack of popular libraries 
     
     This is still a big issue for OCaml. Say, you wanted a library to work with Azure blob storage in OCaml, you'd have to go to the Azure docs, and write it yourself. Where as, in languages like C#, you already have an industry-tested client sdk waiting for you. This was one of the reasons [darklang.com](darklang.com) [left OCaml](https://blog.darklang.com/leaving-ocaml/).
* Small community, even smaller group of experts 
    
    There are very few people on earth who can claim that they're OCaml "experts". This is not because the programming language is particularly difficult to learn, rather I think this is just because OCaml has relatively fewer users: Say a programming language has X users, then you can say that the number of experts of that PL would be a small fraction of X. So if X is small, the fraction of experts would even be smaller. 
* functional programming is very niche for most software engineers
    
    Most software engineers don't really care about FP or some other fancy buzzword, they just want to get their work done and make sure all the tests are green. 
* Focuses on UNIX-based systems majorly
    
    While it can be argued that UNIX-based operating systems are the best systems for software engineers, a lot of engineers still use Windows 😔. Trying to install OCaml on Windows currently is a nightmare, the advice they usually give is: "just use WSL"
* Programming Language community is very niche



#### Pros and Cons of using OCaml
Pros: 
<!-- can also refer to xavier comment about 50% of C perf  -->
* Predictable and solid performance 
* Automatic memory management 
* Powerful and expressive type system
* Powerful type inference
* Very expressive core language 
* Welcoming community

Cons: 
* Relatively small amount of learning resources
* Lack of some popular libraries (e.g Azure SDKs)
* Sometimes, using other programming paradigms (e.g OOP or imperative programming) in OCaml can be a serious pain. 😪
