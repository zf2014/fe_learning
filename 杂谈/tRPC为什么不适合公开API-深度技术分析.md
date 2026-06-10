# tRPC 为什么不适合公开 API — 深度技术分析

> 文档生成时间：2026-05-08
> 基于 tRPC v11 官方文档、源码分析、GitHub Discussion 及社区最佳实践

---

## 〇、什么是 tRPC？

### 核心定义

**tRPC**（TypeScript Remote Procedure Call）是一个端到端类型安全的 TypeScript RPC 框架。它的核心理念是：

> 不需要写 API 文档、不需要代码生成、不需要 Schema 定义语言（如 GraphQL SDL），仅靠 TypeScript 的类型推断就能实现前后端完全类型安全的 API 调用。

一句话总结：**tRPC 让你写全栈 TypeScript 应用时，后端定义一个函数，前端直接调用它，全程类型安全。**

### 核心卖点

- 前后端共享 TypeScript 类型，自动补全 + 编译时类型检查
- 零代码生成，零额外 Schema 文件
- 底层基于 HTTP，但你可以像调用本地函数一样调用后端 API
- 深度集成 TanStack Query（React Query），自带缓存、重试、乐观更新等能力

### 核心概念

#### 1. Router（路由器）

后端 API 的组织单元，可以嵌套合并：

```typescript
// server/trpc.ts
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  user: t.router({
    getById: t.procedure
      .input(z.object({ id: z.string() }))
      .query(({ input }) => {
        return { id: input.id, name: 'John' };
      }),
    create: t.procedure
      .input(z.object({ name: z.string() }))
      .mutation(({ input }) => {
        return { id: '1', name: input.name };
      }),
  }),
  post: t.router({
    list: t.procedure.query(() => []),
  }),
});

// 导出类型给前端用 — 这是唯一需要前后端共享的东西
export type AppRouter = typeof appRouter;
```

#### 2. Procedure（过程）

三种类型，对应三种语义：

| 类型 | 用途 | HTTP 映射 |
|------|------|-----------|
| `.query()` | 读取数据 | GET |
| `.mutation()` | 修改数据 | POST |
| `.subscription()` | 实时数据流 | WebSocket/SSE |

#### 3. Input Validation（输入校验）

使用 Zod 做 schema 校验，类型自动推断：

```typescript
const hello = t.procedure
  .input(z.object({ name: z.string(), age: z.number().optional() }))
  .query(({ input }) => {
    // input 的类型自动推断为 { name: string; age?: number }
    return `Hello ${input.name}`;
  });
```

#### 4. Middleware（中间件）

用于鉴权、日志等横切关注点：

```typescript
const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});
```

### 前端如何使用

#### Step 1：安装依赖

```bash
pnpm add @trpc/client @trpc/react-query @tanstack/react-query @trpc/server zod
```

#### Step 2：创建 tRPC React 客户端

```typescript
// utils/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../server'; // 仅导入类型！

export const trpc = createTRPCReact<AppRouter>();
```

#### Step 3：创建 Provider

```tsx
// providers/TRPCProvider.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink } from '@trpc/client';
import { useState } from 'react';
import { trpc } from '../utils/trpc';
import { makeQueryClient } from './query-client';
import type { AppRouter } from '../server';

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const queryClient = makeQueryClient();

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: '/api/trpc',
          // transformer: superjson, // 如果用了自定义 transformer
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
```

#### Step 4：在组件中使用 — 像调用本地函数一样

```tsx
import { trpc } from '../utils/trpc';

function UserProfile({ userId }: { userId: string }) {
  // 全自动类型推断！input/output 都有完整类型提示
  const { data, isLoading, error } = trpc.user.getById.useQuery({ id: userId });

  const createMutation = trpc.user.create.useMutation({
    onSuccess: () => {
      // 自动刷新相关查询
      trpc.useUtils().user.getById.invalidate({ id: userId });
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{data.name}</h1>
      <button
        onClick={() => createMutation.mutate({ name: 'New User' })}
        disabled={createMutation.isPending}
      >
        创建用户
      </button>
    </div>
  );
}
```

注意看 `trpc.user.getById.useQuery(...)` 这个调用链：
- `user` → 路由名
- `getById` → 过程名
- `.useQuery()` → TanStack Query 的 hook

**全程有 TypeScript 自动补全**，拼写错误直接编译报错。

### 技术选型对比

