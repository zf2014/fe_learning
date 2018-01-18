#### 语法:
```javascript
function* name([param[, param[, ... param]]]) {
   statements
}
```

### 扮演角色:
> Generators can play three roles:

> Iterators (data producers): Each yield can return a value via next(), which means that generators can produce sequences of values via loops and recursion. Due to generator objects implementing the interface Iterable (which is explained in the chapter on iteration), these sequences can be processed by any ECMAScript 6 construct that supports iterables. Two examples are: for-of loops and the spread operator (...).

> Observers (data consumers): yield can also receive a value from next() (via a parameter). That means that generators become data consumers that pause until a new value is pushed into them via next().

> Coroutines (data producers and consumers): Given that generators are pausable and can be both data producers and data consumers, not much work is needed to turn them into coroutines (cooperatively multitasked tasks).

Generators Function主要有三种使用情况:
1. 数据生产者   --> next().value
2. 数据消费者   --> next('val')
3. 既是生产者又是消费者

```javascript
function* testGenFunc(){
	let pdata = 'Hello';
	let cdata;
	// 两者
	cdata = yield pdata;
	console.log(cdata);
}
let genObj = testGenFunc();
console.log(genObj.next().value);  // Hello
genObj.next('你好'); // 你好

```

需要注意的是Generator object同时实现了Iterator 和 Iterable接口, 因此有相通的特性：

> A Generator object is an instance of a generator function and conforms to both the **Iterator** and **Iterable** interfaces.

1.支持for...of
2.支持spread operator操作

[GeneratorObject规范](http://www.ecma-international.org/ecma-262/6.0/#sec-generator-objects "规范")


### 协同处理多任务
> JavaScript runs in a single process. There are two ways in which this limitation is being abolished:

> Multiprocessing: Web Workers let you run JavaScript in multiple processes. Shared access to data is one of the biggest pitfalls of multiprocessing. Web Workers avoid it by not sharing any data. That is, if you want a Web Worker to have a piece of data, you must send it a copy or transfer your data to it (after which you can’t access it anymore).

> Cooperative multitasking: There are various patterns and libraries that experiment with cooperative multitasking. Multiple tasks are run, but only one at a time. Each task must explicitly suspend itself, giving it full control over when a task switch happens. In these experiments, data is often shared between tasks. But due to explicit suspension, there are few risks.

Javascript的工作原理是单线程, 如果想要同时处理多个任务, 有两种方式:
1. 多线程: 利用web worker机制, 运行另一个环境在其他线程, 然后通过特定的方式来实现数据的共享.
2. 多任务: 根据相关模式, 同时启动多个任务, 最后协同处理相关数据.
