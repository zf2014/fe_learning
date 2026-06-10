# Node.js vs Bun vs Deno — 全面对比

## 一、版本与引擎概览

| | **Node.js** | **Bun** | **Deno** |
|---|---|---|---|
| **最新版本** | 25.5.0 (Current) / 22.x (LTS) | 1.3.14 | 2.6.0 |
| **JS 引擎** | V8 14.1 | JavaScriptCore (JSC) | V8 14.2 |
| **底层语言** | C++ | Zig | Rust |
| **创建者** | Ryan Dahl (2009) | Jarred Sumner (2022) | Ryan Dahl (2018) |
| **内置 TS** | 实验性 (`--experimental-strip-types`) | 原生（转译，不检查） | 原生（含类型检查） |

---

## 二、性能对比

| 指标 | Node.js 22 | Bun 1.3 | Deno 2.6 |
|---|---|---|---|
| **HTTP 吞吐** | ~142K req/s | ~312K req/s | ~178K req/s |
| **冷启动** | 35ms / TS: 280ms | 12ms / TS: 14ms | 22ms / TS: 25ms |
| **内存占用** | 68MB | 38MB | 52MB |
| **文件 I/O** | ~2,100 MB/s | ~4,200 MB/s | ~1,850 MB/s |
| **包安装速度** | npm: 45s / pnpm: 28s | 8s | URL 导入（无需安装） |
| **JSON 序列化** | 15.7ms | 9.4ms | 14.9ms |
| **CPU 密集型** | 2.34s (10M 素数) | 2.89s | 2.31s |

---

## 三、Node.js — 优缺点

### ✅ 优点

1. **生态无可匹敌** — npm 200万+ 包，100% 兼容，企业级验证
2. **生产稳定性最强** — 16年历史，经过最极端规模验证（Netflix、PayPal、LinkedIn）
3. **原生模块完美支持** — N-API、node-gyp 完整支持，C++ addon 生态成熟
4. **LTS 长期支持** — 偶数版本 30 个月维护周期，企业放心用
5. **社区与文档** — StackOverflow 答案最丰富，招聘池最大
6. **v25 新特性** — 权限模型 `--allow-net`、Web Storage、SEA 单文件编译、内置 SQLite
7. **工具链成熟** — 调试、性能分析、APM 监控工具链完善

### ❌ 缺点

1. **性能落后** — HTTP 吞吐约为 Bun 的 1/2，冷启动慢 3-10x
2. **TypeScript 支持弱** — 仍需外部工具（tsx/tsc），非原生
3. **内置工具少** — 没有内置格式化、lint、打包、测试需要第三方配置
4. **安全模型后补** — 权限模型是 v20+ 才加的实验特性，不是默认行为
5. **包管理慢** — npm install 显著慢于 bun install
6. **API 历史包袱重** — 大量遗留 API（callback 风格），stream 用法复杂

---

## 四、Bun — 优缺点

### ✅ 优点

1. **极致性能** — HTTP 吞吐 2.2x Node.js，冷启动最快（12ms），内存最低
2. **全能工具链** — 单二进制包含：运行时 + 包管理器 + 打包器 + 测试运行器 + 开发服务器
3. **内置数据库客户端** — `Bun.SQL` 统一 API 支持 PostgreSQL / MySQL / SQLite，零依赖
4. **内置 Redis 客户端** — 比 ioredis 快数倍
5. **内置图像处理** — `Bun.Image` 替代 sharp，JPEG/PNG/WebP/HEIC/AVIF
6. **包管理极快** — `bun install` 比 npm 快 10-30x，支持 workspace、catalog
7. **Node.js 兼容度高** — ~93-98% 的 top 1000 npm 包可用，Express/Hono 等框架可直接运行
8. **HTTP/3 支持** — `Bun.serve` 内置 QUIC，509K req/s
9. **前端开发服务器** — HTML 导入、HMR 热更新、全栈开发一体化
10. **文件 I/O 最快** — Linux 上 io_uring 集成，2x Node.js

