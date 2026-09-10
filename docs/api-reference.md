# API Reference: `@putervision/behavior-mcp`

Comprehensive documentation for all 10 MCP tools provided by `@putervision/behavior-mcp`.

---

## 1. `load_behavior`
Inject, initialize, or hot-swap a behavior tree instance in the browser runtime.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("load", "unload", "swap") | Yes | Runtime lifecycle action |
| `behavior_name` | `string` | Yes | Target behavior tree identifier registered in the database |
| `behavior_version` | `number` | No | Version number (defaults to latest active) |
| `session_id` | `string` | No | Workflow session ID for correlation |
| `intention_id` | `string` | No | Originating reasoning intention ID |
| `parameters` | `object` | No | Initial runtime execution parameter dictionary |
| `project` | `string` | No | Target project slug (defaults to detected workspace) |

---

## 2. `set_parameters`
Dynamically update or query execution parameters for the active behavior runtime.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("set", "get", "reset") | Yes | Parameter operation |
| `execution_id` | `string` | Yes | Target execution instance ID |
| `parameters` | `object` | No | Parameters dictionary to set or merge |
| `project` | `string` | No | Target project slug |

---

## 3. `get_status`
Query active behavior execution status, current node traversal path, tick count, duration, and error state.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("current", "history", "tree_state") | Yes | Status query scope |
| `execution_id` | `string` | No | Target execution instance ID |
| `limit` | `number` | No | Maximum history records to return (defaults to 50) |
| `project` | `string` | No | Target project slug |

---

## 4. `abort_behavior`
Immediately halt, pause, or resume behavior execution and disengage active inputs.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("abort", "pause", "resume") | Yes | Abort or pause operation |
| `execution_id` | `string` | Yes | Active execution instance ID |
| `reason` | `string` | No | Human or agent-readable abort explanation |
| `project` | `string` | No | Target project slug |

---

## 5. `register_trigger`
Configure and manage reactive interrupt triggers with priority preemption and cooldown guards.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("register", "list") | Yes | Trigger registry operation |
| `name` | `string` | No | Unique trigger identifier |
| `behavior_name` | `string` | No | Emergency behavior to execute upon trigger firing |
| `condition_type` | `string` | No | Trigger condition predicate (e.g. `hp_below`, `enemy_in_range`) |
| `condition_params` | `object` | No | Threshold parameters for condition evaluation |
| `priority` | `number` | No | Interrupt priority (0.0 to 1.0, higher preempts running tree) |
| `cooldown_ms` | `number` | No | Minimum milliseconds between trigger evaluations |
| `project` | `string` | No | Target project slug |

---

## 6. `replay_recording`
Capture or inspect deterministic browser action sequences with adaptive timing.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("capture", "list") | Yes | Recording operation |
| `execution_id` | `string` | No | Associated execution instance ID |
| `name` | `string` | No | Recording name or session identifier |
| `frames` | `array` | No | Array of recorded frame tick payloads |
| `project` | `string` | No | Target project slug |

---

## 7. `get_metrics`
Retrieve runtime execution telemetry, tick durations, stuck events, and category statistics.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("current", "history", "aggregate", "compare") | Yes | Telemetry query mode |
| `execution_id` | `string` | No | Target execution instance ID |
| `behavior_name` | `string` | No | Filter by behavior tree name |
| `limit` | `number` | No | Max records to return |
| `project` | `string` | No | Target project slug |

---

## 8. `manage_behaviors`
CRUD operations for immutable JSON behavior tree definitions with SHA-256 tree hash verification.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("register", "list", "get") | Yes | CRUD action |
| `name` | `string` | No | Behavior tree name |
| `version` | `number` | No | Version number |
| `tree` | `object` | No | Structured JSON behavior tree definition |
| `tree_json` | `string` | No | Raw stringified JSON behavior tree |
| `description` | `string` | No | Description of behavior purpose |
| `project` | `string` | No | Target project slug |

---

## 9. `manage_blackboard`
Read, write, or query shared behavior tree blackboard state variables.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("get", "set") | Yes | Blackboard operation |
| `execution_id` | `string` | Yes | Target execution instance ID |
| `key` | `string` | No | Blackboard key name |
| `value` | `any` | No | Value to store in blackboard |
| `project` | `string` | No | Target project slug |

---

## 10. `manage_runtime_db`
Database maintenance, diagnostics, SHA-256 Merkle audit verification, checkpoints save/restore, and diffs.

### Parameters
| Name | Type | Required | Description |
|------|------|:---:|-------------|
| `action` | `enum` ("stats", "audit", "snapshot", "diff", "restore") | Yes | Database maintenance action |
| `name` | `string` | No | Snapshot name |
| `description` | `string` | No | Snapshot description |
| `project` | `string` | No | Target project slug |
