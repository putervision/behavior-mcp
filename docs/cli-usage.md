# CLI Usage Guide: `@putervision/behavior-mcp`

`@putervision/behavior-mcp` includes a comprehensive command-line interface for local workspace initialization, health checks, and database management.

---

## Commands Overview

### `behavior-mcp init`
Initializes `behavior-mcp` in the current project directory.
- Creates local `.behavior-mcp/<project-slug>/` database directory.
- Updates `.gitignore` to prevent committing SQLite WAL files.
- Seeds built-in core and game behavior trees.
- Scaffolds agent instructions (`.agents/AGENTS.md`, `CLAUDE.md`, `.windsurfrules`).
- Scaffolds MCP configurations (`.cursor/mcp.json`, `.vscode/mcp.json`).

```bash
behavior-mcp init
```

### `behavior-mcp init-global`
Re-initializes `behavior-mcp` across all projects registered in the global workspace registry (`~/.behavior-mcp/projects.json`).

```bash
behavior-mcp init-global
```

### `behavior-mcp doctor`
Runs comprehensive environment diagnostic checks on the local project:
- Node.js runtime compatibility.
- SQLite WAL database health.
- Cryptographic SHA-256 Merkle event ledger integrity.
- Behavior definition hashes.

```bash
behavior-mcp doctor
```

### `behavior-mcp doctor-global`
Runs doctor health diagnostics across all registered projects in the global registry.

```bash
behavior-mcp doctor-global
```

### `behavior-mcp inspect`
Outputs active behavior tree executions, blackboard state variables, and registered reactive triggers in a formatted terminal table.

```bash
behavior-mcp inspect
```

### `behavior-mcp run`
Starts the stdio Model Context Protocol (MCP) server for integration with Cursor, Claude Code, VS Code, Gemini, or custom agent frameworks.

```bash
behavior-mcp run
```
