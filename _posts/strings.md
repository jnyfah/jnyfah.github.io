---
title: 'String vs String_view'
excerpt: 'Applying this logic to string_view, it means string_view is the window, which is only a view of the string and cannot be used to modify the actual string. it allows you to point into an existing string at some offset'
coverImage: '/assets/blog/string.jpg'
date: '2022-05-20T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/string.jpg'
---

###### What are string_view's and what makes it different from strings ??

String_view from the name is literally just a view to the original data or a view of a string, lets assume u live a house with a window, and looking out of the window you see a beach, but u cant touch the waters or change the colors of the  sands on the beach because your window only provides a view, but then you can actually change the angle from which you view the beach by standing by the side of the window 🤷‍♂️, you can add blinds or blurry glasses that would change your view of the beach, you can even add a curtain and close either the left or right curtain to reduce what you can see, but all this does not in any way change the beach!, modifying the view does not change the original.

Applying this logic to string_view, it means string_view is the window, which is only a view of the string and cannot be used to modify the actual string. it allows you to point into an existing string at some offset.

![Some alt text](/assets/blog/window.jpg)

>The std::string_view, from the C++17 standard, is a read-only non-owning reference to a char sequence. usually implemented as [ptr, length]

So how does this even differ from string and why should you care ??, lets start with a pretty simple example

```c++
#include <iostream>
#include <string>
#include <string_view>

int main(){
    char text[] =  "example";
    std::string str = text;
    std::string_view strV = text;
}
```

In the code above we have a c-style string `text`, assigning text to `std::string str` means the string constructor does some heap allocation and copies the characters inside its own memory location (this means we now have two of same string lying around in memory) but with `string_view`, there will be no copying instead it internally references the same buffer of the original string.

Internally, string_view object has a pointer and a size, it sets the pointer to the beginning of the original string and sets its size to the size of the original string, that way it avoids the heap allocation. Any changes made in the original string `text` would reflect in string_view `strV` but would not reflect in the string `str`. 

For example, the code below prints #xample, example and #xample. think about it 🌚🌚


```c++
#include <iostream>
#include <string>
#include <string_view>

int main(){
    char text[] =  "example";
    std::string str = text;
    std::string_view strV = text;

    text[0] = '#';

    std::cout<< text <<std::endl;
    std::cout<< str <<std::endl;
    std::cout<< strV <<std::endl;
}
```


Like i said before, you can change you view of the beach without changing the beach, std::string_view contains functions that let us manipulate the view of the string, functions such as `remove_prefix`, which removes characters from the left side of the view, and `remove_suffix`, which removes characters from the right side of the view. 

Check out member functions of [string_view here](https://en.cppreference.com/w/cpp/string/basic_string_view)


###### What if I use const std::string& in function parameters??

So is it better to pass strings by const std::string& or std::string_view ???  🤔🤔

well first of is your string a null-terminated string ? or is it a c-style string ?

If __YES__ , then its highly recommended that you use `const std::string& because std::string_view is not guaranteed to be null-terminated, rather it knows where the string ends because it keeps track of its length.



###### Conversions

Is it possible to convert string_view to string and vice versa?? yes certainly ! 😁

```c++
#include <iostream>
#include <string>
#include <string_view>

int main(){

    // converting string to string_view
    std::string str = "text";
    std::string_view strV {str};

    // converting string_view to string
    std::string_view str_vw = "Hello";
    std::string s{str_vw};
}
```


###### Any downsides of string view?

Since string_view doesn't own memory you have to be careful so you don't reference a deleted memory since its lifetime is independent of that of the string it is viewing and trying to view a deleted string leads to undefined behavior 😅

Be wary of actions such as:

- Returning string_view from a function
- Storing string_view in objects or containers


In summary string_view is useful when you want to avoid unnecessary copies, they are less memory-intensive to construct and copy as it doesn't require dynamic memory allocation.


