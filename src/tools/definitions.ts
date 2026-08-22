export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const READ_ONLY_TOOLS = new Set([
  'get_status',
  'get_metrics',
]);

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'load_behavior',
    description: 'Inject, initialize, or hot-swap a behavior tree instance in the browser runtime.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['load', 'unload', 'swap'],
          description: 'Behavior loading operation',
        },
        behavior_name: { type: 'string', description: 'Name of the behavior tree to load' },
        behavior_version: { type: 'number', description: 'Version of behavior tree (defaults to latest)' },
        parameters: { type: 'object', description: 'Initial execution parameters' },
        session_id: { type: 'string', description: 'Linked state-memory session ID' },
        intention_id: { type: 'string', description: 'Linked agent-reasoning intention ID' },
        client_request_id: { type: 'string', description: 'Idempotency key' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action', 'behavior_name'],
    },
  },
  {
    name: 'set_parameters',
    description: 'Dynamically update or query execution parameters for the active behavior runtime.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set', 'get', 'reset'],
          description: 'Parameter operation',
        },
        execution_id: { type: 'string', description: 'Target execution instance ID' },
        parameters: { type: 'object', description: 'Key-value parameters map to apply' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_status',
    description: 'Query active behavior execution status, current node path, tick count, duration, and error state.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['current', 'history', 'tree_state'],
          description: 'Status query mode',
        },
        execution_id: { type: 'string', description: 'Target execution ID (or latest if omitted)' },
        limit: { type: 'number', description: 'Max history entries' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'abort_behavior',
    description: 'Immediately halt, pause, or resume behavior execution and disengage active inputs.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['abort', 'pause', 'resume'],
          description: 'Execution control operation',
        },
        execution_id: { type: 'string', description: 'Target execution ID' },
        reason: { type: 'string', description: 'Reason for abort or pause' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'register_trigger',
    description: 'Configure and manage reactive interrupt triggers with priority preemption and cooldown guards.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['register', 'list', 'update', 'remove', 'enable', 'disable'],
          description: 'Trigger operation',
        },
        name: { type: 'string', description: 'Trigger name' },
        behavior_name: { type: 'string', description: 'Behavior tree to activate when condition fires' },
        condition_type: { type: 'string', description: 'Condition type (e.g. hp_threshold, enemy_proximity)' },
        condition_params: { type: 'object', description: 'Condition evaluation parameters' },
        priority: { type: 'number', description: 'Preemption priority' },
        cooldown_ms: { type: 'number', description: 'Minimum cooldown interval between fires' },
        trigger_id: { type: 'string', description: 'Trigger ID' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'replay_recording',
    description: 'Capture or replay deterministic browser action sequences with adaptive timing.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['start', 'stop', 'list', 'capture', 'delete'],
          description: 'Recording operation',
        },
        name: { type: 'string', description: 'Recording name' },
        recording_id: { type: 'string', description: 'Recording ID' },
        frames: { type: 'array', items: { type: 'object' }, description: 'Captured frame sequence' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_metrics',
    description: 'Retrieve runtime execution telemetry, tick durations, stuck events, and category statistics.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['current', 'history', 'aggregate', 'compare'],
          description: 'Metrics query mode',
        },
        execution_id: { type: 'string', description: 'Filter metrics by execution ID' },
        behavior_name: { type: 'string', description: 'Filter metrics by behavior tree name' },
        limit: { type: 'number', description: 'Max records' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_behaviors',
    description: 'CRUD operations for immutable JSON behavior tree definitions with SHA-256 tree hash verification.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['register', 'list', 'get', 'update', 'delete', 'export', 'import'],
          description: 'Behavior definition management operation',
        },
        name: { type: 'string', description: 'Behavior tree name' },
        version: { type: 'number', description: 'Tree version' },
        description: { type: 'string', description: 'Tree description' },
        tree: { type: 'object', description: 'Behavior tree JSON object' },
        tree_json: { type: 'string', description: 'Raw behavior tree JSON string' },
        client_request_id: { type: 'string', description: 'Idempotency key' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_blackboard',
    description: 'Read, write, or clear shared behavior tree blackboard state variables.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'clear', 'dump'],
          description: 'Blackboard operation',
        },
        execution_id: { type: 'string', description: 'Target execution ID' },
        key: { type: 'string', description: 'Blackboard variable key' },
        value: { description: 'Blackboard variable value' },
        blackboard: { type: 'object', description: 'Full blackboard object for dump' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_runtime_db',
    description: 'Database maintenance, diagnostics, SHA-256 Merkle audit verification, checkpoints save/restore, and diffs.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['backup', 'stats', 'audit', 'snapshot', 'diff', 'restore'],
          description: 'Database maintenance operation',
        },
        name: { type: 'string', description: 'Snapshot name' },
        description: { type: 'string', description: 'Snapshot description' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
];
