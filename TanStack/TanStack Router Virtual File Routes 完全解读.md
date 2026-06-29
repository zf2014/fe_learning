# TanStack Router Virtual File Routes 完全解读

> 本文通过一个完整的 SaaS 平台案例，全面解读 TanStack Router 的 Virtual File Routes 概念、API、适用场景以及和文件系统路由的对比。

---

## 一、核心概念：它到底是什么？

TanStack Router 默认使用**文件系统路由（File-Based Routing）**——你放在 `src/routes/` 目录下的文件结构直接决定了 URL 结构。这是"约定优于配置"的做法。

**Virtual File Routes** 则提供了一条相反的路径：**你不用再受限于文件系统的物理结构，而是通过代码以编程方式声明路由树**。

> 本质上，它是一个**程序化路由树构建 API**，让你显式地声明"哪个文件对应哪个 URL 路径"，而不是让文件系统隐含地决定。

它来自 `@tanstack/virtual-file-routes` 这个独立包。

---

## 二、API 速览

安装：

```bash
npm install @tanstack/virtual-file-routes
```

提供 5 个核心函数：

| 函数 | 作用 | 示例 |
|---|---|---|
| `rootRoute(file, children?)` | 创建根路由节点 | `rootRoute('root.tsx', [...])` |
| `route(path, file, children?)` | 创建一个带路径的路由 | `route('/posts', 'posts.tsx', [...])` |
| `index(file)` | 创建当前路径的索引路由 | `index('home.tsx')` |
| `layout(file, children)` 或 `layout(id, file, children)` | 创建**无路径布局路由**（不改变 URL） | `layout('auth.tsx', [...])` |
| `physical(prefix, directory)` | 挂载一个文件系统路由子目录 | `physical('/posts', 'posts')` |

### 关键提醒

- **文件路径是相对于 `routesDirectory` 的**（默认 `./src/routes`），不要用绝对路径
- **`layout()` vs `route()`**：`layout()` 是 pathless 布局 wrapper，不添加 URL 段；`route()` 才会添加 URL 路径
- **虚拟路由中不要用 `createLazyFileRoute`**——插件会自动处理代码分割，手动使用会被静默替换

---

## 三、配置方式

### Vite 插件配置（推荐）

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      virtualRouteConfig: './routes.ts',  // 指向虚拟路由定义文件
    }),
    react(),
  ],
})
```

### CLI 配置（tsr.config.json）

```json
{
  "virtualRouteConfig": "./routes.ts"
}
```

---

## 四、案例：SaaS 平台「企服管家」

### 项目背景

一个中型 SaaS 平台的 Web 端，包含三个子应用（同一个 monorepo）：

```
enterprise-saas/
  packages/
    shared-ui/           # 共享 UI 组件库
    shared-routes/       # 共享路由组件（如认证页、支付页）
    web-app/             # 主应用：客户的 SaaS 后台
    admin-portal/        # 管理后台：内部员工使用
    marketing-site/      # 官网（独立部署，但共享部分路由）
```

---

### 第一阶段：文件系统路由（问题暴露）

团队一开始用标准的文件系统路由，目录结构是这样的：

```
packages/web-app/src/routes/
  __root.tsx
  index.tsx
  login.tsx
  register.tsx
  dashboard/
    index.tsx
    invoices/
      index.tsx
      $id.tsx
    settings/
      profile.tsx
      billing.tsx
    teams/
      $teamId/
        index.tsx
        members.tsx
        settings.tsx
  docs/
    index.tsx
    getting-started.tsx
    api-reference.tsx
  blog/
    index.tsx
    $slug.tsx
