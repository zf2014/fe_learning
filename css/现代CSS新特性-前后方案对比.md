# 现代 CSS 新特性：前后方案对比

> 这份文档对比了每个现代 CSS 特性**出现之前**的"老式方案"和**出现之后**的"现代方案"。
> 帮助你理解为什么这些新特性是真正的进步，以及它们解决了哪些实际痛点。

---

## 目录

1. [布局类](#1-布局类)
2. [选择器类](#2-选择器类)
3. [响应式类](#3-响应式类)
4. [动画与过渡类](#4-动画与过渡类)
5. [颜色与主题类](#5-颜色与主题类)
6. [排版与文本类](#6-排版与文本类)
7. [表单控件类](#7-表单控件类)
8. [代码组织类](#8-代码组织类)
9. [交互类](#9-交互类)
10. [其他实用类](#10-其他实用类)

---

## 1. 布局类

### 1.1 Container Queries vs 媒体查询

**场景**：一个通用卡片组件，在窄容器（侧边栏）和宽容器（主区域）中要有不同布局。

#### 以前（媒体查询 + 硬编码判断）

```css
/* ❌ 需要知道组件被放在哪里，然后写特定选择器 */
.card { display: flex; flex-direction: column; }

/* 侧边栏里的卡片变窄 */
.sidebar .card { padding: 0.5rem; }
.sidebar .card-title { font-size: 0.9rem; }

/* 主区域的卡片变宽 */
.main .card { flex-direction: row; }
.main .card-image { width: 200px; }

/* 如果有 5 个不同区域要放这个卡片...就要写 5 套样式！ */
.dashboard .card { /* ... */ }
.widget .card { /* ... */ }
.modal .card { /* ... */ }
```

**问题**：组件不知道自己的容器大小 → 必须由"父级选择器"决定样式 → 组件不可复用。

#### 现在（容器查询）

```css
/* ✅ 组件自我感知容器大小，放在哪里都自适应 */
.card-wrapper { container-type: inline-size; }

@container (min-width: 400px) {
  .card { flex-direction: row; }
  .card-image { width: 200px; }
}

@container (max-width: 399px) {
  .card { flex-direction: column; }
}
```

**本质改变**：样式逻辑从"放置位置"变为"自身环境"——组件真正可复用。

---

### 1.2 Subgrid vs 嵌套 Grid 各行其是

**场景**：卡片列表，每张卡片有图片、标题、描述，希望所有卡片的同行内容对齐。

#### 以前（手动同步或放弃）

```html
<!-- ❌ 需要给每个项目单独控制高度，或者干脆放弃对齐 -->
<div class="grid">
  <div class="card">
    <img style="height: 200px">  <!-- 硬编码高度 -->
    <h2 style="min-height: 3rem"> <!-- 硬编码高度 -->
    <p>...</p>
  </div>
  ...
</div>
```

```css
/* ❌ 或者用 flex 让所有卡片等高，但内部元素无法跨卡片对齐 */
.grid { display: flex; flex-wrap: wrap; }
.card { display: flex; flex-direction: column; }
.card h2 { flex: 1; }  /* 让标题填充，但图片之间仍不对齐 */
```

#### 现在（Subgrid）

```css
/* ✅ 所有卡片的每一行都完美对齐 */
.card-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
}

.card {
  display: grid;
  grid-template-rows: subgrid;  /* 继承父网格的行轨道 */
  grid-row: span 3;             /* 跨越 3 行 */
}

.card-image { grid-row: 1; }    /* 所有卡片第 1 行都是图片，高度由最长者决定 */
.card-title { grid-row: 2; }    /* 所有卡片第 2 行都是标题，高度对齐 */
.card-body { grid-row: 3; }     /* 所有卡片第 3 行都是描述，高度对齐 */
```

**本质改变**：从"每个网格各自独立" → "子网格共享父网格轨道"。

---

### 1.3 Flexbox `gap` vs margin + 清除

**场景**：一个 flex 容器内的子元素间距。

#### 以前（margin hack）

```css
/* ❌ 经典 flex 间距 hack */
.flex-row {
  display: flex;
}

.flex-row > * + * {
  margin-left: 1rem;  /* 相邻兄弟选择器：除了第一个每个都加 margin-left */
}

/* ❌ 或者用负 margin 包裹层 */
.flex-row {
  display: flex;
  margin: -0.5rem;    /* 负 margin 抵消子元素的 margin */
}
.flex-row > * {
  margin: 0.5rem;
}

/* ❌ 换行时的坑 */
.flex-wrap {
  display: flex;
  flex-wrap: wrap;
  margin: -0.5rem;
}
.flex-wrap > * {
  margin: 0.5rem;
}
/* 注意：负 margin 在某些场景会导致滚动条溢出 */
```

#### 现在（gap）

```css
/* ✅ 一行搞定 */
.flex-row { display: flex; gap: 1rem; }
.flex-wrap { display: flex; flex-wrap: wrap; gap: 1rem; }

/* ✅ grid 也一样 */
.grid { display: grid; gap: 1rem; }
.grid { display: grid; row-gap: 1rem; column-gap: 2rem; }
```

**本质改变**：从"间接 hack" → "语义化间距属性"，代码量减少 90%，无副作用。

---

### 1.4 `aspect-ratio` vs padding-bottom hack

**场景**：一个宽高比固定的图片/视频容器。

#### 以前（padding 百分比 hack）

```css
/* ❌ 经典的 padding-bottom hack */
.video-container {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%;   /* 16:9 → 9/16 = 0.5625 */
  overflow: hidden;
}

.video-container iframe {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}

/* 或者用伪元素 */
.card-image {
  position: relative;
}
.card-image::before {
  content: "";
  display: block;
  padding-bottom: 75%;  /* 4:3 */
}
.card-image img {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  object-fit: cover;
}
```

#### 现在（aspect-ratio）

```css
/* ✅ 一行搞定 */
.video-container iframe {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.card-image img {
  width: 100%;
  height: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}
```

**本质改变**：从"百分比 trick" → "声明式宽高比"。

---

### 1.5 CSS Grid Masonry vs 第三方 JS 库

**场景**：Pinterest 风格的瀑布流布局。

#### 以前（JavaScript 库）

```html
<!-- ❌ 需要引入 heavy 的 JS 库 -->
<script src="https://unpkg.com/masonry-layout@4/dist/masonry.pkgd.min.js"></script>
<script>
  new Masonry('.grid', {
    itemSelector: '.item',
    columnWidth: 200,
    gutter: 20
  });
</script>
```

```css
/* ❌ 或者用多列 + 顺序错乱的 column 布局 */
.masonry {
  columns: 3;
  column-gap: 1rem;
}
.masonry-item {
  break-inside: avoid;    /* 防止被截断到两列 */
  margin-bottom: 1rem;
}
/* ⚠️ 问题：column 布局是从上到下、从左到右排列，不符合实际瀑布流需求 */
```

#### 现在（CSS Grid Masonry）

```css
/* ✅ 原生 CSS，零 JS */
.masonry {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: masonry;
  gap: 1rem;
}
```

**本质改变**：从"JS 计算位置" → "CSS 原生算法"。

---

### 1.6 Anchor Positioning vs JS 算位置

**场景**：Tooltip 弹出方向自适应。

#### 以前（JavaScript 位置计算）

```javascript
// ❌ 每次都要用 JS 计算 tooltip 位置
function positionTooltip(trigger, tooltip) {
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();

  // 尝试放在下方
  let top = triggerRect.bottom + 8;
  let left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;

  // 如果超出视口底部，放到上方
  if (top + tooltipRect.height > window.innerHeight) {
    top = triggerRect.top - tooltipRect.height - 8;
  }

  // 如果超出视口右侧，右对齐
  if (left + tooltipRect.width > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - 8;
  }

  tooltip.style.top = top + 'px';
  tooltip.style.left = left + 'px';
}

// 还要监听滚动、resize...
```

#### 现在（Anchor Positioning）

```css
/* ✅ 纯 CSS 搞定 */
.trigger {
  anchor-name: --tooltip;
}

.tooltip {
  position-anchor: --tooltip;
  position-area: bottom;
  position-try-fallbacks: flip-block, flip-inline;
  /* 自动尝试放在下方、上方、左右，不会溢出视口 */
}
```

**本质改变**：从"命令式 JS 计算" → "声明式 CSS 定位"。

---

## 2. 选择器类

### 2.1 `:has()` 父级选择器 vs JS 类切换

**场景**：表单验证——当输入框无效时，整个表单组变红色。

#### 以前（JavaScript 监听）

```html
<!-- ❌ 需要在 JS 中手动添加/移除类 -->
<div class="form-group">
  <input type="email" class="js-validate">
  <span class="error-msg">请输入有效邮箱</span>
</div>
```

```javascript
// ❌ JS 逻辑散落在各处
document.querySelectorAll('.js-validate').forEach(input => {
  input.addEventListener('blur', () => {
    const group = input.closest('.form-group');
    if (!input.validity.valid) {
      group.classList.add('form-group--error');
    } else {
      group.classList.remove('form-group--error');
    }
  });
});
```

```css
.form-group--error { border-color: red; }
.form-group--error .error-msg { display: block; }
```

#### 现在（:has()）

```css
/* ✅ 纯 CSS，零 JS */
.form-group:has(:invalid) {
  border-color: red;
}
.form-group:has(:invalid) .error-msg {
  display: block;
}
.form-group:has(:focus-within) {
  box-shadow: 0 0 0 2px blue;
}
```

**本质改变**：从"JS 监听 + 类切换" → "CSS 状态回溯选择"。

---

### 2.2 `:is()` / `:where()` vs 选择器重复

**场景**：给文章内所有标题设置相同上边距。

#### 以前（选择器重复）

```css
/* ❌ 冗长重复 */
.article h1,
.article h2,
.article h3,
.article h4,
.article .special-heading {
  margin-top: 2rem;
}

/* ❌ 或者用预处理器 */
.article {
  h1, h2, h3, h4, .special-heading {
    margin-top: 2rem;
  }
}
```

#### 现在（:is()）

```css
/* ✅ 简洁 */
.article :is(h1, h2, h3, h4, .special-heading) {
  margin-top: 2rem;
}

/* ✅ :where() 权重为 0，便于被覆盖 */
:where(.card, .panel, .widget) :where(.title, .heading) {
  font-size: 1.25rem;
}
```

**本质改变**：从"选择器爆炸" → "组合选择器"。

---

### 2.3 CSS Nesting vs 预处理器嵌套

#### 以前（Sass/SCSS）

```scss
// ❌ 需要 Sass 编译，增加了工具链
.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;

  .title {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .body {
    color: #666;
    line-height: 1.6;
  }

  &:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,.1);
  }

  @media (max-width: 600px) {
    border-radius: 0;
    padding: 1rem;
  }
}
```

**或（手动重复）**：
```css
/* ❌ 纯 CSS 需要反复写父选择器 */
.card { background: white; border-radius: 8px; padding: 1.5rem; }
.card .title { font-size: 1.25rem; font-weight: 600; }
.card .body { color: #666; line-height: 1.6; }
.card:hover { box-shadow: 0 4px 12px rgba(0,0,0,.1); }
@media (max-width: 600px) { .card { border-radius: 0; padding: 1rem; } }
```

#### 现在（CSS Nesting）

```css
/* ✅ 原生 CSS，无需编译 */
.card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;

  & .title { font-size: 1.25rem; font-weight: 600; }
  & .body { color: #666; line-height: 1.6; }

  &:hover { box-shadow: 0 4px 12px rgba(0,0,0,.1); }

  @media (max-width: 600px) {
    & { border-radius: 0; padding: 1rem; }
  }
}
```

**本质改变**：从"需要编译工具链" → "原生浏览器支持"。

---

## 3. 响应式类

### 3.1 `clamp()` / `min()` / `max()` vs 媒体查询分段

**场景**：响应式字体，视口越宽字体越大，但有上下限。

#### 以前（多段媒体查询）

```css
/* ❌ 需要多个断点，不平滑 */
html { font-size: 16px; }

@media (min-width: 480px) { html { font-size: 17px; } }
@media (min-width: 768px) { html { font-size: 18px; } }
@media (min-width: 1024px) { html { font-size: 20px; } }
@media (min-width: 1440px) { html { font-size: 22px; } }
/* 中间过渡是跳变的！ */
```

#### 现在（clamp）

```css
/* ✅ 平滑连续，一行搞定 */
html { font-size: clamp(16px, 1rem + 0.5vw, 22px); }

/* ✅ 响应式内边距 */
.container { padding: clamp(1rem, 3%, 3rem); }

/* ✅ 弹性宽度 */
.sidebar { width: min(300px, 30vw); }
```

**本质改变**：从"阶梯跳变（离散断点）" → "连续平滑缩放"。

---

### 3.2 逻辑属性 vs 物理属性

**场景**：适配 RTL（从右到左）语言如阿拉伯语。

#### 以前（覆盖样式）

```css
/* ❌ 需要额外写一套 RTL */
.card { margin-left: 1rem; padding-right: 2rem; }

[dir="rtl"] .card {
  margin-left: 0;
  margin-right: 1rem;
  padding-right: 0;
  padding-left: 2rem;
}
```

**或（用 CSS 变量 + 后期处理）**：
```css
/* ❌ 繁琐 */
:root { --direction: left; }
[dir="rtl"] { --direction: right; }

.card { margin-var(--direction): 1rem; }  /* 不支持！只能预处理器加 */
```

#### 现在（逻辑属性）

```css
/* ✅ 自动适配 LTR/RTL */
.card {
  margin-inline-start: 1rem;
  padding-inline-end: 2rem;
  border-inline-start: 1px solid #ddd;
}

/* 并且支持垂直书写模式 */
.vertical-text { padding-block: 1rem; }
```

**本质改变**：从"为每个方向写两套样式" → "逻辑方向自动适配"。

---

## 4. 动画与过渡类

### 4.1 View Transitions vs 手动动画

**场景**：SPA 页面切换时的过渡动画。

#### 以前（手动动画 + 状态管理）

```javascript
// ❌ 需要大量 JS 编排
async function navigate(url) {
  // 1. 获取旧页面内容
  const oldContent = document.getElementById('content');

  // 2. 播放"离开"动画
  await oldContent.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 300, fill: 'forwards'
  }).finished;

  // 3. 请求新页面
  const response = await fetch(url);
  const html = await response.text();

  // 4. 替换 DOM（此时页面会闪烁）
  oldContent.innerHTML = html;

  // 5. 播放"进入"动画
  await oldContent.animate([{ opacity: 0 }, { opacity: 1 }], {
    duration: 300
  }).finished;
}
```

#### 现在（View Transitions API）

```javascript
// ✅ 一行搞定
async function navigate(url) {
  const response = await fetch(url);
  const html = await response.text();
  document.startViewTransition(() => {
    document.getElementById('content').innerHTML = html;
  });
}
```

```css
/* ✅ CSS 控制动画细节 */
::view-transition-old(root) {
  animation: 0.3s ease-out both fade-out;
}
::view-transition-new(root) {
  animation: 0.3s ease-in both fade-in;
}
@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-in { from { opacity: 0; } }
```

**本质改变**：从"手写动画编排" → "浏览器原生过渡管理"。

---

### 4.2 Scroll-Driven Animations vs Intersection Observer

**场景**：元素滚动进入视口时执行入场动画。

#### 以前（Intersection Observer）

```javascript
// ❌ 需要 JS 监听
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);  // 一次触发后移除
    }
  });
}, { threshold: 0.2 });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
```

```css
.reveal { opacity: 0; translate: 0 40px; transition: 0.6s; }
.reveal.visible { opacity: 1; translate: 0 0; }
```

#### 现在（Scroll-Driven Animations）

```css
/* ✅ 纯 CSS */
@keyframes fade-in-up {
  from { opacity: 0; translate: 0 40px; }
  to { opacity: 1; translate: 0 0; }
}

.reveal {
  animation: fade-in-up 0.6s ease-out;
  animation-timeline: view();                /* 进入视口时触发 */
  animation-range: entry 0% entry 80%;       /* 滚入 0%-80% 时播放 */
}
```

**本质改变**：从"JS 监听 + DOM 类操作" → "CSS 声明式滚动绑定"。

---

### 4.3 `@starting-style` / `transition-behavior` vs 动画延迟

**场景**：给从 display:none 变成 display:block 的元素做动画。

#### 以前（requestAnimationFrame + 双重 setTimeout）

```javascript
// ❌ 著名的"入场动画 hack"
function show(element) {
  // Step 1: 先设为可见但透明
  element.style.display = 'block';
  element.style.opacity = '0';

  // Step 2: 等到浏览器渲染下一帧
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Step 3: 再改为最终状态，触发过渡
      element.style.opacity = '1';
    });
  });
}
```

```css
/* ❌ 这个过渡不会触发，因为 display 的改变不参与过渡 */
.menu { display: none; opacity: 0; transition: opacity 0.3s; }
.menu.open { display: block; opacity: 1; }
/* ⚠️ display: none → block 时，opacity 过渡不会执行！ */
```

#### 现在

```css
/* ✅ 直接声明，浏览器自动处理 */
.menu {
  display: none;
  opacity: 0;
  transition:
    opacity 0.3s,
    display 0.3s allow-discrete;
}

.menu.open {
  display: block;
  opacity: 1;

  @starting-style {
    opacity: 0;
  }
}
```

**本质改变**：从"JS 时间偏差 hack" → "浏览器原生支持的离散属性过渡"。

---

### 4.4 `sibling-index()` 交错动画 vs 手动延迟类

#### 以前（JS 或模板手动加 delay）

```html
<!-- ❌ 需要 JS 或后端生成延时类 -->
<li class="item" style="--i: 1">...</li>
<li class="item" style="--i: 2">...</li>
<li class="item" style="--i: 3">...</li>
```

```css
.item { animation: fade-in 0.3s calc(var(--i) * 0.1s) both; }
```

```javascript
// ❌ 或者 JS 动态赋值
document.querySelectorAll('.item').forEach((el, i) => {
  el.style.setProperty('--i', i);
});
```

#### 现在

```css
/* ✅ CSS 原生获取索引 */
.item {
  --delay: calc(sibling-index() * 0.1s);
  animation: fade-in 0.3s var(--delay) both;
}
```

**本质改变**：从"外部传入索引" → "CSS 原生兄弟感知"。

---

## 5. 颜色与主题类

### 5.1 `color-mix()` vs 预处理器颜色函数

**场景**：从品牌色派生 hover、active、bg 等变体色。

#### 以前（手动硬编码或 Sass）

```scss
// ❌ 要么硬编码
$brand: #6366f1;
$brand-hover: #4f46e5;   // 手动找色值
$brand-bg: #eef2ff;      // 手动找色值
$brand-border: #c7d2fe;  // 手动找色值

// ❌ 要么 Sass 函数（需要编译）
$brand-hover: darken($brand, 8%);
$brand-bg: lighten($brand, 35%);
$brand-border: lighten($brand, 25%);
```

#### 现在（color-mix）

```css
/* ✅ 原生 CSS，零工具 */
:root {
  --brand: #6366f1;
  --brand-hover:  color-mix(in oklch, var(--brand), black 15%);
  --brand-active: color-mix(in oklch, var(--brand), black 30%);
  --brand-bg:     color-mix(in oklch, var(--brand), white 80%);
  --brand-border: color-mix(in srgb, var(--brand), white 50%);
}
```

**本质改变**：从"硬编码 / 预处理器" → "原生颜色混合"。

---

### 5.2 `light-dark()` vs 媒体查询 + CSS 变量

#### 以前（CSS 变量 + 覆盖）

```css
/* ❌ 需要大量 CSS 变量覆盖 */
:root {
  --bg: #ffffff;
  --text: #333333;
  --card-bg: #f8f9fa;
  --border: #dee2e6;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1a1a2e;
    --text: #e0e0e0;
    --card-bg: #2d2d44;
    --border: #4a4a6a;
  }
}

body { background: var(--bg); color: var(--text); }
.card { background: var(--card-bg); border-color: var(--border); }
```

#### 现在（light-dark）

```css
/* ✅ 一行一个，无需大量变量 */
:root { color-scheme: light dark; }

body {
  background: light-dark(#ffffff, #1a1a2e);
  color: light-dark(#333333, #e0e0e0);
}

.card {
  background: light-dark(#f8f9fa, #2d2d44);
  border-color: light-dark(#dee2e6, #4a4a6a);
}
```

**本质改变**：从"变量两层覆盖" → "直接内联双值声明"。

---

### 5.3 OKLCH vs HEX/RGB

#### 以前（HEX/RGB/HSL）

```css
/* ❌ 以下哪个更亮？肉眼很难判断 */
:root {
  --red-1: #fee2e2;
  --red-2: #fecaca;
  --red-3: #fca5a5;
  --red-4: #f87171;
  --red-5: #ef4444;
  /* 亮度变化不均匀！人眼看起来很跳跃 */
}
```

#### 现在（OKLCH）

```css
/* ✅ 感知均匀的色空间 */
:root {
  --red-1: oklch(0.95 0.03 20);
  --red-2: oklch(0.85 0.06 20);
  --red-3: oklch(0.75 0.12 20);
  --red-4: oklch(0.65 0.18 20);
  --red-5: oklch(0.55 0.22 20);
  /* 每级亮度差相等，人眼看起来过渡均匀 */
}
```

**本质改变**：从"感知不均匀（HEX/HSL）" → "感知均匀（OKLCH）"。

---

### 5.4 `contrast-color()` vs 手动判断

#### 以前（JS 计算对比度）

```javascript
// ❌ 需要写复杂的亮度计算公式
function getContrastColor(hexColor) {
  // 将 hex 转为 RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // 计算相对亮度 (WCAG 公式)
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

  return luminance > 128 ? '#000000' : '#ffffff';
}
```

#### 现在（contrast-color）

```css
/* ✅ 一行 CSS */
.btn { color: contrast-color(var(--btn-bg)); }
```

**本质改变**：从"JS 手动计算 WCAG 亮度" → "CSS 原生无障碍对比色"。

---

## 6. 排版与文本类

### 6.1 `text-wrap: balance` vs 手动调换行

**场景**：标题最后一行只有一两个字，很难看（孤儿词/Orphan）。

#### 以前（手动加 `<br>` 或调整）

```html
<!-- ❌ 手动添加 <br> 强行换行，不同屏幕下反而会断错 -->
<h1>现代 CSS 新特性<br>完全总结</h1>
```

**或**：设计师逐个调整直到看起来舒服，但在不同分辨率下又变了。

#### 现在

```css
/* ✅ 一行搞定 */
h1 { text-wrap: balance; }
p { text-wrap: pretty; }  /* 防止段落末尾孤行 */
```

**本质改变**：从"手动干预每个标题" → "浏览器自动优化换行"。

---

## 7. 表单控件类

### 7.1 `accent-color` vs 自定义表单控件

**场景**：把 checkbox 和 radio 颜色改为品牌色。

#### 以前（自定义实现）

```html
<!-- ❌ 需要完全自己画 checkbox -->
<label class="custom-checkbox">
  <input type="checkbox" class="sr-only">  <!-- 隐藏原生控件 -->
  <span class="checkmark"></span>          <!-- 纯 CSS 画的假控件 -->
  同意条款
</label>
```

```css
/* ❌ 大量 CSS 来模拟一个 checkbox */
.custom-checkbox {
  position: relative;
  padding-left: 30px;
  cursor: pointer;
}

.custom-checkbox input { position: absolute; opacity: 0; }

.checkmark {
  position: absolute; left: 0; top: 0;
  width: 20px; height: 20px;
  border: 2px solid #ccc;
  border-radius: 4px;
}

.custom-checkbox input:checked ~ .checkmark {
  background: #6366f1;
  border-color: #6366f1;
}

.checkmark::after {
  content: "";
  display: none;
  position: absolute;
  /* ...画勾的伪元素... */
}

.custom-checkbox input:checked ~ .checkmark::after {
  display: block;
}
```

#### 现在（accent-color）

```css
/* ✅ 一行搞定，保持原生可访问性 */
:root { accent-color: #6366f1; }
```

**本质改变**：从"完全自定义 DOM 模拟" → "原生控件主题色控制"。

---

### 7.2 自定义 Select vs 原生 Select

#### 以前（div 模拟下拉框）

```html
<!-- ❌ 完全用 div + JS 模拟 -->
<div class="custom-select" tabindex="0">
  <div class="selected">选项 A</div>
  <div class="options" hidden>
    <div data-value="a">选项 A</div>
    <div data-value="b">选项 B</div>
    <div data-value="c">选项 C</div>
  </div>
</div>
```

```javascript
// ❌ 大量 JS 处理键盘导航、焦点管理、点击外部关闭...
class CustomSelect {
  constructor(el) { /* ...200 行代码... */ }
}
```

#### 现在（base-select）

```css
/* ✅ 原生 select 直接自定义样式 */
select { appearance: base-select; }
select::picker(select) {
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,.12);
}
```

**本质改变**：从"用 div 模拟 select 所有行为" → "原生 select 直接换肤"。

---

## 8. 代码组织类

### 8.1 `@layer` vs !important 战争

**场景**：第三方 UI 库样式与自己样式冲突。

#### 以前（!important 链）

```css
/* ❌ 经典 !important 战争 */
/* 第三方库 */
.ant-btn { background: blue !important; }

/* 自己覆盖 */
.my-btn-override { background: red !important; }

/* 另一个开发者又覆盖 */
.special-btn { background: green !important; }

/* 最终：每个人都在用 !important，没人知道优先级怎么算的 */
```

**或**：
```css
/* ❌ 用极度具体的选择器权重来压 */
#root .container .sidebar .widget .btn-primary {
  background: red;   /* 这种选择器又长又脆弱 */
}
```

#### 现在（@layer）

```css
/* ✅ 用层顺序控制优先级，不再靠选择器权重 */
@layer framework, components, overrides;

@layer framework {
  .btn { background: blue; }
}

@layer components {
  .btn-primary { background: red; }  /* 即使选择器权重低，但层顺序高 */
}

@layer overrides {
  .special-btn { background: green; }  /* 最高优先级 */
}
```

**本质改变**：从"靠选择器权重大战" → "靠层顺序声明优先级"。

---

### 8.2 `@property` vs 无法动画的自定义属性

**场景**：对 CSS 自定义属性做过渡动画。

#### 以前（无法直接做）

```css
/* ❌ 以下代码不会触发动画 */
:root { --angle: 0deg; }
.box {
  background: linear-gradient(var(--angle), red, blue);
  transition: --angle 1s;   /* ⚠️ 浏览器不知道 --angle 是什么类型，无法插值 */
}
.box:hover { --angle: 180deg; }
/* ❌ 动画不会执行！ */
```

**或（用 JS + requestAnimationFrame）**：
```javascript
// ❌ 大量 JS 手动驱动动画
let angle = 0;
function animate() {
  angle += 1;
  document.documentElement.style.setProperty('--angle', angle + 'deg');
  if (angle < 180) requestAnimationFrame(animate);
}
```

#### 现在（@property）

```css
/* ✅ 声明类型后，浏览器就知道怎么插值了 */
@property --angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.box {
  background: linear-gradient(var(--angle), red, blue);
  transition: --angle 1s;
}
.box:hover { --angle: 180deg; }
/* ✅ 动画完美执行！ */
```

**本质改变**：从"JS 手动帧动画" → "CSS 原生属性动画"。

---

### 8.3 `@mixin` / `@apply` vs 复制粘贴

#### 以前（复制粘贴或 Sass）

```scss
// ❌ 要么 Sass 混入（需编译）
@mixin button-base {
  display: inline-flex;
  align-items: center;
  padding: 0.5em 1.25em;
  border-radius: 6px;
  cursor: pointer;
}

.btn-primary { @include button-base; background: blue; }
.btn-danger  { @include button-base; background: red; }
```

**或**：
```css
/* ❌ 要么复制粘贴（违反 DRY） */
.btn-primary, .btn-danger {
  display: inline-flex;
  align-items: center;
  padding: 0.5em 1.25em;
  border-radius: 6px;
  cursor: pointer;
}
.btn-primary { background: blue; }
.btn-danger  { background: red; }
```

#### 现在（原生 @mixin）

```css
/* ✅ 原生 CSS 混入 */
@mixin --button-base {
  display: inline-flex;
  align-items: center;
  padding: 0.5em 1.25em;
  border-radius: 6px;
  cursor: pointer;
}

.btn-primary { @apply --button-base; background: var(--brand); }
.btn-danger  { @apply --button-base; background: #ef4444; }
```

**本质改变**：从"预处理器或代码重复" → "原生样式复用机制"。

---

### 8.4 `@scope` vs BEM 命名

**场景**：组件样式不泄漏到外部。

#### 以前（BEM + 严格命名）

```css
/* ❌ 需要严格遵守命名约定 */
.card__title { font-size: 1.25rem; }           /* 块__元素 */
.card__body { color: #666; }
.card__button { background: blue; }
.card__button--primary { background: red; }    /* 块__元素--修饰符 */

/* 或者用 iframe / Shadow DOM */
/* 但 Shadow DOM 也有局限（穿透、性能） */
```

#### 现在（@scope）

```css
/* ✅ 自动作用域隔离，无需命名约定 */
@scope (.card) {
  h2 { font-size: 1.25rem; }
  p { color: #666; }
  .btn { background: blue; }
}
```

**本质改变**：从"命名约定强制隔离" → "语法级作用域隔离"。

---

## 9. 交互类

### 9.1 Scroll Snap vs 手写轮播

**场景**：一个一次滑一屏的轮播效果。

#### 以前（JS 轮播库）

```html
<!-- ❌ 引入第三方库 -->
<link rel="stylesheet" href="swiper-bundle.min.css">
<script src="swiper-bundle.min.js"></script>
<script>
  new Swiper('.swiper', {
    slidesPerView: 1,
    snapOnRelease: true,
    // ...大量配置项
  });
</script>
```

#### 现在（Scroll Snap）

```css
/* ✅ 纯 CSS，零 JS */
.carousel {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
}

.slide {
  flex: 0 0 100%;
  scroll-snap-align: center;
}
```

**本质改变**：从"JS 模拟滚动 + 大量配置" → "浏览器原生滚动吸附"。

---

### 9.2 `anchor()` / Popover vs JS 弹窗库

**场景**：点击按钮弹出工具提示。

#### 以前（JS 弹窗 + 定位计算）

```html
<!-- ❌ 需要自己写弹窗逻辑或引入库 -->
<link rel="stylesheet" href="tippy.css">
<script src="tippy-bundle.umd.min.js"></script>
<script>
  tippy('#my-button', {
    content: '这是一个提示',
    placement: 'bottom',
    flip: true,
    // 很多配置...需要看文档
  });
</script>
```

#### 现在（Popover + Anchor Positioning）

```html
<!-- ✅ 纯 HTML + CSS -->
<button popovertarget="tooltip">悬停</button>
<div id="tooltip" popover>这是一个提示</div>
```

```css
/* ✅ 可选：自定义定位 */
#tooltip { position-anchor: --btn; margin: 0; }
```

**本质改变**：从"JS 库 + 手动定位" → "HTML + CSS 原生弹窗系统"。

---

## 10. 其他实用类

### 10.1 `field-sizing: content` vs JS 自动伸缩输入框

**场景**：输入框宽度自动跟随内容增长。

#### 以前（JS 监听）

```javascript
// ❌ 需要 JS 监听每个输入
document.querySelectorAll('input.auto-grow').forEach(input => {
  input.addEventListener('input', () => {
    // 用隐藏的 span 测量文本宽度
    const span = document.createElement('span');
    span.textContent = input.value || input.placeholder;
    span.style.font = getComputedStyle(input).font;
    document.body.appendChild(span);
    input.style.width = span.offsetWidth + 20 + 'px';
    document.body.removeChild(span);
  });
});
```

#### 现在（field-sizing）

```css
/* ✅ 一行搞定 */
input, textarea { field-sizing: content; }
```

**本质改变**：从"JS 间接测量文本宽度" → "CSS 原生内容感知尺寸"。

---

### 10.2 `if()` 条件样式 vs 多重类名

**场景**：不同变体的按钮。

#### 以前（类名排列组合）

```css
/* ❌ 为每种组合写一套样式 */
.btn { /* base */ }
.btn--primary { /* primary variant */ }
.btn--secondary { /* secondary variant */ }
.btn--small { /* small size */ }
.btn--large { /* large size */ }
.btn--primary.btn--small { /* primary + small */ }
.btn--secondary.btn--large { /* secondary + large */ }
/* 如果有 3 个变体 × 3 个尺寸 × 2 个状态 = 18 种组合！ */
```

#### 现在（if + 自定义属性）

```css
/* ✅ 条件函数简化为一个属性 */
.btn {
  background: if(
    style(--variant: secondary), gray,
    if(style(--variant: danger), red, blue)
  );
  padding: if(
    style(--size: small), 0.25em 0.5em,
    if(style(--size: large), 0.75em 1.5em, 0.5em 1em)
  );
}
```

**本质改变**：从"多重类名排列组合" → "单一属性条件判断"。

---

## 总结：前后对比一览表

| 特性 | 以前方案 | 现在方案 | 核心变化 |
|------|---------|---------|---------|
| **容器查询** | 媒体查询 + 父级选择器判断 | `@container` | 视口感知 → 容器感知 |
| **Subgrid** | 硬编码高度 / 放弃对齐 | `grid-template-rows: subgrid` | 独立轨道 → 共享轨道 |
| **gap** | margin + 相邻兄弟选择器 | `gap` | hack → 语义属性 |
| **aspect-ratio** | padding-bottom hack | `aspect-ratio` | 百分比 trick → 声明式 |
| **Masonry** | Masonry.js / column 布局 | `grid-template-rows: masonry` | JS 库 → 原生布局 |
| **Anchor Positioning** | JS getBoundingClientRect | `position-anchor` | 命令式 JS → 声明式 CSS |
| **:has()** | JS 监听 + 类切换 | `:has()` | JS 行为 → CSS 回溯 |
| **CSS Nesting** | Sass/Less 预处理器 | `&` 嵌套 | 编译工具 → 原生 |
| **clamp()** | 多段媒体查询断点 | `clamp()` | 离散阶梯 → 连续缩放 |
| **逻辑属性** | 双套 LTR/RTL 样式 | `inline`/`block` | 物理方向 → 逻辑方向 |
| **View Transitions** | 手写动画编排 | `startViewTransition()` | JS 编排 → 原生过渡 |
| **滚动动画** | IntersectionObserver | `animation-timeline: view()` | JS 监听 → CSS 绑定 |
| **@starting-style** | rAF 双重 setTimeout | `@starting-style` | 时间偏差 hack → 原生 |
| **sibling-index()** | JS/模板手动传索引 | `sibling-index()` | 外部传入 → 原生感知 |
| **color-mix()** | 硬编码 / Sass darken | `color-mix()` | 预处理器 → 原生 |
| **light-dark()** | CSS 变量 + media query | `light-dark()` | 双层覆盖 → 单行声明 |
| **OKLCH** | HEX/RGB/HSL | `oklch()` | 不匀色空间 → 匀色空间 |
| **contrast-color()** | JS WCAG 亮度计算 | `contrast-color()` | JS 算法 → CSS 原生 |
| **text-wrap: balance** | 手动 <br> 调换行 | `text-wrap: balance` | 手动 → 自动排版 |
| **accent-color** | div 模拟 checkbox/radio | `accent-color` | DOM 模拟 → 原生换肤 |
| **自定义 select** | div + JS 模拟 | `appearance: base-select` | 完全重写 → 原生定制 |
| **@layer** | !important 链 | `@layer` | 权重战争 → 层序控制 |
| **@property** | JS requestAnimationFrame | `@property` | JS 帧动画 → CSS 动画 |
| **@mixin** | 复制粘贴 / Sass | `@mixin` / `@apply` | 重复或编译 → 原生复用 |
| **@scope** | BEM 命名约定 | `@scope` | 命名隔离 → 语法隔离 |
| **Scroll Snap** | Swiper.js 等轮播库 | `scroll-snap-type` | JS 库 → 原生滚动 |
| **Popover** | Tippy.js / Popper.js | `popover` + `anchor()` | JS 弹窗 → HTML 弹窗 |
| **field-sizing** | JS 测量文本宽度 | `field-sizing: content` | JS 量尺寸 → 内容感知 |

> **总体趋势**：从"JavaScript 补位" → "CSS 原生实现"。2020-2026 年间，CSS 吸收了大部分过去需要 JS 或预处理器才能实现的功能，让 Web 开发变得更简洁、更可靠、更可维护。
