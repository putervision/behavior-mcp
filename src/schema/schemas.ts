import { z } from 'zod';

export const LoadBehaviorSchema = z.object({
  action: z.enum(['load', 'unload', 'swap']),
  behavior_name: z.string(),
  behavior_version: z.number().optional(),
  parameters: z.record(z.any()).optional(),
  session_id: z.string().optional(),
  intention_id: z.string().optional(),
  client_request_id: z.string().optional(),
  project: z.string().optional(),
});

export const SetParametersSchema = z.object({
  action: z.enum(['set', 'get', 'reset']),
  execution_id: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  project: z.string().optional(),
});

export const GetStatusSchema = z.object({
  action: z.enum(['current', 'history', 'tree_state']),
  execution_id: z.string().optional(),
  limit: z.number().optional(),
  project: z.string().optional(),
});

export const AbortBehaviorSchema = z.object({
  action: z.enum(['abort', 'pause', 'resume']),
  execution_id: z.string().optional(),
  reason: z.string().optional(),
  project: z.string().optional(),
});

export const RegisterTriggerSchema = z.object({
  action: z.enum(['register', 'list', 'update', 'remove', 'enable', 'disable']),
  name: z.string().optional(),
  behavior_name: z.string().optional(),
  condition_type: z.string().optional(),
  condition_params: z.record(z.any()).optional(),
  priority: z.number().optional(),
  cooldown_ms: z.number().optional(),
  trigger_id: z.string().optional(),
  project: z.string().optional(),
});

export const ReplayRecordingSchema = z.object({
  action: z.enum(['start', 'stop', 'list', 'capture', 'delete']),
  name: z.string().optional(),
  recording_id: z.string().optional(),
  frames: z.array(z.any()).optional(),
  project: z.string().optional(),
});

export const GetMetricsSchema = z.object({
  action: z.enum(['current', 'history', 'aggregate', 'compare']),
  execution_id: z.string().optional(),
  behavior_name: z.string().optional(),
  limit: z.number().optional(),
  project: z.string().optional(),
});

export const ManageBehaviorsSchema = z.object({
  action: z.enum(['register', 'list', 'get', 'update', 'delete', 'export', 'import']),
  name: z.string().optional(),
  version: z.number().optional(),
  description: z.string().optional(),
  tree: z.any().optional(),
  tree_json: z.string().optional(),
  client_request_id: z.string().optional(),
  project: z.string().optional(),
});

export const ManageBlackboardSchema = z.object({
  action: z.enum(['get', 'set', 'clear', 'dump']),
  execution_id: z.string().optional(),
  key: z.string().optional(),
  value: z.any().optional(),
  blackboard: z.record(z.any()).optional(),
  project: z.string().optional(),
});

export const ManageRuntimeDbSchema = z.object({
  action: z.enum(['backup', 'stats', 'audit', 'snapshot', 'diff', 'restore']),
  name: z.string().optional(),
  description: z.string().optional(),
  project: z.string().optional(),
});