```

#### 暴露的问题

**问题 1：认证页路由文件散落各处**

`login.tsx` 和 `register.tsx` 直接躺在 `routes/` 根目录下。同时 `admin-portal` 也需要完全一样的登录注册页，但文件在 `web-app` 里，没法直接复用。只能复制粘贴。

**问题 2：布局嵌套受限于目录结构**

产品需求：`/dashboard/*` 下所有页面需要包裹侧边栏布局，`/dashboard/settings/*` 需要双层布局（侧边栏 + 设置二级导航），`/docs/*` 需要另一个文档布局。

在文件系统路由中要这样：

```
routes/
  __root.tsx                    # 根布局
  dashboard/
    _layout.tsx                 # Dashboard 侧边栏布局（pathless layout）
    index.tsx                   # /dashboard
    invoices/
      ...
    settings/
      _layout.tsx               # 设置二级导航布局
      profile.tsx               # /dashboard/settings/profile
      billing.tsx               # /dashboard/settings/billing
```

文件嵌套深度 = URL 嵌套深度。当布局层级越来越复杂时，目录结构变得混乱。看一眼 `routes/` 目录根本不知道哪些是布局文件、哪些是页面文件。

**问题 3：Monorepo 跨包共享完全做不到**

`admin-portal` 想复用 `web-app` 里的 `login.tsx` 和 `billing.tsx`。这在文件系统路由下只能靠 `npm link` 或符号链接这种 hack 方式。

**问题 4：渐进迁移不可能**

团队想把老的 React Router 页面逐步迁移到 TanStack Router。但在文件系统路由下，要么全部迁移（把几百个文件一次性搬进 `routes/`），要么不动。不存在"先迁一部分"的选项。

---

### 第二阶段：引入 Virtual File Routes（问题解决）

#### Step 1：定义共享路由包

```ts
// packages/shared-routes/src/index.ts
import { rootRoute, route, index, layout } from '@tanstack/virtual-file-routes'

// 关键点：文件的路径可以指向任何地方！
// 这里的路径指向 shared-routes 包内的实际文件
export const sharedRoutes = [
  // 共享的认证页（login/register 不再散落在各处）
  route('/login',   'auth/login.tsx'),
  route('/register', 'auth/register.tsx'),
  route('/forgot-password', 'auth/forgot-password.tsx'),
]
```

#### Step 2：主应用 `web-app` 的路由定义

```ts
// packages/web-app/routes.config.ts
import { rootRoute, route, index, layout, physical } from '@tanstack/virtual-file-routes'

// 可以引用共享包中的路由！
import { sharedRoutes } from '@saas/shared-routes'

export const routes = rootRoute('__root.tsx', [

  // 首页
  index('pages/home.tsx'),

  // 共享认证路由（文件实际在 shared-routes 包里）
  ...sharedRoutes,

  // 仪表盘区域 - 用 layout() 包裹侧边栏，URL 不增加路径段
  layout('layouts/dashboard-layout.tsx', [
    route('/dashboard', 'pages/dashboard/index.tsx'),
    route('/dashboard/invoices', 'pages/dashboard/invoices.tsx'),
    route('/dashboard/invoices/$id', 'pages/dashboard/invoice-detail.tsx'),

    // 设置区域 - 用 layout() 叠加二级导航
    layout('settings', 'layouts/settings-layout.tsx', [
      route('/dashboard/settings/profile', 'pages/dashboard/settings/profile.tsx'),
      route('/dashboard/settings/billing', 'pages/dashboard/settings/billing.tsx'),
      route('/dashboard/settings/team',    'pages/dashboard/settings/team.tsx'),
    ]),
  ]),

  // 文档区域 - 用不同布局
  layout('layouts/docs-layout.tsx', [
    route('/docs', 'pages/docs/index.tsx'),
    route('/docs/$slug', 'pages/docs/article.tsx'),
  ]),

  // 混合模式：博客仍然用文件系统路由
  // physical() 会扫描 posts/ 目录自动生成路由
  physical('/blog', 'posts'),
])
```

#### Step 3：管理后台 `admin-portal` 的路由定义

```ts
// packages/admin-portal/routes.config.ts
import { rootRoute, route, index, layout } from '@tanstack/virtual-file-routes'
import { sharedRoutes } from '@saas/shared-routes'

export const routes = rootRoute('__root.tsx', [
  // 直接复用主应用的共享路由！
  ...sharedRoutes,

  // 管理后台自己的页面
  route('/admin/users',    'pages/users.tsx'),
  route('/admin/analytics','pages/analytics.tsx'),
  route('/admin/logs',     'pages/logs.tsx'),
])
```

#### Step 4：主应用 `vite.config.ts`

```ts
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      // 指向虚拟路由定义文件
      virtualRouteConfig: './routes.config.ts',
    }),
    react(),
  ],
})
```

---

### 第三阶段：最终文件结构

重写之后，`packages/web-app/` 的实际文件结构变得非常**扁平**且**语义化**：

```
packages/web-app/src/
  routes.config.ts            ← 路由树的唯一真相来源（SSOT）
  __root.tsx
  layouts/
    dashboard-layout.tsx      ← 仪表盘侧边栏布局
    dashboard-with-tabs.tsx   ← 设置二级导航布局
    docs-layout.tsx           ← 文档布局
  pages/
    home.tsx
    dashboard/
      index.tsx
      invoices.tsx
      invoice-detail.tsx
      settings/
        profile.tsx
        billing.tsx
        team.tsx
    docs/
      index.tsx
      article.tsx
  posts/                      ← physical() 挂载，沿用文件系统路由
    index.tsx
    $slug.tsx
```

相比之前 20+ 个文件深埋 4 层目录，现在结构清晰了。路由的**逻辑结构**在 `routes.config.ts` 中显式声明，不再隐藏在目录命名约定中。

---

## 五、关键对比

| 需求 | 文件系统路由 | 虚拟路由 |
|---|---|---|
| **跨包共享 login.tsx** | ❌ 无法直接引用 | ✅ `...sharedRoutes` 导入即可 |
| **admin 复用认证页** | ❌ 复制粘贴两份 | ✅ 一行代码复用 |
| **扁平的源文件 + 深层嵌套 URL** | ❌ 目录必须嵌套 | ✅ `route('/a/b/c/d', 'flat-file.tsx')` |
| **调试看路由结构** | 需要脑补目录 + 命名约定 | ✅ `routes.config.ts` 一目了然 |
| **新加一个页面** | 创建文件（自动注册） | 创建文件 + 加一行 route() |
| **渐进迁移旧路由** | ❌ 得一次性搬家 | ✅ 先 `route('/old/path', 'old-file.tsx')`，再慢慢搬 |
| **多团队协作** | 容易冲突（大家都改 routes/） | ✅ 各团队维护自己的虚拟路由片段 |
| **条件路由（特性分支）** | ❌ 需要文件系统 hack | ✅ `if (featureFlag) routes.push(...)` |

---

## 六、布局嵌套对比

一张图说清文件系统路由 vs 虚拟路由的本质区别：

```
文件系统路由：     虚拟路由：
  src/routes/        routes.config.ts (唯一真相)
    ├─ dashboard/        rootRoute('__root.tsx', [
    │  ├─ invoices/        route('/dashboard/invoices', ...)
    │  │  └─ $id.tsx       route('/dashboard/invoices/$id', ...)
    │  └─ settings/        layout('settings-layout', [
    │     ├─ profile.tsx      route('/dashboard/settings/profile', ...)
    │     └─ billing.tsx      route('/dashboard/settings/billing', ...)
    └─ ...                   ])
                          ])

约定隐含结构                   显式声明结构
文件即路由                      代码即路由
被目录结构绑架                   目录结构由你决定
```

---

## 七、混合模式详解

TanStack Router 支持两种虚拟 + 物理的混合方式：

### 方式 1：Virtual-Inside-File-Based（文件系统内嵌入虚拟路由）

在某个物理目录下放一个 `__virtual.ts` 文件，该目录的路由定义就由这个文件接管：

```ts
// src/routes/posts/__virtual.ts
import { defineVirtualSubtreeConfig } from '@tanstack/virtual-file-routes'

export default defineVirtualSubtreeConfig({
  routes: [
    // 这里定义 posts 目录下的路由树
  ],
})
```

### 方式 2：Physical-Inside-Virtual（虚拟路由内嵌入文件系统目录）

用 `physical()` 函数在虚拟路由树中挂载一个文件系统目录：

```ts
rootRoute('root.tsx', [
  // 顶层用虚拟路由精确控制
  layout('app-layout.tsx', [
    // 但 /docs 下的内容用文件系统约定
    physical('/docs', 'docs'),
  ]),
])
```

另外，`physical()` 在最近的版本中（PR #7196）支持了**外部目录挂载**：

```ts
import path from 'node:path'
import { physical, rootRoute } from '@tanstack/virtual-file-routes'

export default rootRoute('__root.tsx', [
  // 挂载其他包中的路由目录
  physical('/', path.resolve(__dirname, '../../../ui/src/routes')),
  physical('/api', 'api'),
])
```

这对于 monorepo 中一个包拥有所有路由定义、另一个包继承使用的场景尤其有用。

---

## 八、更极致的案例：CMS 驱动路由

虚拟路由最强大的能力之一是——**它可以是动态的**：

```ts
// routes.config.ts
import { rootRoute, route } from '@tanstack/virtual-file-routes'
import { cmsService } from '@internal/cms'

// 从 CMS 获取页面配置，构建时生成路由
const cmsPages = await cmsService.fetchPages()

export const routes = rootRoute('__root.tsx', [
  // 来自 CMS 的动态页面
  ...cmsPages.map(page => route(page.path, `cms-pages/${page.template}.tsx`)),

  // 硬编码的系统路由
  route('/settings', 'settings.tsx'),
])
```

这在纯文件系统路由下**完全不可能**做到。

---

## 九、什么时候该用它？

**遇到以下任何一个信号就该考虑使用虚拟路由：**

1. **Monorepo** 中多个包要共享路由文件 → 虚拟路由是唯一解
2. **渐进迁移** 旧项目 → 虚拟路由让你按路线图逐块迁移
3. **路由结构复杂**（多层布局、条件路由） → 代码比目录更容易理解和维护
4. **团队规模大** → 分布式定义路由、减少冲突
5. **动态路由** → CMS / 配置驱动 → 虚拟路由是唯一可能的方式

**什么时候不该用？** 单人小项目、路由简单、不需要共享——文件系统路由的零配置开发体验更香。

---

## 十、注意事项

1. **文件路径是相对于 `routesDirectory` 的**——这是最常见的错误来源。不要用绝对路径或相对于项目根的路径。
2. **`layout()` 和 `route()` 的区别**——`layout()` 是 pathless layout，不添加 URL 段；`route()` 才会添加。把 `layout` 想象成一个透明的容器 wrapper。
3. **虚拟路由中不要用 `createLazyFileRoute`**——虚拟路由会自动处理代码分割，使用 `autoCodeSplitting: true` 即可。
4. **`physical()` 的目录必须存在**——它引用的目录必须在 `routesDirectory` 内，且遵循文件系统路由约定。

---

*参考资料：*

- [TanStack Router 官方文档 - Virtual File Routes](https://tanstack.com/router/latest/docs/routing/virtual-file-routes)
- [@tanstack/virtual-file-routes 包 Skill 文档](https://github.com/TanStack/router/blob/main/packages/virtual-file-routes/skills/virtual-file-routes/SKILL.md)
- [DeepWiki - Virtual File Routes](https://deepwiki.com/TanStack/router/4.2-virtual-file-routes)
- [PR #7196 - external directories in physical() virtual route mounts](https://github.com/TanStack/router/pull/7196)
