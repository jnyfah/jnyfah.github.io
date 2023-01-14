---
title: 'Lexical Analysis in CuriousX'
excerpt: 'For example, comments and white space (like spaces and tabs) are like the garnishes on a dish - they make your code look pretty but they dont actually do anything'
coverImage: '/assets/blog/lexer.jpg'
date: '2022-12-24T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/lexer.jpg'
---


Sooo I know I have been MIA (missing in action) 😔😔 but i promise to finish this simple compiler series 🙂

The first stage of building any compiler is the lexical analysis. First of all, what is even lexical analysis??? 

> Simply put, it's the process of breaking down a piece of text (like a program written in a programming language) into smaller units called tokens. 

The lexical analysis process begins by reading the source code character by character and grouping these characters into tokens, using a set of rules called `lexical grammar`; it  removes whitespace from the source program, identifies the tokens and their meanings and also generates an error when it sees an unknown token.

Okay, hold up, let's back track a little; what are actually tokens ??? 

Tokens represent the smallest units of meaning in a text and are used by the compiler to understand and execute the code. These tokens can include keywords, identifiers, operators, and punctuation marks.

Using the language analogy, tokens are like words, and each language has words and this words are made up of characters. In the english language for example, not all words are valid same with tokens in lexical analysis.

According to the lexical grammar, not all tokens are valid, and not all tokens are important. For example, comments and white space (like spaces and tabs) are like the garnishes on a dish – they make your code look pretty, but they don't actually do anything.

As mentioned earlier in the [previous blog post](_posts/curiousx.md), I will be building an expressions only compiler using C++ to keep things simple, this means our lexical analyzer only recognizes tokens associated with mathematical expressions, here is a list of tokens the lexer can recognize 

```c++
enum class LexerTokenType {

    ParenOpen,
    ParenClose,
    FloatToken,
    IntToken,
    VarToken,

    PlusToken,
    MinusToken,
    DivideToken,
    MultiplyToken,
    AssignToken,
    PrintToken,

    StringToken,

    Space,
    Tab,
    Newline,
    Eof,


    Unknown
};
```

For example, let's say you have a piece of code that looks like this:

```c++
x = 2 + (8 * 5)
print(x)
```
The lexer would start by reading the code character by character and grouping them into tokens based on the rules of the lexical grammar. It might identify the following tokens:

```jsx
[x]    ->   <line:1, col:1>;	 VarToken
[=]    ->   <line:1, col:3>;	 AssignToken
[2]    ->   <line:1, col:5>;	 IntToken
[+]    ->   <line:1, col:7>;	 PlusToken
[(]    ->   <line:1, col:9>;	 ParenOpen
[8]    ->   <line:1, col:10>;	 IntToken
[*]    ->   <line:1, col:12>;	 MultiplyToken
[5]    ->   <line:1, col:14>;	 IntToken
[)]    ->   <line:1, col:15>;	 ParenClose
[print] ->   <line:2, col:1>;	 PrintToken
[(]    ->   <line:2, col:6>;	 ParenOpen
[x]    ->   <line:2, col:7>;	 VarToken
[)]    ->   <line:2, col:8>;	 ParenClose
```

As you can see, the lexer is able to break down the code into meaningful tokens that the compiler can understand according to the lexical grammar rules provided, lets say you try to run this code through our lexical analyzer 

```c++
x = 2 + (8 * 5)
print(x);
```
You will definitely get an error saying:
```jsx
unknown character at line <line:2, col:9>

```
Because the token `';'` is not recognized in our lexical grammar rule, and yes, our lexical analyzer also helps keep track of token location 😁, you can check it out [here](https://github.com/jnyfah/CuriousX/tree/main/LexicalAnalysis)

Once the lexical analysis phase is complete, the tokens are passed on to the next compilation phase, the syntax analysis phase.

In summary, the lexical analysis stage works like a librarian, sorting through the jumbled mess of letters in our source code and putting them into neat little piles (tokens) so that our compiler can start to understand what we're trying to say. But the journey doesn't end there. 