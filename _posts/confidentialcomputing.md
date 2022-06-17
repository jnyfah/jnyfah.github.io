---
title: 'Confidential Computing Consortium'
excerpt: 'Who are they ??,  Why do they do it ??, okay wait I know you are confused 😂, Hold on, I will explain in a minute 😁'
coverImage: '/assets/blog/Capture3.JPG'
date: '2021-12-18T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage:
  url: 'assets/blog/Capture3.JPG'
---

## Confidential Computing Consortium 🕵

-   Who are they ??
-   What do they do ??
-   Why do they do it ??
-   and how do they do it ??

You will be able to answer these question once you are half way on this post 😁

The Confidential Computing Consortium is a Community focused on open source licensed projects securing data in use by performing computation in hardware based Trusted Execution Environments (TEE) and accelerating the adoption of confidential computing through open collaboration.

okay wait I know you are confused 😂, like what the heck is a Trusted Execution Environment and data in use, what does it all mean ???

![C3](/assets/blog/UKe.gif)

Hold on, I will explain in a minute 😁

In computing, data exists in three states: _in transit_, _at rest_, and _in use_. Data traversing the network is "in transit," data in storage is "at rest,"" and data being processed is "in use." In a world where we are constantly storing, consuming, and sharing sensitive data - from credit card data to medical records, from firewall configurations to our geolocation data - protecting sensitive data in all of its states is more critical than ever.

-   Data at rest - inactive data is encrypted when stored in a blob storage or database.

-   Data in transit - Data traveling from network to network or from local storage to cloud storage is protected using https or TLS.

-   Data in use - ????? 😕i.e protect data in use while in ram or during computation.

_I know what you are thinking ... why do we have to protect data in use_ 😐

Lets imagine storing you data in cloud, since we all know data at rest is encrypted you are safe, but imagine you want to process the data in the cloud, you would have to decrypt it while its in the cloud because you clearly cant work with an encrypted data 🙆, so yea the data is now in a vulnerable state!

A perfect scenario of this would be mobile, edge, and IoT devices - where processing takes place in remote. some common threats include:
Malicious privileged admins
Hackers exploiting bugs in the infrastructure
Third party access without customer consent

## So What are Trusted Execution Environments ?🔐

A Trusted Execution Environment (TEE) is a secure area inside the main processor that provides a level of assurance of data integrity, data confidentiality, and code integrity. A hardware-based TEE uses hardware backed techniques to provide increased security guarantees for the execution of code and protection of data within that environment

Unauthorized entities in the context of confidential computing could include other apps on the host, the host operating system, the hypervisor, system administrators, service providers, and the general public

-   🔍 **Data confidentiality** - implies that unauthorized persons are not permitted to examine data while it is in use within the TEE.

-   🔏 **Data integrity**- refers to the prevention of unauthorized individuals from modifying data while it is being handled by any entity outside the TEE.

-   🔑**Code integrity** - refers to the fact that unauthorized entities cannot replace or modify the code in the TEE.

Together, these attributes provide not only an assurance that the data is kept secure, but also that the computations performed are actually the correct computations, allowing one to trust the results of the computation as well. More on [Trusted Execution Environments here](http://jenniferchukwu.com/posts/trustedexecution)

## Why use confidential computing 🙋

-   🔌 To collaborate securely with partners on new cloud solutions - For example, one company's team can combine its sensitive data with another company's proprietary calculations to create new solutions - without either company sharing any data or intellectual property that it doesn't want to share.

-   🚫 To protect data processed at the edge - Edge computing is a distributed computing framework that brings enterprise applications closer to data sources such as IoT devices or local edge servers. When this framework is used as part of distributed cloud patterns, the data and application at edge nodes can be protected with confidential computing

-   🚀 To protect sensitive data, even while in use — and to extend cloud computing benefits to sensitive workloads. When used together with data encryption at rest and in transit with exclusive control of keys, confidential computing eliminates the single largest barrier to moving sensitive or highly regulated data sets and application workloads from an inflexible, expensive on-premises IT infrastructure to a more flexible and modern public cloud platform

-   🔦 To protect intellectual property. Confidential computing isn't just for data protection - The TEE can also be used to protect proprietary business logic, analytics functions, machine learning algorithms, or entire applications.

## Use Cases

-   IOT and Edge
-   BlockChain
-   Payment Process
-   Keys, secrets and tokens
-   Personal User data

## Projects under confidential computing include:

-   [Enarx](https://enarx.dev/): a framework for running applications in TEE instances
-   [Open Enclave SDK](https://openenclave.io/sdk/): an open source SDK targeted at creating a single unified enclaving abstraction for developer to build Trusted Execution Environment (TEEs) based applications
-   [Occlum](https://occlum.io/): makes running applications inside enclaves easy
-   [Gramine](https://grapheneproject.io/) can serve as a compatibility layer on other platforms

You can see more at [Confidential Computing Consortium](https://confidentialcomputing.io/)

![C3](/assets/blog/Captured.JPG)
