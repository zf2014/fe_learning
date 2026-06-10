# Vue 工程化全景图

## 前言

Vue 工程化是拉开初中级和高级前端差距的核心能力。这份文档提供系统性的全景图和进阶路径。

---

## 全景图

```
┌─────────────────────────────────────────────────────┐
│                   Vue 工程化金字塔                      │
│                                                       │
│                    ┌─────┐                            │
│                    │ L5  │  架构层                      │
│                  ┌─┴─────┴─┐  微前端 / Monorepo       │
│                  │   L4    │  / 设计系统               │
│                ┌─┴─────────┴─┐                        │
│                │     L3      │  工程基础设施层          │
│              ┌─┴─────────────┴─┐  CI/CD / 测试        │
│              │       L2        │  / 性能监控           │
│          ┌───┴─────────────────┴───┐                  │
│          │          L1             │  规范化层         │
│          │  TS / 代码规范 / Git     │  / 组件设计       │
│      ┌───┴─────────────────────────┴───┐              │
│      │             L0                  │  基础层       │
│      │  Vite / 项目架构 / 依赖管理      │              │
│      └─────────────────────────────────┘              │
└─────────────────────────────────────────────────────┘
```

---

## L0 — 基础层：项目架构与构建

### 1. 项目结构标准化

**常见但不好的结构**：
```
❌
src/
├── components/     # 所有组件扔一起
├── views/          # 所有页面扔一起
├── api/            # 所有接口扔一起
├── utils/          # 所有工具扔一起
└── store/          # 所有状态扔一起
```

**推荐结构**（领域驱动）：
```
✅
src/
├── app/                    # 应用壳
│   ├── router/             # 路由配置
│   ├── stores/             # 全局状态 (theme, auth)
│   └── providers/          # 全局 Provider
│
├── domains/                # 按业务领域组织 ⭐
│   ├── user/
│   │   ├── components/     # 领域组件
│   │   ├── composables/    # 领域逻辑
│   │   ├── api/            # 领域接口
│   │   ├── stores/         # 领域状态
│   │   └── types/          # 领域类型
│   ├── order/
│   └── product/
│
├── shared/                 # 跨领域共享
│   ├── components/         # 通用 UI 组件
│   ├── composables/        # 通用 hooks
│   ├── utils/              # 纯工具函数
│   └── types/              # 全局类型
│
├── layouts/                # 布局组件
└── styles/                 # 全局样式 / Tokens
```

### 2. Vite 深度掌握

| 能力 | 具体内容 | 掌握程度建议 |
|------|---------|------------|
| 配置优化 | `build.rollupOptions`、`resolve.alias`、`css.modules` | 必须掌握 |
| 插件机制 | 编写自定义 Vite 插件（虚拟模块、Transform） | 高级必备 |
| 构建分析 | `rollup-plugin-visualizer` 分析包体积 | 必须掌握 |
| 环境变量 | `.env` 策略、`import.meta.env` 类型安全 | 必须掌握 |
| SSR 配置 | `vite-plugin-ssr` / 手动 SSR 配置 | 了解即可 |
| Module Federation | Vite 联邦模块（微前端） | 高级可选 |

### 3. 包管理策略

```
推荐技术栈：pnpm + workspace

why pnpm?
├── 硬链接节省磁盘空间（比 npm 节省 30-50%）
├── 严格的依赖隔离（杜绝幽灵依赖）
├── workspace 天然支持 Monorepo
└── 速度比 npm 快 2-3 倍
```

---

## L1 — 规范化层：代码质量

### 1. TypeScript 从"能用"到"好用"

**初级的做法**：
```typescript
// ❌ 到处 any
const user: any = await getUser()
```

**中级的做法**：
```typescript
// ✅ 明确类型
interface User {
  id: string
  name: string
  role: 'admin' | 'user'
}
const user: User = await getUser()
```

**高级的做法**：
```typescript
// ✅ 类型安全的 API 层
// 用泛型封装请求，自动推导返回类型
function useApi<T>(url: string, options?: RequestOptions) {
  return { data: ref<T>(), loading, error, execute }
}

// 使用时自动推导类型，零手写类型
const { data: users } = useApi<User[]>('/api/users')
//    ^? 自动推导为 Ref<User[]>
```

**关键进阶点**：

