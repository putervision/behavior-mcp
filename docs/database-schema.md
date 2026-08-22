# Database Schema: behavior-runtime-mcp

`behavior.db` is an embedded SQLite database operating in WAL mode with normalized tables:
- `behavior_definitions`: Registered behavior tree JSON definitions and SHA-256 `tree_hash`.
- `execution_state`: Live execution instances, node paths, and tick counters.
- `triggers`: Reactive interrupts and cooldown timestamps.
- `execution_metrics`: Telemetry aggregations and tick durations.
- `recordings`: Captured frame sequences for deterministic replay.
- `events`: Cryptographic SHA-256 Merkle audit log.
- `snapshots`: State checkpoints.
