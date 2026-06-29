---
name: prometheus-loop
description: Use when setting multi-step goals, running complex projects, or enabling autonomous AI-driven development that requires iterative plan-execute-verify cycles.
---

# Prometheus Loop Skill

## Overview

The **Prometheus Loop** is a self-driving system that takes a high-level goal and autonomously cycles through planning, execution, verification, and decision-making until the goal is completed.

**Core principle**: You don't prompt agents anymore — you design loops that prompt your agents.

**Flow**:
```
User: "/prometheus-loop 实现博客系统，CRUD+评论+标签"
→ Loop: Parse Goal → Plan → Review → Execute → Verify → Route →
  Loop back to Plan until all subgoals done → Complete
```

**Required agents** (all built-in):
- Prometheus — strategic planning
- Sisyphus (`/start-work`) — plan execution
- Momus — adversarial verification

---

## Trigger Patterns

Use this skill when you need to:
- Set a long-term goal and let the system autonomously execute it
- Run a complex multi-step project without manual step-by-step prompting
- Decompose a large task into subgoals with dependency chains
- Resume a partially completed goal from a previous session
- Verify and iterate on execution results autonomously

**Trigger format**: `/prometheus-loop {goal description}` or `启动 Prometheus Loop: {goal description}`

### When NOT to Use

- **Simple single-step tasks** — use a regular `/writing-plans` workflow instead. The Loop's overhead (parse → plan → review → execute → verify → route) is wasteful for tasks that fit one plan.
- **Exploratory or research work** — use `/brainstorming` or `/grill-me` first. The Loop requires a defined goal; ambiguous objectives will cause repeated REQUIREMENT_CHANGE escalations.
- **Operational one-offs** (config change, single deploy, quick fix) — no need for the iterative loop. Just execute directly.
- **Pull request review / integration verification** — use `/review-work` instead. The Loop is designed for building, not reviewing.
- **User wants manual checkpoints** — the Loop is autonomous by design. If you need to approve every stage, you're fighting the architecture.

---

## The 7-Stage Loop Flow

### Stage 1: Parse Goal

**What happens**: Extract the goal description from the user's input and create a Goal Registry entry.

**Steps**:
1. Parse the user's goal description (title, optional details)
2. Call `goals:init` (see [`commands.md`](./commands.md)) to create a new goal in `.omo/goals/active/{goalId}.json`
3. If the user mentioned sub-steps, add them via `goals:add-subgoal`
4. If sub-steps have dependencies, set up `blockedBy` chains
5. Report: goal registered with N subgoals

**Example**:
```
User: "/prometheus-loop 实现博客系统，需要数据层、API 层、前端页面"
→ goals:init "实现博客系统" "数据层 + API 层 + 前端页面"
→ goals:add-subgoal blog-system "数据层" ""
→ goals:add-subgoal blog-system "API 层" ""
→ goals:add-subgoal blog-system "前端页面" ""
→ goals:update-subgoal blog-system sg-002 blockedBy '["sg-001"]'
→ goals:update-subgoal blog-system sg-003 blockedBy '["sg-002"]'
```

---

### Stage 2: Planning Phase

**What happens**: Prometheus creates a detailed Plan for the current subgoal.

**Steps**:
1. Read the current subgoal via `goals:next {goalId}`
2. If no subgoal is ready, report: goal is blocked or complete
3. Present the subgoal to Prometheus for planning
4. Prometheus produces a Plan → saved to `.omo/plans/{subgoalId}.md`
5. Update subgoal via `goals:update-subgoal {goalId} {subgoalId} planRef ".omo/plans/{subgoalId}.md"`

---

### Stage 3: Momus Review

**What happens**: Momus adversarially reviews the Plan before execution.

**Steps**:
1. Load the Plan file from `.omo/plans/{subgoalId}.md`
2. Call Momus to review the Plan:
   - Is the plan complete and correct?
   - Are acceptance criteria concrete?
   - Are QA scenarios agent-executable?
