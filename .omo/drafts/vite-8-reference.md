# Vite 8 (v8.0.16) 完全参考手册

> **基于 Vite 8.0.16 最新版本** | 引擎: Rolldown (Rust) + Oxc Transformer
>
> 本文档涵盖: 配置项完整说明、性能优化标注、所有可用 Hooks、插件生命周期详解

---

# 第一部分: Vite 配置项完整说明

## 一、Shared Options（共享选项——适用于 dev/build/preview）

### 1.1 项目根目录

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `root` | `string` | `process.cwd()` | 项目根目录（`index.html` 所在位置） |
| `base` | `string` | `/` | 基础公开路径。可选: 绝对路径(`/foo/`)、完整URL、`''`或`./` |
| `mode` | `string` | `development`/`production` | 覆盖默认模式 |

### 1.2 全局常量定义

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `define` | `Record<string, any>` | — | 定义全局常量替换。**dev 时作为全局变量，build 时静态替换** |

```ts
// ⚡ 性能优化: define 在 build 时直接文本替换，避免运行时动态计算
define: {
  __APP_VERSION__: JSON.stringify('v1.0.0'),
  __API_URL__: 'window.__backend_api_url', // 保持为标识符引用
}
```

### 1.3 插件

| 选项 | 类型 | 默认值 |
|------|------|--------|
| `plugins` | `(Plugin \| Plugin[] \| Promise<Plugin \| Plugin[]>)[]` | `[]` |

> 数组会被扁平化，falsy 值被忽略，Promise 会在运行前 resolve。

### 1.4 静态资源

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `publicDir` | `string \| false` | `"public"` | 设为 `false` 可减少构建时的文件复制开销 |
| `assetsInclude` | `string \| RegExp \| (string \| RegExp)[]` | — | 扩展被视为静态资产的文件类型 |
| `cacheDir` | `string` | `"node_modules/.vite"` | ⚡ **缓存目录**。可指向 SSD 或 tmpfs 加速缓存读写 |

### 1.5 路径解析 (resolve)

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `resolve.alias` | `Record \| Array` | — | ⚡ **减少深层相对路径查找**，加速模块解析 |
| `resolve.dedupe` | `string[]` | — | 强制依赖去重，解决 monorepo 中的相同依赖多副本问题 |
| `resolve.conditions` | `string[]` | `['module', 'browser', 'development\|production']` | 控制条件导出解析优先级 |
| `resolve.mainFields` | `string[]` | `['browser', 'module', 'jsnext:main', 'jsnext']` | package.json 入口字段优先级 |
| `resolve.extensions` | `string[]` | `['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']` | ⚡ **减少扩展名数量**可加速解析 |
| `resolve.preserveSymlinks` | `boolean` | `false` | 是否保留符号链接原始路径 |
| `resolve.tsconfigPaths` | `boolean` | `false` | 启用 tsconfig `paths` 解析 |

### 1.6 CSS 相关

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `css.modules` | `CSSModulesOptions` | — | CSS Modules 配置 |
| `css.postcss` | `string \| object` | — | ⚡ **明确指定配置**比自动搜索更快 |
| `css.preprocessorOptions` | `Record<string, object>` | — | 预处理器选项(sass/less/stylus) |
| `css.preprocessorMaxWorkers` | `number \| true` | `true` | ⚡ **多线程 CSS 预处理**，设为 `true` 使用 CPU-1 个线程 |
| `css.devSourcemap` | `boolean` | `false` | ⚡ **dev 时关闭 CSS sourcemap** 可提升速度 |
| `css.transformer` | `'postcss' \| 'lightningcss'` | `'postcss'` | ⚡ **使用 `lightningcss`** 可获得 10-100x 更快的 CSS 处理 |
| `css.lightningcss` | `object` | — | Lightning CSS 详细配置 |

### 1.7 JSON

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `json.namedExports` | `boolean` | `true` | 是否支持 JSON 命名导入 |
| `json.stringify` | `boolean \| 'auto'` | `'auto'` | ⚡ **超过 10KB 的 JSON 自动 stringify**，比对象字面量更高效 |

### 1.8 Oxc 转换器（Vite 8 替代 esbuild）

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `oxc` | `OxcOptions \| false` | — | ⚡ **Oxc Transformer**（Rust 编写）比 esbuild 快 5-10x |
| `oxc.jsx.runtime` | `'automatic' \| 'classic'` | — | JSX 运行时模式 |
| `oxc.jsx.importSource` | `string` | — | JSX 自动运行时的导入源 |
| `oxc.jsxInject` | `string` | — | 自动注入 JSX 导入 |
| `oxc.include/exclude` | `picomatch patterns` | — | ⚡ **缩小转换范围**可加速构建 |

