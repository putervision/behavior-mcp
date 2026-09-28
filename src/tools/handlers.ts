import { McpError, ErrorCode } from '../transport/native-mcp.js';
import { toolDefinitions, READ_ONLY_TOOLS, DESTRUCTIVE_TOOLS } from './definitions.js';
import { getDb, getReadOnlyDb, getProjectSlug } from '../engine/db.js';
import { BehaviorRegistry } from '../engine/behaviors.js';
import { ExecutionEngine } from '../engine/executor.js';
import { TriggerRegistry } from '../engine/triggers.js';
import { MetricsEngine } from '../engine/metrics.js';
import { RecordingEngine } from '../engine/recordings.js';
import { BlackboardEngine } from '../engine/blackboard.js';
import { SnapshotEngine } from '../engine/snapshots.js';
import { verifyEventChain } from '../engine/events.js';
import { SchemaAdvisor } from '../engine/advisor.js';
import { ValidationError } from '../utils/errors.js';
import { WatchdogTimer } from '../engine/watchdog.js';
import { ActionRateLimiter } from '../engine/rate-limiter.js';
import { PolicyGate } from '../engine/policy-gate.js';
import { EmergencySafety } from '../engine/safety.js';
import { StuckDetector } from '../engine/stuck-detector.js';
import { z, Schema, ObjectSchema } from '../schema/schemas.js';

const rateLimiter = new ActionRateLimiter(60);
const policyGate = new PolicyGate();
const stuckDetector = new StuckDetector();
const watchdog = new WatchdogTimer(5000);

