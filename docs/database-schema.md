# SQLite Database Schema: `@putervision/behavior-mcp`

`@putervision/behavior-mcp` stores all runtime data in a local SQLite database (`.behavior-mcp/<project-slug>/behavior.db`) with WAL (Write-Ahead Logging) and strict foreign key constraints.

---

## Tables

### 1. `behavior_definitions`
Stores immutable JSON behavior tree definitions with SHA-256 tree hash verification.

```sql
CREATE TABLE behavior_definitions (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  tree_json TEXT NOT NULL,
  tree_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT,
  client_request_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(project, name, version)
);
```

### 2. `execution_state`
Tracks active runtime instances, tick counts, durations, active node paths, and stuck scores.

```sql
CREATE TABLE execution_state (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  behavior_name TEXT NOT NULL,
  behavior_version INTEGER NOT NULL DEFAULT 1,
  session_id TEXT,
  intention_id TEXT,
  status TEXT NOT NULL DEFAULT 'idle',
  active_node_path TEXT,
  blackboard_json TEXT NOT NULL DEFAULT '{}',
  current_tick INTEGER NOT NULL DEFAULT 0,
  tick_rate_hz INTEGER NOT NULL DEFAULT 60,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  stuck_score REAL NOT NULL DEFAULT 0.0,
  error TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 3. `triggers`
Reactive preemption triggers with priority ordering and cooldown guards.

```sql
CREATE TABLE triggers (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  name TEXT NOT NULL,
  behavior_name TEXT NOT NULL,
  condition_type TEXT NOT NULL,
  condition_params_json TEXT NOT NULL,
  priority REAL NOT NULL DEFAULT 0.5,
  cooldown_ms INTEGER NOT NULL DEFAULT 1000,
  last_fired_at TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project, name)
);
```

### 4. `execution_metrics`
Execution performance telemetry, tick duration stats, and category metrics.

```sql
CREATE TABLE execution_metrics (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  session_id TEXT,
  intention_id TEXT,
  behavior_name TEXT NOT NULL,
  status TEXT NOT NULL,
  tick_count INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  avg_tick_ms REAL NOT NULL DEFAULT 0.0,
  max_tick_ms REAL NOT NULL DEFAULT 0.0,
  stuck_count INTEGER NOT NULL DEFAULT 0,
  interrupt_count INTEGER NOT NULL DEFAULT 0,
  category_metrics_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (execution_id) REFERENCES execution_state(id) ON DELETE CASCADE
);
```

### 5. `recordings`
Deterministic browser frame capture sequences.

```sql
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  execution_id TEXT NOT NULL,
  behavior_name TEXT NOT NULL,
  total_frames INTEGER NOT NULL DEFAULT 0,
  frames_json TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (execution_id) REFERENCES execution_state(id) ON DELETE CASCADE
);
```

### 6. `events`
Append-only SHA-256 Merkle event ledger ensuring cryptographic auditability.

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  action TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);
```
