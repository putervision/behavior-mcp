# API Reference: behavior-runtime-mcp

Complete reference for all 10 MCP tools exposed by `@putervision/behavior-runtime-mcp`.

## 1. `load_behavior`
Inject and start a behavior tree instance in the browser runtime.

## 2. `set_parameters`
Update or query execution parameters on the fly.

## 3. `get_status`
Query active execution status, current node path, tick count, and error state.

## 4. `abort_behavior`
Immediately halt, pause, or resume behavior execution.

## 5. `register_trigger`
Configure reactive interrupt conditions with priority preemption and cooldown guards.

## 6. `replay_recording`
Capture or replay deterministic frame actions.

## 7. `get_metrics`
Retrieve tick durations, stuck events, and combat/economy/nav metrics.

## 8. `manage_behaviors`
CRUD for immutable behavior tree JSON definitions with SHA-256 tree hashes.

## 9. `manage_blackboard`
Read and write behavior tree blackboard state variables.

## 10. `manage_runtime_db`
Database maintenance, diagnostics, and SHA-256 Merkle audit verification.