| 能力 | 说明 | 学习优先级 |
|------|------|----------|
| 泛型约束 | `<T extends Entity>` | ⭐⭐⭐⭐⭐ |
| 条件类型 | `T extends U ? X : Y` | ⭐⭐⭐⭐ |
| 模板字面量类型 | `` `${Area}-${Action}` `` | ⭐⭐⭐ |
| 类型守卫 | `is` / `asserts` | ⭐⭐⭐⭐ |
| 声明文件 | `.d.ts` 编写与发布 | ⭐⭐⭐ |
| 体操（映射/递归） | `Partial`、`Pick` 等底层原理 | ⭐⭐ |

### 2. 代码规范体系

```
ESLint (代码质量)
├── @vue/eslint-config-typescript
├── eslint-plugin-vue (Vue 特定规则)
└── 自定义规则（团队规范）

Prettier (代码格式)
└── 统一风格，减少 code review 争议

Commitlint (提交规范)
├── @commitlint/config-conventional
└── 强制 feat/fix/docs/refactor 前缀

lint-staged + husky
└── 只检查暂存区文件，提速 + 强制
```

### 3. 组件设计模式

**Props 爆炸的例子**：
```vue
<!-- ❌ 初级：Props 爆炸 -->
<UserCard
  :name="user.name"
  :email="user.email"
  :avatar="user.avatar"
  :role="user.role"
  :department="user.department"
  :is-active="user.isActive"
  :on-edit="handleEdit"
  :on-delete="handleDelete"
  :on-toggle-status="handleToggle"
/>
```

**合理的组件设计**：
```vue
<!-- ✅ 高级：合理设计 Props 边界 -->
<UserCard
  :user="user"
  @action="handleUserAction"
>
  <template #actions>
    <EditButton @click="handleEdit" />
    <DeleteButton @click="handleDelete" />
  </template>
</UserCard>
```

**必须掌握的组件设计原则**：

| 原则 | 说明 | 示例 |
|------|------|------|
| 单一职责 | 一个组件只做一件事 | `UserAvatar` vs `UserCard` |
| Props Down / Events Up | 数据流清晰可追踪 | 避免双向绑定滥用 |
| 组合优于配置 | 用插槽和组合提供灵活度 | Headless 组件模式 |
| 受控 vs 非受控 | 明确状态所有权 | `v-model` vs 内部状态 |
| 边界组件 | 智能组件 vs 展示组件分离 | Page 组件获取数据，展示组件纯渲染 |

---

## L2 — 工程基础设施层

### 1. 测试策略

```
测试金字塔（Vue 项目推荐）

         ┌──────────┐
         │   E2E    │  Playwright
         │  (少量)   │  关键流程覆盖
        ┌┴──────────┴┐
        │  集成测试    │  Vitest + Vue Test Utils
        │  (适量)     │  组件交互、Composable 逻辑
       ┌┴────────────┴┐
       │   单元测试     │  Vitest
       │  (大量)       │  utils、stores、API 层
      └────────────────┘
```

**Vue 项目的测试重点排序**：

| 优先级 | 测试目标 | 工具 | 原因 |
|-------|---------|------|------|
| 1 | Composables | Vitest | 业务逻辑核心，纯函数易测试 |
| 2 | Store (Pinia) | Vitest | 状态逻辑，影响全局 |
| 3 | 表单/交互组件 | VTU + Vitest | 用户直接接触的界面 |
| 4 | API 层 | MSW + Vitest | 数据流正确性 |
| 5 | 关键路径 E2E | Playwright | 整体流程保障 |

### 2. CI/CD 流水线

```yaml
# .github/workflows/ci.yml 典型配置
name: CI
on: [push, PR]

jobs:
  quality:
    steps:
      - lint + type-check + unit-test    # 并行
      - build-check                       # 确保构建不出错
      - bundle-size-check                 # 包体积管控

  e2e:
    steps:
      - playwright-test                   # 关键流程

  deploy:
    needs: [quality, e2e]
    steps:
      - build + deploy                    # 自动部署
```

### 3. 性能监控

```
构建时
├── rollup-plugin-visualizer  → 包体积分析
├── vite-plugin-compression   → Gzip/Brotli 预压缩
└── lighthouse CI             → CI 中跑性能审计

运行时
├── Web Vitals                → LCP / INP / CLS 收集
├── Sentry / 自建             → 错误监控
└── 自定义埋点                → 业务性能指标
```

---

## L3-L4 — 高级：Monorepo 与设计系统

### Monorepo（当你需要管理多个包时）

