import {
  BlackboardEngine,
  MetricsEngine,
  RecordingEngine,
  SnapshotEngine,
  server
} from "./chunk-HPFNQ5RR.js";
import {
  BehaviorRegistry,
  BehaviorRuntimeError,
  DatabaseError,
  ExecutionEngine,
  ExecutionError,
  LOG_LEVELS,
  NotFoundError,
  SafetyError,
  TriggerRegistry,
  ValidationError,
  closeAllDbs,
  closeDb,
  computeEventHash,
  computeTreeHash,
  generateId,
  getBaseDir,
  getCurrentIsoString,
  getDb,
  getDbPath,
  getElapsedTimeMs,
  getLogLevel,
  getProjectDbDir,
  getProjectSlug,
  getReadOnlyDb,
  getRegistry,
  getRegistryPath,
  logRuntimeEvent,
  logger,
  parseIsoString,
  registerProject,
  resolveProjectRoot,
  sanitizeSlug,
  unregisterProject,
  validatePath,
  verifyEventChain
} from "./chunk-TV72ORDW.js";

// src/schema/schemas.ts
import { z } from "zod";
var LoadBehaviorSchema = z.object({
  action: z.enum(["load", "unload", "swap"]),
  behavior_name: z.string(),
  behavior_version: z.number().optional(),
  parameters: z.record(z.any()).optional(),
  session_id: z.string().optional(),
  intention_id: z.string().optional(),
  client_request_id: z.string().optional(),
  project: z.string().optional()
});
var SetParametersSchema = z.object({
  action: z.enum(["set", "get", "reset"]),
  execution_id: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  project: z.string().optional()
});
var GetStatusSchema = z.object({
  action: z.enum(["current", "history", "tree_state"]),
  execution_id: z.string().optional(),
  limit: z.number().optional(),
  project: z.string().optional()
});
var AbortBehaviorSchema = z.object({
  action: z.enum(["abort", "pause", "resume"]),
  execution_id: z.string().optional(),
  reason: z.string().optional(),
  project: z.string().optional()
});
var RegisterTriggerSchema = z.object({
  action: z.enum(["register", "list", "update", "remove", "enable", "disable"]),
  name: z.string().optional(),
  behavior_name: z.string().optional(),
  condition_type: z.string().optional(),
  condition_params: z.record(z.any()).optional(),
  priority: z.number().optional(),
  cooldown_ms: z.number().optional(),
  trigger_id: z.string().optional(),
  project: z.string().optional()
});
var ReplayRecordingSchema = z.object({
  action: z.enum(["start", "stop", "list", "capture", "delete"]),
  name: z.string().optional(),
  recording_id: z.string().optional(),
  frames: z.array(z.any()).optional(),
  project: z.string().optional()
});
var GetMetricsSchema = z.object({
  action: z.enum(["current", "history", "aggregate", "compare"]),
  execution_id: z.string().optional(),
  behavior_name: z.string().optional(),
  limit: z.number().optional(),
  project: z.string().optional()
});
var ManageBehaviorsSchema = z.object({
  action: z.enum(["register", "list", "get", "update", "delete", "export", "import"]),
  name: z.string().optional(),
  version: z.number().optional(),
  description: z.string().optional(),
  tree: z.any().optional(),
  tree_json: z.string().optional(),
  client_request_id: z.string().optional(),
  project: z.string().optional()
});
var ManageBlackboardSchema = z.object({
  action: z.enum(["get", "set", "clear", "dump"]),
  execution_id: z.string().optional(),
  key: z.string().optional(),
  value: z.any().optional(),
  blackboard: z.record(z.any()).optional(),
  project: z.string().optional()
});
var ManageRuntimeDbSchema = z.object({
  action: z.enum(["backup", "stats", "audit", "snapshot", "diff", "restore"]),
  name: z.string().optional(),
  description: z.string().optional(),
  project: z.string().optional()
});

// src/engine/browser/conditions.ts
var ConditionRegistry = {
  timer_elapsed: (params, ctx) => {
    const threshold = params.threshold_ticks || 60;
    return ctx.tick >= threshold;
  },
  blackboard_check: (params, ctx) => {
    const key = params.key;
    const expected = params.expected;
    return ctx.blackboard[key] === expected;
  },
  proximity_check: (params, ctx) => {
    const dist = ctx.telemetry.target_distance ?? 999;
    const radius = params.radius ?? 10;
    return dist <= radius;
  }
};

