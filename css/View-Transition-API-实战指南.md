# View Transition API 实战指南

## 一、它是什么

View Transition API 是浏览器原生提供的视图转场动画能力，让你在**两个 DOM 状态之间**创建平滑的视觉过渡。它不依赖任何框架，同时支持 SPA（单页应用）和 MPA（多页应用）。

**核心原理**：浏览器自动对旧/新状态截图 → 更新 DOM → 用 CSS Animation 驱动过渡动画。

---

## 二、适用场景

### 1. SPA 同文档转场（Same-Document，Chrome 111+）

| 场景 | 示例 |
|---|---|
| **列表 → 详情页** | 产品缩略图平滑放大为详情页大图（如 Nykaa 电商） |
| **导航栏固定** | 页面切换时导航栏保持原位不闪烁 |
| **网格筛选/排序** | 筛选条件变化时卡片平滑移动到新位置 |
| **分页器前进/后退** | 切换页码时内容滑动方向不同（用 `types` 区分 forwards/backwards） |
| **表单步骤流转** | 多步表单中步骤之间的过渡动画（如 PolicyBazaar 保险购买流程） |
| **内容增删** | 添加/删除卡片时的进出动画 |
| **分类切换** | 新闻类别的切换动画（如 CyberAgent Ameba News） |

**触发方式**：`document.startViewTransition(() => updateDOM())`

### 2. MPA 跨文档转场（Cross-Document，Chrome 126+）

| 场景 | 示例 |
|---|---|
| **页面间导航** | 传统多页应用中点击链接跳转，不再是白屏闪烁 |
| **栈式导航** | 深入详情页 push、返回 pop 的滑动动画 |
| **新闻列表 → 详情** | 列表页到文章页的平滑过渡 |

**触发方式**：无需 JS API，同源导航自动触发，两个页面用 CSS opt-in：

```css
@view-transition {
  navigation: auto;
}
```

---

## 三、处理宽高比变化（Jake Archibald 文章要点）

当转场元素在两个状态的**宽高比不同**时，默认动画会出现错位/拉伸。解决策略：

| 情况 | 方案 |
|---|---|
| **非预期的宽高比变化** | 用 `width: fit-content` 让两个状态尺寸一致 |
| **有意改变宽高比（容器 + 文字）** | 将容器和文字拆为两个独立的 `view-transition-name`，容器用 `height: 100%` 拉伸，文字用 `object-fit: none` + `overflow: clip` 保持比例 |
| **同时变化尺寸和缩放** | views 设 `height: 100%; width: auto` 保持比例，group 设 `overflow: clip` 裁剪溢出，padding 移到外层容器避免比例偏差 |

---

## 四、关键能力总结

| 能力 | 说明 |
|---|---|
| `view-transition-name` | 给元素分配独立转场身份 |
| `view-transition-class` | 给伪元素加 class，批量应用相同样式 |
| `types`（view transition types） | 区分不同方向的转场（前进/后退） |
| `pageswap` / `pagereveal` 事件 | 跨文档转场中自定义新旧页面快照 |
| `object-fit` / `object-position` | 控制快照图片在容器内的填充方式 |
| `overflow-clip-margin` | 扩展裁剪区域 |
| JS Web Animation API | 通过 `viewTransition.ready` 获取伪元素做自定义动画 |
| `linear()` 缓动 | 弹簧物理等自定义缓动曲线 |

---

## 五、实战案例：电商「商品列表 → 详情页」转场动画

### 用户痛点

电商网站中，用户从商品列表点击进入详情页时，体验是**断裂的**——页面突然跳转，用户丢失视觉上下文，不确定自己点的是哪个商品。这在移动端尤其明显。

**期望效果**：点击缩略图 → 缩略图平滑"飞"到详情页大图位置，其余内容淡入，形成连贯的视觉叙事。

### 最终效果示意

```
[列表页]                          [详情页]
┌──────────────────────┐          ┌──────────────────────┐
│  ┌────┐  ┌────┐      │          │  ┌──────────────────┐ │
│  │ 📷 │  │ 📷 │      │   点击   │  │                  │ │
│  │    │→→→│    │  ───→  │  │      大  图       │ │
│  └────┘  └────┘      │          │  │                  │ │
│  商品A    商品B       │          │  └──────────────────┘ │
│  ¥99     ¥149        │          │  商品A · ¥99          │
│                       │          │  这是一段商品描述...    │
└──────────────────────┘          └──────────────────────┘
         缩略图"飞"到详情大图位置，其余区域交叉淡入
```