3. If Momus **accepts** → proceed to Stage 4
4. If Momus **rejects** → capture the Verdict, proceed to Stage 6 (Router) with PLAN_ISSUE type

**Important**: The Plan must NOT be executed before Momus review. The review is a safety gate.

---

### Stage 4: Auto-Execute

**What happens**: Execute the Plan automatically — NO manual `/start-work` needed.

**Steps**:
1. Update subgoal status to `in_progress`
2. Trigger execution by passing the Plan to the executor
3. The executor reads `.omo/plans/{subgoalId}.md` and executes each task
4. Each task produces QA evidence in `.omo/evidence/task-{N}-{scenario}.txt`
5. After ALL tasks complete, capture the execution summary

**Continuation Hook (CRITICAL)**:
After the Plan finishes execution:
```
1. Update subgoal status to "completed" (if successful)
2. Update subgoal lastResult with execution summary
3. Read Goal Registry → check for next pending subgoal
4. If next subgoal exists → LOOP BACK TO Stage 2
5. If no more subgoals → proceed to Stage 7
```

The key insight: the system does NOT wait for the user. It automatically checks the Goal Registry and continues to the next subgoal.

---

### Stage 5: Verify Result

**What happens**: Momus verifies the execution output.

**Steps**:
1. Collect evidence from execution (`.omo/evidence/` files)
2. Present the results to Momus for verification
3. Momus checks:
   - Were all tasks completed?
   - Do acceptance criteria pass?
   - Is the output correct and robust?
4. Momus outputs a **Verdict**: PASS or REJECT (with failure type)

**Verdict output format** (subject to change — parsed via VerdictParser):
```
Verdict: PASS/REJECT
Type: EXECUTION_ERROR | PLAN_ISSUE | QUALITY_FAIL | REQUIREMENT_CHANGE | ADVERSE
Details: <description of what failed and why>
File: <specific file references if applicable>
```

---

### Stage 6: Route (Router Decision)

**What happens**: The Router analyzes the Verdict and decides what to do next.

**Input**: Momus Verdict + current subgoal state
**Output**: Decision (continue, retry, replan, escalate)

**VerdictParser** — Parse Momus output through a structured adapter (not hardcoded string matching):
```
VerdictParser interface:
  input: raw string (Momus output)
  output: { verdict: PASS|REJECT, type: failure_type, details: string }
  
Implementation: Read Momus output, extract structured fields.
If format changes in the future, only the parser needs to change — the Router logic stays the same.
```

**Five failure types and their dispositions**:

| Type | Meaning | Disposition |
|------|---------|-------------|
| `EXECUTION_ERROR` | Tool call failed, timeout, network error | **Retry** — replay execution |
| `PLAN_ISSUE` | Plan design is wrong, missing requirements | **Replan** — go back to Stage 2 with feedback |
| `QUALITY_FAIL` | Code quality issues, missing tests | **Retry 2x** then **Replan** |
| `REQUIREMENT_CHANGE` | Requirements unclear, contradictory | **Escalate** — notify user |
| `ADVERSE` | Adversarial verifier overturns core conclusion | **Replan** — must redesign |

**Decision Algorithm**:
```
function route(parsedVerdict, subgoal):
  if parsedVerdict.verdict == PASS:
    mark subgoal as completed
    return CONTINUE_TO_NEXT_SUBGOAL

  // Check attempt limit
  if subgoal.attempts >= subgoal.maxAttempts:
    mark subgoal as escalated
    return ESCALATE_TO_HUMAN("超过最大重试次数")

  // Classify and dispatch
  switch parsedVerdict.type:
    case EXECUTION_ERROR:
      increment attempts
      return RETRY_EXECUTION

    case PLAN_ISSUE:
      increment attempts
      return REPLAN(parsedVerdict.details)

    case QUALITY_FAIL:
      increment attempts
      if attempts < 2:
        return RETRY_EXECUTION(parsedVerdict.details)
      else:
        return REPLAN(parsedVerdict.details)

    case REQUIREMENT_CHANGE:
      increment attempts
      return ESCALATE_TO_HUMAN(parsedVerdict.details)

    case ADVERSE:
      increment attempts
      return REPLAN(parsedVerdict.details)

    default:
      return ESCALATE_TO_HUMAN("未知失败类型: " + parsedVerdict.type)
```

