# 探索 vue 包中暴露的API

1. createApp / createSSRApp - 创建应用实例

``` javascript
import { createApp } from 'vue'
createApp(App) 
  .mount('#app')
```


2. render / hydrate - 渲染目标节点vNode
``` javascript
import { render } from 'vue'
render(vNode, containerElement)
```

3. defineCustomElement / defineSSRCustomElement - 创建自定义元素
``` javascript
import { defineCustomElement } from 'vue'
let HelloWorld =  defineCustomElement({
  props: {},
  data () {
    return {
    }
  },
  render () {
    return <div>...</div>
  }
})
customElements.defind('hello-world', HelloWorld)
```

4. useCssModule - 获取当前组件的cssModule数据
``` javascript
import { useCssModule, defineComponent } from 'vue'
defineComponent({
  setup() {
    ...
    let cssModule = useCssModule('name')
    ...
  }
})
```

5. useCssVars -- 设置 css 变量
``` javascript
import { useCssVars, defineComponent, ref } from 'vue'
defineComponent({
  setup() {
    ...
    // 步骤1: 添加css变量在当前组件的有效父节点上
    // 步骤2: 当绑定的变量 cssVarValue 发生变化时, 则css变量会同时发生变化
    let cssVarValue = ref('1rem')
    let cssModule = useCssVars((ctx) => {
      return {
        ...
        cssVarName: cssVarValue,
        ...
      }
    })
    ...
  }
})
```

6. Transition / TransitionGroup 组件

-------------- 来自于 @vue/runtime-core --------------
@vue/reactivity 部分
通过Proxy方式监控数据的操作, 并且将其与Effect建立其关系. 基本逻辑是:
1 当执行 **读取(get)** 时, 此时当前的执行上下文中包含 ReactiveEffect(fn), 并且通过Proxy得知操作对象(Target), 操作目标(Key), 最终将三者关联在一起

2 当执行 **写入(set)** 时, 又会通过Proxy得到的 操作对象(Target), 操作目标(Key), 然后得到与其关联的 ReactiveEffect(fn), 最后安排执行其绑定的 fn 函数.

由于不同使用场景所要求的性能不同, 因此vue内部提供了不同的策略来监控数据的变化:
1. 只读模式 -- readonly等
2. 深浅模式 -- reactive / ref / shallowReactive / shallowRef等

在vue3中, 还引入了一种数据类型: Ref, 其结构如下
```javascript
interface Ref<T> {
  value: T;
}
```
如果在Template中使用Ref对象, vue会自动使用其 value 属性, 但是在js代码中必须手动通过ref.value来进行读写操作.

当然为了提供便利, vue3也提供了Babel插件 @vue/reactivity-transform, 可以直截了当的方式使用Ref

如果不使用Babel插件, 则可以通过vue3内置的方法来辅助:
```javascript
import { unref, proxyRefs } from 'vue'
```

7. customRef(factory) - 创建一个可自定义控制读写行为的Ref
内置的ref方法中, 其 get/set 都是内置逻辑实现的, 该方法可以实现更加自由的Ref行为
```javascript
import { customRef } from 'vue'
let val = customRef((track, trigger) => {
  function get () {
    ...
    // 启动监听
    track()
    ...
  }
  function set (value) {
    ...
    // 启动触发
    trigger()
    ...
  }
  return {
    get,
    set
  }
})

```


8. computed 函数
创建出一个类似Ref类型的对象 **ComputedRefImp**
该对象同样支持自定义 getter 和 setter 方法, 其核心目的是:
在使用该类型数据时:
- 首先会将该对象 和 当前上下文 ReactiveEffect(fn) 建立关系
- 然后创建一个 ReactiveEffect(getter) 对象, 目的是为了监听 getter 内使用的可监控数据
- 当 getter 内被监控的数据发生变化, 则会首先触发 ReactiveEffect(getter) 绑定任务清单
- 执行定时器, 再触发与 ComputedRefImp 关联的 ReactiveEffect(fn) 任务清单

``` javascript
  import { computed, ref, unref, watchEffect } from 'vue' 
  let count = ref(0)
  let addOneCount = computed(() => {
    return unref(count) + 1
  })

  watchEffect(() => {
    console.log(unref(addOneCount))
  })

  // 每次执行addCount时, 都会同时触发 log 日志
  function addCount () {
    count.value += 1
  }

```