```ts
// ⚡ 性能优化: 明确指定 Oxc 转换范围，避免不必要的处理
export default defineConfig({
  oxc: {
    include: ['**/*.ts', '**/*.tsx'],
    exclude: ['node_modules/**', 'dist/**'],
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
})
```

### 1.9 环境变量

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `envDir` | `string \| false` | `root` | `.env` 文件加载目录 |
| `envPrefix` | `string \| string[]` | `VITE_` | 暴露给客户端源码的 env 变量前缀 |

### 1.10 其他

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `logLevel` | `'info' \| 'warn' \| 'error' \| 'silent'` | `'info'` | 控制日志输出 |
| `customLogger` | `Logger` | — | 自定义日志记录器 |
| `clearScreen` | `boolean` | `true` | 是否清屏 |
| `appType` | `'spa' \| 'mpa' \| 'custom'` | `'spa'` | 应用类型 |
| `html.cspNonce` | `string` | — | CSP nonce 值 |
| `future` | `Record<string, 'warn'>` | — | 提前启用未来 breaking changes |
| `devtools` | `boolean \| DevToolsConfig` | `false` | 启用 Vite DevTools（实验性） |

---

## 二、Server Options（仅 dev 环境）

### 2.1 服务器配置

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `server.host` | `string \| boolean` | `'localhost'` | `true` 监听所有网络接口 |
| `server.allowedHosts` | `string[] \| true` | `[]` | 允许访问的主机名（安全相关） |
| `server.port` | `number` | `5173` | 端口（被占用会自动递增） |
| `server.strictPort` | `boolean` | — | 端口被占用时是否退出而非递增 |
| `server.https` | `https.ServerOptions` | — | HTTPS 配置 |
| `server.open` | `boolean \| string` | — | 自动打开浏览器 |
| `server.origin` | `string` | — | ⚡ **定义开发时生成的资源 URL 的 origin**，配合反向代理时使用 |

### 2.2 代理

| 选项 | 类型 | 说明 |
|------|------|------|
| `server.proxy` | `Record<string, string \| ProxyOptions>` | 配置自定义代理规则 |

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

### 2.3 CORS 和 Headers

| 选项 | 类型 | 默认值 |
|------|------|--------|
| `server.cors` | `boolean \| CorsOptions` | 默认允许 localhost |
| `server.headers` | `OutgoingHttpHeaders` | — |

### 2.4 HMR

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `server.hmr` | `boolean \| object` | — | ⚡ 设为 `false` **完全禁用 HMR**（开发纯 API 后端时） |
| `server.hmr.overlay` | `boolean` | `true` | ⚡ **关闭 overlay** 可减少开发时的视觉干扰 |
| `server.hmr.protocol` | `'ws' \| 'wss'` | — | WebSocket 协议 |

### 2.5 ⚡ 性能优化配置

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `server.warmup` | `{ clientFiles?, ssrFiles? }` | — | ⚡ **预热常用文件**。在启动时预先转换和缓存，避免首屏瀑布式转换 |
| `server.forwardConsole` | `boolean \| object` | auto | 将浏览器控制台事件转发到终端 |
| `server.watch` | `object \| null` | — | 文件系统监听选项 |
| `server.middlewareMode` | `boolean` | `false` | 中间件模式（SSR 使用） |
| `server.sourcemapIgnoreList` | `false \| function` | 见文档 | sourcemap 忽略列表 |

```ts
// ⚡ 性能优化: 预热常用文件
server: {
  warmup: {
    clientFiles: [
      './src/components/*.vue',
      './src/utils/big-utils.js',
      './src/pages/**/*.tsx',
    ],
  },
}
```

### 2.6 文件系统安全

| 选项 | 类型 | 默认值 |
|------|------|--------|
| `server.fs.strict` | `boolean` | `true` |
| `server.fs.allow` | `string[]` | 自动检测 |
| `server.fs.deny` | `string[]` | `['.env', '.env.*', '*.{crt,pem}', '**/.git/**']` |

---

## 三、Build Options（仅 build 环境）

### 3.1 输出配置

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `build.outDir` | `string` | `dist` | 输出目录 |
| `build.assetsDir` | `string` | `assets` | 静态资源子目录 |
| `build.assetsInlineLimit` | `number \| function` | `4096` | ⚡ **内联阈值**。小图片转为 base64 减少 HTTP 请求 |
| `build.cssCodeSplit` | `boolean` | `true` | ⚡ **CSS 代码分割**，异步 chunk 的 CSS 单独加载 |
| `build.sourcemap` | `boolean \| 'inline' \| 'hidden'` | `false` | ⚡ **关闭 sourcemap** 可显著加速构建 |
| `build.manifest` | `boolean \| string` | `false` | ⚡ **不需要时关闭**，避免额外 I/O |
| `build.emptyOutDir` | `boolean` | 自动 | 构建前清空输出目录 |
| `build.copyPublicDir` | `boolean` | `true` | 是否复制 public 目录 |