**Escalation Procedure**:
When escalation is needed:
1. Set subgoal status to `escalated`
2. Set subgoal `lastResult` and `lastError` with the details
3. Inform the user with:
   - What escalated (goal + subgoal)
   - Why (failure type + details)
   - Suggested action (clarify requirement, approve bypass, etc.)
4. Wait for user input before continuing
5. After user decision → update subgoal, resume from Stage 2

**Attempt tracking**: Each execution/retry increments `subgoal.attempts`. The `maxAttemptsPerSubgoal` from Goal Registry config limits total attempts before forced escalation.

---

### Stage 7: Complete

**What happens**: All subgoals are done — output completion declaration.

**Steps**:
1. Call `goals:archive {goalId}` to move to completed
2. Generate a **completion report** including:
   - Goal title and description
   - Total subgoals and how many attempts each took
   - Any escalations that occurred
   - Execution timeline
3. Output: `<promise>Goal "{title}" completed: {completed}/{total} subgoals done</promise>`
4. Present the report to the user

---

## Loop State Machine

The Prometheus Loop transitions through these states:

```
IDLE
  │  User sets a goal
  ▼
PLANNING ──────────────────────┐
  │  Plan ready                │ (replan route)
  ▼                            │
EXECUTING ─────────────────────┘
  │  Execution done
  ▼
VERIFYING
  │  Momus Verdict produced
  ▼
ROUTING ──────────────────────────────────────┐
  │  │     │       │         │               │
  │  ✅    🔄    🧠      ⚠️               │
  │  Pass  Retry  Replan  Escalate          │
  │         │      │        │               │
  │         ▼      └──►PLANNING             │
  │      EXECUTING          │               │
  │                         ▼               │
  │  Next subgoal → PLANNING                │
  │  All done → COMPLETED                   │
  │  Safety triggered → TERMINATED          │
  │                                         │
  └─────────────────────────────────────────┘
```

### State Definitions

| State | Meaning | Entry | Exit |
|-------|---------|-------|------|
| **IDLE** | Waiting for a goal | Start/reset | User sets goal |
| **PLANNING** | Prometheus is creating a Plan | New goal or replan | Plan saved |
| **EXECUTING** | Sisyphus executing Plan | Plan ready or retry | Execution done |
| **VERIFYING** | Momus verifying result | Execution done | Verdict produced |
| **ROUTING** | Router deciding next action | Verdict produced | Decision made |
| **ESCALATED** | Waiting for human input | Escalation route | User responds |
| **COMPLETED** | All subgoals done | Final route decision | — (terminal) |
| **TERMINATED** | Safety boundary triggered | Safety circuit break | — (terminal) |

---

## Safety Boundaries

The Loop includes multiple safety mechanisms to prevent infinite or runaway execution.

### 1. Global Circuit Breaker

**Threshold**: 20 total failures across all subgoals
**Behavior**: Auto-pause the entire Loop
**Action**: Escalate to user with failure summary

```
if totalFailures >= globalCircuitBreakerThreshold:
  pauseLoop()
  notifyUser("Circuit breaker triggered: {totalFailures} failures")
```

### 2. Subgoal Retry Limit

**Threshold**: Per-subgoal `maxAttemptsPerSubgoal` (from Goal Registry config, default: 5)
**Behavior**: After exhausting retries, subgoal status → `escalated`
**Action**: Escalate to user

### 3. Timeout Protection

