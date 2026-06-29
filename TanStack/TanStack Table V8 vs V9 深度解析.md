# TanStack Table V8 vs V9 深度解析

> 总结自三次问答：Table State 概念 → V9 性能提升原理 → state/atoms/store 三属性差异
>
> 日期：2026-06-26

---

## 一、Table State 是什么

### 核心定义

**Table State** 是 TanStack Table 中所有可变的、与表格交互相关的状态的统称。它不是业务数据，而是**用户交互行为的声明式描述**。

| State Slice | 类型 | 含义 | 依赖 Feature |
|---|---|---|---|
| `pagination` | `{ pageIndex, pageSize }` | 当前页码和每页行数 | `rowPaginationFeature` |
| `sorting` | `{ id, desc }[]` | 哪些列在排序，升序还是降序 | `rowSortingFeature` |
| `columnFilters` | `{ id, value }[]` | 列级别的过滤条件 | `columnFilteringFeature` |
| `globalFilter` | `any` | 全局搜索关键词 | `globalFilteringFeature` |
| `rowSelection` | `Record<string, boolean>` | 哪些行被选中 | `rowSelectionFeature` |
| `columnVisibility` | `Record<string, boolean>` | 哪些列隐藏/显示 | `columnVisibilityFeature` |
| `columnOrder` | `string[]` | 列的顺序 | `columnOrderFeature` |
| `columnPinning` | `{ left, right }` | 哪些列固定左右 | `columnPinningFeature` |
| `columnSizing` | `Record<string, number>` | 列宽 | `columnSizingFeature` |
| `expanded` | `Record<string, boolean>` | 哪些行展开了子行 | `rowExpandingFeature` |
| `grouping` | `string[]` | 按哪些列分组 | `rowGroupingFeature` |
| `rowPinning` | `{ top, bottom }` | 哪些行固定在顶部/底部 | `rowPinningFeature` |

### 核心设计思想

TanStack Table 是 **Headless UI** —— 不渲染任何 DOM，只管理**状态**和**逻辑**：

```
State 是数据（存储原始交互状态）
RowModel 是派生（根据 state + data 实时计算）
你改变 state → 引擎自动重新计算 rowModel → UI 自动更新
```

### 三种使用方式

| 方式 | 说明 | 推荐场景 |
|---|---|---|
| **Uncontrolled（全托管）** | 内部管理所有状态，直接调用 API | 快速原型、简单表格 |
| **Controlled（受控）** | state + on[State]Change 外部持有状态 | 生产项目、需要外部共享/持久化 |
| **initialState（一次初始化）** | 仅设置默认值，后续不受控制 | 设置初始排序/分页 |

### 使用得当的好处

1. **解耦**：状态逻辑与 UI 渲染彻底分离
2. **可序列化**：所有 Table State 都是 plain JSON → 可保存到 URL / localStorage / 后端
3. **性能优化**：原子化状态 → 只订阅需要的 slice
4. **跨组件共享**：多个组件通过同一 state 对象沟通
5. **可测试性**：纯函数式 `(data, state) → rowModel`

---

## 二、V9 性能提升的 6 大支柱

### 支柱 1：状态管理架构 — TanStack Store + Atom

| | V8 | V9 |
|---|---|---|
| 底层 | React `useState` | TanStack Store（alien-signals） |
| 状态单元 | 一个巨大的 state 对象 | 每个 slice 一个独立 Atom |
| 变化传播 | 整个 table 实例变化 | 只有变化的 atom 通知订阅者 |
| React Compiler | ❌ 不兼容 | ✅ 完全兼容 |

```tsx
// V9 - 使用独立原子
const paginationAtom = useCreateAtom({ pageIndex: 0, pageSize: 10 })
const table = useTable({ features, columns, data, atoms: { pagination: paginationAtom } })
```

### 支柱 2：渲染控制 — Selector + Subscribe

```
V8: 任何 state 变化 → 整表重渲染
V9: 翻页 → 只有分页控件重渲染
     排序 → 只有表头箭头重渲染
     选中行 → 只有 checkbox 和计数器重渲染
```

**两层控制**：

```tsx
// 第一层：顶层 Selector 缩小 table.state
const table = useTable(opts, s => ({ pagination: s.pagination }))

// 第二层：Subscribe 在真正需要的地方订阅
<table.Subscribe source={table.atoms.rowSelection}>
  {(rowSelection) => <span>{Object.keys(rowSelection).length} 行已选中</span>}
</table.Subscribe>
```

### 支柱 3：内存优化 — 大型虚拟表

- **共享原型**：V9 将 row/cell/header 的方法提升到原型上，V8 中每行每单元格有独立方法副本
- **减少中间对象**：消除不必要的临时数组和 row model 克隆
- 行对象大小减少 **60-70%**，GC 暂停次数显著减少

### 支柱 4：Tree-shaking — 特性按需注册

```tsx
// V9 - 只注册你需要的特性
const features = tableFeatures({
  rowPaginationFeature,
  rowSortingFeature,
})
// 没有注册 grouping → 分组代码不会被打包
// 类型上 table.setGrouping() 也不存在
```