### 3.2 ⚡ 构建目标与转译

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `build.target` | `string \| string[]` | `'baseline-widely-available'` | ⚡ **目标越现代，转译越少，构建越快**。`'esnext'` 几乎不转译 |
| `build.cssTarget` | `string \| string[]` | `build.target` | CSS 转译的目标浏览器 |
| `build.cssMinify` | `boolean \| 'lightningcss' \| 'esbuild'` | `'lightningcss'` | ⚡ **Lightning CSS 极速压缩** |

### 3.3 ⚡ 代码压缩

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `build.minify` | `boolean \| 'oxc' \| 'terser' \| 'esbuild'` | `'oxc'` | ⚡ **Oxc 压缩器**比 terser 快 30-90x。SSR 构建默认为 `false` |
| `build.terserOptions` | `TerserOptions` | — | Terser 专用选项 |

### 3.4 构建大小分析

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `build.reportCompressedSize` | `boolean` | `true` | ⚡ **关闭 gzip 大小报告**可提升大型项目构建速度 |
| `build.chunkSizeWarningLimit` | `number` | `500` | chunk 大小警告阈值（KB） |

### 3.5 Rolldown 选项（Vite 8 核心变更）

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `build.rolldownOptions` | `RolldownOptions` | — | ⚡ **Vite 8 新选项**。直接定制 Rolldown 打包器行为 |
| `build.rolldownOptions.external` | — | — | 外部化依赖 |
| `build.rolldownOptions.input` | — | — | 自定义入口 |
| `build.rolldownOptions.output` | — | — | 输出配置（globals, format 等） |

> `build.rollupOptions` 已废弃，Vite 8 中作为 `rolldownOptions` 的别名保留。

### 3.6 库模式

| 选项 | 类型 | 说明 |
|------|------|------|
| `build.lib.entry` | `string \| string[] \| object` | 库入口文件 |
| `build.lib.name` | `string` | 全局变量名（umd/iife 时需要） |
| `build.lib.formats` | `('es' \| 'cjs' \| 'umd' \| 'iife')[]` | 输出格式 |
| `build.lib.fileName` | `string \| function` | 输出文件名 |
| `build.lib.cssFileName` | `string` | CSS 文件名 |

### 3.7 其他构建选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `build.watch` | `WatcherOptions \| null` | `null` | 监听模式 |
| `build.ssr` | `boolean \| string` | `false` | SSR 构建 |
| `build.ssrManifest` | `boolean \| string` | `false` | SSR manifest |
| `build.emitAssets` | `boolean` | `false` | 非客户端构建是否输出资源 |
| `build.dynamicImportVarsOptions` | `{ include?, exclude? }` | — | 动态导入变量选项 |
| `build.license` | `boolean \| { fileName? }` | `false` | ⚡ **生成依赖许可文件** |

### ⚡ 性能优化的 Build 配置示例

```ts
// vite.config.ts - 极致性能优化配置
export default defineConfig({
  build: {
    target: 'esnext',                          // 最少的转译
    minify: 'oxc',                             // Rust 压缩器，极速
    sourcemap: false,                          // 关闭 sourcemap
    reportCompressedSize: false,               // 关闭 gzip 报告
    chunkSizeWarningLimit: 2000,               // 提高警告阈值
    cssMinify: 'lightningcss',                 // Lightning CSS 压缩
    cssCodeSplit: true,                        // CSS 代码分割
    assetsInlineLimit: 0,                      // 不内联任何资源（或按需配置）
    rollupOptions: {
      output: {
        manualChunks: {                        // 手动分包
          vendor: ['react', 'react-dom'],
          ui: ['antd', '@ant-design/icons'],
        },
      },
    },
  },
})
```

---

## 四、Preview Options

| 选项 | 类型 | 默认值 |
|------|------|--------|
| `preview.host` | `string \| boolean` | `'localhost'` |
| `preview.port` | `number` | `4173` |
| `preview.strictPort` | `boolean` | — |
| `preview.https` | `https.ServerOptions` | — |
| `preview.open` | `boolean \| string` | — |
| `preview.proxy` | `Record<string, string \| ProxyOptions>` | — |
| `preview.cors` | `boolean \| CorsOptions` | — |
| `preview.headers` | `OutgoingHttpHeaders` | — |

---

