# 前言
在 vue3 源码中, 有4个和编译相关的库:
@vue/compiler-ssr
@vue/compiler-sfc
@vue/compiler-dom
@vue/compiler-core

前三个库是针对不同环境所提供的不同的解析/编译配置, @vue/compiler-core 则是vue3的核心编译工具.

@vue/compiler-ssr: 为 SSR 满足服务端渲染提供编译配置
@vue/compiler-sfc: 为 SFC 满足单文件渲染提供编译配置, 其中根据 vue 文件的特性, 提供了三种核心编译工具: compileTemplate / compileStyle / compileScript
@vue/compiler-dom: 为 DOM 满足浏览器渲染提供编译配置

@vue/compiler-core: 提供 parse 和 compile 两种能力
parse: 将 template 内容转化为 类似DOM树一样的节点信息树

compile: 对每个节点做 transform 处理, 从而使得原先的Node节点上带有 codegenNode 信息, 最终通过 generate 生成符合 vue 逻辑的代码片段


## parse 阶段
因为 parse 传入的配置参数不同, 那么其处理逻辑也不同, 咱们这里以处理 .vue 文件中的 template 内容为例:

在处理过程中, 最终包装成一颗节点树:
```javascript
const ROOT = {
  type: NodeTypes.ROOT,
  children: [
    ...,
    {
      type: NodeTypes.Any,
      content: {
        type: NodeTypes.Any,
        content,
        loc // 内容坐标信息
      },
      loc // 节点坐标信息
    },
    ...
  ]
}
```

**[递归操作]** 根据不同类型的节点得出不同结构的节点对象:
- NodeTypes.TEXT - 表示 文本类型 元素
  ``` javascript
  let Node = {
    type: NodeTypes.TEXT,
    content,
    loc // 节点坐标信息
  }
  ```

- NodeTypes.INTERPOLATION - 表示 {{ content }} 语法
  ``` javascript
  let Node = {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content,
      isStatic,
      constType,
      loc // 内容坐标信息
    },
    loc // 节点坐标信息
  }
  ```

- NodeTypes.COMMENT - 表示 \<\!-- content  --> | \<\!DOCTYPE ... >
  ``` javascript
  let Node = {
    type: NodeTypes.COMMENT,
    content,
    loc // 节点坐标信息
  }
  ```

- NodeTypes.ELEMENT - 表示 \<ElmentName props>...\</ElmentName>
  ```javascript
  let Node = {
    type: NodeTypes.ELEMENT,
    ns,
    tag,
    // 根据元素节点不同, 表示不同的元素类型
    // ElementTypes.ELEMENT - 除了一下情况
    // ElementTypes.SLOT -  slot 标签
    // ElementTypes.TEMPLATE  - 带 if 或 for 的 template
    // ElementTypes.COMPONENT - component | vue 内置组件 | 首字母为大写 | 非html元素 | is="vue:xxx"属性 | v-is 属性 | :is="xx"
    tagType,
    props, // 节点上属性
    isSelfClosing, // 是否为自闭节点
    children, // 表示当前元素的所有子节点(递归)
    loc,
    codegenNode: undefined // to be created during transform phase
  }
  ```
  在 解析Element的过程中, 会同时伴随着解析当前元素的属性 和 children节点:

  由于该模板解析器是 vue 框架下的解析器, 因此支持 vue 允许的语法规则, 并且会使用特定的类型加以标注.
  属性的基本语法是:
  ```javascript
  <TagName attrName="attrValue" ></TagName>
  ```
  - 在解析元素属性时, 得到原始的属性值: attrName 和  attrValue
  - 分别对 attrName 和 attrValue 进行分析处理
    - attrValue: 处理属性值
      ``` javascript
      let value = {
        content, // 属性值
        isQuoted, // 是否带引号
        loc // 坐标信息
      }
      ```


    - attrName: 处理属性名

      ###### 指令属性: 以 v-xx | # | @ | : | . 开头的属性
        ``` javascript
        // 匹配规则
        let rName = /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i
        // 识别 v-xx:name.modifiers 指令
        // 识别 #name v-slot:name 指令简写
        // 识别 @name v-on:name 指令简写
        // 识别 .name v-bind:name 指令简写
        // 识别 :name v-bind:name 指令简写
        ```
        
        指令的参数信息
        ``` javascript
          // 例如: v-slot:name, 则 v-slot 指令参数 name
          let arg = {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content,
            isStatic,
            constType,
            loc // 节点坐标信息
          }
        ```

        指令的修饰符信息
        ``` javascript
          // 例如: v-slot:name.m1.m2, 修饰符为 [m1, m2]
          let modifiers = [m1, m2]
        ```

        指令属性的数据结构:
        ``` javascript
          let dirProp = {
            type: NodeTypes.DIRECTIVE,
            name,
            exp: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: value.content,
              isStatic: false,
              constType: ConstantTypes.NOT_CONSTANT,
              loc: value.loc
            },
            arg,
            modifiers
            loc // 坐标信息
          }
        ```

      ###### 非指令属性:
      ``` javascript
      let prop = {
        type: NodeTypes.ATTRIBUTE,
        name,
        value: value && {
          type: NodeTypes.TEXT,
          content: value.content,
          loc: value.loc
        },
        loc
      }
      ```
