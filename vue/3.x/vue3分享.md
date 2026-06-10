# Vue3 入门

## 为什么需要Vue3
### vue3发展过程
![图片](https://media.slid.es/uploads/1038923/images/9404006/horizontal-arrow-timeline.png)


### Vue 3 给开发者带来了什么？
- 更高的性能 -- patchFlag标识/Proxy代理/事件缓存  
[vue2 vs vue3 各浏览器性能比较](https://docs.google.com/spreadsheets/d/1VJFx-kQ4KjJmnpDXIEaig-cVAAJtpIGLZNbv3Lr4CR0/edit#gid=0)

- 结构清晰的代码 -- monorepo方式 -- pnpm
- 更高的开发效率 -- 组合式API/支持Fragment/代码复用/命名冲突
- 支持TypeScript -- Flow vs Typescript


## Vue3 值得关注的新特性
- [组合式API](https://v3.cn.vuejs.org/guide/composition-api-introduction.html) -- reactive / inject / onMounted等  
选项式API vs 组合式API  
[Mixin问题](https://cn.vuejs.org/guide/reusability/composables.html#comparisons-with-other-techniques)

- [Teleport](https://v3.cn.vuejs.org/guide/teleport.html)
- [Suspense​](https://cn.vuejs.org/guide/built-ins/suspense.html) 
- [Fragment](https://v3.cn.vuejs.org/guide/migration/fragments.html)
- [触发组件选项](https://v3.cn.vuejs.org/guide/component-custom-events.html)
- [@vue/runtime-core 的 createRenderer API](https://github.com/vuejs/core/blob/main/packages/runtime-core/src/renderer.ts#L292)，用于创建自定义渲染器
- [单文件组件组合式 API 语法糖 \<script setup>](https://v3.cn.vuejs.org/api/sfc-script-setup.html)
- [单文件组件状态驱动的 CSS 变量 \<style> 中的 v-bind](https://cn.vuejs.org/api/sfc-css-features.html#v-bind-in-css)
- [SFC \<style scoped> 现在可以包含全局规则或只针对插槽内容的规则](https://cn.vuejs.org/api/sfc-css-features.html#scoped-css)


## 怎么开始使用 Vue3

``` bash
npm create vite
```

```javascript
import { createApp } from 'vue'
// 根组件
import App from './App.vue'

let app = createApp(App)
...
app.use(/* 插件 */)
...
app.mount('#app')
```