## 五、Dep Optimization Options（仅 dev 依赖优化）

| 选项 | 类型 | 默认值 | ⚡ 性能优化 |
|------|------|--------|------------|
| `optimizeDeps.entries` | `string \| string[]` | 自动检测 .html 入口 | ⚡ **显式指定入口**可加速依赖发现 |
| `optimizeDeps.include` | `string[]` | — | ⚡ **预声明需要预打包的依赖**，避免运行时发现 |
| `optimizeDeps.exclude` | `string[]` | — | 排除不需要预打包的依赖 |
| `optimizeDeps.force` | `boolean` | — | 强制重新预打包 |
| `optimizeDeps.noDiscovery` | `boolean` | `false` | ⚡ **禁用自动发现**。所有依赖必须在 `include` 中声明，冷启动更快 |
| `optimizeDeps.holdUntilCrawlEnd` | `boolean` | `true` | ⚡ **等到所有静态导入爬取完毕再提供**，避免页面重载 |
| `optimizeDeps.needsInterop` | `string[]` | — | ⚡ 明确需要 ESM interop 的依赖，加速冷启动 |
| `optimizeDeps.rolldownOptions` | `RolldownOptions` | — | Vite 8 新选项，传给 Rolldown 的优化选项 |

```ts
// ⚡ 性能优化: 依赖预构建优化
export default defineConfig({
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'my-lib/components/**/*.vue', // 批量预打包
    ],
    noDiscovery: true,   // 关闭自动发现，加快冷启动
    holdUntilCrawlEnd: false, // 如果所有依赖都已声明的，可以关闭
  },
})
```

---

## 六、SSR Options

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ssr.external` | `string[]` | — | SSR 时外部化的依赖 |
| `ssr.noExternal` | `string \| RegExp \| (string \| RegExp)[]` | — | SSR 时强制内联的依赖 |
| `ssr.target` | `'node' \| 'webworker'` | `'node'` | SSR 构建目标 |
| `ssr.optimizeDeps` | `DepOptimizationOptions` | — | SSR 依赖优化 |

---

## 七、Worker Options

| 选项 | 类型 | 默认值 |
|------|------|--------|
| `worker.format` | `'es' \| 'iife'` | `'iife'` |
| `worker.plugins` | `(Plugin \| Plugin[])[]` | — |
| `worker.rolldownOptions` | `RolldownOptions` | — |

---

## 八、Environment API（Vite 6+ / Vite 8）

Vite 8 支持多环境配置（client / server / edge 等）：

```ts
export default defineConfig({
  environments: {
    client: {
      // 客户端环境配置
      build: { outDir: 'dist/client' },
    },
    server: {
      // SSR 环境配置
      resolve: { noExternal: true },
      build: { outDir: 'dist/server' },
    },
    edge: {
      // Edge 运行时环境
      resolve: { noExternal: true },
    },
  },
})
```

---

# 第二部分: Vite 所有可用 Hooks

Vite 插件 Hooks = **Rolldown 通用 Hooks** + **Vite 特有 Hooks**。

## 一、Vite 特有 Hooks（6 个）

这些 Hooks 仅在 Vite 中可用，被 Rollup/Rolldown 忽略。

### 1. `config`

- **类型**: `(config: UserConfig, env: { mode, command }) => UserConfig | null | void`
- **执行**: `async`, `sequential`
- **时序**: 在所有插件解析之前，修改原始用户配置

**实际项目使用场景**:

```ts
// 场景 1: 根据环境自动配置
function autoConfigPlugin() {
  return {
    name: 'auto-config',
    config(config, { command, mode }) {
      if (command === 'build') {
        return { base: '/production/' }  // build 时设置 base
      }
      if (mode === 'staging') {
        return { define: { __API_URL__: '"https://staging.api.com"' } }
      }
    },
  }
}

// 场景 2: 自动注入别名
function autoAliasPlugin() {
  return {
    name: 'auto-alias',
    config() {
      return { resolve: { alias: { '@': '/src', '@comps': '/src/components' } } }
    },
  }
}
```

### 2. `configResolved`

- **类型**: `(config: ResolvedConfig) => void | Promise<void>`
- **执行**: `async`, `parallel`
- **时序**: 配置完全解析后调用

**实际项目使用场景**:

```ts
// 场景 1: 读取最终配置供其他 hook 使用
function configPlugin() {
  let config: ResolvedConfig
  return {
    name: 'read-config',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    transform(code, id) {
      if (config.command === 'serve') {
        // dev 下的特殊处理
      } else {
        // build 下的特殊处理
      }
    },
  }
}

