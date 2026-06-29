# TanStack Table 深度分析：AI 时代的表格选型与实践

> 从传统组件库对比到 AI 时代的范式转移，再到降不一致的工程实践

---

## 一、架构哲学的根本差异：Headless vs. Component-Based

### TanStack Table — Headless（无头）架构

TanStack Table **不渲染任何 DOM 元素**。它是一个"表格状态引擎"——只负责管理排序、筛选、分页、分组、行选择等数据逻辑，把 HTML、CSS、交互全部交给你。

```tsx
// TanStack Table 只给你数据和状态，不给你 UI
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
})
// 你需要自己写 <table>、<thead>、<tbody>、<td>
```

### 传统 UI 组件库（Ant Design / Element Plus / AG Grid）— 全栈组件

它们是"完成品"——组件自带样式、结构、交互：

```tsx
// Ant Design Table 给你一个完整的、带样式的表格
<Table dataSource={data} columns={columns} />
```

---

## 二、Row Models 深度解析 —— 数据处理管道

Row Models 是理解 TanStack Table 设计的 **钥匙**——它解释了为什么这个库和传统表格组件有根本性的不同。

### 2.1 一句话定义

> **Row Models 是一串可插拔的数据处理管道（Pipeline），原始数据经过一系列按固定顺序执行的变换步骤，最终产出你渲染在屏幕上的行。**

### 2.2 直观对比

**传统组件库（Ant Design / Element Plus）的数据流：**
```
你的数据 → [黑盒内部处理] → 渲染
```

**TanStack Table 的数据流：**
```
你的数据 → Core → Filtered → Grouped → Sorted → Expanded → Paginated → 最终行
             ↑        ↑          ↑        ↑         ↑           ↑
          你插入   你插入     你可选   你插入     你可选      你插入
```

**关键差异**：TanStack Table 把这个黑盒的每一个处理步骤都暴露给你，你决定启用哪些、插入哪些、顺序怎么走。

### 2.3 为什么需要 Row Models？——设计动机

#### 动机 1：模块化与 Tree-shaking（核心）

这是 TanStack 最重要的设计原则之一：**你不用，就不付费（代码体积）**。

```typescript
// ❌ Ant Design：整个 Table 组件都打包进去了，即使你只用基本行列展示
import { Table } from 'antd'

// ✅ TanStack Table：你只 import 需要的 row model
import { getCoreRowModel } from '@tanstack/react-table'
// 如果你不需要排序，就不要 import getSortedRowModel
// bundle 里就没有排序相关的代码
```

每个 row model 是一个独立的 factory function，tree-shaking 可以精确地把未使用的 row model 从最终 bundle 中移除。

#### 动机 2：明确的数据流（Debugging 友好）

每条数据从进入表格到渲染到屏幕上，经历了哪些变换，每一步做了什么——**完全透明**。

```typescript
// 你可以检查组间的任意阶段
console.log(table.getCoreRowModel().rows)      // 原始数据
console.log(table.getFilteredRowModel().rows)   // 筛选后
console.log(table.getSortedRowModel().rows)     // 排序后
console.log(table.getRowModel().rows)           // 最终渲染
```

#### 动机 3：可替换、可自定义

不满足于内置的筛选/排序实现？你可以**复制源码修改后替换**：

```typescript
const table = useTable({
  _rowModels: {
    sortedRowModel: myCustomSortRowModel, // 用你自己的实现替换
  },
})
```

### 2.4 管道执行顺序（必读）

**顺序是固定的、有原因的。** TanStack Table 内部按照以下顺序依次执行：

```
getCoreRowModel
       ↓
getFilteredRowModel (如果有)
       ↓
getGroupedRowModel   (如果有)
       ↓
getSortedRowModel   (如果有)
       ↓
getExpandedRowModel (如果有)
       ↓
getPaginationRowModel (如果有)
       ↓
getRowModel         ← 最终你渲染用的
```

#### 为什么是这个顺序？

| 步骤顺序 | 理由 |
|---------|------|
| ① **Filter（筛选）在前** | 先减少数据量，后续步骤处理更少行，性能更好 |
| ② **Group（分组）其次** | 分组应该在排序**之前**，因为分组改变行的结构（产生父子行） |
| ③ **Sort（排序）再次** | 排序应该在分组**之后**，对每个组内排序 |
| ④ **Expand（展开）最后** | 展开决定哪些子行可见 |
| ⑤ **Paginate（分页）压轴** | 分页是最后一步，前面的结果决定了"要分页的总数据" |

