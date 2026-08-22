#!/usr/bin/env node
import {
  BehaviorRegistry,
  ExecutionEngine,
  TriggerRegistry,
  getDb,
  getProjectSlug,
  getVersion,
  registerProject,
  resolveProjectRoot,
  verifyEventChain
} from "./chunk-TV72ORDW.js";

// src/cli.ts
import path2 from "path";

// src/cli/init.ts
import * as fs from "fs";
import * as path from "path";

// src/cli/templates.ts
function getAgentsMdTemplate() {
  return `<!-- behavior-runtime-mcp:start -->
# Behavior Runtime Engine (behavior-runtime-mcp)

This project uses \`behavior-runtime-mcp\` to execute deterministic behavior trees at ~60Hz in browser runtimes with reactive triggers and safety guardrails.

## Mandatory Runtime Workflow
1. **Load Behavior**: Call \`load_behavior(action: "load", behavior_name: "...")\` to activate execution.
2. **Monitor Execution**: Check \`get_status(action: "current")\` and inspect active node traversal paths.
3. **Reactive Triggers**: Register high-priority emergency interrupts via \`register_trigger(action: "register", ...)\`.
4. **Safety & Abort**: Call \`abort_behavior(action: "abort")\` to immediately halt execution if anomalous behavior occurs.

## 10 Core MCP Tools
- \`load_behavior\`: Inject and start behavior tree execution.
- \`set_parameters\`: Update execution parameters on the fly.
- \`get_status\`: Query active status, current node path, and tick counters.
- \`abort_behavior\`: Immediately halt, pause, or resume execution.
- \`register_trigger\`: Configure priority interrupts with cooldown guards.
- \`replay_recording\`: Capture and replay deterministic frame actions.
- \`get_metrics\`: Query execution telemetry and duration statistics.
- \`manage_behaviors\`: Register and version behavior tree definitions with SHA-256 tree hashes.
- \`manage_blackboard\`: Read and write behavior tree blackboard state variables.
- \`manage_runtime_db\`: Database maintenance, diagnostics, and SHA-256 Merkle audit verification.
<!-- behavior-runtime-mcp:end -->
`;
}

// src/cli/init.ts
function upsertInstructionBlock(content, newBlock, startMarker = "<!-- behavior-runtime-mcp:start -->", endMarker = "<!-- behavior-runtime-mcp:end -->") {
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = content.substring(0, startIndex);
    const after = content.substring(endIndex + endMarker.length);
    const existingBlock = content.substring(startIndex, endIndex + endMarker.length);
    if (existingBlock.trim() === newBlock.trim()) {
      return { updatedContent: content, status: "unchanged" };
    }
    return { updatedContent: `${before}${newBlock.trim()}${after}`, status: "updated" };
  }
  const separator = content.endsWith("\n") ? "\n" : "\n\n";
  return { updatedContent: `${content}${separator}${newBlock.trim()}
`, status: "appended" };
}
function runInit(options = {}) {
  const cwd = options.cwd || process.cwd();
  const root = resolveProjectRoot(options.project, cwd);
  const slug = getProjectSlug(options.project, cwd);
  console.log(`Initializing behavior-runtime-mcp in: ${root} (project slug: ${slug})`);
  registerProject(slug, root);
  const db = getDb(slug, root);
  console.log("\u2714 SQLite behavior runtime database initialized with WAL mode.");
  const coreDir = path.resolve(root, "src", "behaviors", "core");
  if (fs.existsSync(coreDir)) {
    for (const f of fs.readdirSync(coreDir)) {
      if (f.endsWith(".json")) {
        const raw = fs.readFileSync(path.join(coreDir, f), "utf-8");
        const tree = JSON.parse(raw);
        BehaviorRegistry.registerBehavior(db, { project: slug, name: tree.id || path.basename(f, ".json"), tree });
      }
    }
  }
  const agentsPath = path.join(root, ".agents", "AGENTS.md");
  const dir = path.dirname(agentsPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const existingContent = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, "utf-8") : "";
  const result = upsertInstructionBlock(existingContent, getAgentsMdTemplate());
  fs.writeFileSync(agentsPath, result.updatedContent, "utf-8");
  console.log(`\u2714 Agent instructions ${result.status} in ${agentsPath}`);
  console.log("\nbehavior-runtime-mcp initialization complete!");
}