## compile - transform 阶段
将 parse 阶段收集得到的节点树, 根据每个节点的特性, 做一次转换(transform)处理, 目的是在节点上增加代码生成的功能
在处理节点时, 会根据不同的处理方法, 完成处理工作:
在 transform 过程中, 分为 **两种** 不同类型的处理方式, 且都允许外部配置:
节点型
内置:
---core---
transformOnce
transformIf
transformMemo
transformFor
transformFilter(兼容v2版)
trackVForSlotScopes
transformExpression
transformSlotOutlet
transformElement
trackSlotScopes
transformText
---DOM---
ignoreSideEffectTags
transformStyle
---自定义---
TODO

指令型
内置:
---core---
transformOn
transformBind - 处理 v-bind
transformModel
---DOM---
noopDirectiveTransform
transformVHtml - 处理 v-text
transformVText - 处理 v-text
transformModel - 覆盖 core | 处理 v-modal
transformOn - 覆盖 core | 处理 v-on
transformShow - 处理 v-show
---自定义---
TODO

工作流程:
- ★创建一个 context 作用域
- ★递归遍历所有节点, 收集关键数据 及创建 codegenNode 内容
- 添加静态提升
- 创建根节点的 codegenNode 内容
- 将 context 中关键数据转移到根节点上: helpers, components, directives, imports, hoists, temps, cached

如何处理节点?
在 parse 阶段, 我们收集到的节点类型如下:
**NodeTypes.ROOT**
**NodeTypes.INTERPOLATION**
**NodeTypes.TEXT**
**NodeTypes.COMMENT**
**NodeTypes.ELEMENT**

### nodeTransforms 配置的作用:
1 修改 当前节点信息
2 生成 codegenNode 信息

在 调用nodeTransforms过程中, 可能会每个 nodeTransform 方法返回结果可能也是一个方法(onExit), 该onExit方法会在当前节点完成 transform 后被触发, 而其调用顺序 和 nodeTransform 执行顺序相反.


### transformText:
创建一个新的节点Node:
``` javascript
{
  type: NodeTypes.TEXT_CALL,
  content,
  loc:,
  codegenNode: {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee: 'createTextVNode',
    arguments // 创建TextVNode所需要的参数
  }
}
```