> **反直觉的例子**：如果你先排序再筛选，那么筛选后显示的顺序可能不是用户期望的顺序。先筛选再排序，确保排序始终在正确的数据集上执行。

#### 如果某个功能被禁用了？

TanStack Table 很聪明——如果你的 feature 没有启用排序，它不会跳过管道，而是使用 `getPreSortedRowModel`（即"上一个 row model 的输出直接透传"）。

```
启用全部功能时：Core → Filtered → Grouped → Sorted → Expanded → Paginated → Final
只启用筛选和分页：Core → Filtered → (preGrouped) → (preSorted) → (preExpanded) → Paginated → Final
                                                    ↑
                                         透传，不做变换
```

### 2.5 V8 vs V9 的配置差异

#### V8 风格（现有项目常见）

```typescript
import {
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table'

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
})
```

#### V9 风格（更清晰的模块划分）

```typescript
import {
  useTable,
  tableFeatures,
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  createFilteredRowModel,
  createSortedRowModel,
  createPaginatedRowModel,
  filterFns,
  sortFns,
} from '@tanstack/react-table'

const _features = tableFeatures({
  columnFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
})

const table = useTable({
  _features,
  _rowModels: {
    filteredRowModel: createFilteredRowModel(filterFns),
    sortedRowModel: createSortedRowModel(sortFns),
    paginatedRowModel: createPaginatedRowModel(),
  },
  columns,
  data,
})
```

V9 把 row models 从**根选项**移到了 `_rowModels` 命名空间下，feature 和 row model 分离得更干净。

### 2.6 Row Models 的三种输出格式

每个 row model 的返回值都包含三种格式：

```typescript
{
  rows: Row[],         // 常规行数组（包含层级结构，子行在 parent.subRows 里）
  flatRows: Row[],     // 扁平化行数组（所有子行被提到顶层）
  rowsById: Record<string, Row>, // 行 ID 到行的映射表
}
```

#### 使用场景

```typescript
// 场景 1：常规渲染——用 rows
<tbody>
  {table.getRowModel().rows.map(row => (
    <tr key={row.id}>{row.getVisibleCells().map(cell => <td key={cell.id}>...</td>)}</tr>
  ))}
</tbody>

// 场景 2：跨层级选中检查——用 flatRows
const allRows = table.getRowModel().flatRows
const allSelected = allRows.every(row => row.getIsSelected())

// 场景 3：通过 ID 快速查找行——用 rowsById（O(1) 查找）
const targetRow = table.getRowModel().rowsById['user_42']
```

### 2.7 完整代码演示：看 pipeline 如何工作

```typescript
import { useReactTable, getCoreRowModel, getFilteredRowModel,
         getSortedRowModel, getPaginationRowModel } from '@tanstack/react-table'

const data = [
  { id: 1, name: '张三', age: 28, city: '北京' },
  { id: 2, name: '李四', age: 35, city: '上海' },
  { id: 3, name: '王五', age: 22, city: '北京' },
  { id: 4, name: '赵六', age: 42, city: '深圳' },
  { id: 5, name: '钱七', age: 31, city: '上海' },
]

const table = useReactTable({
  data,
  columns,
  state: {
    columnFilters: [{ id: 'city', value: '北京' }],  // 只显示北京
    sorting: [{ id: 'age', desc: false }],            // 按年龄升序
    pagination: { pageIndex: 0, pageSize: 2 },         // 每页2条
  },
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
})

console.log('原始数据:', data.length)                          // 5
console.log('Core:', table.getCoreRowModel().rows.length)     // 5
console.log('After Filter:', table.getFilteredRowModel().rows.length)  // 2（张三、王五）
const sorted = table.getSortedRowModel().rows
console.log('After Sort:', sorted.map(r => r.original.name))  // ['王五', '张三']
console.log('Final render:', table.getRowModel().rows.map(r => r.original.name)) // ['王五', '张三']
```

### 2.8 Row Models 解决了哪些传统表格做不到的事？

#### 场景 1："筛选后总共有多少条，但只显示当前页"

传统表格只能拿到"当前页的行"。TanStack Table 可以同时拿多个 stage：

