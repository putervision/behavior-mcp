# @putervision/behavior-runtime-mcp

[![npm version](https://img.shields.io/npm/v/@putervision/behavior-runtime-mcp.svg)](https://www.npmjs.com/package/@putervision/behavior-runtime-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/node-%3E%3D18.18.0-brightgreen.svg)](https://nodejs.org)

> High-Frequency (~60Hz) In-Browser Behavior Tree Execution Engine for AI Agents

`@putervision/behavior-runtime-mcp` is an MCP server that executes deterministic behavior trees directly in browser environments at ~60Hz with reactive triggers, frame recordings, and multi-layer safety guardrails.

> **PuterVision Research Posture**: *Functional agency and closed-loop automation — not consciousness, sentience, or AGI.*

---

## ⚡ Quick Start

```bash
# Initialize in your workspace & seed built-in behaviors
npx @putervision/behavior-runtime-mcp init

# Check runtime health
npx @putervision/behavior-runtime-mcp doctor

# Inspect active executions and triggers
npx @putervision/behavior-runtime-mcp inspect
```

---

## 🛠️ Consolidated MCP Tools (10 Tools)

| Tool | Actions | Description |
|------|---------|-------------|
| `load_behavior` | `load`, `unload`, `swap` | Inject and start behavior tree execution in browser |
| `set_parameters` | `set`, `get`, `reset` | Dynamically update runtime execution parameters |
| `get_status` | `current`, `history`, `tree_state` | Query active status, node path, and tick counters |
| `abort_behavior` | `abort`, `pause`, `resume` | Immediately halt, pause, or resume execution |
| `register_trigger` | `register`, `list`, `update`, `remove`, `enable`, `disable` | Configure priority interrupts with cooldown guards |
| `replay_recording` | `start`, `stop`, `list`, `capture`, `delete` | Capture and replay deterministic frame actions |
| `get_metrics` | `current`, `history`, `aggregate`, `compare` | Retrieve telemetry metrics and duration stats |
| `manage_behaviors` | `register`, `list`, `get`, `update`, `delete`, `export`, `import` | CRUD for immutable behavior tree JSON definitions |
| `manage_blackboard` | `get`, `set`, `clear`, `dump` | Read and write behavior tree blackboard state |
| `manage_runtime_db` | `backup`, `stats`, `audit`, `snapshot`, `diff`, `restore` | Database maintenance, diagnostics, and SHA-256 audit |

---

## 🛡️ 5-Layer Safety Stack

1. **Watchdog Timer**: Auto-aborts if ticks freeze for > threshold.
2. **Action Rate Limiter**: Limits input actions to max 60/sec.
3. **Leaf Policy Gate**: Blocks irreversible high-risk actions.
4. **Global Kill Switch**: Immediate emergency shutdown.
5. **Origin Allowlist**: Pin browser origin domains for secure script injection.

---

## 📄 License
MIT © PuterVision
