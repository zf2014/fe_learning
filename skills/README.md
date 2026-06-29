# Agent Skills

This directory contains installable agent skills for [OpenCode](https://github.com/opencode-ai/opencode) (or compatible agent CLI environments like Claude Code, Copilot CLI).

## Skills

| Skill | Description |
|-------|-------------|
| [prometheus-loop](./prometheus-loop/SKILL.md) | Autonomous 7-stage task execution loop — Plan → Execute → Verify → Route, automatically cycling until goal completion. Includes built-in Goal Registry CRUD commands as Internal Commands. |

## Prerequisites

Requires a runtime with these built-in agents:
- **Prometheus** — strategic planning
- **Sisyphus** (`/start-work`) — plan execution
- **Momus** — adversarial verification

## Installation

```bash
# Install the skill
npx skills add zf2014/fe_learning

# Or without cloning unrelated repo content
npx skills add zf2014/fe_learning --skill prometheus-loop
```