### transformElement:
在该内置的元素转换方法中, 将会完成以下工作:
- 确定当前元素的组件的Tag标签: html元素 | 动态组件 | 静态组件 | 内置组件
- 处理当前元素的属性:

  收集 props
  收集 directives
  收集 dynamicPropNames
  确定 patchFlag
  确定 shouldUseBlock 

  ------------收集 props--------------
  收集 prop.type === NodeTypes.ATTRIBUTE, 包括 ref 和 key
  收集 prop.type === NodeTypes.DIRECTIVE 下的 v-bind 和 v-on 指令的数据

  最终结果是
  ``` javascript
    let properties = [
      ...,
      {
        type: NodeTypes.JS_PROPERTY,
        loc,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          loc,
          content,
          isStatic,
          constType
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          loc,
          content,
          isStatic,
          constType
        }
      },
      ...
    ]

    return {
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      loc,
      properties
    }
    // 或者
    return {
      type: NodeTypes.JS_CALL_EXPRESSION,
      loc,
      callee: 'mergeProps',
      arguments: [
        ...properties,
        { // 通过 v-on="obj"
          type: NodeTypes.JS_CALL_EXPRESSION,
          loc,
          callee: 'toHandlers',
          arguments
        },
        { // 通过 v-bind="obj"
          type: NodeTypes.SIMPLE_EXPRESSION,
          content,
          isStatic,
          constType,
          loc
        }
      ]
    }
    ```
  ------------收集 directives--------------
  1 触发 directiveTransforms 指定的指令转换器
  2 收集 非内置指令名

  ------------确定 patchFlag--------------
  PatchFlags.FULL_PROPS - 表示是否有动态属性 - \<TagName :[name]="value"><\/TagName>
  PatchFlags.CLASS - 表示非组件是否有class属性
  PatchFlags.STYLE - 表示非组件是否有style属性
  PatchFlags.PROPS - 表示是否存在属性 - :name="value"
  PatchFlags.HYDRATE_EVENTS
  PatchFlags.NEED_PATCH
  PatchFlags.DYNAMIC_SLOTS - 针对 KEEP_ALIVE 组件 或 存在 v-slot:[name] 属性
  PatchFlags.TEXT - TEXT型节点(INTERPOLATION 或 COMPOUND_EXPRESSION) 或 非常量型节点

  ------------处理 children 节点--------------
  处理节点的children, 分为两种情况:
  1 非组件型节点 - 直接使用
  2 组件型节点(排除 Teleport 和  KeepAlive 组件)

  如果是第2种情况, 则需要对该组件的children节点做适当的处理:
  处理 v-slot:slotName 指令节点(slotName)
  处理 无 v-slot 指令节点(slotName = default)
  处理 v-slot 且 v-if 指令节点
  处理 v-slot 且 v-for 指令节点

  最终, 会将 children 节点包装成两种类型节点:
  ``` js
  // 无动态插槽
  { type: NodeTypes.JS_OBJECT_EXPRESSION, ... }
  // 动态插槽
  {
    type: NodeTypes.JS_CALL_EXPRESSION,
    callee: 'createSlots',
    arguments: [...],
    ...
  }
  ```

最终生成 codegenNode 数据:
``` js
{
  ...,
  codegenNode: {
    type: NodeTypes.VNODE_CALL,
    tag, // 节点名称
    props, // 当前节点属性
    children, // 当前节点子节点 或 slot插槽
    patchFlag,
    dynamicProps,
    directives, // 指令
    isBlock,
    disableTracking,
    isComponent,
    loc
  }
}
```

### transformIf: 处理 v-if / v-else-if / v-else
处理机制:
步骤一: 创建 IFNode, 同时创建 branch 分支节点
``` javascript
{
  type: NodeTypes.IF,
  branches: [
    { type: NodeTypes.IF_BRANCH, children: [...] }, // v-if
    { type: NodeTypes.IF_BRANCH, children: [...] }, // v-else-if 可选, 多个
    { type: NodeTypes.IF_BRANCH, children: [...] }, // v-else 可选
  ]
}
```

步骤二: 创建 codegenNode(嵌套): 
``` javascript
{
  type: NodeTypes.IF,
  codegenNode: {
    type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
    test,
    consequent: {
      type: NodeTypes.VNODE_CALL,
      ...
    },
    alternate: {
      type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
      test,
      consequent,
      alternate, // 根据 if 语句的数量决定嵌套层数
      ...
    },
    ...
  },
  branches: [
    ...
  ]
}
```

### transformOnce: 
处理条件: NodeTypes.ELEMENT 且 存在 v-once 属性
处理结果:
创建一个可缓存的 codegenNode
``` javascript
  let codegenNode = {
    type: NodeTypes.JS_CACHE_EXPRESSION,
    index,
    value, // 在未处理 v-once 时 创建的 codegenNode
    isVNode: true,
    loc
  }
```

transformMemo:
处理条件: 
NodeTypes.ELEMENT 且 存在 v-memo 指令

