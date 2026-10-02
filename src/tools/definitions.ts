export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const READ_ONLY_TOOLS = new Set(['get_status', 'get_metrics']);
export const DESTRUCTIVE_TOOLS = new Set([
  'manage_blackboard',
  'manage_runtime_db',
  'load_behavior',
]);

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'load_behavior',
    description:
      'Load, unload, or hot-swap a behavior tree instance in the browser runtime (actions: load, unload, swap). Use load_behavior instead of manage_behaviors when executing an active behavior tree instance at runtime rather than registering or inspecting definitions.\n\nReturns execution handle, runtime state, active node, and session/intention bindings.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['load', 'unload', 'swap'],
          description: 'Behavior loading operation: load, unload, swap',
        },
        behavior_name: { type: 'string', description: 'Name of the behavior tree to load' },
        behavior_version: {
          type: 'number',
          description: 'Version of behavior tree (defaults to latest)',
        },
        parameters: { type: 'object', description: 'Initial execution parameters' },
        session_id: { type: 'string', description: 'Linked state-memory session ID' },
        intention_id: { type: 'string', description: 'Linked agent-reasoning intention ID' },
        trace_id: {
          type: 'string',
          description: 'Distributed trace ID for cross-server correlation',
        },
        client_request_id: { type: 'string', description: 'Idempotency key' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action', 'behavior_name'],
    },
  },
  {
    name: 'set_parameters',
    description:
      'Dynamically set, inspect, or reset execution parameters for the active behavior runtime (actions: set, get, reset). Use set_parameters instead of manage_blackboard for tuning tree-level execution variables and thresholds rather than sharing cross-node data keys.\n\nReturns updated parameter map and execution ID.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['set', 'get', 'reset'],
          description: 'Parameter operation: set, get, reset',
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
    description:
      'Query active behavior execution status, history, or full tree node traversal state (actions: current, history, tree_state). Use get_status instead of get_metrics when inspecting active execution state and node traversal paths rather than aggregated runtime performance telemetry.\n\nReturns execution status, current node path, tick counters, duration, and error states.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['current', 'history', 'tree_state'],
          description: 'Status query mode: current, history, tree_state',
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
    description:
      'Immediately halt, pause, resume, or unstick behavior execution and disengage active inputs (actions: abort, pause, resume, unstick). Use abort_behavior instead of register_trigger when manually halting or recovering execution rather than configuring automatic condition interrupts.\n\nReturns transition status, disengaged inputs, and unstick diagnostics.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['abort', 'pause', 'resume', 'unstick'],
          description:
            'Execution control operation: abort, pause, resume, unstick (resets stuck score and disengages inputs)',
        },
        execution_id: { type: 'string', description: 'Target execution ID' },
        reason: { type: 'string', description: 'Reason for abort or pause' },
        trace_id: { type: 'string', description: 'Distributed trace ID' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'register_trigger',
    description:
      'Configure or list reactive interrupt triggers with priority preemption and cooldown guards (actions: register, list). Use register_trigger instead of abort_behavior when defining automatic condition-based interrupts rather than manually pausing or stopping a tree.\n\nReturns registered trigger configuration, ID, or trigger list.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['register', 'list'],
          description: 'Trigger operation: register, list',
        },
        name: { type: 'string', description: 'Trigger name' },
        behavior_name: {
          type: 'string',
          description: 'Behavior tree to activate when condition fires',
        },
        condition_type: {
          type: 'string',
          description: 'Condition type (e.g. hp_threshold, enemy_proximity)',
        },
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
    description:
      'Capture or list deterministic browser action sequences with adaptive timing (actions: capture, list). Use replay_recording instead of load_behavior when recording or inspecting fixed action sequences rather than running a dynamic behavior tree.\n\nReturns recording metadata, frame sequences, or list of stored recordings.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['capture', 'list'],
          description: 'Recording operation: capture, list',
        },
        name: { type: 'string', description: 'Recording name' },
        recording_id: { type: 'string', description: 'Recording ID' },
        execution_id: { type: 'string', description: 'Target execution ID' },
        frames: {
          type: 'array',
          items: { type: 'object' },
          description: 'Captured frame sequence',
        },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_metrics',
    description:
      'Retrieve runtime execution telemetry, tick durations, stuck events, category statistics, and 60Hz action outcome spool entries (actions: current, history, aggregate, compare, spool, drain_spool). Use get_metrics instead of get_status when evaluating tick performance, reading spooled action outcomes, or inspecting aggregated statistics rather than active node traversal.\n\nReturns telemetry metrics, duration percentiles, stuck event counts, spooled outcome records, or drained entry counts.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['current', 'history', 'aggregate', 'compare', 'spool', 'drain_spool'],
          description: 'Metrics query mode: current, history, aggregate, compare, spool, drain_spool',
        },
        execution_id: { type: 'string', description: 'Filter metrics by execution ID' },
        behavior_name: { type: 'string', description: 'Filter metrics by behavior tree name' },
        limit: { type: 'number', description: 'Max records' },
        unsynced_only: { type: 'boolean', description: 'Filter only unsynced spool entries (action: spool)' },
        trace_id: { type: 'string', description: 'Distributed trace ID' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_behaviors',
    description:
      'Manage immutable JSON behavior tree definitions with SHA-256 hash verification (actions: register, list, get, synthesize). Use manage_behaviors instead of load_behavior when defining, versioning, or synthesizing behavior tree structures rather than executing them.\n\nReturns tree definition, version metadata, SHA-256 content hash, or synthesis DAG.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['register', 'list', 'get', 'synthesize'],
          description: 'Behavior definition management operation: register, list, get, synthesize',
        },
        name: { type: 'string', description: 'Behavior tree name' },
        version: { type: 'number', description: 'Tree version' },
        description: { type: 'string', description: 'Tree description' },
        tree: { type: 'object', description: 'Behavior tree JSON object' },
        tree_json: { type: 'string', description: 'Raw behavior tree JSON string' },
        steps: {
          type: 'array',
          items: { type: 'object' },
          description: 'Steps or actions to synthesize into a behavior tree',
        },
        strategy: {
          type: 'string',
          enum: ['sequence', 'selector', 'parallel'],
          description: 'Root composition strategy for synthesize action (default: sequence)',
        },
        client_request_id: { type: 'string', description: 'Idempotency key' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_blackboard',
    description:
      'Read, write, delete, lease, list, or ingest structured state slices into shared behavior tree blackboard state (actions: get, set, delete, lease, list, ingest_slice). Use manage_blackboard instead of set_parameters when coordinating state across behavior nodes, projecting perception/spatial slices with staleness protection, or acquiring agent mutex leases.\n\nReturns blackboard value, lease acquisition status, key listings, or slice ingestion summary with expiry metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['get', 'set', 'delete', 'lease', 'list', 'ingest_slice'],
          description: 'Blackboard operation: get, set, delete, lease, list, ingest_slice',
        },
        execution_id: { type: 'string', description: 'Target execution ID' },
        key: { type: 'string', description: 'Blackboard variable key' },
        value: { description: 'Blackboard variable value' },
        agent_id: { type: 'string', description: 'Agent identifier for lease actions' },
        mode: {
          type: 'string',
          enum: ['acquire', 'release'],
          description: 'Lease action mode: acquire or release (default: acquire)',
        },
        duration_seconds: { type: 'number', description: 'Lease duration in seconds' },
        slice_type: {
          type: 'string',
          enum: ['spatial', 'visual', 'task', 'vitals'],
          description: 'Slice category for ingest_slice (default: spatial)',
        },
        payload: {
          type: 'object',
          description: 'Key-value dictionary of slice data to project into blackboard (action: ingest_slice)',
        },
        ttl_ms: {
          type: 'number',
          description: 'Time-to-live before slice expires and is marked stale (default: 5000ms)',
        },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
  {
    name: 'manage_runtime_db',
    description:
      'Database maintenance, diagnostics, SHA-256 Merkle audit verification, and snapshot management (actions: stats, audit, doctor, snapshot, diff, restore). Use manage_runtime_db instead of get_metrics when auditing SQLite integrity and Merkle proofs or restoring database snapshots.\n\nReturns maintenance diagnostics, Merkle audit trees, snapshot metadata, or diff reports.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['stats', 'audit', 'doctor', 'snapshot', 'diff', 'restore'],
          description:
            'Database maintenance operation: stats, audit, doctor, snapshot, diff, restore',
        },
        name: { type: 'string', description: 'Snapshot name' },
        description: { type: 'string', description: 'Snapshot description' },
        project: { type: 'string', description: 'Target project slug' },
      },
      required: ['action'],
    },
  },
];
