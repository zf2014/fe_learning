# 防抖 vs 节流：从原理到生产的全面对比

## 一、共同起源——为什么需要它们？

前端开发中有一类经典的"高频事件"问题：

- **`scroll`** 事件在滚动时每秒可能触发数十次
- **`resize`** 事件在窗口拖拽时连续触发
- **`mousemove`** 事件跟随鼠标轨迹密集触发
- **`input`** 事件在每次按键时触发
- **`keydown/keyup`** 事件同样跟随按键节奏

这些高频事件带来的三个核心问题：

| 问题 | 表现 | 影响 |
|------|------|------|
| **性能** | 回调执行次数远远超出必要，Layout / Paint / Composite 频繁触发 | 页面卡顿、掉帧 |
| **资源** | 每个事件触发 API 请求，后端承受无效负载 | 带宽浪费、服务器过载、可能触发限流 |
| **体验** | 响应过于频繁导致 UI 闪烁、搜索结果被多次覆盖 | 用户感知的"抖动"、竞态条件 |

Debounce（防抖）和 Throttle（节流）正是为解决这一族问题而生的两种策略。

---

## 二、哲学差异——本质区别

理解两者的区别，最直观的方式是透过它们的**核心行为**：

### Debounce（防抖）：把一连串调用合并为一次

> **等用户停下来再执行。**

如果你连续触发一个 debounce 函数，它会不断地"推迟"执行——只有在一段时间内没有新的触发时，才会真正执行一次。

**类比：电梯关门。**

> 电梯门正在关闭，有人进来了。电梯会重新开门，再等待几秒。又有人进来了，再次重新计时。只有当一段时间内没有人进出时，电梯才会真正关门出发。

Debounce 的哲学是**以静默窗口为准**——只关心最后一次调用。

### Throttle（节流）：按固定频率执行

> **保证至少每隔一段时间执行一次。**

不论你触发了多少次，throttle 保证函数在单位时间内**最多执行一次**。多余的触发被忽略，直到时间窗口过去。

**类比：游戏中的技能冷却（CD）。**

> 无论你多么疯狂地按技能键，技能都必须等待冷却转完才能再次施放。按再多次也不会让冷却缩短。

Throttle 的哲学是**以固定时间为准**——保证执行频率上限。

### 时间轴对比

```
事件: -----1--2---3--4----5---------6---->

Debounce: ------------------------[5]-------->  (停止后才执行最后一次)
Throttle: -----[1]------[3]---------[6]---->  (按固定间隔执行)
```

> **一句话总结：防抖是"延迟合并"，节流是"频率限制"。**

---

## 三、实现对比——一行代码看本质

### 标准实现并排对比

最精简的核心实现揭示了它们的本质差异：

```js
// Debounce："你有新事件？好，我重新计时。"
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);                // 每次调用都清除上一次的计时器
    timer = setTimeout(() => fn(...args), delay); // 重新开始计时
  };
}

// Throttle："时间到了吗？没到就忽略。"
function throttle(fn, interval) {
  let lastTime = 0;
  return (...args) => {
    const now = Date.now();
    if (now - lastTime >= interval) {   // 检查是否满足时间间隔
      lastTime = now;
      fn(...args);                      // 立即执行
    }
  };
}
```

**关键差异在于控制机制：**

- **Debounce** 使用 `clearTimeout` + `setTimeout`：每次触发都**重置**计时器
- **Throttle** 使用 `Date.now()` 时间戳比较：每次触发都**检查**时间差

### 四象限变体

两种策略都有 **leading**（首次立即执行）和 **trailing**（停止后执行最后一次）两种变体，组合起来是四种行为：

| 策略 | leading | trailing | 行为 |
|------|---------|----------|------|
| Debounce | ❌ | ✅（默认） | 停止后 delay 毫秒执行，持续触发永不执行 |
| Debounce | ✅ | ❌ | 立即执行第一次，后续持续触发不再执行 |
| Debounce | ✅ | ✅ | 首次立即执行，停止后 delay 毫秒再执行一次 |
| Throttle | ✅（默认） | ❌ | 首次立即执行，之后按固定间隔执行 |
| Throttle | ❌ | ✅ | 首次延迟 interval 毫秒执行，停止后再执行一次 |
| Throttle | ✅ | ✅ | 首次立即 + 最后一次执行（Lodash 默认） |

其中 **Debounce({leading: true, trailing: true})** 的行为与 **Throttle** 极其接近——这并非巧合，后面会解释。