// src/engine/browser/conditions-game.ts
var GameConditionRegistry = {
  hp_below: (params, ctx) => {
    const hp = ctx.telemetry.hp ?? 100;
    const threshold = params.threshold ?? 30;
    return hp < threshold;
  },
  enemy_in_range: (params, ctx) => {
    const enemyDist = ctx.telemetry.enemy_distance ?? 999;
    const range = params.range ?? 15;
    return enemyDist <= range;
  },
  resource_above: (params, ctx) => {
    const amount = ctx.blackboard.resource_count ?? 0;
    const capacity = params.capacity ?? 20;
    return amount >= capacity;
  }
};

// src/engine/browser/actions.ts
var ActionRegistry = {
  move_to: (params, ctx) => {
    ctx.blackboard.current_destination = params.destination || [0, 0, 0];
    return { status: "SUCCESS", output: { destination: ctx.blackboard.current_destination } };
  },
  wait: (params, ctx) => {
    const ticks = params.ticks || 10;
    if (ctx.tick % ticks === 0) return { status: "SUCCESS" };
    return { status: "RUNNING" };
  },
  interact: (params, ctx) => {
    ctx.blackboard.last_interaction = params.target || "object";
    return { status: "SUCCESS", output: { interacted_with: ctx.blackboard.last_interaction } };
  },
  log: (params, ctx) => {
    return { status: "SUCCESS", output: { message: params.message || "Log action executed" } };
  }
};

// src/engine/browser/actions-game.ts
var GameActionRegistry = {
  attack_nearest: (params, ctx) => {
    ctx.blackboard.last_attack_target = "nearest_enemy";
    return { status: "SUCCESS", output: { action: "attack", target: "nearest_enemy" } };
  },
  flee_to_safety: (params, ctx) => {
    ctx.blackboard.fleeing = true;
    return { status: "SUCCESS", output: { action: "flee", waypoint: "base" } };
  },
  gather: (params, ctx) => {
    const current = ctx.blackboard.resource_count || 0;
    ctx.blackboard.resource_count = current + 1;
    return { status: "SUCCESS", output: { resource_count: ctx.blackboard.resource_count } };
  },
  heal: (params, ctx) => {
    ctx.blackboard.healing = true;
    return { status: "SUCCESS", output: { action: "use_potion" } };
  }
};

// src/engine/browser/executor-bundle.ts
var BehaviorTreeEvaluator = class {
  tree;
  blackboard;
  tickCount = 0;
  constructor(tree, initialBlackboard = {}) {
    this.tree = tree;
    this.blackboard = { ...initialBlackboard };
  }
  step(telemetry = {}) {
    this.tickCount++;
    const ctx = {
      blackboard: this.blackboard,
      telemetry,
      tick: this.tickCount
    };
    const res = this.evaluateNode(this.tree, "root", ctx);
    return {
      status: res.status,
      activePath: res.activePath,
      blackboard: this.blackboard
    };
  }
  evaluateNode(node, path, ctx) {
    switch (node.type) {
      case "sequence": {
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
          const childPath = `${path}/seq_${i}_${children[i].type}`;
          const childRes = this.evaluateNode(children[i], childPath, ctx);
          if (childRes.status !== "SUCCESS") {
            return { status: childRes.status, activePath: childRes.activePath };
          }
        }
        return { status: "SUCCESS", activePath: path };
      }
      case "selector": {
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
          const childPath = `${path}/sel_${i}_${children[i].type}`;
          const childRes = this.evaluateNode(children[i], childPath, ctx);
          if (childRes.status !== "FAILURE") {
            return { status: childRes.status, activePath: childRes.activePath };
          }
        }
        return { status: "FAILURE", activePath: path };
      }
      case "condition": {
        const condFn = ConditionRegistry[node.name || ""] || GameConditionRegistry[node.name || ""];
        const passed = condFn ? condFn(node.parameters || {}, ctx) : true;
        return { status: passed ? "SUCCESS" : "FAILURE", activePath: path };
      }
      case "action": {
        const actFn = ActionRegistry[node.name || ""] || GameActionRegistry[node.name || ""];
        const actRes = actFn ? actFn(node.parameters || {}, ctx) : { status: "SUCCESS" };
        return { status: actRes.status, activePath: path };
      }
      case "inverter": {
        if (!node.children || node.children.length === 0) return { status: "SUCCESS", activePath: path };
        const childRes = this.evaluateNode(node.children[0], `${path}/inv`, ctx);
        if (childRes.status === "SUCCESS") return { status: "FAILURE", activePath: childRes.activePath };
        if (childRes.status === "FAILURE") return { status: "SUCCESS", activePath: childRes.activePath };
        return childRes;
      }
      default:
        return { status: "SUCCESS", activePath: path };
    }
  }
};