处理结果:
``` javascript
{
  type: NodeTypes.JS_CALL_EXPRESSION,
  loc,
  callee: 'withMemo',
  arguments: [
    {
      type: NodeTypes.JS_FUNCTION_EXPRESSION,
      params,
      returns,
      newline,
      isSlot,
      loc
    },
    '_cache',
    cachedId
  ]
}
```

### transformFor: 处理 for 循环
前置条件: NodeTypes.ELEMENT 且 存在 v-for 指令

处理过程:
步骤一: 处理 v-for="exp" 中的 **exp** 表达式

``` javascript
// 匹配 v-for="(item, index) in source" 表达式
let rExp = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
let [_, LHS, RHS] = exp.match(rExp) 
// LHS = (item, index)
// RHS = source

let forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
let [_, key, index] = LHS.match(forIteratorRE) 
// key = item
// index = index

// => 输出结果:
{
  source: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content: '_ctx.source',
    isStatic,
    constType
  },
  value: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content: '_ctx.item, _ctx.index',
    isStatic,
    constType
  },
  key: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content: '_ctx.item',
    isStatic,
    constType
  },
  index: {
    type: NodeTypes.SIMPLE_EXPRESSION,
    loc,
    content: 'index',
    isStatic,
    constType
  }
}
```



步骤二: 创建FOR节点, 并替换当前节点
``` javascript
{
    type: NodeTypes.FOR,
    loc,
    source,
    valueAlias,
    keyAlias,
    objectIndexAlias,
    parseResult, // 表达式处理结果
    children: isTemplateNode(node) ? node.children : [node]
  }
```

步骤三: 创建 codegenNode
``` javascript
{
  type: NodeTypes.FOR,
  loc,
  source,
  valueAlias,
  keyAlias,
  objectIndexAlias,
  parseResult, // 表达式处理结果
  children: isTemplateNode(node) ? node.children : [node],
  codegenNode: {
    type: NodeTypes.VNODE_CALL,
    tag: 'Fragment',
    children: {
      type: NodeTypes.JS_CALL_EXPRESSION,
      loc,
      callee: 'renderList',
      arguments: [
        // 渲染源
        source,
        // 渲染项函数
        renderItem: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params,
          returns,
          newline,
          isSlot,
          loc,
          body
        },
        ...
      ]
    }
    ...
  }
}
```

步骤四: 完善 codegenNode 中 renderList 的参数


### transformFilter - 兼容 vue2 过滤器
处理流程:
步骤一: 遍历 NodeTypes.SIMPLE_EXPRESSION 节点

步骤二: 逐字遍历 当前节点的 content 内容

步骤三: 收集 所有 filter 

步骤四: 改写 当前节点的 content = filter1(filter2(...filterN(expression, argsN), args2), args1)


### transformExpression - 表达式转换
处理 NodeTypes.INTERPOLATION 类型节点中的 content

处理 NodeTypes.ELEMENT 类型节点中, 非静态型指令属性的表达式(除 v-for 和 v-on:args)
``` js
// 根据 当时使用语境不同, 转换逻辑不同
// 例如:
// data 会被转换为 _ctx.data 或 _ctx.data.value 等等
```

### transformSlotOutlet - 处理 slot 节点
前置条件: 必须是 slot 节点

处理逻辑:
步骤一: 分析 slot 节点, 得到 slotName 和 slotProps
根据 当前节点的属性名 为 name 属性作为 该槽的名称(slotName), 否则为 default
收集 当前节点的其他属性, 作为该槽的作用域(slotProps), 排除运行时指令(部分内置指令 和 自定义指令)


步骤二: 创建 codegenNode 
``` js
{
  type: NodeTypes.ELEMENT,
  tagType: ElementTypes.SLOT,
  codegenNode: {
    type: NodeTypes.JS_CALL_EXPRESSION,
    loc,
    callee: 'renderSlot',
    arguments: [
      '_ctx.$slots', // 当前组件的所有带 v-slot 的 children 节点
      slotName,
      slotProps,
      fallback, // 兜底内容
      ...
    ]
  },
  ...
}
```

### trackVForSlotScopes
### trackSlotScopes 

## compile - generate 阶段
在经过 transform 后, 对原Node Tree做了修缮, 使得Node上包含了 codegenNode 信息, 为本阶段提供有效的数据信息