```typescript
// 当前页的行——用于渲染
const pageRows = table.getRowModel().rows

// 筛选后的总行数——用于显示"共 XX 条"
const totalFilteredRows = table.getSortedRowModel().rows.length // 分页前！不受 pagination 影响
const totalRawRows = table.getCoreRowModel().rows.length        // 原始总行数
```

#### 场景 2："表格底部显示筛选后的统计数据"

```typescript
// Footer 中计算筛选后的统计
const filteredData = table.getFilteredRowModel().rows
const avgAge = filteredData.reduce((sum, row) => sum + row.original.age, 0) / filteredData.length

;<tfoot>
  <tr><td>平均年龄: {avgAge.toFixed(1)}</td></tr>
</tfoot>
```

#### 场景 3：混合模式（服务端做部分操作，客户端做部分）

```typescript
const table = useReactTable({
  data,
  columns,
  manualFiltering: true,   // 服务端负责筛选
  manualSorting: true,     // 服务端负责排序
  getPaginationRowModel: getPaginationRowModel(), // 客户端只做分页
  // 内部：Core → (跳过 Filtered) → (跳过 Sorted) → Paginated → Final
})
```

#### 场景 4：自定义排序算法

```typescript
function myChineseSortRowModel(rows) {
  // 按中文拼音排序
  return {
    rows: rows.sort((a, b) => a.original.name.localeCompare(b.original.name, 'zh-CN')),
    flatRows: rows,
    rowsById: Object.fromEntries(rows.map(r => [r.id, r])),
  }
}

const table = useReactTable({
  data, columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: myChineseSortRowModel, // 替换官方排序
  getPaginationRowModel: getPaginationRowModel(),
})
```

### 2.9 Pipeline 全景图

```
                    TanStack Table Row Models Pipeline
                    ==================================

你的原始数据 (data: T[])
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  getCoreRowModel                                           │
│  └→ 1:1 映射，为每条数据创建 Row 对象                      │
│     每个 Row 包含: id, original, subRows, getValue() 等    │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  getFilteredRowModel  (如果你启用了筛选)                    │
│  └→ 根据 columnFilters / globalFilter 过滤行               │
│  └→ 如果 manualFiltering=true，跳过此步 (透传)              │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  getGroupedRowModel  (如果你启用了分组)                     │
│  └→ 按 grouping state 分组，创建父子层级                     │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  getSortedRowModel  (如果你启用了排序)                      │
│  └→ 根据 sorting state 排序                                │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  getExpandedRowModel  (如果你启用了展开)                    │
│  └→ 根据 expanded state 展开/折叠子行                      │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  getPaginationRowModel  (如果你启用了分页)                  │
│  └→ 根据 pagination state 截取当前页                       │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  getRowModel  ← 最终结果，你用它渲染                       │
│  返回: { rows, flatRows, rowsById }                       │
└────────────────────────────────────────────────────────────┘
        │
        ▼
    <tbody> 渲染
```

### 2.10 Row Models vs 传统表格组件的架构对比

| 维度 | 传统表格（AntD/Element） | TanStack Table Row Models |
|------|------------------------|--------------------------|
| 数据处理 | 黑盒，不可见 | 白盒，6 步 pipeline 完全可见 |
| 可定制性 | 通过 callback 干预 | 可替换任意一个 row model |
| 中间状态 | 不可访问 | 每一步都可独立访问 |
| 代码体积 | 全部打包 | 仅 import 需要的 row model |
| 混合模式（部分客户端+部分服务端） | 不支持 | ✅ `manual*` 选项自由组合 |
| 自定义排序/筛选算法 | 通过 sorter/filter 函数 | 替换整个 row model |
| Debugging | 打 log 看最终结果 | 每步可 console.log 中间结果 |

### 2.11 一句话总结

> **Row Models 是 TanStack Table 的"数据处理操作系统"——它不是把数据硬塞进一个黑盒，而是把"筛选→分组→排序→展开→分页"这条流水线的每一个工位都开放给你。你可以查看任意工位的输出、替换任意工位的机器、关闭不需要的工位，甚至插入自己的工位。这就是 headless 哲学的终极体现——不仅 UI 是 headless 的，连数据处理逻辑都是模块化、可组合的。**

---

## 三、核心优缺点对比

### 对比总览表

