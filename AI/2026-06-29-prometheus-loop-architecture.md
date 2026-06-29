# Prometheus Loop Architecture — AI Agent 时代的目标驱动自主循环

> **日期**：2026-06-29
> **状态**：设计文档（v1.0）
> **关联文档**：[Loop Engineering 循环工程](./Loop%20Engineering%20循环工程%20-%20AI%20Agent%20时代的新工程范式.md)
> **核心思想**：> "You shouldn't be prompting coding agents anymore. You should be designing loops that prompt your agents." — Peter Steinberger

---

## 目录

1. [概述](#1-概述)
2. [系统架构](#2-系统架构)
3. [Goal Registry — 目标注册表](#3-goal-registry--目标注册表)
4. [自动衔接 — Planner → Executor](#4-自动衔接--planner--executor)
5. [失败回退决策树 — Router](#5-失败回退决策树--router)
6. [Loop 状态机与终止条件](#6-loop-状态机与终止条件)
7. [实现路线图](#7-实现路线图)
8. [与现有能力的对比](#8-与现有能力的对比)

---

## 1. 概述

### 1.1 问题

当前 Prometheus → Sisyphus 工作流存在一个人为断点：

```
用户设定目标 → Prometheus 出计划 → ✋ 手动 /start-work → Sisyphus 执行 → Momus 验证
                                                                    ↓ 失败
                                                                  卡住，无人处理
```

用户需要从**操作员**角色转变为**目标设定者**角色——不再手动触发每一步，而是设计一个系统让 AI 自主循环工作。

### 1.2 目标

构建一个**长期目标驱动的自主循环系统**，具备以下能力：

1. **目标持久化**：宏观目标和子目标状态跨 session 保存
2. **自动衔接**：Plan 完成后自动触发执行，无需人工介入
3. **智能回退**：验证失败时自动决定重试、重新规划或升级给人
4. **安全终止**：明确的停止条件，防止无限循环

### 1.3 设计原则

- **复用现有基础设施**：基于 `.omo/` 目录和已有的 TODO 续跑机制，不引入新数据库
- **渐进复杂**：从基础能力开始，逐层叠加，不一步到位
- **可观测**：所有状态变更都记录，用户随时可以查看进度
- **安全优先**：熔断、超时、预算上限等安全边界是第一级需求

---

## 2. 系统架构

### 2.1 架构总图

```
                         👤 用户设定宏观目标
                                │
                                ▼
┌──────────────────────────────────────────────────────────┐
│                   Prometheus Loop 运行时                    │
│                                                          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │  Goal    │   │ Planner  │   │ Executor │            │
│  │ Registry │──▶│(Prometh.)│──▶│(Sisyphus)│            │
│  │ (存储)   │   │ (规划)   │   │ (执行)   │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│       ▲              ▲              │                    │
│       │              │              ▼                    │
│       │         ┌──────────┐   ┌──────────┐            │
│       │         │  Router  │◀──│ Verifier │            │
│       │         │ (决策)   │   │ (Momus)  │            │
│       │         └──────────┘   └──────────┘            │
│       │              │                                  │
│       └──────────────┴──────┬───────────┘               │
│                             │                           │
│                     ┌───────┴───────┐                   │
│                     │   Memory      │                   │
│                     │（跨session存储）│                   │
│                     └───────────────┘                   │
└──────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ✅ 全部完成    ⚠️ 升级给人    ⛔ 强制终止
```

### 2.2 六大组件

| 组件 | 角色 | 对应现有系统 | 核心职责 |
|------|------|-------------|---------|
| **Goal Registry** | 持久化存储 | `.omo/goals/` (新增) | 存储宏观目标、子目标进度、跨 session 状态 |
| **Planner** | 战略规划 | Prometheus | 将目标分解为 Plan，输出 `.omo/plans/` |
| **Executor** | 执行者 | Sisyphus (`/start-work`) | 执行 Plan，调用工具完成任务 |
| **Verifier** | 验证者 | Momus | 执行 QA、对抗验证，输出 Verdict |
| **Router** | 决策者 | (新增逻辑) | 根据 Verdict 决策：通过/重试/重新规划/升级 |
| **Memory** | 记忆系统 | `.omo/run-continuation/` | 跨 session 信息持久化，上下文维护 |

### 2.3 核心数据流

```
① 目标 → Goal Registry（注册）
② → Planner（分解为 Plan）
③ → Executor（执行 Plan）
④ → Verifier（验证结果）
⑤ → Router（决策）
     ├─ ✅ 通过 → 取下一个子目标 → ②
     ├─ 🔄 重试 → ③（纯重试，不重新规划）
     ├─ 🧠 重新规划 → ②（将反馈传给 Planner）
     ├─ ⚠️ 升级 → 等待人介入
     └─ 🏁 全部完成 → 输出完成声明
```

---

## 3. Goal Registry — 目标注册表

### 3.1 存储结构

```
.omo/
├── goals/
│   ├── active/              ← 当前进行中的目标
│   │   ├── 001-blog-system.json
│   │   └── 002-auth-module.json
│   ├── completed/           ← 已完成的目标（归档）
│   │   └── 000-init-setup.json
│   └── index.json           ← 所有目标的索引
├── plans/                   ← Prometheus 输出的计划（已有）
└── run-continuation/        ← 续跑机制（已有）
```

### 3.2 Goal Schema

```json
{
  "goalId": "001-blog-system",
  "title": "实现博客系统",
  "description": "文章 CRUD + 评论 + 标签",
  "status": "in_progress",
  "createdAt": "2026-06-29T10:00:00Z",
  "completedAt": null,

  "successCriteria": [
    "文章可以创建、编辑、删除",
    "评论功能正常工作",
    "标签支持筛选"
  ],

  "subgoals": [
    {
      "id": "sg-001",
      "title": "数据层 (Schema + ORM)",
      "status": "completed",
      "planRef": ".omo/plans/blog-db-layer.md"
    },
    {
      "id": "sg-002",
      "title": "API 层 (CRUD 接口)",
      "status": "in_progress",
      "planRef": ".omo/plans/blog-api-layer.md",
      "attempts": 2,
      "lastResult": "verifier_rejected",
      "lastError": "POST /articles 缺少鉴权",
      "blockedBy": []
    },
    {
      "id": "sg-003",
      "title": "评论 + 标签模块",
      "status": "pending",
      "blockedBy": ["sg-002"]
    }
  ],

  "config": {
    "maxAttemptsPerSubgoal": 5,
    "maxTotalFailures": 20,
    "maxExecutionTimeMin": 120
  },

  "currentSubgoalIndex": 1,
  "loopContext": {
    "sessionCount": 3,
    "lastActiveAt": "2026-06-29T15:30:00Z",
    "continuationToken": "ses_xxx"
  }
}
```

### 3.3 子目标状态机

```
pending ──→ in_progress ──→ completed
                │
                ├──→ failed ──→ (重试) ──→ in_progress
                │       │
                │       └──→ (超限) ──→ escalated
                │
                └──→ blocked (依赖未就绪)
```

### 3.4 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 存储介质 | 文件系统 (JSON) | 复用 `.omo/` 目录，可 git 追踪，无需数据库 |
| 子目标状态 | 每个独立 + blockedBy | 支持依赖链，Router 可排序执行 |
| 重试上限 | 每个子目标独立 | 避免单个卡死影响全局 |
| 跨 session | loopContext + continuationToken | 复用已有的 TODO 续跑机制 |

---

## 4. 自动衔接 — Planner → Executor

### 4.1 三阶段执行模式

```
Phase 1: Prometheus 规划阶段
  └─ 访谈 → 研究 → Metis 审查 → 出 Plan → Momus 验证
  └─ 输出: .omo/plans/{name}.md
        │
        ▼
Phase 2: 自动注册到 Goal Registry
  └─ 创建/更新子目标记录
  └─ 字段: id, planRef, status="ready", maxAttempts
        │
        ▼
Phase 3: 自动触发执行
  └─ 读取 .omo/goals/active/{id}.json
  └─ 解析 planRef → 获取 Plan 文件路径
  └─ 自动调用 /start-work {plan-name}
```

### 4.2 Continuation Hook

在每个 Plan 的"最终验证波"（Final Verification Wave）完成后，自动检查 Goal Registry：

```
Plan 最后一步执行完毕
  → 检查是否有下一个子目标？
    ├─ 有 → 回到 Phase 1（Planner 规划下一个子目标）
    └─ 无 → 标记 Goal 为 completed → 输出完成声明
```

### 4.3 用户视角变化

| 场景 | 之前 | 之后 |
|------|------|------|
| 设置目标 | 手动分解任务 | 设定一个长期目标 |
| 规划阶段 | 等你确认 Plan | Momus 自动审查 |
| 执行阶段 | 手动 `/start-work` | 自动开始执行 |
| 多步骤 | 逐个手动触发 | 自动推进到下一子目标 |
| **你的角色** | **操作员** | **目标设定者** |

---

## 5. 失败回退决策树 — Router

### 5.1 决策流程

```
Momus 验证结果
      │
      ▼
┌─────────────────────────────┐
│  Router 分析失败原因         │
│  (解析 Momus Verdict)       │
└─────────────────────────────┘
      │
      ├── EXECUTION_ERROR ──────→ 🔄 重试执行
      │    (工具调用失败、超时)
      │
      ├── PLAN_ISSUE ───────────→ 🧠 重新规划
      │    (方案不完备、设计不合理)
      │
      ├── REQUIREMENT_CHANGE ───→ ⚠️ 升级给人
      │    (需求不明确、矛盾)
      │
      ├── QUALITY_FAIL ─────────→ 🔄 重试2次 → 🧠 重新规划
      │    (代码质量、测试覆盖)
      │
      └── ADVERSE ──────────────→ 🧠 必须重新规划
           (对抗验证推翻核心结论)
```

### 5.2 决策算法

```
function router(verdict, subgoal):
  // 1. 超限检查
  if subgoal.attempts >= subgoal.maxAttempts:
    escalate_to_human(subgoal, "超过最大重试次数")
    return

  // 2. 失败分类
  switch classify_failure(verdict):
    case EXECUTION_ERROR:
      retry_execution(subgoal)              // 纯重试
    case PLAN_ISSUE:
      replan_subgoal(subgoal, feedback)     // 重新规划
    case REQUIREMENT_CHANGE:
      escalate_to_human(subgoal, msg)       // 升级
    case QUALITY_FAIL:
      if attempts < 2:
        retry_execution(subgoal, feedback)  // 前2次重试
      else:
        replan_subgoal(subgoal, feedback)   // 之后重新规划
    case ADVERSE:
      replan_subgoal(subgoal, feedback)     // 必须重新规划

  // 3. 更新尝试次数
  subgoal.attempts += 1
```

### 5.3 VerdictParser — 适配层设计

**架构决策**：Verdict 解析必须通过 `VerdictParser` 接口封装，不允许在 Router 逻辑中直接字符串匹配 Momus 输出。

```python
# 接口定义
interface VerdictParser:
  def parse(raw_verdict: str) -> ParsedVerdict:
    """解析 Momus Verdict，返回结构化结果"""
    # fields: failure_type, details, severity, is_pass

# 当前版本的实现
class MomusV1Parser(VerdictParser):
  def parse(self, raw: str) -> ParsedVerdict:
    # 解析当前 Momus 输出格式
    if "REJECT" in raw:
      return ParsedVerdict(...)

# 未来 Momus 输出格式变更时
# class MomusV2Parser(VerdictParser):
#   def parse(self, raw: str) -> ParsedVerdict: ...
#
# 切换：替换 parser = MomusV2Parser()
```

**好处**：
- 未来的 Momus 输出格式变化 → 只需新增一个 Parser 实现，Router 逻辑不变
- 测试时可以注入 Mock Parser 验证 Router 决策逻辑
- 设计成本为零（这是正常的接口抽象，不是过度设计）

### 5.4 失败分类判定依据

| 类型 | Momus 输出中的信号 | 处置 |
|------|-------------------|------|
| EXECUTION_ERROR | 工具调用失败、进程退出非零、超时 | 🔄 重试 |
| PLAN_ISSUE | 「方案不完备」「依赖缺失」「设计不合理」 | 🧠 重新规划 |
| REQUIREMENT_CHANGE | 「需求不明确」「用户未确认」「矛盾目标」 | ⚠️ 升级给人 |
| QUALITY_FAIL | 「代码重复」「缺少测试」「性能不达标」 | 🔄 2次后 🧠 |
| ADVERSE | 对抗验证器推翻核心结论 | 🧠 重新规划 |

### 5.5 安全边界

| 边界 | 阈值 | 行为 |
|------|------|------|
| 全局熔断 | 累计 20 次失败 | 自动暂停，通知用户审查 |
| 子目标重试上限 | 每个子目标 5 次 | 超过后升级给人 |
| 超时保护 | 单次执行 30 分钟 | 强制中断，标记 EXECUTION_ERROR |
| 总执行时间 | 2 小时（可配置） | Loop 强制终止 |
| 用户 STOP | 手动信号 | 立即终止 Loop |

---

## 6. Loop 状态机与终止条件

### 6.1 状态转换图

```
                ┌──────────────────────────────────────┐
                │                                      │
    ┌─── IDLE ◄─┼─── 所有完成                          │
    │    │      │                                      │
    │    ▼      │                                      │
    │ PLANNING ─┼─── 下一子目标                        │
    │    │      │                                      │
    │    ▼      │                                      │
    │ EXECUTING │                                      │
    │    │      │                                      │
    │    ▼      │                                      │
    │ VERIFYING │                                      │
    │    │      │                                      │
    │    ▼      │                                      │
    │ ROUTING ──┘                                      │
    │    │                                              │
    │    ├── 通过且有下一子目标 ────→ PLANNING         │
    │    ├── 重试 ──────────────────→ EXECUTING         │
    │    ├── 重新规划 ──────────────→ PLANNING         │
    │    ├── 升级给人 ──────────────→ ESCALATED        │
    │    └── 全部完成 ──────────────→ COMPLETED        │
    │                                                  │
    └── 任意状态 ── 安全边界触发 ──→ TERMINATED        │
                                                      │
    ESCALATED ── 用户决策后 ──→ PLANNING              │
    COMPLETED ── 输出完成声明                           │
    TERMINATED ── 输出终止报告                          │
```

### 6.2 状态定义

| 状态 | 含义 | 进入条件 | 退出条件 |
|------|------|---------|---------|
| **IDLE** | 空闲，等待目标 | 启动/完成/重置 | 用户设定目标 |
| **PLANNING** | 规划中 | 新目标或重新规划 | Plan 就绪 |
| **EXECUTING** | 执行中 | Plan 就绪或重试 | 执行完成 |
| **VERIFYING** | 验证中 | 执行完成 | Verdict 产出 |
| **ROUTING** | 决策中 | Verdict 产出 | 决策完成 |
| **ESCALATED** | 等待人工 | 升级给人 | 用户决策 |
| **COMPLETED** | 全部完成 | 所有子目标完成 | —（终态）|
| **TERMINATED** | 强制终止 | 安全边界触发 | —（终态）|

### 6.3 三层终止条件

参照 [Loop Engineering 文章](./Loop%20Engineering%20循环工程%20-%20AI%20Agent%20时代的新工程范式.md) 的要求：

#### ① 正常终止（✅）
- **条件**：Goal Registry 中所有子目标状态为 `completed`
- **行为**：输出完成声明，进入 COMPLETED 状态
- **通知**：向用户报告完成情况和执行摘要

#### ② 暂停（⏸️）
- **条件**：子目标升级给人（escalated）
- **行为**：Loop 暂停，等待用户决策
- **恢复**：用户决策后从 PLANNING 状态继续

#### ③ 强制终止（⛔）
- **条件**：熔断（20次失败）、超时（2小时）、超预算、用户 STOP
- **行为**：立即终止 Loop，输出终止报告
- **报告内容**：已完成的子目标、失败的子目标、失败原因统计

### 6.4 与六大核心构建块的对应

| 构建块 | Prometheus Loop 中的实现 |
|--------|------------------------|
| 1️⃣ 规划器 (Planner) | **Prometheus** — 战略规划、目标分解 |
| 2️⃣ 执行器 (Executor) | **Sisyphus** — Plan 执行、工具调用 |
| 3️⃣ 验证器 (Verifier) | **Momus** — QA 执行、结果验证 |
| 4️⃣ 对抗验证器 (Adversarial) | **Momus 对抗模式** — 尝试推翻结论 |
| 5️⃣ 终止条件 (Stop Condition) | **三层停止条件** — 正常/暂停/强制终止 |
| 6️⃣ 记忆系统 (Memory) | **Goal Registry + 续跑机制** — 跨 session 持久化 |

---

## 7. 实现路线图

### Phase 1：Goal Registry（基础数据层）

**目标**：先搭建目标注册表，不涉及 Loop 自动运行

- [ ] 定义 `.omo/goals/` 目录结构和 Goal Schema
- [ ] 实现 `index.json` 索引管理
- [ ] 实现子目标 CRUD（创建、更新状态、查询）
- [ ] 实现子目标依赖链解析（topological sort）
- [ ] 集成现有的 `.omo/run-continuation/` 续跑机制

### Phase 2：自动衔接（Planner → Executor 打通）

**目标**：打通从"出计划"到"自动执行"的链路

- [ ] 在 Plan 生成的 TODO 中增加 continuation hook
- [ ] Prometheus 完成 Plan 后自动注册到 Goal Registry
- [ ] 实现 Plan 完成后自动检查下一子目标
- [ ] 处理 Plan 执行完成后的自动过渡逻辑
- [ ] 可选：支持 `/prometheus-loop {goal-description}` 一键启动

### Phase 3：Router + 失败回退

**目标**：实现智能决策闭环

- [ ] 实现 Router 组件：解析 Momus Verdict
- [ ] 实现失败分类器（classify_failure）
- [ ] 实现重试逻辑（retry_execution）
- [ ] 实现重新规划逻辑（replan_subgoal）
- [ ] 实现升级给人机制（escalate_to_human）
- [ ] 实现熔断和超时保护

### Phase 4：完整 Loop 运行时

**目标**：长期目标驱动的自主循环

- [ ] 实现 Loop 状态机（IDLE → PLANNING → EXECUTING → ...）
- [ ] 实现跨 session 状态恢复
- [ ] 实现完成声明输出
- [ ] 实现终止报告
- [ ] 实现用户 STOP 信号处理

---

## 8. 与现有能力的对比

| 能力 | 现有实现 | Prometheus Loop |
|------|---------|----------------|
| **Ralph Loop** | 单 Agent 持续迭代，无战略规划 | ✅ 多层架构，有 Prometheus 规划层 |
| **/ulw-loop** | 更强的持续执行，但仍是单 loop | ✅ 多目标编排 + 依赖管理 |
| **Prometheus → Sisyphus** | 有人工断点，需手动触发 | ✅ 全自动衔接 + 失败回退 |
| **Momus 对抗验证** | 需要手动调用 | ✅ 集成到 Loop 自动触发 |
| **TODO 续跑** | 跨 session 跟踪，但无目标管理 | ✅ 目标级跨 session 续跑 |

---

## 附录 A：与 Loop Engineering 文章的关键概念对应

| 文章概念 | 本文实现 |
|---------|---------|
| 公式：Loop = Cron + 决策器 | Goal Registry 轮询 + Router 决策树 |
| 五阶段架构 | Receive(Goal) → Evaluate(Planner) → Execute(Sisyphus) → Collect(Verifier) → Loop(Router) |
| 对抗验证 | Momus 对抗模式，2/3 通过 |
| 安全边界 | 熔断、超时、预算上限 |
| 短期记忆 | Session 内上下文 |
| 长期记忆 | `.omo/goals/` + `.omo/run-continuation/` |
| "人从执行者变成设计者" | 用户设定目标 → Loop 自动运行 |

---

## 附录 B：术语表

| 术语 | 定义 |
|------|------|
| **Goal** | 用户设定的宏观目标，包含多个子目标 |
| **Subgoal** | Goal 的分解单元，对应一个 Prometheus Plan |
| **Plan** | Prometheus 输出的任务清单，存储在 `.omo/plans/` |
| **Verdict** | Momus 验证后输出的结论（通过/拒绝+原因） |
| **Router** | 根据 Verdict 决策下一步行动的组件 |
| **Loop** | Prometheus → Sisyphus → Momus → Router 的完整循环 |
| **Continuation** | 跨 session 的状态续跑机制 |
| **Escalation** | 将问题升级给人处理 |
| **Adversarial** | 对抗验证，尝试推翻已有结论 |
