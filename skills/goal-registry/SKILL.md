---
name: goal-registry
description: Goal Registry CRUD operations for Prometheus Loop. Manages long-term goals, subgoals, and dependency chains in .omo/goals/. Use when creating, updating, querying, or archiving goals for the Prometheus Loop autonomous task execution system.
---

# Goal Registry Skill

## Overview

This skill manages the **Goal Registry** — the persistent data layer for Prometheus Loop. Goals are stored as JSON files in `.omo/goals/`. Each goal contains a list of subgoals with dependency chains, execution state, and cross-session context.

**Data location**: `.omo/goals/`
**Index file**: `.omo/goals/index.json`
**Active goals**: `.omo/goals/active/{goalId}.json`
**Archived goals**: `.omo/goals/completed/{goalId}.json`

---

## Trigger Patterns

Use this skill when you need to:
- Initialize a new long-term goal for Prometheus Loop
- List all goals and their current progress
- Check the status of a specific goal
- Update goal or subgoal state after execution
- Add a new subgoal to an existing goal
- Find the next subgoal ready to execute
- Archive a completed goal
- Debug goal state or dependency chains

---

## Commands

### `goals:init — Initialize a new goal`

Initialize a new goal and save it to `.omo/goals/active/{goalId}.json`.

**Usage**: `goals:init {title} {description}`

**Example**: `goals:init "Blog System" "文章 CRUD + 评论 + 标签"`

**Behavior**:
1. Generate goalId from title: lowercase, replace spaces with hyphens, remove special chars (e.g., "Blog System" → `blog-system`)
2. Check for duplicate goalId in index.json; if exists, append sequential number (`blog-system-2`)
3. Create goal JSON with:
   - `goalId`: generated id
   - `title`: from input
   - `description`: from input
   - `status`: `"in_progress"`
   - `createdAt`: current ISO timestamp
   - `completedAt`: null
   - `successCriteria`: empty array (to be defined later)
   - `subgoals`: empty array
   - `config`: `{"maxAttemptsPerSubgoal": 5, "maxTotalFailures": 20, "maxExecutionTimeMin": 120}`
   - `currentSubgoalIndex`: 0
   - `loopContext`: `{"sessionCount": 0, "lastActiveAt": "<now>", "continuationToken": ""}`
4. Write to `.omo/goals/active/{goalId}.json`
5. Update `.omo/goals/index.json`: add goalId to `active` array

---

### `goals:list — List all goals`

List all goals from the index with their status and progress.

**Usage**: `goals:list`

**Behavior**:
1. Read `.omo/goals/index.json`
2. For each goalId in `active` array:
   - Read `.omo/goals/active/{goalId}.json`
   - Count completed subgoals vs total
3. For each goalId in `completed` array:
   - Read `.omo/goals/completed/{goalId}.json`
4. Display formatted list showing: title, status, progress (completed/total subgoals), last updated

**Example output**:
```
Active Goals:
  blog-system (in_progress) — 1/3 subgoals completed
  auth-module (blocked) — 0/2 subgoals completed

Completed Goals:
  init-setup — 2/2 subgoals completed
```

---

### `goals:get {goalId} — Get a specific goal`

Read and display the full goal JSON.

**Usage**: `goals:get blog-system`

**Behavior**:
1. Check `active` list in index.json → if found, read `.omo/goals/active/{goalId}.json`
2. If not in active, check `completed` list → read `.omo/goals/completed/{goalId}.json`
3. Display the full goal JSON with formatted structure

---

### `goals:update {goalId} {field} {value} — Update a goal field`

Update a top-level field in the goal JSON.

**Usage**: `goals:update blog-system status completed`

**Supported fields**:
- `status`: one of `pending`, `in_progress`, `completed`, `blocked`, `escalated`
- `title`: new title string
- `description`: new description string
- `currentSubgoalIndex`: numeric index
- `successCriteria`: JSON array of strings
- `completedAt`: auto-set to current ISO timestamp when status becomes "completed"

**Behavior**:
1. Read the goal file from active
2. Update the specified field
3. Write back to the file
4. If status changed to `completed`, also run archive logic (move to completed/)
5. Update `loopContext.lastActiveAt` to current time

---

### `goals:add-subgoal {goalId} {title} {planRef} — Add a subgoal`

Add a new subgoal to an existing goal.

**Usage**: `goals:add-subgoal blog-system "数据层" ".omo/plans/blog-db-layer.md"`

**Behavior**:
1. Read the goal file
2. Generate subgoal id: `sg-{NNN}` where NNN is zero-padded sequential number (001, 002...)
3. Create subgoal object:
   ```json
   {
     "id": "sg-001",
     "title": "数据层",
     "status": "pending",
     "planRef": ".omo/plans/blog-db-layer.md",
     "attempts": 0,
     "lastResult": "",
     "lastError": "",
     "blockedBy": []
   }
   ```