| 维度 | TanStack Table | Ant Design Table | Element Plus Table | AG Grid |
|------|---------------|------------------|-------------------|---------|
| **架构** | Headless（无 UI） | 全栈组件 | 全栈组件 | 全栈组件 |
| **包体积 (gzip)** | ~15KB | ~80KB+ (含 antd) | ~70KB+ (含 element) | ~330KB+ (社区版) |
| **设计自由度** | ⭐⭐⭐⭐⭐ 完全自控 | ⭐⭐⭐ 受限于组件 | ⭐⭐⭐ 受限于组件 | ⭐⭐⭐ 受限于主题 |
| **开箱即用度** | ⭐⭐ 自建UI | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **首表交付时间** | 2~4 小时 | 15~30 分钟 | 15~30 分钟 | 1~2 小时 |
| **TypeScript** | ⭐⭐⭐⭐⭐ 原生强类型 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **虚拟滚动** | 需接入 `@tanstack/virtual` | ❌（v2 版有但 API 不同） | ❌（el-table-v2 API 两套） | ✅ 内置 |
| **多框架** | React/Vue/Svelte/Solid/Qwik | Vue only | Vue only | React/Vue/Angular |
| **树形数据** | 自研 | ✅ | ✅ | ✅ |
| **单元格合并** | 自研 | span-method | span-method | ✅ 内置 |
| **Excel 导出** | 自研 | 需插件 | 需插件 | ✅ 企业版 |
| **行/列拖拽** | 状态内置，UI 自研 | 需额外库 | 需额外库 | ✅ 内置 |
| **许可证** | MIT (免费) | MIT (免费) | MIT (免费) | MIT + 企业版付费 |

### Pros: TanStack Table 的优势

#### 1. 极致的 UI 控制权
你是表格的"主人"，不是"租客"。任何像素、任何交互、任何布局都能精确控制。这对以下场景至关重要：
- **品牌定制**：表格必须严格遵循设计系统
- **非常规布局**：卡片式表格、树状结构、混合布局
- **无障碍访问 (a11y)**：可精确控制 ARIA 属性、键盘导航

#### 2. 极小的包体积
~15KB gzipped —— 不到 AG Grid 的 5%，不到 MUI Data Grid 的 12%。

#### 3. 框架无关，跨栈复用
同一套核心可以用于 React、Vue、Svelte、Solid、Qwik。

#### 4. 生态自由组合
TanStack Table + shadcn/ui 是 2026 年最流行的 React 表格方案。

#### 5. TypeScript 类型推断最佳
从行数据类型到 accessor、cell renderer，完整类型贯穿始终。

#### 6. 逻辑与渲染干净分离
过滤、排序、分页的逻辑在 TanStack Table 内部；渲染在你的代码里。这使得**单元测试**更容易，**逻辑抽象**更清晰，**性能优化**更精准。

### Cons: TanStack Table 的劣势

#### 1. 建设成本高——"轻量≠轻松"
库本身轻量（15KB），但**重量转移到了你的代码里**：
- 需要自己实现 `<table>` 结构
- 需要自己写表头排序指示器
- 需要自己实现筛选下拉菜单
- 需要自己实现分页组件

> 真实数据：用 Element Plus Table 做普通后台表格 → **1 周交付**
> 用 TanStack Table 做同样需求 → **3 周才稳定**（样式+交互全自研）

#### 2. 虚拟滚动、单元格合并等高阶功能需自研
需要接入 `@tanstack/virtual`，自研 `colSpan`/`rowSpan` 合并逻辑等。

#### 3. 学习曲线更陡
需要理解 headless 理念，大量的 hooks 和状态管理 API。

#### 4. 团队一致性风险
不同开发者可能因各自实现方式不同导致 UI 不一致。

#### 5. 不适合简单场景
如果只需展示三五行静态数据，手写 `<table>` 更直接。

---

## 四、横向对比：与其他主要方案的对比

### vs. Ant Design Table / Element Plus Table

| 场景 | TanStack 好 | AntD/Element 好 |
|------|------------|----------------|
| 快速交付 CRUD 页面 | | ✅ 开箱即用，15 分钟搞定 |
| 高度定制 UI（复杂设计稿） | ✅ 完全控制 | 样式覆盖困难 |
| 大数据量（万行级） | ✅ 可集成 virtual | 卡顿或无虚拟滚动 |
| 团队接手/维护 | 需约定规范 | ✅ 写法统一 |
| 深度嵌套的复杂表格 | ✅ 灵活度高 | 受组件 API 限制 |

### vs. AG Grid

