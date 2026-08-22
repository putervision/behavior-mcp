import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolDefinitions, READ_ONLY_TOOLS } from './definitions.js';
import { getDb, getReadOnlyDb, getProjectSlug } from '../engine/db.js';
import { BehaviorRegistry } from '../engine/behaviors.js';
import { ExecutionEngine } from '../engine/executor.js';
import { TriggerRegistry } from '../engine/triggers.js';
import { MetricsEngine, RecordingEngine, BlackboardEngine } from '../engine/metrics.js';
import { SnapshotEngine } from '../engine/snapshots.js';
import { verifyEventChain } from '../engine/events.js';
import { SchemaAdvisor } from '../engine/advisor.js';
import { ValidationError } from '../utils/errors.js';

interface JsonSchemaProperty {
  type?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
}

export function jsonSchemaToZod(schema: JsonSchemaProperty | unknown): z.ZodTypeAny {
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
    const shape: Record<string, z.ZodTypeAny> = {};
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

export function registerAllTools(server: McpServer): void {
  const toolNames = toolDefinitions.map((t) => t.name);

  for (const def of toolDefinitions) {
    const zodShape: Record<string, z.ZodTypeAny> = {};
    const schemaProps = (def.inputSchema.properties || {}) as Record<string, JsonSchemaProperty>;
    const requiredList = new Set((def.inputSchema.required as string[]) || []);

    for (const [key, prop] of Object.entries(schemaProps)) {
      let fieldSchema = jsonSchemaToZod(prop);
      if (!requiredList.has(key)) {
        fieldSchema = fieldSchema.optional();
      }
      zodShape[key] = fieldSchema;
    }

    server.tool(
      def.name,
      def.description,
      zodShape,
      async (args: any) => {
        try {
          const project = getProjectSlug(args.project);
          const isReadOnly = READ_ONLY_TOOLS.has(def.name);
          const db = isReadOnly ? getReadOnlyDb(project) : getDb(project);

          let result: any;

          switch (def.name) {
            case 'load_behavior': {
              result = ExecutionEngine.startExecution(db, { project, ...args });
              break;
            }

            case 'set_parameters': {
              if (args.action === 'set' && args.execution_id) {
                result = BlackboardEngine.setBlackboardKey(db, { project, execution_id: args.execution_id, key: 'parameters', value: args.parameters });
              } else if (args.execution_id) {
                result = BlackboardEngine.getBlackboard(db, { project, execution_id: args.execution_id });
              } else {
                result = { message: 'Parameters ready' };
              }
              break;
            }

            case 'get_status': {
              if (args.execution_id) {
                result = ExecutionEngine.getExecution(db, { project, id: args.execution_id });
              } else {
                const list = ExecutionEngine.listExecutions(db, { project, limit: 1 });
                result = list[0] || { status: 'idle', message: 'No active execution found.' };
              }
              break;
            }

            case 'abort_behavior': {
              const execs = ExecutionEngine.listExecutions(db, { project, status: 'running', limit: 1 });
              const execId = args.execution_id || execs[0]?.id;
              if (!execId) throw new ValidationError('No active running execution to abort.');
              result = ExecutionEngine.stopExecution(db, { project, execution_id: execId, status: args.action === 'pause' ? 'paused' : 'aborted', error_message: args.reason });
              break;
            }

            case 'register_trigger': {
              const action = args.action;
              if (action === 'register') {
                result = TriggerRegistry.registerTrigger(db, { project, ...args });
              } else if (action === 'list') {
                result = TriggerRegistry.listTriggers(db, project);
              } else {
                result = { status: 'ok', action };
              }
              break;
            }

            case 'replay_recording': {
              if (args.action === 'capture' && args.execution_id) {
                result = RecordingEngine.saveRecording(db, { project, execution_id: args.execution_id, behavior_name: args.name || 'behavior', frames: args.frames || [] });
              } else if (args.action === 'list') {
                result = RecordingEngine.listRecordings(db, project);
              } else {
                result = { status: 'ok', action: args.action };
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
                result = BehaviorRegistry.registerBehavior(db, { project, name: args.name, version: args.version, description: args.description, tree: args.tree || JSON.parse(args.tree_json || '{}') });
              } else if (action === 'get') {
                result = BehaviorRegistry.getBehavior(db, { project, name: args.name, version: args.version });
              } else if (action === 'list') {
                result = BehaviorRegistry.listBehaviors(db, project);
              } else {
                result = { status: 'ok', action };
              }
              break;
            }

            case 'manage_blackboard': {
              const action = args.action;
              if (action === 'get' && args.execution_id) {
                result = BlackboardEngine.getBlackboard(db, { project, execution_id: args.execution_id });
              } else if (action === 'set' && args.execution_id && args.key) {
                result = BlackboardEngine.setBlackboardKey(db, { project, execution_id: args.execution_id, key: args.key, value: args.value });
              } else {
                result = { status: 'ok' };
              }
              break;
            }

            case 'manage_runtime_db': {
              const action = args.action;
              if (action === 'stats') {
                const behaviorsCount = (db.prepare('SELECT COUNT(*) as c FROM behavior_definitions WHERE project = ?').get(project) as any).c;
                const executionsCount = (db.prepare('SELECT COUNT(*) as c FROM execution_state WHERE project = ?').get(project) as any).c;
                const triggersCount = (db.prepare('SELECT COUNT(*) as c FROM triggers WHERE project = ?').get(project) as any).c;
                result = { behaviorsCount, executionsCount, triggersCount, project };
              } else if (action === 'audit') {
                result = verifyEventChain(db, project);
              } else if (action === 'snapshot') {
                result = SnapshotEngine.saveSnapshot(db, { project, name: args.name || `snap_${Date.now()}`, description: args.description });
              } else if (action === 'restore') {
                result = SnapshotEngine.restoreSnapshot(db, { project, name: args.name });
              } else if (action === 'diff') {
                result = SnapshotEngine.listSnapshots(db, { project });
              } else {
                result = { status: 'ok', project };
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
          const advice = SchemaAdvisor.getAdvice(def.name, error.message, toolNames);
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error.message,
                  code: error.code || 'EXECUTION_ERROR',
                  advice,
                }, null, 2),
              },
            ],
          };
        }
      }
    );
  }
}