4. Append to `subgoals` array
5. Write back to the goal file

---

### `goals:update-subgoal {goalId} {subgoalId} {field} {value} — Update subgoal status`

Update a specific subgoal's field after execution.

**Usage**: `goals:update-subgoal blog-system sg-001 status completed`

**Supported fields**:
- `status`: `pending`, `in_progress`, `completed`, `failed`, `escalated`
- `attempts`: numeric (increment)
- `lastResult`: string (Momus verdict summary)
- `lastError`: string (error description)
- `blockedBy`: JSON array (used during initial setup)

**Behavior**:
1. Read the goal file
2. Find the subgoal by id in `subgoals` array
3. Update the specified field
4. Increment `attempts` if status changes to `failed`
5. Write back to the goal file
6. Update `loopContext.lastActiveAt`

---

### `goals:archive {goalId} — Archive a completed goal`

Move a goal from active to completed.

**Usage**: `goals:archive blog-system`

**Behavior**:
1. Read `.omo/goals/active/{goalId}.json`
2. Set `status` to `completed`, set `completedAt` to current time
3. Move file to `.omo/goals/completed/{goalId}.json`
4. Update index.json: remove from `active` array, add to `completed` array
5. If the original `active` file still exists, delete it

---

### `goals:next {goalId} — Get next pending subgoal`

Find the next subgoal that is ready to execute, respecting blockedBy dependencies.

**Usage**: `goals:next blog-system`

**Behavior**:
1. Read the goal file
2. Find all subgoals with status `"pending"`
3. For each pending subgoal:
   - Check its `blockedBy` array
   - A subgoal is **ready** when ALL subgoals listed in `blockedBy` have status `"completed"`
4. Among ready subgoals, pick the one with the lowest numeric id (sg-001 before sg-002)
5. Return the ready subgoal's id and title, or null if none ready

**Edge cases**:
- If no pending subgoals exist, return "goal already completed"
- If pending subgoals exist but all are blocked by uncompleted dependencies, return "blocked by: {dependency ids}"
- If multiple subgoals are ready, return the first one (lowest index)

---

## Goal Schema Reference

Complete JSON schema for a goal file (`.omo/goals/active/{goalId}.json`):

```json
{
  "goalId": "string — unique identifier (e.g., 'blog-system')",
  "title": "string — goal title (e.g., '实现博客系统')",
  "description": "string — detailed goal description",
  "status": "in_progress",
  "createdAt": "ISO 8601 timestamp",
  "completedAt": null,

  "successCriteria": [
    "string — each criterion describes a verifiable condition"
  ],

  "subgoals": [
    {
      "id": "sg-001",
      "title": "string — subgoal title",
      "status": "pending | in_progress | completed | failed | escalated",
      "planRef": "string — path to .omo/plans/ file",
      "attempts": 0,
      "lastResult": "string — Momus verdict or result summary",
      "lastError": "string — error description if failed",
      "blockedBy": ["sg-000"]
    }
  ],

  "config": {
    "maxAttemptsPerSubgoal": 5,
    "maxTotalFailures": 20,
    "maxExecutionTimeMin": 120
  },

  "currentSubgoalIndex": 0,

  "loopContext": {
    "sessionCount": 0,
    "lastActiveAt": "ISO 8601 timestamp",
    "continuationToken": "string — cross-session continuation reference"
  }
}
```

---

## Storage Layout

```
.omo/goals/
├── active/                      ← Active goals
│   ├── blog-system.json
│   └── auth-module.json
├── completed/                   ← Archived completed goals
│   └── init-setup.json
└── index.json                   ← Master index
    {
      "active": ["blog-system", "auth-module"],
      "completed": ["init-setup"]
    }
```

---

## Dependency Resolution

The `goals:next` command resolves dependencies using these rules:

1. A subgoal is **ready** when:
   - Its `status` is `"pending"`
   - ALL subgoals in its `blockedBy` array have `status: "completed"`

2. If multiple subgoals are ready:
   - Pick the one with the lowest index (sg-001 before sg-002)

3. If no subgoals are ready:
   - If all subgoals are completed → goal is done
   - If pending subgoals exist but all blocked → goal is blocked
   - Return null with explanation

**Example dependency chain**:
```
sg-001: "数据层"           blockedBy: []        → ready immediately
sg-002: "API 层"           blockedBy: ["sg-001"] → ready after sg-001 completes
sg-003: "前端页面"         blockedBy: ["sg-002"] → ready after sg-002 completes
```

---

## Cross-Session Continuation

When resuming work after a session ends:

1. Read `goals:list` to see all goals
2. For the active goal, read `goals:get {goalId}` to see current state
3. Run `goals:next {goalId}` to find the next subgoal to execute
4. Resume the Prometheus Loop from the next subgoal

The `loopContext.continuationToken` can be used to reference the previous session for context recovery.
