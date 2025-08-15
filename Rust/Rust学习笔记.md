# Rust学习笔记
> 版本 1.63.0

学习Rust的初衷, 是因为前端可以通过 [wasm](https://developer.mozilla.org/zh-CN/docs/WebAssembly) 方式, 从而来实现在 web 端运行另一种高效的编程代码。而**Rust**就是支持将其编译成 WebAssembly 从而被前端js使用


### 环境配置
- windows
  [下载](https://www.rust-lang.org/tools/install)最新的安装文件

- Linux or macOS
  ``` sh
  curl --proto '=https' --tlsv1.3 https://sh.rustup.rs -sSf | sh
  ``` 

安装完成后, 可以执行以下命令:
``` sh
# 查看版本信息
rustc --version 
```

``` sh
# 升级rustup
rustup update
```

``` sh
# 取消安装rustup
rustc self uninstall
```

### 变量 和 可变性
默认情况下, Rust定义的变量都是不可变的, 需要使用 **mut** 来明确其可变性
```rust
let name = "my name"
let mut mAge = 16
```

##### shadowing(遮蔽变量)
虽然Rust默认变量是不可变的, 但是可以通过遮蔽变量的方式来改变值 甚至是 类型
```rust
let name = ""
// 该 name变量 会遮蔽 前一个name变量
let name = "zhangf"
{
  // 作用域内
  let name = "zhangfeng"
  // 作用域结束后, 遮蔽变量消失
  println('我输入的名字是: {name}') // 输出: zhangfeng
}

println('我输入的名字是: {name}') // 输出: zhangf

```

### 数据类型

#### 标量类型
> 五种类型: integers, floating-point numbers, Booleans, and characters.


#### 复合类型
> 两种: tuple and array

##### tuples(元组)
拓扑型数据的长度是固定的, 一旦申明后, 则无法改变.
> Tuples have a fixed length: once declared, they cannot grow or shrink in size

拓扑型结构, 数据以逗号分隔, 并被一个括号包裹内, 内部数据无类型要求。
``` rust
let tuples = (1, '123', true)
```

##### array(数组)
数组型内部数据类型必须保持一致，且一旦申明后, 则无法改变该类型的长度。
> array as a comma-separated list inside square brackets
> 以逗号分隔，包裹在方括号[...]内

可以通过 **arr**[**index**] 来获取数组内指定位置的数据，但是不允许index超过数组本身的长度。


##### struct
结构型数据类似于面向对象中的对象，用于收集和定义相关的属性和方法。

```rust
struct User {
  name: &str,
  age: u32,
  male: bool
}

fn main() {
  let user = User {
    name: "ZhangFeng",
    age: 32,
    male: true
  }
}
```

###### Tuple structs
> **Tuple structs** are useful when you want to give the whole tuple a name and make the tuple a different type from other tuples
> 可以为特定拓扑型指定名称，便于区分

```rust
struct Color(i32, i32, i32);
struct Point(i32, i32, i32);

fn main() {
  let black = Color(0, 0, 0);
  let origin = Point(0, 0, 0);
}
```

###### Unit-Like Structs
> Unit-like structs can be useful when you need to implement a trait on some type but don’t have any data that you want to store in the type itself

```rust
struct AlwaysEqual;

fn main() {
  let subject = AlwaysEqual;
}
```

###### Defining Methods
```rust
struct Rectangle {
    width: u32,
    height: u32,
}

impl Rectangle {
  // 第一个参数必须是self才能称为函数, 否则称为关联方法
  fn area(&self) -> u32 {
      self.width * self.height
  }
}
```

###### Associated Functions
> All functions defined within an impl block are called associated functions because they’re associated with the type named after the impl. We can define associated functions that **don’t have self as their first parameter** (and thus are **not methods**) because they don’t need an instance of the type to work with. 
> 在impl定义方法时，如果方法定义的第一个参数没有出现self，则该方法称为关联方法



#### function
> Rust doesn’t care where you define your functions, only that they’re defined somewhere in a scope that can be seen by the caller.
> 在同一个作用域内，方法的调用和其定义的顺序无关

``` rust
fn main() {
    // 先执行
    another_function(5);
}
// 后定义
fn another_function(x: i32) {
    println!("The value of x is: {x}");
}
```
> In function signatures, you must declare the type of each parameter
> 在定义方法时，**必须**明确每个参数的类型

### 控制流程
##### 语句 和 表达式
> Statements are instructions that perform some action and do not return a value. Expressions evaluate to a resulting value.
> 语句是表示处理行为的集合，**无结果返回**
> 表达式会被计算，**并返回结果**

方法定义本身是属于语句，方法执行属于表达式

Rust语言中，块结构也是一种表达式，即有结果值
```rust
// block变量的值为 11
let block = {
  let n = 10
  n + 1
}
```

#### if 表达式
> It’s also worth noting that the condition in this code must be a bool
> if表达式中的条件, **必须**是一个boolean类型，否则Rust会报错

和其他语言不一样，在Rust中 IF 是属于表达式范畴的，即可以被赋予变量，但是必须保证每个IF块返回的类型是一致的
```rust
let x = if true { 5 } else { 6 }
```

#### loop 表达式
在loop表达式中，会使用2个保留字：break 和 continue

在Rust语言中，loop同样也是属于表达式，其计算结果通过 **break** 表达式返回

```rust
let mut num = 0
let x = loop {
  num += 1
  if num == 10 {
    break num + 1
  }
}
```

在Loop嵌套时，break 和 continue默认情况下，只会对其最近的loop有作用，那么如果想要作用于外部的loop，则会用到loop labels
> **Loop labels** must begin with a **single quote**. 
```rust
`outer: loop {
  ...
  `inner: loop {
    if condition {
        break;
    }
    if condition {
        break 'outer;
    }
  }
  ...
}
```

#### while 表达式
> It’s possible to implement behavior like this using a combination of loop, if, else, and break;
> while表达式类似于if 和 loop 组合的语法糖

### Ownership(所有权)
> related features: borrowing, slices, and how Rust lays data out in memory.
> 相关功能：借取、截取、内存分配

> Ownership is a set of rules that governs how a Rust program manages memory.
> Ownership就是Rust通过一组规则来管理和分配内存

有些语言通过GC来自动回收，有些语言是需要主动分配和施放内存，而Rust是通过Ownership来管理内存

#### 堆 和 栈
> All data stored on the stack must have a known, fixed size. Data with an unknown size at compile time or a size that might change must be stored on the heap instead.
> 栈(stack)中的数据必须是大小已确定，而在编译时大小不确定甚至会改变的则会存在堆(heap)中

栈(stack): FILO - 先进后出
堆(heap): 当数据需要放到堆中，则会先分配一块足够大内存出来，然后得到一个指针来表示该内存的位置。因为指针大小是固定，因此可以将其放到栈中

相比较，栈操作 比 堆操作快速的多，因为无需再通过指针找到具体的内存位置

#### Ownership Rules
  - Each value in Rust has an owner.
  - There can only be one owner at a time.
  - **When the owner goes out of scope, the value will be dropped(内存释放)**.

#### Ways Variables and Data Interact: Move
```rust
let s1 = String::from("hello")
let s2 = s1
```
首先Rust会在heap中分配一段内存用于存储String数据内容，然后在栈中插入一个s1数据，s1数据只记录String数据的pointer、len 和 capacity信息

![s1](https://doc.rust-lang.org/book/img/trpl04-01.svg)

当执行let s2 = s1 时，仅把栈中的s1信息copy给s2，并不会复制一份heap信息，并同时让s1失效。因为根据 Ownership Rules 离开作用域后，Rust会去释放内存，如果不让s1失效，则会导致多次释放的问题。Rust把这种行为成为 **Move**。
![s2 = s1](https://doc.rust-lang.org/book/img/trpl04-04.svg)


#### Ways Variables and Data Interact: Clone
``` rust
let s1 = String::from("hello");
let s2 = s1.clone();
```

![clone](https://doc.rust-lang.org/book/img/trpl04-03.svg)

#### Stack-Only Data: Copy

> If a type implements the **Copy** trait, variables that use it do not **Move**, but rather are trivially copied
> 如果特定类型实现了Copy特征，则被赋值于其他变量时则会进行copy操作而不是Move操作，即该变量仍然可用使用

``` rust
let x = 5;
let y = x;
println!("x = {}, y = {}", x, y);
```

------

### References and Borrowing
虽然Move机制能有效管理好系统中的内存使用，但是也会让代码不好维护和阅读。
```rust
fn main() {
  let s = String::from("hello");
  // 会触发Move机制，导致s变量失效不可用
  takes_ownership(s);
  let x = 5;
  makes_copy(x);
}
```

因此Rust引入了 **Reference**
> A reference is like a pointer in that it’s an address we can follow to access the data stored at that address;
> 引用类似指针指向数据内存位置
>  a reference is guaranteed to point to a valid value of a particular type for the life of that reference.
> 引用同时还保有数据类型
``` rust
fn main() {
  let s1 = String::from("hello");
  let len = calculate_length(&s1);
  println!("The length of '{}' is {}.", s1, len);
}
fn calculate_length(s: &String) -> usize {
    s.len()
}
``` 
![References](https://doc.rust-lang.org/book/img/trpl04-05.svg)

#### Mutable References

如果想要改变数据内容，则首先需要明确该数据是可变的，同时引用数据也是可变的
``` rust
fn main() {
  let mut s1 = String::from("hello");
  let len = calculate_length(&mut s1);
  println!("The length of '{}' is {}.", s1, len);
}
``` 

注：
1. 同一个可变变量，不允许同时多次引用
``` rust
  fn main() {
    let mut s = String::from("hello");
    let r1 = &mut s;
    let r2 = &mut s;
  }
``` 

2. 相同变量的可变和不可变引用不允许同时被使用
``` rust
  fn main() {
    let mut s = String::from("hello");
    let r1 = &s; // 没问题
    let r2 = &s; // 没问题
    let r3 = &mut s; // 出错
    println!("{}, {}, and {}", r1, r2, r3);
  }
``` 

#### Dangling References
> a pointer that references a location in memory that may have been given to someone else--by freeing some memory while preserving a pointer to that memory.
> 悬停引用：原始数据内存已释放，但是引用仍然被使用

```rust
fn main() {
    let reference_to_nothing = dangle();
}
fn dangle() -> &String {
    let s = String::from("hello");
    &s
    // 当 dangle 方法执行完，s 变量内存就会被释放，但是 &s 引用仍然返回被使用
}
```

如果遇到这种情况，则可以直接返回数据，然后通过Move机制转移到其他变量上

```rust
fn main() {
    let reference_to_nothing = dangle();
}
fn dangle() -> String {
    let s = String::from("hello");
    s
}
```

### The Slice Type
> Slices let you reference a contiguous sequence of elements in a collection rather than the whole collection.
> Slice类型也属于引用的一种，可用于截取部分元素


#### string slice
> A string slice is a reference to part of a String.The type that signifies “string slice” is written as **&str**

```rust
let s = String::from("hello world");
let hello: &str = &s[0..5];
let world: &str = &s[6..11];
```

字符串直接就是 slice type
```rust
let s: &str = "hello world"
```

#### array slice
```rust
let a = [1, 2, 3, 4, 5];
let slice: &[i32] = &a[1..3];
```

> 总结
The Rust language gives you control over your memory usage in the same way as other systems programming languages, but having the owner of data automatically clean up that data when the owner goes out of scope means you don’t have to write and debug extra code to get this control.
>
>Rust和其他语言一样需要对内存进行管理，但是不同点是Rust会通过数据拥有者在脱离作用域时自动的将该数据内存释放，而无需手动方式释放
---

### modules
在Rust语言中，module系统类似操作系统中的文件系统，每个mod都可以看做是每个文件夹，而mod内定义的非mod数据，则可以看做是不同类型的文件。

> In Rust, all items (functions, methods, structs, enums, modules, and constants) are private to parent modules by default.
> mod中定义的元素默认都是私有的，必须明确**pub**才允许被其他模块使用

mod路径：可以是相对路径也可以是绝对路径
**::** 连接符
**super**：上一级
**crate**：根目录
``` rust
// 绝对路径
crate::mod1::mod2::stuct
// 相对路径(相对于当前mod)
mod1::mod2
// 相对路径(相对于父mod)
super::mod1::mod2
```

为避免重复的书写全路径，可以使用**use**来简化，将目标内容link到当前mod中
```rust
use crate:mod1::mod2;

fn say_hello (str: &str) {
  str = mod2.formatter(str)
  !println(str)
}
```

use 可以引入第三方的mod信息。通过cargo可以安装第三方依赖lib，然后在通过use来引入到项目中。
```rust
// 通过cargo安装
use rand::Rng;
// Rust内置安装的依赖
use std::collections::HashMap;
```

支持嵌套模式
``` rust
use std::{cmp::Ordering, io}; 
```

支持glob表达式
``` rust
// 引入所有pub项
use std::collections::*;
```

----------------------------------------------
## Rust 和 Js 间差异
1 Rust属于静态语言, Js属于动态语言
2 Rust可以在同一个作用域内声明同名称的变量(Shadowing)
3 Rust和Js都采用IEEE-754规范, 但是Js不区分单(双)精度
4 Rust中新增了Tuple(元组)复合类型, 且 Array包含的类型必须是一致且固定长度
5 Rust通过索引读取Array时, 如果索引超过了该Array的边界时, 会触发panic
6 Rust中Statement(语句) 和 Expression(表达式)是存在差异的
 - Statement 不输出结果, 因此无法被再次赋值
 - Expression 能输出结果, 因此允许被再次赋值
7 Rust中方法体由Statement 和 Expression(可选的结束表达式)组成
  ``` rs
  fn hello_world () -> isize {
    let x: isize = 5; // 语句
    x + 1 // 结束表达式
  }
  ```
8 Rust中if...else...属于**表达式**, 即可以通过let语句来赋值. 但是必须保证不同条件返回的类型是一致的
 ``` rs
  let condition = true;
  let if_value = if condition { 1 } else { 0 };
 ```
9 Rust新增**loop表达式**, 可以通过 **break** 或 **continue** 来控制其内部逻辑
  loop允许**嵌套**
 ``` rs
  let mut counter = 0;
    let result = loop {
        counter += 1;
        if counter == 10 {
            break counter * 2;
        }
    };
 ```

 10 Rust独有特性**所有权(ownership)** 
 > It enables Rust to make memory safety guarantees without needing a garbage collector