// src/cli.ts
function showHelp() {
  console.log(`
behavior-runtime-mcp CLI Tool v${getVersion()}

Usage:
  behavior-runtime-mcp <command> [options]

Commands:
  run                Start the MCP server on stdio transport (Default)
  init               Scaffold the workspace, database, seed behaviors, and IDE agent rules
  doctor             Run environment and database health checks
  inspect            Display tables of behaviors, active execution, and triggers
  audit              Audit cryptographic SHA-256 event ledger hash chain
  view               Open interactive behavior tree visualizer (viewer.html)
  update             Check npm registry for package updates

Options:
  -p, --project      Target specific project slug
  -v, --version      Show version number
  -h, --help         Show this help menu
`);
}
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "run";
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }
  if (args.includes("--version") || args.includes("-v")) {
    console.log(getVersion());
    process.exit(0);
  }
  let project;
  const pIndex = args.findIndex((a) => a === "-p" || a === "--project");
  if (pIndex !== -1 && args[pIndex + 1]) {
    project = args[pIndex + 1];
  }
  switch (command) {
    case "run": {
      await import("./index.js");
      break;
    }
    case "init": {
      runInit({ project });
      break;
    }
    case "doctor": {
      const root = resolveProjectRoot(project);
      const slug = getProjectSlug(project);
      console.log(`Running diagnostic doctor for "${slug}" in ${root}...`);
      try {
        const db = getDb(slug);
        const integrity = db.pragma("integrity_check");
        const journal = db.pragma("journal_mode");
        const eventAudit = verifyEventChain(db, slug);
        console.log(`\u2714 SQLite database accessibility: OK`);
        console.log(`\u2714 Journal mode: ${JSON.stringify(journal)}`);
        console.log(`\u2714 Database integrity: ${JSON.stringify(integrity)}`);
        console.log(`\u2714 Event chain verification: ${eventAudit.valid ? "VALID (unbroken)" : "FAILED"}`);
        console.log("\nDoctor diagnostic check PASSED.");
      } catch (err) {
        console.error(`\u2716 Doctor check failed: ${err.message}`);
        process.exit(1);
      }
      break;
    }
    case "inspect": {
      const slug = getProjectSlug(project);
      const db = getDb(slug);
      console.log(`
=== Registered Behaviors for ${slug} ===`);
      console.table(BehaviorRegistry.listBehaviors(db, slug), ["id", "name", "version", "tree_hash"]);
      console.log(`
=== Active Executions for ${slug} ===`);
      console.table(ExecutionEngine.listExecutions(db, { project: slug, limit: 10 }), ["id", "behavior_name", "status", "current_tick", "active_node_path"]);
      console.log(`
=== Reactive Triggers for ${slug} ===`);
      console.table(TriggerRegistry.listTriggers(db, slug), ["id", "name", "behavior_name", "condition_type", "priority", "is_enabled"]);
      break;
    }
    case "audit": {
      const slug = getProjectSlug(project);
      const db = getDb(slug);
      const audit = verifyEventChain(db, slug);
      console.log(`Audit result for "${slug}":`, audit);
      break;
    }
    case "view": {
      console.log(`Interactive visualizer available at: ${path2.resolve(process.cwd(), "viewer.html")}`);
      break;
    }
    case "update": {
      console.log(`@putervision/behavior-runtime-mcp is up to date (v${getVersion()}).`);
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}
main().catch((err) => {
  console.error("Fatal CLI error:", err);
  process.exit(1);
});
//# sourceMappingURL=cli.js.map