```
推荐方案：pnpm workspace + Turborepo

packages/
├── ui/           # 组件库
├── shared/       # 共享工具
├── admin-app/    # 管理后台
├── mobile-app/   # 移动端
└── docs/         # 文档站

为什么用 Monorepo？
├── 代码复用：一套组件库，多个应用使用
├── 统一发布：版本管理更简单
├── 原子提交：跨包修改一次 PR 搞定
└── 类型共享：跨包类型安全
```

### 设计系统 / 组件库

```
组件库架构（企业级）

Design Tokens (基础)
├── colors / spacing / typography / shadows
│
Base Components (原子)
├── Button / Input / Select / Modal
│
Composite Components (分子)
├── Form / Table / DatePicker
│
Business Components (有机体)
├── UserSelector / SearchTable / PermissionGuard
│
Templates (模板)
├── CrudPage / FormDialog / DetailDrawer
```

---

## 推荐学习路径（分阶段）

### 第一阶段：夯实基础（4-6 周）

> 目标：建立工程化意识，掌握核心工具

| 周次 | 重点 | 产出 |
|------|------|------|
| 1-2 | Vite 深入 + TypeScript 泛型 | 能写自定义 Vite 插件，TS 不再依赖 `any` |
| 3-4 | ESLint/Prettier 配置 + 组件设计模式 | 搭建团队级规范配置，重构一个组件 |
| 5-6 | Vitest 单元测试 + Composable 测试 | 核心业务代码测试覆盖率达到 60%+ |

**推荐资源**：
- [Vite 官方文档](https://vitejs.dev) — 插件 API 章节
- [TypeScript Challenges](https://type-challenges.netlify.app/) — 类型体操练习
- [Vue.js 设计与实现](https://book.douban.com/subject/35868345/) — 理解 Vue 底层

### 第二阶段：工程能力（4-6 周）

> 目标：建立完整的工程基础设施

| 周次 | 重点 | 产出 |
|------|------|------|
| 1-2 | CI/CD 流水线搭建 | GitHub Actions 完整流水线 |
| 3-4 | 性能优化实战 | Lighthouse 评分 90+ |
| 5-6 | E2E 测试 + 监控接入 | 关键路径 E2E 覆盖 |

**推荐资源**：
- [Google Web Vitals](https://web.dev/vitals/) — 性能指标体系
- [Playwright 官方文档](https://playwright.dev) — E2E 测试

### 第三阶段：架构能力（持续）

> 目标：能做技术选型和架构设计

| 方向 | 学习内容 | 适合场景 |
|------|---------|---------|
| Monorepo | pnpm workspace + Turborepo | 多应用/多包管理 |
| 微前端 | qiankun / Module Federation | 巨型应用拆分 |
| 组件库 | Storybook + 自动化发布 | 团队 UI 规范统一 |
| SSR | Nuxt 3 深入 | SEO / 首屏性能要求高 |

---

## AI 时代的特别建议

| 传统做法 | AI 增强做法 | 你的价值 |
|---------|-----------|---------|
| 手写 ESLint 规则 | AI 生成 + 你审核 | 理解规则原理，评估适用性 |
| 手动优化 Webpack/Vite | AI 建议 + 你决策 | 理解构建原理，判断建议正确性 |
| 手写测试用例 | AI 生成骨架 + 你补充边界 | 设计测试策略，确保覆盖关键路径 |
| 手写组件库文档 | AI 生成 + 你校准 | 设计 API，确保易用性 |
| 手动 Code Review | AI 初筛 + 你终审 | 把控架构方向，确保设计一致性 |

**核心洞察**：

> **AI 时代，"能写出来"不再是竞争力。"能设计好、能判断对、能把控住"才是。**
>
> 工程化能力 = 设计能力 + 判断能力 + 把控能力。这三样 AI 短期内替代不了。

---

## 一个实操建议

如果你想立刻开始行动，建议按以下节奏：

1. **本周**：选你手上的一个项目，用上面的领域驱动结构重构 `src/` 目录
2. **下周**：给项目加上 TypeScript 严格模式（`strict: true`），逐个修复报错
3. **第三周**：给核心 Composable 补上单元测试
4. **第四周**：搭一套 CI 流水线

**一个月后，你的项目质量和你的能力都会有质的飞跃。**

---

## 总结

> **AI 改变了学习的 ROI 计算：广度的边际收益在降低，深度的价值在上升。**
>
> - 你不需要成为 React 专家
> - 但你需要成为 **"能用 AI + React 完成任务"** 的人
> - 把 70% 的精力放在 Vue 深度 + 工程化上
> - 把 30% 的精力放在 React 理解 + AI 协作上

---

*文档生成时间：2026-06-02*