前置条件:
- 创建一个 CodegenContext 上下文
- 确定代码生成模式: moudle 和 function

生成流程(moudle为例):
- 引入依赖库(vue) 和 vue工具函数(由 template 内容决定) => import { xx as _xx } from 'vue'
- 生成 hoists 变量 => const _hoisted_1 = _ctx.exp1; ...; const _hoisted_N = _ctx.expN
- [开始]创建 render 方法 => export function _render(...){
- 加载 组件 | 指令 | filter 对象 => const componentN = _resolveComponent(...)
- 创建 临时(temp) 变量 => let _temp1, _temp2, ... , tempN
- [结束]根据 Node 生成代码 => return genNode(root.codegenNode); }

genNode:
- NodeTypes.ELEMENT | NodeTypes.IF | NodeTypes.FOR - 递归 codegenNode
  常用于 特殊节点 / if语句 / for语句
  满足上述条件, 连续调用 genNode(node.codegenNode)

- NodeTypes.TEXT - 输出 文案 -> JSON.stringify(node.content)
  常用于 静态文案

- NodeTypes.SIMPLE_EXPRESSION - 输出 表达式 -> _ctx.exp
  常用于 属性定义 / 参数定义等等

- NodeTypes.INTERPOLATION - 输出 占位符 -> _toDisplayString(...)

- NodeTypes.TEXT_CALL 输出 创建Text VNode -> _createTextVNode(Text, flag)

- NodeTypes.COMPOUND_EXPRESSION - 连续输出 当前组件 children 内容

- NodeTypes.COMMENT - 输出 注释

- NodeTypes.VNODE_CALL - 输出 创建VNode 
  如果当前节点上, 存在 directives 自定义指令, 则需要 _withDirectives 包装
  ``` js
  _withDirectives(
    _createVNode(tag, props, children, patchFlag, dynamicProps ),
    [
     [ _resolveDirective(name), value, arg, modifiers ],
     [ _resolveDirective(name), value, arg, modifiers ]
    ]
  )
  ```

- NodeTypes.JS_CALL_EXPRESSION - 输出 调用方法 -> node.callee( node.arguments )

- NodeTypes.JS_OBJECT_EXPRESSION - 输出 Object 对象表达式 -> { key: value, ... }

- NodeTypes.JS_ARRAY_EXPRESSION - 输出 数组格式 -> [...]

- NodeTypes.JS_FUNCTION_EXPRESSION - 输出 函数表达式

``` js
  // 如果是 v-slot 节点, 则需要通过 withCtx 包装
  _withCtx((...) => {
    // 自定义 body 表达式
    node.body
    // 或者
    return node.returns
  }, undefined, true)
```

- NodeTypes.JS_CONDITIONAL_EXPRESSION - 输出 三元表达式 -> condition1 ? value1 : ( condition2 ? value2 : valueN )

``` js
  // 假如在模板中使用 v-if / v-else-if / v-else, 则生成的代码如下:
  // 其中 node3.alternate 内置的逻辑, 将会生成一个注释
  // 中间的层次数量 由 v-else-if 数量决定
  node1.test ? node1.consequent
    : node2.test ? node2.consequent
      : node3.test ? node3.consequent
        : node3.alternate
```

- NodeTypes.JS_CACHE_EXPRESSION - 输出 读取/写入当前组件实例的 cache 数据
  组件使用 v-once 时, 则该组件仅渲染一次

- NodeTypes.JS_BLOCK_STATEMENT - 输出 块状语句

----- SSR -----
- NodeTypes.JS_TEMPLATE_LITERAL - 输出 TemplateLiteral 表达式 -> `${...}` 
- NodeTypes.JS_IF_STATEMENT - 输出 if 语句 -> if(...){ ... } else if(...){ ... } else { ... }
- NodeTypes.JS_ASSIGNMENT_EXPRESSION - 输出 赋值表达式 -> let left = right
- NodeTypes.JS_SEQUENCE_EXPRESSION - 输出 序列表达式 -> (express1, express2, ..., expressN)
- NodeTypes.JS_RETURN_STATEMENT - 输出 返回表达式 -> return ...


