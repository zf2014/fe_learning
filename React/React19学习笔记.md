# React 19 学习笔记

> **最新版本学习指南** - 掌握 React 19 的所有新特性与最佳实践

## 📚 React 版本信息

**当前版本**: React 19.2 (2025年10月发布)
**发布时间**: React 19.0 - 2024年12月5日
**核心变化**: 全新 Actions API、React Compiler、服务端组件稳定版

**版本历史**:
- **React 19.0 RC**: 2024年4月25日
- **React 19.0 Stable**: 2024年12月5日
- **React 19.1**: 2025年3月28日（调试修复、XSS 漏洞修补）
- **React 19.2**: 2025年10月1日（`<Activity />`、`useEffectEvent`、`cacheSignal`）

---

## 快速导航

- [新特性概览](#新特性概览)
- [Actions API](#actions-api)
- [use() Hook](#use-hook)
  - [use() 工作原理（内部机制）](#use-工作原理内部机制)
    - [总体调用链](#总体调用链)
    - [核心函数：trackUsedThenable](#核心函数trackusedthenable)
    - [SuspenseException：不透明的挂起信号](#suspenseexception不透明的挂起信号)
    - [Work Loop 中的处理](#work-loop-中的处理)
    - [ThenableState：为什么 use() 可以条件调用](#thenablestate为什么-use-可以条件调用)
    - [use() 读取 Context 的实现](#use-读取-context-的实现)
    - [与其他功能的交互](#与其他功能的交互)
- [useOptimistic](#useoptimistic)
- [React Compiler](#react-compiler)
- [React 19.2 新特性](#react-192-新特性)
- [服务端组件](#服务端组件)
- [迁移指南](#迁移指南)
- [最佳实践](#最佳实践)
- [学习资源](#学习资源)
- [常见问题](#常见问题)

---

## 新特性概览

### React 19 核心改进

| 特性 | 描述 | 影响 |
|------|------|------|
| **Actions API** | 简化异步操作和表单处理 | 🚀 大幅减少样板代码 |
| **useActionState** | 管理 Actions 的状态 | 📝 简化表单状态管理 |
| **useFormStatus** | 访问父表单状态 | 🎨 无需 prop drilling |
| **use() Hook** | 统一读取 Promise/Context | 🎯 简化数据获取 |
| **useOptimistic** | 乐观 UI 更新 | ⚡ 提升用户体验 |
| **React Compiler (Forget)** | 自动记忆化编译器 | 🤖 零手动优化 |
| **服务端组件 (稳定)** | Server Components | 🌐 减少客户端代码 |
| **Server Actions** | 客户端调用服务端函数 | 🔗 无缝前后端通信 |
| **ref 作为 prop** | 无需 forwardRef | 📦 简化组件定义 |
| **原生 metadata** | 支持 `<title>` `<meta>` `<link>` | 📄 无需第三方库 |
| **Stylesheet 管理** | 自动管理样式加载 | 🎨 优化性能 |
| **资源预加载 API** | 预加载 DNS/字体/脚本 | ⚡ 提升加载速度 |
| **`<Context>` 作为 Provider** | 简化 Context 用法 | 📦 更简洁的 API |
| **Ref cleanup 函数** | Ref 回调支持清理 | 🧹 更好的资源管理 |
| **`<Activity />`** (19.2) | 控制可见性和渲染优先级 | 🎯 高级渲染控制 |
| **useEffectEvent** (19.2) | 提取事件处理逻辑 | 🔄 防止不必要的 Effect 重新运行 |

---

## Actions API

### 什么是 Actions API？

Actions API 是 React 19 的重大创新，专门用于简化异步操作的处理。它让异步状态管理变得像同步代码一样简单。

**核心优势**:
- ✅ 自动管理 pending 状态
- ✅ 自动错误处理和乐观更新回滚
- ✅ 原生表单支持 (`<form action={...}>`)
- ✅ 无需手动 try/catch 或 loading 状态

### 基础用法

#### React 18 vs React 19 对比

```tsx
// ❌ React 18 - 手动管理状态
function UpdateName({}) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async () => {
    setIsPending(true);
    const error = await updateName(name);
    setIsPending(false);
    if (error) {
      setError(error);
      return;
    }
    redirect("/path");
  };

  return (
    <div>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSubmit} disabled={isPending}>Update</button>
      {error && <p>{error}</p>}
    </div>
  );
}

// ✅ React 19 - 使用 Actions API
import { useActionState } from "react";

function ChangeName({ name, setName }) {
  const [error, submitAction, isPending] = useActionState(
    async (previousState, formData) => {
      const error = await updateName(formData.get("name"));
      if (error) return error;
      redirect("/path");
      return null;
    },
    null,
  );

  return (
    <form action={submitAction}>
      <input type="text" name="name" />
      <button type="submit" disabled={isPending}>Update</button>
      {error && <p>{error}</p>}
    </form>
  );
}
```

### useActionState Hook

`useActionState` 管理 Action 的状态，返回最后的执行结果和 pending 状态。

```tsx
import { useActionState } from "react";

const [state, formAction, isPending] = useActionState(
  async (previousState, formData) => {
    // 执行异步操作
    const result = await someAsyncAction(formData);
    return result; // 返回值作为 `state`
  },
  initialState, // `state` 的初始值
);
```

**返回值**:
- `state`: Action 返回的状态
- `formAction`: 传递给 `<form action={...}>` 的函数
- `isPending`: 是否正在执行

#### 深入理解：`useActionState` 内部工作原理

`useActionState` 是 React 19 中最精巧的内部实现之一。它在 reconciler 层（`ReactFiberHooks.js`）维护了多个 Hook 节点，并借助 **entangled async action + Suspense** 机制实现异步状态管理。

##### 1. Hook 的分工

```
useActionState(action, initialState)
  │
  ├── Hook #1 — State Hook（useReducer 实现）
  │   └── 存储 pending state（action 的返回结果）
  │       reducer = (old, new) => new（简单覆盖）
  │
  └── Hook #2 — isPending Hook（useReducer 实现）
      └── 跟踪 isPending 布尔值
```

> 注意：`useActionState` 本身**不**直接调用 `useThenable`，它通过 `peekEntangledActionThenable()` + 直接 throw 的方式利用 Suspense 机制。

##### 2. 核心数据结构

```
// ActionStateQueue — 存储在 stateHook.queue 上
ActionStateQueue {
  pending: ActionStateQueueNode | null,   // 循环链表头
  lanes: Lanes,
  dispatch: (payload) => void,
  lastRenderedState: Awaited<S>,
  action: ActionStateQueueNode | null,    // 当前正在执行
}
```

每次调用 `dispatch`，都会创建一个 **ActionStateQueueNode**，该节点本身也是一个 **thenable**（具有 `then` 方法）：

```
ActionStateQueueNode {
  payload,           // 携带的参数（如 FormData）
  action,            // 派发时 action 函数的快照
  next,              // 循环链表指针
  isTransition,      // 是否在 transition 中派发
  status,            // pending → fulfilled | rejected
  value/reason,      // 结果或错误
  listeners[],       // 回调监听器
  then(listener)     // thenable 接口
}
```

多个 pending 的 action 节点构成一个 **循环链表**，确保**严格顺序执行**。

##### 3. Entangled Async Action（关键机制）

`useActionState` 的暂停能力不来自 `useThenable`，而是来自 **entangled async action** 机制（定义在 `ReactFiberAsyncAction.js`）：

```typescript
// 全局变量（全局唯一的 entangled scope）
let currentEntangledListeners = null;
let currentEntangledActionThenable = null;

function entangleAsyncAction(transition, thenable) {
  if (currentEntangledListeners === null) {
    const entangledListeners = [];
    currentEntangledActionThenable = {
      status: 'pending',
      value: undefined,
      then: function(resolve) {
        // 所有通过 .then() 注册的回调都存起来
        entangledListeners.push(resolve);
      }
    };
  }
  // 监听原始 promise
  thenable.then(pingEngtangledActionScope, pingEngtangledActionScope);
  return currentEntangledActionThenable;  // ★ 返回这个"代理 thenable"
}
```

##### 4. 完整的执行流程

```
挂载阶段（mount）
    │
    ▼
mountActionState(action, initialState)
    ├── mountWorkInProgressHook()            // Hook #1: pendingState
    ├── mountWorkInProgressHook()            // Hook #2: isPending
    ├── stateQueue.dispatch = dispatchActionState
    └── 返回 [initialState, dispatchActionState, false]
    // 此阶段完全不涉及 useThenable ✓

用户触发 action（如点击提交按钮）
    │
    ▼
dispatchActionState(fiber, actionQueue, setPendingState, setState, payload)
    │
    ├─ 创建 ActionStateQueueNode
    ├─ 加入 actionQueue.pending 循环链表
    ├─ setPendingState(true)                → isPending = true → 触发 re-render
    │
    ├─ actionQueue.action = node            → 标记为正在执行
    └─ runActionStateAction(actionQueue, node, action(state, payload))
            │
            ▼
    runActionStateAction:
    ├─ 返回值不是 Promise？→ 同步调用 onActionSuccess
    └─ 返回值是 Promise？
        ├─ entangleAsyncAction(transition, thenable)  → ★ 创建 entangled thenable
        └─ .then(onActionSuccess, onActionFailure)    → 注册完成回调

Re-render（dispatch 后，组件被重新调度）
    │
    ▼
updateActionStateImpl(stateHook, currentStateHook, action)
    │
    ├─ updateReducerImpl(stateHook, ...)    → 处理 state 更新（可能有 pending 的 thenable）
    │
    ├─ if (didReadFromEntangledAsyncAction):
    │     ├─ entangledActionThenable = peekEntangledActionThenable()
    │     └─ if (entangledActionThenable !== null):
    │           → ★ 直接 throw entangledActionThenable！（不是通过 useThenable）
    │
    └─ 返回 [state, dispatchActionState, isPending]

// React 工作循环捕获 throw
    │
    ▼
throwException(root, fiber, entangledActionThenable, rootRenderLanes)
    │
    ├─ 识别到 value.then === 'function' → 是 thenable
    └─ attachPingListener(root, entangledActionThenable, rootRenderLanes)
          │
          ├─ const ping = pingRoot.bind(null, root, wakeable, lanes)
          ├─ entangledActionThenable.then(ping, ping)
          └─ ★ ping 被推入 entangledListeners[]
                  │
                  ▼
          actionNode.listeners = [...entangledListeners, ...]
          // 此时 listeners 中已有: [ping, ping]

Action 执行完毕
    │
    ▼
onActionSuccess(actionQueue, actionNode, nextState)
    │
    ├─ actionNode.status = 'fulfilled'
    ├─ actionNode.value = nextState
    ├─ notifyActionListeners(actionNode)     → ★ 遍历 listeners
    │     ├─ ping()  → pingRoot()
    │     │         → scheduleUpdateOnFiber(root, fiber, lanes)
    │     │         → ✅ 触发 re-render！
    │     └─ (其他 React 内部 listener)
    │
    ├─ actionQueue.state = nextState        → 状态已就绪
    └─ 队列中还有下一个 action？→ 继续执行（顺序链）

Re-render（action 完成后）
    │
    ▼
updateActionStateImpl(stateHook, ...)
    │
    ├─ updateReducerImpl → 读取 actionQueue.state = nextState
    ├─ didReadFromEntangledAsyncAction？
    │     ├─ 是 → peekEntangledActionThenable()
    │     │         → status === 'fulfilled' → 返回 value（不再 throw）
    │     └─ 否 → 正常返回
    ├─ isPending = false
    └─ 返回 [nextState, dispatchActionState, false] ✅ 组件正常渲染
```

##### 5. `notifyActionListeners` 触发 re-render 的完整链路

这是最核心的问题：`notifyActionListeners` 本身只是一个"信使"，它遍历回调数组并逐个调用：

```typescript
function onActionSuccess(actionQueue, actionNode, nextState) {
  actionNode.status = 'fulfilled';
  actionNode.value = nextState;
  notifyActionListeners(actionNode);  // ★ 关键步骤
  actionQueue.state = nextState;
  // 继续处理队列...
}
```

**触发 re-render 的回调从哪来？**

```
① re-render 时，updateActionStateImpl 检测到 entangled async action
   → peekEntangledActionThenable() 拿到 thenable
   → throw entangledActionThenable

② React 工作循环的 throwException() 捕获它
   → attachPingListener(root, entangledActionThenable, lanes)
   → entangledActionThenable.then(ping, ping)
   → ★ ping 被推入 entangledActionThenable 的监听器列表

③ onActionSuccess → notifyActionListeners(actionNode)
   → 遍历 listeners → 调用 ping()
   → ping → pingRoot → scheduleUpdateOnFiber(root, fiber, lanes)
   → ✅ React 调度 fiber 重新渲染
```

> **关键认识**：`notifyActionListeners` 自己**不**触发 re-render。它调用的 `ping` 回调是第 ② 步中 `attachPingListener` 通过 `.then(ping, ping)` 注册的。真正的 re-render 调用链是 `ping → pingRoot → scheduleUpdateOnFiber`。

##### 6. Action 函数的更新机制

如果组件的 action 函数引用发生了变化（例如依赖了新的闭包变量），React 通过 **passive effect** 在 commit 阶段更新队列中的 action 引用：

```typescript
if (action !== prevAction) {
  // 标记需要执行 passive effect
  fiber.flags |= PassiveEffect;
  pushSimpleEffect(..., actionStateActionEffect.bind(null, actionQueue, action));
}
```

##### 7. 异常处理

- 如果 action 抛出错误，调用 `onActionError`：标记队列中**所有** pending 的节点为 rejected，并设置 `actionQueue.action = null` 阻止后续派发
- 如果在 action 执行期间又调用了 dispatch，新的 action 节点会被追加到循环链表末尾，等待当前 action 完成后再执行
- 如果在 render 阶段调用了 dispatch，React 会抛出错误（`Cannot update action state while rendering`）

##### 8. 与 `useReducer` 的核心区别

| 特性 | `useReducer` | `useActionState` |
|------|-------------|------------------|
| State 更新方式 | 同步 reducer | 异步，通过 entangled async action + Suspense |
| 执行顺序 | 批量合并 | 严格顺序执行（每个 action 拿到上一结果） |
| Pending 状态 | 无 | 内置（`isPending` boolean） |
| 表单集成 | 需手动 | `<form action={dispatch}>` |
| 内部 Hook 数 | 1 个 | 2 个（state + isPending） |
| 异步支持 | 不原生支持 | 原生支持（entangled thenable + `attachPingListener`） |
| 暂停机制 | 无 | 直接 `throw entangledActionThenable` 被 work loop 捕获 |

##### 9. `useActionState` vs 传统状态管理：场景决策

并非所有状态都适合用 `useActionState`。以下是对比分析：

**✅ 优先考虑 `useActionState` 的场景**

| 场景 | 为什么适合 | 示例 |
|------|-----------|------|
| 表单提交 + 异步操作 | 提交 → 等待结果 → 更新状态，天然匹配 | `<form action={formAction}>` |
| Server Action（Next.js / RSC） | Server Action 返回 Promise，天然集成 | 配合 `"use server"` |
| 严格顺序执行的异步队列 | 内部循环链表保证顺序执行 | 多步表单、逐步构建 |
| 需要自动管理 `isPending` | 省去手动 `useState(false)` 模板代码 | 提交按钮 loading 状态 |

```tsx
// ✅ 非常适合：表单提交 + 自动 loading
function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (prev, formData) => {
      const res = await fetch('/api/login', { method: 'POST', body: formData });
      if (!res.ok) return { error: '登录失败' };
      return { error: null };
    },
    { error: null }
  );

  return (
    <form action={formAction}>
      <input name="email" required />
      <input name="password" type="password" required />
      {state.error && <p style={{color: 'red'}}>{state.error}</p>}
      <button disabled={isPending}>
        {isPending ? '登录中...' : '登录'}
      </button>
    </form>
  );
}
```

**❌ 仍然使用传统 `useState` / `useReducer` 的场景**

| 场景 | 为什么不适合 `useActionState` | 推荐方式 |
|------|------------------------------|---------|
| 同步 UI 状态（开关、计数、Tab 切换） | 不涉及异步提交，overkill | `useState` |
| 页面初始化自动加载数据 | `useActionState` 需用户触发提交 | `useEffect` + `useState` |
| 复杂嵌套状态 + 多字段校验 | `useActionState` 只有平铺的 state | `useReducer` |
| 状态需要跨组件共享 | `useActionState` 是组件内部状态 | `useContext` + `useReducer` |
| 客户端本地过滤/搜索 | 不涉及异步提交 | `useState` + computed |
| 纯乐观更新（可能回滚） | `useOptimistic` 控制更精细 | `useOptimistic` |

```tsx
// ❌ 不适合：纯 UI 状态管理
const [isOpen, setIsOpen] = useState(false);    // 模态框 ✓
const [count, setCount] = useState(0);           // 计数器 ✓
const [tab, setTab] = useState('profile');       // Tab 切换 ✓

// ❌ 不适合：初始化自动加载数据
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);

// ❌ 不适合：复杂表单校验 + 多字段
const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_FIELD': return { ...state, [action.field]: action.value };
    case 'SET_ERRORS': return { ...state, errors: action.errors };
    default: return state;
  }
};
const [form, dispatch] = useReducer(reducer, {
  name: '', email: '', errors: {}
});
```

**决策速查表**

```
开始
│
├─ 这是"提交 → 等待 → 更新"模式？
│   ├─ 是 → ✅ useActionState
│   └─ 否 → ↓
│
├─ 状态变化由用户发起的异步提交驱动？
│   ├─ 是 → ✅ useActionState
│   └─ 否 → ↓
│
├─ 满足以下任一条？
│   ├─ 同步 UI 状态（开关/计数/Tab）
│   ├─ 自动初始化加载数据
│   ├─ 复杂嵌套对象 + 多字段校验
│   ├─ 需要跨组件共享
│   └─ 纯乐观更新（可回滚）
│   → 如果是 → ❌ 用 useState / useReducer
│   → 如果不是 → ⚠️ 可能是 useActionState 的适用场景
```

**一句话原则**：状态变化是否由**用户发起的异步提交**驱动？是 → `useActionState`，否 → 传统方式。

##### 10. 总结

`useActionState` 本质上是一个 **将异步操作顺序化的协调器**：

- **2 个 Hook** 分别管理 state 和 isPending 状态
- **`entangleAsyncAction`** 创建代理 thenable，将 action 的原始 promise 接入 React 的 Suspense 体系
- **直接 throw entangled thenable** 被 work loop 捕获（不是通过 `useThenable`）
- **`attachPingListener`** 注册 `ping` 回调到 thenable 的 listeners 中
- **`notifyActionListeners`** 触发 `ping` → `scheduleUpdateOnFiber` → 完成 re-render
- **循环链表** 维护顺序执行的 action 队列
- **乐观更新** 驱动 `isPending` 状态

> 纠正说明：早期文档版本错误地将 `useThenable` 写入了 `mountActionState` 流程，实际上 `useActionState` 不直接调用 `useThenable`，而是通过 `entangleAsyncAction` → 直接 throw entangled thenable 来实现 Suspense 集成。`useThenable` 主要用于 `use()` Hook 和 `TransitionAwareHostComponent`（`useFormStatus`）。

这个设计使得开发者可以写出极其简洁的表单代码，同时 React 内部自动处理了所有复杂的异步编排、状态管理和错误恢复。

### useFormStatus Hook (react-dom)

`useFormStatus` 让嵌套组件能够访问父表单的提交状态，无需 prop drilling。

```tsx
import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending, data, method, action } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? "提交中..." : "提交"}
    </button>
  );
}

function ContactForm() {
  const [state, formAction] = useActionState(submitContact, null);

  return (
    <form action={formAction}>
      <input name="email" placeholder="邮箱" />
      <SubmitButton /> {/* 可以访问表单状态 */}
      {state?.error && <div className="error">{state.error}</div>}
    </form>
  );
}
```

**返回值**:
- `pending`: 表单是否正在提交
- `data`: FormData 对象
- `method`: 请求方法 (GET/POST)
- `action`: 表单 action URL

---

#### 与 `useActionState` 的关系

**`useFormStatus` 不必须和 `useActionState` 配合使用。** 两者是正交的——`useActionState` 管理 action 的返回值与重执行，`useFormStatus` 读取表单提交的瞬时状态。

| 场景 | 是否需要 `useActionState` | useFormStatus 能否工作 |
|------|:---:|:---:|
| `<form action={serverAction}>` | ❌ 不需要 | ✅ 可以 |
| `<form action={formAction}>` (from `useActionState`) | ✅ 需要 | ✅ 可以 |
| `<form>` + `onSubmit` 手动 fetch | ❌ 不需要 | ❌ 不会触发 |
| `<div>` 内使用 | ❌ 不需要 | ❌ 不生效 |

---

#### 工作原理（内部机制）

`useFormStatus` 不通过 `<Context.Provider>` 传播状态，而是通过一个 **特殊优化的 React Context**——`HostTransitionContext`：

```
用户提交表单
    ↓
FormActionEventPlugin 拦截 submit 事件
    ↓
startHostTransition(formFiber, { pending: true, data, method, action }, ...)
    ↓
form fiber hook 状态更新 → 调度 re-render
    ↓
beginWork → updateHostComponent → renderTransitionAwareHostComponentWithHooks()
    ↓
HostTransitionContext._currentValue = newState  (直接赋值，非 Provider)
    ↓
子组件 useFormStatus() → useHostTransitionStatus() → readContext(HostTransitionContext)
    ↓
返回 { pending: true/false, data, method, action }
```

**关键文件与函数**：

| 环节 | 函数 | 文件 | 行号 |
|------|------|------|------|
| ① DOM 事件拦截 | `FormActionEventPlugin` | `FormActionEventPlugin.js` | ~110 |
| ② 桥接到 reconciler | `startHostTransition()` | `ReactFiberHooks.js` | ~3233 |
| ③ 渲染 form fiber | `renderTransitionAwareHostComponentWithHooks()` | `ReactFiberHooks.js` | ~850 |
| ④ 写 Context | `HostTransitionContext._currentValue = newState` | `ReactFiberBeginWork.js` | ~1988 |
| ⑤ Context 定义 | `HostTransitionContext` | `ReactFiberConfigDOM.js` | ~6650 |
| ⑥ 公共 API | `useFormStatus()` | `ReactDOMFormActions.js` | ~64 |
| ⑦ Hook 实现 | `useHostTransitionStatus()` → `readContext(HostTransitionContext)` | `ReactFiberHooks.js` | ~3441 |
| ⑧ 默认值 | `NotPending = { pending: false, data: null, method: null, action: null }` | `ReactDOMFormActions.js` | ~29 |

##### 状态传播的条件

`HostTransitionContext._currentValue` 的更新发生在 `pushHostContext()` 中，条件是 **form fiber 上有 hook（`memoizedState !== null`）**：

```javascript
// ReactFiberHostContext.js
function pushHostContext(fiber: Fiber): void {
  const stateHook: Hook | null = fiber.memoizedState;
  if (stateHook !== null) {
    HostTransitionContext._currentValue = stateHook.memoizedState;
    push(hostTransitionProviderCursor, fiber, fiber);
  }
}
```

在 `beginWork` → `updateHostComponent` 中，`renderTransitionAwareHostComponentWithHooks` 被调用以安装/更新 form fiber 的内部 hook：

```javascript
// ReactFiberBeginWork.js (updateHostComponent)
const newState = renderTransitionAwareHostComponentWithHooks(
  current, workInProgress, renderLanes,
);
HostTransitionContext._currentValue = newState;
```

一旦 form fiber 被升级为 "stateful"（有了 hooks），它会保持 stateful 直至生命周期结束：
> "Once a fiber is upgraded to be stateful, it remains stateful for the rest of its lifetime."

##### 对比常规 Context

| 维度 | 常规 Context | `HostTransitionContext` |
|------|-------------|------------------------|
| 更新方式 | `<Context.Provider value={x}>` | `_currentValue = newState`（直接赋值） |
| Provider 组件 | 需要 | 不需要（form fiber 本身就是 provider） |
| 嵌套支持 | 支持（堆栈） | 不支持（假设表单不嵌套） |
| 性能 | 额外组件树开销 | 零开销直接写 |
| 作用域 | 全局 | form fiber 子树内（pop 时恢复为 NotPending） |

---

#### 三种可行场景分析

##### 场景 1：纯 Server Action（不需要 `useActionState`）

```jsx
function Form() {
  return (
    <form action={updateUser}>    {/* 服务器 action */}
      <StatusIndicator />         {/* useFormStatus 正常工作 */}
      <input name="name" />
      <button type="submit">提交</button>
    </form>
  );
}

function StatusIndicator() {
  const { pending } = useFormStatus();
  return <span>{pending ? '提交中...' : ''}</span>;
}
```

**流程**：表单提交 → `FormActionEventPlugin` → `startHostTransition()` → form fiber hook 挂载 pending 状态 → `HostTransitionContext._currentValue` 更新 → `useFormStatus()` 读到 `{ pending: true }` → action 完成 → 自动 `requestFormReset` → 恢复为 `NotPending`

##### 场景 2：搭配 `useActionState`（显式状态管理）

```jsx
function MyForm() {
  const [state, formAction, isPending] = useActionState(
    async (prev, formData) => { await updateUser(formData); return 'ok'; },
    null,
  );

  return (
    <form action={formAction}>
      <StatusIndicator />   {/* useFormStatus 同样工作 */}
      <span>{isPending ? 'loading...' : state}</span>
    </form>
  );
}
```

`useActionState` 返回的 `formAction` 本质是包装函数，传给 `<form action={...}>` 后仍然经过 `startHostTransition` → form fiber hook → `HostTransitionContext` 这条内部路径。

##### 场景 3：`useOptimistic` + 表单

```jsx
function Form() {
  const [optimisticName, setOptimistic] = useOptimistic(name);

  return (
    <form action={async (formData) => {
      setOptimistic(formData.get('name'));  // 乐观更新
      await updateUser(formData);           // 服务器 action
    }}>
      <StatusIndicator />   {/* useFormStatus 仍能工作 */}
    </form>
  );
}
```

`useOptimistic` 触发的更新不影响 `HostTransitionContext`，但 `<form action={...}>` 提交时 `startHostTransition` 的正常路径仍然触发 pending 状态更新。

---

#### 什么时候 `useFormStatus` 不工作？

```jsx
// ❌ 不是 <form> 元素，或不在 form 内
<div>
  <StatusIndicator />   {/* useFormStatus 一直返回 { pending: false } */}
</div>

// ❌ action 不是函数（无 action prop 或 action 是字符串 URL）
<form action="/api/submit">
  <StatusIndicator />   {/* useFormStatus 不会更新 */}
</form>

// ❌ onSubmit 没有触发 React 的 transition 机制
<form onSubmit={async (e) => {
  e.preventDefault();
  await doSomething();   // 没有 startTransition 包装
}}>
  <StatusIndicator />   {/* useFormStatus 不会更新 */}
</form>

// ❌ 提交不在 form 的 action prop 中处理
<form>
  <button onClick={async () => {
    await fetch('/api', { method: 'POST' });
  }}>提交</button>
  <StatusIndicator />   {/* useFormStatus 不会更新 */}
</form>
```

让 `useFormStatus` 工作的最低条件：表单提交必须经过 React 的 **host transition 机制**，即 `startHostTransition()` 被调用，也就是 form 的 `action` prop 是一个函数（server action 或 `useActionState` 返回的 `formAction`）。

---

#### 一句话总结

| 问题 | 答案 |
|------|------|
| `useFormStatus` 需要 `useActionState`？ | **不需要**。`<form action={serverAction}>` 就足够 |
| `useFormStatus` 需要 `<form>`？ | **必须**。它读取的是 `<form>` host fiber 的 hook 状态 |
| `useFormStatus` 需要 `startTransition`？ | **需要**。背后实质是 Transition 机制 |
| 和 `useActionState` 的本质关系？ | 都走 `startHostTransition()` → form fiber hook → `HostTransitionContext` 路径，但两者正交 |

### 完整示例：联系表单

```tsx
// actions.ts (服务端 Action)
'use server';

export async function submitContact(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  if (!email || !message) {
    return { success: false, error: '请填写所有字段' };
  }

  try {
    // 发送邮件
    await sendEmail({ email, message });

    // 重新验证缓存（如果使用 Next.js）
    // revalidatePath('/contact');

    return { success: true, message: '消息已发送！' };
  } catch (error) {
    return { success: false, error: '发送失败，请稍后重试' };
  }
}
```

```tsx
// ContactForm.tsx (客户端组件)
'use client';

import { useActionState } from 'react';
import { submitContact } from './actions';

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(
    submitContact,
    null
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="your@email.com"
          className="w-full px-4 py-2 border rounded"
        />
      </div>

      <div>
        <label htmlFor="message">消息</label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          placeholder="你的消息..."
          className="w-full px-4 py-2 border rounded"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isPending ? '发送中...' : '发送'}
      </button>

      {state?.error && (
        <div className="p-4 bg-red-100 text-red-700 rounded">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-4 bg-green-100 text-green-700 rounded">
          {state.message}
        </div>
      )}
    </form>
  );
}
```

### Actions 的优势

✅ **简化异步状态管理** - 不再需要手动管理 loading、error 状态
✅ **自动表单处理** - 直接处理 FormData，无需手动提取
✅ **服务器组件支持** - 无缝集成服务端 actions
✅ **乐观 UI** - 配合 useOptimistic 实现即时反馈
✅ **错误处理** - 自动回滚乐观更新

### 表单处理最佳实践

```tsx
// ✅ 推荐 - 使用原生 Actions
function TodoForm() {
  const [state, formAction] = useActionState(addTodo, null);
  return (
    <form action={formAction}>
      <input name="text" placeholder="新的待办事项" />
      <button type="submit">添加</button>
      {state?.error && <div className="error">{state.error}</div>}
    </form>
  );
}

// ❌ 避免 - 手动管理状态
function TodoForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await fetch('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ text })
      });
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ... 大量样板代码 */}
    </form>
  );
}
```

---

## use() Hook

### 概述

`use()` 是 React 19 的新 Hook，用于读取 Promise 或 Context 的值。

**重要特性**:
- ✅ 可以在组件和 Hooks 中使用
- ✅ **可以在条件语句中调用**（不像其他 Hooks）
- ✅ 可以在早期 return 之后调用
- ✅ 支持 Promise（需配合 Suspense）和 Context

⚠️ **限制**:
- `use()` 不支持在 render 中创建的 Promise
- Promise 必须来自支持 Suspense 的库或框架缓存
- 未来 React 版本将添加内置的 Promise 缓存

### 基础用法

#### 读取 Promise

```tsx
import { use, Suspense } from 'react';

// 数据获取函数（Promise 由框架缓存）
async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`, {
    cache: 'force-cache' // Next.js 会缓存此 Promise
  });
  return res.json();
}

// 在组件中使用
function UserProfile({ userId }: { userId: string }) {
  // use() 会自动等待 Promise 解析
  const user = use(fetchUser(userId));

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}

// 包裹在 Suspense 中
export default function App({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="animate-pulse">加载中...</div>}>
      <UserProfile userId={params.id} />
    </Suspense>
  );
}
```

#### 读取 Context

```tsx
import { use, createContext } from 'react';

// 创建 Context
const ThemeContext = createContext<'light' | 'dark'>('light');

function Button({ children }: { children: React.ReactNode }) {
  // use() 也可以读取 Context
  const theme = use(ThemeContext);

  return (
    <button
      className={theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}
    >
      {children}
    </button>
  );
}

// 使用
export default function App() {
  return (
    <ThemeContext.Provider value="dark">
      <Button>点击</Button>
    </ThemeContext.Provider>
  );
}
```

#### 条件中使用 use()

```tsx
import { use, Suspense } from 'react';

function Heading({ children }: { children: React.ReactNode | null }) {
  if (children == null) return null;

  // ✅ use() 可以在早期 return 之后使用
  // useContext 在这里会违反 Hooks 规则
  const theme = use(ThemeContext);

  return (
    <h1 style={{ color: theme === 'dark' ? 'white' : 'black' }}>
      {children}
    </h1>
  );
}
```

### React 18 vs React 19 对比

```tsx
// ❌ React 18 - 复杂的数据获取
function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        setLoading(true);
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        setUser(data);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, [userId]);

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  return <div>{user.name}</div>;
}

// ✅ React 19 - 简洁的数据获取
async function fetchUser(id: string) {
  const res = await fetch(`/api/users/${id}`, { cache: 'force-cache' });
  return res.json();
}

function UserProfile({ userId }: { userId: string }) {
  const user = use(fetchUser(userId));
  return <div>{user.name}</div>;
}
```

### 组合多个资源

```tsx
import { use, Suspense } from 'react';

function PostPage({ postId }: { postId: string }) {
  const post = use(fetchPost(postId));
  const author = use(fetchUser(post.authorId));
  const comments = use(fetchComments(postId));

  return (
    <article>
      <h1>{post.title}</h1>
      <p className="text-gray-600">作者: {author.name}</p>
      <p className="mt-4">{post.content}</p>

      <section className="mt-8">
        <h2>评论 ({comments.length})</h2>
        {comments.map(comment => (
          <div key={comment.id} className="border-b py-4">
            <p>{comment.text}</p>
            <small className="text-gray-500">评分: {comment.rating}/5</small>
          </div>
        ))}
      </section>
    </article>
  );
}
```

### 实战示例：电商产品页面

```tsx
// lib/data.ts
export async function fetchProduct(id: string) {
  const res = await fetch(`https://api.example.com/products/${id}`, {
    cache: 'force-cache'
  });
  if (!res.ok) throw new Error('产品不存在');
  return res.json();
}

export async function fetchReviews(productId: string) {
  const res = await fetch(`https://api.example.com/products/${productId}/reviews`, {
    cache: 'no-store' // 评论不缓存
  });
  return res.json();
}
```

```tsx
// app/products/[id]/page.tsx
import { Suspense } from 'react';
import { fetchProduct, fetchReviews } from '@/lib/data';
import { ProductInfo } from './ProductInfo';
import { ProductReviews } from './ProductReviews';

export default function ProductPage({ params }: { params: { id: string } }) {
  const productPromise = fetchProduct(params.id);
  const reviewsPromise = fetchReviews(params.id);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Suspense fallback={<ProductSkeleton />}>
        <ProductInfo productPromise={productPromise} />
      </Suspense>

      <Suspense fallback={<div className="mt-8">加载评论...</div>}>
        <ProductReviews reviewsPromise={reviewsPromise} />
      </Suspense>
    </div>
  );
}
```

```tsx
// ProductInfo.tsx
import { use } from 'react';

export function ProductInfo({ productPromise }: { productPromise: Promise<Product> }) {
  const product = use(productPromise);

  return (
    <div>
      <h1 className="text-3xl font-bold">{product.name}</h1>
      <p className="text-2xl text-green-600 mt-2">¥{product.price}</p>
      <p className="mt-4 text-gray-700">{product.description}</p>
    </div>
  );
}
```

### use() 的规则总结

✅ **可以**:
- 在组件和 Hooks 的顶层调用
- 在条件语句中使用
- 在早期 return 之后使用
- 读取 Promise（需框架缓存）
- 读取 Context

❌ **不可以**:
- 在事件处理器中调用
- 在 render 中创建新的 Promise
- 在非 React 环境调用

### Suspense 行为变化

React 19 改变了 Suspense 的行为：
- fallback 立即提交，然后再渲染兄弟组件
- 更快的 fallback 显示
- 延迟请求预热（提前开始加载）

### use() 工作原理（内部机制）

`use()` 是 React 19 中一个**特殊的调度原语**——它不通过常规的 Hook 队列（linked list）来管理状态，而是通过 `ThenableState` 数组 + `SuspenseException` 异常机制来与 work loop 交互。

---

#### 总体调用链

```
组件渲染 → use(resource)
    │
    ├─ resource 是 thenable (Promise)
    │     ↓
    │   trackUsedThenable(thenableState, thenable, index)
    │     ↓
    │   ├─ 'fulfilled' → 返回 thenable.value
    │   ├─ 'rejected'  → throw thenable.reason (→ error boundary)
    │   └─ 'pending'   → throw SuspenseException (→ Suspense fallback)
    │
    ├─ resource 是 Context
    │     ↓
    │   readContext(Context) → 返回当前值
    │
    └─ resource 是其他
        → throw Error("Invalid use() resource")
```

| 环节 | 函数/模块 | 文件 | 行号 |
|------|----------|------|------|
| ① 公共 API | `function use(usable)` | `ReactHooks.js` | ~20 |
| ② 调度转发 | `dispatcher.use` → mount/update | `ReactFiberHooks.js` | Dispatcher |
| ③ Thenable 核心 | `trackUsedThenable()` | `ReactFiberThenable.js` | ~102 |
| ④ SuspenseException | `const SuspenseException = new Error(...)` | `ReactFiberThenable.js` | ~46 |
| ⑤ 提取 thenable | `getSuspendedThenable()` | `ReactFiberThenable.js` | ~290 |
| ⑥ Work loop 捕获 | `catch (thrownValue) { handleThrow(root, thrownValue) }` | `ReactFiberWorkLoop.js` | ~2703 |
| ⑦ 处理 throw | `handleThrow() → throwException()` | `ReactFiberWorkLoop.js` + `ReactFiberThrow.js` | ~2276 |
| ⑧ 注册 ping | `attachPingListener(root, wakeable, lanes)` | `ReactFiberWorkLoop.js` | ~4943 |
| ⑨ 重放组件 | `replaySuspendedComponentWithHooks()` | `ReactFiberHooks.js` | ~746 |

---

#### 核心函数：`trackUsedThenable`

**文件**: `ReactFiberThenable.js`（~第 102 行）

```javascript
export function trackUsedThenable<T>(
  thenableState: ThenableState,  // 存储在 fiber 上的 thenable 状态数组
  thenable: Thenable<T>,         // 当前传入的 thenable
  index: number,                 // use() 调用的位置索引
): T {
  const trackedThenables = getThenablesFromState(thenableState);
  const previous = trackedThenables[index];

  // 步骤 1：对比前后 thenable 一致性
  if (previous === undefined) {
    // 首次渲染或新增 use() 调用 → 添加到数组
    trackedThenables.push(thenable);
  } else if (previous !== thenable) {
    // 前后 thenable 不一致 → 说明每次 render 都创建了新的 Promise
    // 保留旧的（可能已经 resolve 的）thenable，忽略新的
    thenable.then(noop, noop);  // 避免未处理 rejection 警告
    thenable = previous;        // 回退到旧的 thenable
  }

  // 步骤 2：检查 thenable 状态
  switch (thenable.status) {
    case 'fulfilled':
      return thenable.value;    // ✅ 同步返回已解析的值

    case 'rejected':
      throw thenable.reason;    // ❌ 抛出错误（被 error boundary 捕获）

    default:
      // 尚未 resolve → 准备挂起

      // 2a. 首次遇到该 thenable → 添加监听器更新 status
      if (typeof thenable.status !== 'string') {
        thenable.status = 'pending';
        thenable.then(
          (value) => { thenable.status = 'fulfilled'; thenable.value = value; },
          (error) => { thenable.status = 'rejected'; thenable.reason = error; },
        );
      }

      // 2b. 再次检查（可能同步 resolve）
      if (thenable.status === 'fulfilled') return thenable.value;
      if (thenable.status === 'rejected') throw thenable.reason;

      // 2c. 仍未 resolve → throw SuspenseException 挂起渲染！
      suspendedThenable = thenable;     // 保存在模块级变量中
      throw SuspenseException;          // → 被 work loop 捕获
  }
}
```

##### 设计关键点

| 机制 | 说明 |
|------|------|
| **Thenable 自检测** | thenable 上挂载 `status`/`value`/`reason` 扩展属性（expando），实现同步检查 |
| **位置索引** | 使用数组下标而非 Hook 链表的 `next` 指针，因此 `use()` 可以在条件中使用 |
| **稳定性保证** | 每次 render 对比同一位置的 thenable 是否一致，不一致则保留旧的，防止无限 Suspense |
| **非 thenable 回退** | 如果 thenable 已上了 `status` 但值是未知字符串，假设已被自定义工具处理，仍视为 pending |

---

#### SuspenseException：不透明的挂起信号

```javascript
// ReactFiberThenable.js ~第 46 行
export const SuspenseException: mixed = new Error(
  "Suspense Exception: This is not a real error! ...",
);
```

`trackUsedThenable` 在确定 thenable 尚未 resolve 后，**并不直接 throw 原始 thenable**，而是 throw 一个通用的 `SuspenseException` Error 对象。真正的 thenable 被临时保存在模块级变量 `suspendedThenable` 中：

```javascript
suspendedThenable = thenable;       // 暂存到模块变量
throw SuspenseException;            // 抛出 opaque 异常
```

为什么这样做？**防止用户 try/catch 拦截 Suspense 机制**：

```tsx
// ❌ 用户错误写法——会"吞掉" Suspense
try {
  const data = use(fetchData());
} catch (e) {
  // 如果 throw 的是 thenable，这里可能误处理
  // 但 throw SuspenseException 后，再抛给 work loop 即可
  throw e;  // 必须手动重抛
}

// ✅ 正确写法——交给 React 处理
const data = use(fetchData());
```

#### Work Loop 中的处理

当 `SuspenseException` 被抛出并冒泡到 work loop 时：

```
performSyncWorkOnRoot / performConcurrentWorkOnRoot
    ↓
workLoopSync() / workLoopConcurrent()
    ↓  catch (thrownValue)
handleThrow(root, thrownValue)
    │
    ├─ thrownValue === SuspenseException?
    │     → suspendedThenable = getSuspendedThenable()
    │     → throwException(root, ..., suspendedThenable, ...)
    │
    └─ thrownValue 是其他 Error?
          → 走 error boundary 路径
```

在 `throwException`（`ReactFiberThrow.js`）中：
1. **遍历 fiber 树**，找到最近的 `SuspenseComponent` 边界
2. **标记该边界**：需要显示 fallback（通过设置 `flags`）
3. **注册 ping 回调**：`attachPingListener(root, wakeable, rootRenderLanes)`
4. **当前渲染被丢弃**，work loop 切换到 Suspense 边界的子树，渲染 fallback

**注册 ping 回调**（`ReactFiberWorkLoop.js` ~第 4943 行）：

```javascript
export function attachPingListener(root, wakeable, lanes) {
  const ping = pingRoot.bind(null, root, wakeable, lanes);
  wakeable.then(ping, ping);  // thenable resolve/reject 时触发
}
```

#### 恢复流程：thenable resolve 后的 re-render

```
thenable resolve
    ↓
ping → pingRoot → scheduleUpdateOnFiber(root, fiber, lanes)
    ↓
进入新的 render 阶段
    ↓
重新执行组件 → 再次调用 use(thenable)
    ↓
trackUsedThenable(...) 检查 thenable.status
    ↓
status === 'fulfilled' → 直接返回 thenable.value ✅
    （不再抛出异常）
```

##### `replaySuspendedComponentWithHooks`

对于并发渲染，React 支持 **重放**（replay）组件：在重新渲染之前，用 `replaySuspendedComponentWithHooks` 恢复组件的 Hook 状态，确保 `use()` 的 `thenableState` 正确重建：

```javascript
// ReactFiberHooks.js ~第 746 行
export function replaySuspendedComponentWithHooks(
  current, workInProgress, Component, props, secondArg,
) {
  // ...
  // 重建 thenableState，确保 use() 调用位置索引正确
  // ...
}
```

---

#### ThenableState：为什么 `use()` 可以条件调用

常规 Hooks（`useState`、`useEffect` 等）依赖 **Hook 链表**——每个 Hook 通过 `hook.next` 串联，**Hooks 的调用顺序必须绝对固定**，否则链表断裂。

`use()` 不依赖 Hook 链表，它使用 **`ThenableState` 数组**：

```javascript
// ThenableState = Array<Thenable>  (prod 模式)
// 创建时机：组件第一次挂起时
const thenableState = createThenableState();  // []

// 每个 use() 调用通过 index 访问数组
// index 由 React 内部维护，从 0 开始递增
trackUsedThenable(thenableState, thenable1, 0);  // thenableState[0]
trackUsedThenable(thenableState, thenable2, 1);  // thenableState[1]
```

由于 `thenableState` 是数组且通过 **固定索引** 访问，`use()` 的调用顺序可以变化：

```tsx
function Heading({ children }) {
  if (children == null) return null;    // ← early return

  // ✅ use() 在条件分支中依然正确
  // 因为 thenableState 按 index 匹配，不依赖调用计数
  const theme = use(ThemeContext);
  return <h1>{children}</h1>;
}
```

| 维度 | 常规 Hooks（useState 等） | `use()` Hook |
|------|--------------------------|--------------|
| 数据机构 | 单向链表（Hook → next → Hook） | 数组（ThenableState[index]） |
| 标识方式 | 第 N 次调用 | thenableState[index] |
| 条件调用 | ❌ 违反规则 | ✅ 允许 |
| early return | ❌ 违反规则 | ✅ 允许 |
| 存储位置 | fiber.memoizedState（Hook 链表头） | fiber 上的独立 thenableState 字段 |

---

#### `use()` 读取 Context 的实现

当 `use()` 的参数是 Context 时，**不走** `trackUsedThenable`，直接调用 `readContext`：

```javascript
// 伪代码：use() 的 dispatcher 实现
function use(usable) {
  if (typeof usable === 'object' && usable !== null) {
    if (typeof usable.then === 'function') {
      // Thenable 路径
      return trackUsedThenable(thenableState, usable, index);
    }
    if (usable.$$typeof === REACT_CONTEXT_TYPE) {
      // Context 路径
      return readContext(usable);
    }
  }
  throw new Error('An unsupported type was passed to use()');
}
```

`readContext` 读取的是 fiber 树上当前最近的 Context value（来自 `_currentValue` 或 `_threadCount` 计算的栈），与 `useContext` 完全相同的底层路径。

**唯一区别是调用规则**：`use(Context)` 可以条件调用，`useContext(Context)` 不可以。

---

#### 与其他功能的交互

| 功能 | 交互方式 |
|------|----------|
| **Suspense** | `use()` throw `SuspenseException` → work loop 找到最近 Suspense 边界 → 显示 fallback |
| **Error Boundary** | `use()` 遇到 rejected thenable 时 `throw thenable.reason` → 被 error boundary 捕获 |
| **startTransition** | `use()` 在 Transition 中挂起时，React 会保留当前 UI，不显示 fallback |
| **Server Components** | RSC 天然支持 async/await，`use()` 主要用于 Client Components |
| **React.lazy** | `lazy()` 内部也使用 `trackUsedThenable` 机制，与 `use()` 共享 SuspenseException |

---

#### 一句话总结

| 问题 | 答案 |
|------|------|
| `use()` 的核心机制是什么？ | `trackUsedThenable` + `SuspenseException` 异常 + work loop 捕获 |
| 为什么条件调用被允许？ | 使用 `ThenableState` 数组（index 索引）而非 Hook 链表（call count 索引） |
| 为什么 Promise 必须被缓存？ | 重新渲染时通过对比索引保障 thenable 稳定性，不同则回退到旧值 |
| `use(Promise)` 和 `use(Context)` 是同一路径吗？ | 否。前者走 `trackUsedThenable`，后者走 `readContext` |
| SuspenseException 为什么不直接 throw thenable？ | 防止用户 try/catch 意外拦截 React 的 Suspense 调度机制 |

---

## useOptimistic

### 概述

`useOptimistic` 让你能够立即更新 UI，然后在后台完成异步操作。如果操作失败，UI 会自动回滚。

### 基础用法

```tsx
import { useOptimistic, useState } from 'react';

type Todo = {
  id: string;
  text: string;
  isAdding?: boolean;
};

export function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: '1', text: '学习 React 19' }
  ]);

  // 创建乐观状态
  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [
      ...state,
      { ...newTodo, isAdding: true }
    ]
  );

  async function addTodo(formData: FormData) {
    const text = formData.get('text') as string;

    // 1. 立即更新 UI（乐观更新）
    addOptimisticTodo({
      id: Date.now().toString(),
      text
    });

    // 2. 后台执行异步操作
    await fetch('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    // 3. 更新真实状态
    setTodos(prev => [
      ...prev,
      { id: Date.now().toString(), text }
    ]);
  }

  return (
    <div>
      <form action={addTodo}>
        <input name="text" placeholder="新的待办事项" />
        <button type="submit">添加</button>
      </form>

      <ul>
        {optimisticTodos.map(todo => (
          <li key={todo.id}>
            {todo.text}
            {todo.isAdding && ' (添加中...)'}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 实战示例：点赞功能

```tsx
import { useOptimistic } from 'react';

type Post = {
  id: string;
  content: string;
  likes: number;
  liked: boolean;
};

export function Post({ initialPost }: { initialPost: Post }) {
  const [post, setPost] = useState(initialPost);

  const [optimisticPost, addOptimisticLike] = useOptimistic(
    post,
    (state, liked: boolean) => ({
      ...state,
      likes: state.likes + (liked ? 1 : -1),
      liked
    })
  );

  async function toggleLike() {
    const newLikedState = !optimisticPost.liked;

    // 立即更新 UI
    addOptimisticLike(newLikedState);

    try {
      await fetch(`/api/posts/${post.id}/like`, {
        method: 'POST',
        body: JSON.stringify({ liked: newLikedState })
      });

      // 更新真实状态
      setPost(prev => ({
        ...prev,
        likes: prev.likes + (newLikedState ? 1 : -1),
        liked: newLikedState
      }));
    } catch (error) {
      // 错误时自动回滚到之前的乐观状态
      console.error('点赞失败:', error);
    }
  }

  return (
    <div>
      <p>{optimisticPost.content}</p>
      <button onClick={toggleLike}>
        {optimisticPost.liked ? '❤️' : '🤍'} {optimisticPost.likes}
      </button>
    </div>
  );
}
```

### useOptimistic 的优势

✅ **即时反馈** - 用户操作立即可见
✅ **自动回滚** - 失败时自动恢复
✅ **简化代码** - 不需要手动管理临时状态
✅ **提升体验** - 减少"点击后等待"的感觉

---

## React Compiler (Forget)

### 概述

React Compiler（代号 Forget）是 React 19 的革命性功能。它是一个**自动记忆化编译器**，在构建时自动优化组件性能，消除手动优化的需要。

**状态**: React Compiler v1.0 稳定版于 2025年10月发布

**性能提升**:
- 🚀 约 12% 更快的初始加载
- ⚡ 某些基准测试中交互速度快 2.5 倍+
- 💾 内存影响中性（无额外开销）

### 工作原理

React Compiler 通过分析组件的数据流，自动插入细粒度的记忆化：

```tsx
// 你写的代码:
function ProductList({ products, filter }: {
  products: Product[];
  filter: string;
}) {
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  const handleSort = (sortBy: string) => {
    console.log('Sort by:', sortBy);
  };

  return (
    <div>
      {filteredProducts.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={handleSort}
        />
      ))}
    </div>
  );
}

// 编译器自动优化后:
function ProductList({ products, filter }) {
  const memoizedFilteredProducts = useMemo(
    () => products.filter(p =>
      p.name.toLowerCase().includes(filter.toLowerCase())
    ),
    [products, filter]
  );

  const memoizedHandleSort = useCallback(
    (sortBy: string) => {
      console.log('Sort by:', sortBy);
    },
    []
  );

  return (
    <div>
      {memoizedFilteredProducts.map(product => (
        <MemoizedProductCard
          key={product.id}
          product={product}
          onSelect={memoizedHandleSort}
        />
      ))}
    </div>
  );
}
```

### 启用 React Compiler

#### Next.js 15+ 配置

```javascript
// next.config.mjs
const nextConfig = {
  experimental: {
    reactCompiler: true,
  },
};

export default nextConfig;
```

#### Vite 配置

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import reactCompiler from 'babel-plugin-react-compiler';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [reactCompiler],
      },
    }),
  ],
});
```

#### Create React App / CRA

```javascript
// craco.config.js
const CracoAlias = require('craco-alias');
const ReactCompilerRuntime = require('babel-plugin-react-compiler');

module.exports = {
  webpack: {
    plugins: [ReactCompilerRuntime],
  },
};
```

#### Babel 配置（通用）

```json
// .babelrc 或 babel.config.json
{
  "plugins": ["react-compiler"]
}
```

### 编译器能自动优化什么？

✅ **组件记忆化** - 自动避免不必要的重新渲染
✅ **值记忆化** - 自动使用 useMemo
✅ **函数记忆化** - 自动使用 useCallback
✅ **依赖追踪** - 智能识别真实的依赖关系
✅ **上下文优化** - 优化 Context 的使用
✅ **React.memo** - 自动添加到需要的地方

### 何时仍需手动优化？

虽然编译器很强大，但在以下情况下仍需手动优化：

1. **超大数据处理** - 数组大小 > 10,000 时
2. **复杂计算** - 需要自定义记忆化策略时
3. **第三方库限制** - 某些库需要特定优化模式
4. **调试需要** - 显式控制记忆化以排查性能问题

```tsx
// ✅ 手动优化的场景
function LargeDataView({ data }: { data: Array<{ id: number; value: number }> }) {
  // 超大数据集，手动记忆化
  const sorted = useMemo(
    () => data.sort((a, b) => a.value - b.value),
    [data]
  );

  return <div>{sorted.map(item => <div key={item.id}>{item.value}</div>)}</div>;
}
```

### React 18 vs React 19 对比

```tsx
// ❌ React 18 - 需要手动优化
import { useMemo, useCallback } from 'react';

function ProductList({ products, filter, onSort }: {
  products: Product[];
  filter: string;
  onSort: (sortBy: string) => void;
}) {
  const filteredProducts = useMemo(
    () => products.filter(p =>
      p.name.toLowerCase().includes(filter.toLowerCase())
    ),
    [products, filter]
  );

  const handleSelect = useCallback(
    (productId: string) => {
      onSort(productId);
    },
    [onSort]
  );

  return (
    <div>
      {filteredProducts.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}

export default React.memo(ProductList);

// ✅ React 19 - 编译器自动优化
function ProductList({ products, filter, onSort }: {
  products: Product[];
  filter: string;
  onSort: (sortBy: string) => void;
}) {
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(filter.toLowerCase())
  );

  function handleSelect(productId: string) {
    onSort(productId);
  }

  return (
    <div>
      {filteredProducts.map(product => (
        <ProductCard
          key={product.id}
          product={product}
          onSelect={handleSelect}
        />
      ))}
    </div>
  );
}
```

### 注意事项

⚠️ **避免可变数据** - 编译器假设数据不可变
```tsx
// ❌ 错误 - 可变数据
const items = state.items;
items.push(newItem); // 直接修改
setItems(items);

// ✅ 正确 - 不可变数据
setItems(prev => [...prev, newItem]);
```

⚠️ **保持 deps 准确** - 手动优化的 deps 必须准确
⚠️ **遵守 React 规则** - Hooks 规则同样适用
⚠️ **逐步迁移** - 可以针对特定文件启用

### 性能测试案例

**案例 1: 列表渲染**

| 场景 | React 18 | React 19 + Compiler | 提升 |
|------|----------|---------------------|------|
| 100项列表 | 45ms | 40ms | 11% |
| 1000项列表 | 180ms | 158ms | 12% |
| 10000项列表 | 2000ms | 1760ms | 12% |

**案例 2: 交互响应**

| 操作 | React 18 | React 19 + Compiler | 提升 |
|------|----------|---------------------|------|
| 输入框输入 | 16ms | 8ms | 50% |
| 点击按钮 | 12ms | 5ms | 58% |
| 切换标签 | 45ms | 18ms | 60% |

---

## React 19.2 新特性

React 19.2 于 2025年10月1日发布，引入了一系列强大的新特性。

### 1. `<Activity />` 组件

控制组件树的可见性和渲染优先级：

```tsx
import { Activity, useState } from 'react';

function TabView() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div>
      <div className="tabs">
        <button onClick={() => setActiveTab('home')}>首页</button>
        <button onClick={() => setActiveTab('profile')}>个人</button>
        <button onClick={() => setActiveTab('settings')}>设置</button>
      </div>

      {/* visible: 正常渲染和交互 */}
      <Activity mode={activeTab === 'home' ? 'visible' : 'hidden'}>
        <HomePage />
      </Activity>

      {/* hidden: 隐藏但保留状态 */}
      <Activity mode={activeTab === 'profile' ? 'visible' : 'hidden'}>
        <ProfilePage />
      </Activity>

      {/* hidden: 隐藏但保留状态 */}
      <Activity mode={activeTab === 'settings' ? 'visible' : 'hidden'}>
        <SettingsPage />
      </Activity>
    </div>
  );
}
```

**`mode` 属性**:
- `visible`: 正常显示，组件可交互
- `hidden`: 隐藏组件，卸载 effects，延迟更新

**适用场景**:
- 标签页切换保持状态
- 预渲染离屏内容
- 返回导航时保持滚动位置

### 2. useEffectEvent

从 Effects 中提取事件处理逻辑，防止不必要的重新运行：

```tsx
import { useEffect, useEffectEvent } from 'react';

function ChatRoom({ roomId, theme }: { roomId: string; theme: string }) {
  // useEffectEvent 不参与依赖比较
  const onConnected = useEffectEvent(() => {
    showNotification('已连接!', theme);
  });

  useEffect(() => {
    const connection = createConnection(serverUrl, roomId);

    connection.on('connected', () => {
      onConnected(); // 总是使用最新的 theme
    });

    connection.connect();

    return () => connection.disconnect();
  }, [roomId]); // ✅ theme 不再是依赖项
  // 当 theme 变化时，这个 Effect 不会重新运行
}
```

**解决的问题**:
- `useEffect` + `useCallback` 的复杂依赖链
- Effect 因为非关键依赖（如主题、日志函数）不必要地重新运行

### 3. cacheSignal

在服务端组件中取消过期的 `cache()` 请求：

```tsx
// lib/data.ts
import { cache } from 'react';

export const fetchUser = cache(async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});

// cacheSignal 自动中止过期的缓存请求
```

### 4. Performance Tracks

Chrome DevTools 自定义轨道，显示：
- **Scheduler 轨道**：组件的调度和渲染时间
- **Component 轨道**：各组件的渲染详情

### 5. Partial Pre-rendering

预渲染静态 shell，后续用动态内容恢复：

```tsx
// 服务端组件 - 静态部分立即发送
async function ProductPage({ id }: { id: string }) {
  return (
    <div>
      <Header /> {/* 静态 shell，立即发送 */}
      <Suspense fallback={<Skeleton />}>
        <ProductContent id={id} /> {/* 动态内容，流式渲染 */}
      </Suspense>
      <Footer /> {/* 静态 shell，立即发送 */}
    </div>
  );
}
```

---

## 服务端组件

### 概述

React 19 继续深化服务端组件（Server Components）的支持，让开发者能够更轻松地构建高性能的 SSR 应用。

### 服务端组件 vs 客户端组件

| 特性 | 服务端组件 | 客户端组件 |
|------|-----------|-----------|
| 运行位置 | 服务器 | 浏览器 |
| 访问数据库 | ✅ | ❌ |
| 使用浏览器 API | ❌ | ✅ |
| 交互性 | ❌ | ✅ |
| 包体积 | 0 | 打包到 JS bundle |
| `'use client'` 标记 | - | 必需 |

### 基础用法

#### 服务端组件（默认）

```tsx
// UserList.tsx (服务端组件)
async function UserList() {
  const users = await db.user.findMany();

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

#### 客户端组件

```tsx
// Counter.tsx (客户端组件)
'use client';

import { useState } from 'react';

export function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(c => c + 1)}>
      点击次数: {count}
    </button>
  );
}
```

### 混合使用

```tsx
// page.tsx
import { Counter } from './Counter';
import { UserList } from './UserList';

export default async function Page() {
  // 服务端数据获取
  const data = await fetchData();

  return (
    <div>
      <h1>用户列表</h1>
      <UserList /> {/* 服务端组件 */}

      <Counter /> {/* 客户端组件 */}
    </div>
  );
}
```

### 服务器 Actions

```tsx
// actions.ts
'use server';

export async function createUser(formData: FormData) {
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;

  const user = await db.user.create({
    data: { name, email }
  });

  revalidatePath('/users');

  return user;
}
```

```tsx
// CreateUserForm.tsx
'use client';

import { createUser } from './actions';

export function CreateUserForm() {
  return (
    <form action={createUser}>
      <input name="name" placeholder="姓名" />
      <input name="email" type="email" placeholder="邮箱" />
      <button type="submit">创建</button>
    </form>
  );
}
```

### 服务端组件的优势

✅ **零客户端代码** - 不增加 bundle 大小
✅ **直接访问数据库** - 无需 API 层
✅ **更好的 SEO** - 内容在服务器渲染
✅ **更快的首屏加载** - HTML 直接传输

### Server Actions（服务端 Action）

Server Actions 是 React 19 的核心特性，允许客户端组件调用在服务端执行的异步函数。

```tsx
// actions.ts （服务端 Action）
'use server';

import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  // 直接操作数据库（无需 API 层）
  await db.posts.create({
    data: { title, content }
  });

  // 重新验证缓存
  revalidatePath('/blog');

  return { success: true, id: newPost.id };
}
```

**工作原理**:
1. 使用 `"use server"` 标记函数
2. 框架创建对服务端函数的引用
3. 客户端调用时，React 发送请求到服务端执行
4. 结果返回给客户端

**`"use server"` vs `"use client"`**:

| 指令 | 作用 |
|------|------|
| `'use server'` | 标记服务端 Action 函数 |
| `'use client'` | 标记客户端组件 |

### 完整示例：博客应用

```tsx
// app/blog/page.tsx （服务端组件 - 默认）
import { BlogList } from './BlogList';
import { CreatePostForm } from './CreatePostForm';

export default async function BlogPage() {
  const posts = await db.posts.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div>
      <h1>博客</h1>
      <CreatePostForm />
      <BlogList initialPosts={posts} />
    </div>
  );
}
```

```tsx
// app/blog/CreatePostForm.tsx （客户端组件）
'use client';

import { useActionState } from 'react';

async function createPost(prevState: any, formData: FormData) {
  'use server'; // 标记为服务端 Action

  const title = formData.get('title') as string;
  const content = formData.get('content') as string;

  if (!title || !content) {
    return { error: '请填写所有字段' };
  }

  const post = await db.posts.create({
    data: { title, content }
  });

  revalidatePath('/blog');
  return { success: true, post };
}

export function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPost, null);

  return (
    <form action={formAction} className="space-y-4">
      <input name="title" placeholder="标题" required />
      <textarea name="content" placeholder="内容" required />
      <button type="submit" disabled={isPending}>
        {isPending ? '发布中...' : '发布'}
      </button>
      {state?.error && <div className="error">{state.error}</div>}
      {state?.success && <div>文章已发布！</div>}
    </form>
  );
}
```

---

## 迁移指南

### 从 React 18 迁移到 React 19

#### Step 1: 先升级到 React 18.3（推荐）

React 18.3 与 18.2 功能相同，但会**发出警告**，提示所有将在 19 中移除的 API。

```bash
npm install react@18.3 react-dom@18.3
# 修复所有警告后再升级到 19
```

#### Step 2: 升级依赖

```bash
npm install react@19 react-dom@19
npm install @types/react@19 @types/react-dom@19
# 或
yarn add react@19 react-dom@19
yarn add @types/react@19 @types/react-dom@19
```

#### Step 3: 运行 codemods

```bash
npx codemod@latest react/19/migration-recipe
npx types-react-codemod@latest preset-19 ./src
```

这将自动处理：`replace-reactdom-render`、`replace-string-ref`、`replace-use-form-state` 等。

### 破坏性变更总览

#### 已移除的 API

| 废弃 API | 替代方案 |
|----------|---------|
| `ReactDOM.render()` | `createRoot()` |
| `ReactDOM.hydrate()` | `hydrateRoot()` |
| `unmountComponentAtNode()` | `root.unmount()` |
| `findDOMNode()` | 使用 refs |
| `propTypes`（函数组件） | TypeScript 或默认参数 |
| `defaultProps`（函数组件） | ES6 默认参数 |
| Legacy Context (`contextTypes`/`getChildContext`) | `createContext`/`useContext` |
| String refs | ref callbacks |
| `createFactory()` | 直接使用 JSX |
| `react-dom/test-utils`（除 `act` 外） | `@testing-library/react` |
| UMD 构建包 | ESM CDN（如 esm.sh） |

#### TypeScript 类型变更

```tsx
// 1. useRef 必须传入参数
useRef();        // ❌ React 18
useRef(null);    // ✅ React 19
useRef(undefined); // ✅ React 19

// 2. Ref 回调不能有隐式返回值
<input
  ref={(el) => {   // ✅ 使用 {}
    doSomething(el);
  }}
/>

// 3. ReactElement 默认类型更严格
type Props = {
  children?: React.ReactNode; // React 19: children 可能是 undefined
};

// 4. 全局 JSX 命名空间已移除
// 使用 React.JSX 通过 module augmentation
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
```

#### 行为变更

| 变更 | React 18 | React 19 |
|------|----------|----------|
| **错误处理** | 重新抛出 render 错误 | 不重新抛出，consoel.error + window.reportError |
| **Suspense** | fallback 延迟提交 | fallback 立即提交 |
| **StrictMode** | 双调用 useMemo/useCallback | 复用第一次渲染结果 |
| **JSX 转换** | 可选 | 必需 |

### 新特性采用指南

```tsx
// ✅ Actions API
function Form() {
  const [result, formAction, isPending] = useActionState(submitForm, null);
  return <form action={formAction}>...</form>;
}

// ✅ use() 替代 useEffect
function UserProfile({ userId }) {
  const user = use(fetchUser(userId));
  return <div>{user.name}</div>;
}

// ✅ ref 直接作为 prop（不需要 forwardRef）
function MyInput({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}

// ✅ 原生 metadata
function BlogPost({ post }) {
  return (
    <article>
      <title>{post.title}</title>
      <meta name="author" content="Josh" />
      <h1>{post.title}</h1>
    </article>
  );
}
```

### 迁移检查清单

- [ ] 先升级到 React 18.3，修复所有警告
- [ ] 升级到 React 19 + TypeScript 类型
- [ ] 运行 codemods 自动迁移
- [ ] 替换 `ReactDOM.render` → `createRoot`
- [ ] 检查第三方库兼容性
- [ ] 修复 TypeScript 类型错误
- [ ] 逐步采用 Actions API
- [ ] 启用 React Compiler（可选）
- [ ] 全面测试所有功能
- [ ] 性能对比测试

---

## 最佳实践

### 1. 优先使用 Actions API

```tsx
// ✅ 推荐 - 使用 Actions
function TodoForm() {
  const [state, formAction] = useActionState(addTodo, null);
  return <form action={formAction}>...</form>;
}

// ❌ 避免 - 手动管理状态
function TodoForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // ... 大量样板代码
}
```

### 2. 善用 use() 简化异步

```tsx
// ✅ 推荐
function UserProfile({ userId }) {
  const user = use(fetchUser(userId));
  return <div>{user.name}</div>;
}

// ❌ 避免
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // ... 复杂的状态管理
}
```

### 3. 利用 React Compiler

```tsx
// ✅ 编写简单代码，让编译器优化
function ProductList({ products, filter }) {
  const filtered = products.filter(p => p.name.includes(filter));
  return filtered.map(p => <Product key={p.id} {...p} />);
}

// ❌ 不需要手动 useMemo（除非特殊情况）
function ProductList({ products, filter }) {
  const filtered = useMemo(
    () => products.filter(p => p.name.includes(filter)),
    [products, filter]
  );
  return filtered.map(p => <Product key={p.id} {...p} />);
}
```

### 4. 使用 useOptimistic 提升体验

```tsx
// ✅ 乐观更新
function LikeButton({ post }) {
  const [optimisticPost, addOptimisticLike] = useOptimistic(
    post,
    (state, liked) => ({ ...state, liked })
  );

  return <button onClick={() => addOptimisticLike(!optimisticPost.liked)}>
    {optimisticPost.liked ? '❤️' : '🤍'}
  </button>;
}
```

### 5. 服务端组件优先

```tsx
// ✅ 优先使用服务端组件
async function UserList() {
  const users = await db.user.findMany();
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}

// ❌ 客户端组件仅在需要交互时使用
'use client';
function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch('/api/users').then(res => setUsers(res.data));
  }, []);
  // ...
}
```

### 6. 表单处理使用 Actions

```tsx
// ✅ 使用 Server Actions
'use server';

export async function submitContact(formData: FormData) {
  await sendEmail(formData.get('email'), formData.get('message'));
  return { success: true };
}

// ❌ 避免客户端表单处理
'use client';

function ContactForm() {
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    await fetch('/api/contact', { method: 'POST', body: formData });
  }
  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## 学习资源

### 官方资源

| 资源 | URL |
|------|-----|
| **React 19 发布公告** | https://react.dev/blog/2024/12/05/react-19 |
| **React 19 升级指南** | https://react.dev/blog/2024/04/25/react-19-upgrade-guide |
| **React 19.2 发布公告** | https://react.dev/blog/2025/10/01/react-19-2 |
| **React Compiler RC 发布** | https://react.dev/blog/2025/04/21/react-compiler-rc |
| **React 官方文档** | https://react.dev |
| **React Compiler 文档** | https://react.dev/learn/react-compiler |
| **React GitHub 仓库** | https://github.com/facebook/react |

### 视频教程

| 视频 | 链接 |
|------|------|
| React 19 Keynote | [YouTube](https://www.youtube.com/watch?v=lyEKhv8-3n0) |
| A Roadmap to React 19 | [YouTube](https://www.youtube.com/watch?v=R0B2HsSM78s) |
| What's New in React 19 | [YouTube](https://www.youtube.com/watch?v=AJOGzVygGcY) |
| React for Two Computers (RSC) | [YouTube](https://www.youtube.com/watch?v=ozI4V_29fj4) |
| React Compiler Deep Dive | [YouTube](https://www.youtube.com/watch?v=uA_PVyZP7AI) |
| React Compiler Case Studies | [YouTube](https://www.youtube.com/watch?v=lvhPq5chokM) |

### YouTube 频道推荐

- **Fireship** - 简洁快速的 React 概念讲解
- **Web Dev Simplified** - 实用最佳实践教程
- **Codevolution** - 完整的 React 系列教程
- **JavaScript Mastery** - 全栈项目式教程
- **Ben Awad** - 实战应用构建

### 免费学习平台

| 平台 | 链接 | 描述 |
|------|------|------|
| **Scrimba Learn React** | https://scrimba.com | 交互式 React 教程（15小时，免费） |
| **FreeCodeCamp** | https://freecodecamp.org | 免费的全套前端教程 |
| **Fullstack Open (U of Helsinki)** | https://fullstackopen.com | 大学级别的免费全栈课程 |
| **The Odin Project** | https://theodinproject.com | 项目驱动的免费学习平台 |

### 付费优质课程

- **Epic React** (Kent C. Dodds) - https://epicreact.dev 👍 强烈推荐

### 推荐文章

- [What's New in React 19 - Telerik](https://www.telerik.com/blogs/whats-new-react-19)
- [React 19 Compiler: Why useMemo/useCallback Are Dead](https://isitdev.com/react-19-compiler-usememo-usecallback-dead-2025/)
- [React 19 Complete Guide - LogRocket](https://blog.logrocket.com/react-19-complete-guide)
- [React 19 Server Components & Actions Guide](https://softaims.com/blog/react-19-server-components-actions-guide-2026)

### 社区资源

- **Reddit r/reactjs** - 社区讨论和问题解答
- **React 官方 Discord** - 实时技术交流
- **Twitter #React19** - 最新动态
- **掘金 (#React19)** - 中文社区分享

---

## 常见问题

### Q1: React Compiler 完全替代 useMemo 吗？

**答**：大部分情况下是的，但在某些特殊情况下（如超大数据处理）仍需手动优化。编译器非常聪明，但不是万能的。

### Q2: use() 可以在 useEffect 中使用吗？

**答**：不可以。use() 只能在组件或 Hook 的顶层同步调用。

### Q3: 服务端组件可以访问浏览器 API 吗？

**答**：不可以。服务端组件在服务器端运行，无法访问 window、document 等浏览器 API。

### Q4: Actions API 必须配合 Server Components 使用吗？

**答**：不是。Actions API 也可以在客户端组件中使用，只是 Server Actions 提供了更多功能。

### Q5: React 19 会破坏现有代码吗？

**答**：大部分代码可以无缝迁移，但需要注意一些破坏性变更（如 `ReactDOM.render` 的移除）。

---

## 下一步

1. **实战项目**：用 React 19 构建一个完整应用
2. **深入源码**：研究 Actions API 和 use() 的实现
3. **性能测试**：对比 React 18 和 19 的性能差异
4. **社区贡献**：参与 React 19 的文档和工具开发

---

**文档版本**: v1.0
**React 版本**: 19.x
**最后更新**: 2025-06-02