// 场景 2: 校验配置合法性
function validateConfigPlugin() {
  return {
    name: 'validate-config',
    configResolved(config) {
      if (!config.plugins?.some(p => p.name === 'vue')) {
        console.warn('Warning: Vue plugin not found!')
      }
    },
  }
}
```

### 3. `configureServer`

- **类型**: `(server: ViteDevServer) => (() => void) | void | Promise<(() => void) | void>`
- **执行**: `async`, `sequential`
- **时序**: 在 Vite 内部中间件安装前调用

**实际项目使用场景**:

```ts
// 场景 1: 添加自定义中间件（前置）
function loggerPlugin() {
  return {
    name: 'request-logger',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
        next()
      })
    },
  }
}

// 场景 2: 添加后置中间件（在 Vite 内部中间件之后执行）
function fallbackPlugin() {
  return {
    name: 'spa-fallback',
    configureServer(server) {
      return () => {
        server.middlewares.use((req, res, next) => {
          if (req.url?.startsWith('/api')) {
            res.writeHead(404)
            res.end('API not found')
          } else {
            next()
          }
        })
      }
    },
  }
}

// 场景 3: 存储 server 实例供其他 hook 使用
function hmrPlugin() {
  let server: ViteDevServer
  return {
    name: 'custom-hmr',
    configureServer(s) { server = s },
    transform(code, id) {
      // 使用 server.ws 发送 WebSocket 消息
      server?.ws.send({ type: 'custom', event: 'my:event', data: {} })
      return code
    },
  }
}
```

### 4. `configurePreviewServer`

- **类型**: `(server: PreviewServer) => (() => void) | void | Promise<(() => void) | void>`
- **执行**: `async`, `sequential`

**场景**: 预览服务器中间件配置，用法同 `configureServer`。

### 5. `transformIndexHtml`

- **类型**: `IndexHtmlTransformHook | { order?: 'pre' | 'post', handler: IndexHtmlTransformHook }`
- **执行**: `async`, `sequential`
- **时序**: 转换 HTML 入口文件

**实际项目使用场景**:

```ts
// 场景 1: 注入环境变量脚本
function envScriptPlugin() {
  return {
    name: 'inject-env',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `<script>window.__RUNTIME_CONFIG__ = ${JSON.stringify(process.env)}</script></head>`
      )
    },
  }
}

// 场景 2: 注入动态标签（推荐方式）
function injectTagsPlugin() {
  return {
    name: 'inject-tags',
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          attrs: { src: '/monitoring.js', defer: true },
          injectTo: 'body',
        },
        {
          tag: 'link',
          attrs: { rel: 'preconnect', href: 'https://api.example.com' },
          injectTo: 'head',
        },
      ]
    },
  }
}

// 场景 3: 仅在构建时注入
function buildInjectPlugin() {
  return {
    name: 'build-only-inject',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.bundle) {
          // 构建阶段，注入分析代码
          return html.replace('</body>', '<script src="/analytics.js"></script></body>')
        }
      },
    },
  }
}
```

### 6. `handleHotUpdate`

- **类型**: `(ctx: HmrContext) => Array<ModuleNode> | void | Promise<Array<ModuleNode> | void>`
- **执行**: `async`, `sequential`
- **时序**: 文件变更触发热更新时

**实际项目使用场景**:

```ts
// 场景 1: 过滤 HMR 范围，精确触发更新
function cssHmrPlugin() {
  return {
    name: 'smart-hmr',
    handleHotUpdate({ file, modules, server, read }) {
      if (file.endsWith('.css')) {
        // 只更新受影响的模块
        return modules.filter(m => m.id?.includes('src'))
      }
      // 其他文件类型默认处理
    },
  }
}

// 场景 2: 完全自定义 HMR 行为
function customHmrPlugin() {
  return {
    name: 'custom-hmr',
    handleHotUpdate({ server, file, modules }) {
      if (file.endsWith('.json')) {
        // 发送自定义事件，不触发默认 HMR
        server.ws.send({
          type: 'custom',
          event: 'json-update',
          data: { file },
        })
        return [] // 返回空数组阻止默认 HMR
      }
    },
  }
}

