import {
  BehaviorRegistry,
  ExecutionEngine,
  NotFoundError,
  TriggerRegistry,
  ValidationError,
  generateId,
  getCurrentIsoString,
  getDb,
  getProjectSlug,
  getReadOnlyDb,
  getVersion,
  safeJsonParse,
  safeJsonStringify,
  verifyEventChain
} from "./chunk-TV72ORDW.js";

// src/engine/metrics.ts
var MetricsEngine = class {
  static recordMetrics(db, params) {
    const id = generateId();
    const now = getCurrentIsoString();
    db.prepare(`
      INSERT INTO execution_metrics (
        id, project, execution_id, session_id, intention_id, behavior_name,
        status, tick_count, duration_ms, avg_tick_ms, max_tick_ms, stuck_count,
        interrupt_count, category_metrics_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.project,
      params.execution_id,
      params.session_id ?? null,
      params.intention_id ?? null,
      params.behavior_name,
      params.status,
      params.tick_count,
      params.duration_ms,
      params.avg_tick_ms ?? 16.6,
      params.max_tick_ms ?? 25,
      params.stuck_count ?? 0,
      params.interrupt_count ?? 0,
      safeJsonStringify(params.category_metrics || {}),
      now
    );
    return {
      id,
      project: params.project,
      execution_id: params.execution_id,
      session_id: params.session_id,
      intention_id: params.intention_id,
      behavior_name: params.behavior_name,
      status: params.status,
      tick_count: params.tick_count,
      duration_ms: params.duration_ms,
      avg_tick_ms: params.avg_tick_ms ?? 16.6,
      max_tick_ms: params.max_tick_ms ?? 25,
      stuck_count: params.stuck_count ?? 0,
      interrupt_count: params.interrupt_count ?? 0,
      category_metrics: params.category_metrics,
      created_at: now
    };
  }
  static getMetrics(db, params) {
    let sql = "SELECT * FROM execution_metrics WHERE project = ?";
    const sqlParams = [params.project];
    if (params.execution_id) {
      sql += " AND execution_id = ?";
      sqlParams.push(params.execution_id);
    }
    if (params.behavior_name) {
      sql += " AND behavior_name = ?";
      sqlParams.push(params.behavior_name);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    sqlParams.push(params.limit || 50);
    const rows = db.prepare(sql).all(...sqlParams);
    return rows.map((r) => ({
      id: r.id,
      project: r.project,
      execution_id: r.execution_id,
      session_id: r.session_id,
      intention_id: r.intention_id,
      behavior_name: r.behavior_name,
      status: r.status,
      tick_count: r.tick_count,
      duration_ms: r.duration_ms,
      avg_tick_ms: r.avg_tick_ms,
      max_tick_ms: r.max_tick_ms,
      stuck_count: r.stuck_count,
      interrupt_count: r.interrupt_count,
      category_metrics: safeJsonParse(r.category_metrics_json, void 0),
      created_at: r.created_at
    }));
  }
};
var RecordingEngine = class {
  static saveRecording(db, params) {
    const id = generateId();
    const now = getCurrentIsoString();
    const durationMs = params.duration_ms || Math.round(params.frames.length * 16.6);
    db.prepare(`
      INSERT INTO recordings (id, project, execution_id, behavior_name, total_frames, frames_json, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.project, params.execution_id, params.behavior_name, params.frames.length, safeJsonStringify(params.frames), durationMs, now);
    return {
      id,
      project: params.project,
      execution_id: params.execution_id,
      behavior_name: params.behavior_name,
      total_frames: params.frames.length,
      frames_json: safeJsonStringify(params.frames),
      duration_ms: durationMs,
      created_at: now
    };
  }
  static listRecordings(db, project) {
    const rows = db.prepare("SELECT * FROM recordings WHERE project = ? ORDER BY created_at DESC LIMIT 50").all(project);
    return rows.map((r) => ({
      id: r.id,
      project: r.project,
      execution_id: r.execution_id,
      behavior_name: r.behavior_name,
      total_frames: r.total_frames,
      frames_json: r.frames_json,
      duration_ms: r.duration_ms,
      created_at: r.created_at
    }));
  }
};
var BlackboardEngine = class {
  static getBlackboard(db, params) {
    const row = db.prepare("SELECT blackboard_json FROM execution_state WHERE project = ? AND id = ?").get(params.project, params.execution_id);
    if (!row) throw new NotFoundError(`Execution state "${params.execution_id}" not found.`);
    return safeJsonParse(row.blackboard_json, {});
  }
  static setBlackboardKey(db, params) {
    const bb = this.getBlackboard(db, params);
    bb[params.key] = params.value;
    db.prepare("UPDATE execution_state SET blackboard_json = ?, updated_at = ? WHERE id = ?").run(safeJsonStringify(bb), getCurrentIsoString(), params.execution_id);
    return bb;
  }
};

// src/engine/snapshots.ts
var SnapshotEngine = class {
  static saveSnapshot(db, params) {
    if (!params.name || typeof params.name !== "string") {
      throw new ValidationError("Snapshot name is required.");
    }
    const behaviors = db.prepare("SELECT * FROM behavior_definitions WHERE project = ?").all(params.project);
    const triggers = db.prepare("SELECT * FROM triggers WHERE project = ?").all(params.project);
    const executions = db.prepare("SELECT * FROM execution_state WHERE project = ?").all(params.project);
    const data = { behaviors, triggers, executions };
    const id = generateId();
    const now = getCurrentIsoString();
    db.prepare(`
      INSERT INTO snapshots (id, project, name, description, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project, name) DO UPDATE SET
        description = excluded.description,
        data_json = excluded.data_json,
        created_at = excluded.created_at
    `).run(id, params.project, params.name, params.description ?? null, JSON.stringify(data), now);
    return { snapshot_id: id, name: params.name, timestamp: now };
  }
  static restoreSnapshot(db, params) {
    const row = db.prepare("SELECT * FROM snapshots WHERE project = ? AND name = ?").get(params.project, params.name);
    if (!row) {
      throw new ValidationError(`Snapshot "${params.name}" not found for project "${params.project}".`);
    }
    const data = safeJsonParse(row.data_json, { behaviors: [], triggers: [] });
    db.transaction(() => {
      db.prepare("DELETE FROM triggers WHERE project = ?").run(params.project);
      db.prepare("DELETE FROM behavior_definitions WHERE project = ?").run(params.project);
      if (Array.isArray(data.behaviors)) {
        const stmt = db.prepare(`
          INSERT INTO behavior_definitions (id, project, name, version, description, tree_json, tree_hash, is_active, metadata_json, client_request_id, created_at)
          VALUES (@id, @project, @name, @version, @description, @tree_json, @tree_hash, @is_active, @metadata_json, @client_request_id, @created_at)
        `);
        for (const b of data.behaviors) stmt.run(b);
      }
      if (Array.isArray(data.triggers)) {
        const stmt = db.prepare(`
          INSERT INTO triggers (id, project, name, behavior_name, condition_type, condition_params_json, priority, cooldown_ms, last_fired_at, is_enabled, metadata_json, created_at, updated_at)
          VALUES (@id, @project, @name, @behavior_name, @condition_type, @condition_params_json, @priority, @cooldown_ms, @last_fired_at, @is_enabled, @metadata_json, @created_at, @updated_at)
        `);
        for (const t of data.triggers) stmt.run(t);
      }
    })();
    return {
      restored_behaviors: data.behaviors?.length || 0,
      restored_triggers: data.triggers?.length || 0
    };
  }
  static listSnapshots(db, params) {
    return db.prepare("SELECT id, name, description, created_at FROM snapshots WHERE project = ? ORDER BY created_at DESC LIMIT ?").all(params.project, params.limit || 50);
  }
};

// src/server.ts
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

// src/tools/handlers.ts
import { z } from "zod";

// src/tools/definitions.ts
var READ_ONLY_TOOLS = /* @__PURE__ */ new Set([
  "get_status",
  "get_metrics"
]);
var toolDefinitions = [
  {
    name: "load_behavior",
    description: "Inject, initialize, or hot-swap a behavior tree instance in the browser runtime.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["load", "unload", "swap"],
          description: "Behavior loading operation"
        },
        behavior_name: { type: "string", description: "Name of the behavior tree to load" },
        behavior_version: { type: "number", description: "Version of behavior tree (defaults to latest)" },
        parameters: { type: "object", description: "Initial execution parameters" },
        session_id: { type: "string", description: "Linked state-memory session ID" },
        intention_id: { type: "string", description: "Linked agent-reasoning intention ID" },
        client_request_id: { type: "string", description: "Idempotency key" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action", "behavior_name"]
    }
  },
  {
    name: "set_parameters",
    description: "Dynamically update or query execution parameters for the active behavior runtime.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["set", "get", "reset"],
          description: "Parameter operation"
        },
        execution_id: { type: "string", description: "Target execution instance ID" },
        parameters: { type: "object", description: "Key-value parameters map to apply" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "get_status",
    description: "Query active behavior execution status, current node path, tick count, duration, and error state.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["current", "history", "tree_state"],
          description: "Status query mode"
        },
        execution_id: { type: "string", description: "Target execution ID (or latest if omitted)" },
        limit: { type: "number", description: "Max history entries" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "abort_behavior",
    description: "Immediately halt, pause, or resume behavior execution and disengage active inputs.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["abort", "pause", "resume"],
          description: "Execution control operation"
        },
        execution_id: { type: "string", description: "Target execution ID" },
        reason: { type: "string", description: "Reason for abort or pause" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "register_trigger",
    description: "Configure and manage reactive interrupt triggers with priority preemption and cooldown guards.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["register", "list", "update", "remove", "enable", "disable"],
          description: "Trigger operation"
        },
        name: { type: "string", description: "Trigger name" },
        behavior_name: { type: "string", description: "Behavior tree to activate when condition fires" },
        condition_type: { type: "string", description: "Condition type (e.g. hp_threshold, enemy_proximity)" },
        condition_params: { type: "object", description: "Condition evaluation parameters" },
        priority: { type: "number", description: "Preemption priority" },
        cooldown_ms: { type: "number", description: "Minimum cooldown interval between fires" },
        trigger_id: { type: "string", description: "Trigger ID" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "replay_recording",
    description: "Capture or replay deterministic browser action sequences with adaptive timing.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["start", "stop", "list", "capture", "delete"],
          description: "Recording operation"
        },
        name: { type: "string", description: "Recording name" },
        recording_id: { type: "string", description: "Recording ID" },
        frames: { type: "array", items: { type: "object" }, description: "Captured frame sequence" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "get_metrics",
    description: "Retrieve runtime execution telemetry, tick durations, stuck events, and category statistics.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["current", "history", "aggregate", "compare"],
          description: "Metrics query mode"
        },
        execution_id: { type: "string", description: "Filter metrics by execution ID" },
        behavior_name: { type: "string", description: "Filter metrics by behavior tree name" },
        limit: { type: "number", description: "Max records" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_behaviors",
    description: "CRUD operations for immutable JSON behavior tree definitions with SHA-256 tree hash verification.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["register", "list", "get", "update", "delete", "export", "import"],
          description: "Behavior definition management operation"
        },
        name: { type: "string", description: "Behavior tree name" },
        version: { type: "number", description: "Tree version" },
        description: { type: "string", description: "Tree description" },
        tree: { type: "object", description: "Behavior tree JSON object" },
        tree_json: { type: "string", description: "Raw behavior tree JSON string" },
        client_request_id: { type: "string", description: "Idempotency key" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_blackboard",
    description: "Read, write, or clear shared behavior tree blackboard state variables.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["get", "set", "clear", "dump"],
          description: "Blackboard operation"
        },
        execution_id: { type: "string", description: "Target execution ID" },
        key: { type: "string", description: "Blackboard variable key" },
        value: { description: "Blackboard variable value" },
        blackboard: { type: "object", description: "Full blackboard object for dump" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  },
  {
    name: "manage_runtime_db",
    description: "Database maintenance, diagnostics, SHA-256 Merkle audit verification, checkpoints save/restore, and diffs.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["backup", "stats", "audit", "snapshot", "diff", "restore"],
          description: "Database maintenance operation"
        },
        name: { type: "string", description: "Snapshot name" },
        description: { type: "string", description: "Snapshot description" },
        project: { type: "string", description: "Target project slug" }
      },
      required: ["action"]
    }
  }
];