// src/engine/browser/injector.ts
var BrowserInjector = class {
  static getInjectionScript(tree, allowlistOrigins = ["*"]) {
    return `
      (function() {
        const allowed = ${JSON.stringify(allowlistOrigins)};
        const origin = window.location.origin;
        if (!allowed.includes('*') && !allowed.includes(origin)) {
          console.warn('[BEHAVIOR_RUNTIME] Origin rejected: ' + origin);
          return;
        }

        window.__BEHAVIOR_RUNTIME__ = window.__BEHAVIOR_RUNTIME__ || {
          enabled: true,
          tickCount: 0,
          currentStatus: 'idle',
          activeNodePath: 'root',
          blackboard: {},
          tree: ${JSON.stringify(tree)},
        };

        console.log('[BEHAVIOR_RUNTIME] Injected behavior runtime for tree: ' + '${tree.id || "root"}');
      })();
    `;
  }
};

// src/engine/watchdog.ts
var WatchdogTimer = class {
  lastTickTime = Date.now();
  maxAllowedDeltaMs;
  constructor(maxAllowedDeltaMs = 5e3) {
    this.maxAllowedDeltaMs = maxAllowedDeltaMs;
  }
  feed() {
    this.lastTickTime = Date.now();
  }
  isExpired() {
    return Date.now() - this.lastTickTime > this.maxAllowedDeltaMs;
  }
};

// src/engine/stuck-detector.ts
var StuckDetector = class {
  lastNodes = [];
  maxHistory = 50;
  checkStuck(currentNodePath) {
    this.lastNodes.push(currentNodePath);
    if (this.lastNodes.length > this.maxHistory) {
      this.lastNodes.shift();
    }
    if (this.lastNodes.length >= 30) {
      const allSame = this.lastNodes.every((p) => p === currentNodePath);
      if (allSame) {
        return { isStuck: true, score: 1 };
      }
    }
    return { isStuck: false, score: 0 };
  }
};

// src/engine/rate-limiter.ts
var ActionRateLimiter = class {
  actionTimestamps = [];
  maxPerSecond;
  constructor(maxPerSecond = 60) {
    this.maxPerSecond = maxPerSecond;
  }
  allowAction() {
    const now = Date.now();
    this.actionTimestamps = this.actionTimestamps.filter((t) => now - t < 1e3);
    if (this.actionTimestamps.length >= this.maxPerSecond) {
      return false;
    }
    this.actionTimestamps.push(now);
    return true;
  }
};

// src/engine/policy-gate.ts
var PolicyGate = class {
  deniedActions = /* @__PURE__ */ new Set(["delete_item", "spend_currency", "irreversible_trade"]);
  isAllowed(actionName) {
    return !this.deniedActions.has(actionName);
  }
};

// src/engine/safety.ts
var EmergencySafety = class {
  static killSwitchEngaged = false;
  static engageKillSwitch() {
    this.killSwitchEngaged = true;
  }
  static isSafe() {
    return !this.killSwitchEngaged;
  }
  static resetSafety() {
    this.killSwitchEngaged = false;
  }
};
export {
  AbortBehaviorSchema,
  ActionRateLimiter,
  ActionRegistry,
  BehaviorRegistry,
  BehaviorRuntimeError,
  BehaviorTreeEvaluator,
  BlackboardEngine,
  BrowserInjector,
  ConditionRegistry,
  DatabaseError,
  EmergencySafety,
  ExecutionEngine,
  ExecutionError,
  GameActionRegistry,
  GameConditionRegistry,
  GetMetricsSchema,
  GetStatusSchema,
  LOG_LEVELS,
  LoadBehaviorSchema,
  ManageBehaviorsSchema,
  ManageBlackboardSchema,
  ManageRuntimeDbSchema,
  MetricsEngine,
  NotFoundError,
  PolicyGate,
  RecordingEngine,
  RegisterTriggerSchema,
  ReplayRecordingSchema,
  SafetyError,
  SetParametersSchema,
  SnapshotEngine,
  StuckDetector,
  TriggerRegistry,
  ValidationError,
  WatchdogTimer,
  closeAllDbs,
  closeDb,
  computeEventHash,
  computeTreeHash,
  generateId,
  getBaseDir,
  getCurrentIsoString,
  getDb,
  getDbPath,
  getElapsedTimeMs,
  getLogLevel,
  getProjectDbDir,
  getProjectSlug,
  getReadOnlyDb,
  getRegistry,
  getRegistryPath,
  logRuntimeEvent,
  logger,
  parseIsoString,
  registerProject,
  resolveProjectRoot,
  sanitizeSlug,
  server,
  unregisterProject,
  validatePath,
  verifyEventChain
};
//# sourceMappingURL=lib.js.map