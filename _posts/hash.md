---
title: 'Dependency Chains, ILP and SIMD: Building a Fast Hash'
excerpt: 'But if you want some insight into how hash algorithms work and how to make them fast, stick around'
coverImage: '/assets/blog/field1.jpeg'
date: '2026-06-05T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/field1.jpeg'
---

I tried to write my own hash algorithm to beat [xxHash](https://github.com/Cyan4973/xxHash) and agshjfirjfunfiksbdybf 😂, joking! I was not trying to beat [xxHash](https://github.com/Cyan4973/xxHash), I was just being ambitious and wanted to write my own. 

Did I beat [xxHash](https://github.com/Cyan4973/xxHash) ? Absolutely not, not even close. So if you are looking for a fast hash, just save yourself and use [xxHash](https://github.com/Cyan4973/xxHash). But if you want some insight into how hash algorithms work and how to make them fast, stick around.

---

### Why am I even writing a hash algorithm?

I decided to add one more feature to [Phanes](https://github.com/jnyfah/phanes), __finding duplicate files across a folder__. To do that I have to open, read, and compare files with one another. 

But imagine comparing 5GB files? That means reading 5GB of file A, then 5GB of file B, and comparing them byte by byte. And if we want to compare with file C and D and E... you can see where this is going. That takes a lot of memory and a lot of time.

The easy way out: hash each file down to a 64-bit integer. Comparison becomes trivial, just compare two numbers. We still have to read each file once, but only once, and we never have to hold two large files in memory at the same time.

Here is how the duplicate finder actually works. Given a folder of files:

1. Group files by size - any file with a unique size has no duplicates, discard it
2. Within each size group, hash every file
3. Re-group by hash - any group with fewer than two files, discard it
4. Whatever groups remain are sets of duplicates

The hash is the core of this. If the hash is fast, the whole thing is fast. (ignore I/O bound of reading files for now)

So let's start what we have come here to do (in Fela Kuti's voice — drum roll 🥁) — **hashing files!**

---

#### What even is a hash Algorithm?

A hash algorithm is an algorithm that takes arbitrary bytes and produces one fixed-size number. Here is the simplest possible version:

```cpp
uint64_t bad_hash(const uint8_t* data, size_t len) {
    uint64_t acc = 0;
    for (size_t i = 0; i < len; i++)
    {
        acc += data[i];
    }
    return acc;
}
```

This works in the sense that it produces a number. But it is a bad hash because a good hash needs atleast four properties, and this one only has one of them:

**1. Few collisions**: different inputs should produce different outputs. `bad_hash` fails immediately: `"ab"` hashes to `97 + 98 = 195` and `"ba"` hashes to `98 + 97 = 195`. Same result. Because addition ignores order, every anagram of the same bytes produces the same hash.

**2. Good diffusion** — every output bit should depend on every input byte. In `bad_hash`, a byte only ever nudges the low bits of the accumulator. The top bits barely move. Most of the 64 bits carry almost no information about your data.

**3. Avalanche** — small input changes should produce big output changes. Flip one bit of one byte in `bad_hash` and the output changes by exactly that one small amount. A good hash flips roughly *half* of all 64 output bits when you change a single input bit.

**4. Speed** — it has to do all of the above fast, because we are calling it on a lot of files.

`bad_hash` gets exactly one of these i.e being fast. Let's build one that gets all four.

---

#### The algorithm

The algorithm has four steps. I will build them up one at a time.

__Step 1: Initialize__

Start with one accumulator. We seed it to a non-zero value on purpose because zero is a fixed point for the operations we are about to do, 
`0 × anything = 0`, so starting at zero would produce a weak hash.

```cpp
acc = seed + PRIME_1 + PRIME_2
```

The prime constants are large odd 64-bit numbers chosen for good bit distribution. I borrowed xxHash's 😏:

```cpp
static constexpr uint64_t PRIME_1 = 0x9E3779B185EBCA87ULL;
static constexpr uint64_t PRIME_2 = 0xC2B2AE3D27D4EB4FULL;
static constexpr uint64_t PRIME_3 = 0x165667B19E3779F9ULL;
```

__Step 2: The mix operation__

Before the main loop, we need to define what "mixing" a word into the accumulator actually means. This is the core operation:

```cpp
static auto mix(uint64_t acc, uint64_t word) -> uint64_t
{
    acc ^= word * PRIME_1;       // XOR: spread the word into acc
    acc  = rotate_left(acc, 31); // rotate: pull high bits back down
    acc *= PRIME_2;              // multiply: propagate bit changes
    return acc;
}
```

Why these three operations specifically:

- **XOR** folds the word into the accumulator without losing information
- **Multiply** propagates a single bit change across many positions, carries ripple upward, so one changed bit affects many output bits
- **Rotate** pulls the high bits that multiply pushed up back down to the low end, so the next round of mixing has something to work with there

Together, a 1-bit change in the input flips roughly half the output bits. That is the avalanche property we need.

`rotate_left` is just:

```cpp
static auto rotate_left(uint64_t x, int n) -> uint64_t
{
    return (x << n) | (x >> (64 - n));
}
```

__Step 3: The main loop__

Now we can write the main loop. We read the input 8 bytes at a time and mix each word into the accumulator:

```cpp
for (size_t i = 0; i + 8 <= len; i += 8)
{
    uint64_t word;
    std::memcpy(&word, data + i, 8);  // safe unaligned load
    acc = mix(acc, word);
}
```

__Step 4: Leftovers__

After the main loop, up to 7 bytes of input remain, whatever did not fill a complete 8-byte word. We cannot ignore them. Two files that differ only in their last few bytes would hash identically, which completely breaks collision resistance.

So we fold the leftover bytes in one at a time:

```cpp
size_t tail = len - (len % 8);
for (size_t i = tail; i < len; i++)
{
    acc ^= (uint64_t)data[i] * PRIME_3;
    acc  = rotate_left(acc, 11) * PRIME_1;
}
```

__Step 5: Finalize__

After all bytes are processed we apply a final avalanche pass, three operations that smear any remaining patterns across all 64 bits:

```cpp
acc ^= acc >> 33;
acc *= PRIME_3;
acc ^= acc >> 29;
```

Return `acc`. That is your hash.

---

#### The problem: a dependency chain

We have a correct hash now. Let's see how fast it is.

| Benchmark | Time | CPU | Iterations | bytes_per_second |
| --- | --- | --- | --- | --- |
| BM_PhanesHash_1MB | 131 us | 131 us | 3836 | 7.45 Gi/s |
| BM_XXHash_1MB | 30.6 us | 30.6 us | 22950 | 31.87 Gi/s |
| BM_PhanesHash_12KB | 2.21 us | 2.21 us | 336976 | 5.18 Gi/s |
| BM_XXHash_12KB | 0.364 us | 0.364 us | 1929866 | 31.45 Gi/s |

About 4x slower than xxHash. The reason is in the main loop. Look at the dependency between iterations:

- iteration 1: acc = mix(acc, word1)  - must finish before iteration 2 starts
- iteration 2: acc = mix(acc, word2)  - depends on result of iteration 1
- iteration 3: acc = mix(acc, word3)  - depends on result of iteration 2

Every iteration is waiting for the previous one to complete because they all write to the same `acc`. The CPU cannot start work on `word2` until it has finished `word1`. Even though the CPU has multiple execution units sitting idle, it cannot use them. Each step is blocked on the last. This is called a dependency chain, and it is the critical path that limits our speed.

---

#### Breaking the chain - four accumulators

ILP stands for **Instruction Level Parallelism**. Modern CPUs can execute multiple instructions simultaneously but only if those instructions are *independent*. If instruction B depends on the result of instruction A, B has to wait. If B and C have nothing to do with A, the CPU can run all three at once.

The fix is to break the single dependency chain into four independent ones by using four accumulators:

```cpp
uint64_t acc0 = seed + PRIME_1 + PRIME_2;
uint64_t acc1 = seed + PRIME_2;
uint64_t acc2 = seed;
uint64_t acc3 = seed - PRIME_1;
```

Now the main loop processes 32 bytes at a time, feeding one 8-byte word into each accumulator:

```cpp
for (size_t i = 0; i + 32 <= len; i += 32)
{
    uint64_t word;

    std::memcpy(&word, data + i +  0, 8); acc0 = mix(acc0, word);
    std::memcpy(&word, data + i +  8, 8); acc1 = mix(acc1, word);
    std::memcpy(&word, data + i + 16, 8); acc2 = mix(acc2, word);
    std::memcpy(&word, data + i + 24, 8); acc3 = mix(acc3, word);
}
```

Each accumulator only ever touches itself:

```text
acc0 = mix(acc0, word0)  ──┐
acc1 = mix(acc1, word1)  ──┤  no dependencies between these
acc2 = mix(acc2, word2)  ──┤  CPU can run all four simultaneously
acc3 = mix(acc3, word3)  ──┘
```

At the end of the loop we merge all four down into a single value before the finalize step:

```cpp
uint64_t acc = rotate_left(acc0, 1)  + rotate_left(acc1, 7)
             + rotate_left(acc2, 12) + rotate_left(acc3, 18);
```

One detail that matters: keep the accumulators in local variables, not in the struct. If they live as `acc[4]` and you read and write them every iteration, the compiler may reload from memory each time, which quietly serializes everything again.

Load them into local variables at the top of the function, work on locals throughout the hot loop, and write back to the struct once at the end.

The result:

| Benchmark | Time | CPU | Iterations | bytes_per_second |
| --- | --- | --- | --- | --- |
| BM_PhanesHash_1MB | 53.9 us | 53.8 us | 12600 | 18.14 Gi/s |
| BM_XXHash_1MB | 31.5 us | 31.5 us | 21833 | 30.97 Gi/s |
| BM_PhanesHash_12KB | 0.642 us | 0.642 us | 1083936 | 17.83 Gi/s |
| BM_XXHash_12KB | 0.370 us | 0.370 us | 1888968 | 30.93 Gi/s |

7.45 → 18.14 Gi/s. Same math, same number of multiplies. We just stopped making the CPU wait on itself.

---

#### SIMD: one instruction, four lanes

We now have four scalar accumulators doing the same operation independently. That is exactly what SIMD is designed for.

SIMD stands for **Single Instruction, Multiple Data**. The idea is simple: instead of running the same operation four times on four separate values, pack all four values into one wide register and run the operation once. One instruction, four results.

On x86 with AVX2, the relevant types are:

- `__m128i` - 128 bits: fits two 64-bit integers, or four 32-bit integers
- `__m256i` - 256 bits: fits four 64-bit integers, or eight 32-bit integers
- `__m512i` - 512 bits (AVX-512): fits eight 64-bit integers

We want four 64-bit accumulators in one register, so we use `__m256i`. The CPU treats it as four independent 64-bit lanes, and an operation on a `__m256i` applies to all four lanes at once.

```text
__m256i:  [ lane 0 | lane 1 | lane 2 | lane 3 ]   ← four 64-bit values
            64-bit   64-bit   64-bit   64-bit
```

So instead of:

```text
scalar:                      SIMD:
acc0 = mix(acc0, w0)
acc1 = mix(acc1, w1)   →    acc_vec = mix(acc_vec, w_vec)
acc2 = mix(acc2, w2)        one instruction touches all four lanes
acc3 = mix(acc3, w3)
```

The four scalar accumulators become one `__m256i`. The four scalar mix calls become one SIMD mix call. The ILP is still there — we still have four independent `__m256i` accumulators to avoid the dependency chain, but now each of those accumulators is operating on four 64-bit lanes at once instead of one.

Some of the intrinsics we use:

- `_mm256_loadu_si256` — load 32 bytes from memory into a `__m256i`
- `_mm256_xor_si256` — XOR all four lanes simultaneously
- `_mm256_slli_epi64` — shift left across all four 64-bit lanes
- `_mm256_srli_epi64` — shift right across all four 64-bit lanes


**AVX2 has no native 64-bit multiply**

This is the most frustrating constraint. AVX2 gives you `_mm256_mul_epu32`, which multiplies 32-bit values and returns 64-bit results. It does not give you a 64-bit × 64-bit to 64-bit multiply at all, for any register width 64-bit SIMD multiply was simply never added to the instruction set (AVX-512 still doesn't have it either).

But our `mix` multiplies 64-bit accumulators by 64-bit prime constants. So we have to build the 64-bit multiply ourselves out of the 32-bit pieces we do have.

Think of it like multiplying two two-digit numbers by hand. To compute `37 × 52` you break it into `(30 + 7) × (50 + 2)` four partial products that you shift and add. Same idea here, except each "digit" is 32 bits wide instead of decimal. Split the value `v` and the constant `c` each into a low and high 32-bit half:

```text
v × c = (v_lo × c_lo)
      + (v_lo × c_hi) × 2^32
      + (v_hi × c_lo) × 2^32
      + (v_hi × c_hi) × 2^64   ← overflows past 64 bits, discard it
```

We only keep the low 64 bits of the result, so the last term disappears. That leaves three 32-bit multiplies, two shifts, and two adds:

```cpp
static auto mul64(__m256i v, __m256i c_lo, __m256i c_hi) -> __m256i
{
    const __m256i mask32 = _mm256_set1_epi64x(0xFFFFFFFF);

    __m256i v_lo = _mm256_and_si256(v, mask32);  // low  32 bits of v
    __m256i v_hi = _mm256_srli_epi64(v, 32);     // high 32 bits of v

    __m256i ll = _mm256_mul_epu32(v_lo, c_lo);   // v_lo × c_lo
    __m256i hl = _mm256_mul_epu32(v_hi, c_lo);   // v_hi × c_lo
    __m256i lh = _mm256_mul_epu32(v_lo, c_hi);   // v_lo × c_hi

    // shift the cross terms up by 32 and add them in
    __m256i cross = _mm256_slli_epi64(
                        _mm256_add_epi64(hl, lh), 32);

    return _mm256_add_epi64(ll, cross);
}
```




So one `acc × PRIME` that costs one instruction in the scalar version now costs roughly six vector instructions here. That is the tax for building an algorithm around 64-bit multiplication and then trying to lift it to a CPU that does not have it 🥲.

This is also where xxHash3 pulls away. Looking at its AVX2 source, the mixing in the SIMD path is entirely different from its scalar path, no prime multiplication at all. Instead it XORs the input against a secret key, then uses `_mm256_mul_epu32` directly on the two 32-bit halves of each lane. 

The whole operation is XOR, shift, 32-bit multiply, add. It never needs a 64-bit multiply because the algorithm was designed from the start around what the hardware actually gives you cheaply.

We built our hash inspired by xxHash64's scalar design and inherited its constraints when moving to SIMD. xxHash3 was written natively for the instruction set from day one.

The SIMD mix ties it all together:

```cpp
static auto mix(__m256i acc, __m256i word,
                __m256i p1_lo, __m256i p1_hi,
                __m256i p2_lo, __m256i p2_hi) -> __m256i
{
    acc = _mm256_xor_si256(acc, mul64(word, p1_lo, p1_hi));
    acc = rotate_left(acc, 31);
    acc = mul64(acc, p2_lo, p2_hi);
    return acc;
}
```

Same three operations as the scalar mix - XOR, rotate, multiply, just operating on four 64-bit lanes at once.


And the result:
| Benchmark | Time | CPU | Iterations | bytes_per_second |
| --- | --- | --- | --- | --- |
| BM_PhanesHash_1MB | 46.5 us | 46.5 us | 15252 | 21.01 Gi/s |
| BM_XXHash_1MB | 31.5 us | 31.5 us | 21833 | 30.97 Gi/s |
| BM_PhanesHash_12KB | 0.541 us | 0.541 us | 1271822 | 21.14 Gi/s |
| BM_XXHash_12KB | 0.370 us | 0.370 us | 1888968 | 30.93 Gi/s |

21 Gi/s about 68% of xxHash, with a hash I wrote and actually understand.

The full journey: **7.45 - 18.14 - 21.01 Gi/s**.

---

## But one thing though

Don't let the Linux benchmark fool you into thinking this is close to xxHash, because on MSVC windows my hash performs noticeably worse about 11.7 Gi/s 😂 while xxHash stays consistent. There are cross-platform SIMD headaches I did not fully solve, and xxHash is a serious battle-tested library tuned by people who do this for a living. 🤪

But that was the entire point not to win, but to actually understand *why* xxHash looks the way it does: why it uses multiple accumulators, why the constants are those specific numbers, why it leans on exactly the multiply the hardware gives you and learning !

The full code is all in [Phanes](https://github.com/jnyfah/phanes).

Next up I want to profile this with `perf` and watch the hardware counters either confirm or completely destroy my story about dependency chains and execution ports. 🙂