| 维度 | TanStack Table | AG Grid |
|------|---------------|---------|
| 定位 | 表格引擎 | 企业级网格 |
| 开箱功能 | 基础（排序、筛选、分页） | 100+ 功能（Excel 导出、图表、透视表） |
| 包体积 | 15KB | 330KB+ |
| 许可证 | MIT 免费 | 社区版免费，企业版 $999+/年 |
| 适用场景 | 产品化 UI | 电子表格级重度数据工作流 |

### vs. VXE Grid（Vue 生态企业级方案）

| 维度 | TanStack Table | VXE Grid |
|------|---------------|----------|
| 定位 | 通用 headless 引擎 | Vue 专属企业级表格引擎 |
| 虚拟滚动 | 需接入 virtual | ✅ 行+列虚拟滚动内置 |
| 单元格合并 | 自研 | ✅ 内置，边界情况最完善 |
| 树形+懒加载 | 自研 | ✅ 内置 |
| 工具栏/个性化列 | 自研 | ✅ 内置 toolbar |
| 包体积 | ~15KB（+你写的 UI） | ~100KB+（功能完整） |
| 适用场景 | 任意框架、高度定制 | Vue 项目、复杂企业报表 |

---

## 五、AI 时代：TanStack Table 的优势被显著放大

### 核心论点：AI 重写了 TanStack Table 的成本-收益等式

| 传统劣势 | AI 时代的实际影响 |
|---------|----------------|
| ❌ "需要自研全部 UI，首表交付 2~4 小时" | ✅ **AI 数秒生成完整表格 UI** |
| ❌ "团队约定不一致" | ✅ **AI 遵循统一 prompt 生成风格一致代码** |
| ❌ "学习曲线陡峭" | ✅ **AI 帮你写，你只需要审查和修改** |
| ❌ "高阶功能需自研" | ✅ **AI 辅助实现虚拟滚动、合并单元格等** |

AI 代码生成（Cursor、Claude、Copilot）恰好擅长的事 = TanStack Table 之前最痛的事。

### 三个关键放大效应

#### 1. AI 擅长写 UI 代码，不擅长记复杂 API

**TanStack Table 模式**（AI 友好）：
```
用户需求："排序表格，斑马纹，悬停高亮，分页"

AI 生成：直接输出 <table> + <thead> + <tbody> + Tailwind 类名
→ 不需要记住任何库的 API
→ 生成的内容是标准 HTML/JSX
→ 出错时肉眼可读、可直接改
```

**传统组件模式**（AI 需记住大量 API）：
```
用户需求：同上

AI 生成需要记住 Ant Design 的：
- columns[].sorter: boolean | function
- pagination={{ pageSize, showSizeChanger, showTotal }}
- rowClassName 的用法
- onChange 回调的参数签名
→ API 记错 → 生成不工作的代码
→ 出错时需理解库的内部机制才能调试
```

**本质上**：TanStack Table 把"重量"从 **API 知识** 转移到了 **UI 代码生成**——而后者正是 AI 最擅长的领域。

#### 2. TypeScript 强类型 = AI 的"安全带"

```typescript
const columns = [
  {
    accessorKey: 'price',
    cell: ({ getValue }) => formatCurrency(getValue<number>()),
    // ↑ AI 知道 getValue 返回 number
  }
]
```

- 类型约束减少了 AI 的幻觉
- 自动补全更精确
- 重构更安全

#### 3. AI 让"从零搭建"不再是门槛

**传统流程**（人工）：安装→读文档→手写全部→2~4 小时
**AI 时代**：一句话 prompt → AI 生成→微调→15~30 分钟

### TanStack 团队在主动拥抱 AI

- **TanStack Intent** — AI Skill 引导系统（PR #6273），为每个框架适配器添加 AI skill 指南
- **TanStack Code Mode** — 让 AI 直接写 TypeScript 程序来操作工具
- **TanStack AI Code Mode Skills** — 把工作代码保存为持久化 skill

### AI 时代各方案的变化趋势

| 方案 | AI 时代变化 | 相对优势变化 |
|------|-----------|------------|
| **TanStack Table** | 🔺 **优势放大**：AI 抵消了自研 UI 成本，类型系统减少幻觉，架构契合 AI 生成 | 📈 大幅上升 |
| **Ant Design / Element Plus Table** | ➡️ 优势仍在：快速原型依然快。但 AI 生成质量受限于 API 复杂度 | 📉 相对下降 |
| **AG Grid** | ➡️ 企业级功能仍是硬需求，但 AI 对 300+KB 包的代码生成质量有限 | 📉 相对下降 |
| **shadcn/ui Data Table** | 🔺 **最佳组合**：TanStack Table 逻辑 + shadcn UI 组件，AI 生成质量最高 | 📈 大幅上升 |

