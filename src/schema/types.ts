export type BehaviorId = string & { readonly __brand: unique symbol };
export type ExecutionId = string & { readonly __brand: unique symbol };
export type TriggerId = string & { readonly __brand: unique symbol };
export type RecordingId = string & { readonly __brand: unique symbol };
export type SnapshotId = string & { readonly __brand: unique symbol };
export type EventId = string & { readonly __brand: unique symbol };

export type ExecutionStatus =
  'idle' | 'running' | 'paused' | 'success' | 'failed' | 'stuck' | 'aborted' | 'interrupted';
export type NodeStatus = 'SUCCESS' | 'FAILURE' | 'RUNNING' | 'INVALID';

export interface BehaviorDefinition {
  id: BehaviorId;
  project: string;
  name: string;
  version: number;
  description?: string;
  tree_json: string; // Serialized BT JSON
  tree_hash: string; // SHA-256 hash of tree structure
  is_active: boolean;
  metadata?: Record<string, unknown>;
  client_request_id?: string;
  created_at: string;
}

export interface BehaviorTreeNode {
  id: string;
  type: 'sequence' | 'selector' | 'inverter' | 'timeout' | 'guard' | 'action' | 'condition';
  name?: string;
  parameters?: Record<string, unknown>;
  children?: BehaviorTreeNode[];
  guard?: BehaviorTreeNode;
  timeout_ms?: number;
}

export interface ExecutionState {
  id: ExecutionId;
  project: string;
  behavior_name: string;
  behavior_version: number;
  session_id?: string;
  intention_id?: string;
  trace_id?: string;
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

export interface ReactiveTrigger {
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

export interface ExecutionMetrics {
  id: string;
  project: string;
  execution_id: ExecutionId;
  session_id?: string;
  intention_id?: string;
  trace_id?: string;
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

export interface ExecutionRecording {
  id: RecordingId;
  project: string;
  execution_id: ExecutionId;
  behavior_name: string;
  total_frames: number;
  frames_json: string; // Array of tick frames
  duration_ms: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RuntimeEvent {
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

export interface Outcome {
  intention_id: string;
  execution_id: ExecutionId;
  session_id: string;
  status: ExecutionStatus;
  active_node?: string;
  tick_count: number;
  duration_ms: number;
  metrics?: {
    combat?: { damage_dealt: number; damage_taken: number; kills: number };
    economy?: { items_gathered: number; gold_earned: number };
    navigation?: { distance_traveled: number; waypoints_reached: number };
    [key: string]: unknown;
  };
  error_message?: string;
  stuck_reason?: string;
  completed_at: string;
}

export interface DispatchToken {
  token_id: string; // Unique token UUID
  intention_id: string; // Bound intention ID
  behavior_name: string; // Bound behavior tree name
  params_hash: string; // SHA-256 of canonical intention parameters
  aud: 'behavior-mcp'; // Audience — only behavior-mcp may consume this token
  issued_at: string; // ISO-8601
  expires_at: string; // ISO-8601
  hmac_signature: string; // HMAC-SHA256 signature
}

export const AffordanceBitmask = {
  TRAVERSABLE: 1,
  OCCLUDER: 2,
  CONTAINER: 4,
  INTERACTABLE: 8,
  THREAT: 16,
} as const;

export interface OutcomeSpoolEntry {
  id: string;
  project: string;
  behavior_name: string;
  node_id: string;
  action_type: string;
  parameters: Record<string, unknown>;
  status: 'SUCCESS' | 'FAILURE' | 'RUNNING' | string;
  duration_ms: number;
  tick: number;
  timestamp: string;
  synced: boolean;
}

export interface IngestSliceResult {
  success: boolean;
  slice_type: 'spatial' | 'visual' | 'task' | 'vitals';
  keys_updated: string[];
  ingested_at: string;
  ttl_ms: number;
  expires_at: string;
}