| 特性 | tRPC | REST | GraphQL |
|------|------|------|---------|
| 类型安全 | ✅ 自动全链路 | ❌ 需手动/OpenAPI | ✅ 需代码生成 |
| 学习成本 | 中（需懂 TS） | 低 | 高 |
| 适合公开 API | ❌ | ✅ | ✅ |
| 开发效率 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| 生态/框架绑定 | TypeScript + React/Vue/Svelte | 无 | 无 |
| Bundle 大小 | 小 | 小 | 较大 |

**选型建议：** 如果你是全栈 TypeScript 项目且不需要公开 API → tRPC 是目前最高效的选择。

---

## 一、官方态度

tRPC 作者 **Alex "Katt" Johansson** 在官方文档中写得非常明确（这段话从 v9 到 v11 完全没变过）：

> *"tRPC is for full-stack typescripters. It makes it dead easy to write "endpoints", which you can safely use in your app. It's designed for monorepos, as you need to export/import the type definitions from/to your server."*
>
> ***"If you already work in a team where languages are mixed or have third-party consumers over whom you have no control, you should create a language-agnostic GraphQL-API."***

**来源：** https://trpc.io/docs/further-reading（v9/v10/v11 三个版本中完全一致）

---

## 二、七大技术原因

### 原因 1：私有的线路协议（Wire Protocol）

tRPC 不是标准 HTTP/REST 协议，而是一套**自定义的 RPC-over-HTTP 协议**。

#### 单个请求

```
GET /api/trpc/user.getById?input=%22abc123%22
```

- 过程名直接拼在 URL 路径里
- 输入参数是 `JSON.stringify()` 后 `encodeURIComponent()` 的结果
- 你无法从 URL 看出这是 query 还是 mutation（信息只在 TypeScript 类型里）

#### 批量请求（默认行为，httpBatchLink）

```
GET /api/trpc/user.getById,post.list,comment.all?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%221%22%7D%2C%221%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%7D%7D%2C%222%22%3A%7B%22json%22%3A%7B%22chatId%22%3A%221%22%7D%7D%7D
```

解码后的 input：

```json
{
  "0": { "json": "1" },
  "1": { "json": null, "meta": { "values": ["undefined"] } },
  "2": { "json": { "chatId": "1" } }
}
```

**为什么第三方消费者无法使用：**

- 多个过程名用**逗号拼接**在 URL 路径中 — 标准工具不认识
- 输入参数用**数字索引**（`0`、`1`、`2`）按位置对应 — 需要逆向工程
- `batch=1` 是 tRPC 私有约定
- 批量部分失败时返回 `207 Multi-Status` — 标准客户端不会自动处理

**对比 REST：** `GET /api/users/123` — 任何语言、任何 HTTP 客户端、任何 API 网关都能理解。

**源码证据：**

```typescript
// packages/client/src/links/httpBatchLink.ts (Line ~50-53)
const path = batchOps.map((op) => op.path).join(',');
const inputs = batchOps.map((op) => op.input);
```

```typescript
// packages/client/src/links/internals/httpUtils.ts
const METHOD = {
  query: 'GET',
  mutation: 'POST',
  subscription: 'PATCH',
} as const;
```

---

### 原因 2：SuperJSON 序列化 — 非标准数据格式