---

## 六、核心概念解读："LLMs are better at writing code to call APIs than at calling APIs directly"

> TanStack 博客核心洞察，也是 **Code Mode** 的设计哲学。

### 一句话版

> **让 AI 写代码来调用 API，而不是让 AI 直接调用 API，因为代码的表达力远高于 JSON 格式的函数调用。**

### 案例：多步 API 数据流

用户说：*"获取最近 30 天的订单数据，按金额排序，只返回前 10 条，然后计算平均金额"*

#### ❌ AI 调用预设工具

```json
// 调用 1
{ "tool": "fetchOrders", "args": { "days": 30 } }
// 等待返回...
// 调用 2
{ "tool": "sortOrders", "args": { "by": "amount", "order": "desc" } }
// 等待返回...
// 调用 3
{ "tool": "takeTopN", "args": { "n": 10 } }
// 等待返回...
// 调用 4
{ "tool": "calculateAverage", "args": { "field": "amount" } }
```

**问题**：4 轮 round-trip、无法表达 map/reduce/filter、中间出错全链断开。

#### ✅ AI 写代码

```typescript
async function processOrders() {
  const orders = await fetchOrders({ days: 30 })
  return orders
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map(order => ({
      id: order.id,
      customer: order.customerName,
      amount: `¥${order.amount.toFixed(2)}`,
    }))
}
```

**优势**：一次调用 + 一次返回、完整语言表达力、可测试、可复用。

### 为什么"写代码"比"调 API"更好？

| 维度 | AI 直接调用 API (Tool Use) | AI 写代码调用 API (Code Mode) |
|------|---------------------------|------------------------------|
| **表达力** | 有限的参数 schema | 完整编程语言（条件、循环、函数组合） |
| **组合性** | 顺序链条，无法嵌套/分支 | 任意组合：map + filter + reduce + 条件 |
| **状态管理** | 每次调用无状态 | 变量、闭包、React hooks |
| **错误处理** | 依赖平台重试逻辑 | try/catch + fallback + 重试 |
| **调试** | 看 log | 可执行、可断点、可测试 |
| **复用性** | 每次都是独立的 tool call | 可保存为函数/skill，下次直接 import |
| **复杂度上限** | 受工具数量限制 | **无上限**（图灵完备） |
| **Round-trip** | 每个操作一次往返 | 整个程序一次往返 |

### 直观比喻

> **Tool Calling（直接调 API）就像让 AI 按遥控器——按一次换一个台。**
> **Code Writing（写代码调 API）就像让 AI 录一段宏——把一系列操作一次性录好，以后一键执行。**

### 回到 TanStack Table

这就是为什么 TanStack Table 在 AI 时代更具优势：
- **Ant Design Table** = 你给 AI 一个遥控器（有限的 props），AI 按按钮
- **TanStack Table** = 你给 AI 一个画板 + 颜料（完整的表达力），AI 画画

TanStack 团队的完整表述：

> **"LLMs are better at writing code to call APIs than at calling APIs directly. Put your effort into making your tools writeable, not callable."**

TanStack Table 选择做"可被代码操控的表格引擎"，而不是"可被 JSON 配置的表格组件"。

---

## 七、降低不一致的 6 层递进策略

"写代码模式"的核心矛盾：**自由度高 → 不一致风险大**。以下是 6 层递进解决方案。

### 第 1 层：指令文件（CLAUDE.md / .cursorrules）

**零成本、最高杠杆的一步。** 告诉 AI 你的项目用什么模式。

```markdown
# CLAUDE.md

## TanStack Table 规范
- 始终使用 `createTableHook`（V9）或封装好的 `useAppTable`
- 列定义中禁止写内联样式，所有样式走 Tailwind className
- cell renderer 统一使用预定义的 cell 组件
- 不要在列定义中写业务逻辑——逻辑提取到独立的 utility 或 hook
```

### 第 2 层：抽象层 — `createTableHook`（V9原生方案）

这是 **TanStack Table V9 专门为解决一致性问题设计的 API**。

#### 定义一次（`hooks/table.ts`）

