# 🚀 Migration Guide: @putervision/behavior-mcp

This guide explains how to migrate client integrations, custom agents, and tool callers to the unified **v0.4.1+ API** with native transport, unified blackboard dialect, dynamic behavior synthesis, and spatial blackboard slice projection.

---

## ⚡️ Key Architecture Updates

### 1. Zero-Dependency Native Transport (`PV_NATIVE_TRANSPORT=1`)
You can run `behavior-mcp` with zero dependency on `@modelcontextprotocol/sdk` and `zod` by setting `PV_NATIVE_TRANSPORT=1`:

```json
{
  "mcpServers": {
    "behavior": {
      "command": "node",
      "args": ["/path/to/behavior-mcp/dist/index.js"],
      "env": {
        "PV_NATIVE_TRANSPORT": "1"
      }
    }
  }
}
```

- Sub-millisecond JSON-RPC 2.0 framing directly on Node.js `readline`.
- Dynamic protocol version negotiation (supports `2024-11-05` and newer).
- Per-request AbortController cancellation via `notifications/cancelled`.

### 2. Mandatory `project` Slug Validation
All tools requiring persistent behavior state now strictly require a non-empty `project` parameter.
- Missing or empty `project` values immediately return JSON-RPC Error `-32602` (`Invalid params: "project" parameter is required`).
- Cross-project contamination is prevented by strict database file partitioning.

### 3. Unified Blackboard Dialect
The `manage_blackboard` tool adheres to the canonical 5-verb specification across the PuterVision Pentad:
`get` | `set` | `delete` | `lease` | `list`

- Legacy verbs are mapped with deprecation warnings:
  - `read` → `get`
  - `post` → `set`
  - `claim` / `release` → `lease`
- Expirations are configured in seconds (`ttl_seconds`).

### 4. Canonical Tool Documentation Resources (`pv://docs/...`)
Tool documentation and schemas can now be inspected directly through MCP resources without loading the full parameter schema into every context window:
- URI template: `pv://docs/{toolName}`
- Individual resources: `pv://docs/load_behavior`, `pv://docs/manage_behaviors`, etc.

### 5. Dynamic Tree Synthesis & Unstick Recovery
- **Behavior Tree Synthesis**: Use `manage_behaviors(action: "synthesize")` to dynamically compile sequence, selector, or parallel behavior trees with automatic SHA-256 tree hash verification:
  ```typescript
  await client.callTool({
    name: "manage_behaviors",
    arguments: {
      action: "synthesize",
      project: "my-project",
      name: "checkout_flow",
      type: "sequence",
      child_nodes: [
        { name: "validate_cart", type: "action" },
        { name: "charge_payment", type: "action" }
      ]
    }
  });
  ```
- **Unstick Recovery**: Call `abort_behavior(action: "unstick")` to reset `stuck_score`, disengage active inputs, and unblock execution when an agent becomes stuck in a loop.

### 6. Blackboard Slice Projection & Spatial Conditions (v0.4.0)
- `manage_blackboard` supports slice projection, allowing condition nodes to directly observe sub-1KB spatial and task states.
- Typed spatial condition nodes (`distance_to_entity`, `inside_region`, `has_affordance`) execute synchronously without LLM overhead.
- High-frequency (~60Hz) outcome spooling directly records node state transitions to local SQLite WAL for auditability.