### 支柱 5：TypeScript 类型性能

| 基准 | V8 | V9 α | V9 β | 改善 |
|---|---|---|---|---|
| table-core tsc | 78,054 | 1,230,007 | 266,723 | **-78.3%** |
| react-table | - | 235,498 | 54,442 | **-76.9%** |
| solid-table | - | 198,164 | 28,637 | **-85.6%** |
| vue-table | - | 244,756 | 92,747 | **-62.1%** |

**四个优化手段**：

1. **Feature Map 替代 14 个手写条件分支**：命名接口的惰性求值替代条件类型的主动展开
2. **`Table_Internal` 改为纯 Interface**：内部代码不用条件类型，避免每次调用重新展开
3. **`in out` Variance 注解**：告诉编译器直接按类型参数比较，跳过结构探测
4. **适配器中显式类型参数**：`constructTable<TFeatures, TData>({...})` 避免从匿名对象反向推断类型

### 支柱 6：静态函数导出

```ts
import { row_getIsSelected } from '@tanstack/react-table/static-functions'
const isSelected = row_getIsSelected(row)  // 绕过 builder 模式的 memoization 开销
```

---

## 三、state / atoms / store 三属性深度对比

### V8：只有一个 `getState()`

```tsx
// V8 —— 唯一的访问方式
const allState = table.getState()
// 永远返回全量 state
// 任何 slice 变化 → 整个表格重渲染
```

### V9：三层架构

```
┌──────────────────────────────────────────────┐
│  table.state    React 专属选择性投影           │
│  受 useTable 第二个参数 selector 控制          │
│  只包含你选的 slice，React 对它做浅比较         │
├──────────────────────────────────────────────┤
│  table.atoms    框架无关细粒度原子              │
│  每个 state slice 对应一个独立原子              │
│  读: table.atoms.sorting.get()                │
│  写: table.baseAtoms.pagination.set(...)      │
│  订阅: table.Subscribe source={atoms.xxx}     │
├──────────────────────────────────────────────┤
│  table.store    框架无关扁平 Store              │
│  所有 atoms 合并的只读视图                     │
│  table.store.state → 完整状态快照              │
└──────────────────────────────────────────────┘
```

### 完整对比表

| 维度 | V8 `getState()` | V9 `table.state` | V9 `table.atoms` | V9 `table.store` |
|---|---|---|---|---|
| **返回内容** | 全量 state | Selector 投影的子集 | 单个 state slice | 完整扁平 state |
| **类型** | 固定 `TableState` | 由 selector 推断 | 精确到 slice（如 `ReadonlyAtom<SortingState>`） | 完整 `TableState` |
| **响应式** | React setState | TanStack Store 信号 | TanStack Store 信号 | TanStack Store 信号 |
| **订阅细度** | 全量 | 按 slice 集合 | 按单个 slice | 按 selector 选择 |
| **读值不订阅** | 做不到 | `() => null` 时 | ✅ `table.atoms.sorting.get()` | ✅ `table.store.state.sorting` |
| **外部共享** | 靠 state 提升 + props | 同左 | ✅ 外部 `useCreateAtom` + 传入 `atoms` | 间接通过 atoms |
| **React Compiler** | ❌ | ✅ | ✅（通过 Subscribe） | ✅（通过 Subscribe） |
| **框架无关性** | ❌（React 绑定） | ❌（React 专属） | ✅ | ✅ |

### 使用决策树

```
你需要什么?
│
├─ 只要当前快照值（不关心后续变化）
│  → table.atoms.xxx.get() 或 table.store.state.xxx
│
├─ 需要响应式渲染（state 变化时重渲染此组件）
│  → table.state（通过 useTable selector）
│  → 或 table.Subscribe（局部订阅）
│
├─ 在深层子组件精确订阅某个 slice
│  → table.Subscribe source={atoms.xxx}
│
├─ 一次性读多个 slice
│  → table.store.state
│
└─ 在表格外部共享状态
   → 外部 createAtom → 传入 atoms → 外部 useSelector
```

---

## 四、参考链接

- [TanStack Table V9: Taking Form（官方博客）](https://tanstack.com/blog/tanstack-table-v9-taking-form)
- [TypeScript Performance in V9（官方博客）](https://tanstack.com/blog/tanstack-table-v9-typescript-performance)
- [V9 Table State 官方指南](https://tanstack.com/table/beta/docs/framework/react/guide/table-state)
- [V8 → V9 迁移指南](https://tanstack.com/table/beta/docs/framework/react/guide/migrating)
- [Composable Tables 示例](https://tanstack.com/table/beta/docs/framework/react/examples/composable-tables)
- [Kitchen Sink 完整示例](https://tanstack.com/table/beta/docs/framework/react/examples/kitchen-sink)

---

## 五、后续可探索的话题

- [ ] 用 V9 的 `createTableHook` 组合一个真实项目表格
- [ ] TanStack Table V9 + TanStack Query 做服务端分页/排序/过滤
- [ ] V9 自定义 Feature 开发
- [ ] React Compiler 环境下 `Subscribe` 的兼容模式详解
- [ ] 大型虚拟表的实际性能 benchmark 对比