interface JsonSchemaProperty {
  type?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

export function jsonSchemaToZod(schema: JsonSchemaProperty | unknown): Schema<any> {
  if (!schema || typeof schema !== 'object') return z.unknown();
  const s = schema as JsonSchemaProperty;

  if (s.type === 'string') {
    if (s.enum && Array.isArray(s.enum) && s.enum.length > 0) {
      return z.enum(s.enum as [string, ...string[]]);
    }
    return z.string();
  }
  if (s.type === 'number') return z.number();
  if (s.type === 'boolean') return z.boolean();
  if (s.type === 'array') {
    const itemSchema = s.items ? jsonSchemaToZod(s.items) : z.unknown();
    return z.array(itemSchema);
  }
  if (s.type === 'object' || s.properties) {
    const shape: Record<string, Schema<any>> = {};
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

export function jsonSchemaToZodObject(schema: any): any {
  const zod = jsonSchemaToZod(schema);
  if (zod instanceof ObjectSchema) {
    return zod;
  }
  return z.object({}).passthrough();
}

export function registerAllTools(server: any): void {
  const toolNames = toolDefinitions.map((t) => t.name);

  for (const def of toolDefinitions) {
    const name = def.name;
    const title = name
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    const isReadOnlyTool = READ_ONLY_TOOLS.has(name);

    const effectiveSchema = JSON.parse(JSON.stringify(def.inputSchema));

    const handler = async (args: any) => {
      try {
        const projectSlug =
          args?.project ||
          process.env.BEHAVIOR_MCP_PROJECT ||
          process.env.BEHAVIOR_PROJECT ||
          process.env.PV_PROJECT;
        if (!projectSlug || String(projectSlug).trim() === '') {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Parameter "project" is required for tool "${def.name}". Provide the "project" parameter or set the BEHAVIOR_MCP_PROJECT environment variable.`
          );
        }
        const project = getProjectSlug(String(projectSlug).trim());
        if (args) args.project = project;
        const isReadOnly = READ_ONLY_TOOLS.has(def.name);
        const db = isReadOnly ? getReadOnlyDb(project) : getDb(project);

        if (!EmergencySafety.isSafe()) {
          throw new ValidationError('Emergency safety kill switch is engaged. Execution blocked.');
        }

        let result: any;

        switch (def.name) {
          case 'load_behavior': {
            if (!rateLimiter.allowAction()) {
              throw new ValidationError('Action rate limit exceeded (>60 actions/sec).');
            }
            if (!policyGate.isAllowed(args.behavior_name)) {
              throw new ValidationError(
                `PolicyGate blocked loading disallowed behavior "${args.behavior_name}".`
              );
            }
            watchdog.feed();

            result = ExecutionEngine.startExecution(db, { project, ...args });
            result._suggestions = [
              {
                tool: 'get_status',
                args: { execution_id: result.id, action: 'current' },
                reason: 'Inspect live behavior execution traversal path',
              },
              {
                tool: 'get_metrics',
                args: { execution_id: result.id, action: 'current' },
                reason: 'Query runtime tick durations and telemetry',
              },
            ];
            break;
          }

          case 'set_parameters': {
            if (args.action === 'set' && args.execution_id) {
              result = BlackboardEngine.setBlackboardKey(db, {
                project,
                execution_id: args.execution_id,
                key: 'parameters',
                value: args.parameters,
              });
            } else if (args.action === 'get' && args.execution_id) {
              result = BlackboardEngine.getBlackboard(db, {
                project,
                execution_id: args.execution_id,
              });
            } else if (args.action === 'reset' && args.execution_id) {
              result = BlackboardEngine.setBlackboardKey(db, {
                project,
                execution_id: args.execution_id,
                key: 'parameters',
                value: {},
              });
            } else {
              throw new ValidationError(`Unsupported set_parameters action: "${args.action}".`);
            }
            break;
          }

          case 'get_status': {
            watchdog.feed();
            if (args.execution_id) {
              result = ExecutionEngine.getExecution(db, { project, id: args.execution_id });
            } else {
              const list = ExecutionEngine.listExecutions(db, { project, limit: 1 });
              result = list[0] || { status: 'idle', message: 'No active execution found.' };
            }
            if (result.active_node_path) {
              const stuckCheck = stuckDetector.checkStuck(result.active_node_path);
              if (stuckCheck.isStuck) {
                result.stuck_detected = true;
                result._suggestions = [
                  {
                    tool: 'abort_behavior',
                    args: {
                      execution_id: result.id,
                      action: 'abort',
                      reason: 'Stuck in node path',
                    },
                    reason: 'Abort stuck execution',
                  },
                ];
              }
            }
            break;
          }

          case 'abort_behavior': {
            const execs = ExecutionEngine.listExecutions(db, {
              project,
              status: 'running',
              limit: 1,
            });
            const execId = args.execution_id || execs[0]?.id;
            if (!execId) throw new ValidationError('No active running execution to abort.');
            if (args.action === 'unstick') {
              db.prepare(
                'UPDATE execution_state SET stuck_score = 0.0, updated_at = ? WHERE id = ? AND project = ?'
              ).run(new Date().toISOString(), execId, project);
              result = ExecutionEngine.stopExecution(db, {
                project,
                execution_id: execId,
                status: 'aborted',
                error_message:
                  args.reason ||
                  'Unstick recovery triggered: execution halted and inputs disengaged.',
              });
              result.unstick_recovered = true;
              result.stuck_score = 0.0;
            } else {
              result = ExecutionEngine.stopExecution(db, {
                project,
                execution_id: execId,
                status: args.action === 'pause' ? 'paused' : 'aborted',
                error_message: args.reason,
              });
            }
            result._suggestions = [
              {
                tool: 'get_metrics',
                args: { execution_id: execId, action: 'history' },
                reason: 'Inspect post-abort telemetry',
              },
            ];
            break;
          }

          case 'register_trigger': {
            const action = args.action;
            if (action === 'register') {
              result = TriggerRegistry.registerTrigger(db, { project, ...args });
            } else if (action === 'list') {
              result = TriggerRegistry.listTriggers(db, project);
            } else {
              throw new ValidationError(
                `Unsupported register_trigger action: "${action}". Supported actions: register, list.`
              );
            }
            break;
          }

          case 'replay_recording': {
            if (args.action === 'capture' && args.execution_id) {
              result = RecordingEngine.saveRecording(db, {
                project,
                execution_id: args.execution_id,
                behavior_name: args.name || 'behavior',
                frames: args.frames || [],
              });
            } else if (args.action === 'list') {
              result = RecordingEngine.listRecordings(db, project);
            } else {
              throw new ValidationError(
                `Unsupported replay_recording action: "${args.action}". Supported actions: capture, list.`
              );
            }
            break;
          }

          case 'get_metrics': {
            result = MetricsEngine.getMetrics(db, { project, ...args });
            break;
          }

          case 'manage_behaviors': {
            const action = args.action;
            if (action === 'register') {
              result = BehaviorRegistry.registerBehavior(db, {
                project,
                name: args.name,
                version: args.version,
                description: args.description,
                tree: args.tree || JSON.parse(args.tree_json || '{}'),
              });
            } else if (action === 'synthesize') {
              const strategy = args.strategy || 'sequence';
              const rawSteps = args.steps || args.actions || [];
              const children = rawSteps.map((step: any, idx: number) => {
                if (typeof step === 'string') {
                  return { id: `step_${idx + 1}`, type: 'action', name: step };
                }
                return {
                  id: step.id || `step_${idx + 1}`,
                  type: step.type || 'action',
                  name: step.name || step.action || `action_${idx + 1}`,
                  parameters: step.parameters,
                };
              });
              const tree = {
                id: args.name,
                type: strategy,
                children,
              };
              const behavior = BehaviorRegistry.registerBehavior(db, {
                project,
                name: args.name,
                version: args.version,
                description: args.description || `Synthesized ${strategy} behavior tree`,
                tree,
                client_request_id: args.client_request_id,
              });
              result = {
                ...behavior,
                synthesized: true,
                strategy,
                node_count: children.length + 1,
              };
            } else if (action === 'get') {
              result = BehaviorRegistry.getBehavior(db, {
                project,
                name: args.name,
                version: args.version,
              });
            } else if (action === 'list') {
              result = BehaviorRegistry.listBehaviors(db, project);
            } else {
              throw new ValidationError(
                `Unsupported manage_behaviors action: "${action}". Supported actions: register, get, list, synthesize.`
              );
            }
            break;
          }

          case 'manage_blackboard': {
            const action = args.action;
            if (action === 'get' && args.execution_id) {
              result = BlackboardEngine.getBlackboard(db, {
                project,
                execution_id: args.execution_id,
              });
              if (args.key) {
                result = { key: args.key, value: (result as any)[args.key] };
              }
            } else if (action === 'set' && args.execution_id && args.key) {
              result = BlackboardEngine.setBlackboardKey(db, {
                project,
                execution_id: args.execution_id,
                key: args.key,
                value: args.value,
              });
            } else if (action === 'delete' && args.execution_id && args.key) {
              result = BlackboardEngine.deleteBlackboardKey(db, {
                project,
                execution_id: args.execution_id,
                key: args.key,
              });
            } else if (action === 'list' && args.execution_id) {
              result = BlackboardEngine.listBlackboard(db, {
                project,
                execution_id: args.execution_id,
              });
            } else if (action === 'lease' && args.execution_id && args.key) {
              result = BlackboardEngine.leaseBlackboard(db, {
                project,
                execution_id: args.execution_id,
                key: args.key,
                agent_id: args.agent_id || 'agent',
                duration_seconds: args.duration_seconds,
                mode: args.mode,
              });
            } else {
              throw new ValidationError(
                `Unsupported manage_blackboard action or missing execution_id/key: "${action}". Supported actions: get, set, delete, lease, list.`
              );
            }
            break;
          }

          case 'manage_runtime_db': {
            const action = args.action;
            if (action === 'stats') {
              const behaviorsCount = (
                db
                  .prepare('SELECT COUNT(*) as c FROM behavior_definitions WHERE project = ?')
                  .get(project) as any
              ).c;
              const executionsCount = (
                db
                  .prepare('SELECT COUNT(*) as c FROM execution_state WHERE project = ?')
                  .get(project) as any
              ).c;
              const triggersCount = (
                db
                  .prepare('SELECT COUNT(*) as c FROM triggers WHERE project = ?')
                  .get(project) as any
              ).c;
              result = { behaviorsCount, executionsCount, triggersCount, project };
            } else if (action === 'audit') {
              result = verifyEventChain(db, project);
            } else if (action === 'doctor') {
              const audit = verifyEventChain(db, project);
              const integrity = db.pragma('integrity_check');
              const journal = db.pragma('journal_mode');
              result = {
                status: audit.valid ? 'healthy' : 'unhealthy',
                valid: audit.valid,
                database_accessibility: 'OK',
                journal_mode: journal,
                integrity_check: integrity,
                event_chain: audit,
                project,
              };
            } else if (action === 'snapshot') {
              result = SnapshotEngine.saveSnapshot(db, {
                project,
                name: args.name || `snap_${Date.now()}`,
                description: args.description,
              });
            } else if (action === 'restore') {
              result = SnapshotEngine.restoreSnapshot(db, { project, name: args.name });
            } else if (action === 'diff') {
              result = SnapshotEngine.listSnapshots(db, { project });
            } else {
              throw new ValidationError(
                `Unsupported manage_runtime_db action: "${action}". Supported actions: stats, audit, doctor, snapshot, restore, diff.`
              );
            }
            break;
          }

          default:
            throw new ValidationError(`Unrecognized tool "${def.name}".`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        if (
          error instanceof McpError ||
          (error && typeof error === 'object' && error.code === ErrorCode.InvalidParams)
        ) {
          throw error;
        }
        const advice = SchemaAdvisor.getAdvice(def.name, error.message, toolNames);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: error.message,
                  code: error.code || 'EXECUTION_ERROR',
                  advice,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    };

    if (typeof server.registerTool === 'function') {
      server.registerTool(
        name,
        {
          title,
          description: def.description,
          inputSchema: effectiveSchema,
          rawJsonSchema: effectiveSchema,
          annotations: {
            readOnlyHint: isReadOnlyTool,
            destructiveHint: DESTRUCTIVE_TOOLS.has(name),
            idempotentHint: isReadOnlyTool,
            openWorldHint: false,
          },
        },
        handler
      );
    } else if (typeof server.tool === 'function') {
      server.tool(def.name, def.description, effectiveSchema, handler);
    }
  }
}
