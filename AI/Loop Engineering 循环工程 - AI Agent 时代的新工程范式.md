# Loop Engineering（循环工程）— AI Agent 时代的新工程范式

> **日期**：2026-06-29
> **来源**：AI 圈 2026 年 6 月热议话题
> **关键人物**：Addy Osmani（Google）、Boris Cherny（Anthropic Claude Code 负责人）、Peter Steinberger（OpenClaw 作者）

---

## 一、核心理念

> **"You shouldn't be prompting coding agents anymore. You should be designing loops that prompt your agents."**
> — Peter Steinberger, 2026.06.07

> **"I don't prompt Claude anymore. I have loops running. They're the ones prompting Claude and figuring out what to do. My job is to write loops."**
> — Boris Cherny, Anthropic Claude Code Lead

**Loop Engineering 的本质**：你不再直接 Prompt AI Agent，而是设计一个**系统**，让这个系统去自动 Prompt Agent。

---

## 二、AI 工程能力演进

```
Prompt Engineering（怎么问 AI）         →   提问者
    ↓
Context Engineering（给 AI 什么信息）    →   信息组织者
    ↓
Harness Engineering（如何组织 AI 能力）  →   系统设计者
    ↓
Loop Engineering（如何让 AI 持续产生结果）→   规则制定者  🔥
```

| 阶段 | 核心思想 | 输入 | 人的角色 | 典型场景 |
|------|---------|------|---------|---------|
| Prompt Engineering | 通过设计提示词获得更好输出 | Prompt/指令 | 提问者 | 聊天、写作、代码生成 |
| Context Engineering | 组织并提供完整背景信息 | 知识库、历史、约束 | 信息组织者 | RAG、AI 搜索、代码助手 |
| Harness Engineering | 连接模型、工具、数据形成工作流 | 上下文 + API + 工具链 | 系统设计者 | Agent、自动化流程 |
| **Loop Engineering** | **构建目标驱动的自主闭环系统** | **目标、状态、记忆、验证** | **规则制定者** | **Claude Code、AI 编程、自动运营** |

---

## 三、一个 Loop 的定义

一个 Loop = 一个微型程序，它执行：

```
1. Prompt Agent     → 向 AI 模型发出指令
2. Read 输出        → 读取 Agent 产生的内容
3. Decide 是否完成   → 判断结果是否满足要求
4. Re-prompt        → 如果未完成，重新发出指令
5. 循环直到完成 → 输出最终结果
```

> **公式：Loop = Cron + 决策器**

---

## 四、Agent Loop 的通用架构（五个阶段）

```
接收输入（Receive）
    ↓
状态评估（Evaluate）—— LLM 分析当前状态，决定下一步
    ↓
工具调用（Execute）—— 执行一个或多个工具
    ↓
结果收集（Collect）—— 将执行结果反馈给 LLM
    ↓
循环或终止 —— 重复直到任务完成
```

---

## 五、六大核心构建块

### 1. 规划器（Planner）
- 将模糊目标拆解为原子任务
- 决定执行顺序和优先级
- 典型实现：Prometheus（战略规划）、思维链（CoT）

### 2. 执行器（Executor）
- 调用工具、操作文件系统、执行命令
- 负责具体的"干活"

### 3. 验证器（Verifier）
- 检查输出是否满足质量标准
- 决定"通过"还是"再来一轮"

### 4. 对抗验证器（Adversarial Verifier）⭐
**这是 Loop Engineering 和普通 multi-agent 编排的核心区别。**
- 不是让一个 Agent 检查另一个 Agent 的输出（那只是 review）
- 而是让专门的 Agent **尝试推翻**已有结论
- 三个独立视角：
  - **Correctness（正确性）**：结果是否正确？
  - **Completeness（完整性）**：结果是否完整？
  - **Robustness（健壮性）**：结果是否健壮？
- 2/3 通过才算通过。**默认拒绝不确定的结果。**

### 5. 终止条件（Stop Condition）
一个可靠的 Loop 必须包含三件事：
- **继续条件**：为什么还要再来一轮
- **退出条件**：什么时候已经足够好，可以结束
- **安全边界**：最大轮次、超时、预算、熔断条件

```
# 反模式：无终止条件
while True:
    result = agent.run(task)

# 正确模式：明确终止条件
max_iterations = 10
for i in range(max_iterations):
    result = agent.run(task)
    if verify(result):
        break
    if i == max_iterations - 1:
        escalate_to_human(result)  # 超限升级
```

### 6. 记忆系统（Memory）
- **短期记忆**：上下文窗口维护当前任务状态
- **长期记忆**：向量数据库实现 RAG（检索增强生成）

---

## 六、演进历史

| 阶段 | 时间 | 核心思想 | 局限性 |
|------|------|---------|--------|
| **ReAct** | 2022 | 推理+行动交替进行（Thought→Action→Observation） | 单步推理，无自主循环 |
| **AutoGPT** | 2023 | 全自主 Agent，设定目标后自动执行 | 容易失控，缺乏有效终止条件 |
| **Ralph Loop** | 2025 | 引入结构化循环验证 | 仍需人工介入验证 |
| **/goal 和 /loop** | 2026 | 声明式目标 + 自动循环 | 需要精心设计目标描述 |
| **多 Agent 编排** | Now | 多个 Agent 协同完成复杂任务 | 编排复杂度指数级增长 |