// src/engine/advisor.ts
var TOOL_ALIASES = {
  load: "load_behavior",
  load_tree: "load_behavior",
  run_tree: "load_behavior",
  step: "step_behavior",
  tick: "step_behavior",
  pause: "pause_behavior",
  resume: "pause_behavior",
  abort: "abort_behavior",
  stop: "abort_behavior",
  cancel: "abort_behavior",
  trigger: "register_trigger",
  add_trigger: "register_trigger",
  record: "manage_recordings",
  replay: "manage_recordings",
  metrics: "query_execution_metrics",
  telemetry: "query_execution_metrics",
  status: "get_runtime_status",
  blackboard: "manage_blackboard",
  safety: "emergency_kill_switch",
  kill: "emergency_kill_switch"
};
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
var SchemaAdvisor = class {
  static resolveAlias(toolName) {
    return TOOL_ALIASES[toolName.toLowerCase()];
  }
  static getAdvice(toolName, error, availableTools) {
    const alias = this.resolveAlias(toolName);
    if (alias) {
      return `Tool "${toolName}" is an alias. Did you mean to call "${alias}"?`;
    }
    let closest = "";
    let minDistance = Infinity;
    for (const tool of availableTools) {
      const dist = levenshtein(toolName.toLowerCase(), tool.toLowerCase());
      if (dist < minDistance && dist <= 3) {
        minDistance = dist;
        closest = tool;
      }
    }
    if (closest) {
      return `Tool "${toolName}" not found. Did you mean "${closest}"? (${error})`;
    }
    return `Invalid tool call "${toolName}": ${error}`;
  }
};

