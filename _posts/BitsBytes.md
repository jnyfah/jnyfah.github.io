---
title: 'Bits to Bytes: Building Computer Memory from Scratch (Part 1)'
excerpt: 'I am really curious about how computers are able to remember things'
coverImage: '/assets/blog/intro.jpg'
date: '2024-03-07T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/intro.jpg'
---

So I have been reading this book Code: The Hidden Language of Computer Hardware and Software" by Charles Petzold. 

Quite a popular book that provides a comprehensive overview of how computers work at the most fundamental level, and I thought why not implement the principles of computer memory detailed there, how hard can it be 😂 and heck its going to be a good learning experience.

_*I am really curious about how computers are able to remember things*_ 🤷🏻‍♀️

When I say implement I mean practically building the circuits from logic gate to latches flipflops etc . why would anyone want to do this ?? I don't know to be honest, but lets try I am sure it would be worth it (I hope so 😅).

So technically you need to have a basic knowledge to how resistors, diodes, transistors etc work and if you don't that's totally fine, I would give contexts and links for you to learn more if there is need to.

Let me give you a quick intro to the star of the show 

---
__Transistors__

A transistor is a semiconductor device used to amplify or switch electronic signals and electrical power, semiconductor meaning it can decide when to let electricity through and when not to.

For now we will be focusing on one specific type of transistor that works like a precise control knob for electricity, the Bipolar Junction Transistors (BJT). it has 3 terminals, the base, emitter and collector.

BJTs come in two main types: NPN and PNP. Here's a simple way to understand them:

- NPN: Imagine you have a water hose (this is your current). NPN says, 'Give me a little squeeze (this is the small current at the base), and I'll let the water flow freely (this means a larger current from the collector to the emitter).'
- PNP: It's like the NPN's mirror image. It works the opposite way. It says, 'Pull back a little (apply a small current in the opposite direction at the base), and I’ll let the water flow (allowing a larger current from the emitter to the collector).'

![https://builtin.com/hardware/transistor](https://builtin.com/sites/www.builtin.com/files/styles/ckeditor_optimize/public/inline-images/1_transistor.png)
image from: [builtin blog](https://builtin.com/hardware/transistor)

For the rest of this series we would be using BJT's mostly NPN, and a pinch of PNP is need be.

To read in-depth of Transistor I would recommend :

- [Understanding NPN vs PNP Transistors: A Comprehensive Guide](https://www.wevolver.com/article/npn-vs-pnp-bjt-transistor-understanding-the-basics)
- [Transistors - NPN and PNP - Basic Introduction](https://youtu.be/AcxDiesy-nI?si=cgQ0H8N4po9ON5gX)
- [Practical Electronics for Inventors](http://instrumentacion.qi.fcen.uba.ar/libro/Scherz.pdf)

Thank you for coming to my TedTalk 😏 next up, Gates!!!!!!! 😁