```typescript
export const {
  useAppTable,
  createAppColumnHelper,
} = createTableHook({
  features: tableFeatures({
    columnFilteringFeature,
    rowPaginationFeature,
    rowSortingFeature,
  }),
  rowModels: {
    sortedRowModel: createSortedRowModel(sortFns),
    filteredRowModel: createFilteredRowModel(filterFns),
    paginatedRowModel: createPaginatedRowModel(),
  },
  cellComponents: {
    TextCell, NumberCell, StatusCell, ActionCell, CurrencyCell,
  },
  headerComponents: {
    SortIndicator, ColumnFilter,
  },
  tableComponents: {
    PaginationControls, TableToolbar, EmptyState, LoadingOverlay,
  },
})
```

#### 业务代码只用 `useAppTable`

```typescript
const columnHelper = createAppColumnHelper<Order>()

const columns = [
  columnHelper.accessor('status', {
    header: '状态',
    cell: ({ cell }) => <cell.StatusCell />,  // 只能选预注册的组件
  }),
  // ...
]

const table = useAppTable({ columns, data })
```

**AI 生成这类代码时，自由度被约束在预定义组件集合内**——只能从 `TextCell | NumberCell | StatusCell | ActionCell` 中选择。

**类比**：这就像 React 用 JSX 约束 HTML 生成方式，而不是让你用 `document.createElement` 到处拼接。

### 第 3 层：Pattern Anchoring（模式锚定）

**给 AI 一个已有的、正确的例子，说"按这个模式写"。**

```markdown
## 模式锚定

下面是我们项目中一个已有的表格实现。新表格必须严格遵循这个模式：

@src/pages/Users/UsersTable.tsx

关键约束：
1. 列定义使用 `createAppColumnHelper`，不用 `createColumnHelper`
2. cell 渲染使用预注册的 cell 组件，不用内联 JSX
3. 分页使用 `<table.PaginationControls />`
```

### 第 4 层：Types First（类型先行）

```typescript
// 先定义领域类型
interface Order {
  id: string
  customerName: string
  status: 'pending' | 'shipped' | 'delivered'
  amount: number
}

type OrderColumn = ColumnDef<Order>
// AI 生成列定义时，accessorKey 会被类型约束
```

### 第 5 层：Prompt Templates（提示模板标准化）

把常见表格 prompt 写成可复用模板，团队共享。

```markdown
# .ai-prompts/tanstack-table-list-page.md

## 场景
生成一个列表页，包含表格、搜索、分页

## 必须遵循的模式
1. 从 `hooks/table.ts` 导入 `useAppTable` 和 `createAppColumnHelper`
2. 所有 cell 渲染使用预注册的 cell 组件
3. 分页使用 `<table.PaginationControls />`

## 反模式（禁止）
- ❌ 不使用 `createColumnHelper()`（必须用 `createAppColumnHelper()`）
- ❌ 不使用内联 `cell: () => <span>` 代替预注册组件
```

### 第 6 层：Testing + Review（测试锁定 + 人工审核）

```typescript
describe('UserTable columns', () => {
  it('status column should use StatusCell', () => {
    const statusCol = columns.find(c => c.accessorKey === 'status')
    expect(statusCol?.cell).toBeDefined()
  })
})
```

### 6 层策略的协同运作

```
┌─────────────────────────────────────────────────────┐
│  CLAUDE.md / .cursorrules                           │
│  → "始终用 createAppColumnHelper"                     │
├─────────────────────────────────────────────────────┤
│  createTableHook 抽象层                              │
│  → 预注册 cell 组件、默认启用排序/分页、统一分页组件      │
├─────────────────────────────────────────────────────┤
│  Prompt Template                                    │
│  → 项目级标准化 prompt，直接 @-引用                      │
├─────────────────────────────────────────────────────┤
│  AI 写代码                                           │
│  → 在上述约束下生成，自由度已经被大幅收窄                  │
├─────────────────────────────────────────────────────┤
│  测试                                               │
│  → 自动验证列定义结构、cell 组件使用                    │
├─────────────────────────────────────────────────────┤
│  人工 Review                                        │
│  → 最终关卡                                         │
└─────────────────────────────────────────────────────┘
```

### 两种模式的根本差异

