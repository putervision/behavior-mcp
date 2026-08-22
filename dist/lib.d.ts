import { z } from 'zod';
import Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type BehaviorId = string & {
    readonly __brand: unique symbol;
};
type ExecutionId = string & {
    readonly __brand: unique symbol;
};
type TriggerId = string & {
    readonly __brand: unique symbol;
};
type RecordingId = string & {
    readonly __brand: unique symbol;
};
type SnapshotId = string & {
    readonly __brand: unique symbol;
};
type EventId = string & {
    readonly __brand: unique symbol;
};
type ExecutionStatus = 'idle' | 'running' | 'paused' | 'success' | 'failed' | 'stuck' | 'aborted' | 'interrupted';
type NodeStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING' | 'INVALID';
interface BehaviorDefinition {
    id: BehaviorId;
    project: string;
    name: string;
    version: number;
    description?: string;
    tree_json: string;
    tree_hash: string;
    is_active: boolean;
    metadata?: Record<string, unknown>;
    client_request_id?: string;
    created_at: string;
}
interface BehaviorTreeNode {
    id: string;
    type: 'sequence' | 'selector' | 'parallel' | 'inverter' | 'repeater' | 'timeout' | 'cooldown' | 'guard' | 'action' | 'condition';
    name?: string;
    parameters?: Record<string, unknown>;
    children?: BehaviorTreeNode[];
    guard?: BehaviorTreeNode;
    timeout_ms?: number;
    cooldown_ms?: number;
    repeat_count?: number;
}
interface ExecutionState {
    id: ExecutionId;
    project: string;
    behavior_name: string;
    behavior_version: number;
    session_id?: string;
    intention_id?: string;
    status: ExecutionStatus;
    active_node_path?: string;
    blackboard_json: string;
    current_tick: number;
    tick_rate_hz: number;
    duration_ms: number;
    stuck_score: number;
    error?: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
interface ReactiveTrigger {
    id: TriggerId;
    project: string;
    name: string;
    behavior_name: string;
    condition_type: string;
    condition_params: Record<string, unknown>;
    priority: number;
    cooldown_ms: number;
    last_fired_at?: string;
    is_enabled: boolean;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
interface ExecutionMetrics {
    id: string;
    project: string;
    execution_id: ExecutionId;
    session_id?: string;
    intention_id?: string;
    behavior_name: string;
    status: ExecutionStatus;
    tick_count: number;
    duration_ms: number;
    avg_tick_ms: number;
    max_tick_ms: number;
    stuck_count: number;
    interrupt_count: number;
    category_metrics?: Record<string, unknown>;
    created_at: string;
}
interface ExecutionRecording {
    id: RecordingId;
    project: string;
    execution_id: ExecutionId;
    behavior_name: string;
    total_frames: number;
    frames_json: string;
    duration_ms: number;
    metadata?: Record<string, unknown>;
    created_at: string;
}
interface RuntimeEvent {
    id: EventId;
    project: string;
    entity_id: string;
    entity_type: 'behavior' | 'execution' | 'trigger' | 'recording' | 'safety';
    action: string;
    prev_hash: string;
    hash: string;
    details?: Record<string, unknown>;
    timestamp: string;
}
interface Outcome {
    intention_id: string;
    execution_id: ExecutionId;
    session_id: string;
    status: ExecutionStatus;
    active_node?: string;
    tick_count: number;
    duration_ms: number;
    metrics?: {
        combat?: {
            damage_dealt: number;
            damage_taken: number;
            kills: number;
        };
        economy?: {
            items_gathered: number;
            gold_earned: number;
        };
        navigation?: {
            distance_traveled: number;
            waypoints_reached: number;
        };
        [key: string]: unknown;
    };
    error_message?: string;
    stuck_reason?: string;
    completed_at: string;
}

declare const LoadBehaviorSchema: z.ZodObject<{
    action: z.ZodEnum<["load", "unload", "swap"]>;
    behavior_name: z.ZodString;
    behavior_version: z.ZodOptional<z.ZodNumber>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    session_id: z.ZodOptional<z.ZodString>;
    intention_id: z.ZodOptional<z.ZodString>;
    client_request_id: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "load" | "unload" | "swap";
    behavior_name: string;
    parameters?: Record<string, any> | undefined;
    behavior_version?: number | undefined;
    intention_id?: string | undefined;
    project?: string | undefined;
    session_id?: string | undefined;
    client_request_id?: string | undefined;
}, {
    action: "load" | "unload" | "swap";
    behavior_name: string;
    parameters?: Record<string, any> | undefined;
    behavior_version?: number | undefined;
    intention_id?: string | undefined;
    project?: string | undefined;
    session_id?: string | undefined;
    client_request_id?: string | undefined;
}>;
declare const SetParametersSchema: z.ZodObject<{
    action: z.ZodEnum<["set", "get", "reset"]>;
    execution_id: z.ZodOptional<z.ZodString>;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "set" | "get" | "reset";
    execution_id?: string | undefined;
    parameters?: Record<string, any> | undefined;
    project?: string | undefined;
}, {
    action: "set" | "get" | "reset";
    execution_id?: string | undefined;
    parameters?: Record<string, any> | undefined;
    project?: string | undefined;
}>;
declare const GetStatusSchema: z.ZodObject<{
    action: z.ZodEnum<["current", "history", "tree_state"]>;
    execution_id: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "current" | "history" | "tree_state";
    execution_id?: string | undefined;
    limit?: number | undefined;
    project?: string | undefined;
}, {
    action: "current" | "history" | "tree_state";
    execution_id?: string | undefined;
    limit?: number | undefined;
    project?: string | undefined;
}>;
declare const AbortBehaviorSchema: z.ZodObject<{
    action: z.ZodEnum<["abort", "pause", "resume"]>;
    execution_id: z.ZodOptional<z.ZodString>;
    reason: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "abort" | "pause" | "resume";
    execution_id?: string | undefined;
    reason?: string | undefined;
    project?: string | undefined;
}, {
    action: "abort" | "pause" | "resume";
    execution_id?: string | undefined;
    reason?: string | undefined;
    project?: string | undefined;
}>;
declare const RegisterTriggerSchema: z.ZodObject<{
    action: z.ZodEnum<["register", "list", "update", "remove", "enable", "disable"]>;
    name: z.ZodOptional<z.ZodString>;
    behavior_name: z.ZodOptional<z.ZodString>;
    condition_type: z.ZodOptional<z.ZodString>;
    condition_params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    priority: z.ZodOptional<z.ZodNumber>;
    cooldown_ms: z.ZodOptional<z.ZodNumber>;
    trigger_id: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "register" | "list" | "update" | "remove" | "enable" | "disable";
    behavior_name?: string | undefined;
    name?: string | undefined;
    priority?: number | undefined;
    project?: string | undefined;
    condition_type?: string | undefined;
    condition_params?: Record<string, any> | undefined;
    cooldown_ms?: number | undefined;
    trigger_id?: string | undefined;
}, {
    action: "register" | "list" | "update" | "remove" | "enable" | "disable";
    behavior_name?: string | undefined;
    name?: string | undefined;
    priority?: number | undefined;
    project?: string | undefined;
    condition_type?: string | undefined;
    condition_params?: Record<string, any> | undefined;
    cooldown_ms?: number | undefined;
    trigger_id?: string | undefined;
}>;
declare const ReplayRecordingSchema: z.ZodObject<{
    action: z.ZodEnum<["start", "stop", "list", "capture", "delete"]>;
    name: z.ZodOptional<z.ZodString>;
    recording_id: z.ZodOptional<z.ZodString>;
    frames: z.ZodOptional<z.ZodArray<z.ZodAny, "many">>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "list" | "start" | "stop" | "capture" | "delete";
    name?: string | undefined;
    recording_id?: string | undefined;
    project?: string | undefined;
    frames?: any[] | undefined;
}, {
    action: "list" | "start" | "stop" | "capture" | "delete";
    name?: string | undefined;
    recording_id?: string | undefined;
    project?: string | undefined;
    frames?: any[] | undefined;
}>;
declare const GetMetricsSchema: z.ZodObject<{
    action: z.ZodEnum<["current", "history", "aggregate", "compare"]>;
    execution_id: z.ZodOptional<z.ZodString>;
    behavior_name: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "current" | "history" | "aggregate" | "compare";
    behavior_name?: string | undefined;
    execution_id?: string | undefined;
    limit?: number | undefined;
    project?: string | undefined;
}, {
    action: "current" | "history" | "aggregate" | "compare";
    behavior_name?: string | undefined;
    execution_id?: string | undefined;
    limit?: number | undefined;
    project?: string | undefined;
}>;
declare const ManageBehaviorsSchema: z.ZodObject<{
    action: z.ZodEnum<["register", "list", "get", "update", "delete", "export", "import"]>;
    name: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    tree: z.ZodOptional<z.ZodAny>;
    tree_json: z.ZodOptional<z.ZodString>;
    client_request_id: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "get" | "register" | "list" | "update" | "delete" | "export" | "import";
    name?: string | undefined;
    description?: string | undefined;
    version?: number | undefined;
    project?: string | undefined;
    client_request_id?: string | undefined;
    tree?: any;
    tree_json?: string | undefined;
}, {
    action: "get" | "register" | "list" | "update" | "delete" | "export" | "import";
    name?: string | undefined;
    description?: string | undefined;
    version?: number | undefined;
    project?: string | undefined;
    client_request_id?: string | undefined;
    tree?: any;
    tree_json?: string | undefined;
}>;
declare const ManageBlackboardSchema: z.ZodObject<{
    action: z.ZodEnum<["get", "set", "clear", "dump"]>;
    execution_id: z.ZodOptional<z.ZodString>;
    key: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodAny>;
    blackboard: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "set" | "get" | "clear" | "dump";
    execution_id?: string | undefined;
    key?: string | undefined;
    blackboard?: Record<string, any> | undefined;
    value?: any;
    project?: string | undefined;
}, {
    action: "set" | "get" | "clear" | "dump";
    execution_id?: string | undefined;
    key?: string | undefined;
    blackboard?: Record<string, any> | undefined;
    value?: any;
    project?: string | undefined;
}>;
declare const ManageRuntimeDbSchema: z.ZodObject<{
    action: z.ZodEnum<["backup", "stats", "audit", "snapshot", "diff", "restore"]>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    project: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "backup" | "stats" | "audit" | "snapshot" | "diff" | "restore";
    name?: string | undefined;
    description?: string | undefined;
    project?: string | undefined;
}, {
    action: "backup" | "stats" | "audit" | "snapshot" | "diff" | "restore";
    name?: string | undefined;
    description?: string | undefined;
    project?: string | undefined;
}>;

declare class BehaviorRuntimeError extends Error {
    readonly code: string;
    readonly details?: unknown;
    constructor(message: string, code?: string, details?: unknown);
}
declare class DatabaseError extends BehaviorRuntimeError {
    constructor(message: string, details?: unknown);
}
declare class ValidationError extends BehaviorRuntimeError {
    constructor(message: string, details?: unknown);
}
declare class NotFoundError extends BehaviorRuntimeError {
    constructor(message: string, details?: unknown);
}
declare class ExecutionError extends BehaviorRuntimeError {
    constructor(message: string, details?: unknown);
}
declare class SafetyError extends BehaviorRuntimeError {
    constructor(message: string, details?: unknown);
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare const LOG_LEVELS: Record<LogLevel, number>;
declare function getLogLevel(): number;
declare const logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
};

declare function generateId(): string;

declare function getCurrentIsoString(): string;
declare function parseIsoString(iso: string): Date;
declare function getElapsedTimeMs(startTimeIso: string): number;

declare function validatePath(filePath: string, project?: string): string;
declare function getRegistryPath(): string;
declare function getRegistry(): Record<string, string>;
declare function registerProject(projectName: string, projectRoot: string): void;
declare function unregisterProject(projectName: string): void;
declare function sanitizeSlug(str: string): string;
declare function resolveProjectRoot(project?: string, cwd?: string): string;
declare function getProjectSlug(project?: string, cwd?: string): string;
declare function getBaseDir(projectRoot: string): string;
declare function getProjectDbDir(project?: string, cwd?: string): string;
declare function getDbPath(project?: string, cwd?: string): string;
declare function getDb(project?: string, cwd?: string): Database.Database;
declare function getReadOnlyDb(project?: string, cwd?: string): Database.Database;
declare function closeDb(project?: string, cwd?: string): void;
declare function closeAllDbs(): void;

declare function computeTreeHash(treeJson: string): string;
declare class BehaviorRegistry {
    static registerBehavior(db: Database.Database, params: {
        project: string;
        name: string;
        version?: number;
        description?: string;
        tree: unknown;
        client_request_id?: string;
    }): BehaviorDefinition;
    static getBehavior(db: Database.Database, params: {
        project: string;
        name: string;
        version?: number;
    }): BehaviorDefinition;
    static listBehaviors(db: Database.Database, project: string): BehaviorDefinition[];
    private static mapRowToBehavior;
}

declare class ExecutionEngine {
    static startExecution(db: Database.Database, params: {
        project: string;
        behavior_name: string;
        behavior_version?: number;
        session_id?: string;
        intention_id?: string;
        parameters?: Record<string, unknown>;
        client_request_id?: string;
    }): ExecutionState;
    static tickExecution(db: Database.Database, params: {
        project: string;
        execution_id: string;
        active_node_path?: string;
        status?: ExecutionStatus;
        stuck_score?: number;
        blackboard?: Record<string, unknown>;
    }): ExecutionState;
    static stopExecution(db: Database.Database, params: {
        project: string;
        execution_id: string;
        status: ExecutionStatus;
        error_message?: string;
    }): Outcome;
    static getExecution(db: Database.Database, params: {
        project: string;
        id: string;
    }): ExecutionState;
    static listExecutions(db: Database.Database, params: {
        project: string;
        status?: ExecutionStatus;
        limit?: number;
    }): ExecutionState[];
    private static mapRowToExecution;
}

declare class TriggerRegistry {
    static registerTrigger(db: Database.Database, params: {
        project: string;
        name: string;
        behavior_name: string;
        condition_type: string;
        condition_params: Record<string, unknown>;
        priority?: number;
        cooldown_ms?: number;
    }): ReactiveTrigger;
    static listTriggers(db: Database.Database, project: string): ReactiveTrigger[];
    static evaluateTriggers(db: Database.Database, params: {
        project: string;
        telemetry: Record<string, any>;
    }): ReactiveTrigger | null;
    private static mapRowToTrigger;
}

declare class MetricsEngine {
    static recordMetrics(db: Database.Database, params: {
        project: string;
        execution_id: string;
        session_id?: string;
        intention_id?: string;
        behavior_name: string;
        status: any;
        tick_count: number;
        duration_ms: number;
        avg_tick_ms?: number;
        max_tick_ms?: number;
        stuck_count?: number;
        interrupt_count?: number;
        category_metrics?: Record<string, unknown>;
    }): ExecutionMetrics;
    static getMetrics(db: Database.Database, params: {
        project: string;
        execution_id?: string;
        behavior_name?: string;
        limit?: number;
    }): ExecutionMetrics[];
}
declare class RecordingEngine {
    static saveRecording(db: Database.Database, params: {
        project: string;
        execution_id: string;
        behavior_name: string;
        frames: any[];
        duration_ms?: number;
    }): ExecutionRecording;
    static listRecordings(db: Database.Database, project: string): ExecutionRecording[];
}
declare class BlackboardEngine {
    static getBlackboard(db: Database.Database, params: {
        project: string;
        execution_id: string;
    }): Record<string, unknown>;
    static setBlackboardKey(db: Database.Database, params: {
        project: string;
        execution_id: string;
        key: string;
        value: unknown;
    }): Record<string, unknown>;
}

declare class SnapshotEngine {
    static saveSnapshot(db: Database.Database, params: {
        project: string;
        name: string;
        description?: string;
    }): {
        snapshot_id: string;
        name: string;
        timestamp: string;
    };
    static restoreSnapshot(db: Database.Database, params: {
        project: string;
        name: string;
    }): {
        restored_behaviors: number;
        restored_triggers: number;
    };
    static listSnapshots(db: Database.Database, params: {
        project: string;
        limit?: number;
    }): Array<{
        id: string;
        name: string;
        description?: string;
        created_at: string;
    }>;
}

declare function computeEventHash(params: {
    prev_hash: string;
    id: string;
    project: string;
    entity_id: string;
    entity_type: string;
    action: string;
    timestamp: string;
    details?: Record<string, unknown>;
}): string;
declare function logRuntimeEvent(db: Database.Database, params: {
    project: string;
    entity_id: string;
    entity_type: 'behavior' | 'execution' | 'trigger' | 'recording' | 'safety';
    action: string;
    details?: Record<string, unknown>;
}): RuntimeEvent;
declare function verifyEventChain(db: Database.Database, project: string): {
    valid: boolean;
    total_events: number;
    corrupted_event_id?: string;
    error?: string;
};

type NodeExecutionResult = {
    status: NodeStatus;
    activePath: string;
    actionOutput?: Record<string, unknown>;
};
interface RuntimeContext {
    blackboard: Record<string, unknown>;
    telemetry: Record<string, unknown>;
    tick: number;
}

declare const ConditionRegistry: Record<string, (params: Record<string, unknown>, ctx: RuntimeContext) => boolean>;

declare const GameConditionRegistry: Record<string, (params: Record<string, unknown>, ctx: RuntimeContext) => boolean>;

declare const ActionRegistry: Record<string, (params: Record<string, unknown>, ctx: RuntimeContext) => {
    status: NodeStatus;
    output?: Record<string, unknown>;
}>;

declare const GameActionRegistry: Record<string, (params: Record<string, unknown>, ctx: RuntimeContext) => {
    status: NodeStatus;
    output?: Record<string, unknown>;
}>;

declare class BehaviorTreeEvaluator {
    private tree;
    private blackboard;
    private tickCount;
    constructor(tree: BehaviorTreeNode, initialBlackboard?: Record<string, unknown>);
    step(telemetry?: Record<string, unknown>): {
        status: NodeStatus;
        activePath: string;
        blackboard: Record<string, unknown>;
    };
    private evaluateNode;
}

declare class BrowserInjector {
    static getInjectionScript(tree: BehaviorTreeNode, allowlistOrigins?: string[]): string;
}

declare class WatchdogTimer {
    private lastTickTime;
    private maxAllowedDeltaMs;
    constructor(maxAllowedDeltaMs?: number);
    feed(): void;
    isExpired(): boolean;
}

declare class StuckDetector {
    private lastNodes;
    private maxHistory;
    checkStuck(currentNodePath: string): {
        isStuck: boolean;
        score: number;
    };
}

declare class ActionRateLimiter {
    private actionTimestamps;
    private maxPerSecond;
    constructor(maxPerSecond?: number);
    allowAction(): boolean;
}

declare class PolicyGate {
    private deniedActions;
    isAllowed(actionName: string): boolean;
}

declare class EmergencySafety {
    private static killSwitchEngaged;
    static engageKillSwitch(): void;
    static isSafe(): boolean;
    static resetSafety(): void;
}

declare const server: McpServer;

export { AbortBehaviorSchema, ActionRateLimiter, ActionRegistry, type BehaviorDefinition, type BehaviorId, BehaviorRegistry, BehaviorRuntimeError, BehaviorTreeEvaluator, type BehaviorTreeNode, BlackboardEngine, BrowserInjector, ConditionRegistry, DatabaseError, EmergencySafety, type EventId, ExecutionEngine, ExecutionError, type ExecutionId, type ExecutionMetrics, type ExecutionRecording, type ExecutionState, type ExecutionStatus, GameActionRegistry, GameConditionRegistry, GetMetricsSchema, GetStatusSchema, LOG_LEVELS, LoadBehaviorSchema, ManageBehaviorsSchema, ManageBlackboardSchema, ManageRuntimeDbSchema, MetricsEngine, type NodeExecutionResult, type NodeStatus, NotFoundError, type Outcome, PolicyGate, type ReactiveTrigger, RecordingEngine, type RecordingId, RegisterTriggerSchema, ReplayRecordingSchema, type RuntimeContext, type RuntimeEvent, SafetyError, SetParametersSchema, SnapshotEngine, type SnapshotId, StuckDetector, type TriggerId, TriggerRegistry, ValidationError, WatchdogTimer, closeAllDbs, closeDb, computeEventHash, computeTreeHash, generateId, getBaseDir, getCurrentIsoString, getDb, getDbPath, getElapsedTimeMs, getLogLevel, getProjectDbDir, getProjectSlug, getReadOnlyDb, getRegistry, getRegistryPath, logRuntimeEvent, logger, parseIsoString, registerProject, resolveProjectRoot, sanitizeSlug, server, unregisterProject, validatePath, verifyEventChain };