// 场景 3: 模块失效 + 全量刷新
function forceReloadPlugin() {
  return {
    name: 'force-reload',
    handleHotUpdate({ server, modules, timestamp }) {
      // 使所有模块失效
      const invalidated = new Set()
      for (const mod of modules) {
        server.moduleGraph.invalidateModule(mod, invalidated, timestamp, true)
      }
      server.ws.send({ type: 'full-reload' })
      return []
    },
  }
}
```

---

## 二、Rolldown 通用 Hooks（可在 Vite 中使用）

### 2.1 Build Hooks（构建阶段）

| Hook | 类型 | 执行方式 | 说明 | 场景 |
|------|------|----------|------|------|
| `options` | `(options) => options \| null` | `async`, `sequential` | 修改或替换输入选项 | 全局配置注入 |
| `buildStart` | `(options) => void` | `async`, `parallel` | 每个构建开始 | 初始化资源、清理缓存 |
| `resolveId` | `(source, importer) => id \| null` | `async`, `first` | 解析模块路径 | 虚拟模块、路径别名 |
| `load` | `(id) => code \| null` | `async`, `first` | 加载模块内容 | 虚拟模块内容提供 |
| `transform` | `(code, id) => transformed` | `async`, `sequential` | 转换模块代码 | 代码编译、注入 |
| `moduleParsed` | `(info) => void` | `async`, `parallel` | 模块被解析后 | ⚠️ **dev 中不调用** |
| `resolveDynamicImport` | `(specifier, importer) => id \| null` | `async`, `first` | 解析动态导入 | 动态导入处理 |
| `buildEnd` | `(error?) => void` | `async`, `parallel` | 构建结束 | 清理、输出统计 |
| `watchChange` | `(id, event) => void` | `sync`, `sequential` | watch 模式下文件变更 | 监听文件变更通知 |
| `closeWatcher` | `() => void` | `async`, `parallel` | watcher 关闭 | 资源释放 |
| `closeBundle` | `() => void` | `async`, `sequential` | 所有构建完成 | 最终清理 |

### 2.2 Output Generation Hooks（输出生成阶段）

| Hook | 类型 | 执行方式 | 说明 | 场景 |
|------|------|----------|------|------|
| `outputOptions` | `(options) => options \| null` | `async`, `sequential` | 修改输出配置 | 输出格式定制 |
| `renderStart` | `() => void` | `async`, `parallel` | 输出生成开始 | 输出阶段初始化 |
| `banner` | `(chunk) => string` | `async`, `sequential` | 文件头注释 | 版权声明、许可信息 |
| `footer` | `(chunk) => string` | `async`, `sequential` | 文件尾注释 | 构建信息 |
| `intro` | `(chunk) => string` | `async`, `sequential` | 文件内部开头 | 运行时注入 |
| `outro` | `(chunk) => string` | `async`, `sequential` | 文件内部结尾 | 清理逻辑 |
| `renderChunk` | `(code, chunk) => code` | `async`, `sequential` | 转换单个 chunk | 代码后处理 |
| `augmentChunkHash` | `(chunk) => string` | `async`, `sequential` | 修改 chunk hash | 缓存失效控制 |
| `generateBundle` | `(options, bundle) => void` | `async`, `sequential` | 生成 bundle 后 | 后处理、分析报告 |
| `writeBundle` | `(options) => void` | `async`, `sequential` | 写入磁盘后 | 部署后操作 |
| `renderError` | `(error) => void` | `async`, `sequential` | 渲染阶段出错 | 错误处理 |

### ⚡ Hook Filters（Vite 6.3+ / Vite 8 性能优化）

```ts
// 使用 Hook Filters 避免不必要的 JS↔Rust 通信
function optimizedPlugin() {
  const jsFileRegex = /\.js$/

  return {
    name: 'optimized-plugin',
    transform: {
      filter: {
        id: jsFileRegex,  // 只在 .js 文件时调用 transform
      },
      handler(code, id) {
        // 向后兼容检查
        if (!jsFileRegex.test(id)) return null
        return { code: transformCode(code), map: null }
      },
    },
  }
}
```

---

# 第三部分: Vite 插件完整生命周期

## 一、执行顺序全图

```
┌─────────────────────────────────────────────────────────┐
│                   开发服务器启动                          │
├─────────────────────────────────────────────────────────┤
│                                                        │
│  1. options (所有插件)                                   │
│  2. buildStart (所有插件)                                │
│                                                        │
├─────────────────────────────────────────────────────────┤
│                   配置阶段                                │
├─────────────────────────────────────────────────────────┤
│                                                        │
│  3. config (Vite 特有) — 修改用户配置                     │
│  4. configResolved (Vite 特有) — 读取最终配置             │
│  5. configureServer (Vite 特有) — 配置开发服务器           │
│                                                        │
├─────────────────────────────────────────────────────────┤
│                   请求处理阶段（每次文件请求）              │
├─────────────────────────────────────────────────────────┤
│                                                        │
│  6. resolveId — 解析模块路径                              │
│  7. resolveDynamicImport — 解析动态导入（import()）       │
│  8. load — 加载模块内容                                  │
│  9. transform — 转换模块代码(Oxc 内部转换在此之后)         │
│  10. transformIndexHtml — 转换 HTML (Vite 特有)           │
│                                                        │
├─────────────────────────────────────────────────────────┤
│                   文件变更 (watch/HMR)                    │
├─────────────────────────────────────────────────────────┤
│                                                        │
│  11. watchChange — 监听文件变更                           │
│  12. handleHotUpdate — 自定义 HMR (Vite 特有)             │
│                                                        │
├─────────────────────────────────────────────────────────┤
│                   生产构建阶段                            │
├─────────────────────────────────────────────────────────┤
│                                                        │
│  ┌─── 构建阶段 ────────────────────────────────────┐     │
│  │  13. outputOptions — 修改输出选项                   │     │
│  │  14. buildStart — 重新开始构建                      │     │
│  │  15. resolveId / resolveDynamicImport /            │     │
│  │      load / transform — 重复请求处理                │     │
│  │  16. moduleParsed — 模块解析完成（仅在 build）        │     │
│  │  17. buildEnd — 构建结束                            │     │
│  └─────────────────────────────────────────────────┘     │
│                                                        │
│  ┌─── 输出生成阶段 ────────────────────────────────┐     │
│  │  18. renderStart — 输出生成开始                     │     │
│  │  19. banner / footer / intro / outro              │     │
│  │  20. renderChunk — 处理每个 chunk                   │     │
│  │  21. augmentChunkHash — 修改 hash                   │     │
│  │  22. generateBundle — bundle 生成后                 │     │
│  │  23. writeBundle — 写入磁盘后                       │     │
│  └─────────────────────────────────────────────────┘     │
│                                                        │
├─────────────────────────────────────────────────────────┤
│                   清理阶段                                │
├─────────────────────────────────────────────────────────┤
│                                                        │
│  24. closeWatcher — 关闭 watcher (watch mode)           │
│  25. closeBundle — 最终清理                              │
│                                                        │
└─────────────────────────────────────────────────────────┘
```

## 二、插件排序规则

Vite 中插件的执行顺序由 `enforce` 属性控制：

```ts
// 执行顺序:
// Alias 解析
//   → enforce: 'pre' 的插件
//     → Vite 核心插件
//       → 无 enforce 的用户插件
//         → Vite 构建插件
//           → enforce: 'post' 的插件
//             → Vite 后构建插件（压缩、manifest、报告）
```

```ts
{
  name: 'pre-plugin',
  enforce: 'pre',   // 最先执行（在框架插件之前）
}

