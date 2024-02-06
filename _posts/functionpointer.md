---
title: 'Function Pointers'
excerpt: 'Just like data pointers point to data, function pointers point to the addresses of functions. '
coverImage: '/assets/blog/funcpoint.jpg'
date: '2024-02-06T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/funcpoint.jpg'
---

> Function pointers, as their name suggests, are pointers that point to functions. 

Just like data pointers point to data, function pointers point to the addresses of functions. This capability allows us to dereference and execute these functions dynamically within our code.

we have a function:
```cpp
int foo(int a, int b) { return a * b; }
```

To make a function pointer to `foo`
```cpp
// returnType (*variableName)(parameterTypes) = functionName;
int (*var)(int, int) = foo;


// Dereferencing and Execution
// returnType result = variableName(arguments);
int result = var (1,2);

// Execution
std::cout << result;
```

It's crucial that the return types and parameter types of the function being pointed to match the declaration of the function pointer.

##### When to Use Function Pointers 

Function pointers can be incredibly useful in several programming scenarios:
1. Passing Functions as Arguments
    Function pointers enable us to pass functions into other functions to customize behavior. This technique is particularly useful in algorithms that require a specific operation to be applied, allowing for flexible and reusable code.

Example: Consider a sorting function that accepts a custom comparison function to determine the sorting order.

```cpp

#include <algorithm>
#include <vector>
#include <iostream>

bool ascending(int a, int b) {
    return a < b;
}

bool descending(int a, int b) {
    return a > b;
}

void sortVector(std::vector<int>& vec, bool (*compare)(int, int)) {
    std::sort(vec.begin(), vec.end(), compare);
}

int main() {
    std::vector<int> values = {4, 2, 5, 3, 1};
    sortVector(values, ascending);
    // values are now sorted in ascending order
}
```

2. Storing Functions in Arrays

    Storing multiple function pointers in an array can provide easy access and execution, facilitating implementations like command patterns or state machines.

Example: An array of function pointers for different operations.
```cpp
#include <iostream>

void operationA() {
    std::cout << "Performing operation A" << std::endl;
}

void operationB() {
    std::cout << "Performing operation B" << std::endl;
}

int main() {
    void (*operations[2])() = {operationA, operationB};
    for (auto& op : operations) {
        op();  // Executes each operation in the array
    }
}
```

3. Assigning Functions to Variables

    Assigning functions to variables allows for dynamic selection and execution of functions at runtime, enhancing the flexibility of your code.

Example: Dynamically choosing a function based on some condition.

```cpp
void greetMorning() {
    std::cout << "Good morning!" << std::endl;
}

void greetEvening() {
    std::cout << "Good evening!" << std::endl;
}

int main() {
    void (*greet)() = nullptr;
    // Assuming timeOfDay is determined at runtime
    int timeOfDay; 
    std::cin >> timeOfDay;
    greet = (timeOfDay < 12) ? greetMorning : greetEvening;
    greet();  // Dynamically calls the appropriate function
}
```

##### Why Use Function Pointers
the concept of function pointers might initially seem abstract or complex, but they serve several very practical and powerful purposes in programming. Understanding why you'd want to pass functions as arguments, store them in arrays, or assign them to variables can help clarify their value. Here are the key reasons:

1. Flexibility in Code Execution

    Function pointers provide the flexibility to choose which function to execute during runtime. This dynamic decision-making enables programs to respond to different conditions or user inputs more effectively. Instead of hardcoding every possible function call, you can use function pointers to select and invoke functions as needed, making your code more adaptable and scalable.
2. Customization and Reusability

    By passing functions as arguments to other functions, you can create highly customizable and reusable components. For example, a sorting function can sort data in ascending or descending order, depending on the comparison function passed to it. This approach allows you to write general-purpose functions that can handle a wide variety of behaviors, specified at the time of calling, without the need to rewrite the function logic for each new behavior.
3. Implementing Callback Mechanisms

    Function pointers are essential for implementing callback mechanisms, where a function is passed to another function or library to be called back at a later time. Callbacks are widely used in event-driven programming, such as handling user interface events, and in asynchronous programming, like completing network requests. This allows a lower-level piece of code to "call back" to higher-level code when certain events occur or tasks are completed, promoting separation of concerns and improving code organization.
4. Creating Plug-and-Play Code with Higher-Order Functions

    Higher-order functions, which can take other functions as arguments or return them, are made possible with function pointers. This concept is a cornerstone of functional programming but is also valuable in procedural and object-oriented programming. It enables the creation of flexible, plug-and-play code modules that can be easily extended or modified by passing different functions. This leads to more abstract, concise, and powerful code expressions.
5. Storing and Managing Collections of Functions

    Function pointers can be stored in arrays or other data structures, allowing you to manage collections of functions. This is particularly useful for implementing command patterns, state machines, or simply organizing a set of operations that can be dynamically chosen and executed. For instance, a game engine might store an array of function pointers representing different game states or actions, selecting and invoking the appropriate function based on the game's current state or player inputs.

**Pro tip:** Consider using `typedef` or `using`to define function pointer types. This can make complex function pointer declarations more readable and easier to work with. Also, before calling a function through a pointer, check that the pointer is not null to avoid runtime errors.

---

###### Well while function pointers is all nice it does has some limitations, 

- Function pointers can only point to C-style functions or static member functions. They cannot directly point to non-static member functions because these require an object context (this pointer)

- Function pointers must point to a function with an exact signature match. This can limit their flexibility, especially in templated code or when working with functions that have slightly different parameters or return types or even `auto` functions

Function pointers are a powerful feature in C++, enabling dynamic behavior and callback mechanisms. By following best practices and being mindful of their limitations, you can use function pointers effectively to create flexible and modular code. 
For many use cases, especially those requiring stateful callbacks or enhanced type safety, modern C++ alternatives like std::function and lambdas may offer a more robust and user-friendly solution.