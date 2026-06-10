# 算法入门手册 – JavaScript 示例

大家好！在这篇文章中，我们将深入了解算法，这是计算机科学和软件开发中的核心主题。

算法是一个听起来可能很花哨、有时令人畏惧，而且经常被误解的词。它听起来像是某种非常困难和复杂的东西，但实际上，它只是一组为了实现特定目标而需要采取的步骤。

我认为关于算法的基础知识主要包括两个方面：

- 渐近记法（我们用它来比较一个算法与另一个算法的性能）
- 用于非常常见任务的经典算法的一般知识，例如搜索、排序和遍历

这正是我们要在这里看到的内容。😉

让我们开始吧！

## 目录

- [什么是算法？](#什么是算法)
- [算法复杂度](#算法复杂度)
- [搜索算法](#搜索算法)
  - [线性搜索](#线性搜索)
  - [二分搜索](#二分搜索)
- [排序算法](#排序算法)
  - [冒泡排序](#冒泡排序)
  - [选择排序](#选择排序)
  - [插入排序](#插入排序)
  - [归并排序](#归并排序)
  - [快速排序](#快速排序)
  - [基数排序](#基数排序)
- [遍历算法](#遍历算法)
  - [广度优先搜索 (BFS)](#广度优先搜索-bfs)
  - [深度优先搜索 (DFS)](#深度优先搜索-dfs)
    - [前序 DFS](#前序-dfs)
    - [后序 DFS](#后序-dfs)
    - [中序 DFS](#中序-dfs)
- [总结](#总结)

# 什么是算法？

如前所述，算法只是一组为了实现特定目标而需要采取的步骤。

我发现当人们第一次听到"算法"这个词时，他们可能会想象出这样的场景...

*《黑客帝国》或《机器人先生》中的场景*

但实际上，这样的画面会更准确...

*一本食谱*

算法就像食谱一样，因为它会指示实现目标所需遵循的必要步骤。

制作面包的食谱可能是这样的：

```
1- 混合面粉、盐、水和酵母
2- 让面团发酵
3- 放入烤箱 30 分钟
4- 冷却并享用
```

顺便说一句：希望你欣赏我同时教你编程和烹饪，而且完全免费。😜

用于确定一个单词是否是回文串的算法可能是这样的：

```javascript
function isPalindrome(word) {
    // 步骤 1- 在单词的每一端放置一个指针
    // 步骤 2 - "向内"迭代字符串
    // 步骤 3 - 在每次迭代中，检查指针是否表示相等的值
    // 如果不满足此条件，则该单词不是回文串
    let left = 0
    let right = word.length-1

    while (left < right) {
        if (word[left] !== word[right]) return false
        left++
        right--
    }

    return true
}

isPalindrome("neuquen") // true
isPalindrome("Buenos Aires") // false
```

就像食谱一样，在这个算法中，我们有一系列具有特定目的的步骤，按照给定顺序执行以实现我们想要的结果。

根据维基百科：

> 算法是一组有限、明确说明的指令，通常用于解决一类特定问题或执行计算。

# 算法复杂度

现在我们知道了什么是算法，让我们学习如何比较不同的算法。

假设我们遇到了这个问题：

> 编写一个函数，它接受两个参数：一个非空的不同整数数组和一个表示目标和的整数。如果数组中任何两个数字加起来等于目标和，该函数应该将它们作为数组返回。如果没有两个数字加起来等于目标和，该函数应该返回一个空数组。

这可能是该问题的有效解决方案：

```javascript
function twoNumberSum(array, targetSum) {
    let result = []
    // 我们使用嵌套循环来测试数组中每种可能的数字组合
    for (let i = 0; i < array.length; i++) {
        for (let j = i+1; j < array.length; j++) {
            // 如果我们找到正确的组合，就将两个值都推入结果数组并返回
            if (array[i] + array[j] === targetSum) {
                result.push(array[i])
                result.push(array[j])
                return result
            }
        }
    }
    // 返回结果数组
    return result
}

console.log(twoNumberSum([9,1,3,4,5], 6)) // [1,5]
console.log(twoNumberSum([1,2,3,4,5], 10)) // []
```

这可能是另一个有效的解决方案：

```javascript
function twoNumberSum(array, targetSum) {
    // 对数组进行排序，并在每个极端处用一个指针进行迭代
    // 在每次迭代中，检查两个指针的总和是否大于或小于目标
    // 如果更大，将右指针向左移动
    // 如果更小，将左指针向右移动
    let sortedArray = array.sort((a,b) => a-b)
    let leftLimit = 0
    let rightLimit = sortedArray.length-1

    while (leftLimit < rightLimit) {
        const currentSum = sortedArray[leftLimit] + sortedArray[rightLimit]

        if (currentSum === targetSum) return [sortedArray[leftLimit], sortedArray[rightLimit]]
        else currentSum < targetSum ? leftLimit++ : rightLimit--
    }

    return []
}

console.log(twoNumberSum([9,1,3,4,5], 6)) // [1,5]
console.log(twoNumberSum([1,2,3,4,5], 10)) // []
```

这可能是另一个有效的解决方案：

```javascript
function twoNumberSum(array, targetSum) {
    // 迭代数组一次，在每次迭代时
    // 检查达到目标所需的数字是否存在于数组中
    // 如果存在，返回其索引和当前数字的索引
    let result = []

    for (let i = 0; i < array.length; i++) {
        let desiredNumber = targetSum - array[i]
        if (array.indexOf(desiredNumber) !== -1 && array.indexOf(desiredNumber) !== i) {
            result.push(array[i])
            result.push(array[array.indexOf(desiredNumber)])
            break
        }
    }

    return result
}

console.log(twoNumberSum([9,1,3,4,5], 6)) // [1,5]
console.log(twoNumberSum([1,2,3,4,5], 10)) // []
```

那么我们如何比较哪个解决方案更好呢？它们都实现了目标，对吧？

但是除了**有效性**（是否实现了目标）之外，我们还应该根据**效率**来评估算法，也就是说，哪个算法用最少的资源解决问题，**在时间方面**（处理时间）和**空间方面**（内存使用）。

当第一次思考这个问题时，一个自动出现的想法是，"只需测量算法运行需要多长时间"。这是有效的。

但问题是，相同的算法在不同的计算机上可能需要更长或更短的时间，取决于其硬件和配置。即使在同一台计算机上，根据当时运行的后台任务，运行时间也可能更长或更短。

我们需要一种客观且不变的方法来衡量算法的性能，这正是**渐近记法**的用途。

渐近记法（也称为**大 O 记法**）是一个系统，允许我们**分析和比较算法在其输入增长时的性能**。

大 O 是一种标准化的方法，用于分析和比较不同算法的复杂度（在运行时间和空间方面）。算法的大 O 复杂度将始终相同，无论你在哪台计算机上"计算它"，因为复杂度是**根据算法的操作数量如何随输入变化而变化**来计算的，而这种关系在任何环境中都保持不变。

算法可能有许多不同的可能复杂度，但最常见的有：

- **常数 — O(1):** 当所需的操作/空间数量始终相同，与输入无关时。例如，一个接受数字作为输入并返回该数字减去 10 的函数。无论你给它 100 还是 1000000 作为输入，该函数将始终执行单个操作（减去 10），所以复杂度是常数 O(1)。

- **对数 — O(log n):** 当所需的操作/空间数量与输入的增长相比以越来越慢的速度增长时。这种类型的复杂度通常在使用分治方法的算法或搜索算法中可以找到。经典的例子是二分搜索，其中需要遍历的数据集不断减半，直到达到最终结果。

- **线性 — O(n):** 当所需的操作/空间数量以与输入相同的速率增长时。例如，一个打印数组中找到的每个值的循环。操作的数量将与数组的长度一起增长，所以复杂度是线性 O(n)。

- **二次 — O(n²):** 当所需的操作/空间数量相对于输入以二次幂增长时。嵌套循环是这种情况的经典例子。想象我们有一个遍历数字数组的循环，并且在该循环内部我们有另一个再次遍历整个数组的循环。对于数组中的每个值，我们都要遍历数组两次，所以复杂度是二次 O(n²)。

*经典算法复杂度的图形表示*

请注意，在讨论时间和空间复杂度时都使用相同的记法。例如，如果我们有一个函数，无论它接收到什么输入，都总是创建一个带有单个值的数组，那么空间复杂度将是常数 O(1)，以此类推其他复杂度类型。

为了更好地理解所有这些，让我们回到我们的问题并分析我们的解决方案示例。

### 示例 1：

```javascript
function twoNumberSum(array, targetSum) {
    let result = []
    // 我们使用嵌套循环来测试数组中每种可能的数字组合
    for (let i = 0; i < array.length; i++) {
        for (let j = i+1; j < array.length; j++) {
            // 如果我们找到正确的组合，就将两个值都推入结果数组并返回
            if (array[i] + array[j] === targetSum) {
                result.push(array[i])
                result.push(array[j])
                return result
            }
        }
    }
    // 返回结果数组
    return result
}

console.log(twoNumberSum([9,1,3,4,5], 6)) // [1,5]
console.log(twoNumberSum([1,2,3,4,5], 10)) // []
```

在这个示例中，我们遍历参数数组，对于数组中的每个值，我们再次遍历整个数组，寻找加起来等于目标和的数字。

每次迭代都算作一个任务。

- 如果数组中有 **3** 个数字，我们将为每个数字迭代 3 次，再迭代 9 次（3 次数组中的三个数字）。总共 **12** 个任务。
- 如果数组中有 4 个数字，我们将为每个数字迭代 4 次，再迭代 16 次（4 次数组中的四个数字）。总共 **20** 个任务。
- 如果数组中有 5 个数字，我们将为每个数字迭代 5 次，再迭代 25 次（5 次数组中的五个数字）。总共 **25** 个任务。

你可以看到这个算法中的任务数量如何相对于输入呈指数级和不成比例地增长。这个算法的复杂度是二次的 — **O(n²)**。

每当我们看到嵌套循环时，我们应该想到二次复杂度 → 不好 → 可能有一个更好的方法来解决这个问题。

### 示例 2：

```javascript
function twoNumberSum(array, targetSum) {
    // 对数组进行排序，并在每个极端处用一个指针进行迭代
    // 在每次迭代中，检查两个指针的总和是否大于或小于目标
    // 如果更大，将右指针向左移动
    // 如果更小，将左指针向右移动
    let sortedArray = array.sort((a,b) => a-b)
    let leftLimit = 0
    let rightLimit = sortedArray.length-1

    while (leftLimit < rightLimit) {
        const currentSum = sortedArray[leftLimit] + sortedArray[rightLimit]

        if (currentSum === targetSum) return [sortedArray[leftLimit], sortedArray[rightLimit]]
        else currentSum < targetSum ? leftLimit++ : rightLimit--
    }

    return []
}

console.log(twoNumberSum([9,1,3,4,5], 6)) // [1,5]
console.log(twoNumberSum([1,2,3,4,5], 10)) // []
```

在这里，我们在迭代之前对算法进行排序。然后我们只迭代一次，在数组的每个极端处使用一个指针并"向内"迭代。

这比之前的解决方案更好，因为我们只迭代一次。但我们仍然对数组进行排序（通常具有对数复杂度），然后迭代一次（这是线性复杂度）。此解决方案的算法复杂度是 **O(n log(n))**。

### 示例 3：

```javascript
function twoNumberSum(array, targetSum) {
    // 迭代数组一次，在每次迭代时
    // 检查达到目标所需的数字是否存在于数组中
    // 如果存在，返回其索引和当前数字的索引
    let result = []

    for (let i = 0; i < array.length; i++) {
        let desiredNumber = targetSum - array[i]
        if (array.indexOf(desiredNumber) !== -1 && array.indexOf(desiredNumber) !== i) {
            result.push(array[i])
            result.push(array[array.indexOf(desiredNumber)])
            break
        }
    }

    return result
}

console.log(twoNumberSum([9,1,3,4,5], 6)) // [1,5]
console.log(twoNumberSum([1,2,3,4,5], 10)) // []
```

在这个最后的示例中，我们只迭代数组一次，而没有做任何其他事情。这是最好的解决方案，因为我们执行的操作数量最少。这种情况下的复杂度是线性的 — **O(n)**。

这确实是**算法背后最重要的概念**。能够比较不同的实现并理解哪个更高效以及为什么，这真的是一项重要的知识。所以如果这个概念对你还不清楚，我鼓励你再次阅读示例，寻找其他资源，或查看这个很棒的 freeCodeCamp 视频课程。

# 搜索算法

一旦你很好地理解了算法复杂度，下一个要知道的好知识是用于解决非常常见的编程任务的流行算法。让我们从搜索开始。

当在数据结构中搜索值时，我们可以采用不同的方法。我们将看一下最常用的两种方法并进行比较。

## 线性搜索

线性搜索包括一次遍历数据结构一个值，并检查该值是否是我们正在寻找的值。这可能是最直观的搜索类型，也是我们在使用无序数据结构时能做的最好的方法。

假设我们有一个数字数组，对于这个数组，我们想要编写一个函数，它接受一个数字作为输入并返回该数字在数组中的索引。如果它不存在于数组中，它将返回 -1。一个可能的方法如下：

```javascript
const arr = [1,2,3,4,5,6,7,8,9,10]

const search = num => {
    for (let i = 0; i < arr.length; i++) {
        if (num === arr[i]) return i
    }
    return -1
}

console.log(search(6)) // 5
console.log(search(11)) // -1
```

由于数组是无序的，我们无法知道每个值的大致位置，所以我们能做的就是一次检查一个值。这个算法的复杂度是**线性 - O(n)**，因为在最坏的情况下，我们将必须遍历整个数组一次以获取我们要查找的值。

线性搜索是许多内置 JavaScript 方法使用的方法，如 `indexOf`、`includes` 和 `findIndex`。

## 二分搜索

当我们有一个有序数据结构时，我们可以采用一种更高效的方法，即二分搜索。我们在二分搜索中做的是以下事情：

- 选择我们数据结构的中间值并"询问"，这是我们要查找的值吗？
- 如果不是，我们"询问"我们要查找的值是大于还是小于中间值？
- 如果更大，我们"丢弃"所有小于中间值的值。如果更小，我们"丢弃"所有大于中间值的值。
- 然后我们重复相同的操作，直到我们找到给定的值或数据结构的剩余"部分"不能再被分割为止。

*二分搜索的图形表示*

二分搜索的酷之处在于，在每次迭代中，我们大约丢弃了数据结构的一半。这使得搜索真的快速和高效。👌

假设我们有相同的数组（有序的），并且我们想要编写与之前相同的函数，它接受一个数字作为输入并返回该数字在数组中的索引。如果它不存在于数组中，它将返回 -1。二分搜索方法可能如下：

```javascript
const arr = [1,2,3,4,5,6,7,8,9,10]

const search = num => {
    // 我们将使用三个指针。
    // 一个在数组的开头，一个在末尾，另一个在中间。
    let start = 0
    let end = arr.length-1
    let middle = Math.floor((start+end)/2)

    // 当我们还没有找到数字并且开始指针等于或小于结束指针时
    while (arr[middle] !== num && start <= end) {
        // 如果所需的数字小于中间值，丢弃数组的较大的一半
        if (num < arr[middle]) end = middle - 1
        // 如果所需的数字大于中间值，丢弃数组的较小的一半
        else start = middle + 1
        // 重新计算中间值
        middle = Math.floor((start+end)/2)
    }
    // 如果我们已经退出循环，这意味着我们要么找到了值，要么数组不能进一步分割
    return arr[middle] === num ? middle : -1
}

console.log(search(6)) // 5
console.log(search(11)) // -1
```

这种方法一开始可能看起来像"更多的代码"，但潜在的迭代实际上比线性搜索少得多，这是因为在每次迭代中我们大约丢弃了数据结构的一半。这个算法的复杂度是**对数的** — **O(log n)**。

# 排序算法

在对数据结构进行排序时，我们可以采用许多可能的方法。让我们看一下一些最常用的方法并进行比较。

## 冒泡排序

冒泡排序遍历数据结构并一次比较一对值。如果这些值的顺序不正确，它会交换其位置以纠正它。重复迭代，直到数据被排序。此算法使较大的值"冒泡"到数组的末尾。

这个算法具有**二次 - O(n²)** 复杂度，因为它将每个值与所有其他值比较一次。

*冒泡排序的图形表示*

一个可能的实现可能如下：

```javascript
const arr = [3,2,1,4,6,5,7,9,8,10]

const bubbleSort = arr => {
    // 设置一个标志变量
    let noSwaps

    // 我们将有一个嵌套循环
    // 带有一个从右到左迭代的指针
    for (let i = arr.length; i > 0; i--) {
        noSwaps = true
        // 和另一个从右到左迭代的指针
        for (let j = 0; j < i-1; j++) {
            // 我们比较两个指针
            if (arr[j] > arr[j+1]) {
                let temp = arr[j]
                arr[j] = arr[j+1]
                arr[j+1] = temp
                noSwaps = false
            }
        }
        if (noSwaps) break
    }
}

bubbleSort(arr)
console.log(arr) // [1,2,3,4,5,6,7,8,9,10]
```

## 选择排序

选择排序类似于冒泡排序，但不是将较大的值放在数据结构的末尾，而是专注于将较小的值放在开头。它采取的步骤如下：

- 将数据结构的第一项存储为最小值。
- 遍历数据结构，将每个值与最小值进行比较。如果发现较小的值，则将此值标识为新的最小值。
- 如果最小值不是数据结构的第一值，则交换最小值和第一值的位置。
- 重复此迭代，直到数据结构被排序。

这个算法具有**二次 - O(n²)** 复杂度。

*选择排序的图形表示*

一个可能的实现可能如下：

```javascript
const arr = [3,2,1,4,6,5,7,9,8,10]

const selectionSort = arr => {
    for (let i = 0; i < arr.length; i++) {
        let lowest = i

        for (let j = i+1; j < arr.length; j++) {
            if (arr[j] < arr[lowest]) {
                lowest = j
            }
        }

        if (i !== lowest) {
            let temp = arr[i]
            arr[i] = arr[lowest]
            arr[lowest] = temp
        }
    }
}

selectionSort(arr)
console.log(arr) // [1,2,3,4,5,6,7,8,9,10]
```

## 插入排序

插入排序通过创建一个始终正确排序的"有序半部"来对数据结构进行排序，并遍历数据结构，选择每个值并将其插入到它应该位于有序半部中的确切位置。

它采取的步骤如下：

- 它从选择数据结构中的第二个元素开始。
- 它将此元素与其前面的元素进行比较，并在必要时交换其位置。
- 它继续到下一个元素，如果它不在正确的位置，它会遍历"有序半部"以找到其正确的位置并将其插入那里。
- 它重复相同的过程，直到数据结构被排序。

这个算法具有**二次 (O(n²))** 复杂度。

*插入排序的图形表示*

一个可能的实现可能如下：

```javascript
const arr = [3,2,1,4,6,5,7,9,8,10]

const insertionSort = arr => {
    let currentVal

    for (let i = 0; i < arr.length; i++) {
        currentVal = arr[i]

        for (var j = i-1; j >= 0 && arr[j] > currentVal; j--) {
            arr[j+1] = arr[j]
        }

        arr[j+1] = currentVal
    }

    return arr
}

insertionSort(arr)
console.log(arr) // [1,2,3,4,5,6,7,8,9,10]
```

冒泡排序、选择排序和插入排序的问题是这些算法不能很好地扩展。

当我们处理大数据集时，我们可以选择更好的选项。其中一些是归并排序、快速排序和基数排序。所以让我们现在来看看这些！

## 归并排序

归并排序是一种递归地将数据结构分解为单个值，然后以排序的方式重新组合它的算法。

它采取的步骤如下：

- 递归地将数据结构分解为两半，直到每个"部分"只有一个值。
- 然后，以排序的方式递归地组合各部分，直到它回到原始数据结构的长度。

这个算法具有 **O(n log n)** 复杂度，因为它的分解部分具有 log n 复杂度，而它的比较部分具有 n 复杂度。

*归并排序的图形表示*

一个可能的实现可能如下：

```javascript
const arr = [3,2,1,4,6,5,7,9,8,10]

// 合并函数
const merge = (arr1, arr2) => {
    const results = []
    let i = 0
    let j = 0

    while (i < arr1.length && j < arr2.length) {
        if (arr2[j] > arr1[i]) {
            results.push(arr1[i])
            i++
        } else {
            results.push(arr2[j])
            j++
        }
    }

    while (i < arr1.length) {
        results.push(arr1[i])
        i++
    }

    while (j < arr2.length) {
        results.push(arr2[j])
        j++
    }

    return results
}

const mergeSort = arr => {
    if (arr.length <= 1) return arr
    let mid = Math.floor(arr.length/2)
    let left = mergeSort(arr.slice(0,mid))
    let right = mergeSort(arr.slice(mid))
    return merge(left, right)
}

console.log(mergeSort(arr)) // [1,2,3,4,5,6,7,8,9,10]
```

## 快速排序

快速排序的工作原理是选择一个元素（称为"枢轴"）并找到枢轴应该在排序数组中的索引。

快速排序的运行时间部分取决于如何选择枢轴。理想情况下，它应该是被排序数据集的中位值附近。

该算法采取的步骤如下：

- 识别枢轴值并将其放置在它应该在的索引处。
- 对数据结构的每个"半部"递归执行相同的过程。

这个算法具有 **O(n log n)** 复杂度。

*快速排序的图形表示*

一个可能的实现可能如下：

```javascript
const arr = [3,2,1,4,6,5,7,9,8,10]

const pivot = (arr, start = 0, end = arr.length - 1) => {
    const swap = (arr, idx1, idx2) => [arr[idx1], arr[idx2]] = [arr[idx2], arr[idx1]]

    let pivot = arr[start]
    let swapIdx = start

    for (let i = start+1; i <= end; i++) {
        if (pivot > arr[i]) {
            swapIdx++
            swap(arr, swapIdx, i)
        }
    }

    swap(arr, start, swapIdx)
    return swapIdx
}

const quickSort = (arr, left = 0, right = arr.length - 1) => {
    if (left < right) {
        let pivotIndex = pivot(arr, left, right)
        quickSort(arr, left, pivotIndex-1)
        quickSort(arr, pivotIndex+1, right)
    }

    return arr
}

console.log(quickSort(arr)) // [1,2,3,4,5,6,7,8,9,10]
```

## 基数排序

基数排序是一种与之前看到的算法工作方式不同的算法，因为它不比较值。基数排序用于对数字列表进行排序，并且它利用了数字的大小由其拥有的位数定义这一事实（位数越多，数字越大）。

基数排序所做的是按顺序对值按其数字进行排序。它首先按第一个数字对所有值进行排序，然后按第二个数字，再按第三个数字……这个过程重复的次数与列表中最大数字的位数相同。到这个过程结束时，算法返回完全排序的列表。

它采取的步骤如下：

- 计算最大数字有多少位数。
- 循环遍历列表直到最大数字的位数。在每次迭代中：
  - 为每个数字（从 0 到 9）创建"桶"，并根据正在评估的数字将每个值放在其相应的桶中。
  - 用在桶中排序的值替换现有列表，从 0 开始一直到 9。

这个算法具有 **O(n*k)** 复杂度，k 是最大数字拥有的位数。由于它不将值彼此比较，这个算法比之前看到的算法具有更好的运行时间，但只适用于数字列表。

如果我们想要一个与数据无关的排序算法，我们可能会选择之前的任何一个。

*基数排序的图形表示*

一个可能的实现可能如下：

```javascript
const arr = [3,2,1,4,6,5,7,9,8,10]

const getDigit = (num, i) => Math.floor(Math.abs(num) / Math.pow(10, i)) % 10

const digitCount = num => {
    if (num === 0) return 1
    return Math.floor(Math.log10(Math.abs(num))) + 1
}

const mostDigits = nums => {
    let maxDigits = 0

    for (let i = 0; i < nums.length; i++) maxDigits = Math.max(maxDigits, digitCount(nums[i]))

    return maxDigits
}

const radixSort = nums => {
    let maxDigitCount = mostDigits(nums)

    for (let k = 0; k < maxDigitCount; k++) {
        let digitBuckets = Array.from({ length: 10 }, () => [])

        for (let i = 0; i < nums.length; i++) {
            let digit = getDigit(nums[i], k)
            digitBuckets[digit].push(nums[i])
        }

        nums = [].concat(...digitBuckets)
    }

    return nums
}

console.log(radixSort(arr)) // [1,2,3,4,5,6,7,8,9,10]
```

# 遍历算法

我们要看的最后一种算法是遍历算法，用于遍历可以以不同方式迭代的数据结构（主要是树和图）。

当迭代像树这样的数据结构时，我们可以以两种主要方式优先考虑迭代：广度或深度。

如果我们优先考虑深度，我们将"下降"通过树的每个分支，从每个分支的头部到叶子。

*深度优先*

如果我们优先考虑广度，我们将水平地遍历每个树"层级"，在"下降"到下一个层级之前迭代同一层级的所有节点。

*广度优先*

我们选择哪一个主要取决于我们在迭代中寻找什么值以及我们的数据结构是如何构建的。

## 广度优先搜索 (BFS)

所以让我们首先分析 BFS。如前所述，这种遍历将以"水平方式"遍历我们的数据结构。按照这个新的示例图像，值将按以下顺序遍历：`[10, 6, 15, 3, 8, 20]`。

*BFS 遍历顺序*

通常，BFS 算法遵循的步骤如下：

- 创建一个队列和一个变量来存储已经"访问"过的节点
- 将根节点放入队列中
- 只要队列中有任何东西，就保持循环
- 从队列中取出一个节点并将节点的值推入存储已访问节点的变量中
- 如果取出的节点有左属性，将其添加到队列中
- 如果取出的节点有右属性，将其添加到队列中

一个可能的实现可能如下：

```javascript
class Node {
    constructor(value) {
        this.value = value
        this.left = null
        this.right = null
    }
}

class BinarySearchTree {
    constructor(){ this.root = null; }

    insert(value){
        let newNode = new Node(value);
        if(this.root === null){
            this.root = newNode;
            return this;
        }
        let current = this.root;
        while(true){
            if(value === current.value) return undefined;
            if(value < current.value){
                if(current.left === null){
                    current.left = newNode;
                    return this;
                }
                current = current.left;
            } else {
                if(current.right === null){
                    current.right = newNode;
                    return this;
                }
                current = current.right;
            }
        }
    }

    BFS(){
        let node = this.root,
            data = [],
            queue = [];
        queue.push(node);

        while(queue.length){
           node = queue.shift();
           data.push(node.value);
           if(node.left) queue.push(node.left);
           if(node.right) queue.push(node.right);
        }
        return data;
    }
}

const tree = new BinarySearchTree()
tree.insert(10)
tree.insert(6)
tree.insert(15)
tree.insert(3)
tree.insert(8)
tree.insert(20)

console.log(tree.BFS()) // [ 10, 6, 15, 3, 8, 20 ]
```

## 深度优先搜索 (DFS)

DFS 将以"垂直方式"遍历我们的数据结构。按照我们用于 BFS 的相同示例，值将按以下顺序遍历：`[10, 6, 3, 8, 15, 20]`。

这种进行 DFS 的方式称为"前序"。实际上有三种主要的方法可以执行 DFS，每种方法只是通过更改访问节点的顺序而有所不同。

- **前序：** 访问当前节点，然后是左节点，然后是右节点。
- **后序：** 在访问节点之前，探索所有左子节点和所有右子节点。
- **中序：** 探索所有左子节点，访问当前节点，然后探索所有右子节点。

如果这听起来很令人困惑，不要担心。它并不复杂，很快就会通过几个例子变得清晰。

### 前序 DFS

在前序 DFS 算法中，我们执行以下操作：

- 创建一个变量来存储已访问节点的值
- 将树的根存储在一个变量中
- 编写一个接受节点作为参数的帮助函数
- 将节点的值推入存储值的变量中
- 如果节点有左属性，使用左节点作为参数调用帮助函数
- 如果节点有右属性，使用左节点作为参数调用帮助函数

一个可能的实现可能如下：

```javascript
class Node {
    constructor(value){
        this.value = value;
        this.left = null;
        this.right = null;
    }
}

class BinarySearchTree {
    constructor(){
        this.root = null;
    }
    insert(value){
        var newNode = new Node(value);
        if(this.root === null){
            this.root = newNode;
            return this;
        }
        var current = this.root;
        while(true){
            if(value === current.value) return undefined;
            if(value < current.value){
                if(current.left === null){
                    current.left = newNode;
                    return this;
                }
                current = current.left;
            } else {
                if(current.right === null){
                    current.right = newNode;
                    return this;
                }
                current = current.right;
            }
        }
    }

    DFSPreOrder(){
        var data = [];
        function traverse(node){
            data.push(node.value);
            if(node.left) traverse(node.left);
            if(node.right) traverse(node.right);
        }
        traverse(this.root);
        return data;
    }
}

var tree = new BinarySearchTree()
tree.insert(10)
tree.insert(6)
tree.insert(15)
tree.insert(3)
tree.insert(8)
tree.insert(20)

console.log(tree.DFSPreOrder()) // [ 10, 6, 3, 8, 15, 20 ]
```

### 后序 DFS

在后序 DFS 算法中，我们执行以下操作：

- 创建一个变量来存储已访问节点的值
- 将树的根存储在一个变量中
- 编写一个接受节点作为参数的帮助函数
- 如果节点有左属性，使用左节点作为参数调用帮助函数
- 如果节点有右属性，使用左节点作为参数调用帮助函数
- 使用当前节点作为参数调用帮助函数

一个可能的实现可能如下：

```javascript
class Node {
    constructor(value){
        this.value = value;
        this.left = null;
        this.right = null;
    }
}

class BinarySearchTree {
    constructor(){
        this.root = null;
    }
    insert(value){
        var newNode = new Node(value);
        if(this.root === null){
            this.root = newNode;
            return this;
        }
        var current = this.root;
        while(true){
            if(value === current.value) return undefined;
            if(value < current.value){
                if(current.left === null){
                    current.left = newNode;
                    return this;
                }
                current = current.left;
            } else {
                if(current.right === null){
                    current.right = newNode;
                    return this;
                }
                current = current.right;
            }
        }
    }

    DFSPostOrder(){
        var data = [];
        function traverse(node){
            if(node.left) traverse(node.left);
            if(node.right) traverse(node.right);
            data.push(node.value);
        }
        traverse(this.root);
        return data;
    }
}

var tree = new BinarySearchTree()
tree.insert(10)
tree.insert(6)
tree.insert(15)
tree.insert(3)
tree.insert(8)
tree.insert(20)

console.log(tree.DFSPostOrder()) // [ 3, 8, 6, 20, 15, 10 ]
```

### 中序 DFS

在中序 DFS 算法中，我们执行以下操作：

- 创建一个变量来存储已访问节点的值
- 将树的根存储在一个变量中
- 编写一个接受节点作为参数的帮助函数
- 如果节点有左属性，使用左节点作为参数调用帮助函数
- 将节点的值推入存储值的变量中
- 如果节点有右属性，使用右节点作为参数调用帮助函数

一个可能的实现可能如下：

```javascript
class Node {
    constructor(value){
        this.value = value;
        this.left = null;
        this.right = null;
    }
}

class BinarySearchTree {
    constructor(){
        this.root = null;
    }
    insert(value){
        var newNode = new Node(value);
        if(this.root === null){
            this.root = newNode;
            return this;
        }
        var current = this.root;
        while(true){
            if(value === current.value) return undefined;
            if(value < current.value){
                if(current.left === null){
                    current.left = newNode;
                    return this;
                }
                current = current.left;
            } else {
                if(current.right === null){
                    current.right = newNode;
                    return this;
                }
                current = current.right;
            }
        }
    }

    DFSInOrder(){
        var data = [];
        function traverse(node){
            if(node.left) traverse(node.left);
            data.push(node.value);
            if(node.right) traverse(node.right);
        }
        traverse(this.root);
        return data;
    }
}

var tree = new BinarySearchTree()
tree.insert(10)
tree.insert(6)
tree.insert(15)
tree.insert(3)
tree.insert(8)
tree.insert(20)

console.log(tree.DFSInOrder()) // [ 3, 6, 8, 10, 15, 20 ]
```

# 总结

这些是理解算法的一些基本概念。正如我们所看到的，算法只是一组为实现目标而采取的步骤，但了解如何比较不同的算法并理解它们的复杂度对于编写高效代码至关重要。

通过了解算法复杂度（大 O 记法），我们可以做出更好的设计决策并选择合适的算法。了解不同的搜索、排序和遍历算法及其复杂性，使我们能够在工作时选择正确的工具。

感谢阅读！希望这篇文章对理解算法的基础有所帮助。👍