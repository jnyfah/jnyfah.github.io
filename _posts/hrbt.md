---
title: 'Lambda in Cpp'
excerpt: 'Think of lambdas as a shorthand for writing a functor without needing to define a struct or class'
coverImage: '/assets/blog/hrbt.jpeg'
date: '2025-07-05T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/hrbt.jpeg'
---


To understand quaternions, you first need to understand vectors and matrices, especially matrices because quaternions complement matrices by solving problems that arise when using matrices to represent rotations.

Don’t get me wrong: matrices are awesome. They work great for most transformations like rotations and translations especially in 2D and 3D scenarios like physics simulations, computer graphics, or games. But when it comes to smooth interpolation and using euler angles matrices has it down sides.

---
Okay lets rewind back a bit and run through the basics to understand better

A vector like `(2, 3, 4)` represents a point in 3D space as we all know and this basically means the object is 2 units along the X-axis, 3 units along Y, and 4 along Z. 

To rotate the vector, we have to compose rotation matrices for X, Y, and Z into a single matrix by multiplying them in a specific order: Rz * Ry * Rx.

![mov](/assets/blog/cube_rotation.gif)

```js
     [1     0      0  ]              [cosθ   0   -sinθ]             [cosθ  -sinθ    0] 
Rx = [1   cosθ   -sinθ]         Ry = [  0    1       0]        Rz = [sinθ   cosθ    0] 
     [0   sinθ    cosθ]​              [-sinθ  0    cosθ]             [0       0      1] 

     R=Rz​(ψ)⋅Ry​(θ)⋅Rx​(ϕ)

     Vrotated​=R⋅v
```
But manually building these 3 rotation matrices each time is tedious and error-prone, and also order matters since matrix multiplication is not commutative: `A * B ≠ B * A`.

So to ease things, we have Euler angles.

Euler angles make this easier: they give us a shorthand using three angles (pitch, yaw, roll) representing rotation around the X, Y, and Z axes. They are human-friendly and intuitive, but under the hood, they are always converted into rotation matrices to actually perform the transformation.

```js
Euler(30°, 45°, 0°)
This means:

    Rotate 30° around the X-axis (pitch),

    then 45° around the Y-axis (yaw),

    then 0° around the Z-axis (roll).

This triple is enough to build the full rotation matrix Rz * Ry * Rx — just plug the angles into the formulas.
```

While Euler angles are great for describing rotations around the standard X, Y, and Z axes, they don't easily capture a different kind of rotation: spinning around an arbitrary axis. That’s where axis-angle rotation comes in. Instead of rotating step-by-step around each axis like Euler does, axis-angle lets you rotate once around a custom direction in space. It’s a powerful way to describe rotation around any axis—not just the fixed X, Y, or Z.

It’s like saying, rotate 60° around the axis pointing in the direction of (1, 1, 0) a diagonal between X and Y

![mov](/assets/blog/axis_angle_rotation.gif)

```js
Axis: (1, 1, 0) → Normalized to (0.707, 0.707, 0)
Angle: 60°

This means: rotate the object 60° around the axis pointing diagonally between X and Y. But even axis-angle has limitations, especially when combining rotations or animating smoothly.
```
---
Okay enough of matrixes, if they are so great why then do we need quaternions and what are even quaternions 

Quaternions are a mathematical way of representing rotation in 3D space (more on than soon), like Euler angles and rotation matrices but they do it more robustly. They solve two big problems: gimbal lock and smooth interpolation.

1. GImbal Lock: is a problem that occurs with Euler angles. Gimbal lock happens when two of the three rotation axes in Euler become aligned, essentially collapsing a degree of freedom. Imagine trying to look up at the ceiling (pitch 90°), and then turning your head left or right (yaw) does nothing — it’s like you lost one axis of rotation. That’s gimbal lock.

You might say, “Just use axis-angle with matrices to avoid gimbal lock.” Sure, axis-angle avoids that specific issue in theory, but the moment you start combining rotations or chaining them (e.g., for animation), things get messy — especially when trying to interpolate between them.

[More on Gimbal here]()

2. Smooth Interpolation: Say you have an object facing direction A, and you want it to rotate smoothly to direction B over a few seconds (like a character turning their head or a spaceship reorienting in space). Interpolating between two Euler angles or rotation matrices often leads to weird artifacts — like unintended wobbling or non-linear speeds. Even axis-angle interpolation can behave strangely. Quaternions, however, use something called SLERP (Spherical Linear Interpolation), which gives smooth, constant-speed rotation between two orientations 


so how do Quaternions work 

You can think of a quaternion as a 4D number that encodes both the axis of rotation and the angle of rotation — all in one neat package:
```ini
q = [x, y, z, w]
```
Where:

    (x, y, z) is a unit vector pointing along the rotation axis,

    w is the cosine of half the rotation angle.

It might feel weird at first because you don’t apply quaternions by just plugging them into a formula like matrices

remember axis of rotation can be the x axis, y axis , ibetween or custom 

To rotate a 3D point v using a quaternion q:

    Convert the point into a pure quaternion: v_quat = [vx, vy, vz, 0]

    Apply the rotation:

    v_rotated = q × v_quat × q⁻¹

    (Here, × means quaternion multiplication, and q⁻¹ is the inverse of q.)

Yes, it looks mathy, but under the hood, libraries like Unity, Unreal, or OpenGL handle this for you.

trust me most times you dont really need to use quaternions but even if you do you can always convert your euler to quat do the interpolations and what not and convert back to euler