# Decorator - 装饰器

[Decorator演化史](https://2ality.com/2022/10/javascript-decorators.html#history-of-decorators)

## 官方版本 & Typescript5.0
阶段3

[官方规范文档](https://github.com/tc39/proposal-decorators)
[介绍Decorator](https://2ality.com/2022/10/javascript-decorators.html)

Decorator 本质上属于一种元编程([metaprogramming](https://codedocs.org/what-is/metaprogramming)), 可以为被装饰的值添加功能, 但是又不改变其本质行为.

基本语法:
``` ts
@defineElement("my-class")
class C extends HTMLElement {
  @reactive accessor clicked = false;
}
```

三大基本功能:
1. 替换功能 - 数据替换/方法替换/类替换等等
2. 共享功能 - 通过特定存储器来记录被修饰的变量, 然后共享给其他地方使用
3. 增强功能 - 支持执行额外的功能

服务对象:
1. Class
2. Class Field(静态和非静态)
3. Class Method(静态和非静态)
4. Class Accessor Method(静态和非静态)
5. [Class auto accessors](https://github.com/tc39/proposal-grouped-and-auto-accessors#auto-accessors)

工作原理:
1. Evaluation(求值): 在定义Class的过程中执行, 并且结果是方法, 等待下一步被执行
2. Invocation(启动): 在Class构造函数触发前, 调用上一步得到的函数
3. Application(应用): 应用所有Decorator的执行结果

执行顺序:
1. Evaluating Decorators
执行顺序: 从上到下, 从左到右, 
2. Invocation Decorators
执行顺序: 和上面的顺序相反
入参: Input 和 Conext
出参: Output
``` ts
type Decorator = (value: Input, context: {
  kind: string;
  name: string | symbol;
  access: {
    get?: () => unknown;
    set?: (value: unknown) => void;
    init?:(initialValue: unknown) => unknown
  };
  private?: boolean;
  static?: boolean;
  addInitializer?: (initializer: () => void): void;
}) => Output | void;
```
服务对象的不同, 那么传入的Input 和 Context也有所差异.
3. Application Decorators
对于服务对象为Class的装饰器, 只有当前Class下的所有Field和Method的装饰器都被执行了, 那么该Class的装饰器可以称为Applied

addInitializer
除 Class Field 装饰器定义中, 入参Context对象中都有一个 addInitializer 函数, 允许开发者注册 **initializer** 方法, 并且这些 initializer方法会在特定时机内触发:
1. Class装饰器: Class定义完成之后
2. Class 非静态元素装饰器: Class构建过程之中, Class Field初始化之前
3. Class 静态元素装饰器: 静态Class Field初始化之前, Class 元素定义之后

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

@init class TheClass {
  //--- Static ---
  static {
    pushStr('static block');
  }
  @init static staticMethod() {}
  @init static accessor staticAcc = pushStr('staticAcc');
  @init static staticField = pushStr('staticField');

  //--- Non-static ---
  @init prototypeMethod() {}
  @init accessor instanceAcc = pushStr('instanceAcc');
  @init instanceField = pushStr('instanceField');

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
// @init staticMethod -- 静态元素装饰器定义
// @init staticAcc
// @init prototypeMethod -- 非静态元素装饰器定义
// @init instanceAcc
// @init staticField -- 静态属性
// @init instanceField -- 类属性
// @init TheClass --- 类装饰器定义
// DECORATOR INITIALIZER staticMethod (this===TheClass) -- 静态元素 INITIALIZER 方法
// DECORATOR INITIALIZER staticAcc (this===TheClass)
// static block -- 静态元素初始化
// staticAcc
// staticField
// DECORATOR INITIALIZER TheClass (this===TheClass) -- class INITIALIZER 方法
// ===== Instantiation =====
// DECORATOR INITIALIZER prototypeMethod (this===inst) -- 非静态元素 INITIALIZER 方法
// DECORATOR INITIALIZER instanceAcc (this===inst)
// instanceAcc -- 非静态元素初始化
// instanceField
// constructor -- 构造函数
```


this在不同场景代表的不同的对象
| this is →                         | undefined | Class | Instance |
|-----------------------------------|-----------|-------|----------|
| Decorator function                |     ✔     |       |          |
| Static initializer                |           |   ✔   |          |
| Non-static initializer            |           |       |     ✔    |
| Static field decorator result     |           |   ✔   |          |
| Non-static field decorator result |           |       |     ✔    |


## 非官方版本 - legacy版本
[介绍Decorator](https://mirone.me/a-complete-guide-to-typescript-decorator/)
由于历史原因, 在官方版本之前, 已经存在非官方版本的Decorator, 我们称为legacy 版本. 其中Babel 和 Tyepscript(需要开启 experimentalDecorators)都有其实现方案.

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


与官方版本相比: 不同类型的装饰器定义不一样

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
function Hello (str: string) {
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