### Lodash 的实现参考

生产环境中通常不会手写，而是使用 Lodash：

```js
import { debounce, throttle } from 'lodash-es';

// 防抖：用户停止输入 300ms 后执行
const search = debounce((q) => fetchSearch(q), 300);

// 节流：滚动时最多每 200ms 执行一次
const onScroll = throttle(() => updatePosition(), 200);
```

Lodash 实现比标准版复杂得多，它包含了：
- `leading` / `trailing` 配置
- `maxWait` —— 保证至少每隔 maxWait 毫秒执行一次（防抖中的节流）
- `cancel()` / `flush()` 手动控制
- 正确的 `this` 绑定和参数传递

### 时间轴对比（完整版）

以 **1s 的事件间隔、300ms 的延迟/间隔** 为例，连续触发 6 次：

```
事件: ---1---2---3---4---5---6-->

Debounce (trailing):
       --------------------------[6]-->  (停止后 300ms 执行最后一次)

Debounce (leading):
       --[1]------------------------->  (立即执行第一次，后续被忽略)

Debounce (leading+trailing):
       --[1]----------------------[6]-->  (首次立即 + 末次延迟)

Throttle (leading):
       --[1]------[3]------[5]-------->  (固定间隔，首次立即)

Throttle (trailing):
       ------[2]------[4]------[6]--->  (固定间隔，首次延迟)

Throttle (leading+trailing):
       --[1]------[3]------[5]---[6]->  (固定间隔 + 最后一次)
```

---

## 四、经典场景对照

### 决策速查表

| 场景 | 推荐策略 | 理由 |
|------|---------|------|
| **搜索框输入自动补全** | Debounce (trailing) | 等用户停下来了再请求，避免无意义的中间结果 |
| **窗口 resize** | Throttle | resize 可能永远不会"停"，需要在过程中按节拍响应 |
| **滚动懒加载 / 无限滚动** | Throttle | 需要在滚动过程中按频率检测位置，不能等滚动结束 |
| **按钮防重复提交** | Throttle (leading) | 首次立即执行，冷却期内忽略重复点击 |
| **实时保存草稿** | Debounce (trailing) | 等用户停止编辑再保存，避免频繁写入 |
| **拖拽元素位置同步** | Throttle | 需要持续同步，但不能太频繁（60fps 即可） |
| **图表 / Canvas 重绘** | Throttle + rAF | 控制重绘频率，与屏幕刷新率同步 |
| **埋点 / 日志上报** | Debounce (leading+trailing) + maxWait | 既要在首次触发时立即上报，又要在持续触发中周期性上报 |

### 常见误区

**误区一：按钮防重复点击用 Debounce**

```js
// ❌ 错误：使用 debounce
const submit = debounce(() => submitForm(), 300);
submit(); // 不执行——用户在等效果，但按钮没反应！
submit(); // 重置计时器
submit(); // 重置计时器，还是不执行
```

此时用户点了按钮却发现没有任何反馈，300ms 后才执行。更合理的方案：

```js
// ✅ 正确：使用 throttle(leading) 或简单 flag
const submit = throttle(() => submitForm(), 300, { leading: true });
submit(); // 立即执行
submit(); // 被忽略（CD 中）
submit(); // 被忽略（CD 中）
```

**误区二：所有高频场景都用 Debounce**

```js
// ❌ 滚动场景用 debounce——只在停止后才触发
const handleScroll = debounce(() => checkPosition(), 200);

// ✅ 滚动场景用 throttle——滚动过程中按频率触发
const handleScroll = throttle(() => checkPosition(), 200);
```

用 debounce 做滚动监听，用户必须停止滚动才会触发——如果用户一直在慢速滚动，懒加载永远不会触发。用 throttle 才能在滚动过程中按节拍检测位置。

---

## 五、生产环境中的陷阱

### 1. Debounce 的竞态条件

这是上一篇[《你的防抖在欺骗你》](../优化/你的防抖在欺骗你.md)的核心主题。Debounce 只解决了"调用频率"问题，但没有解决"请求生命周期"问题：

```js
const search = debounce(async (q) => {
  const res = await fetch(`/api/search?q=${q}`);
  const data = await res.json();
  render(data); // 可能 render 的是过期的数据！
}, 300);
```

如果请求 A（查询 "abc"）比请求 B（查询 "abcd"）慢，即使 B 后发出，A 的响应可能在 B 之后到达。**UI 会显示过期的结果。**

**解决方案：AbortController（取消过期请求）**