**Single execution timeout**: 30 minutes
**Behavior**: If a single Plan execution takes longer than 30 min, force-interrupt
**Action**: Mark as EXECUTION_ERROR, route to retry or replan

**Total Loop timeout**: 2 hours (configurable in goal's `config.maxExecutionTimeMin`)
**Behavior**: If the entire Loop exceeds the time budget, force-terminate
**Action**: Terminate Loop, output partial completion report

### 4. User STOP Signal

**How to stop**: User says "stop", "STOP", "停", "/stop-prometheus-loop"
**Behavior**: Graceful termination — complete current task, then exit
**Action**: Output partial completion report with current state

### 5. Iteration Cap

**Maximum subgoal iterations**: 100 (across all retries + replans across all subgoals)
**Behavior**: After 100 iterations, force-terminate
**Action**: Terminate Loop, output termination report

---

## Monitoring and Resumption

### Checking Loop State

To check progress while the Loop is running (or after a session ends):

```
1. goals:list
   → See all goals, their status, and progress

2. goals:get {goalId}
   → See full goal details, current subgoal, attempt count

3. Check .omo/goals/index.json
   → Active vs completed goals

4. Check .omo/plans/ directory
   → See generated Plans
```

### Session Resumption

When resuming work after a session ends:

1. Run `goals:list` to see all goals
2. For active goals, run `goals:get {goalId}` to see current state
3. Check `loopContext.sessionCount` and `loopContext.continuationToken`
4. Run `goals:next {goalId}` to find the next subgoal
5. Resume from Stage 2 (Planning Phase)
6. Update `loopContext.sessionCount += 1`

### Resumption Example

```
User: "继续之前的任务"
→ goals:list
→ Active Goals: blog-system (in_progress — 1/3 subgoals)
→ goals:get blog-system
  → currentSubgoalIndex: 1
  → sg-002: in_progress, attempts: 2, lastError: "缺少鉴权"
→ goals:next blog-system
  → sg-002 ready (sg-001 completed, dependency unblocked)
→ Resume from Stage 2: Replan sg-002 with feedback about missing auth
```

---

## Error Handling Reference

| Scenario | Detection | Response |
|----------|-----------|----------|
| Goal file missing | File read fails | Initialize new goal via goals:init |
| Index.json corrupted | JSON parse error | Rebuild index from existing goal files |
| Plan file not found | File check fails | Re-plan: go to Stage 2 |
| Momus unavailable | Agent call fails | Skip verification, proceed with caution |
| Execution tool fails | Exit code non-zero | Stage 5 verification will catch it |
| Loop interrupted mid-execution | Session ends | Session resumption (see Monitoring and Resumption) |
| Goal has no subgoals | goals:next returns null | Set successCriteria, run as single task |

---

## Common Mistakes

- **Subgoal too large**: Each subgoal should map to 1-3 files / one Plan. If a subgoal needs multiple Plans, split it into finer subgoals.
- **Missing dependency chain**: Subgoals without `blockedBy` may execute in parallel and fail due to missing prerequisites. Always model dependencies upfront in Stage 1.
- **Vague goal description**: The initial description drives subgoal decomposition. Vague input → vague subgoals → Plan_ISSUE failures. Be specific: `"博客系统含文章 CRUD + 评论区 + 标签管理"` not `"做个博客"`.
- **Manual intervention expectation**: The Loop is autonomous. If you need to approve every stage, you're using the wrong tool. The Loop handles retries, replans, and escalations automatically.
- **Ignoring Momus rejection details**: When Momus rejects a Plan (Stage 3) or Result (Stage 5), the Verdict details tell you exactly what to fix. Reading them carefully saves retry cycles.

---

## Internal Commands Reference

The 8 goal CRUD commands (`goals:init`, `goals:list`, `goals:get`, `goals:update`, `goals:add-subgoal`, `goals:update-subgoal`, `goals:archive`, `goals:next`) are documented in detail in [`commands.md`](./commands.md), along with the Goal JSON Schema and Storage Layout.
