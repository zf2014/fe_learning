### Pure Function
-------------------
> So far, we've defined function purity both as a function without side causes/effects and as a function that, given the same input(s), always produces the same output. These are just two different ways of looking at the same characteristics.

> But a third way of looking at function purity, and perhaps the most widely accepted definition, is that a pure function has referential transparency.

> Referential transparency is the assertion that a function call could be replaced by its output value, and the overall program behavior wouldn't change. In other words, it would be impossible to tell from the program's execution whether the function call was made or its return value was inlined in place of the function call.

<span style="color: red;">**总结**</span>
1.without side cause/effect -- 无副作用
2.always same output -- 总是有输出结果
3.has referential transparency -- 引用透明

 
####Anonymous vs. Named
-----------------------
匿名函数3个缺点:

1.Anonymous functions have no useful name to display in stack traces, which can make debugging more difficult.
<span style="color: red;">debug不方便</span>

2.Without a name, if the function needs to refer to itself, for recursion, etc., the deprecated arguments.callee reference is unfortunately required. Another example of needing to self-reference is when an event handler function wants to unbind itself after it fires.
<span style="color: red;">不方便自我引用(取消事件)</span>

3.Anonymous functions omit a name that is often helpful in providing more readable/understandable code. A descriptive name helps self-document the code in question.
<span style="color: red;">可读性差</span>