{
  name: 'normal-plugin',
  // 无 enforce — 中间位置
}

{
  name: 'post-plugin',
  enforce: 'post',  // 最后执行（在构建插件之后）
}
```

## 三、条件应用

```ts
// 只在构建时运行
{
  name: 'build-only',
  apply: 'build',
}

// 只在开发时运行
{
  name: 'serve-only',
  apply: 'serve',
}

// 函数形式: 更精确控制
{
  name: 'conditional-plugin',
  apply(config, { command }) {
    return command === 'build' && !config.build.ssr
  },
}
```

## 四、Hooks 执行方式详解

| 执行方式 | 说明 | 包含的 Hooks |
|----------|------|-------------|
| `async` | 可返回 Promise | 大部分 hooks |
| `sync` | 必须同步返回 | `watchChange` |
| `sequential` | 按插件顺序串行执行，下一个等待上一个完成 | `config`, `configureServer`, `transform`, `handleHotUpdate`, 所有 output hooks |
| `parallel` | 并行执行，不等待 | `buildStart`, `buildEnd`, `moduleParsed` |
| `first` | 按顺序执行，直到某个插件返回非 null/undefined 的值 | `resolveId`, `load` |

## 五、实际项目插件架构示例

```ts
// 一个完整的实际项目插件示例
function completePlugin(): Plugin {
  let config: ResolvedConfig
  let server: ViteDevServer

  return {
    name: 'complete-plugin',

    // ===== Vite 特有 Hooks =====

    // 1. 修改配置
    config(userConfig, { command, mode }) {
      return {
        resolve: { alias: { '@my-lib': './src' } },
      }
    },

    // 2. 读取最终配置
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },

    // 3. 配置开发服务器
    configureServer(s) {
      server = s
      // 前置中间件
      server.middlewares.use((req, res, next) => {
        // 自定义请求处理
        next()
      })
      // 后置中间件（返回函数）
      return () => {
        server.middlewares.use((req, res, next) => {
          // 在 Vite 内部中间件之后执行
          next()
        })
      }
    },

    // 4. 预览服务器
    configurePreviewServer(s) {
      return () => {
        s.middlewares.use((req, res, next) => next())
      }
    },

    // 5. 转换 HTML
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        return html.replace('</head>', '<link rel="preload" ...></head>')
      },
    },

    // 6. 自定义 HMR
    handleHotUpdate({ file, server, modules }) {
      if (file.endsWith('.custom')) {
        server.ws.send('custom:update', { file })
        return []
      }
      return modules.filter(m => !m.id?.includes('node_modules'))
    },

    // ===== 通用 Hooks =====

    // 解析模块
    resolveId: {
      filter: { id: /^virtual:my-module/ },
      handler(source) {
        if (source === 'virtual:my-module') {
          return '\0virtual:my-module'
        }
      },
    },

    // 加载模块
    load: {
      filter: { id: /\0virtual:/ },
      handler(id) {
        if (id === '\0virtual:my-module') {
          return `export const msg = 'Hello from virtual module'`
        }
      },
    },

    // 转换代码
    transform: {
      filter: { id: /\.(ts|tsx)$/ },
      handler(code, id) {
        if (id.includes('node_modules')) return null
        return { code: transformCode(code), map: null }
      },
    },

    // 构建开始/结束
    buildStart() {
      console.log(`[${new Date().toISOString()}] Build starting...`)
    },
    buildEnd() {
      console.log(`[${new Date().toISOString()}] Build ended`)
    },
    closeBundle() {
      console.log(`[${new Date().toISOString()}] Bundle closed`)
    },

    // 输出阶段
    renderChunk(code, chunk) {
      console.log(`Processing chunk: ${chunk.fileName}`)
      return code
    },
    generateBundle(options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        const css = chunk.viteMetadata?.importedCss
        const assets = chunk.viteMetadata?.importedAssets
        if (css?.size) {
          console.log(`${fileName} imports CSS: ${[...css].join(', ')}`)
        }
      }
    },
    writeBundle() {
      console.log('Build output written to disk')
    },
  }
}
```

## 六、虚拟模块模式

```ts
// 虚拟模块是 Vite 插件的核心模式之一
// 约定: 用户可见路径以 virtual: 开头，内部 resolve 后加 \0 前缀

