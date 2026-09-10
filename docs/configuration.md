# Configuration Guide: `@putervision/behavior-mcp`

`@putervision/behavior-mcp` can be customized via `.behavior-mcp.json` in your project root or via environment variables.

---

## Configuration File (`.behavior-mcp.json`)

```json
{
  "projectName": "my-game-project",
  "tickRateHz": 60,
  "stuckThreshold": 100,
  "maxActionsPerSec": 60,
  "allowlistOrigins": ["https://app.local", "https://game.io"],
  "busyTimeoutMs": 5000,
  "mmapSizeBytes": 134217728,
  "accessMode": "normal"
}
```

### Options Reference
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectName` | `string` | auto-detected | Slug identifier for project database isolation |
| `tickRateHz` | `number` | `60` | Behavior tree target execution frequency in Hertz |
| `stuckThreshold` | `number` | `100` | Number of identical node visits before triggering stuck warning |
| `maxActionsPerSec` | `number` | `60` | Action rate limiter maximum throughput ceiling |
| `allowlistOrigins` | `string[]` | `["*"]` | Allowed browser origins for script injection |
| `busyTimeoutMs` | `number` | `5000` | SQLite WAL busy timeout in milliseconds |
| `mmapSizeBytes` | `number` | `134217728` | Memory-mapped I/O size (128 MB default) |
| `accessMode` | `enum` | `"normal"` | Set to `"read_only"` for query-only analysis |

---

## Environment Variables
- `BEHAVIOR_PROJECT`: Override target project slug.
- `BEHAVIOR_LOG_LEVEL`: Set log level (`debug`, `info`, `warn`, `error`).
- `BEHAVIOR_MCP_DIR`: Custom directory for SQLite database storage.