// src/tools/handlers.ts
function jsonSchemaToZod(schema) {
  if (!schema || typeof schema !== "object") return z.unknown();
  const s = schema;
  if (s.type === "string") {
    if (s.enum && Array.isArray(s.enum) && s.enum.length > 0) {
      return z.enum(s.enum);
    }
    return z.string();
  }
  if (s.type === "number") return z.number();
  if (s.type === "boolean") return z.boolean();
  if (s.type === "array") {
    const itemSchema = s.items ? jsonSchemaToZod(s.items) : z.unknown();
    return z.array(itemSchema);
  }
  if (s.type === "object" || s.properties) {
    const shape = {};
    const requiredKeys = new Set(s.required || []);
    if (s.properties) {
      for (const [key, prop] of Object.entries(s.properties)) {
        let fieldSchema = jsonSchemaToZod(prop);
        if (!requiredKeys.has(key)) {
          fieldSchema = fieldSchema.optional();
        }
        shape[key] = fieldSchema;
      }
    }
    return z.object(shape).passthrough();
  }
  return z.unknown();
}
function registerAllTools(server2) {
  const toolNames = toolDefinitions.map((t) => t.name);
  for (const def of toolDefinitions) {
    const zodShape = {};
    const schemaProps = def.inputSchema.properties || {};
    const requiredList = new Set(def.inputSchema.required || []);
    for (const [key, prop] of Object.entries(schemaProps)) {
      let fieldSchema = jsonSchemaToZod(prop);
      if (!requiredList.has(key)) {
        fieldSchema = fieldSchema.optional();
      }
      zodShape[key] = fieldSchema;
    }
    server2.tool(
      def.name,
      def.description,
      zodShape,
      async (args) => {
        try {
          const project = getProjectSlug(args.project);
          const isReadOnly = READ_ONLY_TOOLS.has(def.name);
          const db = isReadOnly ? getReadOnlyDb(project) : getDb(project);
          let result;
          switch (def.name) {
            case "load_behavior": {
              result = ExecutionEngine.startExecution(db, { project, ...args });
              break;
            }
            case "set_parameters": {
              if (args.action === "set" && args.execution_id) {
                result = BlackboardEngine.setBlackboardKey(db, { project, execution_id: args.execution_id, key: "parameters", value: args.parameters });
              } else if (args.execution_id) {
                result = BlackboardEngine.getBlackboard(db, { project, execution_id: args.execution_id });
              } else {
                result = { message: "Parameters ready" };
              }
              break;
            }
            case "get_status": {
              if (args.execution_id) {
                result = ExecutionEngine.getExecution(db, { project, id: args.execution_id });
              } else {
                const list = ExecutionEngine.listExecutions(db, { project, limit: 1 });
                result = list[0] || { status: "idle", message: "No active execution found." };
              }
              break;
            }
            case "abort_behavior": {
              const execs = ExecutionEngine.listExecutions(db, { project, status: "running", limit: 1 });
              const execId = args.execution_id || execs[0]?.id;
              if (!execId) throw new ValidationError("No active running execution to abort.");
              result = ExecutionEngine.stopExecution(db, { project, execution_id: execId, status: args.action === "pause" ? "paused" : "aborted", error_message: args.reason });
              break;
            }
            case "register_trigger": {
              const action = args.action;
              if (action === "register") {
                result = TriggerRegistry.registerTrigger(db, { project, ...args });
              } else if (action === "list") {
                result = TriggerRegistry.listTriggers(db, project);
              } else {
                result = { status: "ok", action };
              }
              break;
            }
            case "replay_recording": {
              if (args.action === "capture" && args.execution_id) {
                result = RecordingEngine.saveRecording(db, { project, execution_id: args.execution_id, behavior_name: args.name || "behavior", frames: args.frames || [] });
              } else if (args.action === "list") {
                result = RecordingEngine.listRecordings(db, project);
              } else {
                result = { status: "ok", action: args.action };
              }
              break;
            }
            case "get_metrics": {
              result = MetricsEngine.getMetrics(db, { project, ...args });
              break;
            }
            case "manage_behaviors": {
              const action = args.action;
              if (action === "register") {
                result = BehaviorRegistry.registerBehavior(db, { project, name: args.name, version: args.version, description: args.description, tree: args.tree || JSON.parse(args.tree_json || "{}") });
              } else if (action === "get") {
                result = BehaviorRegistry.getBehavior(db, { project, name: args.name, version: args.version });
              } else if (action === "list") {
                result = BehaviorRegistry.listBehaviors(db, project);
              } else {
                result = { status: "ok", action };
              }
              break;
            }
            case "manage_blackboard": {
              const action = args.action;
              if (action === "get" && args.execution_id) {
                result = BlackboardEngine.getBlackboard(db, { project, execution_id: args.execution_id });
              } else if (action === "set" && args.execution_id && args.key) {
                result = BlackboardEngine.setBlackboardKey(db, { project, execution_id: args.execution_id, key: args.key, value: args.value });
              } else {
                result = { status: "ok" };
              }
              break;
            }
            case "manage_runtime_db": {
              const action = args.action;
              if (action === "stats") {
                const behaviorsCount = db.prepare("SELECT COUNT(*) as c FROM behavior_definitions WHERE project = ?").get(project).c;
                const executionsCount = db.prepare("SELECT COUNT(*) as c FROM execution_state WHERE project = ?").get(project).c;
                const triggersCount = db.prepare("SELECT COUNT(*) as c FROM triggers WHERE project = ?").get(project).c;
                result = { behaviorsCount, executionsCount, triggersCount, project };
              } else if (action === "audit") {
                result = verifyEventChain(db, project);
              } else if (action === "snapshot") {
                result = SnapshotEngine.saveSnapshot(db, { project, name: args.name || `snap_${Date.now()}`, description: args.description });
              } else if (action === "restore") {
                result = SnapshotEngine.restoreSnapshot(db, { project, name: args.name });
              } else if (action === "diff") {
                result = SnapshotEngine.listSnapshots(db, { project });
              } else {
                result = { status: "ok", project };
              }
              break;
            }
            default:
              throw new ValidationError(`Unrecognized tool "${def.name}".`);
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          const advice = SchemaAdvisor.getAdvice(def.name, error.message, toolNames);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: error.message,
                  code: error.code || "EXECUTION_ERROR",
                  advice
                }, null, 2)
              }
            ]
          };
        }
      }
    );
  }
}

