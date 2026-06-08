# React 深度学习笔记

> 基于 React 18.3，深入理解 React 工作原理与核心机制

## 📚 学习路径建议

### 初级阶段
- [ ] 理解 React 基础概念（组件、Props、State）
- [ ] 掌握常用 Hooks（useState, useEffect, useRef）
- [ ] 理解组件生命周期
- [ ] 实践基础项目开发

### 中级阶段
- [ ] 理解虚拟 DOM 和 Diff 算法
- [ ] 掌握性能优化技巧
- [ ] 学习自定义 Hooks
- [ ] 理解 React 18 新特性

### 高级阶段
- [ ] 深入 Fiber 架构
- [ ] 理解并发渲染机制
- [ ] 掌握调度器原理
- [ ] 研究源码实现

---

## 1. React 核心工作流程

> 本章从最高视角俯瞰 React 的整体运作机制。
> 理解本章后，你应该能回答："从用户点击按钮，到屏幕上显示新内容，中间发生了什么？"
> 后续各章将分别深入本章提到的每个模块。

### 1.1 三层架构：谁负责什么？

React 的运行时由三个独立的模块协作完成。理解它们的职责边界，是读懂 React 源码的第一步：

```
┌─────────────────────────────────────────────────────────────┐
│                    触发更新 (Trigger)                         │
│  setState / useState / useReducer / forceUpdate / startTransition │
└────────────────────────┬────────────────────────────────────┘
                         │ 产生 "更新请求"
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               ① 调度器 (Scheduler)                            │
│   ┌────────────────────────────────────────────────────┐    │
│   │  职责：决定"什么时候"执行渲染                         │    │
│   │  - 维护任务队列 (taskQueue / timerQueue)             │    │
│   │  - 时间分片 (5ms 一 yield)                           │    │
│   │  - 优先级调度 (高优先级插队)                          │    │
│   │  - 空闲时主动让出主线程 (requestIdleCallback 模拟)     │    │
│   └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ 分配 Lane，决定渲染时机
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               ② 协调器 (Reconciler / Fiber)                   │
│   ┌────────────────────────────────────────────────────┐    │
│   │  职责：决定"渲染什么"                                │    │
│   │  - 创建/复用 Fiber 节点 (createWorkInProgress)       │    │
│   │  - 执行 Diff 算法 (reconcileChildren)                │    │
│   │  - 标记副作用 flags (Placement / Update / Deletion) │    │
│   │  - 收集需要执行的 Effect 列表                         │    │
│   │  - 构建 workInProgress 树                            │    │
│   │  ★ 此阶段可中断 (纯内存操作，不操作 DOM)               │    │
│   └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ 产出：标记了 flags 的 Fiber 树
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               ③ 渲染器 (Renderer)                             │
│   ┌────────────────────────────────────────────────────┐    │
│   │  职责：决定"如何应用到宿主环境"                       │    │
│   │  - ReactDOM: 操作真实 DOM                            │    │
│   │  - ReactNative: 调用原生 UI 组件                     │    │
│   │  - ReactTest: 输出测试断言                           │    │
│   │  - ReactART: 绘制到 Canvas                          │    │
│   │  ★ 此阶段不可中断 (一旦开始必须执行完)                 │    │
│   └────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ DOM 操作 → 浏览器绘制
                         ▼
                   用户看到新 UI
```

**类比**：
| 角色 | 类比 | 解释 |
|------|------|------|
| Scheduler | **项目经理** | 决定"什么任务先做、什么可以等、什么要插队" |
| Reconciler | **设计师** | 设计出新方案（Fiber 树），标出要改的地方（flags） |
| Renderer | **施工队** | 按图纸实际动手改（操作 DOM） |

---

### 1.2 更新是如何触发的？——三种入口

React 的渲染流程由"更新"驱动。任何更新都源自以下三种入口之一：

```
  ┌──────────────────────┐
  │  React 更新触发       │
  ├──────────────────────┤
  │ ① ReactDOM.createRoot│  ← 首次渲染
  │    → 创建 FiberRoot   │
  ├──────────────────────┤
  │ ② setState / useState│  ← 组件内部状态变更
  │    → 创建 update 对象 │
  ├──────────────────────┤
  │ ③ startTransition    │  ← 标记为低优先级更新
  │    → 分配 Transition  │
  └──────────────────────┘
          │ 统一入口
          ▼
  scheduleUpdateOnFiber(fiber, lane)
```

无论哪种入口，最终都会调用 `scheduleUpdateOnFiber`——这是 React 渲染流程的**总入口**。

---

### 1.3 渲染流水线——从触发到呈现的完整旅程

一次更新触发后，React 内部经历一条固定的流水线。这是全章最重要的概念图：

```
                          ┌──────────────┐
                          │  用户交互触发  │
                          │  setState()   │
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │  ① 分配 Lane  │  ← requestUpdateLane()
                          │  ② 标记 Fiber │  ← fiber.lanes | childLanes
                          │  ③ 冒泡到 Root│  ← markUpdateLaneFromFiberToRoot
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                     ┌───▶│  ④ 调度阶段   │←────┐
                     │    │  ensureRoot-  │     │
                     │    │  IsScheduled  │     │
                     │    └──────┬───────┘     │
                     │           │             │
                     │    ┌──────▼───────┐     │
                     │    │  ⑤ Scheduler │     │  ← 高优先级任务可打断
                     │    │  (时间分片)   │     │    当前低优先级任务
                     │    │  workLoop    │     │
                     │    └──────┬───────┘     │
                     │           │             │
                     │    ┌──────▼───────┐     │
                     │    │  ⑥ Render 阶段│     │  ← 可中断 (纯内存)
                     │    │  beginWork   │     │    高优任务打断后恢复
                     │    │  completeWork│     │
                     │    └──────┬───────┘     │
                     │           │             │
                     │    ┌──────▼───────┐     │
                     │    │  ⑦ Commit 阶段│     │  ← 不可中断
                     │    │  (同步执行)   │     │    直接操作 DOM
                     │    │  beforeMutation|     │
                     │    │  mutation    │     │
                     │    │  layout      │     │
                     │    └──────┬───────┘     │
                     │           │             │
                     │    ┌──────▼───────┐     │
                     │    │  浏览器绘制    │     │
                     │    │  用户看到新 UI  │     │
                     │    └──────┬───────┘     │
                     │           │             │
                     │    ┌──────▼───────┐     │
                     │    │  ⑧ Passive   │     │
                     └────│  Effects     │─────┘  ← useEffect 异步执行
                          │  (下一帧)     │        可能触发又一次更新
                          └──────────────┘
```

> **关键概念**：React 的渲染不是"一锤子买卖"，而是一个**循环**——每次渲染结束后如果有新的更新触发，就重新进入调度 → 执行循环。

---

### 1.4 调度阶段——Scheduler 如何决定"什么时候渲染"

> 完整细节见第 4 章 §调度器

```javascript
function ensureRootIsScheduled(root) {
  // ★ 读取 root 上当前所有待处理的 Lanes
  const nextLanes = getNextLanes(root, NoLanes);

  if (nextLanes === NoLanes) {
    return;  // 没有待处理的更新，直接返回
  }

  // ★ 判断是否需要同步执行
  const newCallbackPriority = getHighestPriorityLane(nextLanes);

  if (newCallbackPriority === SyncLane) {
    // 同步优先级：立即执行，不经过 Scheduler 的时间分片
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else {
    // 异步优先级：通过 Scheduler 调度（时间分片，可打断）
    scheduleCallback(
      schedulerPriorityLevel,
      performConcurrentWorkOnRoot.bind(null, root)
    );
  }
}
```

**关键决策树**：

```
root.pendingLanes 中是否有 SyncLane？
  ├── YES → 立即同步执行 (scheduleSyncCallback)
  │         不经过时间分片，一口气执行完
  │
  └── NO  → 通过 Scheduler 调度 (scheduleCallback)
            注册到 taskQueue 中
            Scheduler 在每一帧的空闲时间执行
            5ms 一 yield，让出主线程给浏览器
```

这里涉及两个核心机制：

| 机制 | 说明 |
|------|------|
| **Lane 优先级** | 决定"哪些更新必须先执行"（详见第 4 章 §4.3） |
| **时间分片** | 每个渲染任务不超过 5ms，到期保存进度 yield 给浏览器 |
| **可中断性** | 高优先级更新可以打断正在执行的低优先级渲染 |
| **任务恢复** | 断点保存在 workInProgress 树的遍历栈中，从中断处继续 |

---

### 1.5 Render 阶段——Reconciler 如何构建新 Fiber 树

> 完整细节见第 2 章 §Fiber 架构、第 3 章 §Reconciliation

Render 阶段的核心是**以 DFS（深度优先遍历）方式遍历 Fiber 树**，每个节点经历两个子阶段：

```
                         performUnitOfWork
                               │
                     ┌─────────▼─────────┐
                     │  beginWork(fiber)   │  ← "向下钻"：处理当前节点
                     │  - 根据 tag 分流    │     创建子 Fiber 或复用
                     │  - reconcileChildren│     运行 Diff 算法
                     │  - 标记 flags       │     标记 DOM 操作类型
                     └─────────┬─────────┘
                               │
                    ┌──────────▼──────────┐
                    │  有子节点？           │
                    │  (fiber.child)       │──YES──→ 继续 beginWork(子节点)
                    └──────────┬──────────┘
                               │ NO
                     ┌─────────▼─────────┐
                     │  completeWork(fiber)│  ← "向上冒泡"：收尾当前节点
                     │  - 创建 DOM 实例    │     或更新已有 DOM 属性
                     │  - flags 冒泡       │     子 flags → 父 flags
                     └─────────┬─────────┘
                               │
                    ┌──────────▼──────────┐
                    │  有兄弟节点？         │
                    │  (fiber.sibling)     │──YES──→ beginWork(兄弟节点)
                    └──────────┬──────────┘
                               │ NO
                    ┌──────────▼──────────┐
                    │  回到父节点继续       │
                    │  completeWork(父)    │──→ 向上冒泡
                    └──────────┬──────────┘
                               │
                    直到回到 HostRoot
                               │
                     ┌─────────▼─────────┐
                     │  Render 阶段完成    │
                     │  workInProgress 树   │
                     │  已标记好所有 flags  │
                     └───────────────────┘
```

**完整的遍历示例**（对一棵三节点树的 DFS）：

```
         div ★
        /   \
    span     p
   /   \       \
text1  text2   text3

遍历顺序：
  ① beginWork(div)     → 创建 span、p 子 Fiber
  ② beginWork(span)    → 创建 text1、text2 子 Fiber
  ③ beginWork(text1)   → 没有子节点
  ④ completeWork(text1)→ 没有兄弟节点，回到父
  ⑤ beginWork(text2)   → 没有子节点
  ⑥ completeWork(text2)→ 没有兄弟节点，回到父
  ⑦ completeWork(span) → sibling → p
  ⑧ beginWork(p)       → 创建 text3 子 Fiber
  ⑨ beginWork(text3)   → 没有子节点
  ⑩ completeWork(text3)→ 没有兄弟节点，回到父
  ⑪ completeWork(p)    → 没有兄弟节点，回到父
  ⑫ completeWork(div)  → 回到 Root → 结束

规律：beginWork 是先序遍历，completeWork 是后序遍历
```

**为什么 Render 阶段可中断？**
- 所有操作都是纯内存的（操作 JS 对象，不碰 DOM）
- 每次 `beginWork` / `completeWork` 都是原子操作
- 中断后，Scheduler 保存当前 Fiber 引用
- 恢复时从上次中断的 Fiber 继续往下走

---

### 1.6 Commit 阶段——Renderer 如何将变化应用到屏幕

> 完整细节见第 2 章 §2.6 completeWork、§2.7 setState 的完整 Fiber 之旅

Render 阶段完成后，`workInProgress` 树已经标记好所有 flags。Commit 阶段的任务就是**逐一执行这些 flags**。

Commit 分为三个同步子阶段 + 一个异步子阶段：

```
             Render 阶段完成 (workInProgress 树就绪)
                         │
                         ▼
             ┌─────────────────────┐
             │ ① Before Mutation   │  ← 读取 DOM 快照
             │  getSnapshotBeforeUpdate │  (class 组件)
             │  保存当前状态         │
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
             │ ② Mutation          │  ← 实际操作 DOM
             │  Placement (新增)    │     (flags & Placement)
             │  Update (更新)       │     (flags & Update)
             │  Deletion (删除)     │     (flags & ChildDeletion)
             │  执行 useEffect 清理  │
             └──────────┬──────────┘
                        │
             ┌──────────▼──────────┐
             │ ③ Layout            │  ← DOM 已就绪
             │  useLayoutEffect     │     可读取最新布局
             │  componentDidMount   │
             │  设置 Ref            │
             │  ★ root.current =   │  ← 指针交换
             │    finishedWork      │    workInProgress → current
             └──────────┬──────────┘
                        │
              ┌─────────▼─────────┐
              │  浏览器绘制屏幕     │  ← 用户看到新 UI
              └─────────┬─────────┘
                        │
             ┌──────────▼──────────┐
             │ ④ Passive Effects   │  ← 异步执行（下一帧）
             │  useEffect           │     不阻塞主线程
             └──────────┬──────────┘
                        │
                  可能触发新的更新 → 回到调度阶段（循环）
```

**Commit 阶段执行的内容取决于 flags**：

```javascript
// Fiber.flags 中每个位代表一种 DOM 操作
// 例如一个被标记为 Placement | Update 的 Fiber：

{ flags: Placement | Update }    ← 被标记了两种操作
         │
         ├── commitPlacement(fiber)   ← 插入 DOM 节点
         │     使用 parentFiber.stateNode 做参考
         │     执行 parentNode.insertBefore()
         │
         └── commitUpdate(fiber)      ← 更新 DOM 属性
               对比新旧 props
               只更新变化的属性
               node.setAttribute() / node.textContent = ...
```

**commitMutationEffectsOnFiber 的伪代码**：

```javascript
function commitMutationEffectsOnFiber(finishedWork, root) {
  const flags = finishedWork.flags;

  // 根据 flags 位的组合，执行不同的 DOM 操作
  if (flags & ContentReset) {
    // 重置文本内容
    finishedWork.stateNode.textContent = '';
  }

  if (flags & Ref) {
    // 清理之前的 Ref
    safelyDetachRef(finishedWork);
  }

  if (flags & Placement) {
    // ★ 插入新节点
    commitPlacement(finishedWork);
    finishedWork.flags &= ~Placement;  // 清除标记
  }

  if (flags & Update) {
    // ★ 更新属性
    commitUpdate(
      finishedWork.stateNode,
      finishedWork.memoizedProps,
      ...  // 新旧 props 对比
    );
    finishedWork.flags &= ~Update;
  }

  if (flags & Deletion) {
    // ★ 删除节点
    commitDeletion(finishedWork);
    finishedWork.flags &= ~Deletion;
  }

  // 递归子节点（深度遍历所有设置了 subtreeFlags 的路径）
  commitMutationEffectsOnFiber(finishedWork.child, root);
}
```

---

### 1.7 从点击到渲染——一次完整的实战追踪

将以上所有环节串联起来，看一次真实的点击事件如何驱动整个系统：

```jsx
function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

用户点击按钮的完整旅程：

```
Step 0: 初始状态
  ┌─────────────────────────────────────────────┐
  │ 用户看到: [Count: 0]         (已经渲染好的) │
  │ current 树: 完整的 DOM 结构                   │
  └─────────────────────────────────────────────┘

Step 1: 用户点击按钮
  ┌─────────────────────────────────────────────┐
  │ 浏览器事件冒泡 → React 事件系统捕获            │
  │ dispatchSetState(fiber, queue, count + 1)    │
  │                                              │
  │ ① requestUpdateLane(fiber) → DefaultLane    │
  │   (或 InputContinuousLane，取决于事件类型)    │
  │ ② fiber.lanes |= DefaultLane                │
  │ ③ parent.childLanes |= DefaultLane           │
  │ ④ ...冒泡到 root.pendingLanes                │
  └─────────────────────────────────────────────┘

Step 2: 调度阶段
  ┌─────────────────────────────────────────────┐
  │ ensureRootIsScheduled(root)                  │
  │   → getNextLanes(root) → DefaultLane         │
  │   → 不是 SyncLane                           │
  │   → scheduleCallback() 注册到 Scheduler      │
  │                                              │
  │ Scheduler 在下一帧空闲时开始执行               │
  └─────────────────────────────────────────────┘

Step 3: Render 阶段（可中断）
  ┌─────────────────────────────────────────────┐
  │ performConcurrentWorkOnRoot(root)            │
  │   → prepareFreshStack(root, renderLanes)     │
  │   → createWorkInProgress 复制树               │
  │                                              │
  │ beginWork(HostRoot): lanes 匹配? → 继续      │
  │   → reconcileChildren → 无变化               │
  │                                              │
  │ beginWork(CounterFiber): lanes 匹配? → ✅     │
  │   → renderWithHooks()                        │
  │     → useState 返回新值: [1, setCount]       │
  │     → 子节点变更为: <button>Count: 1</button>│
  │   → reconcileChildren: diff 对比              │
  │     → button 的 key 相同？相同 → 复用 Fiber   │
  │     → 但 props 变化 (children: "Count: 0" →  │
  │       "Count: 1")                            │
  │   → buttonFiber.flags |= Update              │
  │   → buttonFiber.pendingProps = newProps      │
  │                                              │
  │ completeWork(button)                          │
  │   → flags 冒泡到 CounterFiber                │
  │ completeWork(CounterFiber)                   │
  │   → flags 冒泡到 HostRoot                    │
  │ completeWork(HostRoot)                       │
  │   → Render 阶段完成                          │
  └─────────────────────────────────────────────┘

Step 4: Commit 阶段（同步，不可中断）
  ┌─────────────────────────────────────────────┐
  │ commitRoot(root)                             │
  │                                              │
  │ ① Before Mutation:                           │
  │   → 保存当前 DOM 快照（如果需要的话）          │
  │                                              │
  │ ② Mutation:                                  │
  │   → commitMutationEffects                   │
  │   → 遍历 Fiber 树                            │
  │   → 找到 buttonFiber.flags & Update          │
  │   → commitUpdate(buttonEl, newProps)         │
  │   → buttonEl.textContent = "Count: 1"        │
  │   → DOM 已更新但浏览器还没绘制                 │
  │                                              │
  │ ③ Layout:                                    │
  │   → 执行 useLayoutEffect（本例无）             │
  │   → ★ root.current = finishedWork            │
  │   → 指针交换，workInProgress → 新的 current  │
  └─────────────────────────────────────────────┘

Step 5: 浏览器绘制
  ┌─────────────────────────────────────────────┐
  │ 浏览器检测到 DOM 变更                         │
  │ 重新计算布局 → 绘制 → 用户看到 "Count: 1"     │
  └─────────────────────────────────────────────┘

Step 6: Passive Effects（异步，下一帧）
  ┌─────────────────────────────────────────────┐
  │ 执行 useEffect（本例无）                      │
  │ → 如果 useEffect 中有 setState              │
  │   → 触发新一轮更新 → 回到 Step 1             │
  └─────────────────────────────────────────────┘
```

---

### 1.8 React 的设计哲学——为什么这样设计？

理解 React 为什么要这样设计，比理解它做了什么更重要：

| 设计决策 | 原因 | 结果 |
|---------|------|------|
| **声明式 UI** | 开发者描述"UI 应该是什么样"，而非"如何操作 DOM" | 状态驱动视图，不用手动 DOM 操作 |
| **虚拟 DOM** | 避免每次更新都重建整个 DOM 树 | 通过 Diff 找出最小变更集 |
| **Fiber 架构** | 解决 Stack Reconciler 的"阻塞渲染"问题 | 可中断、可恢复、优先级调度 |
| **双缓存树** | 避免操作进行中的 UI 树 | current 树稳定，workInProgress 树可自由修改 |
| **Lane 优先级** | 精细控制不同更新的紧急程度 | Transition 可被打断，Sync 不可打断 |
| **Render + Commit 分离** | 纯内存操作可中断，DOM 操作不可中断 | 兼顾灵活性和一致性 |

**React 的核心哲学可以概括为一句话**：

> **React 将"状态变化"转化为"最小 DOM 操作"，并在"恰当的时间"以"恰当的优先级"执行它们。**

其中：
- **"最小 DOM 操作"** → Reconciliation + Flags 机制（第 3 章）
- **"恰当的时间"** → Scheduler + 时间分片（第 4 章）
- **"恰当的优先级"** → Lanes 系统（第 4 章 §4.3）

---

### 1.9 章节地图——本章与后续章节的对应关系

```
┌─────────────────┐     ┌──────────────────────┐
│  §1 核心工作流程  │     │  后续章节             │
├─────────────────┤     ├──────────────────────┤
│ 1.1 三层架构     │────→│ §2 Fiber 架构        │
│ 1.5 Render 阶段  │────→│ §3 Reconciliation    │
│ 1.4 调度阶段     │────→│ §4 Scheduler + Lanes │
│ 1.6 Commit 阶段  │────→│ (融入 §2 commitRoot) │
│                  │     │ §5 Bailout           │
│                  │     │ §6 Hooks             │
│ 1.2 更新触发     │────→│ §6 Hooks (dispatch)  │
└─────────────────┘     └──────────────────────┘

如果你是初学者，建议从本章读起，建立了整体认知后，
再按需深入后续章节。每章开头都有"前置知识"提示。
```
---
## 2. Fiber 架构详解

> Fiber 是 React 16+ 的核心数据结构，它不是一个"概念"而是一个实实在在的 JavaScript 对象。
> 每一个 React 元素（组件、DOM 节点等）都对应一个 Fiber 对象，所有 Fiber 通过指针连接成一棵树。
> 理解 Fiber 是如何被创建、遍历、更新和提交的，是掌握 React 内部机制的关键。

### 2.1 Fiber 的设计目标——Fiber 解决了什么实际问题？

#### 2.1.1 从 Stack Reconciler 的痛点说起

在 React 15 及之前，React 使用 **Stack Reconciler**：

```javascript
// React 15 的递归 Diff 过程（伪代码）
function reconcile(element, container) {
  // 递归一旦开始就无法中断
  const dom = createDOM(element);
  
  element.children.forEach(child => {
    reconcile(child, dom); // 递归深入
  });
  
  container.appendChild(dom);
}
```

**实际问题场景**：

```
┌─────────────────────────────────────────┐
│  用户点击按钮 → 触发 setState          │
│                                         │
│  React 开始递归 Diff                    │
│  ┌─────────────────────────────────┐    │
│  │ 比较 VDOM 树...                 │    │
│  │ 比较组件 A                      │    │
│  │   比较组件 A-1                  │    │
│  │   比较组件 A-2                  │    │
│  │   比较组件 A-3...  (持续深入)    │    │
│  │ 比较组件 B                      │    │
│  │   比较 B-1...                    │    │
│  │  ... 递归还在继续               │    │
│  │                                 │    │
│  │  ⚠️ 用户在输入框中打字          │    │
│  │  ⚠️ 事件排队等待，无法响应       │    │
│  │  ⚠️ 页面卡顿 200ms+             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  200ms 后：                              │
│  - 用户输入的字符终于显示出来            │
│  - 用户体验极差（卡顿 + 延迟响应）       │
└─────────────────────────────────────────┘
```

**Stack Reconciler 的三个致命问题**：

| 问题 | 表现 | 用户感知 |
|------|------|----------|
| **无法中断** | 递归 Diff 一旦开始，必须执行完毕 | 页面卡顿、输入延迟 |
| **无优先级** | 所有更新同等重要 | 用户交互被数据加载阻塞 |
| **无法恢复** | 中断后必须从头开始 | 大量重复计算 |

#### 2.1.2 Fiber 如何解决这些问题

Fiber 架构将"递归"重构为"可中断的循环"：

```javascript
// React 16+ 的工作循环（简化）
function workLoop(deadline) {
  let shouldYield = false;
  
  while (nextUnitOfWork !== null && !shouldYield) {
    // ✅ 处理一个 Fiber，然后主动让出控制权
    nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
    
    // ✅ 每 5ms 检查是否需要让出主线程
    shouldYield = deadline.timeRemaining() < 1;
  }
  
  // ✅ 下次空闲时继续从断点恢复
  requestIdleCallback(workLoop);
}
```

**Fiber 的关键设计**：

| 设计 | 解决的问题 | 实际效果 |
|------|-----------|----------|
| **链表树** | 通过 `return`/`child`/`sibling` 指针连接节点 | 可以暂停和恢复遍历 |
| **状态快照** | 每个 Fiber 保存自己的状态（memoizedState） | 中断后可以恢复现场 |
| **优先级标记** | lanes 标记每个更新的紧急程度 | 高优先级更新可以插队 |
| **双缓存** | alternate 保存上次渲染的 Fiber 树 | 可以复用已计算的结果 |

### 2.2 Fiber 节点结构——每个字段的实际意义

> Fiber 对象有 20+ 个字段，但每个字段都有明确的设计目的。
> 下面结合源码来理解每个字段存在的理由。

```typescript
type Fiber = {
  // ════════════════════════════════════════════
  // 第 1 组：节点标识——"你是谁？"
  // ════════════════════════════════════════════
  tag: WorkTag,
  // 标识这个 Fiber 对应什么类型的 React 节点
  // 取值（共 20+ 种）：
  //   FunctionComponent = 0  ← 函数组件
  //   ClassComponent = 1      ← 类组件
  //   HostRoot = 3            ← 根节点（ReactDOM.createRoot()）
  //   HostComponent = 5       ← 原生 DOM 元素（div、span）
  //   HostText = 6            ← 纯文本节点
  //   Fragment = 7            ← <></>
  //   ContextProvider = 8     ← Context.Provider
  //   ContextConsumer = 9     ← Context.Consumer / useContext
  //   SuspenseComponent = 13  ← <Suspense>
  //   MemoComponent = 14      ← React.memo
  //   LazyComponent = 16      ← React.lazy
  //   OffscreenComponent = 23 ← <Offscreen>（React 19）
  //
  // 🔍 实战意义：不同类型的 Fiber 在 beginWork/completeWork
  //    中走不同的处理分支，tag 决定了如何处理这个节点。
  //    例如：
  //    - FunctionComponent → 调用函数组件获取 JSX
  //    - HostComponent → 创建/更新 DOM 元素
  //    - SuspenseComponent → 检查是否要显示 fallback

  key: null | string,
  // React 元素的 key 属性，用于列表 Diff 时识别节点
  // 🔍 实战意义：没有 key 的列表，React 按索引匹配元素；
  //    有 key 则按 key 匹配，可以提升列表重排的性能和正确性

  elementType: any,
  // 创建这个 Fiber 的 React 元素的 type
  // 开发环境与 type 可能不同（如 React.memo 包裹前）
  // 🔍 实战意义：用于 DevTools 调试，显示组件的原始类型

  type: any,
  // 组件的实际类型
  // - FunctionComponent: 函数本身（function Component() {}）
  // - ClassComponent: 类本身（class App extends Component）
  // - HostComponent: DOM 标签名（'div'、'span'）
  // - Fragment: Symbol(react.fragment)
  // 🔍 实战意义：React 通过 type 比较判断是否复用节点
  //    <A /> → <B />：type 变化，销毁重建

  stateNode: any,
  // 与 Fiber 关联的"实例"
  // - HostComponent: 真实 DOM 节点
  // - ClassComponent: 组件实例（new App() 的结果）
  // - FunctionComponent: null（函数组件没有实例）
  // 🔍 实战意义：
  //   - 通过 stateNode 可以直接访问 DOM（但不推荐）
  //   - setState 触发的 ClassComponent 更新，通过 stateNode 获取实例

  // ════════════════════════════════════════════
  // 第 2 组：树结构指针——"你在树中的位置"
  // ════════════════════════════════════════════
  return: Fiber | null,    // → 父节点
  child: Fiber | null,     // → 第一个子节点
  sibling: Fiber | null,   // → 下一个兄弟节点
  index: number,           // 在兄弟节点中的索引

  // 🔍 这三指针构成了 Fiber 树的结构，替代了递归
  //    return-child-sibling 使遍历可以暂停和恢复
  //
  // 实战意义——理解 Fiber 树结构有助于：
  //   - 理解为什么嵌套过深会影响 React 性能
  //     （深度越深，DFS 遍历的路径越长）
  //   - 理解 React.memo 为什么能跳过子树
  //     （只需要修改 Fiber 的 flags，不需要遍历子树）
  //
  //     Fiber 树结构示例：
  //     function App() {
  //       return (
  //         <div>           {/* HostComponent */}
  //           <Header />    {/* FunctionComponent */}
  //           <Content />   {/* FunctionComponent */}
  //         </div>
  //       );
  //     }
  //
  //     对应的 Fiber 树：
  //     HostRoot (return: null, child: HostDiv)
  //       │
  //       HostDiv (return: HostRoot, child: Header, sibling: null)
  //       ├── Header (return: HostDiv, sibling: Content)
  //       └── Content (return: HostDiv, sibling: null)
  //

  // ════════════════════════════════════════════
  // 第 3 组：属性与状态——"你的数据在哪里？"
  // ════════════════════════════════════════════
  pendingProps: any,
  // 新传入的 props（正在处理的 props）
  // 🔍 实战意义：pendingProps !== memoizedProps → 需要更新

  memoizedProps: any,
  // 上次渲染时最终使用的 props
  // 🔍 实战意义：React 通过比较 memoizedProps 和 pendingProps
  //    来判断 props 是否变化，决定是否跳过更新

  memoizedState: any,
  // 组件的当前状态
  // - FunctionComponent: Hook 链表头（hook0 → hook1 → ...）
  // - ClassComponent: this.state 的值
  // - HostComponent: null
  // 🔍 实战意义：memoizedState 是所有状态的总和
  //   对于函数组件，它是一整个 Hook 链表
  //   useState(0) → hook1 = {memoizedState: 0, ...} → next → 
  //   useRef(null) → hook2 = {memoizedState: {current: null}, ...} → null

  updateQueue: mixed,
  // 更新队列
  // - FunctionComponent: effect 链表（useEffect/useLayoutEffect 的回调）
  // - ClassComponent: 环形链表（setState 的 update 对象）
  // - HostComponent: null
  // 🔍 实战意义：setState 不会立即改变 state，
  //    而是把 update 加入 updateQueue，在 render 阶段批量处理

  // ════════════════════════════════════════════
  // 第 4 组：Effect（副作用）标记——"你需要做什么 DOM 操作？"
  // ════════════════════════════════════════════
  flags: Flags,
  // React 18 之前称为 effectTag
  // 标记这个 Fiber 需要执行的 DOM 操作
  // 取值：
  //   Placement = 2             ← 插入新节点
  //   Update = 4                ← 更新属性
  //   Deletion = 8              ← 删除节点
  //   PlacementAndUpdate = 10   ← 移动 + 更新
  //   Passive = 32              ← 有 useEffect 待执行
  //   Ref = 128                 ← 有 ref 需要处理
  // 🔍 实战意义：flags 告诉 commit 阶段"你要做什么"
  //   所有 DOM 操作都被推迟到 commit 阶段统一执行
  //   避免了"一边计算一边修改 DOM"的不一致性

  subtreeFlags: Flags,
  // 子树中所有 flags 的并集（冒泡合并）
  // 🔍 实战意义：React 18 的优化，如果 subtreeFlags === NoFlags
  //   说明整个子树无需任何 DOM 操作，可以跳过

  deletions: Array<Fiber> | null,
  // 待删除的子节点列表
  // 🔍 实战意义：记录哪些子节点在本轮更新中被移除
  //   commit 阶段统一执行删除操作

  // ════════════════════════════════════════════
  // 第 5 组：优先级——"你有多紧急？"
  // ════════════════════════════════════════════
  lanes: Lanes,
  // 当前 Fiber 上待处理的 lane（优先级标记）
  // 🔍 实战意义：beginWork 检查 lanes 是否在 renderLanes 中
  //   不在则跳过——这就是"优先级不够就不渲染"的实现

  childLanes: Lanes,
  // 子树中所有 lane 的并集（冒泡合并）
  // 🔍 实战意义：如果 renderLanes 与 childLanes 无交集
  //   可以跳过整个子树——这是"剪枝优化"的基础

  // ════════════════════════════════════════════
  // 第 6 组：双缓存——"你的备用副本在哪里？"
  // ════════════════════════════════════════════
  alternate: Fiber | null,
  // 指向"另一半"Fiber
  // - current 树中的 Fiber → alternate → workInProgress 树中的 Fiber
  // - workInProgress 树中的 Fiber → alternate → current 树中的 Fiber
  // 🔍 实战意义：alternate 使 React 可以复用已有的 Fiber 节点
  //   而不是每次都重新创建，大幅降低内存分配和 GC 压力

  // ════════════════════════════════════════════
  // 第 7 组：其他辅助信息
  // ════════════════════════════════════════════
  ref: Ref,                     // ref 引用
  dependencies: Dependencies,   // Context 依赖链表
  mode: TypeOfMode,            // 并发模式标识（ConcurrentMode / NoMode）
  
  // ... 还有一些较少使用的字段省略
};
```

### 2.3 双缓存机制——Fiber 树的"热替换"

> 双缓存是 Fiber 架构中最重要的设计模式之一。它让 React 在内存中完成所有计算后再一次性提交到屏幕，避免了"一边修改 DOM 一边计算"的不一致性。

#### 2.3.1 什么是 current 树和 workInProgress 树？

```javascript
// React 维护两棵 Fiber 树：
//
// 1. current 树 —— 当前在屏幕上显示的内容
//    修改它会影响用户看到的 UI，所以是"只读"的
//
// 2. workInProgress 树 —— 在内存中构建的"下一个版本"
//    在这个树上做任何修改都不会影响屏幕

// fiberRoot 是管理两棵树的容器
function FiberRootNode(containerInfo) {
  this.current = null;         // ← current 树的根
  this.containerInfo = containerInfo;
}

// 首次创建时：
// fiberRoot.current → HostRootFiber（current 树）
// HostRootFiber.alternate → null（还没有 workInProgress 树）
```

**两棵树的交替过程**：

```
                  首次渲染                   更新渲染
                ──────────                ──────────
 
 创建 FiberRoot          render阶段             render阶段
     │                     │                     │
     ▼                     ▼                     ▼
  ┌──────────┐       ┌──────────┐          ┌──────────┐
  │ current  │       │ current  │          │ workInPro│←新建
  │(空/根节点)│       │ (完整树) │          │ -gress   │
  └──────────┘       └──────────┘          └──────────┘
     │                    │                     │
     │   cloneFromFiber() │                     │ 复用
     ▼                    ▼                     ▼
  ┌──────────┐       ┌──────────┐          ┌──────────┐
  │workInPro │       │workInPro │          │ current  │←旧变成新
  │ -gress   │       │ -gress   │          │ (交换)   │
  │ (新建)   │       │ (完整树) │          └──────────┘
  └──────────┘       └──────────┘
     │                    │
     │   commitRoot()     │   commitRoot()
     ▼                    ▼
  current = workInProgress
  (首次渲染完成)    (workInProgress 树成为新的 current 树)
```

#### 2.3.2 实战场景：alternate 节点的复用

```javascript
// 当一个组件更新时，React 如何复用 existing Fiber？
function useFiber(current, pendingProps) {
  // 情况 1：current 存在 → 复用，减少内存分配
  if (current !== null) {
    const workInProgress = current.alternate;
    
    if (workInProgress !== null) {
      // ✅ 从缓存复用：alternate 还在，直接覆盖属性
      workInProgress.pendingProps = pendingProps;
      workInProgress.flags = NoFlags;
      workInProgress.subtreeFlags = NoFlags;
      workInProgress.deletions = null;
      // 其他属性保持不变（memoizedState 等）
      return workInProgress;
    }
  }

  // 情况 2：没有可复用的 → 创建新的 Fiber
  return createFiber(current.tag, pendingProps, current.key, current.mode);
}

// 🔍 实际效果：
// 一个大型应用每秒可能有数百次更新
// 每次更新如果都重新创建全部 Fiber → 大量内存分配 + GC 停顿
// 通过 alternate 复用 → 只创建真正新增的节点
```

#### 2.3.3 双缓存策略的实际收益

| 场景 | 没有双缓存 | 有双缓存 |
|------|-----------|---------|
| 首次渲染 1000 个组件 | 创建 1000 个 Fiber | 创建 1000 个 Fiber（无法避免） |
| 第二次更新（只有 1 个组件变化） | 创建 1000 个新 Fiber + 1000 个 GC | 只新建 0 个 Fiber，复用 999 个 |
| 第三次更新（新增 1 个组件） | 创建 1001 个新 Fiber | 新建 1 个，复用 1000 个 |
| 内存压力 | 高（频繁 GC） | 低（池化复用） |

#### 2.3.4 深入理解——Lane 与 Flag 分别在哪棵树上？(面试高频)

> 这是一个极容易被混淆的核心问题。
> 假设用户在页面上点击了一个按钮 → setState 被调用 → React 开始一次新的更新。
> 问：此时标记的 Lane 是挂在 **current 树**上，还是 **workInProgress 树**上？
> 再问：render 过程中标记的 Flag（如 Placement、Update）又挂在哪棵树上？

##### 1. dispatch 函数捕获的是哪个 Fiber 引用？

这要从 useState 的创建说起：

```javascript
function mountState(initialState) {
  const hook = mountWorkInProgressHook();
  const queue = hook.queue;

  // ★ dispatch 函数中绑定的 fiber，是「当前正在渲染的 Fiber」
  const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
  queue.dispatch = dispatch;

  return [hook.memoizedState, dispatch];
}
```

在 mount 阶段，`currentlyRenderingFiber` 指向的是 **workInProgress 树**上的 Fiber。

但问题来了——**mount 完成、commit 之后**，`root.current = finishedWork`，这个 Fiber 就**变成了 current 树**的节点。

```
mount 创建时：   fiber 引用 → workInProgress 树
commit 后：      root.current 指向 → fiber 现在是 current 树
setState 时：    dispatch 持有的 fiber 引用 → 指向的是「current 树上的节点」
```

所以结论是：**dispatch 里的 fiber 引用，在用户交互发生时，指向的是 current 树**。

##### 2. setState → Lane 标记在哪棵树上？

```javascript
function dispatchSetState(fiber, queue, action) {
  // fiber → 此时是 current 树上的节点
  const lane = requestUpdateLane(fiber);

  // ★ (1) Lane 被写在 current 树的 Fiber 上
  fiber.lanes |= lane;                        // ← 修改了 current Fiber

  // ★ (2) 沿着 current 树的 return 链向上冒泡
  markUpdateLaneFromFiberToRoot(fiber, lane); // ← 修改了所有父节点的 childLanes
}
```

此时：
```
current 树：       Fiber.lanes = DefaultLane ✅    ← 在此标记
                   父 Fiber.childLanes = ✅        ← 在此标记
workInProgress 树： 🚫 还不存在！（render 尚未开始）
```

**关键结论：Lane 标记在 current 树上。** 因为 setState 发生时，render 还没开始，workInProgress 树还不存在。

##### 3. render 开始后——Lane 怎么到了 workInProgress 树上？

React 在 render 阶段开始前，调用 `prepareFreshStack` → `createWorkInProgress`：

```javascript
function createWorkInProgress(current, pendingProps) {
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    // 首次复用：创建新的 workInProgress
    workInProgress = createFiber(current.tag, pendingProps, current.key, current.mode);
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // 后续复用：重置 flags（但保留 lanes！）
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  // ★ 将 current 上的 lanes 完整复制到 workInProgress
  workInProgress.lanes = current.lanes;        // ← DefaultLane 被复制过来
  workInProgress.childLanes = current.childLanes;

  // ... 其他属性
  return workInProgress;
}
```

```
复制后：
current 树：       Fiber.lanes = DefaultLane ✅
workInProgress 树： Fiber.lanes = DefaultLane ✅  ← 从 current 复制得到
```

##### 4. beginWork 检查的是哪棵树上的 Lane？

```javascript
function beginWork(current, workInProgress, renderLanes) {
  // ★ 检查的是 workInProgress.lanes
  const hasUpdate = includesSomeLane(workInProgress.lanes, renderLanes);

  if (!hasUpdate) {
    // 当前 Fiber 没有待处理的 Lane → 检查子树
    if (includesSomeLane(workInProgress.childLanes, renderLanes)) {
      // 子树有更新 → 深度遍历子节点
      return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
    }
    // 整棵子树都没有更新 → 完全跳过（bailout）
    return null;
  }

  // 有更新 → 正常执行 reconcile 逻辑
  return reconcileChildren(current, workInProgress, nextChildren, renderLanes);
}
```

Lane 检查使用的是 **workInProgress 树**上的 `lanes` / `childLanes`。

##### 5. 处理完后 Lane 从哪棵树上清除？

```javascript
// beginWork 处理完该 Fiber 后，从 workInProgress 上清除已处理的 Lane
workInProgress.lanes = removeLanes(workInProgress.lanes, renderLanes);
```

但 `current.lanes` **不一定会被清除**——它在下一次 render 时被 `createWorkInProgress` 重新覆盖。

##### 6. Flags（Placement / Update / Deletion）标记在哪？

```javascript
// reconcileChildren（beginWork 中）：
function placeChild(newFiber, ...) {
  newFiber.flags |= Placement;   // ← newFiber 是 workInProgress 树上的
}

// completeWork 中：
workInProgress.flags |= Update;  // ← workInProgress 树
workInProgress.flags |= Ref;     // ← workInProgress 树
```

**Flags 全程只标记在 workInProgress 树上。** 因为它们是 render 阶段的产物——render 阶段操作的就是 workInProgress 树。

##### 7. commit 阶段后发生了什么？

```javascript
function commitRoot(root) {
  // 执行 DOM 操作（根据 workInProgress 树上的 flags）
  // ...

  // ★ 交换指针
  root.current = finishedWork;          // workInProgress 树变成新的 current 树
  // 原来的 current 树变成 next workInProgress 的 alternate
}
```

交换后，**render 阶段标记的 flags 就「永久消失」了**（被重置了），这也合理——因为 commit 已经消费了它们。

##### 8. 完整对比

| 操作 | 在哪棵树上 | 时机 |
|------|-----------|------|
| **Lane 分配**（`requestUpdateLane`） | **current 树** | `setState` 调用时（render 开始前） |
| **Lane 冒泡**（`markUpdateLaneFromFiberToRoot`） | **current 树**（沿着 `return` 向上） | `setState` 调用时 |
| **Lane 复制**（`createWorkInProgress`） | current → **workInProgress** | render 阶段开始时 |
| **Lane 消费**（`beginWork` 检查 `workInProgress.lanes`） | **workInProgress 树** | render 阶段中 |
| **Lane 清除**（`removeLanes`） | **workInProgress 树** | render 阶段中（处理完该 Fiber 后） |
| **Flags 标记**（`reconcileChildren`/`completeWork`） | **workInProgress 树** | render 阶段中 |
| **Flags 执行**（commit DOM 操作） | 根据 workInProgress 的 flags 操作真实 DOM | commit 阶段中 |
| **指针交换**（`root.current = finishedWork`） | workInProgress → **新的 current** | commit 阶段末尾 |

##### 9. 一句话总结

> **Lane 是外部事件触发的"标记"，在 setState 时写在 current 树上，render 开始时复制到 workInProgress 树以供消费。**
> **Flag 是 render 阶段计算产生的"产物"，全程只写在 workInProgress 树上，commit 阶段消费后即废弃。**
>
> 这符合两者的本质差异：
> - Lane = 输入（"什么需要更新"）→ 来自外部事件，先落在 current 树
> - Flag = 输出（"如何操作 DOM"）→ 来自 render 计算，只留在 workInProgress 树

---

### 2.4 performUnitOfWork——Fiber 遍历的核心引擎

> Fiber 树的遍历不是简单的递归，而是一个"手动控制的 DFS 循环"。
> 每个遍历步骤由 `performUnitOfWork` 驱动，分为两个阶段：
> **beginWork**（"向下钻"）和 **completeWork**（"向上冒泡"）。

#### 2.4.1 工作循环——workLoop

```javascript
// 同步渲染工作循环（不可中断）
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 并发渲染工作循环（每 5ms 让出主线程）
function workLoopConcurrent() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
  // shouldYield() 检查：
  // 1. 当前帧是否已用尽 5ms 时间片
  // 2. 是否有更高优先级的任务需要处理
  // 如果 workInProgress 还有剩余 → 下次调度继续
}
```

#### 2.4.2 一次完整的 Fiber 遍历过程

```javascript
function performUnitOfWork(unitOfWork) {
  // 当前要处理的 Fiber
  const current = unitOfWork.alternate;

  // ═══ Phase 1: beginWork（向下）═══
  // 处理当前 Fiber，返回第一个要处理的子节点（DFS 的"深入"）
  let next = beginWork(current, unitOfWork, renderLanes);
  
  // 如果 beginWork 返回了子节点 → 继续深入处理子节点
  if (next !== null) {
    workInProgress = next;  // 循环继续处理子节点
    return;                 // ← 关键返回：先不处理兄弟节点！
  }

  // ═══ Phase 2: completeWork（向上）═══
  // 当前节点没有子节点 → 开始"回溯"阶段
  while (workInProgress !== null) {
    completeUnitOfWork(unitOfWork);

    // 如果有兄弟节点 → 先处理兄弟，而不是直接回父节点
    if (sibling !== null) {
      workInProgress = sibling;  // ← DFS 的关键：同层优先
      return;
    }

    // 没有子节点也没有兄弟节点 → 回到父节点
    workInProgress = returnFiber;  // 回溯
  }
}
```

#### 2.4.3 实战场景：Fiber 树遍历的直观理解

以下面这个组件树为例，看 Fiber 如何遍历：

```jsx
function App() {
  return (
    <div className="container">      {/* <div> */}
      <header>                        {/* <header> */}
        <h1>标题</h1>                 {/* <h1> */}
      </header>
      <main>                          {/* <main> */}
        <article>文章内容</article>   {/* <article> */}
      </main>
    </div>
  );
}
```

对应的 Fiber 树遍历过程：

```
步骤   beginWork（向下钻）           completeWork（向上冒泡）
───   ─────────────────           ──────────────────
 1    [App] beginWork
 2      ↓ child
 3    [div.container] beginWork
 4      ↓ child
 5    [header] beginWork
 6      ↓ child
 7    [h1] beginWork
 8      child = null
 9                                [h1] completeWork ✅
10                                sibling = null → return
11                                [header] completeWork ✅
12                                sibling = [main] → 转向兄弟
13    [main] beginWork
14      ↓ child
15    [article] beginWork
16      child = null
17                                [article] completeWork ✅
18                                sibling = null → return
19                                [main] completeWork ✅
20                                sibling = null → return
21                                [div.container] completeWork ✅
22                                sibling = null → return
23                                [App] completeWork ✅
                                → workInProgress = null
                                → Render 阶段结束 ✅
```

**🔍 观察要点**：
- 每个节点经历 **两次访问**（beginWork + completeWork）
- beginWork 是"前序遍历"（处理当前节点 → 深入子节点）
- completeWork 是"后序遍历"（子节点处理完 → 处理当前节点）
- **DFS 不是递归**：每一步都在循环中由变量控制，可以暂停、恢复

#### 2.4.4 暂停和恢复的实战意义

```javascript
// 假设渲染需要 50ms，浏览器帧率 60fps（每帧 16.6ms）
//
// 没有 Fiber（React 15）:
// ┌─────────────────────────────────────────────┐
// │ 渲染开始 ──────────────────────→ 渲染结束   │
// │ ←────── 50ms 不间断占用主线程 ──────→      │
// │         用户输入无法响应 ✗                  │
// └─────────────────────────────────────────────┘
//
// 有 Fiber + 时间分片（React 18）:
// ┌──────────┐──────────┐──────────┐──────────┐
// │ 帧 1     │ 帧 2     │ 帧 3     │ 帧 4     │
// │ 16ms     │ 16ms     │ 16ms     │ 2ms      │
// │          │          │          │          │
// │ render   │ render   │ render   │ render   │
// │ 5ms      │ 5ms      │ 5ms      │ 2ms      │
// │          │          │          │          │
// │ 空闲     │ 空闲     │ 空闲     │ commit   │
// │ 11ms     │ 11ms     │ 11ms     │          │
// │          │          │          │          │
// │←用户输入→│←用户输入→│←用户输入→│          │
// │ 可响应 ✅│ 可响应 ✅│ 可响应 ✅│          │
// └──────────┘──────────┘──────────┘──────────┘
//
// 🔍 关键：React 15 必须一次完成 50ms 的渲染
//    React 18 将 50ms 拆分到 4 帧中，每帧只工作 5ms
//    用户输入在每帧的空闲时间都能得到响应
```

### 2.5 beginWork——从 React Element 到 Fiber 的变化

> `beginWork` 是 Fiber 遍历的"入口"，它接收一个 Fiber 节点，
> 根据节点的 `tag`（类型）走不同的处理逻辑，最终返回第一个需要处理的子节点。

#### 2.5.1 beginWork 的核心逻辑

```javascript
function beginWork(current, workInProgress, renderLanes) {
  // Step 1: 检查是否需要跳过这个节点（Bailout 优化）
  if (current !== null) {
    // 更新阶段：检查是否能跳过
    const oldProps = current.memoizedProps;
    const newProps = workInProgress.pendingProps;

    // 条件 1：props 和 context 都没有变化
    // 条件 2：当前 Fiber 的 lane 不在 renderLanes 中
    if (oldProps !== newProps || !hasContextChanged()) {
      // 检查这个 Fiber 是否有待处理的更新
      if (!includesSomeLane(renderLanes, workInProgress.lanes)) {
        // ✅ 没有需要处理的更新 → 尝试跳过整个子树
        return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
      }
    }
  }

  // Step 2: 根据 tag 类型分发处理
  switch (workInProgress.tag) {
    case FunctionComponent: {
      // 函数组件 → 调用函数获取子节点（JSX）
      const children = renderWithHooks(current, workInProgress, Component, props);
      // 将子节点协调为 Fiber 子节点
      reconcileChildren(current, workInProgress, children);
      return workInProgress.child;
    }

    case ClassComponent: {
      // 类组件 → 调用 render() 获取子节点
      const instance = workInProgress.stateNode;
      const children = instance.render();
      reconcileChildren(current, workInProgress, children);
      return workInProgress.child;
    }

    case HostComponent: {
      // 原生 DOM 元素 → 处理 props、事件监听器
      const type = workInProgress.type; // 'div'、'span' 等
      const nextProps = workInProgress.pendingProps;
      // 处理 DOM 属性
      if (current !== null) {
        // 更新：diff props
        updateHostComponent(current, workInProgress, type, nextProps);
      } else {
        // 创建：构建 DOM
        const instance = createInstance(type, nextProps, workInProgress);
        workInProgress.stateNode = instance;
      }
      // 协调子节点
      reconcileChildren(current, workInProgress, nextProps.children);
      return workInProgress.child;
    }

    case HostText: {
      // 纯文本节点 → 没有子节点
      reconcileChildren(current, workInProgress, null);
      return null; // 文本节点没有子节点
    }

    case Fragment:
      // Fragment → 直接协调其子节点
      reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
      return workInProgress.child;

    case SuspenseComponent:
      // Suspense → 检查是否需要显示 fallback
      return updateSuspenseComponent(current, workInProgress, renderLanes);

    case ContextProvider:
      // Context.Provider → 推送新的 context 值到栈
      pushProvider(workInProgress, workInProgress.pendingProps.value);
      reconcileChildren(current, workInProgress, workInProgress.pendingProps.children);
      return workInProgress.child;

    // ... 其他类型

    default:
      // 不认识的类型 → 抛出错误
      throw new Error(`Unknown fiber tag: ${workInProgress.tag}`);
  }
}
```

#### 2.5.2 实战场景：理解不同 tag 的处理差异

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <Spinner />;

  return (
    <div className="profile">
      <h1>{user.name}</h1>
      <p>{user.bio}</p>
    </div>
  );
}


// beginWork 处理这个组件时的完整流程：
//
// 节点 1: UserProfile (FunctionComponent, tag=0)
//   ├─ renderWithHooks() 执行函数体
//   │    ├─ useState → Hook 链表处理
//   │    ├─ useEffect → effect 入队
//   │    └─ 返回 JSX
//   ├─ reconcileChildren() 协调 JSX 子节点
//   └─ 返回 child → <Spinner> 或 <div>
//
// 节点 2: <Spinner> 或 <div> (HostComponent, tag=5)
//   ├─ 分支 A: <Spinner> (loading=true)
//   │   ├─ createInstance('div', ...) 创建 DOM
//   │   └─ 协调子节点 → <img> (Spinner 内部)
//   │
//   └─ 分支 B: <div className="profile"> (loading=false)
//       ├─ updateHostComponent() 更新 DOM props
//       └─ 协调子节点 → <h1> + <p>
//
// 节点 3: <h1> (HostComponent, tag=5)
//   └─ 协调子节点 → "user.name" (HostText, tag=6)
```

### 2.6 completeWork——将 Fiber 转化为 DOM 操作

> `completeWork` 在 beginWork 处理完所有子节点后执行。
> 它负责：创建 DOM 元素、收集 flags、向上冒泡子树信息。

#### 2.6.1 completeWork 的核心逻辑

```javascript
function completeWork(current, workInProgress, renderLanes) {
  const newProps = workInProgress.pendingProps;

  switch (workInProgress.tag) {
    case HostComponent: {
      const type = workInProgress.type;

      if (current !== null && workInProgress.stateNode !== null) {
        // ✅ 更新阶段：比较新旧 props，生成更新标记
        const oldProps = current.memoizedProps;
        const instance = workInProgress.stateNode;

        // 对比新旧 props，记录需要更新的属性
        updateHostComponent(instance, oldProps, newProps, workInProgress);
      } else {
        // ✅ 挂载阶段：创建新的 DOM 节点
        const instance = createInstance(type, newProps, workInProgress);
        // 将子 DOM 节点附加到父 DOM 节点
        appendAllChildren(instance, workInProgress);
        workInProgress.stateNode = instance;
      }

      // 处理 ref
      if (workInProgress.ref !== null) {
        markRef(workInProgress);
      }
      return null;
    }

    case HostText: {
      const newText = newProps;
      if (current !== null && workInProgress.stateNode !== null) {
        // 更新文本
        const oldText = current.memoizedProps;
        updateHostText(workInProgress.stateNode, oldText, newText);
      } else {
        // 创建文本节点
        workInProgress.stateNode = document.createTextNode(newText);
      }
      return null;
    }

    case FunctionComponent: {
      // 函数组件：主要是处理 Hook 的 effect
      // Hook 的 effect 已经在 renderWithHooks 中处理
      return null;
    }

    // ... 其他类型
  }
}
```

#### 2.6.2 flags 冒泡机制

```javascript
function completeUnitOfWork(unitOfWork) {
  // 1. 执行完成工作（创建 DOM、更新属性等）
  completeWork(current, workInProgress, renderLanes);

  // 2. 将子节点的 flags 冒泡到当前节点
  //    这是 React 18 的 subtreeFlags 优化
  let subtreeFlags = NoFlags;

  // 遍历所有子节点，合并它们的 flags
  let child = workInProgress.child;
  while (child !== null) {
    subtreeFlags |= child.flags;
    subtreeFlags |= child.subtreeFlags;
    child = child.sibling;
  }

  workInProgress.subtreeFlags |= subtreeFlags;

  // 🔍 实战意义：
  // commit 阶段遍历时，如果 subtreeFlags === NoFlags
  // 说明整个子树没有任何 DOM 操作需要执行
  // → 可以直接跳过这个子树，减少遍历开销
}
```

#### 2.6.3 实战场景：commit 阶段的 flags 处理

```jsx
function ToggleButton() {
  const [on, setOn] = useState(false);

  return (
    <button onClick={() => setOn(!on)}>
      {on ? '开' : '关'}
    </button>
  );
}

// 点击按钮 → 触发更新 → render 阶段开始
//
// beginWork 阶段：
//   ToggleButton: 调用函数，返回 JSX
//   <button>: reconcilChildren → <HostText '开' 或 '关'>
//   <HostText>: 没有子节点，beginWork 返回 null
//
// completeWork 阶段（冒泡）：
//   <HostText '关'>: 
//     flags = Update (文本内容变化了)
//     subtreeFlags = NoFlags
//     ↑ 冒泡
//   <button>:
//     flags = NoFlags (DOM 属性没变)
//     subtreeFlags = Update (子节点有改变)
//     ↑ 冒泡
//   ToggleButton:
//     flags = NoFlags
//     subtreeFlags = Update
//
// commit 阶段：
//   从根开始遍历
//   → HostRoot: subtreeFlags = Update ≠ NoFlags → 继续
//   → ToggleButton: subtreeFlags = Update ≠ NoFlags → 继续
//   → <button>: subtreeFlags = Update ≠ NoFlags → 继续
//   → <HostText '关'>: flags = Update → 执行文本更新 ✅
```

### 2.7 实战场景：setState 的完整 Fiber 之旅

> 这是全书最重要的实战内容之一。我们将追踪一个 `setState` 调用，
> 看它如何穿越 Dispatch → Scheduler → Render → Commit 的完整路径。

#### 场景描述

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  console.log('🔄 渲染, count =', count);

  return (
    <div>
      <p>当前计数: {count}</p>
      <button onClick={() => {
        console.log('👆 点击按钮');
        setCount(c => c + 1);
      }}>
        +1
      </button>
    </div>
  );
}
```

#### 完整执行追踪

```
步骤 0: 用户点击按钮
═══════════════════════════════════════════════════
用户点击 "=1" 按钮 → 事件处理函数触发

步骤 1: dispatchSetState——创建更新
═══════════════════════════════════════════════════
setCount(c => c + 1) 被调用
  ↓
dispatchSetState(fiber, queue, (c) => c + 1)
  │
  ├─ 1.1 创建 update 对象
  │    {
  │      lane: DefaultLane,      // ← 普通更新的默认优先级
  │      action: (c) => c + 1,
  │      next: null,
  │    }
  │
  ├─ 1.2 将 update 加入环形链表
  │    queue.pending → update → (环形)
  │
  └─ 1.3 开始调度更新
       scheduleUpdateOnFiber(fiber, DefaultLane, eventTime)

步骤 2: scheduleUpdateOnFiber——冒泡标记
═══════════════════════════════════════════════════
scheduleUpdateOnFiber(fiber, lane, eventTime)
  │
  ├─ 2.1 标记当前 Fiber
  │    Counter.lanes |= DefaultLane      ← Counter 自身有更新
  │
  ├─ 2.2 向上冒泡，标记所有父 Fiber
  │    parent.childLanes |= DefaultLane  ← 父节点知道子树有更新
  │    parent = parent.return            ← 继续向上
  │
  ├─ 2.3 直到根节点
  │    HostRoot.childLanes |= DefaultLane
  │    root.pendingLanes |= DefaultLane  ← 根节点记录待处理更新
  │
  └─ 2.4 通知调度器
       ensureRootIsScheduled(root)

步骤 3: ensureRootIsScheduled——调度生成
═══════════════════════════════════════════════════
ensureRootIsScheduled(root)
  │
  ├─ 3.1 获取下一个要处理的 lanes
  │    nextLanes = getNextLanes(root, NoLanes)
  │    // nextLanes = DefaultLane（只有这个更新）
  │
  ├─ 3.2 将 Lane 转换为 Scheduler 优先级
  │    schedulerPriority = lanesToEventPriority(nextLanes)
  │    // DefaultLane → NormalPriority
  │
  ├─ 3.3 调度 PerformConcurrentWorkOnRoot
  │    scheduleCallback(NormalPriority, performConcurrentWorkOnRoot)
  │    // 加入 Scheduler 的任务队列，等待执行
  │
  └─ 3.4 如果是在 legacy 模式（同步渲染）
       scheduleSyncCallback(performSyncWorkOnRoot)
       // 立即执行，不使用时间分片

步骤 4: performConcurrentWorkOnRoot——进入 Render 阶段
═══════════════════════════════════════════════════
performConcurrentWorkOnRoot(root)
  │
  ├─ 4.1 准备渲染
  │    renderLanes = DefaultLane     ← 本次要处理的所有 lane
  │    workInProgress = createWorkInProgress(current, ...)
  │    // 基于 current 树克隆 workInProgress 树
  │
  └─ 4.2 启动工作循环
       workLoopConcurrent()
       // 开始 performUnitOfWork 循环

步骤 5: performUnitOfWork——遍历 Fiber 树
═══════════════════════════════════════════════════
// 本次需要遍历的 Fiber 路径：
// HostRoot → Counter → div → p → HostText → button → HostText

===== beginWork 阶段（向下遍历）=====

① HostRoot.beginWork()
   - childLanes 包含 DefaultLane → 不能跳过
   - 返回 child = Counter Fiber

② Counter.beginWork()
   - lanes 包含 DefaultLane → 需要更新
   - renderWithHooks(): 
     ├─ 执行函数组件体
     │    console.log('🔄 渲染, count =', count)  → 输出: "🔄 渲染, count = 1"
     │    
     ├─ useState(0): updateReducer() 处理更新
     │    ├─ 从 queue 中取出 update {action: (c) => c + 1}
     │    ├─ newState = 0 + 1 = 1
     │    └─ memoizedState = 1 ← count 变成了 1
     │    
     ├─ return JSX: <div><p>当前计数: 1</p><button>+1</button></div>
     │
     └─ reconcileChildren() 协调 JSX 子节点
        比较 current 子节点与新的 React Element：
        - type 没有变化 → 复用 Fiber 节点
        - props 发生变化 → 标记 Update flag
        - 返回 child = div Fiber

③ div.beginWork()
   - childLanes 包含 DefaultLane → 不能跳过
   - 协调子节点 → 返回 p Fiber

④ p.beginWork()
   - 协调子节点 → 返回 HostText "当前计数: 1"
   - 文本变了 → 标记 Update flag

⑤ HostText.beginWork()
   - 没有子节点 → 返回 null

===== completeWork 阶段（向上冒泡）=====

⑥ HostText.completeWork()
   - 文本内容从 "当前计数: 0" 变为 "当前计数: 1"
   - flags = Update (需要在 commit 阶段更新文本)
   - subtreeFlags = NoFlags

⑦ p.completeWork()
   - 合并子节点 flags
   - subtreeFlags |= HostText.flags | HostText.subtreeFlags
   - subtreeFlags = Update
   - 返回 sibling = button Fiber

⑧ button.beginWork()
   - 没有 childLanes（button 内部的 HostText 没有变化）
   - 但仍然需要遍历（因为 button 本身可能需要更新）
   
⑨ button.completeWork()
   - HostText "=1" 没有变化
   - subtreeFlags = NoFlags
   - button.props 没有变化（onClick 引用没变）
   - 
   - 返回 sibling = null → 回到父节点

⑩ div.completeWork()
   - 合并 flags: p.subtreeFlags(Update) | button.subtreeFlags(NoFlags)
   - subtreeFlags = Update
   - 返回 parent = Counter Fiber

⑪ Counter.completeWork()
   - subtreeFlags = Update
   - flags = NoFlags（函数组件没有 DOM 操作）
   - 返回 parent = HostRoot Fiber

⑫ HostRoot.completeWork()
   - subtreeFlags = Update
   - workInProgress = null
   → Render 阶段结束 ✅

步骤 6: commitRoot——进入 Commit 阶段
═══════════════════════════════════════════════════
commitRoot(root)
  │
  ├─ 6.1 Phase 1: BeforeMutation
  │    处理 useEffect 绑定
  │    （本次没有 useEffect 变化，跳过）
  │
  ├─ 6.2 Phase 2: Mutation（DOM 操作）
  │    遍历 Fiber 树，根据 flags 执行操作：
  │    - HostRoot: subtreeFlags = Update → 继续
  │    - Counter: subtreeFlags = Update → 继续
  │    - div: subtreeFlags = Update → 继续
  │    - p: subtreeFlags = Update → 继续
  │    - HostText: flags = Update → 执行!
  │      → node.nodeValue = "当前计数: 1"    ✅ DOM 更新
  │
  ├─ 6.3 Phase 3: Layout
  │    执行 useLayoutEffect（本次没有）
  │    设置 ref（本次没有）
  │
  └─ 6.4 交换 current 指针
       root.current = finishedWork
       // workInProgress 树 → 新的 current 树 ✅

步骤 7: 浏览器重绘
═══════════════════════════════════════════════════
用户看到屏幕上的数字从 "0" 变成了 "1" ✅
```

#### 关键洞察

```javascript
// 📌 这个流程揭示了几个重要事实：
//
// 1. setState 不会立即改变状态
//    → dispatchSetState 只创建 update 对象
//    → 真正计算新值在 render 阶段的 updateReducer
//
// 2. Fiber 遍历的"两次经过"
//    → beginWork: 判断是否更新、协调子节点
//    → completeWork: 创建 DOM、冒泡 flags
//
// 3. DOM 操作被推迟到 commit 阶段
//    → render 阶段在内存中完成所有计算
//    → commit 阶段一次性执行 DOM 操作
//    → 这就是"一致性视图"的保证
//
// 4. 组件函数被多次调用
//    - 首次渲染: 1 次
//    - setState 后: 1 次 render + 最终提交
//    - 如果用 StrictMode: 2 次 render（检测副作用）
```

### 2.8 实战场景：列表渲染时 Fiber 的行为

> 理解列表渲染中 Fiber 的复用与重建策略，
> 是写出高性能列表的关键。

```jsx
function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: '学习 React', done: false },
    { id: 2, text: '写笔记', done: false },
    { id: 3, text: '复习', done: false },
  ]);

  function toggleTodo(id) {
    setTodos(prev => prev.map(todo =>
      todo.id === id ? { ...todo, done: !todo.done } : todo
    ));
  }

  return (
    <ul>
      {todos.map(todo => (
        <li key={todo.id}>
          <span>{todo.text}</span>
          <input
            type="checkbox"
            checked={todo.done}
            onChange={() => toggleTodo(todo.id)}
          />
        </li>
      ))}
    </ul>
  );
}
```

#### 场景 A：勾选一个 todo（更新）

```
更新前 Fiber 树（部分）:
  ul
  ├── li(key=1) → span, checkbox ← text = "学习 React"
  ├── li(key=2) → span, checkbox ← text = "写笔记"
  └── li(key=3) → span, checkbox ← text = "复习"

用户勾选了 "写笔记"

render 阶段：
  reconcileChildren(ul, newChildren):
    ├── key=1 存在 → 复用 Fiber ✅
    │     → memoizedProps 变化？不（li 本身 props 不变）
    │     → child 的 props 变化？不（span 和 checkbox 的 props 不变）
    │     → 跳过（bailout）
    │
    ├── key=2 存在 → 复用 Fiber ✅
    │     → 子组件 span 的 props 变化？text 没变，不需要更新
    │     → 子组件 checkbox 的 props 变化？
    │       checked: false → true ✅ 需要更新
    │     → flags = Update（checkbox 的 DOM 属性变化）
    │
    └── key=3 存在 → 复用 Fiber ✅
          → 跳过（bailout）

commit 阶段：
  → HostText "写笔记": 文本没变，flags = NoFlags
  → checkbox: checked 从 false → true，flags = Update
  → DOM 操作: checkbox.checked = true ✅

// 🔍 关键：
// 3 个 li 全部复用，没有新建也没有删除
// 只有真正变化的部分（checkbox.checked）被更新
// 这就是 Fiber 复用的核心优势
```

#### 场景 B：在列表头部插入一个 todo（key 的作用）

```jsx
// 新 todo 插入到头部
setTodos(prev => [
  { id: 4, text: '新增任务', done: false },
  ...prev,
]);


// 场景 1：没有 key（按索引匹配）→ ❌ 灾难
reconcileChildren(ul, newChildren, oldChildren):
  ├── 索引 0: old=key1, new=key4  → Fiber 被错误复用！
  │     → 原本显示 "学习 React"，现在显示 "新增任务"
  │     → DOM 更新 → 整个子树重建
  │
  ├── 索引 1: old=key2, new=key1  → Fiber 又被错误复用！
  │     → 原本显示 "写笔记"，现在显示 "学习 React"
  │     → 输入框内容（如果有）会错乱！
  │
  ├── 索引 2: old=key3, new=key2
  │
  └── 索引 3: old=不存在, new=key3
        → 新建 Fiber

// 🔍 结果：所有 DOM 元素都被更新了，性能差 + 状态错乱


// 场景 2：有 key（按 key 匹配）→ ✅ 正确
reconcileChildren(ul, newChildren):
  ├── key=4（新） → 创建新 Fiber（Placement flag）
  ├── key=1（已有）→ 复用，不变
  ├── key=2（已有）→ 复用，不变
  └── key=3（已有）→ 复用，不变

// 🔍 结果：只有真正的"新"元素被创建
// 已有元素全部复用，DOM 操作最少 ✅
```

### 2.9 实战场景：条件渲染时 Fiber 的销毁与创建

```jsx
function Profile({ user }) {
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div>
      <Avatar user={user} />
      <UserInfo user={user} />
    </div>
  );
}
```

#### Fiber 视角的条件渲染

```
// 条件 A: user = null → 返回 <LoginScreen />
Fiber 树:
  Profile (FunctionComponent)
  └── LoginScreen (FunctionComponent)

// 条件 B: user = { name: 'Alice' } → 返回 <div>...</div>
Fiber 树:
  Profile (FunctionComponent)
  └── div (HostComponent)
      ├── Avatar (FunctionComponent)
      └── UserInfo (FunctionComponent)


// 切换过程（从 null → User）:
reconcileChildren(Profile, newChildren):
  ├── old 子树: LoginScreen Fiber
  │     type: LoginScreen（函数）
  │
  └── new 子树: div React Element
        type: 'div'（字符串）
  
  → type 不同（LoginScreen ≠ div）→ ❌ 不能复用
  → 旧 Fiber：标记 Deletion（待删除）
  → 新 Fiber：标记 Placement（待创建）
  
// 🔍 为什么不能复用？
// 因为 type 变了（函数组件 → DOM 元素）
// React 的策略："不同类型直接替换"
```

### 2.10 从 Fiber 角度优化 React 应用

> 理解 Fiber 的内部机制后，可以推导出以下实际优化策略：

#### 2.10.1 保持组件类型稳定

```jsx
// ❌ 问题：条件变化导致 type 变化，Fiber 树重建
function Component({ isLoggedIn }) {
  if (isLoggedIn) {
    return <Dashboard />;   // type = Dashboard（函数）
  } else {
    return <Login />;       // type = Login（函数）
  }
}

// ✅ 优化：始终渲染同一个组件类型
function Component({ isLoggedIn }) {
  return (
    <div>
      {isLoggedIn ? <Dashboard /> : <Login />}
      {/* ↓ type 始终是 'div'，子节点变化只影响子树 */}
    </div>
  );
}

// Fiber 视角：
// ❌ 版本：Profile Fiber 的子节点 type 从 Login → Dashboard
//    → reconcileChildren 发现 type 不同 → 整个 Dashboard 子树重建
//
// ✅ 版本：Profile Fiber 的子节点 type 始终是 'div'
//    → reconcileChildren 发现 type 相同 → 复用 Fiber
//    → 只有 div 的子节点需要重新协调
```

#### 2.10.2 减少不必要的 childLanes 冒泡

```jsx
// ❌ 问题：父组件每次更新，子组件的 childLanes 也被标记
function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        计数: {count}
      </button>
      <ExpensiveTree />  {/* 每次 Parent 更新，子树也被标记 */}
    </div>
  );
}

// ✅ 优化：用 React.memo 阻断 childLanes 的遍历
const MemoizedTree = React.memo(ExpensiveTree);

function Parent() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        计数: {count}
      </button>
      <MemoizedTree />  {/* 虽然 childLanes 还是被冒泡 */}
      {/* 但 beginWork 时 React.memo 会执行浅比较 */}
      {/* props 没变 → bailout → 不会深入遍历子树 */}
    </div>
  );
}

// Fiber 视角：
// ❌ 版本: beginWork 扫描 ExpensiveTree 的每个子节点
//    → 即使没有更新也要遍历一整个深树
//    → 时间开销 = 遍历整棵树的时间
//
// ✅ 版本: beginWork 检查 React.memo → 浅比较 props
//    → props 没变 → bailoutOnAlreadyFinishedWork
//    → 跳过整个子树的遍历
//    → 时间开销 = O(1)
```

#### 2.10.3 避免不必要的新建 Fiber

```jsx
// ❌ 问题：每次渲染都创建新的 React Element
function Parent() {
  const children = [<Child key="1" />, <Child key="2" />];

  return <div>{children}</div>;
  // 每次渲染 children 都是新数组 → reconcileChildren
  // 做数组比较，即使内容完全相同
}

// ✅ 优化：稳定引用
const CHILDREN = [<Child key="1" />, <Child key="2" />];

function Parent() {
  return <div>{CHILDREN}</div>;
  // 每次渲染 CHILDREN 引用不变 → reconcileChildren
  // 跳过数组比较，直接复用 Fiber
}

// Fiber 视角：
// ❌ 版本：每次 reconcileChildren 都要遍历 children 数组
//    → 每个子节点做 type 比较 → 发现 type 相同但 key 相同
//    → 复用 Fiber（但已浪费了比较时间）
//
// ✅ 版本：reconcileChildren 发现新旧 children 引用相同
//    → 快速路径：直接复用所有子节点
//    → 不需要遍历比较
```

#### 2.10.4 避免深层嵌套

```jsx
// ❌ 问题：深度过深 → DFS 遍历路径长
function DeeplyNested() {
  return (
    <A>
      <B>
        <C>
          <D>
            <E>
              <Target />
            </E>
          </D>
        </C>
      </B>
    </A>
  );
}

// beginWork 路径: A → B → C → D → E → Target
// completeWork 路径: Target → E → D → C → B → A
// 每层即使 bailout，也要走一次 beginWork（检查）
// 深度 6 层 → 12 次函数调用（begin + complete 各 6 次）
// 深度 20 层 → 40 次函数调用
// 深度 100 层 → 200 次函数调用 + 中间的内存分配

// ✅ 优化：保持扁平结构
function Flattened() {
  return (
    <A>
      <Target />
    </A>
  );
}

// beginWork 路径: A → Target
// 深度 2 层 → 4 次函数调用
```

### 2.11 Fiber 关键总结

| 概念 | 核心要点 | 实践意义 |
|------|----------|----------|
| **Fiber 对象** | 每个 React 元素对应一个 Fiber，通过 3 指针构成链表树 | 支持 DFS 的暂停和恢复 |
| **双缓存** | current + workInProgress 两棵树交替 | 内存中完成计算后一次提交，保证 UI 一致性 |
| **beginWork** | 向下遍历，判断是否更新，协调子节点 | 理解 React 何时跳过组件 |
| **completeWork** | 向上冒泡，创建 DOM，收集 flags | 理解 DOM 操作如何推迟和批处理 |
| **flags 冒泡** | 子节点的 flags 向父节点冒泡合并 | subtreeFlags 使 commit 可以跳过无变化子树 |
| **alternate 复用** | 已有 Fiber 节点被复用而非重建 | 减少内存分配和 GC 压力 |
| **DFS + 时间分片** | workLoopConcurrent 每 5ms 让出主线程 | 用户输入不因渲染而被阻塞 |
| **type 比较** | beginWork 通过 type 判断是否复用 | 保持组件类型稳定以避免 Fiber 重建 |
| **childLanes** | 子树的更新优先级向上冒泡 | 决定 beginWork 是否深入子树 |

---

## 3. Reconciliation 协调算法

> Reconciliation（协调）是 React 将 **JSX 变化** 转化为 **Fiber 变化** 的过程。
> 它是整个渲染流程的"大脑"：决定哪些节点需要创建、哪些可以复用、哪些必须销毁。
> 第 2 章我们了解了 Fiber 是什么，这一章我们来看 Fiber **如何变化**。

### 3.0 Reconciliation 的核心目的——"变化检测引擎"

一句话概括：**Reconciliation 是 React 内部判断"新旧 Fiber 树上每个节点在 commit 阶段需要做什么操作"的逻辑**。

#### 3.0.1 为什么需要 Reconciliation？

```jsx
// 你声明式地写：
setCount(count + 1);

// React 需要搞清楚：
// 旧 UI: <div><p>计数: 0</p><button>+1</button></div>
// 新 UI: <div><p>计数: 1</p><button>+1</button></div>
//
// 问题：到底哪些部分变了？
// ❌ 把整个 DOM 销毁重建？ → 性能灾难
// ✅ 只把文本从 "0" 改成 "1"？ → 高效
//
// Reconciliation 就是做这个判断的
```

#### 3.0.2 Reconciliation 在 React 内部的 3 个关键作用

**作用 1：决定 Fiber 的"生老病死"**

Reconciliation 的输出决定了每个 Fiber 节点的命运——**复用、新建还是删除**，并把结论写在 `flags` 上供 commit 阶段执行：

```
                        ┌─────────────┐
                        │ 新旧 JSX    │
                        │ 对比结果    │
                        └──────┬──────┘
                               │
              ┌────────────────┼──────────────────┐
              ▼                ▼                   ▼
       ┌──────────┐    ┌──────────┐     ┌──────────────┐
       │  复用     │    │  新建    │     │  删除        │
       │ (useFiber)│    │(createChild)  │ (deleteChild)  │
       │          │    │          │     │              │
       │ flags=   │    │ flags=   │     │ 加入父 Fiber │
       │ Update   │    │Placement │     │ .deletions   │
       └──────────┘    └──────────┘     └──────────────┘
```

**作用 2：把 O(n³) 的 Diff 变成 O(n)**

理论上两棵树的 Diff 是 **O(n³)**（1000 个节点需 10 亿次比较）。Reconciliation 通过三个启发式假设降为 **O(n)**：

| 假设 | 效果 | 现实依据 |
|------|------|----------|
| **只比较同一层** | 复杂度从 O(n³) → O(n) | 跨层级移动 DOM 节点的概率极低 |
| **类型不同则重建** | 跳过不必要的深入比较 | 从 `<div>` 变成 `<section>` 意味着整个 UI 都变了 |
| **key 辅助匹配** | 精确找到可复用的节点 | 开发者用 key 显式声明"谁是谁" |

**作用 3：连接"声明式 JSX"和"命令式 DOM 操作"**

这是最本质的作用。React 的核心价值是**声明式 UI 编程**——你只声明 UI 应该长什么样，Reconciliation 负责算出如何用最少的 DOM 操作来实现它：

```
  JSX（声明）                    DOM（命令）
    │                              ▲
    │                              │
    ▼                              │
 ┌─────────────────────────────────────┐
 │         Reconciliation               │
 │                                      │
 │  JSX → React Element → Fiber → flags │ → DOM 操作
 │  （声明）    （中转）    （比对）  （标记）   （执行）
 └─────────────────────────────────────┘
```

#### 3.0.3 Reconciliation 的完整链路

```
setState() / useState dispatch
       │
       ▼
scheduleUpdateOnFiber(fiber, lane)
       │
       ▼
Render 阶段开始（可中断，纯内存操作）
       │
       ▼
performUnitOfWork(workInProgress)
       │
       │  beginWork()
       │    ├─ bailout?（可跳过？）
       │    ├─ renderWithHooks()（执行组件函数 → 获取 JSX）
       │    └─ ★ reconcileChildren()  ← Reconciliation 在这里！
       │         ├─ mount 路径（current=null）→ 全部新建
       │         ├─ update 路径（current≠null）→ 3 原则 Diff
       │         ├─ 结果：useFiber / createChild / deleteChild
       │         └─ ★ 标记 flags（Placement/Update/Deletion）
       │
       │  completeWork()
       │    └─ 创建/更新 DOM，冒泡子树 flags 到 subtreeFlags
       │
       ▼
Commit 阶段（同步，不可中断）
       │
       ▼
根据 flags 执行 DOM 操作  ← ★ Reconciliation 的判决被最终执行
  ├─ flags & Placement → DOM.insertBefore/appendChild
  ├─ flags & Update → DOM 属性/文本更新
  └─ fiber 在父.deletions 中 → DOM.removeChild
```

> **关键结论**：Reconciliation 是**判决阶段**（"这个节点要做什么"），commit 是**执行阶段**（"实际操作 DOM"）。两者职责清晰分离。Reconciliation 可中断（纯内存标记 flags），commit 必须同步（因为要操作真实 DOM）。

### 3.1 Diff 算法的三大原则——O(n) 复杂度的基石

> React 的 Reconciliation 算法基于三个启发式假设，将理论上的 O(n³) 问题优化为 O(n)：

| 原则 | 内容 | 理论依据 |
|------|------|----------|
| **同层比较** | 只比较同一层级的节点，不跨层级移动 | DOM 节点跨层级移动的概率极低 |
| **类型决定** | 不同类型节点直接替换，不深入比较 | 组件类型变化意味着完全不同的 UI |
| **key 驱动** | 通过 key 在同类型节点中精确匹配 | 开发者用 key 表达节点身份标识 |

#### 原则 1：只对同层级节点比较

```javascript
// React 不会尝试将 <A /> 从一层移动到另一层
// 如果组件树结构发生变化，子树被销毁重建

// 布局 A:
<div>
  <List />     {/* 层级 1 */}
</div>

// 布局 B:
<section>
  <List />     {/* 层级 1（同级，可以复用） */}
</section>
// type 从 'div' 变成 'section' → 不同 → <div> 及其子节点全部销毁重建

// ❌ 即使 <List /> 内容完全相同，也必须重建
// 🔍 为什么？因为 <List /> 是 <div> 的子节点，type 变化导致整个子树重建
```

#### 原则 2：不同类型节点直接替换

```javascript
// 节点类型由 type 决定，type 变化 = 不可复用

// ❌ type 从 'div' 变成 <Section>（函数组件）
// 比较 type: 'div' !== Section function
// → 直接判定为不同元素
// → 旧 Fiber 及子树全部标记 Deletion
// → 创建全新的 Fiber 子树

// ✅ type 相同，只是 props 变化
// <div className="old"> → <div className="new">
// 比较 type: 'div' === 'div' ✅
// → 复用 Fiber，更新 props
```

#### 原则 3：通过 key 识别节点

```javascript
// key 是开发者在列表渲染中提供的"节点身份证"

// 没有 key（按索引匹配）：
[<li>A</li>, <li>B</li>, <li>C</li>]
// 在第 0 位插入 <li>D</li>：
[<li>D</li>, <li>A</li>, <li>B</li>, <li>C</li>]
// ↑ 所有节点都被错误匹配了（索引 0→D, 1→A, ...）

// 有 key（按 key 匹配）：
[<li key="A">A</li>, <li key="B">B</li>, <li key="C">C</li>]
// 在第 0 位插入：
[<li key="D">D</li>, <li key="A">A</li>, <li key="B">B</li>, <li key="C">C</li>]
// ↑ 通过 key 精确匹配：A/B/C 全部复用，只插入 D ✅
```

### 3.2 reconcileChildren——Fiber 层面的协调入口

> React 的整个 Reconciliation 逻辑集中在 `reconcileChildren` 函数中。
> 它接收当前的 JSX 描述（React Element），输出更新后的 Fiber 子树。

#### 3.2.1 两个路径：mount vs update

```javascript
// packages/react-reconciler/src/ReactChildFiber.js

function reconcileChildren(current, workInProgress, nextChildren, renderLanes) {
  if (current === null) {
    // ═══ mount 路径（首次挂载）════
    // current 为 null → 这是一个全新的节点
    // → 不需要 Diff，直接为所有 React Element 创建 Fiber
    //
    // 流程：
    //   对于每个子节点 → createFiberFromElement()
    //   → 创建新的 Fiber 对象
    //   → 通过 return/child/sibling 指针连接
    workInProgress.child = mountChildFibers(workInProgress, null, nextChildren, renderLanes);
  } else {
    // ═══ update 路径（更新）════
    // current 存在 → 需要比较新旧子节点
    // → 执行完整的 Diff + 复用逻辑
    //
    // 流程：
    //   对于每个子节点 → 比较 newChild 和 oldFiber
    //   → 如果可以复用 → useFiber()
    //   → 如果类型不同 → createFiber
    //   → 标记 flags（Placement / Update / Deletion）
    workInProgress.child = reconcileChildFibers(workInProgress, current.child, nextChildren, renderLanes);
  }
}
```

#### 3.2.2 mount 路径——快速创建

```javascript
// mount 路径简单直接：不需要比较，全部新建
// 场景：组件首次渲染时，所有的子节点都是"新"的

function mountChildFibers(returnFiber, currentFirstChild, newChild, lanes) {
  // 不设置 current 参数 → 所有子节点都标记为 Placement
  // 因为 mount 路径没有"旧"节点可以复用
  return reconcileChildFibers(returnFiber, null, newChild, lanes);
  //                             ↑ current = null
}
```

#### 3.2.3 update 路径——核心 Diff

```javascript
function reconcileChildFibers(returnFiber, currentFirstChild, newChild, lanes) {
  // 判断 newChild 的类型，走不同的处理分支
  const isObject = typeof newChild === 'object' && newChild !== null;

  if (isObject) {
    // ═══ 单节点 ═══
    // 例如：<div> → key 存在 → reconcileSingleElement
    //       "文本" → reconcileSingleTextNode
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        return placeSingleChild(
          reconcileSingleElement(returnFiber, currentFirstChild, newChild, lanes)
        );
      case REACT_PORTAL_TYPE:
        // ...
    }
  }

  if (typeof newChild === 'string' || typeof newChild === 'number') {
    // ═══ 文本节点 ═══
    return placeSingleChild(
      reconcileSingleTextNode(returnFiber, currentFirstChild, newChild, lanes)
    );
  }

  if (isArray(newChild)) {
    // ═══ 多节点（数组/列表）═══
    return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
  }

  // 其他情况 → 删除所有旧节点
  return deleteRemainingChildren(returnFiber, currentFirstChild);
}
```

### 3.3 ChildReconciler——五个核心子函数

> ChildReconciler 是 Reconciliation 的"执行者"。它暴露几个核心子函数，每个负责一种 Fiber 操作。

```javascript
// ChildReconciler 是一个高阶函数，接收 shouldTrackSideEffects 参数
// mount 路径: shouldTrackSideEffects = false（不需要标记 Placement）
// update 路径: shouldTrackSideEffects = true（需要标记 flag）

function ChildReconciler(shouldTrackSideEffects) {
  // ═══ 子函数 1：useFiber——复用已有 Fiber ═══
  function useFiber(fiber, pendingProps) {
    // 如果 fiber.alternate 存在 → 复用 alternate
    // 如果不存在 → 克隆当前 fiber
    const clone = createWorkInProgress(fiber, pendingProps);
    clone.index = 0;
    clone.sibling = null;
    return clone;
  }

  // ═══ 子函数 2：createChild——创建新 Fiber ═══
  function createChild(returnFiber, newChild, lanes) {
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // 文本节点
      const created = createFiberFromText(`${newChild}`, returnFiber, lanes);
      created.return = returnFiber;
      return created;
    }

    if (typeof newChild === 'object' && newChild !== null) {
      switch (newChild.$$typeof) {
        case REACT_ELEMENT_TYPE:
          // React 元素 → 创建对应类型的 Fiber
          const created = createFiberFromElement(newChild, returnFiber, lanes);
          created.return = returnFiber;
          return created;
      }
    }
    return null;
  }

  // ═══ 子函数 3：updateChild——更新已有 Fiber ═══
  function updateChild(returnFiber, oldFiber, newChild, lanes) {
    if (typeof newChild === 'string' || typeof newChild === 'number') {
      // 文本更新
      if (oldFiber.tag === HostText) {
        // 旧节点也是文本 → 可以复用
        updateHostText(oldFiber, `${newChild}`);
        return oldFiber;
      }
      return null; // 类型不匹配 → 不复用
    }

    if (newChild != null) {
      // 比较 type
      if (oldFiber.type === newChild.type) {
        // type 相同 → 可以复用
        const existing = useFiber(oldFiber, newChild.props);
        existing.return = returnFiber;
        return existing;
      }
    }
    return null; // type 不同 → 不复用
  }

  // ═══ 子函数 4：deleteChild——标记删除 ═══
  function deleteChild(returnFiber, childToDelete) {
    if (shouldTrackSideEffects) {
      // 在父 Fiber 的 deletions 数组中记录
      returnFiber.deletions = returnFiber.deletions || [];
      returnFiber.deletions.push(childToDelete);
      // ↑ commit 阶段会遍历 deletions 执行卸载
    }
  }

  function deleteRemainingChildren(returnFiber, currentFirstChild) {
    // 删除从当前节点开始的所有旧子节点
    let childToDelete = currentFirstChild;
    while (childToDelete !== null) {
      deleteChild(returnFiber, childToDelete);
      childToDelete = childToDelete.sibling;
    }
    return null;
  }

  // ═══ 子函数 5：placeChild——标记插入 ═══
  function placeChild(newFiber, lastPlacedIndex, newIndex) {
    newFiber.index = newIndex;
    
    if (shouldTrackSideEffects) {
      // 检查是否需要标记 Placement
      const current = newFiber.alternate;
      if (current !== null) {
        // 节点已存在 → 判断是否移动
        const oldIndex = current.index;
        if (oldIndex < lastPlacedIndex) {
          // 节点的旧索引比"已放置的最大索引"小
          // → 说明节点需要向右移动
          newFiber.flags |= Placement; // 标记移动
          return lastPlacedIndex;
        } else {
          // 节点位置不变或向左移 → 不需要移动
          return oldIndex;
        }
      } else {
        // 全新节点 → 标记插入
        newFiber.flags |= Placement;
      }
    }
    return lastPlacedIndex;
  }

  return {
    reconcileSingleElement,
    reconcileChildrenArray,
    // ... 其他导出
  };
}
```

### 3.4 单节点协调——reconcileSingleElement

> 当子节点只有一个元素时（如 `<div><Child /></div>`），走单节点协调路径。

```javascript
function reconcileSingleElement(
  returnFiber,
  currentFirstChild,
  element,
  lanes
) {
  const key = element.key;
  let child = currentFirstChild;

  while (child !== null) {
    // 遍历所有旧子节点，寻找可以复用的
    if (child.key === key) {
      // ✅ key 匹配上了
      if (child.type === element.type) {
        // type 也匹配 → 完美复用
        deleteRemainingChildren(returnFiber, child.sibling);
        const existing = useFiber(child, element.props);
        existing.return = returnFiber;
        return existing;
      }
      // key 匹配但 type 不匹配 → 无法复用
      // 删除所有剩余旧节点
      deleteRemainingChildren(returnFiber, child);
      break;
    } else {
      // key 不匹配 → 删除这个旧节点
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }

  // 没有找到可复用的 → 创建新 Fiber
  const created = createFiberFromElement(element, returnFiber, lanes);
  created.return = returnFiber;
  return created;
}
```

#### 实战场景：单节点 key 匹配

```jsx
// 场景 A：key 和 type 都匹配 → 复用 ✅
<Child key="a" />  →  <Child key="a" count={2} />
// Fiber 复用，flags = Update（props 变化）

// 场景 B：key 相同但 type 不同 → 重建 ❌
<Child key="a" />  →  <div key="a" />
// key 匹配 → type 不匹配 (Child ≠ 'div')
// → 旧 Fiber 标记 Deletion，创建新 Fiber

// 场景 C：key 不同 → 重建 ❌
<Child key="a" />  →  <Child key="b" />
// key 不匹配 → 删除 key="a" 的旧 Fiber
// → 创建 key="b" 的新 Fiber
```

### 3.5 多节点（列表）协调——reconcileChildrenArray

> 当子节点是数组时（如 `{items.map(i => <li key={i.id} />)}`），
> React 执行更复杂的多节点 Diff 算法。

#### 3.5.1 算法流程

```javascript
function reconcileChildrenArray(
  returnFiber,
  currentFirstChild,
  newChildren,
  lanes
) {
  // ═══ 阶段 1：第一轮遍历——处理相同位置的节点 ═══
  // 从左到右同时遍历新旧列表，尽可能多地复用

  let oldFiber = currentFirstChild;
  let lastPlacedIndex = 0;   // 已放置到最终的索引最大值
  let newIdx = 0;             // 在新列表中的索引
  let nextOldFiber = null;

  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    // 跳过文本节点
    if (oldFiber.index > newIdx) {
      nextOldFiber = oldFiber;
      oldFiber = null;
    } else {
      nextOldFiber = oldFiber.sibling;
    }

    // 尝试复用新旧列表中"索引相同"的节点
    // 核心检查：newChild 和 oldFiber 的 key + type 是否匹配
    const newFiber = updateChild(returnFiber, oldFiber, newChildren[newIdx], lanes);

    if (newFiber === oldFiber) {
      // 复用成功 → 但可能需要移动
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    } else {
      // 复用失败 → 进入第二阶段
      if (oldFiber === null) {
        oldFiber = nextOldFiber;
      }
      break;
    }

    oldFiber = nextOldFiber;
  }

  // ═══ 阶段 2：处理剩余节点 ═══

  // 情况 A：所有旧节点都处理完了 → 剩余的都是新增
  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      if (newFiber === null) continue;
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    }
    return resultingFirstChild;
  }

  // 情况 B：还有剩余旧节点 → 用 key 构建映射表
  const existingChildren = mapRemainingChildren(oldFiber);
  // ↑ 将剩余旧节点放入 Map<key, Fiber>

  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = updateChildFromMap(
      existingChildren,
      returnFiber,
      newChildren[newIdx],
      lanes
    );
    
    if (newFiber !== null) {
      // 从映射表中找到了可复用的节点
      if (shouldTrackSideEffects) {
        if (newFiber.alternate !== null) {
          // 从映射表中移除（已经被复用了）
          existingChildren.delete(
            newFiber.key === null ? newIdx : newFiber.key
          );
        }
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    }
  }

  // ═══ 阶段 3：删除剩余未复用的旧节点 ═══
  existingChildren.forEach(child => deleteChild(returnFiber, child));

  return resultingFirstChild;
}
```

#### 3.5.2 实战场景：不同列表操作的 Fiber 行为

```jsx
// =============================================
// 场景 A：在末尾追加——最理想的情况
// =============================================
const oldList = [<li key="A">A</li>, <li key="B">B</li>];
const newList = [...oldList, <li key="C">C</li>];

// 第一轮遍历：
//   idx=0: A vs A → key+type 匹配 → 复用 ✅
//   idx=1: B vs B → key+type 匹配 → 复用 ✅
//   idx=2: newChild 还有 → oldFiber 已耗尽 → 进入阶段 2
// 阶段 2（追加）：
//   idx=2: 创建 C 的 Fiber → Placement 标记 ✅
// 结果：复用 2 个，新建 1 个，删除 0 个

// =============================================
// 场景 B：在头部插入——需要 key 来辅助
// =============================================
const oldList = [<li key="A">A</li>, <li key="B">B</li>];
const newList = [<li key="C">C</li>, <li key="A">A</li>, <li key="B">B</li>];

// 第一轮遍历：
//   idx=0: old=A vs new=C → key 不同 → updateChild 返回 null
//   → break 进入阶段 2
// 阶段 2（key 映射表）：
//   map = {A: Fiber_A, B: Fiber_B}
//   idx=0: new=C → 不在 map 中 → 创建新 Fiber
//   idx=1: new=A → 在 map 中 → 复用 ✅ → 需要移动（Placement）
//   idx=2: new=B → 在 map 中 → 复用 ✅ → 需要移动（Placement）
// 阶段 3：map 为空 → 无需删除
// 结果：复用 2 个，新建 1 个，删除 0 个，移动 2 个

// =============================================
// 场景 C：删除中间节点
// =============================================
const oldList = [<li key="A">A</li>, <li key="B">B</li>, <li key="C">C</li>];
const newList = [<li key="A">A</li>, <li key="C">C</li>];

// 第一轮遍历：
//   idx=0: A vs A → 匹配 ✅ 复用
//   idx=1: B vs C → key 不同 → break
// 阶段 2（key 映射表）：
//   map = {B: Fiber_B, C: Fiber_C}
//   idx=1: new=C → 在 map 中 → 复用 ✅
//   → 从 map 中移除 C
// 阶段 3：map 中剩下 {B: Fiber_B} → deleteChild(B)
// 结果：复用 2 个，新建 0 个，删除 1 个

// =============================================
// 场景 D：全部重新排序（最复杂的情况）
// =============================================
const oldList = [<li key="A">A</li>, <li key="B">B</li>,
                 <li key="C">C</li>, <li key="D">D</li>];
const newList = [<li key="D">D</li>, <li key="A">A</li>,
                 <li key="C">C</li>, <li key="B">B</li>];

// 第一轮遍历：
//   idx=0: A vs D → key 不同 → break
// 阶段 2（key 映射表）：map = {A, B, C, D}
//   idx=0: D → 在 map 中 → 复用，lastPlacedIndex = 0
//   idx=1: A → 在 map 中 → A.index(0) < lastPlacedIndex(0)=false → 不移动
//     lastPlacedIndex = 0（A 的旧索引是 0，不小于 lastPlacedIndex）
//   ↑ 等等，这里不对。让我重新分析。

// 正确的分析：
// oldList:  A(index=0), B(index=1), C(index=2), D(index=3)
// newList:  D, A, C, B

// 第一轮遍历：
//   idx=0: oldFiber=A(key=A), newChild=D(key=D) → key 不同 → break
// 阶段 2：
//   map = {A: Fiber_A(0), B: Fiber_B(1), C: Fiber_C(2), D: Fiber_D(3)}
//   lastPlacedIndex = 0
//
//   idx=0: new=D(key=D) → map.get('D')=Fiber_D(3)
//     → 复用 ✅
//     → D 的旧索引 3 >= lastPlacedIndex(0) → 不标记移动
//     → lastPlacedIndex = 3
//     → map 中移除 D
//
//   idx=1: new=A(key=A) → map.get('A')=Fiber_A(0)
//     → 复用 ✅
//     → A 的旧索引 0 < lastPlacedIndex(3) → 标记 Placement（需要移动）
//     → lastPlacedIndex 保持 3
//     → map 中移除 A
//
//   idx=2: new=C(key=C) → map.get('C')=Fiber_C(2)
//     → 复用 ✅
//     → C 的旧索引 2 < lastPlacedIndex(3) → 标记 Placement（需要移动）
//     → map 中移除 C
//
//   idx=3: new=B(key=B) → map.get('B')=Fiber_B(1)
//     → 复用 ✅
//     → B 的旧索引 1 < lastPlacedIndex(3) → 标记 Placement（需要移动）
//     → map 中移除 B
//
// 阶段 3：map 为空 → 无需删除
// 结果：复用 4 个，新建 0 个，删除 0 个，移动 3 个（A、C、B）
// 只有 D 不需要移动（它第一个被匹配且索引最大）
//
// 🔍 关键洞察：lastPlacedIndex 就是"最长不需要移动子序列"（LIS）的实现
//    在这个例子中，只有 D 不需要移动（D → A/C/B 都需要向右移动）
```

### 3.6 实战场景：从 JSX 到 Fiber 的完整协调过程

```jsx
function App() {
  const [todos, setTodos] = useState([
    { id: 1, text: '学习' },
    { id: 2, text: '编码' },
  ]);

  return (
    <div>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
      <AddButton />
    </div>
  );
}
```

#### 首次渲染 (mount)

```
reconcileChildren(current=null, workInProgress=AppFiber, nextChildren=JSX)

mount 路径：
  ┌─ 子节点 1: <div>
  │   └─ createFiberFromElement(<div>) → 创建 HostDivFiber
  │      └─ 子节点 1.1: <TodoItem key=1>
  │      │   └─ createFiberFromElement(<TodoItem key=1>) → FunctionFiber
  │      │       flags = Placement (首次挂载)
  │      │
  │      ├─ 子节点 1.2: <TodoItem key=2>
  │      │   └─ createFiberFromElement(<TodoItem key=2>) → FunctionFiber
  │      │       flags = Placement
  │      │
  │      └─ 子节点 1.3: <AddButton>
  │          └─ createFiberFromElement(<AddButton>) → FunctionFiber
  │              flags = Placement
  │
  HostDivFiber.child = TodoItem_1
  TodoItem_1.sibling = TodoItem_2
  TodoItem_2.sibling = AddButton

AppFiber.child = HostDivFiber
```

#### 更新渲染：添加新 todo

```jsx
// 用户添加了一条 "锻炼"
setTodos(prev => [
  ...prev,
  { id: 3, text: '锻炼' },
]);

// reconcileChildren(current=AppFiber.current, ...)
// 新的 nextChildren = <div>{TodoItem(1,2,3)}<AddButton /></div>

update 路径—reconcileChildrenArray 处理 <div> 内部：

  第一轮遍历（索引对齐）：
  ├─ idx=0: old=TodoItem_1 vs new=TodoItem(1) → key=1, type 相同
  │   → updateChild 复用 ✅ → placeChild: 复用成功
  │
  ├─ idx=1: old=TodoItem_2 vs new=TodoItem(2) → key=2, type 相同
  │   → updateChild 复用 ✅ → placeChild: 复用成功
  │
  └─ idx=2: old=AddButton vs new=TodoItem(3) → key 不同（null vs 3）
      → updateChild 返回 null → break

  阶段 2（key 映射表）：
  ├─ map = {null: AddButton_Fiber}  ← AddButton 没有 key，用索引作为键
  │
  ├─ idx=2: new=TodoItem(3) → key=3 → 不在 map 中
  │   → createChild: 创建新 Fiber ✅ → flags = Placement
  │
  └─ idx=3: new=AddButton → key=null → 在 map 中
      → 复用 AddButton_Fiber ✅

  阶段 3：map 为空 → 无需删除

  commit 阶段：
  ├─ TodoItem(3): Placement → 插入 DOM ✅
  ├─ AddButton: 已存在，不需要操作 ✅
  └─ TodoItem(1), TodoItem(2): 复用，不需要操作 ✅
```

### 3.7 Reconciliation 性能优化——避免常见陷阱

#### 陷阱 1：在函数体内定义组件

```jsx
// ❌ 陷阱：函数组件内部定义另一个组件
function Parent() {
  function Child() {
    return <div>Child</div>;
  }

  return (
    <div>
      <Child />
      <Child />
    </div>
  );
}

// 每次 Parent 渲染：
// 1. Child 函数被重新创建（新的 function 对象）
// 2. reconcile 比较 type：oldChildFn !== newChildFn → ❌ 
// 3. 所有 <Child /> 的 Fiber 全部销毁重建
// 4. 即使 <Child /> 的内容完全没变

// ✅ 修复：在组件外部定义
function Child() {
  return <div>Child</div>;
}

function Parent() {
  return (
    <div>
      <Child />
      <Child />
    </div>
  );
}

// Child 函数的引用稳定 → type 不变 → Fiber 复用 ✅
```

#### 陷阱 2：index 作为 key

```jsx
// ❌ 陷阱：使用索引作为 key
{todos.map((todo, index) => (
  <TodoItem key={index} todo={todo} />
))}

// 问题：插入新 todo 到头部
// 旧: [{id:1, 'A'}, {id:2, 'B'}] → key: 0, 1
// 新: [{id:3, 'C'}, {id:1, 'A'}, {id:2, 'B'}] → key: 0, 1, 2
//
// React 按 key 比较：
//   新 key=0 → 复用旧 key=0 的 Fiber（id=1 'A'）但数据是 id=3 'C' ❌
//   新 key=1 → 复用旧 key=1 的 Fiber（id=2 'B'）但数据是 id=1 'A' ❌
//   新 key=2 → 创建新 Fiber（id=2 'B'）
//
// 结果：所有 TodoItem 的 props 都错了，显示的数据完全错乱
// 而且会导致输入框状态错乱等严重问题

// ✅ 修复：使用唯一且稳定的 id 作为 key
{todos.map(todo => (
  <TodoItem key={todo.id} todo={todo} />
))}

// 插入后：
// 旧 key: 1, 2  新 key: 3, 1, 2
// key=3 → 新 Fiber → Placement
// key=1 → 复用旧 Fiber → 不变
// key=2 → 复用旧 Fiber → 不变
// ✅ 正确匹配，数据正确
```

#### 陷阱 3：匿名函数 / 内联对象导致不必要的 Update

```jsx
// ❌ 陷阱：每次渲染都创建新 props
function List() {
  return (
    <ul>
      {items.map(item => (
        <Item
          key={item.id}
          item={item}
          onClick={() => handleClick(item.id)}  // ← 每个 fiber 复用检查时
          style={{ color: 'red' }}               // ↑ props 引用都不同
        />
      ))}
    </ul>
  );
}

// 每次渲染：
// onClick: 新的箭头函数 → 新引用 → reconcile 认为 props 变化
// style: 新对象 → 新引用 → reconcile 认为 props 变化
// → 每个 Item Fiber 都被标记 Update → commit 阶段重新调用 render

// ✅ 优化：稳定的 props 引用
function List() {
  return (
    <ul>
      {items.map(item => (
        <ItemMemo
          key={item.id}
          item={item}
          onItemClick={handleClick}
        />
      ))}
    </ul>
  );
}

const ItemMemo = React.memo(function Item({ item, onItemClick }) {
  return (
    <li style={{ color: 'red' }}>
      <span onClick={() => onItemClick(item.id)}>{item.name}</span>
    </li>
  );
});

// React.memo 在 beginWork 阶段进行 props 浅比较
// 如果 onClick/onItemClick 引用不变 → 跳过子孙 Fiber 的协调
```

### 3.8 Reconciliation 总结

| 概念 | 机制 | 实践要点 |
|------|------|----------|
| **同层比较** | 只比较同一层级的节点 | 不要让组件树结构在更新中剧烈变化 |
| **type 比较** | type 不同 → 销毁重建 | 保持函数/类组件的引用稳定 |
| **key 匹配** | key 相同 + type 相同 → 复用 | 使用稳定且唯一的 key（不要用 index） |
| **mount 路径** | current=null → 全部新建 | 无法优化，但只发生一次 |
| **update 路径** | current≠null → 执行完整 Diff | 通过 key 和 type 决定复用 |
| **reconcileChildren** | 协调入口，分派到不同处理函数 | 理解其分支逻辑有助于调优 |
| **ChildReconciler** | 5 个核心子函数 | useFiber → 复用, createChild → 新建 |
| **deleteChild** | 标记 Deletion | commit 阶段执行卸载 + 清理 Effect |
| **placeChild** | 标记 Placement | 判断是否需要移动（lastPlacedIndex/LIS）|
| **key 映射表** | 第二轮遍历用 Map 加速查找 | 避免大规模列表的 O(n²) 问题 |
| **React.memo** | 在 beginWork 阶段拦截 | 阻断非必要子树的协调遍历 |

---

## 4. 调度器（Scheduler）详解

### 4.1 调度器的职责

1. **时间分片**：将大任务拆分成小任务（每帧 5ms）
2. **优先级管理**：根据更新来源分配优先级
3. **任务调度**：使用 MessageChannel/macrotask 实现任务调度
4. **中断恢复**：支持高优先级任务插队

### 4.2 优先级分类

```javascript
// React 内部优先级定义
const NoPriority = 0;              // 无优先级
const ImmediatePriority = 1;       // 同步任务（如用户输入）
const UserBlockingPriority = 2;    // 用户阻塞（如点击、输入）
const NormalPriority = 3;          // 正常优先级（如网络请求）
const LowPriority = 4;             // 低优先级（如分析统计）
const IdlePriority = 5;            // 空闲优先级（如离屏渲染）
```

### 4.3 Lanes 模型——React 的优先级底层架构

> Lanes（车道）是 React 18+ 并发模式的核心基础设施。它是一个基于位掩码（bitmask）的优先级管理系统，取代了 React 17 及之前的单一优先级数值模型。理解 Lanes 是理解 React 并发渲染、Transition、自动批处理等所有高级特性的基石。

#### 4.3.1 为什么需要 Lanes？

在 React 17 及之前，更新优先级通过一个简单的数值表示：

```javascript
// React 17 及之前：单一优先级数值
const NoPriority = 0;           // 无优先级
const ImmediatePriority = 1;    // 立即执行（同步）
const UserBlockingPriority = 2; // 用户交互
const NormalPriority = 3;       // 普通
const LowPriority = 4;          // 低优先级
const IdlePriority = 5;         // 空闲优先级
```

**这个模型有两个根本性缺陷**：

| 缺陷 | 说明 | 后果 |
|------|------|------|
| **单值限制** | 一个任务只能有一个优先级 | 无法表达"这个更新既有同步部分又有过渡部分" |
| **无并发能力** | 不能同时处理多个优先级的更新 | 高优先级更新只能完全打断低优先级，而不是"共存" |
| **无饥饿处理** | 低优先级更新一直在队列中等待时，没有机制能主动提升其优先级 | 低优先级任务可能永远得不到执行 |

**Lanes 模型正是为了解决这些问题而设计的**。

#### 4.3.2 什么是 Lanes？——位掩码优先级模型

Lanes 的核心思想是用一个 **32 位二进制数** 来表示优先级，每一位（bit）代表一个独立的"车道"：

```javascript
// 32 位 lane 定义（从低位到高位优先级递减）
const NoLane = 0b00000000000000000000000000000000; // 0 - 无车道

// === 同步/高优先级车道（不可中断） ===
const SyncLane =              0b00000000000000000000000000000001; // 位 0
const InputContinuousLane =   0b00000000000000000000000000000100; // 位 2
const DefaultLane =           0b00000000000000000000000000010000; // 位 4

// === 过渡车道（可中断） ===
const TransitionLane1 =       0b00000000000000000000000000100000; // 位 5
const TransitionLane2 =       0b00000000000000000000000001000000; // 位 6
const TransitionLane3 =       0b00000000000000000000000010000000; // 位 7
// ...
const TransitionLane16 =      0b00000000000000000000100000000000; // 位 11

// === 保留车道 ===
const RetryLane1 =            0b00000000000000000001000000000000; // 位 12
const RetryLane2 =            0b00000000000000000010000000000000; // 位 13
const RetryLane3 =            0b00000000000000000100000000000000; // 位 14
const RetryLane4 =            0b00000000000000001000000000000000; // 位 15

// === 选择性水合车道 ===
const SelectiveHydrationLane =0b00000000000000010000000000000000; // 位 16

// === 闲置车道 ===
const IdleLane =              0b01000000000000000000000000000000; // 位 30
const OffscreenLane =         0b10000000000000000000000000000000; // 位 31
```

**关键洞察**：每一位是一个独立的"车道"。一个更新不一定只占用一个车道——它可以同时占用多个车道。

**为什么是 32 位？**
- JavaScript 的位运算只对 32 位有符号整数有效（`|`、`&`、`~`、`^`）
- 32 位足够表达 React 所有需要的优先级层级
- 位运算是 CPU 最快的操作之一，比数值比较和数组操作快得多

#### 4.3.3 优先级层次——从 SyncLane 到 OffscreenLane

Lanes 的优先级遵循一个严格的层级：**位越低（越靠右），优先级越高**。

```
高优先级                                           低优先级
┌──────┬─────────┬───────┬──────────┬──────┬──────┬──────┐
│Sync  │InputCont│Default│Transition│Retry │ Idle │Offscreen│
│Lane  │inuous   │Lane   │Lanes     │Lanes │ Lane │  Lane   │
│(位0) │(位2)    │(位4)  │(位5-11)  │(12-15)│(位30)│(位31)   │
└──────┴─────────┴───────┴──────────┴──────┴──────┴──────┘
 不可中断                   可中断（支持并发）
```

**优先级组**：

| 组别 | Lanes 范围 | 是否可中断 | 典型场景 |
|------|-----------|-----------|----------|
| **SyncLanes** | 位 0-1 | ❌ 不可中断 | `createRoot`、直接 DOM 操作、同步更新 |
| **InputContinuousLanes** | 位 2-3 | ❌ 不可中断 | 用户输入（onChange、onClick）、滚动事件 |
| **DefaultLanes** | 位 4 | ⚠️ 部分可中断 | setState 调用的默认更新 |
| **TransitionLanes** | 位 5-11 | ✅ 可中断 | startTransition、useTransition、路由导航 |
| **RetryLanes** | 位 12-15 | ✅ 可中断 | Suspense 重试 |
| **SelectiveHydrationLane** | 位 16 | ✅ 可中断 | 选择性水合 |
| **IdleLane** | 位 30 | ✅ 可中断 | 离屏渲染、预加载 |
| **OffscreenLane** | 位 31 | ✅ 可中断 | Offscreen 组件 |

**为什么高优先级不可中断？**
- `SyncLane`：必须在当前同步任务中完成，否则用户看不到任何内容
- `InputContinuousLane`：用户输入需要快速响应，延迟会降低交互流畅度
- `TransitionLanes`：用户**不期望**实时看到过渡结果，所以适合打断和恢复

#### 4.3.4 位运算——Lanes 的工作语言

Lanes 的一切操作都基于位运算。这是 Lanes 模型高效的根本原因。

**核心操作**：

```javascript
// === 1. 合并 Lane（| 或运算）===
// 场景：一个 Fiber 同时有多个未处理的更新
const lanes = SyncLane | DefaultLane | TransitionLane1;
// 结果: 0b00000000000000000000000000110001

// === 2. 检查是否包含某个 Lane（& 与运算）===
// 场景：判断一次渲染是否包含了某个更新
function includesSomeLane(renderLanes, updateLane) {
  return (renderLanes & updateLane) !== NoLane;
}

// 示例：当前渲染包含 TransitionLane1 吗？
const renderLanes = TransitionLane1 | TransitionLane2;
includesSomeLane(renderLanes, TransitionLane1); // true
includesSomeLane(renderLanes, SyncLane);         // false

// === 3. 移除已经处理的 Lane（~ 取反 + &）===
// 场景：渲染完成后，移除已处理的 lane
function removeLanes(set, lanesToRemove) {
  return set & ~lanesToRemove;
}

// 渲染前：有 3 个 lane 的更新
const pendingLanes = SyncLane | DefaultLane | TransitionLane1;
// 处理了 SyncLane 后：
const remaining = pendingLanes & ~SyncLane;
// 结果: DefaultLane | TransitionLane1

// === 4. 获取最高优先级的 Lane ===
// 低位的 lane 优先级更高，所以取最低位
function getHighestPriorityLane(lanes) {
  return lanes & -lanes; // 经典技巧：取最低位
}

// 示例：从多个 lane 中选最高优先级
getHighestPriorityLane(DefaultLane | TransitionLane1);
// DefaultLane(位4) < TransitionLane1(位5)
// 结果: DefaultLane

// === 5. 判断是否为子集 ===
function isSubsetOfLanes(set, subset) {
  return (set & subset) === subset;
}

// 渲染 lane 是否包含了更新需要的所有 lane？
isSubsetOfLanes(renderLanes, updateLane); // 是→继续；否→跳过
```

**为什么位运算高效？**
- `|`（或）：比数组 `push` 快 10-50 倍
- `&`（与）：比数组 `includes()` 快 10-50 倍
- `& ~`：比数组 `filter()` 快 10-50 倍
- 单次位运算耗时约 0.0000001ms（纳秒级）

**React 源码中真实的 lane 操作函数**：

```javascript
// packages/react-reconciler/src/ReactFiberLane.js

// 合并两个 lane 集合
export function mergeLanes(a, b) {
  return a | b;
}

// 检查 set 是否包含 subset
export function isSubsetOfLanes(set, subset) {
  return (set & subset) === subset;
}

// 检查是否有重叠
export function includesSomeLane(a, b) {
  return (a & b) !== NoLane;
}

// 移除已处理的 lanes
export function removeLanes(set, lanesToRemove) {
  return set & ~lanesToRemove;
}

// 从 lanes 集合中挑选最高优先级的 lane
export function getHighestPriorityLane(lanes) {
  return lanes & -lanes;
}

// 从 transition lanes 中获取下一个可用的 transition lane
export function requestTransitionLane() {
  // 轮询使用 TransitionLane1 ~ TransitionLane16
  const currentTransitionLane = currentBatchConfig.transitionLane;
  const nextTransitionLane = currentTransitionLane << 1;
  // 如果超过 TransitionLane16 的范围，回到 TransitonLane1
  return nextTransitionLane > TransitionLane16 
    ? TransitionLane1 
    : nextTransitionLane;
}
```

#### 4.3.5 Lanes 在 Fiber 中的存储

每个 Fiber 节点有两个关键的 lanes 属性：

```javascript
function FiberNode(tag, pendingProps, key, mode) {
  // ... 其他属性 ...

  // 当前 Fiber 上未处理的 lane
  this.lanes = NoLanes;              // 自己的更新

  // 子树中所有未处理的 lane 的集合（冒泡合并）
  this.childLanes = NoLanes;          // 子树的更新
}
```

**`lanes` vs `childLanes`**：

```
Fiber A (lanes: NoLanes, childLanes: DefaultLane | TransitionLane1)
  │
  ├─ Fiber B (lanes: DefaultLane, childLanes: NoLanes)
  │    └─ Fiber C (lanes: NoLanes, childLanes: NoLanes)
  │
  └─ Fiber D (lanes: TransitionLane1, childLanes: NoLanes)
       └─ Fiber E (lanes: NoLanes, childLanes: NoLanes)
```

- **Fiber B** 有一个 `DefaultLane` 更新
- **Fiber D** 有一个 `TransitionLane1` 更新
- **Fiber A** 的 `childLanes` 是 `DefaultLane | TransitionLane1`（子节点合并上来的）

**`childLanes` 的冒泡机制**：

```javascript
// markUpdateLaneFromFiberToRoot - 从发生更新的 Fiber 开始冒泡
function markUpdateLaneFromFiberToRoot(sourceFiber, lane) {
  // 1. 标记当前 fiber
  sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);

  // 2. 向上冒泡，更新所有父 fiber 的 childLanes
  let parent = sourceFiber.return;
  while (parent !== null) {
    parent.childLanes = mergeLanes(parent.childLanes, lane);
    parent = parent.return;
  }

  // 3. 到达根节点，标记 root 的 pendingLanes
  root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}
```

**为什么要冒泡？**
- `beginWork` 判断是否需要继续深入子树：如果当前 Fiber 的 `childLanes` 与当前渲染的 `renderLanes` 没有交集，则**不需要继续遍历**
- 这是 Fiber 树剪枝的关键优化——提前跳过没有更新的子树

#### 4.3.6 Lanes 的完整生命周期

一个更新从创建到提交，Lanes 经历了完整的生老病死：

```
                                    Lane 生命周期
                                   ─────────────
                                                    
  用户交互 / setState()                               
        │                                             
        ▼                                             
  ① requestUpdateLane() ────── 分配 Lane               
        │                  (根据事件类型)               
        ▼                                             
  ② enqueueUpdate() ────────── 将 Lane 绑定到 update 对象
        │                                             
        ▼                                             
  ③ markUpdateLaneFromFiberToRoot() ── 冒泡到根 Fiber   
        │                    (更新 fiber.lanes + childLanes)
        ▼                                             
  ④ ensureRootIsScheduled() ── 通知调度器              
        │                    (将 Lane 转换为 Scheduler 优先级)
        ▼                                             
  ═══════ Render 阶段 ═══════                         
        │                                             
  ⑤ renderRoot(renderLanes) ── 开始渲染              
        │                    (renderLanes = 本次要处理的所有 lane)
        ▼                                             
  ⑥ beginWork() ────────────── 检查 fiber.lanes     
        │                    (是否在 renderLanes 中？)
        ▼                                             
  ⑦ updateReducer() ───────── 处理 update.lane      
        │                    (lane 匹配则执行，不匹配则跳过)
        ▼                                             
  ⑧ completeWork() ────────── 完成 Fiber 处理        
        │                                             
  ═══════ Commit 阶段 ═══════                         
        │                                             
  ⑨ commitRoot() ──────────── 提交 DOM 更新          
        │                                             
        ▼                                             
  ⑩ remainingLanes = ... ───── 保留未处理的 Lane       
        │                    (某些 lane 可能未完成渲染)
        ▼                                             
  ⑪ 再次调度 ──────────────── 处理剩余的 Lane          
```

**每个阶段的详细说明**：

##### ① requestUpdateLane——分配 Lane

```javascript
// packages/react-reconciler/src/ReactFiberWorkLoop.js
function requestUpdateLane(fiber) {
  // 情况 1：过渡更新
  if (isTransitionUpdate()) {
    const transition = ReactCurrentBatchConfig.transition;
    if (transition !== null) {
      // 返回当前 transition 对应的 lane（TransitionLane1-16）
      return transition.lane;
    }
  }

  // 情况 2：通过事件类型推断 lane
  const updateLane = getLaneForEventType(currentEventType);
  // 点击 → InputContinuousLane
  // 输入 → InputContinuousLane
  // 普通事件 → DefaultLane

  if (updateLane !== SyncLane) {
    return updateLane;
  }

  // 情况 3：同步更新（legacy 模式或 createRoot 以外的渲染）
  return SyncLane;
}
```

**事件类型与 Lane 的映射**：

```javascript
// 不同类型的事件对应不同的 lane 优先级
const eventTypeToLane = {
  'click':       InputContinuousLane,
  'keydown':     InputContinuousLane,
  'input':       InputContinuousLane,
  'change':      InputContinuousLane,
  'scroll':      DefaultLane,
  'resize':      DefaultLane,
  'load':        DefaultLane,
  // 其他事件 → DefaultLane
  // startTransition 内的更新 → TransitionLanes
};
```

##### ② enqueueUpdate——绑定 Lane 到更新对象

```javascript
function enqueueUpdate(fiber, update, lane) {
  const queue = fiber.updateQueue;
  // update 对象的结构
  const update = {
    lane,         // ← 这个 lane 标记了更新的优先级
    action,       // 更新操作（如 setCount(1) 中的 1）
    next: null,   // 链表指针
    // ...
  };

  // 添加到 update 环形链表
  enqueueUpdate(fiber, update);
}
```

##### ③ markUpdateLaneFromFiberToRoot——冒泡标记

这一步决定了 Fiber 树的哪些部分需要被渲染。

##### ④ ensureRootScheduled——Lane 到 Scheduler 优先级转换

```javascript
function ensureRootIsScheduled(root) {
  // 获取所有待处理的 lanes
  const nextLanes = getNextLanes(root, NoLanes);

  // 将 lanes 转换为 Scheduler 优先级
  const schedulerPriority = lanesToEventPriority(nextLanes);

  // 调度任务
  scheduleCallback(schedulerPriority, () => {
    performConcurrentWorkOnRoot(root);
  });
}

// Lane → Scheduler 优先级 映射
function lanesToEventPriority(lanes) {
  if (includesSomeLane(lanes, SyncLane)) {
    return ImmediatePriority;            // 1 - 立即
  }
  if (includesSomeLane(lanes, InputContinuousLane)) {
    return UserBlockingPriority;         // 2 - 用户阻塞
  }
  if (includesSomeLane(lanes, DefaultLane)) {
    return NormalPriority;               // 3 - 普通
  }
  // TransitionLanes → LowPriority
  // IdleLane → IdlePriority
  return NormalPriority;
}
```

##### ⑤-⑦ Render 阶段——Lane 的消费

```javascript
function beginWork(current, workInProgress, renderLanes) {
  // ✅ 关键判断：当前 Fiber 有需要处理的 lane 吗？
  const hasUpdate = includesSomeLane(workInProgress.lanes, renderLanes);

  if (!hasUpdate) {
    // 没有更新 → 尝试 bailout
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  // 有更新 → 处理更新
  const child = Component(props);
  // ...

  // 完成后从 lanes 中移除已处理的 lane
  workInProgress.lanes = removeLanes(workInProgress.lanes, renderLanes);
}
```

##### ⑧-⑪ Commit 阶段——剩余 Lane

```javascript
function commitRoot(root) {
  // 提交完成后，计算还有哪些未处理的 lane
  const remainingLanes = root.pendingLanes;
  // 如果还有剩余，继续调度
  if (remainingLanes !== NoLanes) {
    ensureRootIsScheduled(root);
  }
}
```

##### ⑫ Lane 的同步机制——从事件到 Fiber 的完整双向链路

> 前面 11 步展示了 Lane 的完整生命周期，但有一个核心机制值得独立展开：
> **Lane 是如何从"事件"出发，向上同步到 Root，再向下同步回每个 Fiber 的？**
> 这是一个"先向上冒泡，再向下消费"的双向过程。

###### 同步链路全景

```
  setState / 用户交互
       │
       ▼
  ═══════ ① 向上同步（dispatch → root）═══════
       │
  requestUpdateLane(fiber) ──→ 分配 Lane（根据事件类型）
       │
       ▼
  fiber.lanes |= lane         ──→ 标记当前 Fiber
       │
       ▼
  parent.childLanes |= lane   ──→ 向上冒泡到每个父 Fiber
       │                          （一路直到 HostRoot）
       ▼
  root.pendingLanes |= lane   ──→ 根节点记录待处理 lanes
       │
       ▼
  ensureRootIsScheduled()    ──→ 转换为 Scheduler 优先级，排队
       │
       ▼
  ═══════ ② 向下消费（root → render → fiber）═══════
       │
  getNextLanes(root)         ──→ 从 root.pendingLanes 中
       │                          选出本次要渲染的 lanes
       ▼
  renderRoot(renderLanes)    ──→ renderLanes 确定
       │
       ▼
  beginWork(..., renderLanes)
       │
       ├── check: workInProgress.lanes & renderLanes ?
       │    ├── 有交集 → 处理更新（调用组件函数、协调子节点）
       │    └── 无交集 → bailout（跳过本节点）
       │
       ├── check: workInProgress.childLanes & renderLanes ?
       │    ├── 有交集 → 继续深入子树
       │    └── 无交集 → bailoutOnAlreadyFinishedWork（跳过整个子树）
       │
       ▼
  updateReducer() ──→ 如果 update.lane 与 renderLanes 匹配 → 执行
                       如果不匹配 → 跳过（保留到下次渲染）
       │
       ▼
  ═══════ ③ 同步完成后的收尾 ═══════
       │
  root.pendingLanes ← removeLanes(已处理的 lanes)
       │
  root.pendingLanes ≠ NoLanes ? → 继续调度 ⭯
  root.pendingLanes = NoLanes  → 空闲，等待下次更新
```

###### Step 1：向上冒泡——`markUpdateLaneFromFiberToRoot`

这是 Lane 从"事发地点"到"决策中心"的路径：

```javascript
// 场景：用户点击按钮，触发 setCount(1)
function dispatchSetState(fiber, queue, action) {
  // 1a. 分配 Lane
  const lane = requestUpdateLane(fiber);
  // 普通点击事件 → InputContinuousLane（位 2）

  // 1b. 创建 update 对象
  const update = { lane, action, next: null };
  enqueueUpdate(fiber, queue, update);

  // 1c. ★ 开始向上冒泡
  const root = markUpdateLaneFromFiberToRoot(fiber, lane);
  // 结果：
  //   fiber.lanes        |= InputContinuousLane
  //   fiber.return.childLanes  |= InputContinuousLane
  //   fiber.return.return.childLanes  |= InputContinuousLane
  //   ... 一直到 HostRoot
  //   root.pendingLanes  |= InputContinuousLane

  // 1d. 调度
  ensureRootIsScheduled(root, currentTime);
}
```

```
冒泡过程示例：

  setCount(1) 在 Counter 组件中触发
       │
       ▼
  Counter (lanes: InputContinuousLane)       ← 自身标记
       │
       ▼ (return)
  App (childLanes: InputContinuousLane)      ← 子树标记
       │
       ▼ (return)
  HostRoot (childLanes: InputContinuousLane) ← 子树标记
  root.pendingLanes: InputContinuousLane     ← 根节点记录
```

###### Step 2：`getNextLanes`——确定本次渲染的 Lane

Scheduler 调度任务后，进入渲染之前，`getNextLanes` 决定"这次要处理哪些 lanes"：

```javascript
function getNextLanes(root, wipLanes) {
  const pendingLanes = root.pendingLanes;

  if (pendingLanes === NoLanes) {
    return NoLanes; // 没有待处理的更新
  }

  // 检查是否有过期（饥饿）的 lane
  const expiredLanes = root.expiredLanes;
  if (expiredLanes !== NoLanes) {
    // 有过期 lane → 优先处理它们
    return expiredLanes;
  }

  // 获取所有非空闲 lane 中优先级最高的
  const nonIdlePendingLanes = 
    pendingLanes & ~NonIdleLanes; // 去除空闲 lane

  if (nonIdlePendingLanes !== NoLanes) {
    // 返回最高优先级的 lanes 集合
    // 例如：InputContinuousLane | DefaultLane
    return getHighestPriorityLanes(nonIdlePendingLanes);
  }

  // 只有空闲 lane → 等浏览器空闲再处理
  return pendingLanes;
}

// 场景示例：
// root.pendingLanes = InputContinuousLane | DefaultLane
// 没有过期 lane
// getNextLanes 返回: InputContinuousLane（取最高优先级）
// 注意：不一定会返回所有 pending lanes
// 只有高优先级的被选中，低优先级的等下次
```

**关键规则**：`getNextLanes` **不会一次返回所有 pending lanes**。它只返回**当前应该处理的最高优先级集合**。低优先级的 lane 留在 `root.pendingLanes` 中，等下次渲染。

```javascript
// 示例：pendingLanes 中有 3 个不同优先级的更新
root.pendingLanes = SyncLane | DefaultLane | TransitionLane1;

// getNextLanes 的返回取决于优先级分组：
// 情况 A：SyncLane 单独一组（最高优先级）
//   → 返回 SyncLane，不包含 DefaultLane
//   → DefaultLane + TransitionLane1 留在 pendingLanes 中
//
// 情况 B：InputContinuousLane + DefaultLane 在同一优先级分组
//   → 可能一起返回
//
// ⟹ 低优先级更新不会被"饿死"——它们留在 pendingLanes 中
//   每次渲染结束后，ensureRootIsScheduled 会再次调度它们
```

###### Step 3：`renderLanes` 向下流动——`beginWork` 中的 Lane 检查

`renderLanes` 在 render 阶段开始时就确定了，然后一路传递到每个 `beginWork` 调用：

```javascript
function renderRoot(root, renderLanes) {
  do {
    try {
      // 开始遍历 Fiber 树，renderLanes 作为参数一路传递
      workLoopConcurrent();
    } catch (thrownValue) {
      // 错误处理
    }
  } while (true);
  
  // workLoopConcurrent 中的每个 performUnitOfWork
  // 都会将 renderLanes 传递给 beginWork
}

function beginWork(current, workInProgress, renderLanes) {
  // ★★★ 这里有两次 Lane 检查 ★★★

  // 检查 1：当前 Fiber 自身是否有待处理的更新？
  const hasUpdate = includesSomeLane(workInProgress.lanes, renderLanes);
  
  if (!hasUpdate) {
    // 当前 Fiber 没有需要处理的更新 → 可以跳过
    // 但不一定跳过整个子树（还要看 childLanes）
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  // 有更新 → 执行组件的 render 函数
  // ...
}

function bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes) {
  // ★ 检查 2：子树中是否有需要处理的更新？
  if (!includesSomeLane(workInProgress.childLanes, renderLanes)) {
    // 子树也没有更新 → 可以跳过整个子树
    // 这是 Fiber 树剪枝的关键！
    return null;
  }

  // 子树有更新 → 克隆子 Fiber，继续遍历
  // 但当前 Fiber 本身不需要重新渲染
  cloneChildFibers(current, workInProgress);
  return workInProgress.child;
}
```

**两次检查的完整流程图**：

```
beginWork(fiber, renderLanes)
       │
       ▼
  ┌─── fiber.lanes & renderLanes ? ────┐
  │         │                          │
  │         │ 有交集                    │ 无交集
  │         ▼                          │
  │   处理更新（复用/新建/删除）         │
  │         │                          │
  │         ▼                          │
  │   fiber.flags |= Update            │
  │         │                          │
  └─────────┘                          │
            ┌──────────────────────────┘
            │
            ▼
  ┌─── fiber.childLanes & renderLanes ? ────┐
  │         │                               │
  │         │ 有交集                         │ 无交集
  │         ▼                               │
  │   进入子树（继续 beginWork）              │
  │         │                               │ 跳过整个子树
  │         │                               │ return null
  │         ▼                               │
  │   fiber.child.beginWork(...)            │
  └─────────────────────────────────────────┘
```

###### Step 4：`updateReducer` 中的 Lane 匹配

对于函数组件，`useState` 和 `useReducer` 在 render 阶段会调用 `updateReducer`，它会检查 **每个 update 对象的 lane** 是否与 `renderLanes` 匹配：

```javascript
function updateReducer(reducer, initialArg, init) {
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;
  const pending = queue.pending;

  if (pending !== null) {
    // 遍历 update 环形链表
    let first = pending.next;
    let update = first;

    do {
      // ★★★ 关键：检查 update 的 lane 是否在当前 renderLanes 中
      if (includesSomeLane(update.lane, renderLanes)) {
        // ✅ 匹配 → 执行这个 update
        newState = reducer(newState, update.action);
      } else {
        // ❌ 不匹配 → 跳过这个 update
        // 这个 update 保留到下一次渲染
        // 它的 lane 不在本次 renderLanes 中
        // 说明优先级不够，等下次再说
        
        // 将未匹配的 update 加入新链表（保留到下次）
        if (newQueue === null) {
          newQueue = { ... };
        }
        enqueueUpdate(newQueue, update);
      }

      update = update.next;
    } while (update !== null && update !== first);
  }

  hook.memoizedState = newState;
  return [newState, dispatch];
}
```

**实战意义**：这就是为什么在 `startTransition` 中的 `setState` 可以被高优先级更新打断。

```jsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  function handleChange(e) {
    // 紧急：高优先级（InputContinuousLane）
    setQuery(e.target.value);

    // 非紧急：低优先级（TransitionLane1）
    startTransition(() => {
      setResults(search(e.target.value));
    });
  }
}
```

**Lane 同步的实际过程**：

```
用户快速输入 "abc"：

第 1 次输入 "a"：
  ├─ setQuery("a")    → InputContinuousLane → 立即渲染
  ├─ startTransition → setResults(search("a")) → TransitionLane1
  │     → 渲染开始：renderLanes = InputContinuousLane
  │     → beginWork 检查：
  │       query.lanes: InputContinuousLane → 匹配 ✅ → 更新
  │       results.lanes: TransitionLane1 → 不匹配 ❌ → 跳过
  │     → 结果：query 更新为 "a"，results 不更新
  │     → root.pendingLanes 中还剩 TransitionLane1
  │
第 2 次输入 "ab"（用户快速输入，打断第 1 次渲染）：
  ├─ setQuery("ab")   → InputContinuousLane（新的）
  ├─ startTransition → setResults(search("ab")) → TransitionLane2
  │     → 渲染开始：renderLanes = InputContinuousLane
  │     → TransitionLane1 还没处理，又来了 TransitionLane2
  │     → TransactionLane1 被"抛弃"了（因为 search("a") 的结果已经过时）
  │     → 只处理 InputContinuousLane 的更新
  │
第 3 次输入 "abc"（用户输入完毕）：
  ├─ 没有新的紧急输入
  ├─ startTransition 内的更新执行
  │     → 渲染开始：renderLanes = TransitionLane2（上次残留的）
  │     → setResults(search("abc")) → TransitionLane2 → 匹配 ✅
  │     → results 更新为搜索 "abc" 的结果
  │
总结：
  - 紧急更新（InputContinuousLane）→ 立即同步到 Fiber → 立即渲染
  - 非紧急更新（TransitionLane）→ 暂存在 root.pendingLanes 中
  - 每次渲染只处理 renderLanes 选中的 lane
  - 未选中的 lane 保留到下次
```

###### Step 5：Render 完成后的 Lane 清理

```javascript
function renderRoot(root, renderLanes) {
  // ... 渲染完成后 ...

  // 从 root.pendingLanes 中移除本次已处理的 lanes
  const remainingLanes = root.pendingLanes & ~renderLanes;
  root.pendingLanes = remainingLanes;

  // 如果还有剩余的 lanes → 继续调度
  if (remainingLanes !== NoLanes) {
    ensureRootIsScheduled(root);
  }
}
```

**完整同步链路实战**：

```javascript
// 初始状态：root.pendingLanes = NoLanes

// 用户点击按钮（场景：同时触发两个 setState）
function handleClick() {
  setStateA('new'); // InputContinuousLane
  setStateB('new'); // InputContinuousLane（合并为同一个 lane）
}

// 第 1 阶段：向上同步
// ─────────────────
// ★ 两个 setState 属于同一个组件 → 同一个 Fiber 节点
//    setStateA → update-1 追加到 hook-A 的 queue
//    setStateB → update-2 追加到 hook-B 的 queue
//    但 fiber.lanes 共享（因为只有一个 Fiber）
//
// setStateA → requestUpdateLane() → InputContinuousLane
//   ├─ fiber.lanes |= InputContinuousLane           ← 标记在 Fiber 上
//   ├─ fiber.return.childLanes |= InputContinuousLane
//   ├─ ...向上冒泡...
//   └─ root.pendingLanes |= InputContinuousLane
//
// setStateB → requestUpdateLane() → InputContinuousLane（相同）
//   ├─ fiber.lanes |= InputContinuousLane           ← 位已存在，空操作
//   ├─ fiber.return.childLanes |= InputContinuousLane ← 位已存在，空操作
//   ├─ ...（冒泡链路中所有 childLanes 位已存在，全部空操作）
//   └─ root.pendingLanes = InputContinuousLane（不变，因为已存在）
//
// ↑ 两个 setState 共享同一个 lane！
//   不是"两个 lane 合并"——而是"本来就只有一个 lane"
//   这就是"批量更新"的底层原理

// 第 2 阶段：确定 renderLanes
// ─────────────────
// getNextLanes(root) → InputContinuousLane
// renderLanes = InputContinuousLane

// 第 3 阶段：向下同步（beginWork）
// ─────────────────
// ★ 注意：setStateA 和 setStateB 在同一个组件中
//   → 它们属于同一个 Fiber 节点（而不是两个 Fiber）
//   → 该 Fiber 的 lanes |= InputContinuousLane（只标记一次）
//   → 两个 update 分别追加到不同 hook 的 updateQueue 环形链表上
//   → beginWork 执行一次该 Fiber，内部处理所有 hook
//
// beginWork(HostRoot, renderLanes):
//   HostRoot.childLanes & InputContinuousLane → 有交集 → 继续
//   ├─ beginWork(App, renderLanes):
//   │   App.childLanes & InputContinuousLane → 有交集 → 继续
//   │   └─ beginWork(CounterFiber, renderLanes):
//   │       CounterFiber.lanes & InputContinuousLane → 有交集 ✅
//   │       → renderWithHooks() → 调用函数组件
//   │       → 执行 useReducer hook（useState 底层）
//   │           ├─ hook-A 的 queue 中有 updateA
//   │           │  updateA.lane(InputContinuous) & renderLanes → ✅ 执行
//   │           │  → stateA = 'new' ✅
//   │           ├─ hook-B 的 queue 中有 updateB
//   │           │  updateB.lane(InputContinuous) & renderLanes → ✅ 执行
//   │           │  → stateB = 'new' ✅
//   │           └─ ...（其他无更新的 hook 跳过）
//   │       → CounterFiber.lanes -= InputContinuousLane
//
// 一次 beginWork 处理了同一个 Fiber 上的所有 hook 更新
// 两个 setState 共享一个 lane → 合并为一次 render + 一次 commit
// → 一次 DOM 更新
```

#### 4.3.7 饥饿预防——Lane 的自动降级机制

**饥饿问题**：低优先级的 Transition 更新如果不断被高优先级更新打断，可能长期得不到执行。

React 的解决方案是 **Lane 自动升级（lane bumping）**：

```javascript
// React 源码中的饥饿处理机制
function markStarvedLanesAsExpired(root) {
  const currentTime = now();

  for (let i = 0; i < TotalLanes; i++) {
    const lane = 1 << i;

    // 检查这个 lane 是否等待太久
    const pending = root.pendingLanes & lane;
    if (pending !== NoLane) {
      const expirationTime = root.expirationTimes[i];

      // 如果过期了，强制提升到同步优先级
      if (expirationTime <= currentTime) {
        root.expiredLanes = mergeLanes(root.expiredLanes, lane);
      }
    }
  }
}

// 过期时间计算：等待越久，越会被提升
function computeExpirationTime(lane, currentTime) {
  switch (getLanePriority(lane)) {
    case SyncLanePriority:
      return currentTime;  // 同步 lane 不需要等待
    case TransitionLanePriority:
      return currentTime + 5000;  // Transition 最多等待 5 秒
    case IdleLanePriority:
      return NoTimestamp;  // 空闲 lane 不计时
  }
}
```

**效果**：如果一个 Transition 更新在队列中等待超过 5 秒，它会被自动提升为同步优先级，确保最终得到执行。

#### 4.3.8 Lanes 在实际项目中的应用

理解 Lanes 模型后，你在实际项目中可以通过以下方式利用它：

##### 场景 1：使用 `startTransition` 降低非紧急更新的优先级

```jsx
import { startTransition, useState } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  function handleInputChange(e) {
    const value = e.target.value;

    // ✅ 紧急更新：输入框立即响应
    setQuery(value);

    // ✅ 非紧急更新：搜索结果的渲染可以延迟
    // 这个 setResults 会被分配 TransitionLane
    // 后续用户的每次输入都可以打断它
    startTransition(() => {
      setResults(filterItems(value));
    });
  }

  return (
    <div>
      <input value={query} onChange={handleInputChange} />
      <SlowList items={results} /> {/* 不会阻塞输入 */}
    </div>
  );
}
```

**Lanes 视角**：`setQuery(value)` 分配 `InputContinuousLane`（位 2），`setResults()` 分配 `TransitionLane1`（位 5）。渲染时 React 先处理高优先级 lane（输入更新），低优先级 lane 可以被打断和恢复。

##### 场景 2：使用 `useDeferredValue` 延迟非关键值的更新

```jsx
import { useDeferredValue, useMemo } from 'react';

function Dashboard({ metrics }) {
  // ✅ 延迟渲染非关键数据
  const deferredMetrics = useDeferredValue(metrics);
  const isPending = metrics !== deferredMetrics;

  // 这个计算会被自动分配 TransitionLane
  const chartData = useMemo(
    () => expensiveCalculation(deferredMetrics),
    [deferredMetrics]
  );

  return (
    <div>
      <h1>实时仪表盘</h1>
      {isPending && <Spinner />} {/* 显示加载指示器 */}
      <Chart data={chartData} />
    </div>
  );
}
```

**Lanes 视角**：`useDeferredValue` 在内部将 `setState` 包装在 `startTransition` 中，确保昂贵的计算在低优先级的 TransitionLane 中执行。

##### 场景 3：自动批处理（Automatic Batching）

```jsx
function AutoBatchingDemo() {
  const [count, setCount] = useState(0);
  const [flag, setFlag] = useState(false);

  async function handleClick() {
    // React 17：两次独立的同步渲染
    // React 18：合并为一次渲染，共用同一个优先级 lane
    
    setCount(c => c + 1);  // lane: DefaultLane
    setFlag(f => !f);       // lane: DefaultLane（合并到同一个 lane）

    // 效果：一次渲染完成两个更新，而非两次
  }

  function handleFetch() {
    fetchData().then(() => {
      // React 17：两次独立渲染（不在事件处理函数内）
      // React 18：自动批处理，合并为一个 DefaultLane
      setCount(c => c + 1);
      setFlag(f => !f);
    });
  }
}
```

**Lanes 视角**：多个 `setState` 如果发生在同一个同步上下文中，它们的 lane 会被合并到同一组中，共享同一个 lane 优先级，最终合并为一次渲染。

##### 场景 4：并发渲染下的 Suspense + Transition

```jsx
import { useTransition, Suspense } from 'react';

function UserProfile({ userId }) {
  const [isPending, startTransition] = useTransition();

  function switchUser(newUserId) {
    // 用户切换：标记为 Transition
    startTransition(() => {
      setUserId(newUserId);
    });
    // 因为是 TransitionLane，Suspense 不会显示 fallback
    // 而是继续显示当前用户的内容，直到新内容准备好
  }

  return (
    <div>
      <button onClick={() => switchUser(42)}>User 42</button>
      {isPending && <p>切换中...</p>}

      <Suspense fallback={<FullPageSpinner />}>
        {/* 在 Transition 内，Suspense 保持显示旧内容 */}
        <ProfileContent userId={userId} />
      </Suspense>
    </div>
  );
}
```

**Lanes 视角**：`startTransition` 内的更新分配 `TransitionLane`，渲染器在 `beginWork` 时检查到 Suspense 边界正在渲染 TransitionLane，会优先显示旧 UI 而非 fallback。

#### 4.3.9 开发者如何利用 Lanes 概念优化项目

##### 实践 1：合理划分更新优先级

```jsx
function PaymentForm() {
  const [cardNumber, setCardNumber] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  function handleCardInput(e) {
    const value = e.target.value;

    // ✅ 紧急：输入响应
    setCardNumber(value);

    // ✅ 非紧急：验证逻辑（复杂正则 + UI 更新）
    startTransition(() => {
      setValidationResult(validateCardNumber(value));
    });
  }
}
```

**原则**：
- 用户**直接操作**的 UI 更新 → 不用 transition（默认高优先级）
- 用户**不直接感知**的数据处理 → 用 `startTransition` 包装
- 复杂计算的结果展示 → 用 `useDeferredValue`

##### 实践 2：避免阻塞高优先级更新

```jsx
// ❌ 坏做法：一次渲染内处理太多工作
function handleInput(e) {
  setValue(e.target.value);                 // 应该快
  setFilteredList(complexFilter(bigList));  // 阻塞了 200ms
}

// ✅ 好做法：分离紧急和非紧急更新
function handleInput(e) {
  setValue(e.target.value); // 紧急：立即响应

  startTransition(() => {
    setFilteredList(complexFilter(bigList)); // 非紧急：可延迟/打断
  });
}
```

##### 实践 3：配合 React.memo 减少不必要的 Lane 冒泡

```jsx
// 一个组件更新导致整个子树被标记 childLanes
function App() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
      <ExpensiveTree /> {/* 也会被标记 childLanes → 重新渲染 */}
    </div>
  );
}

// ✅ 用 React.memo 阻断 lane 的传播影响
const MemoizedExpensiveTree = React.memo(ExpensiveTree);
// 当 ExpensiveTree 的 props 不变时，即使父组件的 childLanes 被标记，
// beginWork 也会对其执行 bailout，不深入子树
```

**Lanes 视角**：`React.memo` 不会阻止 `childLanes` 的冒泡（这是 Fiber 树级别的事情），但会在 `beginWork` 阶段执行 `bailout`，跳过实际渲染。

##### 实践 4：使用 `useSyncExternalStore` 确保外部数据一致性

```jsx
import { useSyncExternalStore } from 'react';

function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function NetworkStatus() {
  // ✅ 确保并发渲染下也能读取到一致的外部状态
  const isOnline = useSyncExternalStore(subscribe, getSnapshot);

  return <div>{isOnline ? '在线' : '离线'}</div>;
}
```

**Lanes 视角**：在并发渲染中，组件可能被渲染多次才提交。`useSyncExternalStore` 确保即使渲染被中断，读到的外部状态也是一致的（通过 `getSnapshot` 的比较机制）。

##### 实践 5：调试 Lane 相关问题

React DevTools 在 React 18+ 中提供了 Fiber 树的可视化，可以看到每个 Fiber 的 lanes：

```javascript
// 在 DevTools 中可以查看
FiberNode {
  lanes: 0b00000000000000000000000000110001,
  childLanes: 0b00000000000000000000000000010000,
}

// 检查哪些 lane 正在处理
// 常见调试点：
// 1. 某个组件不更新 → 检查它的 lanes 是否被正确标记
// 2. 某个更新被延迟 → 检查它是否在 TransitionLane 中
// 3. 挂载了但未渲染 → 检查 childLanes 是否被错误清除
```

#### 4.3.10 Lanes 与 React 19 的演进

React 19 在 Lanes 模型基础上的增强：

```javascript
// React 19 新增：请求/响应相关的 lane
// 更好地支持 Server Components 和 Actions
const RequestLane = 0b00000000000000010000000000000000;

// React 19：改进的饥饿处理
// 异步 Actions 中的更新会在更合理的时机提升优先级
async function handleSubmit(formData) {
  'use server';
  // 这个更新会基于等待时间和操作类型自动调整 lane
}
```

**关键变化**：
- **Server Actions** 的更新使用特定的 lane 策略，避免阻塞客户端交互
- **React Compiler** 自动优化减少不必要的 lane 标记
- **改进的饥饿处理**：Transition 更新在特定条件下更快获得执行

#### 4.3.11 Lanes 总结

| 概念 | 要点 |
|------|------|
| **本质** | 32 位位掩码优先级模型 |
| **优势** | 可合并、可比较、位运算极快 |
| **优先级** | 位越低优先级越高（SyncLane > TransitionLane > IdleLane） |
| **不可中断** | SyncLane、InputContinuousLane |
| **可中断** | TransitionLanes、RetryLanes、IdleLane |
| **存储** | `fiber.lanes` + `fiber.childLanes` + `root.pendingLanes` |
| **冒泡** | 从更新发生处向上冒泡到根节点 |
| **消费** | Render 阶段按 renderLanes 匹配处理 |
| **剩余** | 提交后计算剩余 lanes，继续调度 |
| **饥饿** | 等待超过阈值的 lane 自动升级优先级 |
| **开发者 API** | `startTransition`、`useDeferredValue`、`useSyncExternalStore` |

---

## 5. Bailout 优化机制

### 5.1 什么是 Bailout

当组件的 props 和 state 都没有变化时，React 会跳过该组件及其子树的渲染过程，直接复用上次的渲染结果。

**但是！更准确的说法是**：当组件的更新计算出的新状态与旧状态相同时，React 会跳过重新渲染。

---

### 5.2 Bailout 触发条件与状态更新机制

#### 5.2.1 setState 后的完整流程

```javascript
function Counter() {
  const [count, setCount] = useState(0);

  console.log('组件渲染, count:', count);

  const handleClick = () => {
    setCount(0);  // 点击时调用 setState(0)
  };

  return <button onClick={handleClick}>Count: {count}</button>;
}

// 执行流程追踪:
// 初始渲染:
//   组件渲染, count: 0

// 点击按钮（count 当前是 0）:
//   1. dispatchSetState(fiber, queue, action=0)
//      ├─→ 创建 update 对象: {lane, action: 0, ...}
//      ├─→ 添加到 queue.pending 环形链表
//      └─→ scheduleUpdateOnFiber(fiber, lane)
//
//   2. Render 阶段
//      ├─→ updateReducer 计算新状态
//      ├─→ prevState: 0, newState: 0
//      ├─→ Object.is(0, 0) === true  // 关键：状态相等！
//      └─→ 新旧状态相同
//
//   3. Reconciliation 阶段
//      ├─→ 比较 Fiber 节点
//      │  ├─→ memoizedState: 0 (相同)
//      │  ├─→ memoizedProps: {} (相同)
//      │  └─→ flags: 0 (无变化)
//      └─→ 执行 bailout
//         ├─→ 复用已有的 Fiber 节点
//         ├─→ 跳过子组件渲染
//         └─→ "组件渲染, count: 0" 不会输出 ✅
//
// 结论: setState(0) 不会触发重新渲染
```

**关键代码流程**：

```javascript
// ReactFiberBeginWork.js
function beginWork(current, workInProgress, renderLanes) {
  // 检查是否需要 bailout（在 beginWork 开始）
  if (isBailout(current, workInProgress, renderLanes)) {
    return bailoutOnAlreadyFinishedWork(current, workInProgress, renderLanes);
  }

  // ... 正常渲染逻辑
}

// isBailout 检查逻辑
function isBailout(current, workInProgress, renderLanes) {
  // 1. 检查是否有待处理的更新
  if (!hasPendingUpdates(current)) {
    // 如果有 pending update，不会 bailout（即使值相同）
    return false;
  }

  // 2. 检查更新队列
  const queue = workInProgress.updateQueue;
  const lastBaseUpdate = queue.baseQueue;

  // 3. 在 updateReducer 中计算新状态后
  // 自动比较新旧状态
  // if (Object.is(oldState, newState)) return true;

  return false;
}

// updateReducer 中的比较（简化版）
function updateReducer(reducer, initialArg) {
  const hook = workInProgressHook;
  const queue = hook.queue;

  // 处理所有更新，计算最终状态
  let newState = hook.baseState;
  let update = firstBaseUpdate;
  do {
    newState = reducer(newState, update.action);
    update = update.next;
  } while (update !== null && update !== firstBaseUpdate);

  // 比较新旧状态
  if (Object.is(hook.memoizedState, newState)) {
    // 状态相同，标记 bailout
    // 渲染阶段会跳过
  }

  hook.memoizedState = newState;
  return [newState, queue.dispatch];
}
```

#### 5.2.2 React 的自动比较机制

**核心：使用 `Object.is()` 进行值比较**

```javascript
// React 内部比较逻辑（简化）
function isStateEqual(currentFiber, workInProgressFiber) {
  const oldState = currentFiber.memoizedState;
  const newState = workInProgressFiber.memoizedState;

  // Object.is() 规则：
  // 1. +0 !== -0  （Object.is 不同，=== 相同）
  // 2. NaN === NaN （Object.is 相同，=== 不同）
  // 3. 同一引用 === true
  // 4. 基本类型值 === true

  return Object.is(oldState, newState);
}
```

**比较示例**：

```javascript
// 场景 1: 简单值比较
const [count, setCount] = useState(0);

setCount(0);      // Object.is(0, 0) === true → Bailout ✅
setCount(0);      // 同上
setCount(1);      // Object.is(0, 1) === false → 渲染 ❌

// 场景 2: 特殊值比较
const [special, setSpecial] = useState(NaN);

setSpecial(NaN);  // Object.is(NaN, NaN) === true → Bailout ✅
setSpecial(NaN);  // 同上

// 场景 3: +0 vs -0
const [signed, setSigned] = useState(+0);

setSigned(-0);    // Object.is(+0, -0) === false → 渲染 ❌

// 场景 4: 对象引用比较
const [data, setData] = useState({ a: 1 });

setData({ a: 1 }); // Object.is({a:1}, {a:1}) === false → 渲染 ❌
                 // 即使内容相同，引用不同

// 场景 5: 函数组件配合状态
const Parent = () => {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(prev => prev + 1);  // 函数式更新
    setCount(prev => prev + 1);  // 会批处理为一次更新
  };

  // 结果：count 从 0 变为 2，只渲染一次 ✅
};
```

#### 5.2.3 简单值 vs 对象/数组的差异

**关键区别**：简单值使用值相等，对象/数组使用引用相等

| 类型 | 比较方式 | 相同值是否 Bailout | 示例 |
|------|----------|---------------------|------|
| **number** | `Object.is()` | ✅ 是 | `0 === 0` → bailout |
| **string** | `Object.is()` | ✅ 是 | `"hello" === "hello"` → bailout |
| **boolean** | `Object.is()` | ✅ 是 | `true === true` → bailout |
| **null/undefined** | `Object.is()` | ✅ 是 | `null === null` → bailout |
| **object** | `Object.is()` | ❌ 否（除非同一引用） | `{a:1} === {a:1}` → false |
| **array** | `Object.is()` | ❌ 否（除非同一引用） | `[1,2] === [1,2]` → false |

**实际影响**：

```javascript
// ❌ 问题：对象内容相同但引用不同
function Example1() {
  const [config, setConfig] = useState({ theme: 'dark' });

  const toggleTheme = () => {
    const newConfig = { theme: config.theme === 'dark' ? 'light' : 'dark' };
    setConfig(newConfig);
    // 问题：即使 theme 不变，每次都创建新对象
    // React 认为是不同的 state，会重新渲染
  };

  // 解决方案：使用浅比较
  const toggleThemeOptimized = () => {
    const newTheme = config.theme === 'dark' ? 'light' : 'dark';
    if (config.theme === newTheme) {
      return;  // 相同则跳过
    }
    setConfig({ theme: newTheme });
  };
}

// ✅ 解决方案 1：拆分状态
function Example2() {
  const [theme, setTheme] = useState('dark');
  const [config, setConfig] = useState({ other: 'value' });

  // theme 是简单值，React 自动比较
  setTheme('dark');  // 不会渲染 ✅
}

// ✅ 解决方案 2：使用 useMemo 稳定引用
function Example3() {
  const [theme, setTheme] = useState('dark');
  const [otherProp, setOtherProp] = useState('value');

  const config = useMemo(() => ({ theme, otherProp }), [theme, otherProp]);

  // config 只有在 theme 或 otherProp 变化时才创建新对象
}
```

#### 5.2.4 何时需要手动比较？

**不需要手动比较的情况**：

```javascript
// ✅ 1. 简单值 - React 自动处理
function Simple() {
  const [count, setCount] = useState(0);
  setCount(0);  // 自动 bailout
}

// ✅ 2. React.memo 配合浅比较
const Child = React.memo(({ data }) => {
  return <div>{data.value}</div>;
});

// ✅ 3. 函数式更新避免引用创建
function FunctionalUpdate() {
  const [items, setItems] = useState([1, 2, 3]);

  // ✅ 函数式更新：React 会先计算，再比较
  setItems(prev => {
    const newItems = [...prev, 4];
    // React 内部会比较新旧数组
    // 如果内容相同（极端情况），仍会 bailout
    return newItems;
  });
}
```

**需要手动比较的情况**：

```javascript
// ⚠️ 1. 大对象更新 - 避免不必要的 setState
function LargeObject() {
  const [largeData, setLargeData] = useState({
    field1: 'value1',
    field2: 'value2',
    // ... 50 个字段
  });

  const updateField = (field, value) => {
    // ❌ 不优化：每次更新整个对象
    setLargeData(prev => ({ ...prev, [field]: value }));

    // ✅ 手动比较：只在值变化时更新
    setLargeData(prev => {
      if (prev[field] === value) {
        return prev;  // 值未变，返回原对象
      }
      return { ...prev, [field]: value };
    });
  };
}

// ⚠️ 2. 数组/列表更新 - 避免创建新数组
function LargeList() {
  const [items, setItems] = useState(Array(1000).fill(0));

  const updateOne = (index, value) => {
    // ❌ 不优化：map 总是创建新数组
    setItems(prev => prev.map((item, i) => i === index ? value : item));

    // ✅ 手动比较：值未变则不更新
    setItems(prev => {
      if (prev[index] === value) {
        return prev;  // 值未变
      }
      const newItems = [...prev];
      newItems[index] = value;
      return newItems;
    });
  };
}

// ⚠️ 3. 防止无限循环 - Effect 中更新状态
function InfiniteLoop() {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    // ❌ 问题：每次渲染都会触发新的 setState
    fetch('/api/data').then(data => {
      setData(data);
      setTrigger(t => t + 1);  // → 渲染 → Effect → 渲染 → 循环
    });
  }, [trigger]);

  // ✅ 解决方案：比较后更新
  useEffect(() => {
    fetch('/api/data').then(newData => {
      setData(prev => {
        if (Object.is(prev, newData)) {
          return prev;  // 数据相同
        }
        return newData;
      });
      setTrigger(t => t + 1);  // 只在数据变化时更新
    });
  }, [trigger]);
}

// ⚠️ 4. 性能关键场景 - 频繁更新
function PerformanceCritical() {
  const [state, setState] = useState({});

  const fastUpdate = (key, value) => {
    // ❌ 不优化：每次都重新渲染
    setState(prev => ({ ...prev, [key]: value }));

    // ✅ 手动比较：只在值变化时更新
    setState(prev => {
      if (prev[key] === value) {
        return prev;
      }
      const newState = { ...prev };
      newState[key] = value;
      return newState;
    });
  };
}
```

#### 5.2.5 手动比较的最佳实践

**1. 浅比较（推荐）**

```javascript
import { shallowEqual } from 'react-redux';

function Component({ data }) {
  const [state, setState] = useState(initialData);

  const update = (newData) => {
    // ✅ 使用浅比较
    if (shallowEqual(state, newData)) {
      return;  // 相同则跳过
    }
    setState(newData);
  };
}

// 自己实现浅比较
function shallowEqual(objA, objB) {
  if (Object.is(objA, objB)) return true;

  if (typeof objA !== 'object' || objA === null ||
      typeof objB !== 'object' || objB === null) {
    return false;
  }

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (!Object.is(objA[key], objB[key])) {
      return false;
    }
  }

  return true;
}
```

**2. 使用 immer 简化不可变更新 + 自动引用比较**

```javascript
import { produce } from 'immer';

function WithImmer() {
  const [state, setState] = useState({
    users: [{ id: 1, name: 'Alice' }],
    settings: { theme: 'dark', fontSize: 16 },
  });

  const updateUser = (id, newName) => {
    // ✅ immer 自动处理：
    // 1. 不可变更新
    // 2. 引用比较（如果没变化则返回原对象）
    setState(produce(draft => {
      const user = draft.users.find(u => u.id === id);
      if (user && user.name !== newName) {
        user.name = newName;  // 有变化 → 返回新对象
      }
      // 如果没找到或名称相同 → 返回原对象
    }));
  };
}
```

**3. 分离状态以利用自动 Bailout**

```javascript
// ❌ 不优化：大对象整体更新
function SingleState() {
  const [allState, setAllState] = useState({
    count: 0,
    user: null,
    items: [],
    // ... 更多字段
  });

  return <div onClick={() => setAllState({ ...allState, count: allState.count + 1 })}>
    {allState.count}
  </div>;
}

// ✅ 优化：拆分独立状态
function SplitState() {
  const [count, setCount] = useState(0);
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);

  // count 是简单值，React 自动比较
  // user/items 不变时不会影响 count 的渲染
  return <div onClick={() => setCount(c => c + 1)}>
    {count}
  </div>;
}
```

---

### 5.3 如何利用 Bailout

```javascript
// ❌ 不利于 Bailout
function Parent({ items }) {
  const [count, setCount] = useState(0);

  return (
    <div onClick={() => setCount(c => c + 1)}>
      <ExpensiveChild data={items} /> {/* items 变化时重新渲染 */}
    </div>
  );
}

// ✅ 有利于 Bailout
function Parent({ items }) {
  const [count, setCount] = useState(0);
  const expensiveData = useMemo(() => items, [items]); // 稳定引用

  return (
    <div onClick={() => setCount(c => c + 1)}>
      <ExpensiveChild data={expensiveData} /> {/* 引用不变，跳过渲染 */}
    </div>
  );
}
```

### 5.4 性能优化决策树

```
触发 setState/dispatch
        │
        ▼
  State 会改变吗？
        │
  ┌─────┴─────┐
  │           │
 YES          NO
  │           │
  │           ▼
  │      Object.is(old, new)?
  │      是否相等？
  │        │
  │   ┌─────┴─────┐
  │   │           │
  │  NO         YES
  │   │           │
  │   │           ▼
  │   │       Bailout ✅ 不渲染
  │   │
  │   ▼
  │  渲染组件
  │   │
  │   ▼
  │  是否是简单值？
  │   │
  │┌──┴──┐
  ││     │
 YES    NO
  │     │
  │     ▼
  │  是否需要避免渲染？
  │   │
  │┌──┴──┐
  ││     │
 NO    YES
  │     │
  │     ▼
  │  手动比较优化 ✅
  │
  ▼
正常流程 ✅
```

### 5.5 性能优化策略对比表

| 场景 | 自动 Bailout | 需要手动优化 | 推荐方案 |
|------|-------------|--------------|----------|
| **简单值更新（0→0）** | ✅ React 自动处理 | ❌ 不需要 | 直接 setState |
| **对象内容相同（引用不同）** | ❌ 仍会渲染 | ✅ 需要优化 | 手动比较 / 拆分状态 |
| **大对象更新** | ❌ 性能差 | ✅ 建议优化 | Immer / 拆分状态 |
| **数组单个元素更新** | ❌ 总是创建新数组 | ✅ 建议优化 | 手动比较 / immer |
| **Effect 中状态更新** | ❌ 可能无限循环 | ✅ 需要优化 | 比较后 setState |
| **Props 传递给子组件** | ✅ React.memo | ❌ 不需要 | React.memo + 浅比较 |
| **Context 值更新** | ✅ 自动比较 | ❌ 不需要 | 分离 context / useMemo |
| **性能关键组件** | ❌ 频繁更新 | ✅ 建议优化 | 手动比较 + React.memo |

### 5.6 关键要点总结

**React 自动处理的情况**：

1. ✅ **简单值相等**：`Object.is(oldState, newState) === true`
2. ✅ **Props 浅比较**：配合 `React.memo` 自动处理
3. ✅ **Context 值相同**：自动比较
4. ✅ **函数式更新批处理**：多个 setState 合并为一次

**需要手动处理的情况**：

1. ⚠️ **对象/数组内容相同但引用不同**：拆分状态或手动比较
2. ⚠️ **大对象/大数组更新**：使用 Immer 或拆分状态
3. ⚠️ **Effect 中的 setState 可能导致循环**：比较后更新
4. ⚠️ **性能关键场景**：手动比较 + React.memo

**推荐策略**：

```javascript
// 默认（推荐）
function Default() {
  const [count, setCount] = useState(0);
  setCount(0);  // React 自动处理
}

// 性能关键（优化）
function PerformanceCritical({ largeData }) {
  const [state, setState] = useState(largeData);

  const update = (field, value) => {
    setState(produce(draft => {  // 使用 Immer
      if (draft[field] !== value) {
        draft[field] = value;  // Immer 自动引用比较
      }
    }));
  };
}
```

---

---

## 6. Hooks 工作原理

### 6.1 Hooks 整体架构

#### 6.1.1 Dispatcher 模式（核心设计模式）

React 内部通过 **Dispatcher 模式** 来适配不同的渲染阶段。核心函数 `renderWithHooks` 会根据当前阶段切换不同的 Dispatcher 对象，为相同的 Hook API 提供不同的实现：

```javascript
// ReactFiberHooks.js
export function renderWithHooks(
  current: Fiber | null,
  workInProgress: Fiber,
  Component: Function,
  props: any,
  secondArg: any,
  nextRenderLanes: Lanes,
) {
  // 判断是 mount 还是 update 阶段
  ReactCurrentDispatcher.current =
    current === null || current.memoizedState === null
      ? HooksDispatcherOnMount   // 首次渲染
      : HooksDispatcherOnUpdate;  // 更新渲染

  // 执行函数组件，内部会调用 useState, useEffect 等
  let children = Component(props, secondArg);

  // 渲染完成后清理
  ReactCurrentDispatcher.current = ContextOnlyDispatcher;

  return children;
}
```

**三个 Dispatcher 对象**：

```javascript
// 首次挂载 - 所有 Hook 的 mount 实现
const HooksDispatcherOnMount = {
  useState: mountState,
  useEffect: mountEffect,
  useRef: mountRef,
  useMemo: mountMemo,
  useCallback: mountCallback,
  useReducer: mountReducer,
  useContext: readContext,
  // ...
};

// 更新阶段 - 所有 Hook 的 update 实现
const HooksDispatcherOnUpdate = {
  useState: updateState,
  useEffect: updateEffect,
  useRef: updateRef,
  useMemo: updateMemo,
  useCallback: updateCallback,
  useReducer: updateReducer,
  useContext: readContext,
  // ...
};

// 错误阶段 - 禁止在非渲染阶段调用 Hooks
const ContextOnlyDispatcher = {
  useState: throwInvalidHookError,
  useEffect: throwInvalidHookError,
  // ...
};
```

**为什么需要 Dispatcher 模式？**

```
首次渲染 (Mount):
  useState → mountState → 创建 Hook 对象、初始化状态
  useEffect → mountEffect → 注册 Effect、标记 Passive

更新渲染 (Update):
  useState → updateState → 读取已有状态、计算新值
  useEffect → updateEffect → 比较依赖、决定是否执行

非渲染阶段:
  useState → throwInvalidHookError → 报错！
```

**这让 React 能够在不同阶段提供不同的行为，而对外暴露完全相同的 API。**

#### 6.1.2 Hooks 与 Fiber 的关系

每个函数组件对应一个 Fiber 节点，该组件的所有 Hook 以**链表结构**存储在 `fiber.memoizedState` 上：

```javascript
// FunctionComponent 对应的 Fiber 节点
const fiber = {
  // ... 其他属性

  memoizedState: hook1,  // ↴ 指向第一个 Hook

  // ClassComponent:
  // memoizedState → state (组件状态)
  // FunctionComponent:
  // memoizedState → Hook 链表头节点
};
```

**Hook 链表示意图**：

```
fiber.memoizedState
       │
       ▼
   ┌────────┐      ┌────────┐      ┌────────┐      ┌────────┐
   │  Hook1 │─────▶│  Hook2 │─────▶│  Hook3 │─────▶│  Hook4 │─────▶ null
   │ (useState)│   │ (useEffect)│  │ (useRef) │   │ (useMemo)│
   │ memoized  │   │ memoized  │   │ memoized  │   │ memoized  │
   │ State: 0  │   │ EffectObj │   │ RefObj    │   │ memoized  │
   └────────┘      └────────┘      └────────┘      └────────┘
```

**Hook 会按调用顺序依次添加到链表中**。

#### 6.1.3 Hook 数据结构

```javascript
// 每个 Hook 的基本结构
const hook: Hook = {
  memoizedState: null,  // 缓存的状态值（因 Hook 类型而异）
  baseState: null,      // 基础状态
  baseQueue: null,      // 基础更新队列
  queue: null,          // 更新队列（存储 setState 的更新）
  next: null,           // 指向下一个 Hook
};
```

**不同类型的 Hook 如何存储 `memoizedState`：**

| Hook | `memoizedState` 存储内容 |
|------|-------------------------|
| `useState` | 当前状态值（如 `0`、`"hello"`） |
| `useEffect` | Effect 对象（`{create, destroy, deps, ...}`） |
| `useRef` | `{current: initialValue}` |
| `useMemo` | `[memoizedValue, nextDeps]` |
| `useCallback` | `[callback, nextDeps]` |
| `useReducer` | 当前 reducer 状态 |
| `useContext` | 不存储在链表中（通过 Fiber 依赖追踪） |

---

### 6.2 为什么 Hooks 必须按顺序调用？

这是 React Hooks 最重要的规则，原因深埋在实现细节中。

#### 链表的索引机制

React **不按名字来查找 Hook**，而是按**调用顺序**：

```javascript
// 正确做法 - 每次渲染顺序一致
function MyComponent() {
  const [count, setCount] = useState(0);       // Hook #1
  const [name, setName] = useState('Alice');   // Hook #2
  useEffect(() => {                            // Hook #3
    document.title = `${count} - ${name}`;
  }, [count, name]);
  // ...
}

// 错误做法 - 条件调用 Hook
function MyComponent() {
  const [count, setCount] = useState(0);       // Hook #1 → 下次渲染还是#1
  if (count > 0) {
    useEffect(() => { /* ... */ });            // 有时是#2，有时跳过
  }
  const ref = useRef(null);                    // 有时候是#2，有时候是#3 ❌
}
```

**当条件 Hook 导致顺序错乱时**：

```
第一次渲染:
  useState(0)     → Hook #1 (memoizedState = 0)
  useEffect(...)  → Hook #2 (memoizedState = effect)
  useRef(null)    → Hook #3 (memoizedState = {current: null})

第二次渲染 (count > 0, 条件满足):
  useState(0)     → 期望读取 Hook #1 ✅
  useEffect(...)  → 期望读取 Hook #2 ✅
  useRef(null)    → 期望读取 Hook #3 ✅

第二次渲染 (count === 0, 条件不满足):
  useState(0)     → 期望读取 Hook #1 ✅
  useRef(null)    → 期望读取 Hook #2 但拿到的是 Hook #2 的 effect 对象 ❌
                   → 错误：ref.current 被赋值为 effect 对象！
```

**副作用**：
- `useState` 读到错误的状态
- `useEffect` 的依赖比较使用错误的 deps
- `useRef` 拿到的是 effect 对象而不是 ref 对象
- 可能导致报错、状态错乱甚至无限循环

#### ESLint 规则

```json
// 使用 eslint-plugin-react-hooks 检测违规
{
  "plugins": ["react-hooks"],
  "rules": {
    "react-hooks/rules-of-hooks": "error",        // 检查调用顺序
    "react-hooks/exhaustive-deps": "warn"          // 检查依赖完整性
  }
}
```

---

### 6.3 useState 深入解析

#### 6.3.1 基本使用

```jsx
const [state, setState] = useState(initialValue);
```

#### 6.3.2 mountState - 首次挂载

```javascript
function mountState(initialState) {
  // 1. 创建当前 Hook 对象
  const hook = mountWorkInProgressHook();
  // hook 被添加到 fiber.memoizedState 链表末尾

  // 2. 初始化状态
  // 如果 initialState 是函数，执行它
  if (typeof initialState === 'function') {
    initialState = initialState();
  }

  hook.memoizedState = initialState;
  hook.baseState = initialState;

  // 3. 创建更新队列
  const queue = {
    pending: null,          // 环形链表，存放 update 对象
    dispatch: null,         // 指向 dispatchSetState
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;

  // 4. 创建 dispatch 函数（即 setState）
  const dispatch = (queue.dispatch = dispatchSetState.bind(
    null,
    currentlyRenderingFiber,
    queue,
  ));

  // 5. 返回 [state, setState]
  return [hook.memoizedState, dispatch];
}
```

**关键点**：
- `mountWorkInProgressHook` 创建 Hook 对象并添加到链表
- 初始状态如果是函数，React 会执行它（`useState(() => expensiveComputation())`）
- `setState` 是 `dispatchSetState` 的偏函数

#### 6.3.3 dispatchSetState - 状态更新触发

当调用 `setState(newValue)` 时：

```javascript
function dispatchSetState(fiber, queue, action) {
  // 1. 获取优先级 Lane
  const lane = requestUpdateLane(fiber);

  // 2. 创建 update 对象
  const update = {
    lane,                                     // 当前更新的优先级
    action,                                   // 新的状态值或更新函数
    hasEagerState: false,                     // 是否已计算新状态
    eagerState: null,                         // 预计算的状态
    next: null,                               // 指向下一个 update
  };

  // 3. 检查是否在 Render 阶段调用 setState
  if (fiber === currentlyRenderingFiber) {
    // ⚠️ 在渲染过程中调用了 setState!
    // 这是一个 "Render Phase Update"
    didScheduleRenderPhaseUpdateDuringThisPass = true;
    const pending = queue.pending;
    if (pending === null) {
      update.next = update;          // 第一个 update，自引用形成环
    } else {
      update.next = pending.next;
      pending.next = update;         // 追加到环形链表末尾
    }
    queue.pending = update;
  } else {
    // ✅ 正常情况，在事件处理器或 useEffect 中调用

    // 3a. 尝试"急切"计算 - 如果 queue 为空且没有其他 pending update
    if (
      fiber.lanes === NoLanes &&
      (alternate === null || alternate.lanes === NoLanes)
    ) {
      const currentState = queue.lastRenderedState;
      const eagerState = action;   // 这里可能需要执行 action 函数

      // 如果能提前计算出新状态
      if (Object.is(eagerState, currentState)) {
        // 优化：状态未变化，直接返回，跳过调度
        update.hasEagerState = true;
        update.eagerState = eagerState;
        // 不需要调度更新！
        return;
      }
    }

    // 3b. 添加到更新队列
    const pending = queue.pending;
    if (pending === null) {
      update.next = update;
    } else {
      update.next = pending.next;
      pending.next = update;
    }
    queue.pending = update;

    // 3c. 通知 React 调度器安排更新
    scheduleUpdateOnFiber(fiber, lane, eventTime);
  }
}
```

**关键点**：

> 💡 **关于状态比较和 Bailout**：
>
> `dispatchSetState` **不会**在这里比较新旧状态。
> 状态比较发生在 Render 阶段的 `updateReducer` 中。
> 
> **完整流程**：
> 1. dispatchSetState → 创建 update → 添加到队列 → 调度更新
> 2. Render 阶段 → updateReducer 计算新状态 → **Object.is(old, new)**
> 3. Reconciliation 阶段 → 比较 Fiber → 决定是否 Bailout
> 
> **详细内容见第 5 节 Bailout 优化机制**：`setState 后的完整流程`

#### 6.3.4 更新队列的数据结构 - 环形链表

React 用**环形链表**来管理更新队列：

```javascript
// 初始状态
queue.pending = null  // 没有 pending 更新

// 添加第一个 update
queue.pending = update1
update1.next = update1  // 指向自己，形成环
// ┌───────────┐
// │  update1  │────┐
// └───────────┘◄───┘

// 添加第二个 update
queue.pending = update2
update2.next = update1  // update2.next → update1
update1.next = update2  // update1.next → update2
// ┌───────────┐     ┌───────────┐
// │  update1  │◄───▶│  update2  │──pending
// └───────────┘     └───────────┘

// 添加第三个 update
queue.pending = update3  // pending 始终指向最新添加的 update
update3.next = update1   // 新 update.next → 队列第一个
update2.next = update3   // 前一个 update.next → 新 update
// ┌───────────┐     ┌───────────┐     ┌───────────┐
// │  update1  │◄──▶│  update3  │◄──▶│  update2  │
// └───────────┘     └───────────┘     └───────────┘
//      ↑                               ↑
//  第一个update                     pending(最新)
```

**为什么是环形？**

环形链表使得从 `pending` 可以快速访问到第一个和最后一个 update：
- `pending.next` → 第一个 update
- `pending` → 最后一个 update

这在处理更新队列时非常高效。

#### 6.3.5 updateState - 更新阶段

```javascript
function updateState(initialState) {
  // useState 实际上是 useReducer 的特殊情况
  return updateReducer(basicStateReducer, initialState);
}

function basicStateReducer(state, action) {
  // 如果 action 是函数，执行它并返回结果
  // 否则直接返回 action 作为新状态
  return typeof action === 'function' ? action(state) : action;
}

function updateReducer(reducer, initialArg) {
  // 1. 获取当前 Hook
  const hook = updateWorkInProgressHook();
  const queue = hook.queue;

  // pending 状态在上次 commit 后可能变了
  queue.lastRenderedReducer = reducer;

  const current = currentHook;

  // 2. 合并更新队列
  let baseQueue = queue.baseQueue;
  const pendingQueue = queue.pending;

  if (pendingQueue !== null) {
    // 2a. 将 pending 链表拼接到 baseQueue 末尾
    if (baseQueue !== null) {
      const baseFirst = baseQueue.next;
      const pendingFirst = pendingQueue.next;
      baseQueue.next = pendingFirst;
      pendingQueue.next = baseFirst;
    }
    baseQueue = pendingQueue;
    queue.baseQueue = pendingQueue;
    queue.pending = null;  // 清空 pending
  }

  // 3. 如果有更新要处理
  if (baseQueue !== null) {
    const first = baseQueue.next;
    let newState = hook.baseState;

    let newBaseState = null;
    let newBaseQueueFirst = null;
    let newBaseQueueLast = null;

    // 3a. 遍历所有 update 并执行
    let update = first;
    do {
      const updateLane = update.lane;
      // 根据优先级判断是否跳过某些更新
      if (!isSubsetOfLanes(renderLanes, updateLane)) {
        // 优先级不够，跳过此 update
        const clone = { ...update };
        if (newBaseQueueLast === null) {
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        // 优先级够，执行更新
        if (newBaseQueueLast !== null) {
          const clone = { ...update };
          newBaseQueueLast.next = clone;
          newBaseQueueLast = clone;
        }
        // 执行 action
        newState = reducer(newState, update.action);
      }
      update = update.next;
    } while (update !== null && update !== first);

    // 3b. 更新 hook 状态
    hook.memoizedState = newState;
    hook.baseState = newBaseState;
    hook.baseQueue = newBaseQueueLast;
    queue.lastRenderedState = newState;
  }

  // 4. 返回新状态和 dispatch
  return [hook.memoizedState, queue.dispatch];
}
```

#### 6.3.6 批量更新机制

React 18 引入**自动批处理**（Automatic Batching），多个 `setState` 合并为一次重新渲染：

```javascript
// React 17 - 不会批处理
function handleClick() {
  setCount(c => c + 1);  // 立即触发一次渲染
  setFlag(f => !f);       // 立即触发另一次渲染
  // 结果：2 次渲染
}

// React 18 - 自动批处理（所有情况都批处理）
function handleClick() {
  setCount(c => c + 1);  //
  setFlag(f => !f);       // 合并为一次更新
  setName('Alice');        // → 1 次渲染
}

// 即使在 setTimeout, Promise 中也会批处理
setTimeout(() => {
  setCount(c => c + 1);  //
  setFlag(f => !f);       // React 18: 1 次渲染
}, 1000);
```

**内部实现**：

```javascript
// 当执行 setState 时，不会立即渲染
// 而是先收集所有更新
// 等到当前执行上下文结束后，统一渲染

// 可以用 flushSync 强制立即渲染
import { flushSync } from 'react-dom';

flushSync(() => {
  setCount(c => c + 1);   // 立即渲染
});
flushSync(() => {
  setFlag(f => !f);        // 再次立即渲染
});
// 结果：2 次渲染
```

#### 6.3.7 实战示例：计数器组件

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('');

  const increment = () => {
    // ✅ 批处理：虽然调用了 3 次 setCount，但只触发 1 次渲染
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
    // 结果：count 只加了 1（因为每次用的都是闭包中的旧值）
  };

  const incrementCorrectly = () => {
    // ✅ 使用函数形式可以正确累加
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
    // 结果：count 加了 3
  };

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={incrementCorrectly}>+ （函数式）</button>
      <input value={name} onChange={e => setName(e.target.value)} />
    </div>
  );
}
```

---

### 6.4 useEffect 深入解析

#### 6.4.1 基本使用

```jsx
useEffect(() => {
  // create 函数 - 执行副作用
  doSomething();

  return () => {
    // destroy 函数 - 清理副作用
    cleanup();
  };
}, [dep1, dep2]); // 依赖数组
```

#### 6.4.2 Effect 对象结构

```javascript
const effect = {
  tag: flags,           // Effect 类型标记
  create: create,      // 用户传入的副作用函数
  destroy: destroy,    // 清理函数
  deps: deps,          // 依赖数组
  next: effect,        // 指向下一个 Effect（形成链表）
};
```

**`tag` 标记的含义**：

```javascript
// 副作用标记
export const HookPassive = 0b000000001;        // useEffect（被动）
export const HookLayout = 0b000000010;         // useLayoutEffect
export const HookHasEffect = 0b000000100;      // 有 Effect 需要执行

// 组合标记
const PassiveEffect = HookPassive | HookHasEffect;  // 需要执行的 useEffect
const LayoutEffect = HookLayout | HookHasEffect;    // 需要执行的 useLayoutEffect
```

#### 6.4.3 mountEffect - 首次挂载

```javascript
function mountEffect(create, deps) {
  // 获取当前 Hook
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 创建当前 Hook 的 Effect
  hook.memoizedState = pushEffect(
    HookHasEffect | HookPassive,  // 标记：需要执行 + 被动
    create,                        // 创建函数
    undefined,                     // 销毁函数（尚未执行）
    nextDeps                     // 依赖数组
  );

  // pushEffect 将 Effect 添加到 fiber.updateQueue 链表
  // 同时返回 Effect 对象存入 hook.memoizedState
}
```

#### 6.4.4 pushEffect - Effect 链表构建

```javascript
function pushEffect(tag, create, destroy, deps) {
  const effect = {
    tag,
    create,
    destroy,
    deps,
    next: null,
  };

  // 获取 fiber 上的 UpdateQueue
  const componentUpdateQueue = currentlyRenderingFiber.updateQueue;

  if (componentUpdateQueue === null) {
    // 第一个 Effect，创建环形链表
    componentUpdateQueue = createFunctionComponentUpdateQueue();
    componentUpdateQueue.lastEffect = effect;
    effect.next = effect;  // 自引用形成环
  } else {
    // 追加到环形链表末尾
    const lastEffect = componentUpdateQueue.lastEffect;
    const firstEffect = lastEffect.next;
    Effect.next = firstEffect;
    lastEffect.next = effect;
    componentUpdateQueue.lastEffect = effect;
  }

  return effect;
}
```

**Effect 链表结构**：

```
fiber.updateQueue.lastEffect
       │
       ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │ Effect1 │─────▶│ Effect2 │─────▶│ Effect3 │
   │ (useEffect) │  │ (useEffect) │  │useLayoutEffect│
   │ Passive │     │ Passive │     │  Layout │
   │ HasEffect│     │ HasEffect│     │ HasEffect│
   └─────────┘      └─────────┘      └─────────┘
       ▲                                  │
       └──────────────────────────────────┘
                   （环形链表）
```

**注意**：
- `fiber.memoizedState` 存储 Hook 链表
- `fiber.updateQueue` 存储 Effect 链表
- Hook 的 `memoizedState` 指向对应的 Effect 对象
- Effect 链表是环形结构，`lastEffect.next` 指向第一个 Effect

#### 6.4.5 updateEffect - 更新阶段

```javascript
function updateEffect(create, deps) {
  // 获取当前 Hook
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 清理旧的 destroy 函数
  const destroy = undefined;

  // 比较依赖
  if (currentHook !== null) {
    const prevEffect = currentHook.memoizedState;
    destroy = prevEffect.destroy;

    if (nextDeps !== null) {
      const prevDeps = prevEffect.deps;

      // 依赖比较
      if (areHookInputsEqual(nextDeps, prevDeps)) {
        // 依赖没变，只更新 deps，不标记 HookHasEffect
        // 这样在 commit 阶段会跳过此 Effect
        pushEffect(HookPassive, create, destroy, nextDeps);
        return;
      }
    }
  }

  // 依赖变了，标记需要执行
  hook.memoizedState = pushEffect(
    HookHasEffect | HookPassive,
    create,
    destroy,
    nextDeps,
  );
}
```

**依赖比较 `areHookInputsEqual`**：

```javascript
function areHookInputsEqual(nextDeps, prevDeps) {
  if (prevDeps === null) return null;

  // 使用 Object.is 逐个比较（类似 === 但处理 NaN）
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}
```

**⚠️ 引用比较**：

```javascript
// ❌ 每次渲染创建新对象，导致无限循环
useEffect(() => {
  fetch('/api/data', options);
}, [{ method: 'GET' }]); // 每次都是新对象，总是触发性

// ✅ 使用稳定引用
const options = useMemo(() => ({ method: 'GET' }), []);
useEffect(() => {
  fetch('/api/data', options);
}, [options]);
```

#### 6.4.6 Commit 阶段的 Effect 执行

Effect 在 **Commit 阶段** 的不同时机执行：

```
Render 阶段 (可中断)
      ↓
Commit 阶段 (同步)
      ├── before mutation
      │     └── 处理 useEffectEvent 绑定
      │
      ├── mutation (DOM 操作)
      │     └── 执行 Effect 的 destroy 函数
      │     │    (清理上一个 Effect)
      │     └── Class: componentWillUnmount
      │
      ├── layout (DOM 已更新)
      │     ├── 执行 useLayoutEffect
      │     ├── Class: componentDidMount/Update
      │     └── 设置 ref
      │
      └── passive effects (异步，下一帧)
            └── 执行 useEffect 的 create 函数
                 (所有 useEffect 在此阶段执行)
```

**为什么 useEffect 在下一帧执行？**

```javascript
// useEffect 的执行不会阻塞浏览器绘制
// 保证用户交互的流畅性

// 内部实现
if (rootDoesHavePassiveEffects) {
  // 通过调度器安排在"下一帧"执行
  scheduleCallback(NormalPriority, () => {
    // 执行所有标记了 HookHasEffect 的 Passive Effect
    flushPassiveEffects();
  });
}
```

**执行顺序**：

```javascript
function Counter() {
  useEffect(() => {
    console.log('useEffect create A');
    return () => console.log('useEffect destroy A');
  }, [count]);

  useEffect(() => {
    console.log('useEffect create B');
    return () => console.log('useEffect destroy B');
  }, [count]);

  useLayoutEffect(() => {
    console.log('useLayoutEffect C');
    return () => console.log('useLayoutEffect destroy C');
  }, [count]);

  return <div>{count}</div>;
}

// 首次挂载时输出：
// useLayoutEffect C       (Layout 阶段)
// useEffect create A       (被动阶段)
// useEffect create B

// count 变化时输出：
// useEffect destroy A      (mutation 阶段)
// useEffect destroy B
// useLayoutEffect destroy C (layout 阶段)
// useLayoutEffect C
// useEffect create A       (被动阶段)
// useEffect create B
```

#### 6.4.7 清理函数机制

```javascript
function Example() {
  const [id, setId] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchData(id);
    }, 1000);

    // 返回清理函数
    return () => {
      clearInterval(timer);  // 清除定时器
    };
  }, [id]);
}
```

**执行时机**：

```
挂载:    create()
更新前:  destroy(旧) → create(新)
卸载:    destroy()
```

**注意**：清理函数不仅会在卸载时执行，**每次重新运行 Effect 前也会执行**，这能有效防止内存泄漏。

#### 6.4.8 常见错误模式

```javascript
// ❌ 依赖数组为空，但引用了外部变量
function BadExample({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    // userId 来自外部，但 deps 为空
    // userId 变化时不会重新获取
    fetch(`/api/users/${userId}`).then(setUser);
  }, []);

  return <div>{user?.name}</div>;
}

// ✅ 正确：添加所有依赖
function GoodExample({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch(`/api/users/${userId}`).then(setUser);
  }, [userId]); // 依赖了 userId

  return <div>{user?.name}</div>;
}

// ❌ 使用 object 作为依赖
function BadDeps({ config }) {
  useEffect(() => {
    fetch('/api/data', config);
  }, [config]); // config 每次都是新对象 → 死循环

  // ✅ 如果 config 结构稳定，使用具体字段
  useEffect(() => {
    fetch('/api/data', { method: config.method });
  }, [config.method]);
}
```

#### 6.4.9 useLayoutEffect - 同步执行的副作用

**问题：为什么不仅 useEffect 一个 Hook？**

`useEffect` 是**异步**执行的（在浏览器绘制后），这能保证用户体验流畅，但某些场景需要**同步**访问 DOM：

```javascript
// ❌ useEffect 的问题：闪烁！
function ScrollToTop() {
  useEffect(() => {
    window.scrollTo(0, 0);  // 在浏览器绘制后才执行
  }, []);

  return <div>内容高度超过一屏</div>;
}

// 渲染过程：
// 1. React 渲染组件到虚拟 DOM
// 2. 浏览器绘制页面 → 用户看到内容（在顶部）
// 3. useEffect 执行 window.scrollTo(0, 0)
// 4. 页面突然滚动到顶部 → 闪烁！
```

**useLayoutEffect 的执行时机**：

```
┌────────────────────────────────────────────────────────────┐
│ Render 阶段 (可中断)                                        │
│   构建 workInProgress 树，标记 Effect                       │
└────────────────────────────────────────────────────────────┘
                            ↓
┌────────────────────────────────────────────────────────────┐
│ Commit 阶段 (同步，不可中断)                                 │
│                                                            │
│  1. before mutation                                        │
│     └── 处理 useEffectEvent 绑定                           │
│                                                            │
│  2. mutation (DOM 操作)                                    │
│     └── 清理上一个 Effect 的 destroy 函数                  │
│                                                            │
│  3. layout ← useLayoutEffect 在这里执行！                  │
│     └── 执行 useLayoutEffect 的 create 函数               │
│     └── 同步执行，阻塞浏览器绘制                           │
│     └── DOM 已更新，布局已计算                            │
│     └── 此时访问 DOM、测量尺寸都安全                       │
│                                                            │
│  4. 浏览器绘制                                             │
│     └── 用户看到最终结果                                   │
│                                                            │
│  5. passive effects (下一帧，异步)                         │
│     └── 执行 useEffect 的 create 函数                     │
└────────────────────────────────────────────────────────────┘
```

**useLayoutEffect 内部实现**：

```javascript
// 几乎与 useEffect 相同，唯一区别是 tag 标记

function mountLayoutEffect(create, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 使用 HookLayout 标记（同步执行）
  hook.memoizedState = pushEffect(
    HookHasEffect | HookLayout,  // ← 不同点：使用 HookLayout
    create,
    undefined,
    nextDeps,
  );
}

function updateLayoutEffect(create, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const prevEffect = currentHook.memoizedState;
  const prevDeps = prevEffect.deps;

  if (nextDeps !== null) {
    if (areHookInputsEqual(nextDeps, prevDeps)) {
      return;  // 依赖没变，跳过
    }
  }

  // 标记需要执行
  hook.memoizedState = pushEffect(
    HookHasEffect | HookLayout,
    create,
    prevEffect.destroy,
    nextDeps,
  );
}
```

**关键区别**：

| 特性 | useEffect | useLayoutEffect |
|------|-----------|-----------------|
| **执行时机** | 浏览器绘制后（异步） | 浏览器绘制前（同步） |
| **是否阻塞绘制** | 否 | 是 |
| **适用场景** | 数据获取、日志、分析 | DOM 测量、同步动画 |
| **性能影响** | 低（不阻塞） | 高（可能阻塞渲染） |
| **浏览器绘制** | 立即看到结果，后执行 Effect | 先执行 Effect，后看到结果 |

**useLayoutEffect 典型使用场景**：

```javascript
// 1. DOM 测量（必须同步）
function MeasureComponent() {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    // 此时 DOM 已更新，布局已计算
    // 可以立即读取 offsetHeight
    setHeight(ref.current.offsetHeight);
  }, []);

  return (
    <div ref={ref}>
      <p>高度: {height}px</p>
      {/* 内容 */}
    </div>
  );
}

// 2. 滚动位置恢复（必须同步）
function Chat() {
  const messagesEndRef = useRef(null);

  useLayoutEffect(() => {
    // 新消息到来后立即滚动到底部
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  }, [messages]);

  return (
    <div>
      {messages.map(msg => <div key={msg.id}>{msg.text}</div>)}
      <div ref={messagesEndRef} />
    </div>
  );
}

// 3. 阻止闪烁（必须同步）
function PreventFlash({ shouldHide }) {
  useLayoutEffect(() => {
    // 在浏览器绘制前就完成显示/隐藏逻辑
    // 用户看不到过渡状态
    if (shouldHide) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [shouldHide]);

  return <div>内容</div>;
}

// 4. 自定义 Modal、Popover（同步定位）
function Popover({ target, visible }) {
  useLayoutEffect(() => {
    if (visible && target) {
      // 立即计算位置，用户看不到定位过程
      const rect = target.getBoundingClientRect();
      setPosition({ top: rect.bottom, left: rect.left });
    }
  }, [visible, target]);

  return visible ? <div style={position}>弹窗内容</div> : null;
}
```

**❌ useLayoutEffect 的常见误用**：

```javascript
// ❌ 数据获取（不需要阻塞绘制）
function UserProfile() {
  useLayoutEffect(() => {
    fetch('/api/user').then(setUser);  // 数据请求不该阻塞绘制
  }, []);

  // ✅ 使用 useEffect
  useEffect(() => {
    fetch('/api/user').then(setUser);
  }, []);
}

// ❌ 订阅外部服务（不需要同步）
function Chat({ roomId }) {
  useLayoutEffect(() => {
    const socket = connect(roomId);
    return () => socket.disconnect();
  }, [roomId]);

  // ✅ 使用 useEffect
  useEffect(() => {
    const socket = connect(roomId);
    return () => socket.disconnect();
  }, [roomId]);
}

// ❌ 搜索日志/分析（不需要同步）
function Button() {
  useLayoutEffect(() => {
    logEvent('Button mounted');  // 日志不该阻塞绘制
  }, []);

  // ✅ 使用 useEffect
  useEffect(() => {
    logEvent('Button mounted');
  }, []);
}
```

**⚠️ useLayoutEffect 在 SSR 中的问题**：

```javascript
// ❌ 问题：SSR 时会警告
function Component() {
  useLayoutEffect(() => {
    // SSR 环境没有 document，这行代码会报错
    document.title = 'Hello';
  }, []);
}

// ✅ 解决方案 1：检查浏览器环境
function Component() {
  if (typeof window !== 'undefined') {
    useLayoutEffect(() => {
      document.title = 'Hello';
    }, []);
  }
}

// ✅ 解决方案 2：使用 useEffect（兼容 SSR）
function Component() {
  useEffect(() => {
    document.title = 'Hello';
  }, []);
}
```

**何时选择 useLayoutEffect vs useEffect？**

```
决策流程：
1. 需要 DOM 尺寸/位置？ → useLayoutEffect
2. 需要同步动画避免闪烁？ → useLayoutEffect
3. 需要立即滚动到特定位置？ → useLayoutEffect
4. 数据获取、API 调用？ → useEffect
5. 订阅外部事件？ → useEffect
6. 日志、分析？ → useEffect
7. 默认选择：优先 useEffect，必要时才用 useLayoutEffect
```

---

#### 6.4.10 useEffectEvent - 从 Effect 中提取事件逻辑（React 19.2+）

**问题：Effect 的依赖困境**

```javascript
function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  useEffect(() => {
    function onMessage(msg) {
      // ❌ 问题：onMessage 内部使用了 theme
      // 但 theme 不在 deps 中（因为它是常量字符串）
      // 或者 theme 在 deps 中，导致每次 theme 变化都重新订阅
      showNotification(`新消息: ${msg.text}`, theme);
    }

    const connection = connect(roomId, { onMessage });

    return () => connection.disconnect();
  }, [roomId]); // theme 没有在 deps 中

  // 问题 1: 每次 theme 变化，通知样式不会更新（使用旧 theme）
  // 问题 2: 如果把 theme 加到 deps，每次主题切换都会断开重连
}
```

**传统解决方案及其问题**：

```javascript
// ❌ 方案 1: 把 theme 加到 deps（过度重新渲染）
useEffect(() => {
  function onMessage(msg) {
    showNotification(`新消息: ${msg.text}`, theme);
  }

  const connection = connect(roomId, { onMessage });
  return () => connection.disconnect();
}, [roomId, theme]); // ✅ theme 变化时通知样式更新
                        // ❌ 但主题切换时会断开重连（开销大）

// ❌ 方案 2: useRef 保存 theme（样板代码）
function ChatRoom({ roomId, theme }) {
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;  // 每次 theme 变化都同步
  }, [theme]);

  useEffect(() => {
    function onMessage(msg) {
      // 总是读取最新的 theme
      showNotification(`新消息: ${msg.text}`, themeRef.current);
    }

    const connection = connect(roomId, { onMessage });
    return () => connection.disconnect();
  }, [roomId]);  // ✅ 不会因 theme 变化重连
                      // ❌ 但需要额外的 useEffect 来同步 ref
}

// ❌ 方案 3: useCallback（仍有样板代码）
function ChatRoom({ roomId, theme }) {
  const handleNotification = useCallback((msg) => {
    showNotification(`新消息: ${msg.text}`, theme);
  }, [theme]);  // theme 变化时函数会变

  useEffect(() => {
    const onMessage = handleNotification;
    const connection = connect(roomId, { onMessage });
    return () => connection.disconnect();
  }, [roomId, handleNotification]);  // ❌ 还是会重新订阅
}
```

**useEffectEvent - 完美解决方案**：

```javascript
import { useEffect, useEffectEvent } from 'react';

function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  // ✅ useEffectEvent: 不参与依赖比较的"事件处理函数"
  const onMessage = useEffectEvent((msg: Message) => {
    // ✅ 总是能读取到最新的 theme
    // ✅ 但不影响外部 Effect 的依赖
    showNotification(`新消息: ${msg.text}`, theme);
  });

  useEffect(() => {
    const connection = connect(roomId, {
      onMessage: (msg) => onMessage(msg)  // 调用 useEffectEvent 函数
    });

    return () => connection.disconnect();
  }, [roomId]);  // ✅ 依赖只有 roomId
               // ✅ theme 变化时不会重新订阅
               // ✅ 但通知时总是使用最新 theme
}
```

**useEffectEvent 的特点**：

1. **不是 Hook** - 不是真正的 Hook，只是一个普通函数
2. **总是返回最新闭包** - 内部函数总是能访问最新的 props/state
3. **不参与依赖比较** - 不会被添加到 useEffect 的 deps 中
4. **在 Effect 外部调用** - 读取数据的逻辑与 Effect 的生命周期解耦

**内部实现原理（简化版）**：

```javascript
// useEffectEvent 的核心思想
function useEffectEvent(handler) {
  // useEffectEvent 本质上就是一个返回函数的函数
  // 返回的函数可以访问最新的作用域变量

  // React 内部实现：
  // 1. 将 handler 包装在 Ref 中
  // 2. 每次渲染时更新 Ref.current
  // 3. 返回一个总是调用 Ref.current 的函数

  const ref = useRef(handler);

  useEffect(() => {
    ref.current = handler;  // 每次渲染更新 ref
  });

  // 返回一个函数，调用时总是执行最新的 handler
  return useCallback((...args) => ref.current(...args), []);
}
```

**实际 React 实现（更高效）**：

```javascript
// React 内部实现简化示意
// ReactFiberHooks.js

function useEffectEvent(fn) {
  // React 19.2 的实际实现更复杂
  // 利用 React 的内部机制直接创建一个"事件对象"

  // 事件对象包含两个关键属性：
  // 1. _current: 当前最新的 handler
  // 2. fn: 包装后的函数，总是调用 _current

  const event = {
    _current: fn,
    fn: function(...args) {
      return event._current(...args);
    },
  };

  // 在渲染时更新 _current
  // （这部分由 React 自动处理）
  return event.fn;
}

// 每次组件重新渲染时，React 会自动更新 event._current
// 但 event.fn 的引用永远不变
```

**useEffectEvent 的执行流程**：

```
组件首次渲染:
  1. onMessage = useEffectEvent(handler_v1)
     → event._current = handler_v1
     → 返回 event.fn (总是调用 event._current)

  2. useEffect(() => {...}, [roomId])
     → 记录依赖: [roomId]

  3. onMessage() 内部调用 event.fn
     → event.fn() → event._current() → handler_v1()

组件重新渲染（theme 变化）:
  1. onMessage = useEffectEvent(handler_v2)  // theme 变化了
     → 更新 event._current = handler_v2
     → 返回同一个 event.fn

  2. useEffect deps 仍然是 [roomId]
     → 依赖没变，跳过 Effect 重新执行

  3. onMessage() 内部调用 event.fn
     → event.fn() → event._current() → handler_v2()  // 使用最新 handler
```

**useEffectEvent 的真实应用场景**：

```javascript
// 场景 1: 通知系统
function NotificationSystem({ messages, theme }) {
  const onNewMessage = useEffectEvent((message) => {
    // 总是使用最新主题显示通知
    showNotification(message, theme);
  });

  useEffect(() => {
    const subscription = subscribeToMessages(onNewMessage);
    return () => subscription.unsubscribe();
  }, []);  // 空 deps，不会因 theme 变化重新订阅

  return <MessagesList messages={messages} />;
}

// 场景 2: 日志记录
function AnalyticsButton({ onClick, userId, deviceId }) {
  const handleClick = useEffectEvent((event) => {
    onClick(event);  // 执行原始 onClick
    // 使用最新的 userId 和 deviceId
    analytics.track('button_click', { userId, deviceId });
  });

  useEffect(() => {
    const btn = document.getElementById('analytics-btn');
    btn.addEventListener('click', handleClick);
    return () => btn.removeEventListener('click', handleClick);
  }, []);  // 不因 userId/deviceId 变化重新绑定事件

  return <button id="analytics-btn">点击</button>;
}

// 场景 3: WebSocket 消息处理
function LiveTicker({ symbol, currency }) {
  const onPriceUpdate = useEffectEvent((price) => {
    // 总是使用最新的货币显示价格
    updateDisplay(`${symbol}: ${price.toFixed(2)} ${currency}`);
  });

  useEffect(() => {
    const ws = connectToTicker(symbol, (price) => {
      onPriceUpdate(price);  // 调用事件函数
    });

    return () => ws.disconnect();
  }, [symbol]);  // currency 变化不会重连 WebSocket

  return <div id="ticker-display">...</div>;
}

// 场景 4: 表单验证
function FormWithValidation({ onSubmit, rules }) {
  const handleSubmit = useEffectEvent((event) => {
    event.preventDefault();

    // 使用最新的 rules 验证
    const isValid = validateForm(event.target, rules);

    if (isValid) {
      onSubmit(new FormData(event.target));
    }
  });

  useEffect(() => {
    const form = document.getElementById('my-form');
    form.addEventListener('submit', handleSubmit);
    return () => form.removeEventListener('submit', handleSubmit);
  }, []);  // 不因 rules 变化重新绑定

  return <form id="my-form">...</form>;
}
```

**useEffectEvent 的最佳实践**：

```javascript
// ✅ 正确：用于事件处理函数
function Component({ value, onChange }) {
  const handleChange = useEffectEvent((event) => {
    onChange(event.target.value, value);  // value 可以是最新值
  });

  useEffect(() => {
    const input = document.getElementById('my-input');
    input.addEventListener('change', handleChange);
    return () => input.removeEventListener('change', handleChange);
  }, []);  // value 变化不会重新绑定
}

// ❌ 错误：不应该用于 Effect 主逻辑
function Component({ userId }) {
  const fetchData = useEffectEvent(() => {
    // ❌ 这不应该用 useEffectEvent
    // fetchData 应该直接写在 useEffect 中
    fetch(`/api/users/${userId}`).then(setUser);
  });

  useEffect(() => {
    fetchData();  // ❌ fetchData 不应该在 useEffect 中
  }, []);
}

// ✅ 正确：事件函数作为参数传递
function Chat({ roomId, onMessage }) {
  const handleMessage = useEffectEvent((msg) => {
    // 使用最新的 onMessage 处理器
    onMessage(msg);
  });

  useEffect(() => {
    const connection = connect(roomId, {
      onMessage: handleMessage
    });
    return () => connection.disconnect();
  }, [roomId]);
}
```

**useEffectEvent 与 React Compiler 的关系**：

```javascript
// React 19 的 React Compiler 能自动优化许多情况
function Component({ userId, theme }) {
  useEffect(() => {
    const handler = (msg) => {
      // React Compiler 可能能识别这里需要 theme
      // 自动添加必要的优化
      showNotification(msg, theme);
    };

    connect(userId, { handler });
  }, [userId, theme]);  // Compiler 仍可能需要这个 deps

  // 但 useEffectEvent 提供了显式、可读的解耦方式
  // 更符合人类思维：事件逻辑与 Effect 生命周期分离
}
```

**useEffectEvent vs 其他解决方案对比**：

| 方案 | 优点 | 缺点 |
|------|------|------|
| **useEffectEvent** | ✅ 语义清晰、无样板代码、性能最优 | ⚠️ React 19.2+ 才支持 |
| **useRef + useEffect** | ✅ 兼容性好、性能好 | ❌ 样板代码多、需要手动同步 |
| **useCallback** | ✅ 官方 API | ❌ 仍会触发 Effect 重新执行（如果函数变化） |
| **过度依赖 deps** | ✅ 简单直接 | ❌ 不必要的 Effect 重新执行、性能差 |

**何时使用 useEffectEvent**：

```
✅ 应该使用：
1. Effect 中的事件处理函数需要读取最新的 props/state
2. 不希望因 props/state 变化而重新绑定事件
3. 回调函数需要访问"渲染时"的变量，但 Effect 本身不应重新执行
4. 日志、通知、分析等"观察者"模式

❌ 不应该使用：
1. Effect 的主逻辑（数据获取、订阅等）应该直接写在 useEffect 中
2. useEffectEvent 不是 Hook，不能在其他 Hooks 中调用
3. useEffectEvent 返回的函数不是真正的"稳定"引用（内部实现细节）
4. 纯计算场景应该用 useMemo/useCallback
```

**总结：useLayoutEffect vs useEffectEvent**

| 特性 | useLayoutEffect | useEffectEvent |
|------|-----------------|-----------------|
| **目的** | 同步副作用，访问 DOM | 从 Effect 中提取事件逻辑 |
| **执行时机** | 布局计算后、绘制前 | 在 Effect 内部调用 |
| **依赖管理** | 正常使用 deps | 不参与依赖比较 |
| **React 版本** | React 16.8+ | React 19.2+ |
| **典型用途** | DOM 测量、同步动画 | 事件处理、避免闭包陷阱 |
| **性能影响** | 可能阻塞绘制 | 无额外性能影响 |

---

---

### 6.5 useRef 深入解析

#### 6.5.1 基本使用

```jsx
const ref = useRef(initialValue);
// ref.current === initialValue
```

#### 6.5.2 mountRef - 首次挂载

```javascript
function mountRef(initialValue) {
  const hook = mountWorkInProgressHook();

  // ref 只是一个包含 current 属性的对象
  const ref = { current: initialValue };

  // 存储在 Hook 的 memoizedState 中
  hook.memoizedState = ref;

  return ref;
}
```

#### 6.5.3 updateRef - 更新阶段

```javascript
function updateRef(initialValue) {
  const hook = updateWorkInProgressHook();

  // 直接返回已有的 ref 对象
  // 不比较依赖，不计算新值
  return hook.memoizedState;
}
```

#### 6.5.4 Ref 为什么是 "逃逸口"？

`useRef` 的行为与 `useState` 最大的不同：**修改 `ref.current` 不会触发重新渲染**。

```javascript
function Example() {
  const countRef = useRef(0);
  const [count, setCount] = useState(0);

  function increment() {
    countRef.current += 1;  // ✅ 不会重新渲染
    setCount(count + 1);    // ✅ 会重新渲染
  }

  // ref 适合存储"不需要渲染"的值:
  // - 定时器 ID
  // - 前一个值
  // - DOM 元素引用
  // - 任何需要跨渲染保留的数据
}
```

#### 6.5.5 内部原理：为什么修改 ref.current 不触发渲染

```javascript
// 关键区别
// useState: 调用 dispatchSetState → scheduleUpdateOnFiber → 触发渲染
// useRef: 直接修改 ref.current → 仅仅改变了内存中的值 → 无渲染

// React 完全不知道 ref.current 变了
// 因为 ref 是"逃逸口"，不受 React 控制
```

**适用场景**：

```jsx
// 1. 存储 DOM 引用
function AutoFocus() {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return <input ref={inputRef} />;
}

// 2. 存储前一个值
function usePrevious(value) {
  const ref = useRef();

  useEffect(() => {
    ref.current = value;
  });

  return ref.current;
}

// 3. 存储定时器 ID（组件卸载时清理）
function Timer() {
  const timerRef = useRef(null);

  const start = () => {
    timerRef.current = setInterval(() => {
      console.log('tick');
    }, 1000);
  };

  const stop = () => {
    clearInterval(timerRef.current);
  };

  useEffect(() => {
    return () => clearInterval(timerRef.current); // 清理
  }, []);

  return <button onClick={start}>Start</button>;
}
```

---

### 6.6 useReducer 深入解析

#### 6.6.1 基本使用

```jsx
const [state, dispatch] = useReducer(reducer, initialState);

function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    default:
      return state;
  }
}
```

#### 6.6.2 useState 实际上是 useReducer 的语法糖

```javascript
// useState 的实现
function mountState(initialState) {
  // ... 创建 hook，初始化 ...

  // useState 的 reducer 是 basicStateReducer
  const queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: basicStateReducer, // ← 关键区别
    lastRenderedState: initialState,
  };
  hook.queue = queue;
  // ...
}

function updateState(initialState) {
  // 直接调用 updateReducer
  return updateReducer(basicStateReducer, initialState);
}

// basicStateReducer - 处理 useState 的更新
function basicStateReducer(state, action) {
  // action 是函数 → 执行并返回结果
  // action 是值 → 直接返回
  return typeof action === 'function' ? action(state) : action;
}

// useReducer 的实现
function mountReducer(reducer, initialArg, init) {
  // 几乎与 mountState 相同，但使用自定义 reducer
  const queue = {
    pending: null,
    dispatch: null,
    lastRenderedReducer: reducer, // ← useReducer 使用自定义 reducer
    lastRenderedState: initialState,
  };
  // ...
}

function updateReducer(reducer, initialArg, init) {
  // 与 updateState 共享同一份逻辑
  // 唯一的区别是 reducer 不同
}
```

**关键区别总结**：

| 特性 | `useState` | `useReducer` |
|------|-----------|-------------|
| 内部 reducer | `basicStateReducer` | 用户自定义 |
| 适合场景 | 简单值 | 复杂状态逻辑 |
| 更新方式 | `setState(value)` / `setState(prev => newValue)` | `dispatch({type: 'ACTION'})` |
| 批处理 | 自动 | 自动 |

#### 6.6.3 useReducer 与 useState 的选择

```jsx
// 简单值 → useState
const [count, setCount] = useState(0);

// 多个关联字段 → useReducer
const [state, dispatch] = useReducer(todoReducer, {
  todos: [],
  filter: 'all',
  editing: null,
});

function todoReducer(state, action) {
  switch (action.type) {
    case 'add':
      return { ...state, todos: [...state.todos, action.todo] };
    case 'toggle':
      return {
        ...state,
        todos: state.todos.map(t =>
          t.id === action.id ? { ...t, done: !t.done } : t
        ),
      };
    case 'setFilter':
      return { ...state, filter: action.filter };
    default:
      return state;
  }
}
```

---

### 6.7 useMemo 与 useCallback 深入解析

#### 6.7.1 基本使用

```jsx
// useMemo: 缓存计算值
const sortedList = useMemo(
  () => list.sort((a, b) => a - b),  // 计算函数
  [list]                              // 依赖
);

// useCallback: 缓存函数引用
const handleClick = useCallback(
  (event) => onClick(event.target.id),  // 函数
  [onClick]                             // 依赖
);
```

#### 6.7.2 mountMemo / mountCallback

```javascript
function mountMemo(nextCreate, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 执行计算函数，得到值
  const nextValue = nextCreate();

  // 存储 [计算值, 依赖数组]
  hook.memoizedState = [nextValue, nextDeps];

  return nextValue;
}

function mountCallback(callback, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 存储 [函数, 依赖数组]
  hook.memoizedState = [callback, nextDeps];

  return callback;
}
```

#### 6.7.3 updateMemo / updateCallback

```javascript
function updateMemo(nextCreate, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 获取上次缓存的值和依赖
  const prevState = hook.memoizedState;
  const prevDeps = prevState[1];

  // 比较依赖
  if (nextDeps !== null && areHookInputsEqual(nextDeps, prevDeps)) {
    // 依赖没变，返回缓存值
    return prevState[0];
  }

  // 依赖变了，重新计算
  const nextValue = nextCreate();
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

function updateCallback(callback, deps) {
  const hook = updateWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;

  // 比较依赖
  const prevState = hook.memoizedState;
  const prevDeps = prevState[1];

  // 如果依赖相同，返回缓存的函数
  if (nextDeps !== null && areHookInputsEqual(nextDeps, prevDeps)) {
    return prevState[0];
  }

  // 依赖变了，缓存新函数
  hook.memoizedState = [callback, nextDeps];
  return callback;
}
```

#### 6.7.4 useMemo vs useCallback

```javascript
// useCallback(fn, deps) 等价于 useMemo(() => fn, deps)
const handleClick = useCallback(onClick, [onClick]);
const handleClick = useMemo(() => onClick, [onClick]); // 等价
```

**何时使用 useMemo/useCallback？**

```jsx
// ✅ 需要: 传递给子组件避免不必要的重新渲染
function Parent() {
  const [count, setCount] = useState(0);

  // 没有 useCallback: 每次 Parent 渲染时都创建新函数
  // 即使 Child 用了 React.memo 也无法阻止重渲染
  // const handleClick = () => console.log('click');

  // 有 useCallback: 函数引用稳定
  const handleClick = useCallback(() => {
    console.log('click');
  }, []);

  return <Child onClick={handleClick} />;
}

// ✅ 需要: 作为 useEffect 依赖
function Example({ items }) {
  const sorted = useMemo(
    () => items.sort((a, b) => a.id - b.id),
    [items]
  );

  useEffect(() => {
    fetchData(sorted);
    // 如果不 useMemo，sorted 每次都是新数组
    // 会导致 useEffect 不断重运行
  }, [sorted]);

  return <div>{sorted.length}</div>;
}
```

**⚠️ useMemo 的常见误用**：

```jsx
// ❌ 过度优化 - 简单计算不需要 useMemo
const total = useMemo(() => a + b, [a, b]); // useMemo 的开销比加法还大

// ✅ 直接计算
const total = a + b;

// ❌ 反模式 - deps 不完整
const user = useMemo(
  () => ({ name: firstName + ' ' + lastName }),
  [] // 依赖缺失：firstName, lastName
);

// ✅ 正确
const user = useMemo(
  () => ({ name: firstName + ' ' + lastName }),
  [firstName, lastName]
);
```

---

### 6.8 useContext 深入解析

#### 6.8.1 基本使用

```jsx
import { createContext, useContext } from 'react';

// 1. 创建 Context（通常在单独文件中）
const ThemeContext = createContext('light');

// 2. 提供 Context 值
function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Toolbar />
    </ThemeContext.Provider>
  );
}

// 3. 消费 Context 值
function Button() {
  const theme = useContext(ThemeContext);
  return <button className={theme}>Click</button>;
}

function Toolbar() {
  return <Button />;
}
```

**React 19 新语法：Provider 可以省略**（见第 7 节）

```jsx
// React 19+
function App() {
  return (
    <ThemeContext value="dark">
      <Toolbar />
    </ThemeContext>
  );
}
```

---

#### 6.8.2 Context 的完整工作流程

##### 6.8.2.1 创建 Context

```javascript
// ReactContext.js
export function createContext(defaultValue) {
  const context: ReactContext = {
    $$typeof: REACT_CONTEXT_TYPE,  // 内部类型标记
    _currentValue: defaultValue,       // 当前值（默认值）
    _currentRenderer: null,          // 当前渲染器（用于服务端渲染）
    _threadCount: 0,                  // 线程计数（服务端）
    Provider: null,                    // Provider 组件（延迟创建）
    Consumer: null,                    // Consumer 组件（延迟创建）
  };

  // 延迟创建 Provider 组件
  context.Provider = {
    $$typeof: REACT_PROVIDER_TYPE,
    _context: context,
  };

  // 延迟创建 Consumer 组件
  context.Consumer = {
    $$typeof: REACT_CONTEXT_TYPE,
    _context: context,
    _currentValue: defaultValue,
  };

  return context;
}
```

**Context 对象结构**：

```javascript
{
  $$typeof: Symbol(react.context),      // 类型标记
  _currentValue: 'default',             // 当前值
  _currentRenderer: null,                // 当前渲染器
  _threadCount: 0,                        // 线程计数
  Provider: { $$typeof: ..., _context },  // Provider 组件
  Consumer: { $$typeof: ..., _context },  // Consumer 组件
}
```

##### 6.8.2.2 Provider 的渲染流程

当 `<ThemeContext.Provider value="dark">` 渲染时：

```javascript
// ReactFiberBeginWork.js
function updateContextProvider(current, workInProgress, renderLanes) {
  const providerFiber = workInProgress;
  const context = providerFiber.type._context;  // 从 Context 对象获取
  const newValue = providerFiber.pendingProps.value;  // value prop

  const oldValue = current !== null ? current.memoizedProps.value : null;

  // 1. 比较新旧值
  if (Object.is(oldValue, newValue)) {
    // ✅ 值相同，不需要传播
    return bailout();
  }

  // 2. 值变了，需要传播
  propagateContextChange(workInProgress, context, renderLanes);

  // 3. 更新 Provider Fiber 的状态
  providerFiber.memoizedProps = {
    value: newValue,
  };

  return null;  // 返回 null 表示继续渲染子节点
}

// propagateContextChange - 核心传播逻辑
function propagateContextChange(workInProgress, context, renderLanes) {
  // 向上查找最近的 Context 节点
  let fiber = workInProgress.child;
  while (fiber !== null) {
    // 遍历整个子树
    const list = fiber.dependencies;
    if (list !== null) {
      let dependency = list.firstContext;
      while (dependency !== null) {
        // 检查是否订阅了这个 Context
        if (dependency.context === context) {
          // 标记 Fiber 需要更新
          // 使用 OR 操作添加 lane
          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);

          // 同时更新 childLanes，确保子组件也能更新
          fiber.childLanes = mergeLanes(fiber.childLanes, renderLanes);
        }

        dependency = dependency.next;
      }
    }

    // 继续遍历子节点
    fiber = fiber.sibling;
  }
}
```

**关键点**：
- Provider 不创建子 Fiber，只传播数据
- 值相同时不传播（`Object.is` 比较）
- 值不同时遍历整个子树，标记所有订阅 Fiber

##### 6.8.2.3 useContext 的调用流程

```javascript
function useContext(Context) {
  // 1. 通过 Dispatcher 获取最新实现
  const dispatcher = resolveDispatcher();

  // 2. 调用 readContext
  return dispatcher.useContext(Context);
}

// HooksDispatcherOnMount 和 HooksDispatcherOnUpdate 都指向同一个函数
function readContext(Context) {
  // 创建 Context 依赖项
  const contextItem = {
    context: Context,
    memoizedValue: Context._currentValue,  // 当前值
    next: null,
  };

  // 获取当前正在渲染的 Fiber
  const currentlyRenderingFiber = getCurrentlyRenderingFiber();

  // 3. 添加到 Fiber 的 Context 依赖链
  // 这样 React 知道哪些组件使用了这个 Context
  const dependencies = currentlyRenderingFiber.dependencies;

  if (dependencies === null) {
    // 首次订阅
    dependencies = currentlyRenderingFiber.dependencies = {
      firstContext: contextItem,
      lanes: NoLanes,
    };
  } else {
    // 追加到链表末尾
    dependencies.lanes = NoLanes;
    const lastDependency = dependencies.lastContext;
    if (lastDependency === null) {
      dependencies.firstContext = contextItem;
    } else {
      lastDependency.next = contextItem;
    }
    dependencies.lastContext = contextItem;
  }

  // 4. 返回当前值
  return contextItem.memoizedValue;
}
```

---

#### 6.8.3 Context 更新传播机制

##### 6.8.3.1 完整的更新流程

```javascript
// 场景：Provider value 变化
function ThemeApp() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={theme}>
      <DeepComponentTree />
    </ThemeContext.Provider>
  );
}

// Provider value 从 'light' 变为 'dark':
```

**Step 1: 触发更新**

```
setTheme('dark')
  ↓
dispatchSetState(fiber, queue, 'dark')
  ↓
scheduleUpdateOnFiber(fiber, lane, eventTime)
  ↓
安排 Render 阶段
```

**Step 2: Provider 渲染（Begin Work）**

```javascript
function updateContextProvider(current, workInProgress, renderLanes) {
  const context = workInProgress.type._context;
  const newValue = workInProgress.pendingProps.value;
  const oldValue = current?.memoizedProps?.value;

  // 比较新旧值
  if (Object.is(oldValue, newValue)) {
    return bailout();  // 值相同，跳过
  }

  // 值变了！
  propagateContextChange(workInProgress, context, renderLanes);

  // 更新 Provider Fiber
  workInProgress.memoizedProps = { value: newValue };

  return null;  // Provider 不需要渲染自己的内容
}
```

**Step 3: 传播 Context 变化（关键）**

```javascript
function propagateContextChange(workInProgress, context, renderLanes) {
  let fiber = workInProgress.child;

  // 深度优先遍历子树
  while (fiber !== null) {
    // 检查这个 Fiber 是否订阅了 Context
    const list = fiber.dependencies;
    if (list !== null) {
      let dependency = list.firstContext;
      while (dependency !== null) {
        if (dependency.context === context) {
          // ✅ 找到订阅了此 Context 的组件

          // 标记 Fiber 需要更新
          // 使用 OR 操作合并 lanes
          fiber.lanes = mergeLanes(fiber.lanes, renderLanes);

          // 同时也标记 childLanes
          // 这样子组件也能触发更新
          fiber.childLanes = mergeLanes(fiber.childLanes, renderLanes);

          console.log(`标记 Fiber ${fiber.type.name || 'Anonymous'} 需要更新`);
        }

        dependency = dependency.next;
      }
    }

    // 继续深度遍历
    if (fiber.child !== null) {
      fiber = fiber.child;
    } else {
      // 如果没有子节点，回溯到兄弟节点
      while (fiber !== null && fiber.sibling === null) {
        fiber = fiber.return;
      }
      if (fiber !== null) {
        fiber = fiber.sibling;
      }
    }
  }
}
```

**Step 4: Lanes 合并（优先级处理）**

```javascript
// 示例：有多个 Context 更新
function App() {
  return (
    <ContextA.Provider value={a}>  {/* Lanes: 0b1 (InputContinuousLane) */}
      <ContextB.Provider value={b}>  {/* Lanes: 0b10 (TransitionLane) */}
        <Child />  {/* 同时订阅 A 和 B */}
      </ContextB.Provider>
    </ContextA.Provider>
  );
}

// ContextA 更新
fiber.lanes = 0b1;

// ContextB 更新（不同优先级）
fiber.lanes = 0b1 | 0b10 = 0b11;  // 合并 lanes

// 在 Render 阶段，会根据 lanes 优先级决定渲染顺序
```

---

#### 6.8.4 Fiber 的 Context 依赖链表

**Context 依赖存储在 `fiber.dependencies` 中**：

```javascript
// Fiber 对象结构（部分）
const fiber = {
  // ... 其他属性

  dependencies: {
    firstContext: {
      context: ThemeContext,      // 订阅的 Context
      memoizedValue: 'dark',      // 当前读取的值
      next: {
        context: UserContext,
        memoizedValue: 'Alice',
        next: null,  // 链表结尾
      }
    },
    lastContext: {
      context: UserContext,
      memoizedValue: 'Alice',
      next: null,
    },
    lanes: 0b0001,  // 订阅的 lanes
  },

  childLanes: 0b0001,  // 子树的 lanes

  // ... 其他属性
};
```

**依赖链示例**：

```javascript
// 组件订阅多个 Context
function MultiContextComponent() {
  const theme = useContext(ThemeContext);    // 订阅 1
  const user = useContext(UserContext);      // 订阅 2
  const locale = useContext(LocaleContext);  // 订阅 3

  return <div>...</div>;
}

// fiber.dependencies 结构：
dependencies: {
  firstContext: {
    context: ThemeContext,
    memoizedValue: 'dark',
    next: { context: UserContext, memoizedValue: 'Alice', next: {...} }
  },
  lastContext: {
    context: LocaleContext,
    memoizedValue: 'en',
    next: null,
  },
  lanes: 0b0001  // 如果订阅了多个 Context，都会用 OR 合并
}
```

**关键点**：
1. `dependencies` 是链表结构（`firstContext` → `next`）
2. 每个 Context 订阅是一个依赖项
3. Context 值变化时，根据链表找到所有订阅该 Context 的 Fiber
4. 使用 lanes 机制支持优先级

---

#### 6.8.5 性能优化问题

**问题 1：Provider 值总是变化导致整个子树重新渲染**

```javascript
// ❌ 问题：每次渲染都创建新对象
function App() {
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState({ name: 'Alice' });

  return (
    <ThemeContext.Provider value={{ theme, user }}>
      {/* 即使 theme 不变，user 变化也会创建新对象 */}
      <DeepComponentTree />
    </ThemeContext.Provider>
  );
}

// ❌ 结果：每次 App 渲染，所有 useContext(ThemeContext) 的组件都会重新渲染
// 解决：拆分 Context 或使用 useMemo
```

**解决方案 1：拆分 Context**

```javascript
// ✅ 拆分为独立的 Context
const ThemeContext = createContext('light');
const UserContext = createContext(null);

function App() {
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState({ name: 'Alice' });

  return (
    <ThemeContext.Provider value={theme}>  {/* 简单值，React 自动比较 */}
      <UserContext.Provider value={user}>  {/* 另一个 Provider */}
        <DeepComponentTree />
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}

function Child() {
  const theme = useContext(ThemeContext);
  const user = useContext(UserContext);

  // ✅ 只有 theme 变化时，这行代码会重新执行
  // ✅ 只有 user 变化时，这行代码会重新执行
  return <div>{theme} - {user.name}</div>;
}
```

**解决方案 2：使用 useMemo 稳定引用**

```javascript
// ✅ 使用 useMemo
function App() {
  const [theme, setTheme] = useState('dark');
  const [user, setUser] = useState({ name: 'Alice' });

  const contextValue = useMemo(
    () => ({ theme, user }),
    [theme, user]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <DeepComponentTree />
    </ThemeContext.Provider>
  );
}
```

**问题 2：Deep Component 导致性能问题**

```javascript
// ❌ 问题：即使 Context 值相同，子组件仍会被标记更新
function Parent() {
  const [data, setData] = useState({ value: 1 });

  return (
    <DataContext.Provider value={data}>
      {/* 每次 Parent 渲染，data 引用变化 → 传播 Context → Child 被标记更新 */}
      <DeepTree />  {/* 1000 个子组件 */}
    </DataContext.Provider>
  );
}

// ✅ 解决方案：使用 React.memo + 比较函数
const Child = React.memo(({ value }) => {
  return <div>{value}</div>;
}, (prev, next) => prev.value === next.value);  // 浅比较

// ✅ 更好的方案：拆分状态 + React.memo
const DataProvider = React.memo(({ value }) => {
  return (
    <DataContext.Provider value={value}>
      <DeepTree />
    </DataContext.Provider>
  );
}, (prev, next) => prev.value === next.value);

function App() {
  const [data, setData] = useState({ value: 1 });
  return <DataProvider value={data} />;
}
```

**问题 3：多个 Context 嵌套，导致级联更新**

```javascript
// ❌ 问题：ContextA 更新 → 触发整个子树 → ContextB 也被标记更新
function App() {
  const [theme, setTheme] = useState('dark');
  const [config, setConfig] = useState({ language: 'en' });

  return (
    <ThemeContext.Provider value={theme}>
      <ConfigContext.Provider value={config}>
        <DeepTree />  {/* 同时订阅 theme 和 config */}
      </ConfigContext.Provider>
    </ThemeContext.Provider>
  );
}

// theme 更新时：
// 1. propagateContextChange 标记整个子树
// 2. 即使 config 没变，所有 useContext(config) 的组件也会被标记
// 3. 然后 Reconciliation 时会检查 deps，发现 config 确实没变 → bailout
// ❌ 问题：仍然会遍历整个子树，性能开销大

// ✅ 解决方案 1：使用 React.memo 优化子组件
const Inner = React.memo(({ children }) => children);

// ✅ 解决方案 2：拆分为独立的 Provider 树
const ThemeProvider = React.memo(({ theme, children }) => (
  <ThemeContext.Provider value={theme}>
    {children}
  </ThemeContext.Provider>
), (prev, next) => prev.theme === next.theme);

const ConfigProvider = React.memo(({ config, children }) => (
  <ConfigContext.Provider value={config}>
    {children}
  </ConfigContext.Provider>
), (prev, next) => prev.config.language === next.config.language);

function App() {
  const [theme, setTheme] = useState('dark');
  const [config, setConfig] = useState({ language: 'en' });

  return (
    <ThemeProvider theme={theme}>
      <ConfigProvider config={config}>
        <DeepTree />
      </ConfigProvider>
    </ThemeProvider>
  );
}
```

---

#### 6.8.6 Context 的最佳实践

##### 6.8.6.1 拆分 Context

```javascript
// ❌ 所有状态塞进一个 Context
const AppContext = createContext({
  user: null,
  theme: 'light',
  settings: { fontSize: 16, language: 'en' },
  // ... 20 个字段
});

// ✅ 拆分为小而专注的 Context
const ThemeContext = createContext('light');
const UserContext = createContext(null);
const SettingsContext = createContext({ fontSize: 16, language: 'en' });
// ... 每个 Context 只负责一个领域
```

##### 6.8.6.2 稳定 Provider 值

```javascript
// ❌ 每次渲染创建新对象
function App() {
  return (
    <SomeContext.Provider value={{ a: 1, b: 2, c: 3 }}>
      <Children />
    </SomeContext.Provider>
  );
}

// ✅ 使用 useMemo
function App() {
  const contextValue = useMemo(() => ({ a: 1, b: 2, c: 3 }), []);
  return (
    <SomeContext.Provider value={contextValue}>
      <Children />
    </SomeContext.Provider>
  );
}

// ✅ 使用 useState（如果是简单值）
function App() {
  const [theme, setTheme] = useState('light');
  return (
    <ThemeContext.Provider value={theme}>
      <Children />
    </ThemeContext.Provider>
  );
}
```

##### 6.8.6.3 避免过度嵌套 Provider

```javascript
// ❌ 层层嵌套
function App() {
  return (
    <ThemeContext.Provider value={theme}>
      <UserContext.Provider value={user}>
        <SettingsContext.Provider value={settings}>
          <NetworkContext.Provider value={network}>
            <DeepComponentTree />
          </NetworkContext.Provider>
        </SettingsContext.Provider>
      </UserContext.Provider>
    </ThemeContext.Provider>
  );
}

// ✅ 扁平化 Provider
const AppProviders = ({ providers, children }) => (
  providers.reduce((acc, [Provider, value]) => (
    <Provider value={value}>{acc}</Provider>
  ), children)
);

function App() {
  return (
    <AppProviders
      providers={[
        [ThemeContext, theme],
        [UserContext, user],
        [SettingsContext, settings],
        [NetworkContext, network],
      ]}
    >
      <DeepComponentTree />
    </AppProviders>
  );
}
```

##### 6.8.6.4 考虑使用 Recoil 或 Zustand

对于复杂状态管理，Context 可能不是最佳选择：

```javascript
// ✅ 使用 Recoil（官方推荐）
import { atom, useRecoilValue, useRecoilState } from 'recoil';

const themeState = atom({
  key: 'theme',
  default: 'light',
});

function App() {
  const [theme, setTheme] = useRecoilState(themeState);
  // Recoil 会精确追踪订阅，避免不必要的更新
}

// ✅ 使用 Zustand
import { create } from 'zustand';

const useStore = create((set) => ({
  theme: 'light',
  setTheme: (theme) => set({ theme }),
}));

function App() {
  const theme = useStore(state => state.theme);
  const setTheme = useStore(state => state.setTheme);
  // Zustand 的订阅更精确
}
```

---

#### 6.8.7 React 18/19 的 Context 增强

##### 6.8.7.1 自动批处理（React 18+）

```javascript
function Parent() {
  const [count, setCount] = useState(0);
  const [theme, setTheme] = useState('light');

  const handleClick = () => {
    setCount(c => c + 1);
    setTheme('dark');

    // React 18: 自动批处理
    // 即使调用了两次 setState，也只渲染一次 ✅
  };
}
```

##### 6.8.7.2 Server Components 支持（React 18+）

```javascript
// 服务端组件可以直接使用 Context
async function UserLayout({ userId }) {
  const user = await fetchUser(userId);

  return (
    <UserContext.Provider value={user}>
      <UserHeader />
      <UserContent />
    </UserContext.Provider>
  );
}

// 客户端组件消费
'use client';
function UserHeader() {
  const user = useContext(UserContext);
  return <h1>Hello, {user.name}</h1>;
}
```

##### 6.8.7.3 useMemo 优化 deps（React 19）

```javascript
function Provider({ value, children }) {
  // React 19 的 React Compiler 可以自动优化
  // 但手动 useMemo 仍然有效
  const memoizedValue = useMemo(() => value, [value]);

  return (
    <Context.Provider value={memoizedValue}>
      {children}
    </Context.Provider>
  );
}
```

---

#### 6.8.8 Context 的常见问题

##### 6.8.8.1 Context 更新传播范围

**问题：为什么 Context 更新会导致所有子组件被遍历？**

```javascript
// 问题：即使子组件没有 useContext，也会被标记更新
function Parent() {
  const [data, setData] = useState({ a: 1 });

  return (
    <DataContext.Provider value={data}>
      <div>
        <ChildA />  {/* 未使用 Context */}
        <ChildB />  {/* 未使用 Context */}
        <ChildC />  {/* 未使用 Context */}
      </div>
    </DataContext.Provider>
  );
}

// 原因：
// 1. propagateContextChange 遍历整个子树（包括所有节点）
// 2. 所有子 Fiber 的 lanes 都会被标记（OR 操作）
// 3. beginWork 时即使 bailout（Context 值未消费），仍需遍历
// ❌ 性能开销：遍历整个子树是 O(n) 操作

// 解决方案：使用 React.memo 包裹中间层
const MemoizedSection = React.memo(({ children }) => children);
```

**实际影响**：

```javascript
// 测试：1000 个子节点
// Context 更新耗时：~2-5ms（遍历子树）
// 如果子树很深或很宽，开销会更明显

// 但通常不是性能瓶颈，除非：
// - 超大组件树（>1000 组件）
// - 频繁更新（如 60fps 动画）
// - 设备性能较差
```

##### 6.8.8.2 不必要的 Context 订阅

**问题：如何避免不必要的 Context 订阅？**

```javascript
// ❌ 不好的做法：总是订阅所有 Context
function Child() {
  const theme = useContext(ThemeContext);
  const user = useContext(UserContext);
  const settings = useContext(SettingsContext);
  const network = useContext(NetworkContext);

  return <div>{theme}</div>;  // 只用了 theme，但订阅了 4 个
}

// ✅ 好的做法：只订阅需要的
function Child() {
  const theme = useContext(ThemeContext);  // 只订阅一个

  return <div>{theme}</div>;
}

// ✅ 或者拆分成小组件
function ThemeAwareChild() {
  const theme = useContext(ThemeContext);
  return <div>{theme}</div>;
}

function UserAwareChild() {
  const user = useContext(UserContext);
  return <div>{user.name}</div>;
}
```

##### 6.8.8.3 Context 值与 React.memo 的交互

**问题：Context 值变化时，为什么有些组件没有更新？**

```javascript
const UserContext = createContext(null);

function Parent() {
  const [user, setUser] = useState(null);

  return (
    <UserContext.Provider value={user}>
      <MemoizedChild />
    </UserContext.Provider>
  );
}

const MemoizedChild = React.memo(() => {
  const user = useContext(UserContext);
  return <div>{user?.name}</div>;
});

// user 变化时：
// 1. propagateContextChange 标记 MemoizedChild Fiber
// 2. beginWork 检查：
//    - lanes 被标记 ✅
//    - dependencies 有 Context 依赖 ✅
// 3. Reconciliation 检查：
//    - type 不变 ✅
//    - memoizedProps 不变（React.memo 的第二个参数）
// 4. 执行 Bailout ✅

// 结果：MemoizedChild 不会重新渲染
```

---

#### 6.8.9 源码级别：Context 依赖是如何存储的？

**完整的数据结构**：

```javascript
// ReactContext.js
export function createContext(defaultValue) {
  const context = {
    // ... 其他属性
    Provider: {
      $$typeof: REACT_PROVIDER_TYPE,
      _context: context,
    },
  };

  return context;
}

// ReactFiberNewContext.js
// 创建 Context 节点
function createContextUpdate(current, workInProgress, context, changedBits, didScheduleRenderPhaseUpdate) {
  const fiber = workInProgress;

  // Context 存储在 context 栈中
  const newContext = {
    parent: current.context,
    parentContextValue: current.contextValue,
    parentContext: context,
    context: context,
    value: currentValue,
    version: nextVersion,
    didScheduleRenderPhaseUpdate,
  };

  fiber.context = newContext;
}

// 渲染时的 context 切换
function pushProvider(workInProgress, providerFiber, nextValue) {
  const context = providerFiber.type._context;

  // 创建 Context 节点
  const prevContext = workInProgress.context;

  if (prevContext === null) {
    // 首次使用 Provider
    workInProgress.context = {
      parent: prevContext,
      parentContextValue: prevContext?.contextValue,
      parentContext: context,
      context: context,
      value: nextValue,
      version: currentVersion,
      didScheduleRenderPhaseUpdate: false,
    };
  } else {
    // 已有 Context 栈，压入新节点
    const prevProvider = prevContext.context;
    workInProgress.context = {
      parent: prevProvider,
      parentContextValue: prevProvider.contextValue,
      parentContext: prevProvider,
      context: context,
      value: nextValue,
      version: prevProvider.version + 1,
    };
  }
}

// 读取 Context 时从栈顶读取
function readContext(context) {
  const currentContext = getCurrentFiberContext();
  return currentContext.contextValue;  // 返回栈顶的值
}

// 离开 Provider 时弹出 Context 节点
function popProvider(workInProgress, workInProgressRoot) {
  // 恢复上一个 Context
  workInProgress.context = workInProgress.context.parent;
  return true;
}
```

---

#### 6.8.10 完整的 Context 生命周期

```
应用初始化:
  1. createContext('default') 创建 Context 对象
     ├─→ _currentValue: 'default'
     ├─→ Provider: { _context: Context }
     └─→ Consumer: { _context: Context, _currentValue: 'default' }

组件首次渲染:
  2. useContext(Context)
     ├─→ readContext()
     ├─→ 创建 contextItem = { context, memoizedValue, next }
     ├─→ fiber.dependencies.firstContext = contextItem
     └─→ 返回 Context._currentValue

Provider 值变化:
  3. Provider 重新渲染
     ├─→ updateContextProvider()
     ├─→ Object.is(oldValue, newValue)
     │  └─→ false? bailout : continue
     │
     ├─→ propagateContextChange()
     │  ├─→ 遍历子树（DFS）
     │  ├─→ 检查每个 Fiber 的 dependencies
     │  │  └─→ dependency.context === context?
     │  │     └─→ 是 → fiber.lanes = mergeLanes(fiber.lanes, renderLanes)
     │  │     └─→ 是 → fiber.childLanes = mergeLanes(fiber.childLanes, renderLanes)
     │  └─→ ...
     │
     └─→ 返回 null（Provider 不渲染自己）

子组件重新渲染:
  4. beginWork()
     ├─→ 检查 fiber.lanes 是否匹配 renderLanes
     ├─→ 有待处理更新? 
     │  ├─→ 是 → 继续渲染
     │  │  │  ├─→ useState 计算新状态
     │  │  │  │  └─→ readContext() 获取新 Context 值
     │  │  │  └─→ ...
     │  │
     │  │  └─→ 比较新旧状态/props
     │  │     ├─→ Object.is(oldState, newState) && Object.is(oldProps, newProps)
     │  │     │  └─→ true → bailout
     │  │     │     └─→ 不渲染 ✅
     │  │     │
     │  │  │  └─→ false → 渲染组件
     │  │
     │  └─→ 无待处理更新 → bailout（即使 lanes 被标记）
     │        └─→ 不渲染 ✅

  5. commitRoot()
     └─→ DOM 更新
```

---

#### 6.8.11 总结：Context 的核心要点

| 特性 | 说明 |
|------|------|
| **订阅机制** | 通过 `fiber.dependencies` 链表追踪 |
| **更新传播** | DFS 遍历子树，标记订阅 Fiber 的 lanes |
| **值比较** | `Object.is()`，相同则不传播 |
| **Bailout** | 即使被标记更新，也可能 bailout（如果组件本身没变化） |
| **性能影响** | 遍历子树是 O(n)，大组件树会有开销 |
| **嵌套 Provider** | 支持，但过度嵌套影响性能 |
| **Server Components** | 支持（直接使用 Context） |
| **并发模式** | 支持（ lanes 机制） |
| **最佳实践** | 拆分 Context、稳定引用、React.memo、考虑 Recoil/Zustand |

**关键代码位置**：
- `ReactContext.js`: Context 创建
- `ReactFiberBeginWork.js`: Provider 渲染、Context 传播
- `ReactFiberNewContext.js`: Context 栈管理
- `ReactFiberHooks.js`: useContext 实现


---

### 6.9 useTransition 与 useDeferredValue (React 18+)

> useTransition 是 React 18 并发模式中最具代表性的 API。
> 它的本质是：**在同一个组件内，同时创建两个优先级完全不同的更新流**。

#### 6.9.1 useTransition - 标记低优先级更新

##### 1. 基本用法

```jsx
import { useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    // ★ 紧急更新: 立即显示输入（InputContinuousLane）
    setQuery(e.target.value);

    // ★ 过渡更新: 可以延迟（TransitionLane）
    startTransition(() => {
      setSearchResults(filterItems(e.target.value));
    });
  }

  return (
    <div>
      <input onChange={handleChange} />
      {isPending && <Spinner />}
      {/* 慢列表渲染不会阻塞输入 */}
      <SlowList items={searchResults} />
    </div>
  );
}
```

**问题的本质**：为什么一个 `handleChange` 中的两个 setState，会有不同的优先级？

---

##### 2. 源码全景 —— mountTransition

```javascript
// packages/react-reconciler/src/ReactFiberHooks.js

function mountTransition() {
  // ★ (1) 创建一个 useState hook 来存储 isPending 状态
  const [isPending, setPending] = mountState(false);

  // ★ (2) 创建 startTransition 函数
  //      注意这个 start 是在 mount 时被创建的闭包
  //      它捕获了当前 Fiber 和 setPending
  const start = startTransition.bind(null, setPending);
  mountWorkInProgressHook();       // 第二个 hook（存储 start 本身）

  return [isPending, start];
}
```

关键点：**useTransition 内部创建了两个 hook**：

| Hook | 用途 | 存储 |
|------|------|------|
| Hook 0 (mountState) | isPending 状态 | `hook.memoizedState = false` |
| Hook 1 (mountWorkInProgressHook) | 占位，无实际状态 | 只为了让 hook 索引对齐 |

为什么需要两个 hook？因为 `useState`、`useEffect`、`useTransition` 等所有 Hook 都通过**调用顺序**索引。`useTransition` 返回两个值，但底层占用两个 hook 槽位。

---

##### 3. startTransition 的本质——优先级切换器

```javascript
// packages/react-reconciler/src/ReactFiberHooks.js

function startTransition(setPending, callback, options) {
  // ★ 保存之前的 transition 上下文（支持嵌套）
  const previousTransition = ReactCurrentBatchConfig.transition;

  // ★ (1) 创建 transition 上下文
  //     { name: 'xxx' } 中的 name 是 transition 的名称
  //     通常为空字符串，但未来可能用于调试
  ReactCurrentBatchConfig.transition = { name: '' };

  // ★ (2) 以 SyncLane（最高优先级）更新 isPending = true
  //     这一步的目的是"立即"让 UI 显示 pending 状态
  setPending(true);

  // ★ (3) 在 transition 上下文中执行回调
  //     重点：callback 内所有的 setState → requestUpdateLane
  //     → 检测到 ReactCurrentBatchConfig.transition 不为 null
  //     → 返回 TransitionLane（而非 DefaultLane / InputContinuousLane）
  try {
    callback();
  } finally {
    // ★ (4) 恢复之前的 transition 上下文
    ReactCurrentBatchConfig.transition = previousTransition;

    // ★ (5) 以 SyncLane 更新 isPending = false
    setPending(false);
  }
}
```

**这是 useTransition 最核心的逻辑**：一个 `startTransition` 调用，触发了**三次** setState：

| 顺序 | 操作 | Lane 优先级 | 渲染内容 |
|------|------|-----------|---------|
| ① | `setPending(true)` | **SyncLane** | 显示 Spinner（立刻！） |
| ② | `callback()` 内的 setState | **TransitionLane** | 低优先级更新（可打断） |
| ③ | `setPending(false)` | **SyncLane** | 隐藏 Spinner，显示结果 |

```
用户输入 "abc"
    │
    ▼
handleChange(e)
    │
    ├── setQuery("abc") → InputContinuousLane → 输入框立即更新
    │
    └── startTransition(() => {
            │
            ├── setPending(true)  → SyncLane (最高优先级)
            │     └─→ 渲染显示 Spinner
            │
            ├── setResults(filter("abc")) → TransitionLane (低优先级)
            │     └─→ requestUpdateLane 检测到 transition 上下文
            │          → 返回 TransitionLane1（位 5）
            │          → fiber.lanes |= TransitionLane1
            │          → 低优先级渲染，可被中断
            │
            └── setPending(false) → SyncLane (最高优先级)
                  └─→ 渲染隐藏 Spinner
         })
```

所以 **useTransition 实际上产生了三次独立的调度**，而不是一次。

---

##### 4. requestUpdateLane 如何检测 Transition 上下文

这是调整 Lane 优先级的关键链路：

```javascript
// packages/react-reconciler/src/ReactFiberWorkLoop.js

function requestUpdateLane(fiber) {
  // ★ 检测当前是否在 Transition 上下文中
  const transition = ReactCurrentBatchConfig.transition;
  if (transition !== null) {
    // ★ 如果在 transition 中 → 返回 TransitionLane
    //    transition.lane 是由 requestTransitionLane() 分配的
    //    取值在 TransitionLane1 ~ TransitionLane16 之间循环
    return transition._lane;
  }

  // 不在 transition 中 → 按照事件类型分配
  const updateLane = getLaneForEventType(currentEventType);
  if (updateLane !== SyncLane) {
    return updateLane;
  }

  return SyncLane;
}
```

**Transition 优先级切换的数据流**：

```
setPending(true)              → 不在 Transition 中 → SyncLane
                                  ↑
startTransition 设置         → ReactCurrentBatchConfig.transition = { name: '' }
                                  ↓
callback() 内的 setState(...) → requestUpdateLane()
                                  ↓
                               检测 transition !== null
                                  ↓
                               return TransitionLaneX（位 5-11）
                                  ↓
                               fiber.lanes |= TransitionLaneX
                                  ↓
setPending(false)             → 不在 Transition 中 → SyncLane
                                  ↑
finally 恢复                  → ReactCurrentBatchConfig.transition = previousTransition
```

**关键结论**：`startTransition` 不是"降低"了 callback 中 setState 的优先级，而是**改变了 Lane 分配规则**——让 `requestUpdateLane` 走 Transition 分支而非事件类型分支。

---

##### 5. TransitionLane 分配策略——16 个等级的循环池

```javascript
// packages/react-reconciler/src/ReactFiberWorkLoop.js

// ★ TransitionLane 共有 16 个等级
//    优先级从高到低：TransitionLane1 > TransitionLane2 > ... > TransitionLane16
//
// const TransitionLane1   = 0b00000000000000000000000000100000;  // 位 5
// const TransitionLane2   = 0b00000000000000000000000001000000;  // 位 6
// const TransitionLane3   = 0b00000000000000000000000010000000;  // 位 7
// ...
// const TransitionLane16  = 0b00000000000100000000000000000000;  // 位 20

let currentTransitionLane = TransitionLane1;

function requestTransitionLane() {
  // ★ 循环分配下一个 TransitionLane
  const lane = currentTransitionLane;
  currentTransitionLane <<= 1;    // 左移一位，选下一个

  // 如果超出了 TransitionLane16，回到 TransitionLane1
  if (currentTransitionLane > TransitionLane16) {
    currentTransitionLane = TransitionLane1;
  }

  return lane;
}
```

**为什么要有 16 个 TransitionLane？**

因为需要支持**多个并发的 Transition**。例如：

```
初始状态：currentTransitionLane = TransitionLane1

第 1 次 startTransition:   callback 内 setState → TransitionLane1  ← 位 5
第 2 次 startTransition:   callback 内 setState → TransitionLane2  ← 位 6
第 3 次 startTransition:   callback 内 setState → TransitionLane3  ← 位 7
```

这样，多个 Transition 更新可以独立存在，各自有不同的优先级，也各自独立地可被打断。当高优先级的 Transition（如 TransitionLane1）完成后，低优先级的（TransitionLane3）可能还在 pending 中。

---

##### 6. getNextLanes 如何抑制 Transition——优先级隔离的核心

Transition 更新之所以"可被打断"，根本原因在于 `getNextLanes` 的选择逻辑：

```javascript
// packages/react-reconciler/src/ReactFiberWorkLoop.js

function getNextLanes(root, wipRenderLanes) {
  const pendingLanes = root.pendingLanes;

  // ★ 如果有非 Transition 的 lane 待处理
  //    无条件优先处理它们，抑制 Transition
  const nonTransitionLanes = pendingLanes & ~TransitionLanes;
  if (nonTransitionLanes !== NoLanes) {
    // 从非 Transition lane 中选择最高优先级的
    const nextLanes = getHighestPriorityLanes(nonTransitionLanes);
    return nextLanes;
  }

  // ★ 只有全部都是 Transition lane 时，才处理 Transition
  return getHighestPriorityLanes(pendingLanes);
}
```

```
root.pendingLanes 状态：
  ┌────────────────────────────────────────────┐
  │  SyncLane | InputContLane | TransitionLane1 │  ← 混合状态
  └────────────────────────────────────────────┘
           │
           ▼
  getNextLanes → 检测到 nonTransitionLanes 不为空
           │
           ▼
  返回 SyncLane（最高优先级的非 Transition lane）
           │
           ▼
  TransitionLane1 → 留在 pendingLanes 中等待下次
```

**本质**：TransitionLane 在 `getNextLanes` 中被**优先级抑制**了——只要有任何非 Transition lane 存在，Transition 就永远不会被选中。

---

##### 7. isPending 的双重渲染模式详解

`isPending` 在两个时机发生变化，触发两次渲染：

**第一次渲染：`setPending(true)` → 显示加载状态**

```javascript
// startTransition 调用 setPending(true)
// → SyncLane，最高优先级
// → 立即进入 beginWork
//
// CounterFiber.lanes = SyncLane
// beginWork → reconcile → isPending = true
// commit → DOM 更新 → Spinner 出现
//         → 用户看到加载指示器
```

**第二次渲染：`setPending(false)` → 隐藏加载状态**

```javascript
// callback 执行完毕后
// startTransition 调用 setPending(false)
// → SyncLane，最高优先级
//
// 但注意：此时 transition 中的更新（TransitionLane）可能还没完成
// 所以第二次渲染时：
//   - isPending = false  ← SyncLane 处理
//   - setResults 的 TransitionLane ← 还在 pendingLanes 中
//
// 结果：Spinner 消失，但列表可能还没更新
// 然后等 Transition 完成 → 第三次渲染 → 列表更新
```

**这就是为什么用户会看到：Spinner 出现 → Spinner 消失 → 列表更新**——实际上是三次独立渲染。

---

##### 8. useTransition 与 Suspense 的协同

当 `startTransition` 内部的组件抛出 Promise（Suspense 挂起）时：

```javascript
function SearchPage() {
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      {isPending && <Spinner />}
      <Suspense fallback={<Skeleton />}>
        <SearchResults query={query} />
      </Suspense>
    </div>
  );
}

function SearchResults({ query }) {
  // ★ 这个 fetch 在 startTransition 内触发
  const data = use(fetch(`/search?q=${query}`));
  return <List items={data} />;
}
```

```javascript
// 没有 useTransition 的情况：
// Suspense 抛 Promise → 显示 fallback（Skeleton）
// → 用户看到内容闪烁：旧 UI → Skeleton → 新 UI

// 有 useTransition 的情况：
// React 检测到当前渲染是 Transition 更新
// → 不显示 fallback（Skeleton）
// → 保留旧 UI 直到数据加载完成
// → 用户看到：旧 UI（保持不变）→ 新 UI（直接替换）
//   中间没有 fallback 闪烁
```

**源码实现**：

```javascript
// packages/react-reconciler/src/ReactFiberBeginWork.js

function mountSuspensePrimaryChildren(workInProgress, primaryChildren, renderLanes) {
  // ★ 检测当前渲染是否在 Transition 中
  const isTransition = includesSomeLane(renderLanes, TransitionLanes);

  if (isTransition && !didSuspend) {
    // 在 Transition 中且未挂起 → 正常渲染子节点
    // 如果子节点挂起 → 不显示 fallback，保持旧 UI
    return;
  }

  // 不在 Transition 中 → 显示 fallback
  renderSuspenseFallback(workInProgress, fallbackChildren);
}
```

**这就是 useTransition 最实用的效果之一**：防止 Suspense 的 fallback 闪烁。

---

##### 9. 完整渲染链路图

```
                    ┌─────────────────────────────────────┐
                    │         startTransition              │
                    │  ┌───────────────────────────────┐  │
                    │  │  setPending(true)  → SyncLane │  │  ← 第 1 次渲染
                    │  │  callback() → setX(...)       │  │
                    │  │    → requestUpdateLane        │  │
                    │  │    → ReactCurrentBatchConfig  │  │
                    │  │      .transition !== null     │  │
                    │  │    → TransitionLaneX          │  │  ← 标记低优先级
                    │  │  setPending(false) → SyncLane │  │  ← 第 2 次渲染
                    │  └───────────────────────────────┘  │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │       root.pendingLanes             │
                    │   SyncLane | TransitionLaneX         │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │     getNextLanes(root)              │
                    │     检测到 nonTransitionLanes       │
                    │     → 返回 SyncLane                 │  ← Transition 被抑制
                    │     → TransitionLaneX 留在 pending  │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │   渲染 SyncLane（setPending 相关）   │
                    │   → isPending = true/false          │
                    └─────────────────────────────────────┘
                                    │
                  当所有非 Transition lane 处理完毕
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │     getNextLanes(root)              │
                    │     nonTransitionLanes === NoLanes  │
                    │     → 返回 TransitionLaneX          │  ← Transition 被选中
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │   渲染 TransitionLaneX               │
                    │   → setResults 生效                  │  ← 第 3 次渲染（最终）
                    │   → 列表更新                        │
                    └─────────────────────────────────────┘
```

---

##### 10. 对比：useTransition 与直接调用 setState

| 方面 | 直接 setState | startTransition 内的 setState |
|------|-------------|------------------------------|
| Lane 类型 | 根据事件类型（InputContinuous / Default） | TransitionLane（位 5-11） |
| 可中断性 | ❌ 不可中断（同步处理） | ✅ 可被更高优先级打断 |
| 与 Suspense 协作 | 触发 Suspense fallback | 保留旧 UI，不显示 fallback |
| 渲染时机 | 立即处理 | 等到所有高优先级更新完成后 |
| 对其他更新的影响 | 阻塞后续更新 | 让出优先级给输入和交互 |
| 超过 50ms 的渲染 | 阻塞主线程 | 分片 yield 给浏览器 |

---

##### 11. 面试考点——useTransition 核心机制问答

**Q1：useTransition 返回的 isPending 是在什么时候从 true 变回 false 的？**

A：两次。`setPending(true)` 在 callback 执行前，`setPending(false)` 在 callback 执行后（finally 中）。但重要的是：**`setPending(false)` 并不保证 Transition 内的更新已经完成**。它只是在 callback 同步执行完毕后立即触发，表示"过渡已经开始处理了"。Transition 本身的更新可能在后续帧中才完成。

**Q2：一个组件中多次调用 startTransition，它们的优先级一样吗？**

A：不一样。每次 `startTransition` 调用都会通过 `requestTransitionLane()` 分配新的 Lane（如 TransitionLane1、TransitionLane2 等），轮流从 16 个 TransitionLane 中循环分配。所以**后面的 Transition 优先级低于前面的**（因为 Lane 位越高优先级越低）。

**Q3：startTransition 能嵌套使用吗？**

A：可以。外部 Transition 设置 `ReactCurrentBatchConfig.transition`，内部嵌套的 Transition 会通过 `previousTransition` 保存并恢复。嵌套 Transition 内部的 setState 仍然分配 TransitionLane。

**Q4：useTransition 与 useDeferredValue 的区别？**

A：两者底层都使用 TransitionLane，但使用方式不同：
- `useTransition`：手动包装 callback，标记其中的 setState 为低优先级
- `useDeferredValue`：自动将值的更新降级为低优先级（内部调用 `startTransition`）

---

##### 12. 总结——一句话理解 useTransition

> **useTransition 不是让"渲染变慢"，而是让"渲染让步"——通过将 callback 中的 setState 分配到 TransitionLane，让 `getNextLanes` 优先处理用户输入等高优先级更新，从而实现"输入不卡顿、渲染不阻塞"的效果。**

其本质是利用 Lane 优先级系统，在同一个事件处理函数中创建了两个不同优先级的更新流——一个立即执行（isPending），一个可延迟（callback 内的状态）。

#### 6.9.2 useDeferredValue - 延迟低优先级值

```jsx
import { useDeferredValue } from 'react';

function SearchPage({ query }) {
  // deferredQuery 会滞后于 query 更新
  const deferredQuery = useDeferredValue(query);
  const isPending = query !== deferredQuery;

  // 用 deferredQuery 渲染慢列表
  // 用户输入时，input 立即响应，慢列表延迟更新
  const searchResults = useMemo(
    () => filterItems(deferredQuery),
    [deferredQuery]
  );

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}
      <SlowList items={searchResults} />
    </div>
  );
}
```

**内部原理**：

```javascript
function mountDeferredValue(value, initialValue) {
  // 直接返回当前值
  return value;
}

function updateDeferredValue(value, initialValue) {
  // 获取当前挂载的 Hook
  const hook = updateWorkInProgressHook();

  // 获取旧值
  const prevValue = hook.memoizedState;

  // 如果新值和旧值相同，直接返回
  if (Object.is(value, prevValue)) {
    return value;
  }

  // 当前渲染不是 Transition
  // 用旧值调度一个 Transition 更新
  scheduleUpdateOnFiber(fiber, transitionLane);

  // 先返回旧值
  // 新值会在 Transition 中渲染
  return prevValue;
}
```

---

### 6.10 useInsertionEffect - CSS-in-JS 专用

```jsx
import { useInsertionEffect } from 'react';

function useCSS(rule) {
  useInsertionEffect(() => {
    // <style> 插入: 在 DOM 操作前执行
    // 确保样式在布局计算前生效
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(rule);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];

    return () => {
      // 清理
    };
  }, [rule]);
}
```

**执行时机**：

```
mutation (DOM 变更)
      │
      ▼
useInsertionEffect ← 此时执行（DOM 已变，但 Layout 未计算）
      │
      ▼
useLayoutEffect    ← 此时执行（布局已计算）
      │
      ▼
浏览器绘制
      │
      ▼
useEffect          ← 此时执行（绘制完成后）
```

**适用场景**：CSS-in-JS 库（如 styled-components、Emotion）的样式注入。

---

### 6.11 useImperativeHandle - 控制暴露的实例方法

```jsx
// 子组件
const FancyInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    scrollTo: (x, y) => inputRef.current.scrollTo(x, y),
    getValue: () => inputRef.current.value,
  }), []);

  return <input ref={inputRef} {...props} />;
});

// 父组件
function Parent() {
  const fancyRef = useRef(null);

  useEffect(() => {
    fancyRef.current.focus();    // 只暴露了 focus, scrollTo, getValue
    // fancyRef.current.style    // ❌ 无法直接访问 DOM 元素
  }, []);

  return <FancyInput ref={fancyRef} />;
}
```

**内部原理**：

```javascript
function mountImperativeHandle(ref, create, deps) {
  // 创建 Effect 对象，存储 create 函数
  const effect = {
    create: () => {
      // 执行 create 得到暴露的对象
      const imperativeHandle = create();
      // 赋值给 ref.current
      setRef(ref, imperativeHandle);
      return () => setRef(ref, null); // 清理
    },
    deps: deps || null,
    // ...
  };

  // 这个 Effect 在 Layout 阶段执行
  // 确保 ref 在 componentDidMount 前可用
}
```

---

### 6.12 useDebugValue - DevTools 调试

```jsx
function useFriendStatus(friendID) {
  const [isOnline, setIsOnline] = useState(null);

  // 在 React DevTools 中显示自定义标签
  useDebugValue(isOnline ? 'Online' : 'Offline');

  // 延迟格式化（仅在 DevTools 展开时执行）
  useDebugValue(friendID, id => getFriendName(id));

  return isOnline;
}
```

---

### 6.13 自定义 Hooks - 组合模式

#### 6.13.1 工作原理

自定义 Hooks 本质上是**函数组合**，内部调用的 Hook 仍然被 React 管理：

```javascript
function useCustomHook() {
  // 内部调用的 useState, useEffect 等
  // 会被挂载到"调用该 Hook 的组件"的 Fiber 上
  const [state, setState] = useState(0);

  useEffect(() => {
    // ...
  }, [state]);

  return state;
}

// 使用自定义 Hook
function MyComponent() {
  // hook 链表:
  // 1. useState(0)   ← 来自 useCustomHook
  // 2. useEffect()   ← 来自 useCustomHook
  // 3. useState(0)   ← MyComponent 自身

  const value = useCustomHook();
  const [count, setCount] = useState(0);

  return <div>{value} - {count}</div>;
}
```

#### 6.13.2 常用自定义 Hooks 示例

```javascript
// useDebounce - 防抖
function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// useAsync - 异步请求
function useAsync(asyncFn, deps = []) {
  const [state, setState] = useState({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function execute() {
      setState({ data: null, loading: true, error: null });
      try {
        const data = await asyncFn();
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setState({ data: null, loading: false, error });
        }
      }
    }

    execute();
    return () => { cancelled = true; };
  }, deps);

  return state;
}

// useLocalStorage - 本地存储
function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    window.localStorage.setItem(key, JSON.stringify(valueToStore));
  };

  return [storedValue, setValue];
}
```

#### 6.13.3 自定义 Hooks 的规则

```javascript
// ✅ 以 use 开头的函数
function useMyHook() { /* ... */ }

// ❌ 不以 use 开头 - ESLint 不会检查 Hooks 规则
function myHook() { useState(0); } // 不会触发错误

// ✅ 可以在自定义 Hook 中调用其他 Hook
function useData(id) {
  const [data, setData] = useState(null);
  useEffect(() => { fetchData(id).then(setData); }, [id]);
  return data;
}

// ✅ 自定义 Hook 可以互相组合
function useUser(userId) {
  const user = useData(`/users/${userId}`);
  const debouncedUser = useDebounce(user, 500);
  return debouncedUser;
}
```

---

### 6.14 Hooks 与 React 编译器（React Compiler）

React 19 的 React Compiler（Forget）自动记忆化组件，减少手动优化需求：

```javascript
// ❌ 需要手动 useMemo/useCallback
const value = useMemo(() => compute(a, b), [a, b]);
const fn = useCallback(handler, [deps]);

// ✅ React Compiler 自动处理
const value = compute(a, b); // 编译器自动记忆化
const fn = (x) => handler(x); // 编译器自动记忆化
```

**编译器如何分析 Hooks**：

```
1. 分析数据流图
   │
2. 识别"记忆化边界"
   │
3. 自动插入 useMemo/useCallback
   │
4. 验证正确性（遵守 Hooks 规则）
```

但编译器**不会改变 Hooks 的工作机制**，它只是在编译时自动添加了 `useMemo`、`useCallback`、`React.memo` 等调用。

---

### 6.15 总结：Hooks 内部工作机制流程图

```
┌──────────────────────────────────────────────────────────┐
│                   renderWithHooks()                       │
│                                                           │
│  步骤1: 选择 Dispatcher                                    │
│    Mount → HooksDispatcherOnMount                          │
│    Update → HooksDispatcherOnUpdate                        │
│                                                           │
│  步骤2: 执行函数组件                                       │
│    const children = Component(props, secondArg);           │
│                                                           │
│    组件内部:                                               │
│      useState(0) → mountState(0)                          │
│        └─→ 创建 Hook 对象 (#1)                            │
│        └─→ Hook.memoizedState = 0                        │
│        └─→ 创建 dispatch = dispatchSetState               │
│        └─→ 返回 [0, dispatch]                             │
│                                                           │
│      useEffect(fn, []) → mountEffect(fn, [])             │
│        └─→ 创建 Hook 对象 (#2)                            │
│        └─→ pushEffect(HookHasEffect | HookPassive, ...)  │
│        └─→ fiber.updateQueue.lastEffect = effect         │
│                                                           │
│      useRef(null) → mountRef(null)                        │
│        └─→ 创建 Hook 对象 (#3)                            │
│        └─→ Hook.memoizedState = { current: null }        │
│        └─→ 返回 { current: null }                         │
│                                                           │
│    结果: fiber.memoizedState =                            │
│      Hook1({state: 0}) → Hook2({effectObj}) → Hook3(ref) │
│                                                           │
│  步骤3: 切换回 ContextOnlyDispatcher                       │
│    ReactCurrentDispatcher.current = ContextOnlyDispatcher │
└──────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────┐
│                     Commit 阶段                            │
│                                                           │
│  commitBeforeMutationEffects()                            │
│    └─ useEffect cleanup 绑定                              │
│                                                           │
│  commitMutationEffects()                                  │
│    └─ DOM 操作 (增删改)                                   │
│    └─ useInsertionEffect cleanup/create                   │
│    └─ useEffect cleanup (清理函数)                         │
│                                                           │
│  commitLayoutEffects()                                    │
│    └─ useLayoutEffect create (同步执行)                   │
│    └─ 设置 ref                                            │
│                                                           │
│  flushPassiveEffects() (异步, 下一帧)                     │
│    └─ useEffect create (延迟执行)                         │
└──────────────────────────────────────────────────────────┘
```

---

### 6.16 Hooks 常见面试题

> 详细的 Hooks 面试题解答请参见 **[第 10 章：常见面试题与解答](#10-常见面试题与解答)**。
> 以下仅列出与 Hooks 直接相关的核心问题索引：

| 问题 | 关键要点 | 详细解答 |
|------|----------|----------|
| 为什么 Hooks 必须按顺序调用？ | Hook 链表顺序即索引，错位导致状态混乱 | 第 10 章 Q3 |
| useState 和 useReducer 的关系？ | useState = useReducer(basicStateReducer) | 第 6.6.2 节 |
| 为什么 setState 后不能立即读取新值？ | 更新队列 → Render 阶段才计算新值 | 第 6.3.3 节 |
| useEffect 的执行时机？ | 浏览器绘制后异步执行 | 第 6.4.6 节 |
| 为什么不能在条件语句中使用 Hooks？ | 链表顺序固定，条件语句改变调用数量 | 第 10 章 Q3 |

---

### 6.17 Host Transition 机制——连接宿主环境与协调器的桥梁

> Host Transition 是 React 内部最容易被忽视的核心机制之一。
> 它是"宿主环境"（ReactDOM 等）与"Fiber 协调器"之间的桥梁，
> 负责把**浏览器/原生平台触发的动作**（表单提交、事件回调等）转译为协调器能处理的 **Transition 优先级更新**。
>
> 如果你已经理解了 `useTransition` 的用户层机制（第 6.9 节），
> Host Transition 就是它在**宿主层**的对应实现。

#### 6.17.1 为什么要有一个单独的 Host Transition？

`useTransition` / `startTransition` 是用户侧的 API——开发者在组件中主动调用它们来标记低优先级更新：

```jsx
// 用户侧：开发者主动调用
startTransition(() => {
  setResults(filterItems(query));
});
```

但有些场景下，**更新的触发者不是开发者代码，而是宿主环境本身**：

| 场景 | 触发者 | 示例 |
|------|--------|------|
| 表单提交 | 浏览器 `submit` 事件 | `<form action={action}>` |
| Server Action | React DOM 内部拦截 | `<form action={serverAction}>` |
| 同步事件包装 | React 事件系统 | 点击事件内的 setState 同步批量 |
| Error Boundary 重试 | Fiber 协调器 | Transition 失败后的恢复 |

这些场景需要一套 **宿主层到协调器层的协议**——这就是 Host Transition 机制。

```
         ┌────────────────────────────────────────────┐
         │           宿主环境 (ReactDOM)                │
         │                                            │
         │  form submit → FormActionEventPlugin        │
         │  click       → dispatchEvent                │
         │  input       → input event handler          │
         └───────────────────┬────────────────────────┘
                             │ "宿主动作发生了，需要进入 Transition 模式"
                             ▼
         ┌────────────────────────────────────────────┐
         │     startHostTransition (桥接函数)           │
         │                                            │
         │ ① 创建 Transition Context                   │
         │ ② 更新 form fiber 的 hook 状态              │
         │ ③ 调度 re-render（TransitionLane）          │
         └───────────────────┬────────────────────────┘
                             │ "已转换为 Fiber 系统的 Update"
                             ▼
         ┌────────────────────────────────────────────┐
         │         Fiber 协调器                          │
         │                                            │
         │ ④ beginWork → pushHostContext              │
         │ ⑤ HostTransitionContext._currentValue 更新  │
         │ ⑥ 子组件通过 useHostTransitionStatus 读取    │
         └────────────────────────────────────────────┘
```

---

#### 6.17.2 startHostTransition——桥接函数

```javascript
// packages/react-reconciler/src/ReactFiberHooks.js  (~3233)

function startHostTransition(
  formFiber: Fiber,         // 触发 transition 的 fiber（通常是 form fiber）
  pendingState: mixed,       // pending 状态 { pending, data, method, action }
  callback: Function,        // 真正要执行的动作（如 server action）
  options?: { form?: unknown },
): void {
  // ★ (1) 保存之前的 transition 上下文
  const prevTransition = ReactCurrentBatchConfig.transition;

  // ★ (2) 为这个 transition 分配一个新的 lane
  const transition = requestCurrentTransition();
  // requestCurrentTransition() 内部：
  //   → 从 ReactCurrentBatchConfig.transition 获取
  //   → 如果没有，分配新 transition lane (requestTransitionLane())

  // ★ (3) 设置当前 transition 上下文
  ReactCurrentBatchConfig.transition = transition;

  // ★ (4) 更新 form fiber 上的 hook 状态
  //     这个 hook 是 renderTransitionAwareHostComponentWithHooks
  //     在 beginWork 时为 form fiber 安装的内部 hook
  if (formFiber.memoizedState !== null) {
    const stateHook = formFiber.memoizedState;  // 第一个 hook
    stateHook.memoizedState = pendingState;     // 写入 { pending: true, ... }
  }

  // ★ (5) 调度更新——让 form 子树重新渲染
  const root = markUpdateLaneFromFiberToRoot(formFiber, transition.lane);
  ensureRootIsScheduled(root);

  // ★ (6) 执行真正的 callback（更新标记已在上一步完成）
  try {
    callback();
  } finally {
    // ★ (7) 恢复之前的 transition 上下文
    ReactCurrentBatchConfig.transition = prevTransition;

    // ★ (8) 更新为完成状态
    //     action 完成 → pending = false
    if (formFiber.memoizedState !== null) {
      const stateHook = formFiber.memoizedState;
      stateHook.memoizedState = {/* pending: false, data: null, ... */};
    }

    // 再次调度更新——触发 re-render 显示完成状态
    const root = markUpdateLaneFromFiberToRoot(formFiber, transition.lane);
    ensureRootIsScheduled(root);
  }
}
```

**和 `startTransition` (用户层) 的区别**：

| 维度 | `startTransition` (用户层) | `startHostTransition` (宿主层) |
|------|--------------------------|------------------------------|
| 定义位置 | `ReactFiberHooks.js` (公开 API) | `ReactFiberHooks.js` (内部导出) |
| 调用者 | 开发者代码 | 宿主事件系统 (FormActionEventPlugin) |
| 操作对象 | 当前 Fiber (自动捕获) | 传入的 `formFiber` |
| 状态管理 | 通过 `setPending` 手动管理 | 直接操作 `formFiber.memoizedState` |
| Context | 不涉及 | 会更新 `HostTransitionContext._currentValue` |
| 用途 | 标记"任意低优先级更新" | 标记"宿主触发的低优先级更新" |

---

#### 6.17.3 HostTransitionContext——穿透 Provider 的"超高速 Context"

Host Transition 最特别的设计是 `HostTransitionContext`——一个**不依赖 `<Provider>` 组件**的特殊 Context：

```javascript
// packages/react-reconciler/src/ReactFiberHostConfig.js (~6650)

// ★ 定义：一个普通的 React Context，但用法完全不同
const HostTransitionContext = React.createContext(NotPending);
// NotPending = { pending: false, data: null, method: null, action: null }
```

**特殊之处**：

```javascript
// █ 常规 Context：
<MyContext.Provider value={newValue}>  // 必须通过 Provider 组件
  <Child />                             // 子组件通过 useContext 读取
</MyContext.Provider>

// █ HostTransitionContext：
// 不用 Provider！直接在 beginWork 中赋值
HostTransitionContext._currentValue = newState;  // ← 直接写！
```

**为什么可以绕过 Provider？**

```javascript
// packages/react-reconciler/src/ReactFiberHostContext.js

function pushHostContext(fiber: Fiber): void {
  // ★ 检测 form fiber 是否有 hooks（是否有状态）
  const stateHook: Hook | null = fiber.memoizedState;

  if (stateHook !== null) {
    // ★ 直接更新 HostTransitionContext 的当前值！
    //    将其设为 form fiber 第一个 hook 的 memoizedState
    HostTransitionContext._currentValue = stateHook.memoizedState;

    // 推入栈，以便 pop 时恢复
    push(hostTransitionProviderCursor, fiber, fiber);
  }
}

function popHostContext(fiber: Fiber): void {
  // 弹出时恢复为 NotPending
  if (isHostTransitionProvider(fiber)) {
    pop(hostTransitionProviderCursor, fiber);
    HostTransitionContext._currentValue = NotPending;
  }
}
```

**调用时机**：

```
performUnitOfWork → beginWork
                      │
                      ▼
               switch (fiber.tag) {
                 case HostComponent:
                   pushHostContext(fiber);   ← 更新 _currentValue
                   // ... 正常处理
                   popHostContext(fiber);    ← 恢复为 NotPending
               }
```

**为什么这样可以工作？**

因为 `beginWork` 遍历 Fiber 树时，每次进入 form fiber 都会调用 `pushHostContext`，把 `HostTransitionContext._currentValue` 设为 form 的 hook 状态。form 的所有子组件在 `beginWork` 中可以读到：

```javascript
function useHostTransitionStatus(): HostTransitionStatus {
  // ★ 直接读取 _currentValue，不需要经过 Provider 匹配
  return readContext(HostTransitionContext);
}
```

由于 **不需要 Provider 匹配**，省去了 Provider 树构建和更新的开销——这是专门为表单场景做的性能优化。

---

#### 6.17.4 renderTransitionAwareHostComponentWithHooks——让 DOM 元素拥有状态

普通的 DOM 元素（div、span）的 Fiber 是没有 `memoizedState` 的。但 form fiber 需要 hook 来存储 pending 状态。这就需要 **"状态升级"**：

```javascript
// packages/react-reconciler/src/ReactFiberBeginWork.js (~1988)

function renderTransitionAwareHostComponentWithHooks(
  current: Fiber | null,
  workInProgress: Fiber,
  renderLanes: Lanes,
): TransitionStatus {
  // ★ 如果这个 Fiber 之前没有 hooks（首次渲染）
  if (current !== null && current.memoizedState !== null) {
    // 已有 hook → 正常更新
    // 调用内置的 useTransitionStatus hook
    return updateTransitionStatus(workInProgress);
  }

  // ★ 首次安装 hook——让 DOM 元素拥有状态
  //    mountTransitionStatus 内部：
  //    mountWorkInProgressHook()
  //    hook.memoizedState = NotPending
  return mountTransitionStatus(workInProgress);
}
```

**关键原则**：

> "Once a fiber is upgraded to be stateful, it remains stateful for the rest of its lifetime."

一旦 form fiber 被安装了 hook（变成 stateful fiber），这个 hook 会一直存在直到 Fiber 被销毁。这意味着 `pushHostContext` 每次都能读到非 null 的 `memoizedState`，从而执行 `_currentValue` 更新。

```
首次渲染（form fiber 无 hook）：
  pushHostContext → stateHook === null → 跳过 _currentValue 更新
                    ↓
  beginWork → renderTransitionAwareHostComponentWithHooks → mountTransitionStatus
                    ↓
  completeWork → form fiber 有了 memoizedState

后续渲染（form fiber 有 hook）：
  pushHostContext → stateHook !== null → _currentValue = form 的 hook 状态
                    ↓
  beginWork → renderTransitionAwareHostComponentWithHooks → updateTransitionStatus
                    ↓
  completeWork → form fiber 的 memoizedState 已更新
```

---

#### 6.17.5 完整生命周期——以 form submit 为例

将上述所有环节串起来：

```jsx
function ContactForm() {
  const [state, formAction] = useActionState(updateUser, null);

  return (
    <form action={formAction}>    {/* Form Action */}
      <StatusDisplay />           {/* useFormStatus 子组件 */}
      <input name="email" />
      <button type="submit">提交</button>
    </form>
  );
}

function StatusDisplay() {
  const { pending, data } = useFormStatus();
  return <div>{pending ? '提交中...' : '就绪'}</div>;
}
```

用户点击提交时的完整链路：

```
═══ 第 1 阶段：事件拦截 ═══

用户点击提交 → 浏览器触发 form submit 事件
                          │
                 FormActionEventPlugin 拦截
                          │
                          ▼
            startHostTransition(
              formFiber,                   ← form 的 Fiber
              { pending: true, data, ... }, ← pending 状态
              formAction(data)             ← 真正的 action 函数
            )

═══ 第 2 阶段：桥接到协调器 ═══

startHostTransition：
  ├─ (1) 请求 TransitionLane（lane = TransitionLaneX）
  ├─ (2) ReactCurrentBatchConfig.transition = { name: '', _lane: lane }
  ├─ (3) formFiber.memoizedState.memoizedState = { pending: true, data, ... }
  │      ← 直接写 form fiber 的 hook 状态
  ├─ (4) markUpdateLaneFromFiberToRoot → root.pendingLanes |= lane
  ├─ (5) ensureRootIsScheduled(root)    → 触发调度
  ├─ (6) callback()                     → 执行 server action（异步）
  └─ (7) 等待 action 完成...

═══ 第 3 阶段：渲染传播（beginWork） ═══

Scheduler 到期 → performConcurrentWorkOnRoot
                          │
                getNextLanes → 选中 TransitionLaneX
                          │
                beginWork 遍历 Fiber 树
                          │
          进入 form fiber（HostComponent tag）
                          │
                pushHostContext(formFiber):
                  stateHook = formFiber.memoizedState
                  stateHook !== null
                  → HostTransitionContext._currentValue
                    = { pending: true, data, ... }  ← 写入
                          │
                renderTransitionAwareHostComponentWithHooks
                  → updateTransitionStatus
                  → hook 返回当前 pending 状态
                          │
                beginWork(StatusDisplay):
                  useFormStatus() → useHostTransitionStatus()
                  → readContext(HostTransitionContext)
                  → { pending: true, data, ... }
                  → StatusDisplay 渲染 "提交中..."

═══ 第 4 阶段：action 完成 ═══

Server Action 返回响应
                          │
                startHostTransition 的 finally 块：
                  ├─ formFiber.memoizedState.memoizedState
                  │  = { pending: false, data: response }
                  ├─ markUpdateLaneFromFiberToRoot
                  └─ ensureRootIsScheduled → 再次渲染

              这次 HostTransitionContext._currentValue
              = { pending: false, data: response }
              → StatusDisplay 渲染 "就绪"
```

---

#### 6.17.6 Host Transition 与常规 Transition 的完整对比

| 维度 | 常规 Transition (`startTransition`) | Host Transition (`startHostTransition`) |
|------|------------------------------------|----------------------------------------|
| **触发者** | 开发者代码 | 宿主环境（ReactDOM 事件系统） |
| **入口函数** | `startTransition(scope)` | `startHostTransition(fiber, state, callback)` |
| **Lane 分配** | `requestUpdateLane` 检测 `ReactCurrentBatchConfig.transition` | 同左（走相同路径） |
| **状态存储** | 组件自身的 `useState` hook | form fiber 的内部 hook |
| **状态传播** | 通过 Props/Context | 通过 `HostTransitionContext._currentValue` 直接写 |
| **跨组件通信** | 需要 `<Context.Provider>` | 无需 Provider，`pushHostContext` 直接写值 |
| **性能特点** | 正常 Fiber 调度 | 零开销 Context 传播（无 Provider 树） |
| **使用场景** | 搜索、过滤、导航 | 表单提交、Server Action、Error Boundary |
| **React 版本** | React 18+ | React 18+(事件系统) / React 19+(表单) |

---

#### 6.17.7 核心洞察——为什么需要这个机制？

1. **解耦宿主环境与协调器**：ReactDOM 不需要知道 Fiber Reconciliation 的细节，只需调用 `startHostTransition`，协调器自己处理优先级和渲染。

2. **性能优势**：`HostTransitionContext` 绕过 `<Provider>` 组件，直接在 `beginWork` 中赋值，避免了 Provider 树的 diff 开销。

3. **优先级隔离**：Host Transition 分配的是 `TransitionLane`（位 5-11），低于用户输入的 `InputContinuousLane`（位 2-3），确保表单提交不会阻塞用户输入。

4. **状态一致性**：form fiber 的 hook 状态是 `HostTransitionContext` 的单一数据源，`startHostTransition` 写 hook → `pushHostContext` 读 hook → `useHostTransitionStatus` 消费，形成完整的单向数据流。

---

#### 6.17.8 一句话总结

> **Host Transition 是 React 宿主环境（ReactDOM）与 Fiber 协调器之间的"协议适配层"——它将浏览器原生的动作（表单提交、事件回调）转译为 Transition Lane 更新，通过 `HostTransitionContext._currentValue` 直接写值的方式，以零 Provider 开销在 Fiber 子树中传播 pending 状态。**

---

> **📖 关于事件系统与 Form Action 拦截的完整内容已独立为第 7 章：**
> **[第 7 章：React 事件系统与 Form Action 拦截机制](#7-react-事件系统与-form-action-拦截机制)**
>
> 包括：
> - 7.1 React 的事件处理流程——dispatchEvent、插件架构、SyntheticEvent
> - 7.2 深入 FormActionEventPlugin——渲染时过滤 + 事件时拦截的两层机制
> - 7.3 事件插件体系对比——为什么只有 FormAction 做拦截？

---

## 7. React 事件系统与 Form Action 拦截机制

> 本章紧接第 6.17 节 Host Transition 机制，完整介绍 React 的事件处理体系。
> **前半部分**回答"React 如何处理不同事件"——事件委托、插件架构、SyntheticEvent。
> **后半部分**回答"React 如何专门拦截 form 的 action"——FormActionEventPlugin 的两层拦截机制。

### 7.1 React 的事件处理流程——从 DOM 到 Fiber

React 没有把事件监听器直接绑在每个 DOM 元素上。而是采用**事件委托**模式——

所有事件都统一监听在根容器（rootContainer）上，通过一个统一的 `dispatchEvent` 函数分发：

```
开发者写:                     <button onClick={handler} />
                                      │
React 渲染成 DOM:              <button>click me</button>
                                      │
  ┌── React 不在这里监听 ──────┘
  │
  ▼
┌──────────────────────────────────────────────────┐
│  rootContainer                                    │
│  ├── click (监听)    ← SimpleEventPlugin 注册     │
│  ├── submit (监听)   ← FormActionEventPlugin 注册 │
│  ├── change (监听)   ← ChangeEventPlugin 注册     │
│  ├── keydown (监听)                              │
│  ├── input (监听)                                │
│  └── ...几乎所有事件                               │
└──────────────────────────────────────────────────┘
           │
           ▼ (用户点击 button)
事件冒泡到 rootContainer
           │
           ▼
统一入口 dispatchEvent(domEventName, ...)
           │
           ▼
① 从 nativeEvent.target 获取真实 DOM 节点
② 通过 __reactFiber$... 反向查找对应的 Fiber 节点
③ 从 Fiber 向上遍历（事件捕获阶段模拟）
④ 从目标向下遍历（事件冒泡阶段模拟）
⑤ 创建 SyntheticEvent（标准化事件对象）
⑥ 调用开发者注册的 onClick handler
```

#### 7.1.1 入口：dispatchEvent

```javascript
// packages/react-dom-bindings/src/events/ReactDOMEventListener.js

function dispatchEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent) {
  // ★ Step 1: 从 nativeEvent.target 反向查找 Fiber
  const nativeEventTarget = getEventTarget(nativeEvent);
  const targetInst = getClosestInstanceFromNode(nativeEventTarget);
  // targetInst 就是事件目标对应的 Fiber 节点

  // ★ Step 2: 根据事件类型决定调度策略
  //    离散事件（click, keydown, touchstart）→ 同步
  //    连续事件（scroll, wheel）→ InputContinuousLane
  //    其他      → DefaultLane
  switch (domEventName) {
    case 'click':
    case 'keydown':
    case 'keyup':
      // 离散事件：在当前同步任务中执行（不可打断）
      dispatchDiscreteEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent);
      break;
    case 'scroll':
    case 'wheel':
    case 'mouseover':
      // 连续事件：可在下一帧执行
      dispatchContinuousEvent(domEventName, eventSystemFlags, targetContainer, nativeEvent);
      break;
    default:
      // 默认：走正常调度流程
      dispatchEventDefault(domEventName, eventSystemFlags, targetContainer, nativeEvent);
  }

  // ★ Step 3: 进入事件插件系统
  //    dispatchDiscreteEvent / dispatchEventDefault 最终都调用
  //    dispatchEventsForPlugins → 遍历所有插件 → extractEvents
}
```

#### 7.1.2 插件架构：谁处理什么事件

React 采用**插件架构**来处理不同类型的事件。每种插件只负责自己注册的事件类型：

```javascript
// packages/react-dom-bindings/src/events/EventPluginRegistry.js

// React 初始化时，按顺序注册所有插件
const plugins = [
  SimpleEventPlugin,           // ① 最通用的插件——处理 90%+ 的事件
  FormActionEventPlugin,       // ② 专门处理 form action（React 19 新增）
  ChangeEventPlugin,           // ③ 标准化 change 事件（浏览器差异兼容）
  EnterLeaveEventPlugin,       // ④ 合成 enter/leave 事件
  SelectEventPlugin,           // ⑤ 标准化文本选择事件
  BeforeInputEventPlugin,      // ⑥ 处理 IME 输入法事件
];
```

| 插件 | 注册的事件 | 职责 | 类型 |
|------|-----------|------|------|
| **SimpleEventPlugin** | click, dblclick, keydown, keyup, keypress, focus, blur, scroll, wheel, mouseup, mousedown, mousemove, mouseover, mouseout, touchstart, touchend, touchmove, pointerdown, pointerup, pointermove, drag, drop, ... | 通用事件监听与标准 SyntheticEvent 封装 | 纯监听 |
| **FormActionEventPlugin** | submit | 检查 form 的 action prop，如果是函数则拦截提交并转给 `startHostTransition` | **拦截替换** 🔥 |
| **ChangeEventPlugin** | change, input | 标准化不同浏览器中 change 事件的触发时机 | 标准化 |
| **EnterLeaveEventPlugin** | mouseenter, mouseleave, pointerenter, pointerleave | 合成 enter/leave 事件使其冒泡 | 标准化 |
| **SelectEventPlugin** | select, selectionchange | 统一文本选择事件 API 差异 | 标准化 |
| **BeforeInputEventPlugin** | beforeinput, compositionstart, compositionupdate, compositionend | 处理 IME 输入法组合输入 | 标准化 |

#### 7.1.3 从原生事件到 SyntheticEvent

```javascript
// SimpleEventPlugin.extractEvents 的简化逻辑：

function extractEvents(dispatchQueue, domEventName, targetInst, nativeEvent, nativeEventTarget) {
  if (!SimpleEventPlugin.isSupportedEvent(domEventName)) {
    return;  // 不是自己负责的事件，跳过
  }

  // ★ 创建 SyntheticEvent（React 的标准化事件包装）
  const event = new SyntheticEvent(domEventName, nativeEvent);

  // ★ 遍历 Fiber 树上所有注册了这个事件的监听器
  //    从目标 Fiber 开始，向上遍历到 root
  //    模拟事件捕获（capture phrase）和冒泡（bubble phrase）阶段
  accumulateSinglePhaseListeners(
    targetInst,
    event,
    domEventName,
    dispatchQueue,
  );
}
```

**事件传播的 Fiber 遍历**：

```
Fiber 树遍历（以 click 为例）：

  ① rootFiber（捕获阶段开始）
  ② AppFiber
  ③ ButtonFiber（目标）             ← 从 nativeEvent.target 找到这里
      ↓
  ④ ButtonFiber → 有 onClick? → 加入队列
  ⑤ AppFiber → 有 onClick? → 加入队列（冒泡阶段）
  ⑥ rootFiber → 有 onClick? → 加入队列

  → 最终 dispatchQueue 中按顺序排列所有监听器
  → 逐个执行
```

#### 7.1.4 事件处理流程小结

```
用户在浏览器中操作
      │
      ▼
浏览器创建原生 DOM 事件 (nativeEvent)
      │
      ▼ 冒泡到 rootContainer
      │
React dispatchEvent 拦截
      │
      ├── Step 1: 从 nativeEvent.target 反向查找 Fiber
      ├── Step 2: 根据事件类型确定调度优先级
      │     (同步 / InputContinuous / Default)
      ├── Step 3: 调用 dispatchEventsForPlugins
      │
      ▼
遍历事件插件
      │
      ├── FormActionEventPlugin.extractEvents?
      │     → 检查是否为 submit + action 是函数
      │     → 是 → 拦截 (preventDefault + startHostTransition)
      │     → 否 → 跳过
      │
      ├── SimpleEventPlugin.extractEvents?
      │     → 创建 SyntheticEvent → 收集监听器 → 加入 dispatchQueue
      │
      └── 其他插件同流程
      │
      ▼
执行 dispatchQueue 中的监听器
      │
      └── 开发者注册的 onClick / onSubmit / onChange 被调用
```

---

### 7.2 深入 FormActionEventPlugin——form action 的拦截

> 这是上一节"插件概览"中最特殊的那个插件。它不满足于"监听并分发给回调"，
> 而是要**拦截浏览器的默认行为，替换为 React 的 Host Transition 机制**。

#### 7.2.1 第一层拦截：渲染时——不让函数 action 进入 DOM

React 19 中 `<form>` 的 `action` prop 可以接受三种类型：

| 类型 | 示例 | DOM 行为 |
|------|------|---------|
| `string` | `action="/api/submit"` | 设为 HTML `action` 属性（默认行为） |
| `function` | `action={serverAction}` | **不设为 HTML 属性**，React 代管 |
| `undefined` | 没写 action | 使用默认 URL（当前页） |

关键在第二种情况——React **故意不把函数值传递给 DOM**：

```javascript
// packages/react-dom-bindings/src/ReactDOMComponent.js

function setProp(domElement, tag, key, value, props, prevValue) {
  // ★ 当 key === 'action' 且 value 是函数时
  if (key === 'action' && typeof value === 'function') {
    // ← 跳过！不设为 HTML 属性
    // → form 的 HTML action 保持为默认值（当前页 URL）
    return;
  }

  // 正常 prop 处理（字符串 action 走这里）
  if (shouldSetAttribute(key, value)) {
    domElement.setAttribute(key, value);
  }
}
```

**为什么跳过？** 如果设了 `form.setAttribute('action', someFunction)`，浏览器会调用 `toString()` 把它变成 `"function serverAction() { ... }"` 这种无用字符串。

所以流程是：

```
开发者写:             <form action={updateUser}>
                         │
                    props.action = updateUser (函数)
                         │
                 setProp 检测到 key='action' && typeof === 'function'
                         │
                         ▼
                  不设置 HTML attribute
                  但 updateUser 保留在 memoizedProps 中
                         │
                  form 元素的 HTML action 属性
                  = 默认值（当前页 URL）
```

#### 7.2.2 第二层拦截：事件时——拦截并替换默认提交

当用户点击提交按钮时，浏览器触发 `submit` 事件。`FormActionEventPlugin` 在事件插件系统中被调用：

```javascript
// packages/react-dom-bindings/src/events/FormActionEventPlugin.js

const FormActionEventPlugin = {
  // ★ 注册阶段：告诉事件系统我要监听 submit 事件
  registerEvents: function() {
    registerSimpleEvent('submit', {
      capture: false,        // 不在捕获阶段监听
      passive: false,        // 不声明 passive（因为要 preventDefault）
    });
  },

  // ★ 提取阶段：当 submit 事件发生时被调用
  extractEvents: function(
    dispatchQueue,    // React 的事件队列
    domEventName,     // 事件名（'submit'）
    targetInst,       // 事件目标对应的 Fiber
    nativeEvent,      // 原生事件对象
    nativeEventTarget // 事件目标 DOM 节点
  ) {
    if (domEventName !== 'submit') {
      return;  // 只处理 submit 事件
    }

    // ★ 从 form 元素的 memoizedProps 中读取 action
    const action = targetInst.memoizedProps?.action;

    // ★ 关键检查：action 是不是函数？
    if (typeof action === 'function') {
      // ★ (1) 阻止浏览器默认提交（页面刷新/导航）
      nativeEvent.preventDefault();

      // ★ (2) 创建 pending state
      const pendingState = { pending: true, data: new FormData(form), method: 'POST', action };

      // ★ (3) 调用 startHostTransition——桥接到 Fiber 协调器
      startHostTransition(targetInst, pendingState, action, { form });

      // ★ (4) 清空 dispatchQueue（不需要生成 SyntheticEvent）
      dispatchQueue.length = 0;
    }
    // 如果 action 不是函数（字符串 URL 或 undefined）
    // → 不拦截，走正常的 SimpleEventPlugin 处理
  }
};
```

**从 DOM 到 Fiber 的反向查找**——React 在每个由它渲染的 DOM 节点上设置**内部属性**：

```javascript
// React 的内部机制：DOM → Fiber 的反向映射
// 每个由 React 渲染的 DOM 节点上都有一个隐藏属性：

// ★ 关键属性名规则
// React 18+: element[`__reactFiber$${secret}`] = fiber

function getClosestInstanceFromNode(targetNode) {
  // ★ 从 DOM 节点直接读取 Fiber 引用（O(1) 查找）
  const fiber = targetNode[internalInstanceKey];
  return fiber;
}
```

#### 7.2.3 完整拦截链路图

```
React 开发者写的 JSX:
  <form action={updateUser}>
    <button type="submit">提交</button>
  </form>
                    │
                    ▼
┌─── 阶段 1: 渲染阶段 ──────────────────────────────────┐
│  diffProperties(formElement, nextProps, prevProps)    │
│    → 遍历所有 prop                                     │
│    → 遇到 key='action', value=updateUser (函数)        │
│    → setProp 跳过，不设 HTML 属性                      │
│    → memoizedProps.action = updateUser (已保存)         │
│                                                       │
│  最终 DOM 上: <form>                    (没有 action attribute) │
└───────────────────────────────────────────────────────┘
                    │
                    ▼  (用户点击提交按钮)
                    │
┌─── 阶段 2: 事件拦截 ──────────────────────────────────┐
│  ① 浏览器原生 submit 事件触发                          │
│  ② 冒泡到 rootContainer → React 的 dispatchEvent       │
│  ③ 通过 __reactFiber$... 找到 Fiber                    │
│  ④ FormActionEventPlugin 被调用                        │
│  ⑤ 读取 targetInst.memoizedProps.action               │
│  ⑥ typeof action === 'function' → ✅                  │
│  ⑦ nativeEvent.preventDefault()                       │
│  ⑧ startHostTransition(fiber, state, action, form)    │
│     → form fiber hook → TransitionLane → 渲染          │
└───────────────────────────────────────────────────────┘
```

---

### 7.3 事件插件体系对比——其他事件也有拦截吗？

**结论：没有。`FormActionEventPlugin` 是唯一一个做"拦截替换"的插件。**

#### 三种处理层次

| 层次 | 说明 | 属于 |
|------|------|------|
| **① 注册监听** | 在 root 上绑定事件类型 | **所有插件** |
| **② 标准化** | 统一跨浏览器差异 | `ChangeEventPlugin`, `BeforeInputEventPlugin`, `SelectEventPlugin` |
| **③ 拦截替换** | 阻止浏览器默认行为，替换为 React 逻辑 | **只有 `FormActionEventPlugin`** |

#### 为什么其他插件不做拦截？

React 的设计原则：**React 不替开发者做默认行为决策**。

```javascript
// 其他场景：React 不会自动阻止默认行为

// 点击链接：<a href="/page" onClick={handler}>
// → React 调用 handler，但不阻止浏览器导航到 /page
// → 如果开发者想阻止：必须在 handler 中手动 e.preventDefault()

// 右键菜单：<div onContextMenu={handler}>
// → React 调用 handler，但不阻止浏览器显示右键菜单
// → 同上，需开发者手动 e.preventDefault()

// ★ 唯一例外：Form Action
// → <form action={serverAction}>
// → React 自动阻止默认提交
// → 原因：函数 action 不可能是合法 URL
// → React 确定地知道"这里必须拦截"
```

#### 对比总结表

| 维度 | `FormActionEventPlugin` | 其他插件 |
|------|------------------------|---------|
| 事件类型 | `submit` | click, change, input, keydown, scroll ... |
| 自动 `preventDefault` | ✅ 自动执行 | ❌ 开发者手动 |
| 行为替换 | ✅ `startHostTransition` | ❌ 纯监听 |
| 存储 action 函数 | ✅ 存 `memoizedProps` | ❌ 不涉及 |
| DOM 属性过滤 | ✅ 过滤函数 action | ❌ 不过滤 |
| 优先级干预 | ❌ 走 TransitionLane | ✅ 按事件类型分配不同 Lane |
| React 版本 | React 19+ | React 17+ |

---

### 7.4 章节关系图

```
  ┌──────────────────────────────────────────────────────────┐
  │       第 6 章 §6.17  (Host Transition 机制)               │
  │   startHostTransition → form fiber hook → HostTransition │
  └────────────────────────┬─────────────────────────────────┘
                           │ "输入"
                           ▼
  ┌──────────────────────────────────────────────────────────┐
  │       第 7 章   (本章)                                    │
  │   ├─ 7.1: React 事件系统全貌（委托 + 插件 + Synthetic)    │
  │   ├─ 7.2: FormActionEventPlugin 拦截机制（两阶段）         │
  │   └─ 7.3: 对比——只有 FormAction 做拦截                    │
  └──────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
            ▼                             ▼
  ┌────────────────────┐      ┌──────────────────────┐
  │  第 8 章 源码映射   │      │  React19 学习笔记     │
  │                    │      │  useFormStatus        │
  │                    │      │  useActionState       │
  │                    │      │  useOptimistic        │
  └────────────────────┘      └──────────────────────┘
```

---

## 8. 关键源码文件映射

### 8.1 文件组织结构

```
packages/react-reconciler/
├── ReactFiberRootScheduler.js    // 任务调度器
├── ReactFiberReconciler.js       // Fiber 协调器（入口）
├── ReactFiberWorkLoop.js         // 渲染循环（render 阶段主逻辑）
├── ReactFiberBeginWork.js        // beginWork（构建 Fiber）
├── ReactFiberCompleteWork.js     // completeWork（处理 DOM）
├── ReactFiberCommitWork.js       // commit 阶段（执行 Effect）
├── ReactChildFiber.js            // 子 Fiber 处理
└── ReactFiberHooks.js            // Hooks 实现

packages/scheduler/
├── src/Scheduler.js              // 调度器核心逻辑
└── src/SchedulerMinHeap.js       // 最小堆（任务队列）
```

### 8.2 核心函数调用链

```
用户调用 setState()
    ↓
dispatchSetState()
    ↓
scheduleUpdateOnFiber()
    ↓
ensureRootIsScheduled()
    ↓
scheduleCallback() [Scheduler]
    ↓
performWorkOnRoot()
    ↓
renderRoot() [Render 阶段]
    ├── beginWork()
    ├── completeWork()
    └── ...
    ↓
commitRoot() [Commit 阶段]
    ├── commitBeforeMutationEffects()
    ├── commitMutationEffects()
    ├── commitLayoutEffects()
    └── commitPassiveEffects()
```

---

## 9. 推荐学习资源

### 9.1 官方资源

1. **React 官方文档**：https://react.dev/
   - 最权威、最新的学习资料
   - 包含最新的最佳实践和 API 文档

2. **React 官方博客**：https://react.dev/blog
   - 了解 React 版本更新和新特性
   - 核心文章：
     - [React v18.0 发布公告](https://react.dev/blog/2022/03/29/react-v18) - **必读**
     - [React 18 升级指南](https://react.dev/blog/2022/03/08/react-18-upgrade-guide)
     - [React Labs：我们正在研究什么](https://react.dev/blog/the-plan-for-react-18)

3. **React 18 工作组讨论**：https://github.com/reactwg/react-18/discussions
   - 核心团队成员（Dan Abramov、Andrew Clark 等）的深度讨论
   - 了解设计决策的最佳来源

4. **React Fiber 架构文档**：https://github.com/acdlite/react-fiber-architecture
   - Andrew Clark（Fiber 架构作者）撰写的权威文档
   - **非官方但最权威的 Fiber 内部机制解释**

### 9.2 英文顶级创作者

#### 核心团队成员

| 创作者 | 平台 | 特点 |
|--------|------|------|
| **Dan Abramov** | [overreacted.io](https://overreacted.io), Twitter @dan_abramov | Redux 作者，React 核心成员。从设计理念角度讲解，不适合初学者，但极其深入 |
| **Andrew Clark** | GitHub @acdlite | Fiber 架构作者，React 协调算法核心开发者 |
| **Sebastian Markbage** | Twitter @sebmarkbage | React 核心架构师，技术深度无与伦比 |

#### 教育类博主

| 创作者 | 平台 | 核心内容 |
|--------|------|----------|
| **Kent C. Dodds** | [kentcdodds.com](https://kentcdodds.com), EpicReact.dev | React 测试、Hooks 最佳实践、设计模式。顶级教育者，EpicReact.dev 课程出色 |
| **Josh W. Comeau** | [joshwcomeau.com](https://www.joshwcomeau.com) | React 动画、CSS-in-JS、交互式教程。精美交互式博客，视觉效果极佳 |
| **Mark Erikson** | [blog.isquaredsoftware.com](https://blog.isquaredsoftware.com), Twitter @acemarke | Redux、React 状态管理、React 社区年度总结。Redux 维护者，技术深度极高 |
| **Robin Wieruch** | [robinwieruch.de](https://www.robinwieruch.de) | React 全栈、GraphQL、Firebase。出色的免费教程和书籍 |

#### YouTube 频道

| 频道 | 特点 | 适合人群 |
|------|------|----------|
| **Web Dev Simplified** | 简化复杂 Web 开发概念 | 进阶理解 |
| **Codevolution** | 完整 React/TypeScript 系列，结构严谨 | 系统学习 |
| **Dave Gray** | 9 小时 React 入门全教程 | 初学者 |
| **Jack Herrington** | React 架构、Next.js、TanStack、React Compiler | 中高级 |
| **fireship** | 短小精悍 React 概览 | 快速了解 |

### 9.3 中文深度学习资源

#### 顶级博主

| 创作者 | 平台 | 核心内容 | 特点 |
|--------|------|----------|------|
| **卡颂 (Kasong)** | [kasong.blog](https://kasong.blog), 掘金 @卡颂 | React 源码解析、Fiber 架构、React 原理 | 《React 设计原理》作者，中文 React 源码分析第一人 |
| **黄玄 (Hux)** | [huangxuan.me](https://huangxuan.me), GitHub @huxpro | React 核心团队（前成员）、Hermes 引擎 | 曾就职于 Facebook React 团队，深度无与伦比 |
| **神说要有光** | 掘金 @神说要有光 | React 底层原理、前端工程化 | 源码级解析，内容硬核 |
| **冴羽** | 掘金 @冴羽 | JavaScript 深入系列、React 相关 | 扎实的 JS 基础内容，对理解 React 帮助大 |
| **逐浪前端** | 掘金 | React 18 源码解析系列 | 通俗易懂的 React 源码系列 |

#### 中文社区聚合平台

- **掘金 ([juejin.cn](https://juejin.cn))** - 搜索 "React 源码"、"React Fiber"、"React 18"
- **知乎专栏** - 许多 React 深度系列文章
- **SegmentFault** - 提问和文章都有
- **React 中国论坛 ([react-china.org](https://react-china.org))**
- **React 官方中文文档 ([zh-hans.react.dev](https://zh-hans.react.dev))**

### 9.4 高质量文章推荐

#### Fiber 架构深度解析

| 文章 | 难度 | 核心内容 |
|------|------|----------|
| [A deep dive into React Fiber - LogRocket](https://blog.logrocket.com/deep-dive-react-fiber) | 中高级 | 最完整的 Fiber 详解，涵盖 v16 到 v18 的演进 |
| [React Reconciliation Explained - DEV.to](https://dev.to/crit3cal/react-reconciliation-explained-a-technical-deep-dive-into-the-virtual-dom-and-fiber-architecture-1k44) | 中高级 | 技术深度解析，含实际优化案例 |
| [Understanding React Fiber - LevelUp](https://levelup.gitconnected.com/understanding-react-fiber-a-breakdown-of-reconciliation-and-its-evolution-3791b77079ee) | 中高级 | 从 Stack Reconciler 到 Fiber 的演变，逻辑清晰 |
| [React Fiber and Concurrent Rendering - DEV.to](https://dev.to/yorgie7/react-fiber-and-concurrent-rendering-2hbe) | 高级 | 高级指南，代码示例详实 |

#### 并发渲染相关

| 文章 | 难度 | 核心内容 |
|------|------|----------|
| [React 18 Concurrent Rendering Explained - Medium](https://medium.com/dev-simplified/react-18-concurrent-rendering-explained-a-practical-guide-for-modern-developers-1630909d49d6) | 初中级 | 实践导向，含自动批处理和调度策略 |
| [Concurrent Rendering in React 18 - Telerik](https://www.telerik.com/blogs/concurrent-rendering-react-18) | 初中级 | 详细对比同步 vs 并发渲染 |
| [React 18 New Features - freeCodeCamp](https://www.freecodecamp.org/news/react-18-new-features) | 初中级 | 并发渲染、自动批处理、Suspense 快速概览 |

#### React 内部工作机制

| 文章 | 难度 | 核心内容 |
|------|------|----------|
| [How React Works Internally - NamasteDev](https://namastedev.com/blog/how-react-works-internally) | 中级 | 架构、生命周期、渲染算法全覆盖 |
| [Understanding the React Fiber Architecture - NamasteDev](https://namastedev.com/blog/understanding-the-react-fiber-architecture-2) | 中高级 | Fiber 数据结构、增量渲染、优先级 |

### 9.5 推荐学习路径

#### 路径 A：深入理解的系统化学习

```
阶段 1 - JavaScript 基础扎实
  -> 闭包、原型链、事件循环、Promise/async-await、Map/Filter/Reduce
  -> 推荐：Kyle Simpson "You Don't Know JS" 系列

阶段 2 - React 基础
  -> 官方文档 (react.dev/learn) 完整过一遍
  -> 构建 2-3 个小项目（Todo、计数器等）

阶段 3 - Hooks 深入
  -> useState / useEffect / useRef / useContext / useReducer
  -> 自定义 Hook 练习
  -> 推荐：Kent C. Dodds EpicReact.dev 或 Robin Wieruch 教程

阶段 4 - 虚拟 DOM 和 Reconciliation
  -> 理解 Stack Reconciler vs Fiber Reconciler
  -> 阅读上述 Fiber 架构文章

阶段 5 - React 18 并发模式
  -> startTransition、useDeferredValue、Suspense
  -> 自动批处理、流式 SSR

阶段 6 - React 19 / 新生态
  -> Server Components、Actions API、use()、useOptimistic
  -> React Compiler 理解

阶段 7 - 框架深入
  -> Next.js (App Router)、或 Remix、TanStack Start
  -> 状态管理 (Zustand / Jotai / Redux Toolkit)
  -> 数据获取 (TanStack Query)
```

#### 路径 B：视频主导的快速入门

1. **Dave Gray** - [React JS Full Course for Beginners](https://www.youtube.com/watch?v=RVFAyFWO4jE) (9小时，2025)
2. **SuperSimpleDev** - [React Tutorial Full Course Beginner to Pro](https://www.youtube.com/watch?v=TtPXvEcE11E) (React 19, 2025，77万+观看)
3. **Codevolution** - YouTube 频道，结构化 React 课程

#### 路径 C：中文学习路径

1. **掘金 React 标签** - 关注卡颂、神说要有光等创作者
2. **卡颂《React 设计原理》** - 中文最系统的 React 原理书籍
3. **React 中文文档** - [zh-hans.react.dev](https://zh-hans.react.dev) 质量很高
4. **B站** - 搜索 "React 源码"、"React Fiber 讲解"

### 9.6 源码阅读工具

1. **React 源码在线浏览**：
   - GitHub: https://github.com/facebook/react
   - 使用 Commit hash 固定版本：`#9e8857f8e0db90485276c5e091e0171d640971d6`（React 18.3）

2. **React 源码调试**：
   - 使用 React DevTools 调试组件
   - Chrome DevTools Performance 面板分析渲染性能

3. **推荐阅读顺序**：
   ```
   1. ReactFiberWorkLoop.js (渲染主循环)
   2. ReactFiberBeginWork.js (构建 Fiber)
   3. ReactFiberCompleteWork.js (处理 DOM)
   4. ReactFiberCommitWork.js (提交阶段)
   5. ReactFiberHooks.js (Hooks 实现)
   ```

### 9.7 持续关注来源

1. **React 官方博客** ([react.dev/blog](https://react.dev/blog)) - 最权威的发布说明
2. **Mark Erikson 年度 React 社区总结** - 全面覆盖 React 生态系统
3. **JSParty 播客** - 经常邀请 React 核心团队成员
4. **React Conf / React Advanced 演讲视频** - YouTube 搜索
5. **React RFCs** ([github.com/reactjs/rfcs](https://github.com/reactjs/rfcs)) - 了解 React 设计方向

### 9.8 最推荐组合

- **入门**：官方文档 + Dave Gray YouTube 课程
- **深入**：卡颂《React 设计原理》+ LogRocket Fiber 深度文章
- **实战**：EpicReact.dev (Kent C. Dodds) + Jack Herrington YouTube
- **前沿**：关注 Dan Abramov (Overreacted)、Mark Erikson 年度总结、React 官方博客

---

## 10. 常见面试题与解答

### Q1: React 为什么要引入 Fiber 架构？

**答**：
1. **解决同步渲染阻塞问题**：React 16 之前，递归 Diff 算法一旦开始就会执行到底，无法中断，导致复杂应用在低性能设备上卡顿。
2. **支持任务优先级**：不同更新可以有不同优先级（如用户交互 > 数据获取 > 后台分析）。
3. **为并发模式奠基**：Fiber 的可中断特性是 React 18 并发特性的基础。
4. **更好的错误恢复**：Fiber 架构支持错误边界，可以捕获渲染错误而不影响整个应用。

### Q2: React 的 Diff 算法为什么是 O(n) 复杂度？

**答**：
React 使用了三个启发式假设：
1. **只对同层级节点比较**：不跨层级 Diff，避免指数级复杂度。
2. **不同类型直接替换**：不同组件类型的节点视为完全不同，直接销毁重建。
3. **通过 key 识别复用**：同类型节点通过 key 判断是否可复用。

基于这些假设，Diff 算法只需遍历一次节点列表，时间复杂度为 O(n)。

### Q3: 为什么 Hooks 必须按顺序调用？

**答**：
Hooks 通过链表存储在 Fiber.memoizedState 中，React 内部通过全局变量 `workInProgressHook` 指向当前正在处理的 hook。

```javascript
// 首次渲染
useState(1)  // hook1 (workInProgressHook = hook1)
useState(2)  // hook2 (workInProgressHook = hook2)
useEffect()  // hook3 (workInProgressHook = hook3)

// 下次渲染（必须相同顺序）
useState()   // 期望对应 hook1，但如果跳过或插入，就会错位
useState()   // 期望对应 hook2
useEffect()  // 期望对应 hook3
```

如果顺序不一致：
- 条件语句中的 Hook：某些渲染路径不调用，导致链表错位
- 循环中的 Hook：调用次数可能不同，导致错位
- 提前 return：后续 Hook 未调用，链表错位

**解决方案**：
- 永远不要在条件语句、循环、嵌套函数中调用 Hooks
- 使用 ESLint 插件 `eslint-plugin-react-hooks` 检测错误用法

### Q4: React 18 的并发特性有哪些？

**答**：
1. **Concurrent Mode**：并发模式，支持可中断渲染
2. **Transitions**：标记低优先级更新，如搜索输入、过滤列表
3. **Suspense**：数据获取时显示加载状态
4. **Automatic Batching**：自动批量更新状态，减少渲染次数
5. **useDeferredValue**：延迟更新低优先级值
6. **useTransition**：标记过渡状态的 hook

### Q5: 如何优化 React 应用性能？

**答**：
1. **减少不必要渲染**：
   - 使用 `React.memo` 避免组件重复渲染
   - 使用 `useMemo` 缓存计算结果
   - 使用 `useCallback` 缓存函数引用

2. **利用 Bailout 机制**：
   - 保持 props 引用稳定
   - 使用 `React.memo` 的第二个参数自定义比较

3. **代码分割**：
   - 使用 `React.lazy` 和 `Suspense` 懒加载组件
   - 路由级别的代码分割

4. **虚拟列表**：
   - 使用 `react-window` 或 `react-virtualized` 渲染长列表

5. **优化渲染性能**：
   - 避免在 render 中创建对象/函数
   - 使用 key 帮助 Diff 算法
    - 避免深层嵌套组件

### Q6: setState 后，新状态和旧状态相同时，React 会重新渲染吗？

**答**：分情况讨论。

```javascript
// 场景 1: 简单值
const [count, setCount] = useState(0);
setCount(0);  // Object.is(0, 0) === true → 不会重新渲染 ✅

// 场景 2: 对象（即使内容相同）
const [data, setData] = useState({ a: 1 });
setData({ a: 1 });  // Object.is({a:1}, {a:1}) === false → 会重新渲染 ❌

// 场景 3: 特殊值
const [value, setValue] = useState(NaN);
setValue(NaN);  // Object.is(NaN, NaN) === true → 不会重新渲染 ✅

const [zero, setZero] = useState(+0);
setZero(-0);  // Object.is(+0, -0) === false → 会重新渲染 ❌
```

**关键点**：
- 简单值使用 `Object.is()` 比较，相同则 Bailout
- 对象/数组即使内容相同也会渲染（引用不同）
- React 在 **Render 阶段的 `updateReducer`** 中比较状态
- 不是在 `dispatchSetState` 时比较

**优化方案**：
- 拆分状态（大对象拆分为简单值）
- 使用浅比较后手动更新
- 使用 Immer 自动引用比较

### Q7: useLayoutEffect 和 useEffect 的区别是什么？为什么需要 useLayoutEffect？

**答**：区别在于执行时机。

| 特性 | useEffect | useLayoutEffect |
|------|-----------|-----------------|
| **执行时机** | 浏览器绘制后（异步） | 浏览器绘制前（同步） |
| **是否阻塞绘制** | 否 | 是 |
| **适用场景** | 数据获取、日志、分析 | DOM 测量、同步动画 |
| **性能影响** | 低（不阻塞） | 高（可能阻塞渲染） |

**为什么需要 useLayoutEffect？**

```javascript
// ❌ useEffect 问题：闪烁
function ScrollToTop() {
  useEffect(() => {
    window.scrollTo(0, 0);  // 绘制后才执行 → 看到页面，然后突然跳到顶部
  }, []);

  return <div>内容...</div>;
}

// ✅ useLayoutEffect 解决：无闪烁
function ScrollToTop() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);  // 绘制前执行 → 用户看不到过渡过程
  }, []);

  return <div>内容...</div>;
}
```

**关键场景**：
1. DOM 测量（必须在布局计算后、绘制前）
2. 滚动位置恢复（同步执行，避免闪烁）
3. 同步动画（避免看到中间状态）
4. 阻止闪烁（在绘制前完成显示/隐藏逻辑）

### Q8: 什么是 Bailout？React 什么时候会跳过组件渲染？

**答**：Bailout 是 React 的性能优化机制，当组件不需要更新时跳过渲染。

**Bailout 触发条件**（`beginWork` 阶段）：

```javascript
function isBailout(current, workInProgress, renderLanes) {
  return (
    // 1. 无更新
    !hasPendingUpdates(current) ||
    // 2. 优先级不匹配
    !includesSomeLane(renderLanes, workInProgress.childLanes) ||
    // 3. Props 相同（浅比较）
    isPropsEqual(current, workInProgress) ||
    // 4. State 相同（Object.is）
    isStateEqual(current, workInProgress)
  );
}
```

**自动 Bailout 的场景**：

```javascript
// ✅ 简单值相等
const [count, setCount] = useState(0);
setCount(0);  // Bailout ✅

// ✅ Props 相同（配合 React.memo）
const Child = React.memo(({ value }) => <div>{value}</div>);
<Child value={10} />  // value 不变时 Bailout ✅

// ❌ 对象引用不同
const [data, setData] = useState({ a: 1 });
setData({ a: 1 });  // 即使内容相同，仍会渲染 ❌
```

**手动优化 Bailout**：

```javascript
// ✅ 手动比较 + useMemo
function OptimizedParent({ items }) {
  const [count, setCount] = useState(0);
  const expensiveData = useMemo(() => items, [items]);

  return <ExpensiveChild data={expensiveData} />;  // 引用不变，Child 会 Bailout
}
```

---

## 11. 学习建议与实践

### 11.1 学习路径

```
第一阶段（1-2 周）
├── 阅读 React 官方文档，掌握基础概念
├── 实践常用 Hooks 和组件通信
└── 完成一个小型项目

第二阶段（2-3 周）
├── 阅读《React 揭秘》系列文章
├── 理解虚拟 DOM 和 Diff 算法
├── 学习性能优化技巧
└── 在项目中应用优化方法

第三阶段（3-4 周）
├── 阅读 React 源码（从 ReactFiberWorkLoop.js 开始）
├── 深入理解 Fiber 架构和并发机制
├── 研究 Hooks 源码实现
└── 尝试自定义 Hooks

第四阶段（持续）
├── 关注 React 版本更新
├── 阅读技术博客和源码分析文章
├── 参与开源项目讨论
└── 分享自己的学习心得
```

### 11.2 源码阅读技巧

1. **先理解概念，再看代码**：先看文章理解原理，再看源码验证
2. **固定版本阅读**：使用 Commit hash 固定版本，避免代码变化
3. **调试阅读**：在浏览器中打断点，单步调试理解执行流程
4. **画图辅助**：绘制数据结构图和流程图，帮助理解
5. **记录笔记**：阅读时记录关键函数和数据结构

### 11.3 实践项目建议

1. **简易 React 实现**：手写一个简化版的 React，包括虚拟 DOM、Diff 算法
2. **自定义 Hooks 库**：封装常用的自定义 Hooks
3. **性能监控工具**：开发 React 渲染性能监控工具
4. **React 调试器插件**：开发 Chrome 插件可视化 Fiber 树

---

## 附录：术语表

| 术语 | 英文 | 解释 |
|------|------|------|
| 调和 | Reconciliation | React 比较新旧节点并更新 DOM 的过程 |
| 纤维 | Fiber | React 16+ 的数据结构，支持可中断渲染 |
| 双缓存 | Double Buffering | 维护 current 和 workInProgress 两棵树 |
| 优先级 | Priority | 更新任务的重要程度，影响执行顺序 |
| 车道 | Lanes | 使用二进制位表示优先级的模型 |
| 旁路 | Bailout | 跳过组件渲染，复用上次结果的优化机制 |
| 副作用 | Side Effect | DOM 操作、数据获取等影响外部世界的操作 |
| 调度器 | Scheduler | 管理任务优先级和执行顺序的模块 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2025-06-02 | 1.0 | 整理学习笔记，创建结构化文档 |

---

**文档版本**：v1.0
**React 版本**：18.3
**最后更新**：2025-06-02