### 完整代码实现

#### 1. HTML 结构

```html
<!-- 列表页 -->
<div class="product-list">
  <a href="/product/1" class="product-card" data-product="1">
    <img src="phone.jpg" alt="商品A" class="product-image" />
    <div class="product-info">
      <h3>商品A</h3>
      <p>¥99</p>
    </div>
  </a>
  <a href="/product/2" class="product-card" data-product="2">
    <img src="laptop.jpg" alt="商品B" class="product-image" />
    <div class="product-info">
      <h3>商品B</h3>
      <p>¥149</p>
    </div>
  </a>
</div>

<!-- 详情页 -->
<div class="product-detail">
  <img src="phone.jpg" alt="商品A" class="detail-hero-image" />
  <div class="detail-info">
    <h1>商品A</h1>
    <p class="price">¥99</p>
    <p>这是一段商品描述...</p>
    <button>加入购物车</button>
  </div>
</div>
```

#### 2. CSS：为元素分配转场身份

```css
/* 列表页：每张缩略图需要唯一的 view-transition-name */
.product-card[data-product="1"] .product-image {
  view-transition-name: product-image-1;
}
.product-card[data-product="2"] .product-image {
  view-transition-name: product-image-2;
}

/* 详情页：大图使用固定的 view-transition-name */
.detail-hero-image {
  view-transition-name: product-image-1; /* 假设当前是商品A */
}

/* 其他内容（文字、按钮等）作为一个整体淡入淡出 */
.detail-info {
  view-transition-name: detail-content;
}
.product-info {
  view-transition-name: list-content;
}
```

**关键点**：`view-transition-name` 必须全局唯一。列表页每个商品图片用不同的 name，详情页大图的 name 必须与对应商品的 name **匹配**，浏览器才能在两个快照之间建立关联，执行位移动画。

#### 3. JavaScript：触发转场

**SPA 方案**（单页应用，Vue/React 路由切换）：

```javascript
async function navigateToProduct(productId) {
  // 浏览器不支持时优雅降级
  if (!document.startViewTransition) {
    updateDOMToDetailPage(productId);
    return;
  }

  // 动态设置当前点击商品的 view-transition-name
  // 确保详情页大图和被点击的缩略图 name 一致
  const clickedImage = document.querySelector(
    `.product-card[data-product="${productId}"] .product-image`
  );

  // 让被点击的缩略图拥有转场身份
  clickedImage.style.viewTransitionName = 'product-hero';

  const transition = document.startViewTransition(async () => {
    // 在这里更新 DOM（路由跳转、组件渲染等）
    await updateDOMToDetailPage(productId);

    // 详情页的大图也要设置匹配的 name
    document.querySelector('.detail-hero-image').style.viewTransitionName =
      'product-hero';
  });

  // 可选：转场完成后的回调
  await transition.finished;
  console.log('转场动画完成');
}
```

**MPA 方案**（多页应用，传统页面跳转）：

```css
/* 两个页面都要加 */
@view-transition {
  navigation: auto;
}
```

```javascript
// 列表页 pageswap 事件：在离开前动态设置被点击商品的 name
window.addEventListener('pageswap', async (e) => {
  // 没有转场就跳过
  if (!e.viewTransition) return;

  const clickedProduct = /* 从 navigation.activation 获取点击的目标 */;

  // 只给被点击的商品图片设置转场身份
  const targetImage = document.querySelector(
    `.product-card[data-product="${clickedProduct}"] .product-image`
  );
  if (targetImage) {
    targetImage.style.viewTransitionName = 'product-hero';
  }
});

// 详情页 pagereveal 事件：设置大图的 name
window.addEventListener('pagereveal', (e) => {
  if (!e.viewTransition) return;

  document.querySelector('.detail-hero-image').style.viewTransitionName =
    'product-hero';
});
```

#### 4. CSS：自定义动画效果