function virtualModulePlugin(): Plugin {
  const virtualModuleId = 'virtual:my-module'
  const resolvedVirtualModuleId = '\0' + virtualModuleId

  return {
    name: 'virtual-module',
    resolveId: {
      filter: { id: /^virtual:/ },
      handler(id) {
        if (id === virtualModuleId) return resolvedVirtualModuleId
      },
    },
    load: {
      filter: { id: /\0virtual:/ },
      handler(id) {
        if (id === resolvedVirtualModuleId) {
          return `export const msg = "from virtual module"`
        }
      },
    },
  }
}

// 客户端使用:
// import { msg } from 'virtual:my-module'
```

## 七、客户端-服务端通信

### 7.1 服务端 → 客户端

```ts
// 插件端 (vite.config.ts)
configureServer(server) {
  server.ws.send('my:greetings', { msg: 'hello' })
}

// 客户端代码
if (import.meta.hot) {
  import.meta.hot.on('my:greetings', (data) => {
    console.log(data.msg) // "hello"
  })
}
```

### 7.2 客户端 → 服务端

```ts
// 客户端
if (import.meta.hot) {
  import.meta.hot.send('my:from-client', { msg: 'Hey!' })
}

// 服务端
configureServer(server) {
  server.ws.on('my:from-client', (data, client) => {
    console.log(data.msg) // "Hey!"
    client.send('my:ack', { msg: 'Got it!' })
  })
}
```

### 7.3 类型化自定义事件

```ts
// events.d.ts
import 'vite/types/customEvent.d.ts'

declare module 'vite/types/customEvent.d.ts' {
  interface CustomEventMap {
    'custom:foo': { msg: string }
  }
}
```

---

## 附录: Vite 8 关键变化一览（相较于 Vite 7）

| 项目 | Vite 7 | Vite 8 |
|------|--------|--------|
| 开发转换引擎 | esbuild | **Oxc Transformer**（Rust） |
| 构建打包器 | Rollup | **Rolldown**（Rust，统一） |
| 依赖预打包 | esbuild | **Rolldown** |
| 配置选项 | `esbuild` | `oxc` |
| 配置选项 | `rollupOptions` | `rolldownOptions` |
| 代码压缩 | esbuild/terser | **Oxc Minifier**（默认） |
| CSS 压缩 | esbuild | **Lightning CSS**（默认） |
| 构建性能 | — | **10-30x 提升** |
| Node 版本 | Node 18+ | **Node 20.19+ / 22.12+** |
| 安装体积 | 较小 | 约 +15MB（Rust 二进制） |

> 参考: https://vite.dev/blog/announcing-vite8
