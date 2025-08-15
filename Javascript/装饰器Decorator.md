# Decorator - 装饰器

[TC39 工作流程](https://exploringjs.com/impatient-js/ch_history.html#tc39-process)
[Decorator 提案](https://github.com/tc39/proposal-decorators)
[什么是元编程](https://codedocs.org/what-is/metaprogramming)

## 演化史
[Decorator演化史](https://2ality.com/2022/10/javascript-decorators.html#history-of-decorators)
2013-07 - 初步构想
2014-04 - 首次 Decorator 提案 - stage 0
2014-10 - Angular2 基于 AtScript 使用注释 - Type & Field & Metadata
2015-01 - Typescript 团队交换意见
2015-03 - Angular 使用 Typescript 替换 AtScript 并保留 Decorator功能
2015-03 - 提案进化 - stage 1 [原始提案](https://github.com/wycats/javascript-decorators)
2015-07 - Typescript1.5 开始有条件支持 stage 1 版本, 通过开启 experimentalDecorators 配置
2016-06 - 提案再进化 - stage 2
2017-07 - 提交新的 Decorator 提案内容 (作者: Daniel Ehrenberg)
...
2022-03 - 提案再进化 - stage 3, 同时拆分出一个独立提案 - [Decorator Metadata](https://github.com/tc39/proposal-decorator-metadata) (stage 2) 
注: Typescript 5 默认支持当前最新提案, 为兼容老版提案, 需要开启 experimentalDecorators 配置

[Babel](https://babeljs.io/docs/babel-plugin-proposal-decorators#version) 针对不同阶段, 也提供了不同的解决插件

## 什么是 Decorator?
Decorator 是具有改变JS结构的一种[元编程](https://devopedia.org/metaprogramming)


类型定义:
``` ts
type DecoratedKind = 'class' | 'method' | 'getter' | 'setter' | 'accessor' | 'field'
type Decorator = (
  value: Input | undefined,
  context: {
    kind: DecoratedKind;
    name: string | symbol;
    access: {
      get?: () => unknown;
      set?: (value: unknown) => void;
      init?:(initialValue: unknown) => unknown
    };
    private?: boolean;
    static?: boolean;
    addInitializer?: (initializer: () => void): void;
  }
) => Output | void;
```

使用语法:
``` ts
@clazz(...)
class MyClass extends ParentClass {
  @accessor
  accessor clicked = false
  @method(...)
  function doSomething () {
    ...
  }
  @field
  name = "zhangf"
  @get(...)
  get x() {
    return ...
  }
  @set
  set x() {
    ...
  }
}
```

基本能力:
- 变更能力 - 改变原始数据的值
- 替换能力 - 替换结构(方法/字段/类), 但是必须保证类型一致 - 通过 Decorator 返回值
- 读写功能 - 通过暴露 context.access, 使得外部结构来读写被修饰结构的功能
- 增强功能 - 通过 context.addInitializer 注册回调函数, 在一切准备就绪后, 该回调函数被执行

服务对象:
- Class
- Class Field(静态和非静态)
- Class Method(静态和非静态)
- Class Getter/Setter Method(静态和非静态)
- [Class Auto Accessors](https://github.com/tc39/proposal-grouped-and-auto-accessors#auto-accessors)


工作流程:
1. Evaluation(评估): 在定义Class的过程中执行, 并且输出装饰器方法
2. Invocation(执行): 在Class构造函数触发前, 调用上一步得到的函数
3. Application(应用): 应用所有Decorator的执行结果

如何执行:
1. Evaluation
  **作用**: 在类定义完成前执行, 创建 Decorator 方法
2. Invocation
  **作用**: 在类定义中, 构造函数执行前, 调用 Decorator 方法来装饰目标对象
3. Application
  **作用**: 使用装饰后的结果


类型符号:
| Kind of decorator | (input) => output |	.access |
| ----------------- | ----------------- | ------- |
| class             | (func) => func2   | -       |
| Method            | (func) => func2   | {get}   |
| Getter            | (func) => func2   | {get}   |
| Setter            | (func) => func2   | {set}   |
| Auto-accessor | ({get,set}) => {get,set,init} | {get,set} |
| Field | () => (initValue)=>initValue2 | {get,set}|

this 在不同的方法体内代表的含义
| this is →                         | undefined | Class | Instance |
|-----------------------------------|-----------|-------|----------|
| Decorator function                |     ✔     |       |          |
| Static initializer                |           |   ✔   |          |
| Non-static initializer            |           |       |     ✔    |
| Static field decorator result     |           |   ✔   |          |
| Non-static field decorator result |           |       |     ✔    |


------------
执行顺序:

示例:
``` ts
const steps = [];
function push(msg, _this) {
  steps.push({msg, _this});
}
function pushStr(str) {
  steps.push(str);
}

function init(_value, {name, addInitializer}) {
  pushStr(`@init ${name}`);
  if (addInitializer) {
    addInitializer(function () {
      push(`DECORATOR INITIALIZER ${name}`, this);
    });
  }
}

@init
class TheClass {
  //--- Static ---
  static {
    pushStr('static block');
  }
  @init
  static staticMethod() {}
  @init
  static accessor staticAcc = pushStr('staticAcc');
  @init
  static staticField = pushStr('staticField');

  //--- Non-static ---
  @init
  prototypeMethod() {}
  @init
  accessor instanceAcc = pushStr('instanceAcc');
  @init
  instanceField = pushStr('instanceField');

  // 构造函数
  constructor() {
    pushStr('constructor');
  }
}

pushStr('===== Instantiation =====');
const inst = new TheClass();

for (const step of steps) {
  if (typeof step === 'string') {
    console.log(step);
    continue;
  }
  let thisDesc = '???';
  if (step._this === TheClass) {
    thisDesc = TheClass.name;
  } else if (step._this === inst) {
    thisDesc = 'inst';
  } else if (step._this === undefined) {
    thisDesc = 'undefined';
  }
  console.log(`${step.msg} (this===${thisDesc})`);
}

// 输出:
// @init staticMethod
// @init staticAcc
// @init prototypeMethod
// @init instanceAcc
// @init staticField
// @init instanceField
// @init TheClass
// DECORATOR INITIALIZER staticMethod (this===TheClass)
// DECORATOR INITIALIZER staticAcc (this===TheClass)
// DECORATOR INITIALIZER staticField (this===TheClass)
// static block
// staticAcc
// staticField
// DECORATOR INITIALIZER TheClass (this===TheClass)
// ===== Instantiation =====
// DECORATOR INITIALIZER prototypeMethod (this===inst)
// DECORATOR INITIALIZER instanceAcc (this===inst)
// DECORATOR INITIALIZER instanceField (this===inst)
// instanceAcc
// instanceField
// constructor
```

## 不同类型装饰定义及能力
### 类装饰器
``` ts
type ClassDecorator = (
  value: Function,
  context: {
    kind: 'class';
    name: string | undefined;
    addInitializer(initializer: () => void): void;
  }
) => Function | void;
```
1 监管类实例的构建
### 类方法装饰器
``` ts
type ClassMethodDecorator = (
  value: Function,
  context: {
    kind: 'method';
    name: string | symbol;
    static: boolean;
    private: boolean;
    access: { get: () => unknown };
    addInitializer(initializer: () => void): void;
  }
) => Function | void;
```
1 监控方法的执行情况
2 解决this绑定问题
3 增强类方法能力(memoize/debounce等)
### 类字段装饰器
``` ts
type ClassFieldDecorator = (
  value: undefined,
  context: {
    kind: 'field';
    name: string | symbol;
    static: boolean;
    private: boolean;
    access: { get: () => unknown, set: (value: unknown) => void };
    addInitializer(initializer: () => void): void;
  }
) => (initialValue: unknown) => unknown | void;
```
1 改变初始值
2 字段只读性(auto-accessors装饰器无需定义类装饰器) - 在类字段装饰器中收集字段信息, 然后在类装饰器通过替换构造函数 及 收集到的字段信息重新定义字段
3 私有字段可视化 - 通过 access 来控制字段变化
4 依赖注入 - 容器注册实例, 字段注入字段信息
### 类getter和setter装饰器
```ts
// getter 装饰器
type ClassGetterDecorator = (
  value: Function,
  context: {
    kind: 'getter';
    name: string | symbol;
    static: boolean;
    private: boolean;
    access: { get: () => unknown };
    addInitializer(initializer: () => void): void;
  }
) => Function | void;
// setter 装饰器
type ClassSetterDecorator = (
  value: Function,
  context: {
    kind: 'setter';
    name: string | symbol;
    static: boolean;
    private: boolean;
    access: { set: (value: unknown) => void };
    addInitializer(initializer: () => void): void;
  }
) => Function | void;
```
1 计算数值懒处理(lazily) - 首次计算
### 类Auto-Accessor 装饰器
``` ts
type ClassAutoAccessorDecorator = (
  value: {
    get: () => unknown;
    set: (value: unknown) => void;
  },
  context: {
    kind: 'accessor';
    name: string | symbol;
    static: boolean;
    private: boolean;
    access: { get: () => unknown, set: (value: unknown) => void };
    addInitializer(initializer: () => void): void;
  }
) => {
  get?: () => unknown;
  set?: (value: unknown) => void;
  init?: (initialValue: unknown) => unknown;
} | void;
```
1 自定义初始值
2 监管get 和 set 操作

## 相关提案
[阶段0][函数装饰器]()
[阶段0][方法参数装饰器]()
[阶段3][Decorator Metadata](https://github.com/tc39/proposal-decorator-metadata)
[阶段2][Pipeline Operator](https://github.com/tc39/proposal-pipeline-operator)


## legacy版本
[介绍Decorator](https://mirone.me/a-complete-guide-to-typescript-decorator/)
[Typescript Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html)

由于目标对象是允许多次被装饰的, 但是需要注意执行顺序:
``` ts
function outside(str: string) {
  console.log('outside: ', str)
  return function () {
    console.log('outside decorator: ', str)
  }
}

function inner(str: string) {
  console.log('inner: ', str)
  return function () {
    console.log('inner decorator: ', str)
  }
}

class HelloTest {
  @outside('A')
  @inner('B')
  name: string;

  constructor(name: string) {
    this.name = name
  }
}
new HelloTest('Hello')
// => outside: A
// => inner: B
// => inner decorator: B
// => outside decorator: A
```


与当前版本相比: 不同类型的装饰器定义不一样

Class装饰器
``` ts
type ClassDecorator = <TFunction extends Function>
  (target: TFunction) => TFunction | void;
```

Property装饰器
``` ts
type PropertyDecorator =
  (target: Object, propertyKey: string | symbol) => void;
```
这里的 target 是当前类原型对象 而不是类实例


Method装饰器
``` ts
type MethodDecorator = <T>(
  target: Object,
  propertyKey: string | symbol,
  // 当前函数的定义描述
  descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;
```

Accessor装饰器
``` ts
type AccessorDecorator = <T>(
  target: Object,
  propertyKey: string | symbol,
  // 当前get/set函数的定义描述
  descriptor: TypedPropertyDescriptor<T>
) => TypedPropertyDescriptor<T> | void;
```

Parameter装饰器
``` ts
type ParameterDecorator = (
  target: Object,
  // 方法名, 不是参数名
  propertyKey: string | symbol,
  // 参数索引
  parameterIndex: number
) => void;
```

Metadata - 元数据(TS)
通过 reflect-metadata 依赖, 可用于收集被装饰对象的元数据
如果开启 emitDecoratorMetadata 配置, 并引入 reflect-metadata, 则TS会自动收集部分信息:
Reflect.getMetadata(key, target, value), 其中key值为:
**design:type**
**design:paramtypes**
**design:returntype**

``` ts
import "reflect-metadata"
function hello (str: string) {
  return function (target: any, propertyKey: string) {
    ...
    // 当前属性绑定数据类型
    let type = Reflect.getMetadata("design:type", target, propertyKey);
    ...
  }
}

class MyClass {
  @hello('Hello')
  name: string;
}

// -- 等价于 --

class MyClass {
  @hello('Hello')
  @Reflect.metadata("design:type", String)
  name: string;
}
```

使用场景
1. 前置/后置钩子
2. 监听属性变化 和 函数调用
3. 参数变更
4. 添加额外的方法和属性
5. 运行时类型校验
6. 依赖注入(DI)