```css
/* 默认是交叉淡入淡出，我们来自定义 */

/* 图片的转场：默认已经会自动做位置+尺寸的平滑过渡 */
/* 只需调整时间和缓动 */
::view-transition-old(product-hero),
::view-transition-new(product-hero) {
  animation-duration: 0.4s;
  animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* 内容区域的转场：淡入淡出 */
::view-transition-group(detail-content) {
  animation-duration: 0.3s;
}
::view-transition-old(detail-content) {
  animation-name: fade-out;
}
::view-transition-new(detail-content) {
  animation-name: fade-in;
  animation-delay: 0.1s; /* 稍微延迟，让图片先动 */
}

@keyframes fade-out {
  to { opacity: 0; }
}
@keyframes fade-in {
  from { opacity: 0; }
}

/* 不参与转场的元素：直接淡入淡出，不做位置动画 */
::view-transition-group(list-content) {
  animation-duration: 0.2s;
}
```

#### 5. 处理宽高比变化（Jake Archibald 文章的核心技巧）

列表缩略图是正方形，详情大图是 16:9——宽高比不同，默认动画会拉伸变形：

```css
/* 让图片快照在容器内保持比例，不拉伸 */
::view-transition-old(product-hero),
::view-transition-new(product-hero) {
  height: 100%;          /* 纵向填满 group（group 自动插值宽高） */
  width: auto;           /* 宽度自适应，保持原始宽高比 */
  object-fit: contain;   /* 图片内容保持比例 */
}

/* group 裁剪溢出部分 */
::view-transition-group(product-hero) {
  overflow: clip;
}
```

### 转场伪元素结构（理解原理）

```
::view-transition                    ← 全屏覆盖层
└─ ::view-transition-group(product-hero)   ← 位置+尺寸自动插值（从缩略图位置到详情大图位置）
   └─ ::view-transition-image-pair(product-hero)
      ├─ ::view-transition-old(product-hero)   ← 旧状态截图
      └─ ::view-transition-new(product-hero)   ← 新状态截图
```

浏览器自动做的事：
1. **group** 从缩略图的 (x, y, width, height) 平滑过渡到大图的 (x, y, width, height)
2. **old** 和 **new** 在 group 内交叉淡入淡出

### 完整工作流程总结

```
用户点击商品
    │
    ▼
startViewTransition(callback)
    │
    ├─ ① 浏览器对当前页面所有带 view-transition-name 的元素截图（旧快照）
    │
    ├─ ② 执行 callback（更新 DOM / 路由跳转 / 页面导航）
    │
    ├─ ③ 浏览器对新状态截图（新快照）
    │
    ├─ ④ 构建 ::view-transition 伪元素树
    │
    └─ ⑤ CSS Animation 驱动动画
         ├─ 匹配 name 的元素 → 位置+尺寸平滑过渡 + 交叉淡入
         └─ 不匹配的元素 → 默认淡入淡出
```

---

## 六、实际收益（来自 Chrome 案例研究）

| 公司 | 场景 | 收益 |
|---|---|---|
| **Nykaa**（电商） | 列表 → 详情页转场 | 原生 API 替代自研方案，零性能损耗，代码大幅简化 |
| **redBus**（出行） | SPA/MPA 混合架构转场 | 用极少量代码实现此前需要大量 JS 动画库才能达到的效果 |
| **PolicyBazaar**（保险） | 多步表单流转 | 消除了自研动画的性能延迟和跨框架兼容问题 |
| **CyberAgent**（新闻） | 分类切换 + 文章展开 | MPA 页面看起来像 SPA，用户感知更流畅 |

---

## 七、一句话总结

View Transition API 的核心价值：**用 `view-transition-name` 在两个状态间建立视觉关联，浏览器自动计算位置/尺寸差值并生成动画，你只需用 CSS 微调效果**——从"手动管理动画生命周期"变成"声明式描述哪些元素该过渡"。

---

## 参考资料

- [Smooth transitions with the View Transition API - Chrome Developers](https://developer.chrome.com/docs/web-platform/view-transitions)
- [View transitions: Handling aspect ratio changes - Jake Archibald](https://jakearchibald.com/2024/view-transitions-handling-aspect-ratio-changes/)
- [Cross-document view transitions for MPAs - Chrome Developers](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document)
- [Same-document view transitions for SPAs - Chrome Developers](https://developer.chrome.com/docs/web-platform/view-transitions/same-document)
- [Seamless navigation with view transitions - Case Studies](https://developer.chrome.com/blog/view-transitions-case-studies)
- [WICG View Transitions Explainer](https://github.com/WICG/view-transitions/blob/main/explainer.md)