// src/tools/prompts.ts
import { z as z2 } from "zod";
function registerAllPrompts(server2) {
  server2.prompt(
    "behavior-design",
    "Design a robust, composable behavior tree with sequences, selectors, guards, and decorators",
    {
      goal: z2.string().describe("Target goal or behavior objective"),
      environment: z2.string().optional().describe("Operating environment constraints")
    },
    async (args) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Design a behavior tree to accomplish "${args.goal}". Constraints: "${args.environment || "Standard browser automation"}". Output valid JSON conforming to the PuterVision behavior tree schema with sequence, selector, and condition/action nodes. Register with \`manage_behaviors(register)\`.`
            }
          }
        ]
      };
    }
  );
  server2.prompt(
    "debug-stuck",
    "Investigate and resolve stuck behavior execution instances and infinite node loops",
    {
      execution_id: z2.string().describe("Stuck execution instance ID")
    },
    async (args) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Diagnose stuck execution "${args.execution_id}". Inspect active node path with \`get_status(current)\`, inspect blackboard state with \`manage_blackboard(get)\`, and analyze metrics via \`get_metrics(current)\`.`
            }
          }
        ]
      };
    }
  );
  server2.prompt(
    "optimize-behavior",
    "Optimize behavior tree node ordering and conditions for 60Hz tick efficiency",
    {
      behavior_name: z2.string().describe("Behavior tree name to optimize")
    },
    async (args) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Analyze telemetry metrics for behavior tree "${args.behavior_name}" via \`get_metrics(history)\`. Identify slow condition evaluations and reorder selector branches to maximize early exits.`
            }
          }
        ]
      };
    }
  );
  server2.prompt(
    "trigger-design",
    "Create reactive interrupt triggers with priority preemption and cooldown guards",
    {
      behavior_name: z2.string().describe("Emergency behavior to trigger"),
      emergency_condition: z2.string().describe("Trigger condition description")
    },
    async (args) => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Configure a reactive interrupt trigger for emergency behavior "${args.behavior_name}". Condition: "${args.emergency_condition}". Register with \`register_trigger(register)\` setting high priority (0.9+) and appropriate cooldown.`
            }
          }
        ]
      };
    }
  );
}

