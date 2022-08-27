---
title: 'A taste of OCaml 😋'
excerpt: 'OCaml has very predictable performance. In fact, any decent OCaml hacker (who knows assembly, of course) can look at the source and have a rough idea of what the generated assembly code would look like.'
coverImage: '/assets/blog/ocaml.jpg'
date: '2022-08-28T11:37:01.491Z'
author:
  name: Gaga
  picture: '/assets/blog/authors/gaga.jpg'
ogImage:
  url: '/assets/blog/ocaml.jpg'
---


#### How fast is OCaml compared to other PLs?
Performance benchmarks are very difficult to get right and might not even reflect the holistic performance of a particular system. For example, a benchmark that includes a lot of allocations would really not be good for a language with a Garbage Collector, but it might go well for a language that uses reference counting. 

While benchmarks can be used as a good metric to measure performance, I am not remotely close to being an expert in that area, so I won't even try to display or interpret it. Hence, I'm not going to talk about how OCaml performs better than some programming language `X` here, but rather I would talk a little bit about the architecture of the OCaml runtime systems, so you can get a rough idea it might perform in comparison to other modern programming languages. 

Firstly, you should know that OCaml is a pretty fast programming language.

There are two modes of executing OCaml programs, either by a bytecode compiler or a native code compiler. 
The bytecode compiler compiler compiles ocaml source into a bytecode format to be executed by a C interpreter, while the native code compiler compiles source into native binaries. 

OCaml has very predictable performance. In fact, any decent OCaml hacker (who knows assembly, of course) can look at 
the source and have a rough idea of what the generated assembly code would look like. 🤷

One remarkable thing about OCaml is how fast its compilers are. OCaml compiles programs in significantly lesser time than other similar programming languages, for roughly the same size of source code.

#### OCaml vs C++ with respect to learning difficulty
First of all, C++ is a complicated beast. However it is unfair to say that in this context because we're only talking about language learnability instead of the language as a whole. I cannot say objectively which one of these languages is more difficult to learn, so I would make this comparison anecdotally. 

Coming from a C-based language, learning C++ is not particularly difficult to learn. You just have to get accustomed to the way of doing things (e.g pointers, references, etc), but this shouldn't take too long. 

With OCaml, the story is quite different: If you have a C-based PL background, you would be trying to bring those ideas into OCaml, which can make it take a while to learn. 

However this is not the case for everyone: Some people will unlearn and relearn, but as you can obviously tell, this would also take a while. Finally, IMO, the best way to learn OCaml is to have an open mind, drop old idea, learn new patterns, and keep experimenting hands-on until you "get it."


#### OCaml vs. Haskell
Both Haskell and OCaml have similar roots, but over time they have diverged to become two distant cousins. IMO there are four main differences between Haskell and OCaml:

1. Haskell uses lazy evaluation, OCaml uses strict evaluation 
2. Haskell is a pure functional programming language, while OCaml is not
3. Haskell's type system is extremely advanced, OCaml's type system is a bit advanced
4. Haskell has no concept of functors (à la ML), OCaml has functors

Even though these are just few differences listed here, they make OCaml and Haskell quite different languages with 
different philosophies.