这是最隐蔽的耦合点。tRPC 通常搭配 [superjson](https://github.com/flightcontrolhq/superjson) 作为数据转换器，**前后端必须配置完全相同的 transformer**。

#### 标准 JSON vs SuperJSON

```json
// 标准 JSON（Date 丢失类型信息）
{ "createdAt": "2024-01-15T10:30:00.000Z" }

// SuperJSON 格式（保留了 Date 类型信息）
{
  "json": { "createdAt": "2024-01-15T10:30:00.000Z" },
  "meta": { "values": { "createdAt": ["Date"] } }
}
```

SuperJSON 的 `{ json, meta }` 信封是 **npm 包 `superjson` 的私有格式**，没有规范文档，没有其他语言的实现。

**影响：**
- Python/Go/Java 客户端收到的是 superjson 格式的数据
- 它们需要重新实现 superjson 的反序列化逻辑
- 这相当于让第三方适配你的内部序列化细节

**来源：** https://trpc.io/docs/data-transformers — "The transformers need to be added both to the server and the client."

---

### 原因 3：类型共享是强依赖 — 前后端二进制耦合

| 协议 | 契约格式 | 语言无关 |
|------|---------|---------|
| REST | OpenAPI 规范（JSON/YAML） | ✅ |
| GraphQL | SDL Schema（`.graphql` 文件） | ✅ |
| gRPC | Protocol Buffers（`.proto` 文件） | ✅ |
| **tRPC** | **TypeScript 源代码** | **❌** |

```typescript
// 前端必须导入后端的类型
import type { AppRouter } from '../server';
export const trpc = createTRPCReact<AppRouter>();
```

没有 schema 提取步骤。tRPC 完全依赖 TypeScript 的类型推断 — 返回类型是从实现代码推断出来的，没有显式 schema。

**公开 API 场景下的灾难：**
- 第三方无法发现有哪些过程可用（没有 GraphQL introspection 的等价物）
- 第三方不知道输入输出格式（没有 OpenAPI 文档）
- API 变了？没有变更日志、没有 deprecation 警告 — 直接运行时报错

---

### 原因 4：零版本管理能力

这是公开 API **最致命**的问题。tRPC **没有任何内置的版本管理原语**。

搜索整个 tRPC 源码库，不存在：
- 版本化路由器（versionedRouter）
- 过程级 deprecation 注解
- 同时服务多个 API 版本的机制
- 任何形式的后向兼容保证

#### 实际会发生什么

```typescript
// v1: 你的路由
appRouter = router({
  user: router({
    getById: procedure.input(z.object({ id: z.string() })).query(...)
  })
});

// v2: 你把 getById 改名为 get
appRouter = router({
  user: router({
    get: procedure.input(z.object({ id: z.string() })).query(...)
  })
});
```

→ **所有还在调 `trpc.user.getById` 的客户端立即崩溃。** 没有迁移期，没有 deprecation 警告，没有回退路径。

#### 版本管理对比

| 能力 | REST | GraphQL | tRPC |
|------|------|---------|------|
| 同时服务多个版本 | ✅ `/v1/` `/v2/` URL 路径 | ✅ Schema 演进 | ❌ 无机制 |
| 字段废弃通知 | ✅ `Deprecation` + `Sunset` 请求头 | ✅ `@deprecated` 指令 | ❌ 无 |
| 非破坏性变更 | ✅ 添加可选字段不影响旧客户端 | ✅ 新字段不破坏旧查询 | ❌ 改返回类型=编译错误 |
| 版本路由（网关层） | ✅ nginx 按 `/v1/` `/v2/` 分流 | N/A | ❌ URL 无标准结构 |
| 优雅迁移期 | ✅ 6-12 个月 sunset 周期 | ✅ deprecation 周期 | ❌ 即时崩溃 |

**现实影响：** 你的公开 API 有一个手机 App 用户 6 个月没更新 — 当你改了任何过程名或参数，那个用户的 App 就会直接报错崩溃。

---

### 原因 5：HTTP 缓存基础设施完全失效

REST API 天然受益于整个 HTTP 缓存体系：

```
GET /api/users/123
Cache-Control: max-age=3600
ETag: "abc123"
```

tRPC 的批量请求 URL 是动态的、不可预测的：

```
/api/trpc/user.getById,post.list?batch=1&input={"0":{"json":"123"},"1":{"json":null}}
```

- URL 每次组合不同 → CDN 无法缓存
- 没有标准 `Cache-Control` 策略
- 批量响应是混合的数组 → 无法按资源粒度缓存

---

### 原因 6：没有自描述能力

公开 API 的核心要求之一是**可发现性**：

| 协议 | 自描述机制 | 第三方体验 |
|------|-----------|-----------|
| REST | `GET /openapi.json` → Swagger UI | 浏览器打开就能看文档 |
| GraphQL | Introspection query → GraphiQL | 实时查询 schema，自动补全 |
| gRPC | Server Reflection + `.proto` | grpcurl 直接探测服务 |
| **tRPC** | **无** | **只能猜** |

---

### 原因 7：错误码是私有的

tRPC 的错误码不是标准 HTTP 状态码，而是映射到了 JSON-RPC 2.0 的 `-32xxx` 范围：

| tRPC 错误码 | JSON-RPC Code | HTTP Status |
|-------------|---------------|-------------|
| `PARSE_ERROR` | -32700 | 400 |
| `BAD_REQUEST` | -32600 | 400 |
| `INTERNAL_SERVER_ERROR` | -32603 | 500 |
| `UNAUTHORIZED` | -32001 | 401 |
| `FORBIDDEN` | -32003 | 403 |
| `NOT_FOUND` | -32004 | 404 |
| `CONFLICT` | -32009 | 409 |
| `TOO_MANY_REQUESTS` | -32029 | 429 |

这个映射是 tRPC 私有的。第三方需要知道 `-32004` 意味着"未找到" — 这不是任何标准规范。

错误响应格式：

```json
{
  "error": {
    "json": {
      "message": "Something went wrong",
      "code": -32600,
      "data": {
        "code": "INTERNAL_SERVER_ERROR",
        "httpStatus": 500,
        "stack": "...",
        "path": "post.add"
      }
    }
  }
}
```

---

## 三、本质：设计目标的根本冲突

```
tRPC 的设计假设：
  "我同时控制客户端和服务端，它们共享 TypeScript monorepo，
   一起部署。TypeScript 编译器就是我的 API 契约。"

公开 API 的设计需求：
  "我无法控制消费者。他们可能用任何语言、任何 HTTP 客户端。
   我需要一个语言无关的契约（OpenAPI/SDL/.proto）来文档化 API
   并支持代码生成。"
```

这两者**根本对立**。tRPC 优化的是受控 TypeScript 环境下的开发体验，代价是放弃了互操作性。

---

## 四、trpc-openapi 补救方案的问题

社区构建了 `@trpc/openapi` 来尝试桥接这个差距，但它：

1. **要求手动为每个过程添加显式的 input/output 验证器** — 这违背了 tRPC 的核心价值（类型推断）
2. **实际上变成了 REST with extra steps** — 你在用 tRPC 的语法写 REST API
3. 只能检测 breaking change，不能同时服务多版本

**来源：** GitHub Discussion #4697

> *"One could use trpc-openapi and generate a C# REST API client based on the OpenAPI doc from the trpc service, tho you would be doing REST/OpenAPI then and not really trpc anymore"*

---

## 五、综合对比

| 特性 | REST + OpenAPI | GraphQL | tRPC |
|------|---------------|---------|------|
| **契约格式** | OpenAPI（JSON/YAML） | SDL（.graphql） | TypeScript 源码 |
| **语言支持** | 全语言 | 全语言 | 仅 TypeScript |
| **自描述/文档** | ✅ Swagger UI | ✅ GraphiQL/Introspection | ❌ 无 |
| **客户端 SDK 生成** | 全语言 | 全语言 | 仅 TypeScript |
| **版本管理** | ✅ 成熟（URL/Header/Date） | ✅ Schema 演进 | ❌ 无 |
| **HTTP 缓存** | ✅ 原生支持 | ⚠️ 复杂 | ❌ 有限 |
| **公开 API 适用性** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ❌ |
| **内部 TypeScript API 效率** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

---

## 六、业界推荐模式

> *"tRPC internally + REST externally is the winning pattern."*
> — CodeWithSeb, 2026

```
┌─────────────────────────────────────────────────┐
│                Your Application                  │
├─────────────────────┬───────────────────────────┤
│   Internal (tRPC)   │   External (REST/OpenAPI)  │
│  ┌───────────────┐  │  ┌─────────────────────┐  │
│  │  Dashboard    │  │  │  Webhooks            │  │
│  │  Admin panel  │  │  │  第三方 SDK           │  │
│  │  App UI       │  │  │  Mobile App (非TS)   │  │
│  │  内部工具      │  │  │  OAuth 回调          │  │
│  └───────────────┘  │  └─────────────────────┘  │
└─────────────────────┴───────────────────────────┘
```

**内部通信用 tRPC**（你控制两端，享受类型安全和开发效率），**对外暴露 REST/OpenAPI**（标准协议，任何消费者都能接入）。

---

## 七、参考资料

| 来源 | URL |
|------|-----|
| tRPC 官方 "Further Reading" | https://trpc.io/docs/further-reading |
| tRPC HTTP RPC 规范 | https://trpc.io/docs/rpc |
| tRPC Data Transformers | https://trpc.io/docs/data-transformers |
| GitHub Discussion #4697（多语言使用） | https://github.com/trpc/trpc/discussions/4697 |
| tRPC 源码 - httpBatchLink | https://github.com/trpc/trpc/blob/main/packages/client/src/links/httpBatchLink.ts |
| tRPC 源码 - envelopes.ts | https://github.com/trpc/trpc/blob/main/packages/server/src/unstable-core-do-not-import/rpc/envelopes.ts |
| APIScout 2026 对比 | https://apiscout.dev/blog/rest-vs-graphql-vs-grpc-vs-trpc-2026 |
| CodeWithSeb 数据层指南 | https://codewithseb.com/blog/graphql-vs-rest-vs-trpc-data-layer-guide |
| DEV Community 2026 | https://dev.to/alexcloudstar/rest-vs-graphql-vs-trpc-what-i-actually-use-and-why-in-2026-395i |