### ❌ 缺点

1. **稳定性尚待验证** — 年轻项目（2022年起步），生产环境偶现边缘 bug
2. **原生模块兼容不完整** — N-API 部分实现，复杂 native addon 可能出问题
3. **Windows 支持有限** — 部分功能 POSIX only（如 PTY）
4. **TypeScript 仅转译不检查** — 不做类型检查，需要 tsc 单独跑
5. **社区/文档较弱** — 文档覆盖不如 Node.js/Deno，遇到问题排查资料少
6. **Zig 语言小众** — 底层用 Zig 编写，贡献者门槛高
7. **破坏性变更风险** — 快速迭代中 API 可能在 minor 版本间变化

---

## 五、Deno — 优缺点

### ✅ 优点

1. **安全模型最先进** — 默认零权限，细粒度控制（文件/网络/环境变量），`--ignore-read`/`--ignore-env` 灵活降级
2. **TypeScript 原生最佳** — 内置完整类型检查，tsgo（Go 实现）2x 更快
3. **Web 标准 API** — 优先遵循浏览器标准（fetch、WebSocket、Streams、URLPattern）
4. **内置工具链完整** — `deno fmt` / `deno lint` / `deno test` / `deno bench` / `deno compile` / `deno audit`，零配置开箱即用
5. **安全审计** — `deno audit` 扫描 npm/JSR 依赖漏洞，集成 Socket.dev
6. **npm 兼容成熟** — Deno 2.x 支持 `npm:` 导入，~95% top 包可用
7. **JSR 包注册表** — 原生 TypeScript 注册表，去中心化、安全优先
8. **权限模型灵活** — Permission Sets 配置文件化，CI/CD 友好
9. **单文件部署** — `deno compile` 打包为独立可执行文件
10. **代码质量高** — Rust 底层，内存安全，无 buffer overflow 风险

### ❌ 缺点

1. **性能不及 Bun** — HTTP 吞吐约为 Bun 的 57%，冷启动慢于 Bun
2. **生态仍有缺口** — 5% 的 top npm 包不完全兼容，复杂项目可能踩坑
3. **node_modules 可选但尴尬** — 默认无 node_modules，但 npm 包兼容又依赖它
4. **配置范式转换成本** — 从 Node.js 迁移需学习 `deno.json`、`npm:` 导入等新概念
5. **原生模块支持弱** — FFI 有但不如 N-API 成熟
6. **企业采用率低** — 生产部署案例少，APM/监控集成不完善
7. **包安装体验不一** — URL 导入方便但版本管理不如 package.json 成熟
8. **部分 API 不稳定** — `--unstable-*` flag 下的功能可能变更

---

## 六、选型建议速查

| 场景 | 推荐 | 理由 |
|---|---|---|
| **企业级生产项目** | Node.js (LTS) | 稳定性 + 生态 + LTS 保障 |
| **高性能 API / 微服务** | Bun | 吞吐量最大，内存最低 |
| **安全敏感应用** | Deno | 默认零权限 + 安全审计 |
| **全新项目（性能优先）** | Bun | 全栈工具链 + 极速 DX |
| **全新项目（安全优先）** | Deno | TypeScript 原生 + 权限模型 |
| **CLI 工具 / 脚本** | Bun | 冷启动快，单文件编译 |
| **边缘计算 / Serverless** | Deno / Bun | 冷启动优势明显 |
| **嵌入式数据库项目** | Bun | `bun:sqlite` 最快最成熟 |
| **大型遗留 Node.js 项目** | Node.js | 迁移成本太高，不值得 |
| **教学 / 原型验证** | Deno | 零配置，内置一切 |

---

## 七、总结

**Node.js 赢在生态和稳定，Bun 赢在性能和 DX，Deno 赢在安全和标准。**

2025-2026 年的最佳策略是**按场景选运行时**，而非死守一个。

> 数据来源：各运行时官方博客、GitHub Releases、社区基准测试（2025-2026年）