```js
let controller;

const search = debounce(async (q) => {
  if (controller) controller.abort();    // 取消上一个请求
  controller = new AbortController();

  try {
    const res = await fetch(`/api/search?q=${q}`, {
      signal: controller.signal,
    });
    const data = await res.json();
    render(data);                        // 只有最新请求的结果
  } catch (err) {
    if (err.name === 'AbortError') return; // 预期行为，忽略
    showError(err);
  }
}, 300);
```

### 2. Throttle 的首次 / 末次执行

Throttle 的 leading / trailing 选择经常被忽略，但在某些场景下至关重要：

```js
// 没有理解 trailing 的含义
const save = throttle(() => saveToServer(data), 1000);

// 用户停止操作后：throttle(leading) 不会执行最后一次
// throttle(leading+trailing) 会额外执行一次
// 可能导致"多余的保存请求"
```

一个经典的坑：**Throttle (trailing) 会在停止后"多执行一次"**。

```
事件: --[点击]------[点击]------(停止)
Throttle(leading):  ✅执行  ✅执行
Throttle(trailing): ✅执行  ✅执行  ✅再执行一次(停止后才触发)
```

如果 trailing 执行了一个本不需要的操作（比如提交了一份不完整的状态），就可能造成 bug。

### 3. React 中的闭包陷阱

在 React 中使用 debounce / throttle，最常见的坑是捕获了过时的闭包值：

```js
// ❌ 问题代码
function SearchBox() {
  const [query, setQuery] = useState('');

  // search 函数在每次渲染时重新创建
  const search = debounce(async () => {
    const res = await fetch(`/api/search?q=${query}`);
    // query 是旧的！闭包捕获的是创建时的值
  }, 300);

  return <input onChange={(e) => {
    setQuery(e.target.value);
    search(); // 这里的 search 捕获的是旧的 query
  }} />;
}
```

**解决方案 1：useRef 保持最新值**

```js
function SearchBox() {
  const [query, setQuery] = useState('');
  const queryRef = useRef(query);
  queryRef.current = query; // 始终保持最新

  const search = useMemo(() => debounce(async () => {
    const res = await fetch(`/api/search?q=${queryRef.current}`);
    // ✅ 使用 ref 获取最新值
  }, 300), []);

  // ...
}
```

**解决方案 2：useCallback + 参数传递**

```js
function SearchBox() {
  const search = useMemo(() => debounce(async (q) => {
    // ✅ 通过参数而非闭包获取值
    const res = await fetch(`/api/search?q=${q}`);
  }, 300), []);

  return <input onChange={(e) => search(e.target.value)} />;
}
```

### 4. leading + trailing 同时为 true

Lodash 的 `debounce(fn, wait, { leading: true, trailing: true })` 实际上表现得很像 throttle。为什么？

因为在持续触发的情况下：

1. **leading** 保证第一次立即执行
2. **trailing** 保证停止后多执行一次
3. 持续触发期间，函数以 `wait` 为间隔执行

这不就是 throttle 吗？没错。这揭示了两种策略的深层联系：

> **Debounce + leading + trailing = 带有"停止后回执"的 Throttle**

而 Lodash 的 `debounce` 还有一个 `maxWait` 参数——这正是把 debounce 变成 throttle 的关键。

---

## 六、进阶——两者组合

### 6.1 Debounce + AbortController（可靠搜索）

这是生产级的搜索输入方案：

```js
function createSearch(delay = 300) {
  let controller;

  const search = debounce(async (q, onResult, onError) => {
    if (controller) controller.abort();
    controller = new AbortController();

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      onResult(data);
    } catch (err) {
      if (err.name === 'AbortError') return;
      onError(err);
    }
  }, delay);

  return search;
}
```

### 6.2 Throttle + requestAnimationFrame

对于 UI 更新场景，`requestAnimationFrame` 是天然的对齐方案：

```js
function rafThrottle(fn) {
  let rafId;

  return (...args) => {
    if (rafId) return;               // 已有待执行帧，忽略
    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;                  // 执行完毕，允许下一帧
    });
  };
}

// 使用
const onScroll = rafThrottle(() => {
  // 这个回调最多以 60fps（约 16.6ms）的频率执行
  updateScrollIndicator();
});
```

`requestAnimationFrame` 的优势在于：
- 自动与屏幕刷新率同步（60Hz / 120Hz / 144Hz）
- 页面不可见时自动暂停，不浪费资源
- 浏览器会在同一帧内批量处理所有变更

