---
title: 'CuriousX-2.0'
excerpt: 'I woke up and decided I wanted to make my compiler better'
coverImage: '/assets/blog/curiousx2.jpeg'
date: '2024-10-30T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/curiousx2.jpeg'
---


> Curious to try it? Check out the [playground](https://jnyfah.github.io/CuriousX/) and play around with it yourself!


__TL;DR: What’s New in CuriousX 2.0?__
- Conditional statements support (if-else)
- Scoped symbol table to manage variables in nested blocks
- Switch to WebAssembly for easier and more portable code generation
- Improved lexer with comment support
- Cleaner flow

So here's the thing - I woke up one day and thought, "You know what? My compiler needs a makeover." Not just any makeover, but a full transformation 😏. I wanted better UI, proper if statements with comparisons, I ditched x86 for something way cooler - WebAssembly! Because who doesn't love making their life easier, right?

My first task was adding more tokens to the lexer, I even added comments support! Sure, it only recognizes and ignores them for now, but hey, a win is a win! 🏆 I haven't added unary operations yet (it's on the todo list, I promise).

Let's talk about flow changes because this is where it gets interesting. In version 1.0, I was doing this wild thing where I'd generate all tokens, store them in a vector, pass that to the parser for an AST, then to semantic analysis, and finally to code generation. I know, I know - it was a bit crazy, but cut me some slack, it was my first compiler!

This time around, I got smarter. Instead of that token-hoarding approach, I went for a smoother flow: as soon as the lexer generates a token, it goes straight to the parser. Once we have a complete statement, boom - it goes to the semantic analyzer, then to code generation. Much better, right?

Adding if statements support to the Parser was surprisingly smooth. I just had to ensure that each if-statement started on a new line, and I stuck with recursive descent parsing because, well, it works!

The real challenge came with semantics scopes. Since if and else statements introduced blocks, there was a need to track variable scope. So, I designed a scoped symbol table using a vector-based structure, pushing new scopes onto the vector when entering a block and popping them off when leaving. Now, the compiler can track variables correctly within nested scopes. 🎉

Now, let’s talk code generation. A friend suggested I ditch x86 assembly and switch to WASM (WebAssembly). And let me tell you—that was the best decision ever!

__**Why WASM?**__

WASM uses a stack-based execution model that makes everything simpler:

- No more managing platform-specific registers!
- Instructions like local.get, local.set, and call are the essential building blocks.
- Push and pop values on the stack during expression evaluation.

This transition made code generation much easier than the headache of managing registers. 

---
__The Dreaded Part: Web Design__

Let’s me be real: web design is not just my forte. 😅 I struggled here the most. In the end, I borrowed inspiration from Prettier designs and whipped up something simple but functional for the compiler playground.

Check it out!! 👉 [Compiler Playground]()

Building CuriousX 2.0 felt a bit easier than the first time. Why? probably because the foundation was already in place, and it was just about making things better this time around.

From improving the lexer to adding scopes and migrating to WASM, this version of CuriousX is more polished, more optimized, and just plain better. There’s still more to add, but for now, I’m pretty proud of how it turned out. 💪

__What’s Next?__

Well, I’m not sure yet. Maybe I’ll finally add unary operations? Or support loops and functions? We’ll see! For now, I’m just happy with this small victory.
