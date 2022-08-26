---
title: 'Type Casting 🎥'
excerpt: 'This is my best goto cast operator, performs same implicit cast that C-style cast does, the only difference is that the conversion happens at compile time, which gives you a compile time checking ability'
coverImage: '/assets/blog/casting.jpg'
date: '2022-06-17T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/casting.jpg'
---

Type casting in C++ is basically the conversion of data from one data type to another, lets say you have a data type double and you want to change it to an int, float or even a string ?? 🤷🏽‍♂️

wait, can you change a double to a string 🤯🤯???????? oh well, hang on lets see if its possible 🥴🥴

There are two types of type conversion in C++.

   - Implicit Conversion
   - Explicit Conversion 

__Implicit Conversion__ : is automatically done by the compiler without any trigger from the user. It generally takes place when in an expression more than one data type is present. 
First of you have to understand that there is something called ranking between type, oh yea all types aren't equal 
```markdown
 long double > double > float > long > int > short > char
```
this means during conversion either a demotion or a promotion takes place, note that during demotion data loss takes place 

for instance
```c++
int x = 9.75;
bool y = x;
```
Automatically the compiler saves `x` as 9 and discards any value after the decimal, demotion has occurs and there was a loss!. There would be no problem if the size of the variable in the left expression can accommodate the value of the expression, although the results may differ from those intended. The value of `y` would be `true` if any real or integer value is assigned to it and false if `0` is assigned.

But promotion doesn't create any problems there is neither a loss or gain for the data, just a change in type.

__Explicit Conversion__ : the user manually changes data from one type to another, there are 3 main types of explicit conversion:

  - C-style type casting - here the required type is explicitly specified before the parenthesis in this type of conversion, and just like implicit conversion it causes data loss
```c++
// initializing int variable
int num_int = 26;

// declaring double variable
double num_double;

// converting from int to double 
num_double = (double)num_int;
```
Note that the C-style casts can change a data type without changing the underlying memory representation, which may lead to garbage results 🥲🥲

  - Cast operators: C++ also has four type cast operator

    1. __Static Cast:__ 
          ```c++
            static_cast<new_type> (expression)
          ```
    This is my best goto cast operator, performs same implicit cast that C-style cast does, the only difference is that the conversion happens at compile time, which gives you a compile time checking ability, C-style doesn't and it is more readable and can be spotted easily 🙂
      ```c++
      float x = 3.5;
      int y = static_cast<int>(x);
      ```

    2. __Dynamic Cast:__ 
          ```c++
            dynamic_cast<new_type> (expression)
          ```
    Basically, dynamic cast is used for casting along the class inheritance hierarchy in C++, this just means casting an object from based class type to derived type and vice versa. 
    
    News flash this can also be done with C-style casting but the difference is, downcasting from a base class to derived class, may fail if pointer is not actually of derived type, this means the cast is invalid, dynamic cast checks that the object being cast is actually of the derived class type and returns a null pointer if the object is not of the desired type (unless you're casting to a reference type -- then it throws a bad_cast exception) but other casts or C-style cast wont.
      ```c++
      class MyBase { public: virtual void test() {} };
      class MyDerived : public MyBase {};
 
      int main() {
        MyDerived *child = new MyDerived();
        MyBase  *base = dynamic_cast<MyBase*>(derived);
      }
      ```

    In the example above, MyDerived pointer is converted into a MyBase pointer using a dynamic cast. 
    
    Also note that dynamic_cast only works with polymorphic class types and is evaluated at run time which makes it slower than static_cast.

    3. __Reinterpret Cast :__
          ```c++
            reinterpret<new_type> (expression)
          ```
      Used to convert a pointer of some data type into a pointer of another datatype, I would say to do unsafe conversions of pointer types to and from integer and other pointer types. Use this only if we know what we are doing and we understand the aliasing issues (i have never tried to use it before 😬)
       ```c++
      int *ptr = new int (20)
      char *ch = reinterpret_cast<char*>(ptr)
      ```
      You can notice that it does not check if the pointer type and data pointed by the pointer is same or not

    4. __Const Cast :__
          ```c++
            const_cast<new_type> (expression)
          ```
      This cast style is primarily used to add or remove the const modifier of a variable. Although const cast allows the value of a constant to be changed, doing so is still invalid code that may cause a run-time error. 
      
      This could occur for example if the constant was located in a section of read-only memory.
      ```c++
      const int myConst = 5;
      int *nonConst = const_cast<int*>(&myConst);
      ```
      Const cast is instead used mainly when there is a function that takes a non-constant pointer argument, even though it does not modify the pointer

      Note that While static_cast convert variable types of non-const to const but can't go other way around. The const_cast can do both ways. 😁 