但 rAF 的限制是：无法自定义间隔（固定在 ~16.6ms）。如果需要更长的间隔，可以结合 throttle：

```js
function throttleWithRaf(fn, minInterval = 0) {
  let lastTime = 0;
  let rafId;

  return (...args) => {
    const now = performance.now();

    if (rafId) return;                     // 已有待执行 rAF
    if (now - lastTime < minInterval) return; // 时间窗口未到

    rafId = requestAnimationFrame(() => {
      lastTime = performance.now();
      fn(...args);
      rafId = null;
    });
  };
}
```

### 6.3 maxWait——Debounce 中的"节流基因"

Lodash `debounce` 的 `maxWait` 参数是一个被低估的特性。

它的语义是：**保证被 debounce 的函数至少每隔 maxWait 毫秒执行一次**。

```js
const save = debounce(
  async () => saveToServer(getState()),
  500,
  { maxWait: 2000 }
);
```

这意味着：
- 如果用户持续有输入，debounce 可能永远不会在 500ms 时触发
- 但 **maxWait: 2000** 强制保证：无论如何，每 2 秒至少执行一次
- 如果用户停止输入，500ms 的 debounce 正常触发

**这就是 debounce 和 throttle 的融合产物：**
- Debounce 控制"停止后执行"的行为
- maxWait 控制"最长等待时间"，本质上是嵌入了一个 throttle

Lodash 的源码实现中，`maxWait` 的逻辑是：

```
每次调用:
  if (maxWait 已到):
    立即执行（无视 debounce 计时器）
  else:
    重置 debounce 计时器
```

---

## 七、决策指南——到底该用哪个？

### 三步决策法

```
第一步：需要等用户停下来了再执行？
  ├─ ✅ → 用 Debounce (trailing)
  │   例：搜索补全、表单校验、实时保存
  └─ ❌ → 走第二步

第二步：需要在过程中按固定频率执行？
  ├─ ✅ → 用 Throttle (leading)
  │   例：滚动监听、resize、拖拽同步、射击
  └─ ❌ → 走第三步

第三步：既不能等太久、又不需要太频繁？
  ├─ ✅ → 用 Debounce + maxWait
  │   例：埋点上报、位置同步、协作编辑
  └─ 还有疑问 → 参考下面的对照表
```

### 总结对照表

| 维度 | Debounce | Throttle |
|------|----------|----------|
| **本质** | 把一串调用合并为一次 | 限制调用的频率上限 |
| **控制机制** | 重置计时器（clearTimeout） | 检查时间差（Date.now） |
| **类比** | 电梯关门 | 技能冷却 |
| **首次触发** | 延迟（trailing 默认） | 立即（leading 默认） |
| **末次触发** | 总会执行（trailing 默认） | 取决于 trailing 配置 |
| **持续触发中** | 永不执行（trailing） | 按间隔执行 |
| **适用场景** | 搜索、校验、保存、切换 | 滚动、resize、拖拽、动画 |
| **Lodash 方法** | `_.debounce(fn, wait)` | `_.throttle(fn, wait)` |
| **核心参数** | `leading`, `trailing`, `maxWait` | `leading`, `trailing` |

### 一句话速记

> **如果你需要"等"，用 Debounce；如果你需要"限速"，用 Throttle。如果既要等又要限速，用 Debounce + maxWait。**

---

## 写在最后

Debounce 和 Throttle 不是竞争对手，它们是一个工具箱里的两把不同的工具。选对工具的前提是理解问题的本质：

- 问题是你只关心"最终结果"吗？→ **Debounce**（搜索、保存）
- 问题是你需要"过程中的节拍"吗？→ **Throttle**（滚动、动画）

两者也并非互斥。在实际生产代码中，你经常会同时使用它们——或者使用 Lodash 那超越了两者边界的 `debounce`（它通过 `leading`、`trailing` 和 `maxWait` 事实上统一了两种行为）。

把它们的原理、变体和陷阱都理解透彻了，你就能在任何场景下做出正确的选择。

---

*延伸阅读：*

- [你的防抖在欺骗你](../优化/你的防抖在欺骗你.md) — Debounce 在生产环境中的竞态问题和解决方案
- [Lodash debounce 源码分析](https://github.com/lodash/lodash/blob/master/debounce.js) — 生产级实现
- [MDN: requestAnimationFrame](https://developer.mozilla.org/zh-CN/docs/Web/API/window/requestAnimationFrame) — 与 throttle 搭配使用的最佳实践