9. watch / watchEffect / watchPostEffect / watchSyncEffect
在 Vue 内部, 不同的watch方法, 其工作原理是相同:
- 根据传入的参数, 创建一个getter方法
- 在根据参数及配置信息的不同, 创建一个job任务
- 根据配置信息(post/sync/pre), 创建 scheduler(job) 定时器
- 根据上面getter 和 scheduler, 创建一个 ReactiveEffect(getter, scheduler)
- 执行 effect.run, 触发 getter , 从而监控 getter 内使用的数据源
- 安排执行 scheduler 任务

watch模式
比较模式
```javascript
import { watch, ref } from 'vue'
let value = ref(0)
function cb (oldValue, newValue) {
  // TODO 新旧比较
}
// 当 value 变化时, 会根据 value 的前后变化值来决定是否需要执行cb函数
watch(value, cb, { ... })
```

effect模式
```javascript
import { watchEffect, ref, unref } from 'vue'
let value = ref('')
function cb () {
  console.log(unref(value))
}
// 当 value 变化时, 则会再次执行cb
watchEffect(cb)
```


watch配置信息:
```ts
interface WatchOptions {
  // 是否立即执行一次任务(job) - 比较模式
  immediate?: boolean
  // 是否深度比较 - 比较模式
  deep?: boolean,
  // 刷新策略(默认为 pre)
  // pre:  在页面渲染前 执行 任务(job)
  // post: 在页面渲染后 执行 任务(job)
  // sync: 每次变化时立即 执行 任务(job)
  flush?: 'pre' | 'post' | 'sync',
  // --- DEV 模式有效 ---
  // 当数据可被监控时, 则触发该方法
  onTrack?: (event: DebuggerEvent) => void
  // 当监控数据变化时, 则触发该方法
  onTrigger?: (event: DebuggerEvent) => void
}
```

当 配置信息 deep = true 时, 则在vue内部, 会对数据源做一次深度递归遍历操作:
对 数据类型 为 Object, 则会读取对象的每一项
对 数据类型 为 Array, 则会通过for循环遍历该数组
对 数据类型 为 Ref, 则会读取Ref.value
对 数据类型 为 Map 或 Set, 做会通过forEach遍历
以上处理的目的, 是为了将watch内部创建的ReactiveEffect 与 数据源深度绑定, 因此当数据源内部变化时, 则会触发绑定任务

10.  withDirectives - 动态注册指令
由于SFC 和 [JSX](https://github.com/vuejs/babel-plugin-jsx)均支持 v-xx 语法, 因此不太需要手动注册指令

```javascript
import { withDirectives } from 'vue'
// 可以动态的为组件注册指令
let vNode = withDirectives(<MyComponent></MyComponent>, [
  ...
  [ dir: {}, value, arg, modifiers = {}]
  ...
])

```

11.  createRenderer / createHydrationRenderer - 自定义vue渲染方式
如果使用该方法, 通常目的是为了让vue支持不同运行环境, 内置的环境是[DOM](https://www.npmjs.com/package/@vue/runtime-dom)

如果有能力的话 可以利用该方法来支持其他环境: 移动应用/小程序/桌面应用等等

```javascript
import { createRenderer } from 'vue'

  let myRender = createRenderer({
    // 定义各种用于处理节点的钩子函数
    ...
    patchProp, // 修补属性
    insert, // 插入
    remove // 删除
    ...
  } as RendererOptions)

```

12. resolveComponent / resolveDirective / resolveDynamicComponent - 通过name来解析出组件/指令/动态组件
分别从当前组件 和 appContext 中找寻所需要的数据

13. registerRuntimeCompiler - 注册运行时模板编译器
如果不使用 SFC 或 JSX, 且不提供render方法的情况下, 而是提供 template 字符串, 此时vue内部在运行中完成编译工作, 将 template 转换成 render 函数

14. defineExpose / 组件选项 expose / setup上下文 expose 方法
在 vue 3中引入了 expose 的概念, 在构建组件实例, 会在生成 instance.exposed = {...}, 后续需要引用该组件时会将其暴露
```javascript
import { defineComponent } from 'vue'
// 在创建组件实例时,
export default defineComponent({
  ...
  expose: ['key1', 'key2']
  ...
})
```
```javascript
import { ref } from 'vue'
let value = ref(0)
defineExpose({
  value
})
```

```javascript
import { ref, defineComponent } from 'vue'
export default defineComponent({
  setup(props, { expose }) {
    return () => {
      expose({
        value: ref(0)
      })
      return <div>...</div>
    }
  }
})
```