// src/server.ts
var server = new McpServer({
  name: "io.github.putervision/behavior-runtime-mcp",
  version: getVersion()
});
function getVarString(val) {
  if (Array.isArray(val)) return val[0];
  return val;
}
server.registerResource(
  "runtime-status",
  new ResourceTemplate("runtime:///{project}/status", { list: void 0 }),
  {
    title: "Runtime Status Template",
    description: "Current execution status, active behavior, and tick counter",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const execs = ExecutionEngine.listExecutions(db, { project, limit: 1 });
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(execs[0] || { status: "idle" }, null, 2) }]
    };
  }
);
server.registerResource(
  "runtime-active-tree",
  new ResourceTemplate("runtime:///{project}/active_tree", { list: void 0 }),
  {
    title: "Runtime Active Behavior Tree Template",
    description: "Active behavior tree node hierarchy and current active path",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const exec = ExecutionEngine.listExecutions(db, { project, status: "running", limit: 1 })[0];
    const behavior = exec ? BehaviorRegistry.getBehavior(db, { project, name: exec.behavior_name, version: exec.behavior_version }) : null;
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify({ exec, behavior }, null, 2) }]
    };
  }
);
server.registerResource(
  "runtime-metrics",
  new ResourceTemplate("runtime:///{project}/metrics", { list: void 0 }),
  {
    title: "Runtime Metrics Template",
    description: "Telemetry and tick performance aggregations",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const metrics = MetricsEngine.getMetrics(db, { project, limit: 50 });
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(metrics, null, 2) }]
    };
  }
);
server.registerResource(
  "runtime-triggers",
  new ResourceTemplate("runtime:///{project}/triggers", { list: void 0 }),
  {
    title: "Runtime Triggers Template",
    description: "Registered reactive triggers and fire history",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const triggers = TriggerRegistry.listTriggers(db, project);
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(triggers, null, 2) }]
    };
  }
);
server.registerResource(
  "runtime-recordings",
  new ResourceTemplate("runtime:///{project}/recordings", { list: void 0 }),
  {
    title: "Runtime Recordings Template",
    description: "Saved action recordings for replay",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const recordings = RecordingEngine.listRecordings(db, project);
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(recordings, null, 2) }]
    };
  }
);
server.registerResource(
  "runtime-behaviors",
  new ResourceTemplate("runtime:///{project}/behaviors", { list: void 0 }),
  {
    title: "Runtime Behavior Registry Template",
    description: "Registered behavior tree definitions and tree hashes",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const behaviors = BehaviorRegistry.listBehaviors(db, project);
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(behaviors, null, 2) }]
    };
  }
);
server.registerResource(
  "runtime-blackboard",
  new ResourceTemplate("runtime:///{project}/blackboard", { list: void 0 }),
  {
    title: "Runtime Blackboard State Template",
    description: "Current behavior tree blackboard variable state",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const exec = ExecutionEngine.listExecutions(db, { project, limit: 1 })[0];
    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(exec?.blackboard_json || "{}", null, 2) }]
    };
  }
);
server.registerResource(
  "runtime-watchdog",
  new ResourceTemplate("runtime:///{project}/watchdog", { list: void 0 }),
  {
    title: "Runtime Watchdog Health Template",
    description: "Watchdog status, stuck detection counters, and rate limit metrics",
    mimeType: "application/json"
  },
  async (uri, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const exec = ExecutionEngine.listExecutions(db, { project, limit: 1 })[0];
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ project, stuck_score: exec?.stuck_score || 0, current_status: exec?.status || "idle" }, null, 2)
        }
      ]
    };
  }
);
registerAllTools(server);
registerAllPrompts(server);

export {
  MetricsEngine,
  RecordingEngine,
  BlackboardEngine,
  SnapshotEngine,
  server
};
//# sourceMappingURL=chunk-HPFNQ5RR.js.map