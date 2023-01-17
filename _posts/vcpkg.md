---
title: '[vcpkg] Add new Port'
excerpt: 'It is also worth noting that package managers typically provide more features and automation than Git submodules. For example, package managers can handle dependency resolution, version management, and building and installing libraries'
coverImage: '/assets/blog/vcpkg.jpg'
date: '2023-01-04T11:37:01.491Z'
author:
  name: Jennifer
  picture: '/assets/blog/authors/avatar.jpg'
ogImage: '/assets/blog/vcpkg.jpg'

---

Are you tired of struggling to set up and manage your C++ dependencies? Look no further, because vcpkg is here to save the day!

What is vcpkg, you ask? It's a cross-platform package manager for C++ libraries, developed and maintained by Microsoft. With vcpkg, you can easily install and manage your C++ dependencies, saving you time and hassle.

One of the best things about vcpkg is that it's super easy to use. Just run a simple command to install the libraries you need, and vcpkg takes care of the rest. It will automatically download the source code, build the library, and install it on your machine. No more manually downloading and building libraries – vcpkg makes it all super simple.

But vcpkg isn't just for installing libraries – it's also great for creating and distributing your own libraries. With vcpkg, you can easily create a "portfile" that contains the instructions for building and installing your library. Then, other developers can use vcpkg to easily install your library on their own machines. It's a win-win!

But then why package managers like vcpkg and conan when you can easily use gitsubmodules, well it just depends on your preferences, package managers are better suited for managing third-party dependencies that are distributed as pre-built binaries or libraries. Git submodules are more suited for managing dependencies that are stored in Git repositories and that you want to include in your repository as source code.

It's also worth noting that package managers typically provide more features and automation than Git submodules. For example, package managers can handle dependency resolution, version management, and building and installing libraries. Git submodules, on the other hand, simply track specific commits in other repositories and do not provide these additional features.

Before we get started, make sure you have forked vcpkg and installed on your machine. If you don't, you can find the instructions to install vcpkg on your machine [here](https://github.com/microsoft/vcpkg#getting-started)

Now, let's get to it!

##### Step 1: Choose your library
The first step to creating a new vcpkg package is to choose the library that you want to package. This could be a library that you've developed yourself, or a third-party library that you want to make easier for others to use. I am going to package [Scenepic](https://github.com/microsoft/scenepic), a visualization toolkit for mixed 3D and 2D content to Vcpkg

##### Step 2: Check if the library is already available
Before you start creating a new package, it's a good idea to check if the library you want to package is already available in vcpkg. You can do this by running the following command:
```c
PS D:\src\vcpkg> ./vcpkg search <library name>
```
##### Step 3: Add Library to Baseline
In vcpkg, the `baseline.json` file is used to store the current state of a vcpkg installation. It is a JSON file that contains a list of all the installed libraries, their versions, and other metadata. The baseline.json file is located in the root of the `versions` directory of the vcpkg folder and is updated following the alphabetical order whenever a library is installed or removed using vcpkg. To add `scenepic`, we will add the following code to `baseline.json`

```json
"scenepic": {
  "baseline": "1.0.16",
  "port-version": 0
  }
```
##### Step 4: Specify the version of your library
Every port’s version data lives in its own file `versions/[firstcharacter]-/[portname].json`. For example, the version data for scenepic would live in `versions/s-/scenepic.json`
```json
{
  "versions": [
    {
      "git-tree": "",
      "version": "1.0.16",
      "port-version": 0
    }
  ]
}
```
To get the git tree, do the following but do not push 
```git
PS D:\src\vcpkg> git add ports/scenepic
PS D:\src\vcpkg> git commit -m "[scenepic] new port"
PS D:\src\vcpkg> git rev-parse HEAD:ports/scenepic
```


##### Step 5: Create a vcpkg port for your library
In the ports directory, create a folder with `package name`, mine is `scenepic` and create two files `portfile.cmake` and `vcpkg.json` 