| | 传统组件库（AntD/Element） | TanStack Table + AI |
|--|--------------------------|-------------------|
| **不一致来源** | 开发者写法差异 | AI 每次生成的代码风格不同 |
| **解决方案** | 组件 API 本身强制一致性 | `createTableHook` + 预注册组件 + 指令文件 |
| **约束力度** | ⭐⭐⭐⭐ 强（API 锁死） | ⭐⭐⭐⭐⭐ 更强（三重约束） |
| **灵活度保留** | ⭐⭐ 低 | ⭐⭐⭐⭐ 高 |
| **关键成功因素** | 库本身的设计 | **项目级基础设施建设** |

---

## 八、选型决策框架

### 基础决策树

```
┌─ 你是重度 AI 编码用户（Cursor/Copilot/Claude）？
│   ├─ ✅ 选 TanStack Table + shadcn/ui
│   └─ ❌ 很少用 AI → 回到传统选型逻辑（AntD / Element Plus）
│
├─ 项目会长期维护 3 年以上？
│   └─ ✅ TanStack Table（AI 辅助迁移 V8→V9→V10）
│
├─ PM 经常改 UI 设计？
│   └─ ✅ TanStack Table（AI 按最新设计稿快速重写 UI 层）
│
├─ 追求快速交付，团队 2~3 人？
│   ├─ Vue → Element Plus Table
│   ├─ React → shadcn/ui Data Table (基于 TanStack)
│   └─ 设计品质高 → Ant Design
│
├─ 表格是核心业务功能？
│   ├─ Excel 级复杂交互 → AG Grid / VXE Grid
│   ├─ 大数据量+复杂报表 → VXE Grid (Vue) / AG Grid
│   └─ 高度定制 UI → TanStack Table
│
└─ 团队有专职 UI 开发？
    └─ ✅ TanStack Table，让 UI 开发完全掌控设计
```

### 按团队画像推荐

| 团队情况 | 推荐方案 | 理由 |
|---------|---------|------|
| 前端 2~3 人，追求快速交付 | Element Plus / Ant Design Table | 开箱即用，1 周交付 |
| 前端 5+ 人，有专职 UI 工程师 | TanStack Table + 自研封装 | 完全定制，长期可维护 |
| 表格是核心业务 | VXE Grid (Vue) / AG Grid | 企业级能力最完整 |
| 设计品质要求高、大型项目 | Ant Design / Ant Design Vue | 完整设计体系，一致性最佳 |
| 追求性能、首屏加载敏感 | TanStack Table | 最小体积，按需组合 |
| MUI/Shadcn 生态项目 | TanStack Table + shadcn/ui | 生态最佳组合 |

### 常见演进路径

```
MVP 阶段：Ant Design / Element Plus Table → 快速交付
中期迭代：遇到定制瓶颈 → 局部引入 TanStack Table
成熟阶段：建设自研 UI 组件体系 → TanStack Table 全面接管
```

---

## 九、一句话总结

> **TanStack Table 不是"表格组件"，是"表格引擎"。选它意味着你选择了完全的掌控权，代价是你必须为自己的 UI 负责。**
>
> **在 AI 时代，TanStack Table 从"强力但昂贵"变成了"强力且廉价"。headless 架构 + AI 代码生成 = 当前前端表格开发的最优组合。**
>
> **AI 时代解决不一致的关键不是"限制 AI 的自由"，而是"给自由建立结构"。通过 createTableHook + 预注册组件 + 指令文件 + 模式锚定，把 AI 的"无限可能"收窄到"项目需要的有限集合"。**

---

## 参考资料

- [TanStack Table V9: Taking Form — TanStack Blog](https://tanstack.com/blog/tanstack-table-v9-taking-form)
- [TanStack Table V8 vs AG Grid vs MUI Data Grid 2026 — PkgPulse](https://www.pkgpulse.com/guides/tanstack-table-v8-vs-ag-grid-vs-mui-data-grid-2026)
- [TanStack Code Mode — TanStack Blog](https://tanstack.com/blog/tanstack-ai-code-mode)
- [TanStack Intent AI Skill Guidance (PR #6273)](https://github.com/TanStack/table/pull/6273)
- [Best React Table Libraries 2026 — PkgPulse](https://www.pkgpulse.com/guides/best-react-table-libraries-2026)
- Vue 中后台表格选型（Element/VXE/AntD） — 掘金
- [Best practices for Claude Code](https://code.claude.com/docs/en/best-practices)
- [Cursor Rules Documentation](https://cursor.com/docs/rules)
