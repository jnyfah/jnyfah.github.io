---
title: 'Outreachy- Think about my Audience- Introducing Enarx'
excerpt: ' Running an application in the TEE is not that simple as there are different silicon vendors with different TEE, that means you have to develop your application specific to that platform, which means no portability'
coverImage: '/assets/blog/enarx.png'
date: '2022-01-03T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: '/assets/blog/enarx.png'
---

> Enarx is a framework for deploying or running TEE's instances without the need to rewrite application or implement attestation differently

You might wonder what are TEE's, TEE stands for "Trusted Execution Environment", it is a secure area in the main processor and guaranteed that data and and code loaded into it are protected with respect to confidentiality and integrity, for more info check [the Enarx official website](https://enarx.dev/)



## What Is Enarx For?

To understand Enarx purpose you first have to understand what confidential computing is, it is simply the protection of data in use by performing computation in hardware based Trusted Execution Environments (TEE), so Enarx is one of the projects under confidential computing that aim to simplify the deployment of your workload into the TEE from various silicon vendors. To learn more about Confidential Computing and TEE's check out the [official website](https://confidentialcomputing.io/) or visit my blog post on [C3](https://jenniferchukwu.com/posts/confidentialcomputing) and [TEE's](https://jenniferchukwu.com/posts/trustedexecution)


### What Problem Does Enarx Solve?
When you run workload on a system on the cloud or on local device, there are lots and lots of layers with probably different owners as shown in the figure below, from hardware vendors to Cloud Service Providers  to middleware vendors to Operating System vendors to application vendors to you, the workload owner. This means you need to trust every single layer, and the owner of every single layer, not only to do what they say they will do, but also not to be compromised.  This is a big stretch when it comes to running sensitive workloads. So here is where Enarx comes in. Enarx is a project which is trying to address this problem of having to trust all of 
those layers with the help of Trusted Execution Environments, you can read more on [Mike Bursell's articles](https://aliceevebob.com/2019/05/07/announcing-enarx/).

<table cellpadding="35" cellspacing="35">
  <tr>
    <td><img src="/assets/blog/classic-cloud-virt-arch-1.png" width=270 height=480></td>
    <td><img src="/assets/blog/reduced-arch.png" width=270 height=480></td>
  </tr>
 </table>



Running an application in TEE's is not that simple as there are different silicon vendors with different TEE's that means you need to develop you application specific to that platform, which means no portability. Enarx to the rescue! Enarx also solves this problem by letting you set you compiled target to web assembly (a portable compilation target for running applications in the browser) we use WASI, a we assembly system interface that allows we assembly outside oth the browser, check out demos created by outreachy applicants on how to compile different programming languages to WASI [here](https://enarx.dev/docs/WebAssembly/Introduction)


### How Does Enarx Accomplish Its Goals?
Enarx accomplishes its goals with the help of TEE's and web assembly as earlier stated. Read more on [Mike Brusell's Blog Post](https://aliceevebob.com/2020/04/28/an-enarx-milestone-binaries/)

![image](/assets/blog/enarx-general-arch.webp)