**核心趋势**：从"人驱动 Agent"到"人设计 Agent 驱动系统"。

---

## 七、Ralph Loop 详解（自引用开发循环）

Ralph Loop 是目前最成熟的单 Agent Loop 实现：

```
工作流：
1. 开始任务
2. 持续迭代（思考 → 行动 → 验证）
3. 完成后输出 <promise>完成声明</promise>
4. 如果未输出承诺 → 自动注入提示继续
5. 最大迭代次数：可配置（默认 100）
```

### Ralph Loop vs. 传统 Prompt 方式

| 维度 | 传统方式 | Ralph Loop |
|------|---------|-----------|
| 交互模式 | 你提问 → AI 回答 → 你再提问 | 你设定目标 → AI 自动迭代直到完成 |
| 验证机制 | 你来检查输出是否正确 | AI 自己验证并修正 |
| 完成标准 | 你觉得"差不多"时停止 | 明确的终止条件 + 退出声明 |
| 人介入的时机 | 每一步都需要 | 只在关键决策点介入 |
| 适用场景 | 简单、单步的任务 | 复杂、多步骤的工程任务 |

---

## 八、Ralph 循环核心循环架构

```
规划 (Plan)
  → 拆分 (Decompose)
    → 执行 (Execute)        ← 多个 Agent 并行
      → 对抗验证 (Adversarial Verify)  ← 独立 Agent 质疑
        → 聚合 (Synthesize)
          → 监控 (Monitor)
            → 反馈 (Feedback)
              → 回到规划
```

---

## 九、在 oh-my-openagent / OpenCode 中的实际应用

### 现有可用的 Loop 能力（检查当前环境）

| 命令/能力 | 说明 |
|-----------|------|
| **`/ralph-loop`** | 启动自引用开发循环，持续工作直到任务完成 |
| **`/ulw-loop`** | Ultrawork 模式，更强的持续执行能力 |
| **Prometheus → Sisyphus 规划执行循环** | Prometheus 出计划 → `.omo/plans/` → `/start-work` → Sisyphus 执行 → 验证 |
| **Background Agents 并行编排** | 多个子智能体同时在后台运行 |
| **TODO 续跑机制** | `.omo/run-continuation/` 跨会话任务跟踪 |

### 实战场景

**场景 1：修复复杂 Bug**
```
/ralph-loop 排查并修复 auth 模块的登录失败问题
```
系统自动：思考 → 排查 → 修复 → 验证 → 未通过继续 → 直到完成

**场景 2：构建新功能**
```
/ulw-loop 创建一个用户管理 CRUD 模块
```

**场景 3：规划驱动开发**
```
你：我想构建 X 功能
我（Prometheus）：访谈需求 → 研究代码库 → 出计划 → 保存到 .omo/plans/
你：/start-work
Sisyphus 执行
```

---

## 十、Loop Engineer 的核心能力

### 设计清晰终止行为的 Loop
- 成功标准：什么算"完成"？
- 错误处理：出了问题怎么恢复？
- 迭代上限：最多循环多少次？

### 构建自验证机制
- Loop 应该能够验证自己的输出
- 在 loop 体中内建验证器和测试用例

```python
def loop_with_verification(agent, task, spec):
    for iteration in range(MAX_ITERATIONS):
        result = agent.run(task)
        if spec.verify(result):
            if spec.run_tests(result):
                return result
        task = refine_task_based_on_feedback(result, spec)
    raise LoopExhausted()
```

### 设置迭代和预算上限
- 计算预算：最大 token 消耗
- 重试次数：最大迭代数
- 时间限制：最长运行时间

---

## 十一、关键认知

1. **Loop Engineering ≠ 多跑几次**。它是"设计一个系统，让 AI 自己持续做"，而不是"反复手动 Prompt"。
2. **对抗验证是核心创新**。普通 review 是"检查是否正确"，对抗验证是"尝试推翻已有结论"。
3. **人从执行者变成设计者**。你不再是在 loop 里面打 Prompt 的人——你是 loop 的作者。
4. **安全边界不可少**。没有清晰终止条件的 loop 会永远运行下去。
5. **Ralph Loop 是实际验证过的模式**。在 oh-my-openagent 生态中已经过大规模验证。

---

## 十二、参考资料

- ReAct 论文：Yao et al., 2022 —《Synergizing Reasoning and Acting in Language Models》
- Claude Agent SDK（前身 Claude Code SDK）— Anthropic, 2025
- OpenAI Agents SDK — OpenAI, 2025-2026
- OpenClaw / Peter Steinberger — GitHub 历史上获星最快的新仓库
- oh-my-openagent (Sisyphus) — OpenCode 的 multi-agent 编排插件
- JavaGuide 图解 AI 工作流 / 菜鸟教程 Loop Engineering 专栏
