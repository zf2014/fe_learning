# CSS Houdini 与 @property 完全指南

> 最后更新：2026-05-25

---

## 目录

- [一、CSS Houdini 概述](#一css-houdini-概述)
- [二、六个子 API 详解](#二六个子-api-详解)
- [三、浏览器兼容性总览](#三浏览器兼容性总览)
- [四、@property 使用指南](#四property-使用指南)
  - [语法详解](#语法详解)
  - [传统方式 vs @property 对比](#传统方式-vs-property-对比)
  - [JS 中注册 @property](#js-中注册-property)
  - [@property + @keyframes 动画](#property--keyframes-动画)
- [五、使用建议与决策表](#五使用建议与决策表)

---

## 一、CSS Houdini 概述

CSS Houdini 是一组**底层 API 的统称**，它暴露了浏览器 CSS 引擎的渲染管线，让开发者可以用 JavaScript 直接扩展 CSS 的能力——而不是等浏览器厂商慢慢实现新特性。

命名来源于著名魔术师 Harry Houdini，寓意让开发者"逃脱"传统 CSS 的限制，深入参与到浏览器的样式计算过程中。

### 核心价值

- **扩展 CSS**：可以创建浏览器原生不具备的 CSS 功能
- **性能优化**：通过 Worklet 在独立线程运行，不阻塞主线程
- **渐进增强**：不支持 Houdini 的浏览器会忽略增强，基础功能不受影响
- **标准化**：所有扩展都作为浏览器渲染管线的一部分执行，比 JS hack 更高效

---

## 二、六个子 API 详解

| 子 API | 核心功能 | 成熟度 |
|--------|---------|--------|
| **CSS Properties and Values API** (`@property`) | 注册带类型、默认值、继承语义的自定义属性 | ✅ 生产可用 |
| **CSS Typed OM API** | 以类型化对象（而非字符串）读写 CSS 值，性能更好 | ✅ Chrome/Safari，Firefox 部分 |
| **CSS Paint API** (`paint()`) | 用 JS 绘制背景、边框、遮罩图像 | ⚠️ Chrome/Edge，Safari flag，Firefox 不支持 |
| **Animation Worklet API** | 在合成线程中运行高性能自定义动画 | ❌ 实验性，仅 Chrome origin trial |
| **CSS Layout API** | 用 JS 定义全新布局算法（如瀑布流） | ❌ 实验性，仅 Chrome |
| **Parser API / Font Metrics API** | 自定义 CSS 解析、获取字体度量 | ❌ 尚在提案阶段 |

### 1. `@property` — 类型化自定义属性

目前**兼容性最好、实际使用最多**的 Houdini API。

```css
@property --gradient-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

.button {
  background: linear-gradient(var(--gradient-angle), #e66465, #9198e5);
  transition: --gradient-angle 0.5s;
}
.button:hover {
  --gradient-angle: 180deg;
}
```

**核心价值**：让自定义属性（CSS 变量）可以被浏览器**原生动画化**。没有 `@property`，CSS 变量只是字符串，浏览器不知道怎么插值。

### 2. CSS Typed OM — 类型化的 CSS 对象模型

传统 `element.style.opacity = "0.5"` 是字符串操作。Typed OM 提供类型安全的方式：

```js
// 旧方式：字符串
el.style.opacity = "0.5";

// Typed OM：类型安全、性能更好
el.attributeStyleMap.set("opacity", CSS.number(0.5));
el.attributeStyleMap.get("opacity").value; // 0.5 (number，非 string)
```

适用于高频操作大量 CSS 属性的场景（动画引擎、数据可视化）。

### 3. Paint API — 用 JS 绘制 CSS 图像

```js
// checkerboard-worklet.js
registerPaint('checkerboard', class {
  static get inputProperties() { return ['--checker-size', '--checker-color']; }

  paint(ctx, geom, props) {
    const size = parseInt(props.get('--checker-size')) || 20;
    const color = props.get('--checker-color').toString() || '#000';

    for (let y = 0; y < geom.height / size; y++) {
      for (let x = 0; x < geom.width / size; x++) {
        ctx.fillStyle = (x + y) % 2 ? color : 'transparent';
        ctx.fillRect(x * size, y * size, size, size);
      }
    }
  }
});
```

```css
.element {
  --checker-size: 30;
  --checker-color: #333;
  background-image: paint(checkerboard);
}
```

**适用场景**：
- Squircle（超椭圆）形状——`border-radius` 做不了真正的 squircle
- 动态图案背景（波点、条纹、噪声纹理）
- 涟漪效果——替代 Material Design 中的额外 DOM 节点
- 自定义下划线/删除线
- `mask-image` 裁剪实现任意形状

**限制**：
- 不能加载外部图片
- 不支持 `fillText`（不能画文字）
- 需要 HTTPS 环境
- 运行在独立线程（不阻塞主线程）

### 4. Animation Worklet — 合成线程动画

```js
await CSS.animationWorklet.addModule('spring-animator.js');
const animation = new WorkletAnimation(
  'spring',
  new KeyframeEffect(target, keyframes, duration),
  document.timeline
);
animation.play();
```

适用于滚动驱动动画、物理弹簧动画等需要在 60fps 下运行且不阻塞主线程的场景。

### 5. Layout API — 自定义布局

```js
registerLayout('masonry', class {
  async layout(children, edges, constraints) {
    // 自定义瀑布流布局算法
  }
});
```

适用于 CSS Grid/Flexbox 无法满足的特殊布局。目前仍处于实验阶段。

---

## 三、浏览器兼容性总览（2026 年 5 月）

| API | Chrome/Edge | Safari | Firefox | 实用程度 |
|-----|------------|--------|---------|---------|
| `@property` | ✅ 85+ | ✅ 15.4+ | ✅ 128+ | ⭐⭐⭐⭐⭐ 可放心使用 |
| Typed OM | ✅ 66+ | ✅ 16.4+ | ⚠️ 部分 | ⭐⭐⭐⭐ |
| Paint API | ✅ 65+ | ⚠️ 默认禁用（flag） | ❌ 不支持 | ⭐⭐⭐ |
| Animation Worklet | ⚠️ Origin trial | ❌ | ❌ | ⭐⭐ |
| Layout API | ⚠️ 实验性 | ❌ | ❌ | ⭐ |

### Paint API 的 fallback 策略

```css
.element {
  background-image: url(fallback-pattern.png);    /* fallback */
  background-image: paint(checkerboard);           /* 增强层 */
}
```

---

## 四、@property 使用指南

### 语法详解

`@property` 有三个描述符，**全部必填**：

#### 1. `syntax` — 类型声明

| 语法字符串 | 含义 | 示例值 |
|-----------|------|--------|
| `"<color>"` | 颜色 | `#ff0`, `red`, `rgb(0,0,0)` |
| `"<length>"` | 长度 | `10px`, `2em`, `1rem` |
| `"<angle>"` | 角度 | `45deg`, `0.5turn`, `3.14rad` |
| `"<percentage>"` | 百分比 | `50%` |
| `"<number>"` | 数字 | `0.5`, `42` |
| `"<integer>"` | 整数 | `1`, `10` |
| `"<resolution>"` | 分辨率 | `2dppx` |
| `"<time>"` | 时间 | `0.3s`, `500ms` |
| `"<url>"` | URL | `url(bg.png)` |
| `"<image>"` | 图像 | `url(...)`, `linear-gradient(...)` |
| `"<transform-function>"` | 变换函数 | `rotate(45deg)`, `scale(2)` |
| `"<custom-ident>"` | 自定义标识符 | `dark`, `large` |
| `"*"` | 任意值 | 任意合法 CSS 值 |

**多值联合**（多选一）：

```css
syntax: "<length> | <percentage>";   /* 接受长度或百分比 */
syntax: "small | medium | large";    /* 枚举值 */
syntax: "<color>+";                   /* + 表示空格分隔的列表 */
```

#### 2. `inherits` — 是否继承

```css
inherits: true;   /* 子元素继承（默认行为，和普通 CSS 变量一致） */
inherits: false;  /* 不继承，每个元素独立计算 */
```

#### 3. `initial-value` — 初始值

必须是一个符合 `syntax` 声明类型的合法值：

```css
@property --angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;   /* 必须是 <angle> 类型 */
}
```

---

### 传统方式 vs @property 对比

#### 场景 1：渐变动画

**❌ 传统方式 — 渐变无法过渡**

```css
/* 渐变根本不支持 transition！ */
.button {
  background: linear-gradient(0deg, #e66465, #9198e5);
  transition: background 0.5s;      /* 无效 */
}
.button:hover {
  background: linear-gradient(180deg, #e66465, #9198e5);  /* 直接跳变 */
}
```

**✅ @property — 渐变角度可平滑过渡**

```css
@property --angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.button {
  --angle: 0deg;
  background: linear-gradient(var(--angle), #e66465, #9198e5);
  transition: --angle 0.6s ease;
}
.button:hover {
  --angle: 180deg;    /* 渐变平滑旋转 */
}
```

**本质区别**：传统 CSS 变量是字符串，浏览器不知道 `0deg` → `180deg` 该怎么插值。`@property` 告诉浏览器"这是角度"，浏览器就知道该做线性插值了。

#### 场景 2：渐变颜色过渡

**❌ 传统方式 — 叠加两层渐变 hack**

```css
.button {
  background: linear-gradient(#e66465, #9198e5);
  position: relative;
}
.button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(#2196f3, #4caf50);
  opacity: 0;
  transition: opacity 0.5s;
}
.button:hover::after {
  opacity: 1;
}
/* 问题：多了一个伪元素，且需要 position 定位 */
```

**✅ @property — 直接过渡颜色**

```css
@property --color-start {
  syntax: "<color>";
  inherits: false;
  initial-value: #e66465;
}
@property --color-end {
  syntax: "<color>";
  inherits: false;
  initial-value: #9198e5;
}

.button {
  --color-start: #e66465;
  --color-end: #9198e5;
  background: linear-gradient(var(--color-start), var(--color-end));
  transition: --color-start 0.5s, --color-end 0.5s;
}
.button:hover {
  --color-start: #2196f3;
  --color-end: #4caf50;    /* 渐变颜色平滑过渡 */
}
```

#### 场景 3：进度条动画

**❌ 传统方式 — 用 `width` 触发 layout reflow**

```css
.progress {
  width: 300px;
  height: 8px;
  background: #eee;
}
.progress-bar {
  width: 0%;
  height: 100%;
  background: #0066ff;
  transition: width 1s ease;
}
.progress-bar[data-value="75"] {
  width: 75%;
}
/* 问题：width 变化会触发 layout reflow，性能不佳 */
```

**✅ @property — 用数字动画，无 reflow**

```css
@property --progress {
  syntax: "<number>";
  inherits: false;
  initial-value: 0;
}

.progress {
  --progress: 0;
  width: 300px;
  height: 8px;
  background: linear-gradient(
    to right,
    #0066ff calc(var(--progress) * 100%),
    #eee calc(var(--progress) * 100%)
  );
  transition: --progress 1s ease;
}
.progress[data-value="75"] {
  --progress: 0.75;
}
/* 无额外 DOM 元素，无 layout reflow，只触发 paint */
```

#### 场景 4：阴影动画

**❌ 传统方式 — 整个 box-shadow 重写**

```css
.card {
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: box-shadow 0.3s;
}
.card:hover {
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
/* 问题：box-shadow 变化触发 repaint，整个值都要重写 */
```

**✅ @property — 只动画化变化的参数**

```css
@property --shadow-y {
  syntax: "<length>";
  inherits: false;
  initial-value: 2px;
}
@property --shadow-blur {
  syntax: "<length>";
  inherits: false;
  initial-value: 4px;
}
@property --shadow-opacity {
  syntax: "<number>";
  inherits: false;
  initial-value: 0.1;
}

.card {
  --shadow-y: 2px;
  --shadow-blur: 4px;
  --shadow-opacity: 0.1;
  box-shadow:
    0 var(--shadow-y) var(--shadow-blur) rgba(0,0,0,var(--shadow-opacity));
  transition: --shadow-y 0.3s, --shadow-blur 0.3s, --shadow-opacity 0.3s;
}
.card:hover {
  --shadow-y: 20px;
  --shadow-blur: 60px;
  --shadow-opacity: 0.3;
}
```

#### 场景 5：类型校验 — 防止错误值

**❌ 传统方式 — 没有校验，错误值静默失败**

```css
:root {
  --gap: 20px;
}
.component {
  --gap: red;           /* 语法上"合法"，但语义完全错误 */
  gap: var(--gap);      /* gap: red → 无效 → 被忽略 → 排版错乱 */
}
/* 没有任何报错，默默出 bug */
```

**✅ @property — 自动校验，错误值被拒绝**

```css
@property --gap {
  syntax: "<length>";
  inherits: true;
  initial-value: 20px;
}

.component {
  --gap: red;           /* 不符合 <length>，被拒绝 */
  gap: var(--gap);      /* 使用 initial-value: 20px */
}
```

#### 场景 6：`inherits: false` 的性能优化

**❌ 传统方式 — 变量始终继承，改动影响整棵子树**

```css
:root {
  --theme-accent: blue;
}
/* 修改这个变量 → 浏览器要遍历所有后代元素重新计算 */
```

**✅ @property — `inherits: false` 隔离影响范围**

```css
@property --local-highlight {
  syntax: "<color>";
  inherits: false;       /* 不继承 */
  initial-value: transparent;
}

/* 每个元素独立计算，修改父元素不会影响子元素 */
/* 浏览器可以跳过大片子树，减少样式重算 */
.card:nth-child(odd) { --local-highlight: rgba(0,102,255,0.1); }
.card:nth-child(even) { --local-highlight: rgba(255,102,0,0.1); }
```

当页面 DOM 复杂时（几千个节点），`inherits: false` 能显著减少样式重算开销。

---

### JS 中注册 @property

除了 CSS 中的 `@property` 规则，也可以用 JS 注册：

```js
CSS.registerProperty({
  name: '--angle',
  syntax: '<angle>',
  inherits: false,
  initialValue: '0deg',
});
```

两种方式完全等价。CSS 写法更简洁，JS 写法适合动态场景或构建工具集成。

---

### @property + @keyframes 动画

一个完整的旋转渐变按钮示例：

```css
@property --angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

@property --glow-color {
  syntax: "<color>";
  inherits: false;
  initial-value: #0066ff;
}

@keyframes rotate-gradient {
  to {
    --angle: 360deg;
    --glow-color: #ff0066;
  }
}

.button {
  --angle: 0deg;
  --glow-color: #0066ff;
  background: linear-gradient(var(--angle), var(--glow-color), #9198e5);
  animation: rotate-gradient 3s linear infinite alternate;
  padding: 12px 24px;
  border: none;
  color: white;
  border-radius: 8px;
}
```

传统方式要做到这个效果，需要用 JS 每帧更新 `style.background`，性能差且代码复杂。`@property` 让纯 CSS 就能完成。

---

## 五、使用建议与决策表

### @property 带来的好处汇总

| 好处 | 说明 |
|------|------|
| **解锁渐变动画** | 唯一能让 `linear-gradient`/`conic-gradient` 平滑过渡的方法 |
| **类型安全** | 自动校验自定义属性值，错误值回退到 `initial-value` |
| **性能优化** | `inherits: false` 让浏览器跳过子树，减少样式重算 |
| **减少 JS** | 很多原来需要 JS 每帧驱动的动画，现在纯 CSS 就能做 |
| **减少 DOM** | 不再需要 `::before`/`::after` hack 来模拟渐变过渡 |
| **渐进增强** | 不支持 `@property` 的浏览器只是无法动画化，变量本身照常工作 |

### 现在就该用 @property 的场景

| 场景 | 原因 |
|------|------|
| 需要动画化 CSS 渐变 | 这是**唯一**能原生过渡渐变的方法，且兼容性好 |
| 自定义属性需要类型约束 | 防止团队误传非法值，提升代码健壮性 |
| 需要注册可动画化的 CSS 变量 | 让 `transition` 和 `@keyframes` 能作用于自定义属性 |

### 有条件地使用（需 fallback）

| 场景 | 用哪个 API | 条件 |
|------|-----------|------|
| 复杂的动态图案背景 | Paint API | 目标用户主要用 Chromium 浏览器，或有可接受的 fallback |
| Squircle/超椭圆形状 | Paint API | 设计系统强需求且可降级为 `border-radius` |
| 高性能自定义遮罩 | Paint API | 需要配合 fallback mask |

### 目前不建议用于生产

| 场景 | 用哪个 API | 原因 |
|------|-----------|------|
| 瀑布流布局 | Layout API | 仅 Chrome 实验性支持，用 CSS `masonry` 或 JS 库更稳妥 |
| 物理动画 | Animation Worklet | 可用 Web Animations API 或 Framer Motion 替代 |
| 自定义 CSS 解析 | Parser API | 还没实现 |

### 一句话原则

> **`@property` 放心用，Paint API 谨慎用，其余等成熟再说。**

如果你曾经因为"CSS 变量不能动画"而写过 JS hack 或叠加伪元素，`@property` 就是你的解药。
