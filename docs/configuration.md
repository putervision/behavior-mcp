# Configuration: behavior-runtime-mcp

Configurable via `.behavior-runtime-mcp.json` or environment variables:
- `BEHAVIOR_LOG_LEVEL`: `debug`, `info`, `warn`, `error` (default: `info`)
- `BEHAVIOR_BUSY_TIMEOUT_MS`: SQLite lock timeout (default: `5000`)
- `BEHAVIOR_MMAP_SIZE_BYTES`: Memory-mapped I/O size (default: `134217728` / 128MB)
- `BEHAVIOR_TICK_RATE_HZ`: Target tick rate (default: `60`)
- `BEHAVIOR_STUCK_THRESHOLD`: Stalled ticks before watchdog abort (default: `300`)
- `BEHAVIOR_ALLOWLIST_ORIGINS`: Comma-separated allowed origins (default: `*` for local dev)
