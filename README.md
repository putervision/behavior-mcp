# @putervision/behavior-mcp

[![npm version](https://img.shields.io/npm/v/@putervision/behavior-mcp.svg)](https://www.npmjs.com/package/@putervision/behavior-mcp)
[![CI](https://github.com/putervision/behavior-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/putervision/behavior-mcp/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

> **High-Frequency (~60Hz) In-Browser Behavior Tree Tactical Runtime Engine for AI Agents**

`@putervision/behavior-mcp` is a Model Context Protocol (MCP) server that executes deterministic behavior trees directly in browser runtimes at ~60Hz with reactive trigger preemption, frame recordings, SHA-256 Merkle audit chains, and a 5-layer safety guardrail stack.

🌐 **Official Documentation**: [putervision.com](https://putervision.com) • [Interactive Web Docs](docs/index.html)

---

## ⚡ 15-Second Quick Start

```bash
# 1. Initialize runtime & seed default behavior trees in your workspace
npx @putervision/behavior-mcp init

# 2. Run system diagnostic and health checks
npx @putervision/behavior-mcp doctor

# 3. Inspect active executions, blackboard state, and reactive triggers
npx @putervision/behavior-mcp inspect
```

---

## 🛠️ 10 Core MCP Tools

| Tool | Actions | Purpose |
|------|---------|---------|
| `load_behavior` | `load`, `unload`, `swap` | Inject, initialize, or hot-swap a behavior tree in browser runtime |
| `set_parameters` | `set`, `get`, `reset` | Dynamically update or query runtime execution parameters |
| `get_status` | `current`, `history`, `tree_state` | Query active status, node traversal path, tick count, duration |
| `abort_behavior` | `abort`, `pause`, `resume` | Halt, pause, or resume behavior execution safely |
| `register_trigger` | `register`, `list` | Configure reactive interrupt triggers with priority preemption |
| `replay_recording` | `capture`, `list` | Capture or inspect deterministic browser action sequences |
| `get_metrics` | `current`, `history` | Retrieve runtime telemetry, tick durations, and stuck events |
| `manage_behaviors` | `register`, `get`, `list` | CRUD for immutable behavior tree JSON with SHA-256 tree hashes |
| `manage_blackboard` | `get`, `set` | Read, write, or query shared behavior tree blackboard variables |
| `manage_runtime_db` | `stats`, `audit`, `snapshot`, `restore` | SQLite diagnostics, SHA-256 Merkle audit, and checkpoint rollback |

---

## 🛡️ 5-Layer Safety Guardrail Stack

1. **Fail-Closed Evaluator**: Unrecognized node definitions throw fatal exceptions immediately.
2. **Watchdog Heartbeat Timer**: Halts execution if tick evaluation stalls beyond 5,000ms.
3. **Action Rate Limiter**: Strict 60 actions/sec maximum throughput ceiling.
4. **Leaf Policy Gate**: Blocks irreversible, high-risk mutations (`delete_item`, `spend_currency`).
5. **Emergency Kill Switch**: Atomic safety latch (`EmergencySafety.engageKillSwitch()`) halts all runtimes.

---

## 📚 Deep Documentation Guides

- 📖 **[Formal API Reference](docs/api-reference.md)**: Full parameter tables, type definitions, and tool schemas.
- 💡 **[Core Architecture & Concepts](docs/concepts.md)**: Behavior tree execution model, ~60Hz loop, and trigger lifecycle.
- 🖥️ **[CLI Usage Guide](docs/cli-usage.md)**: Complete CLI command reference (`init`, `doctor`, `inspect`, `run`).
- 💾 **[Database Schema](docs/database-schema.md)**: SQLite table structures, indexes, and Merkle audit ledger.
- ⚙️ **[Configuration Reference](docs/configuration.md)**: `.behavior-mcp.json` parameters and environment variables.

---

## 🔗 Client Configuration

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:
```json
{
  "mcpServers": {
    "behavior-mcp": {
      "command": "behavior-mcp",
      "args": ["run"]
    }
  }
}
```

---

## 🧪 Testing

```bash
# Run full unit and integration test suite across 15 test files (87 tests)
npm test
```

---

## 📄 License
MIT © PuterVision
