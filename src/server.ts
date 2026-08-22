import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getVersion } from './utils/version.js';
import { registerAllTools } from './tools/handlers.js';
import { registerAllPrompts } from './tools/prompts.js';
import { getReadOnlyDb, getProjectSlug } from './engine/db.js';
import { BehaviorRegistry } from './engine/behaviors.js';
import { ExecutionEngine } from './engine/executor.js';
import { TriggerRegistry } from './engine/triggers.js';
import { MetricsEngine, RecordingEngine } from './engine/metrics.js';

export const server = new McpServer({
  name: 'io.github.putervision/behavior-runtime-mcp',
  version: getVersion(),
});

function getVarString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

// 1. runtime-status
server.registerResource(
  'runtime-status',
  new ResourceTemplate('runtime:///{project}/status', { list: undefined }),
  {
    title: 'Runtime Status Template',
    description: 'Current execution status, active behavior, and tick counter',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const execs = ExecutionEngine.listExecutions(db, { project, limit: 1 });
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(execs[0] || { status: 'idle' }, null, 2) }],
    };
  }
);

// 2. runtime-active-tree
server.registerResource(
  'runtime-active-tree',
  new ResourceTemplate('runtime:///{project}/active_tree', { list: undefined }),
  {
    title: 'Runtime Active Behavior Tree Template',
    description: 'Active behavior tree node hierarchy and current active path',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const exec = ExecutionEngine.listExecutions(db, { project, status: 'running', limit: 1 })[0];
    const behavior = exec ? BehaviorRegistry.getBehavior(db, { project, name: exec.behavior_name, version: exec.behavior_version }) : null;
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ exec, behavior }, null, 2) }],
    };
  }
);

// 3. runtime-metrics
server.registerResource(
  'runtime-metrics',
  new ResourceTemplate('runtime:///{project}/metrics', { list: undefined }),
  {
    title: 'Runtime Metrics Template',
    description: 'Telemetry and tick performance aggregations',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const metrics = MetricsEngine.getMetrics(db, { project, limit: 50 });
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(metrics, null, 2) }],
    };
  }
);

// 4. runtime-triggers
server.registerResource(
  'runtime-triggers',
  new ResourceTemplate('runtime:///{project}/triggers', { list: undefined }),
  {
    title: 'Runtime Triggers Template',
    description: 'Registered reactive triggers and fire history',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const triggers = TriggerRegistry.listTriggers(db, project);
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(triggers, null, 2) }],
    };
  }
);

// 5. runtime-recordings
server.registerResource(
  'runtime-recordings',
  new ResourceTemplate('runtime:///{project}/recordings', { list: undefined }),
  {
    title: 'Runtime Recordings Template',
    description: 'Saved action recordings for replay',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const recordings = RecordingEngine.listRecordings(db, project);
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(recordings, null, 2) }],
    };
  }
);

// 6. runtime-behaviors
server.registerResource(
  'runtime-behaviors',
  new ResourceTemplate('runtime:///{project}/behaviors', { list: undefined }),
  {
    title: 'Runtime Behavior Registry Template',
    description: 'Registered behavior tree definitions and tree hashes',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const behaviors = BehaviorRegistry.listBehaviors(db, project);
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(behaviors, null, 2) }],
    };
  }
);

// 7. runtime-blackboard
server.registerResource(
  'runtime-blackboard',
  new ResourceTemplate('runtime:///{project}/blackboard', { list: undefined }),
  {
    title: 'Runtime Blackboard State Template',
    description: 'Current behavior tree blackboard variable state',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const exec = ExecutionEngine.listExecutions(db, { project, limit: 1 })[0];
    return {
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(exec?.blackboard_json || '{}', null, 2) }],
    };
  }
);

// 8. runtime-watchdog
server.registerResource(
  'runtime-watchdog',
  new ResourceTemplate('runtime:///{project}/watchdog', { list: undefined }),
  {
    title: 'Runtime Watchdog Health Template',
    description: 'Watchdog status, stuck detection counters, and rate limit metrics',
    mimeType: 'application/json',
  },
  async (uri: URL, variables) => {
    const project = getProjectSlug(getVarString(variables.project));
    const db = getReadOnlyDb(project);
    const exec = ExecutionEngine.listExecutions(db, { project, limit: 1 })[0];
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({ project, stuck_score: exec?.stuck_score || 0.0, current_status: exec?.status || 'idle' }, null, 2),
        },
      ],
    };
  }
);

// Register Tools & Prompts
registerAllTools(server);
registerAllPrompts(server);