#### A little bit of history
OCaml has strong academic roots. It was developed by Xavier Leroy, Jérôme Vouillon, Damien Doligez, and Didier Rémy at [INRIA](https://www.inria.fr/en) in 1996. OCaml is called an ML-like programming language; this is because the core ideas of OCaml are derived from the ML programming language. 

<!-- detour into ML  -->

ML was developed by Robin Milner, to be used as a `meta language` (hence the name) in the LCF theorem prover, but it later transformed into a full-fledged programming language. ML was way ahead of its time. ML is known for its static type system, type inference, module system, algebraic data types, and pattern matching. More notably, ML is the first PL to include a feature known as *parametric polymorphism* (popularly known as "generics"), while also supporting full type inference. In a broader sense, ML isn't actually a programming language, but a family of programming languages which adhere to ML's core values. PLs which conform to these values are called dialects of ML. The major ML dialects these days are Standard ML, OCaml, and F#. So you can say "OCaml is an ML", and you would be technically correct. ML is a very remarkable programming language which still influences new programming languages till date (notably, rust), and Robin Milner later won a turing award in 1991 for it (among other things).

OCaml started from a programming language known as CAML — Categorical Abstract Machine Language (also developed at INRIA), and it progressed into Caml Light, which included a bytecode interpreter, and them Caml Light was extended with object oriented features to give OCaml. 


#### A taste of OCaml 
Let's assume we have a cute programming language used in a some programmable calculator
with this syntax:
```ocaml
$ 1 + 1 
=> 2
$ x is 10
=> defined x as 10
$ x
=> 10
$ y is 30
=> defined y
$ sin (y)
=> 0.5
```
Let's define a simple abstract syntax tree for expressions in this cute language:
```ocaml
type expression = 
	| Number of float (* e.g 10, 0.3, 2 etc *) 
	| Variable of string (* e.g x, y, idx etc *)
	| Add of expression * expression (* e.g 1 + 1 + 2, 10 + x, 2 + sin (30) etc *)
	| Sin of expression (e.g sin (60), sin (10 + 20), etc *)
```

Top level expressions would have a cuter syntax tree:
```ocaml
	type toplevel = 
		| TopBind of string * expression (* e.g y is 20, x is 0.5 *)
		| TopExpr of expression (* e.g 10, sin (x) etc *)
```
Note how easy it is to define recursive types, and how there is a tag for each possible 
way an element of this type can be constructed. These kind of types are colloquially 
known as **tagged unions**.

Before we go ahead to write an interpreter for this cute language, let us 
define a type to represent what *values* are. Think of values as the possible 
result you can get out from typing out an expression in the cute REPL.
```ocaml
type value = 
	| VNum of float
```
That's it! (so cute, I know)

Now we're ready to interpret this cute language:
```ocaml
type eval_context = (string * value) list
let lookup name context = List.assoc_opt name context 

let rec interpret (context: eval_context) (expr : expression) = 
	match expr with 
	| Number (n) -> VNum (n) 
	| Variable (name) -> 
		(match lookup name context with
		| Some value -> value 
		| None -> failwithf "Unbound variable %s" name)
	| Add (left, right) -> 
		let VNum (lvalue) = interpret context left in
		let VNum (rvalue) = interpret context right in 
		VNum (lvalue +. rvalue)
	| Sin (x) -> 
		let VNum (x) = interpret context x in
		VNum (sin x)
```
This is very straight forward interpreter. 
There are few things to note before moving forward:
1. `context`
   * This is simply the *context* in which to evaluate an expression. 
   It is just a list of variables and their values; when we are interpreting an 
   expression and we encounter a `Variable (x)`, we simple check this list for it's 
   value.
2. `expr`
   * The expression that we are currently evaluating
Let's walk through each of these cases:
1. `Number (n)`
   * In this case, we are to evaluate a number expression. We just return it's value 
   equivalent.
2. `Variable (n)`
   * A variable expression. To evaluate a variable, we simple check the context for it's value, 
   and if the value is not present in the context, we display an appropriate error. Easy.
3. `Add (left, right)` 
   * This is a quite different type of expression than we've evaluated, because `left` and `right` 
   are still expressions. To evaluate an addition expression, we evaluate it's sub-expressions: `left` and `right`, 
   and then get the values from them, add them, and return the sum as a value.
4. `Sin (x)` 
   * This also has an expression sub-component. To evaluate a sin expression, we just interpret it's sub-expression 
   to get it's value, and then compute the sin of that value, and wrap the result in a value constructor.
   
Notice how pattern matching has made destructuring of the AST data structure very nice and declarative.


Now let's finalize this interpreter by writing a toplevel processor.
```ocaml
let rec process_toplevel (context : eval_context) (tops : toplevel list) : value list = 
	match tops with 
	| [] -> []
	| TopBind (name, expr) :: rest -> 
		let value = interpret context expr in 
		let new_context = (name, value) :: context in
		process_toplevel new_context rest
	| TopExpr (e) :: rest -> interpret context e :: process_toplevel context rest
```
The `process_toplevel` function takes in an `eval_context`, a list of toplevel commands to process and it
returns a list of values. The important thing to note here is the pattern matching and construction of lists 
with the `::` (pronounced `cons`) operator. `first :: rest` in a pattern, removes the first element from the list, 
and when it's used in an expression position, it attaches `first` to `rest`.
Now let's talk about the cases
1. `[]`
   * We don't have any more toplevel commands to evaluate, so we return an empty list.
2. `TopBind (name, expr) :: rest` -> 
   * The command we want to process is a variable binding. First we evaluate the expression to yield a value, then 
   we pair up the value with the name given, prepend it to the front of the old context, to derive a new context, 
   and then we keep on processing the `rest` commands with the new context (this is how variable names are remembered)
3. `TopExpr (e) :: rest` 
   * Given a toplevel expression, we just evaluate it in the given context, save it's result and keep processing the 
   `rest` of the commands.
   
Extend the AST with `while`, `for`, `functions` and `lists`, and modify the interpreter appropriately, then you'd 
have a fully-fledged programming language. OCaml gives you the power to create seemingly complex *things* in a very 
declarative and understandable way.










## OCaml in the Industry
This section discusses modern software inspired by, written in, or derived from OCaml. 
* Docker 
    * Some of dockers components are written in OCaml. Mostly derived from the [Mirage OS](https://github.com/mirage/mirage). Here's [proof](https://mirage.io/blog/2022-04-06.vpnkit)
* Flow
    * The [flow](https://github.com/facebook/flow) typechecking for JavaScript, from Meta, is written in OCaml.
* Reason
    * [Reason](https://github.com/reasonml/reason) is Meta's attempt to put OCaml in a JavaScript clothing.
* React 
    * The initial React framework's prototype was written in SML (from the ML family!), and then moved to OCaml. Here's [proof](https://news.ycombinator.com/item?id=15209814)
* Infer
    * [Infer](https://github.com/facebook/infer) is C/C++/Objective-C/Java static analysis tool, written in OCaml, that helps you catch all your pointer issues (or related).
* Facebook Messenger
    * AFAIK 50% of Facebook Messenger's frontend was re-written in Reason, which is basically just OCaml. Here's [proof](https://reasonml.github.io/blog/2017/09/08/messenger-50-reason.html)
* Rust 
    * Rust is inspired by OCaml. The Rust developers were C++ and OCaml hackers. In fact, the first Rust compiler was written in OCaml. Here's [proof](https://github.com/rust-lang/rust/tree/ef75860a0a72f79f97216f8aaa5b388d98da6480/src/boot)
* Others
    * For other industrial uses of OCaml, you can check [here](https://ocaml.org/industrial-users)

## Summary
To learn more about OCaml you can check the following places:

* [OCaml's official website](https://ocaml.org/).
* [An awesome podcast from Jane Street](https://signalsandthreads.com/)
* [The OCaml discourse](https://discuss.ocaml.org/)
* [Real World OCaml book](https://dev.realworldocaml.org/)
* [A Cornell University Course](https://cs3110.github.io/textbook/cover.html) 
* [OCaml for UNIX hackers](https://ocaml.github.io/ocamlunix/ocamlunix.pdf)
* [More books](https://ocaml.org/books)
* [Papers](https://ocaml.org/papers)

To learn more about functional programming:

* [Why FP matters](https://www.cs.kent.ac.uk/people/staff/dat/miranda/whyfp90.pdf)
* [Thinking functionally in Haskell](https://www.amazon.com/Thinking-Functionally-Haskell-Richard-Bird/dp/1107452643)
* [Purely functional data structures](https://www.amazon.com/Purely-Functional-Data-Structures-Okasaki/dp/0521663504)
* [Algorithm design with Haskell](https://www.amazon.com/Algorithm-Design-Haskell-Richard-Bird/dp/1108491618)
* [Pearls of Functional Algorithm Design](https://www.amazon.com/Pearls-Functional-Algorithm-Design-Richard/dp/0521513383/ref=pd_lpo_2?pd_rd_i=0521513383&psc=1)
* [Journal of Functional Programming](https://www.cambridge.org/core/journals/journal-of-functional-programming)
