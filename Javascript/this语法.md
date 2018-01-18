### this 语法

#### Why
> the this mechanism provides a more elegant way of implicitly "passing along" an object reference, leading to cleaner API design and easier re-use.

优雅的传递对象, 使得API设计更加简单和复用.

---------------
#### What
> this is not an author-time binding but a runtime binding. It is contextual based on the conditions of the function's invocation. this binding has nothing to do with where a function is declared, but has instead everything to do with the manner in which the function is called.

> When a function is invoked, an activation record, otherwise known as an execution context, is created. This record contains information about where the function was called from (the call-stack), how the function was invoked, what parameters were passed, etc. One of the properties of this record is the this reference which will be used for the duration of that function's execution.

不像词法作用域, **this**不是在author-time确定的, 而是在run-time才绑定的.当函数执行时, 引擎会创建一个被称为activation record对象, 该对象记录了大量与函数执行相关的信息, 其中就有一个属性与this相关.

---------------
#### call-site
> the location in code where a function is called (not where it's declared)

引擎会分析call-site, 从而确定this对象, 目前有四种形式:

- Default Binding
```javascript
foo();
```
- Implicit Binding
```javascript
obj.foo();
```
- Explicit Binding
```javascript
foo.call(obj);
foo.apply(obj);
=========================
let foo2 = foo.bind(obj);
foo2();
```
- new Binding
```javascript
new Clazz(...);
```

---------------
待续...