The `vcpkg.json` file is the manifest file describing the ports's metadata as shown
```json
{
  "name": "scenepic",
  "version": "1.0.16",
  "description": "A Powerful, easy to use, and portable visualization toolkit for mixed 3D and 2D content",
  "homepage": "https://microsoft.github.io/scenepic/",
  "license": "MIT",
  "dependencies": [
    "eigen3",
    {
      "name": "vcpkg-cmake",
      "host": true
    },
    {
      "name": "vcpkg-cmake-config",
      "host": true
    }
  ]
}
```
it also contains array of ports the library has a dependency on, the scenepic library depends on eigen which is already a vcpkg package. To read more on `vcpkg.json` file check [here](https://vcpkg.io/en/docs/maintainers/manifest-files.html)

The `portfile.cmake` on the other hand contains the instructions for downloading, building and installing your library using vcpkg 

```cmake
vcpkg_minimum_required(VERSION 2022-10-12) # for ${VERSION}

vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO  microsoft/scenepic 
    REF "v${VERSION}"
    SHA512 2d9dfcefa7a054cf0addb12113ab65cb7dd3a8a6f7b42f60558a5d47a6de45a9e801be3266b81358ff8ac075dd9e9e2b9369905d62f2383531d6e28e93406ac9
    HEAD_REF main
)
```
The `vcpkg_from_github` function is used to download the source code for the "scenepic" library from GitHub. It specifies the URL of the GitHub repository  and the Git reference that should be used to download the source code. 

The `SHA512` parameter specifies the expected hash of the downloaded source code, you can get this easily by setting it to 0, trying to install the package, then copy the correct checksum and the `HEAD_REF` parameter specifies the Git branch or reference that should be used.

```cmake
# Run npm install and npm run build on the cloned project    
execute_process(
    COMMAND npm install
    WORKING_DIRECTORY ${SOURCE_PATH}
)
execute_process(
    COMMAND npm run build
    WORKING_DIRECTORY ${SOURCE_PATH}
)
 ```
 The core library portion of `scenepic` is written in TypeScript which needs compiling to JavaScript. So we have to install and build node_module dependencies

```cmake
vcpkg_cmake_configure(
    SOURCE_PATH "${SOURCE_PATH}"
    OPTIONS
        -DCPP_TARGETS=cpp
 

vcpkg_cmake_install()
vcpkg_fixup_pkgconfig()
```
The `vcpkg_cmake_configure` function is used to configure the library using CMake, the options can include setting the CMake build type to Release, specifying the vcpkg target triplet, disabling the build of shared libraries, and specifying the C++ targets.

The `vcpkg_cmake_install` function is used to build and install the library using CMake. It does not take any arguments and simply runs the install target in CMake to build and install the library. The `vcpkg_fixup_pkgconfig` function is used to fix up the `.pc` files that are generated by the build.
  
```cmake
vcpkg_cmake_config_fixup(CONFIG_PATH cmake)

file(INSTALL ${SOURCE_PATH}/LICENSE DESTINATION ${CURRENT_PACKAGES_DIR}/share/${PORT} RENAME copyright)
file(COPY ${CURRENT_PACKAGES_DIR}/build DESTINATION ${CURRENT_PACKAGES_DIR}/share)

file(REMOVE_RECURSE ${CURRENT_PACKAGES_DIR}/debug
                    ${CURRENT_PACKAGES_DIR}/README.md
                    ${CURRENT_PACKAGES_DIR}/CHANGELOG.md
                    ${CURRENT_PACKAGES_DIR}/cmake
                    ${CURRENT_PACKAGES_DIR}/build)
```

The `vcpkg_cmake_config_fixup` function is used to fix up the CMake configuration files for the library. This function is typically used to modify the CMake configuration files to use the correct paths and settings for the installed library files, as specified by vcpkg.

The next three `file` functions are used to install, copy, and remove various files and directories as part of the library installation process.

##### Step 6: Build and Install
To install your new file 
```git
PS D:\src\vcpkg> ./vcpkg install scenepic
```

---

Well, with all this our file will still fail, why ??? because our scenepic's [cmake file](https://github.com/microsoft/scenepic/blob/main/CMakeLists.txt) contains `fetchContent` which is not allowed in vcpkg because vcpkg already provides its own mechanisms for downloading and installing external libraries, and again the external library we want to use is `eigen3.4`  which already exists as a vcpkg library.

To solve this we have to create a patch to improve code compatibility since `fetchcontent` is not allowed in vcpkg, to create a patch file using git

```ps
PS D:\src\vcpkg\buildtrees\scenepic\src\v1.0.16-6e9f877aa2.clean> git init .

PS D:\src\vcpkg\buildtrees\scenepic\src\v1.0.16-6e9f877aa2.clean> git add .

PS D:\src\vcpkg\buildtrees\scenepic\src\v1.0.16-6e9f877aa2.clean> git commit -m "patch"
```
Then we modify the `CMakeLists.txt` file located at `D:\src\vcpkg\buildtrees\scenepic\src\v1.0.16-6e9f877aa2.clean\CMakeLists.txt` by removing the fetchContent codes and replacing it with the `find package` function modifying the way that the Eigen library is being included in the project.

To save the patch
```PS
PS D:\src\vcpkg\buildtrees\scenepic\src\v1.0.16-6e9f877aa2.clean> git diff --ignore-space-at-eol | out-file -enc ascii ..\..\..\..\ports\scenepic\fix_dependencies.patch
```
The output will be a `fix_dependencies.patch` file located in your package port folder. This is what the patch file looks like 

```patch
diff --git a/CMakeLists.txt b/CMakeLists.txt
index a2db3db..a10a942 100644
--- a/CMakeLists.txt
+++ b/CMakeLists.txt
@@ -100,13 +100,11 @@ FetchContent_Declare(
 
 set(CMAKE_POLICY_DEFAULT_CMP0077 NEW) 
 
-if(NOT TARGET Eigen3::Eigen)
-  FetchContent_GetProperties(eigen)
-  if(NOT eigen_POPULATED)
-    FetchContent_Populate(eigen)
-    set( BUILD_TESTING OFF )
-    add_subdirectory(${eigen_SOURCE_DIR} ${eigen_BINARY_DIR} EXCLUDE_FROM_ALL)
-  endif()
+find_package(Eigen3 3.4.0 REQUIRED)
+
+if(Eigen3_FOUND)
+  set( BUILD_TESTING OFF )
+  include_directories(${EIGEN3_INCLUDE_DIR})
   if(NOT TARGET Eigen3::Eigen)
     add_library(Eigen3::Eigen ALIAS eigen)
   endif()
```

Finally, we need to apply the patch after extracting the source, this is what the final scenepic's `portfile.cmake` looks like

```cmake
vcpkg_check_linkage(ONLY_STATIC_LIBRARY)
vcpkg_minimum_required(VERSION 2022-10-12) # for ${VERSION}

vcpkg_from_github(
    OUT_SOURCE_PATH SOURCE_PATH
    REPO  microsoft/scenepic 
    REF "v${VERSION}"
    SHA512 2d9dfcefa7a054cf0addb12113ab65cb7dd3a8a6f7b42f60558a5d47a6de45a9e801be3266b81358ff8ac075dd9e9e2b9369905d62f2383531d6e28e93406ac9
    HEAD_REF main
    PATCHES
        "fix_dependencies.patch"
        "fix-CMakeInstall.patch"
)

# Run npm install and npm run build on the cloned project    
execute_process(
    COMMAND npm install
    WORKING_DIRECTORY "${SOURCE_PATH}"
)
execute_process(
    COMMAND npm run build
    WORKING_DIRECTORY "${SOURCE_PATH}"
)

vcpkg_cmake_configure(
    SOURCE_PATH "${SOURCE_PATH}"
    OPTIONS
        -DCPP_TARGETS=cpp
)   
  
vcpkg_cmake_install()
vcpkg_fixup_pkgconfig()

vcpkg_cmake_config_fixup(CONFIG_PATH cmake)

vcpkg_install_copyright(FILE_LIST "${SOURCE_PATH}/LICENSE")

file(REMOVE_RECURSE "${CURRENT_PACKAGES_DIR}/debug/README.md"
                    "${CURRENT_PACKAGES_DIR}/debug/CHANGELOG.md"
                    "${CURRENT_PACKAGES_DIR}/README.md"
                    "${CURRENT_PACKAGES_DIR}/CHANGELOG.md"
                    "${CURRENT_PACKAGES_DIR}/debug/include")


```

To be completely sure this works from scratch, we need to remove the package and rebuild it:

```git 
PS D:\src\vcpkg> ./vcpkg remove scenepic
PS D:\src\vcpkg> ./vcpkg install scenepic
```
Finally, you can commit and create a pull-request, to have you port merged! 

you can check our scenepic's [pull request](https://github.com/microsoft/vcpkg/pull/28661)

If you're a C++ developer, you really can't afford to not have vcpkg in your toolkit. It will save you time and headaches, and make it easier to use the libraries you need. So why wait? Head on over to the vcpkg GitHub page and give it a try!

---
### Integration
Vcpkg packages can be integrated with buildsystems like CMake and msbuild or even manually. Learn more here:

[CMake with vcpkg](https://youtu.be/Y7d42_MbhKo)

[msbuild with vcpkg](https://youtu.be/0h1lC3QHLHU)

[Manage code dependencies at work with new vcpkg features](https://youtu.be/3vXOKkv3ND0)