import { NativeMcpServer, NativeResourceTemplate } from './transport/native-mcp.js';
import { getVersion } from './utils/version.js';
import { registerAllTools } from './tools/handlers.js';
import { registerAllPrompts } from './tools/prompts.js';
import { toolDefinitions } from './tools/definitions.js';
import { getReadOnlyDb, getProjectSlug } from './engine/db.js';
import { BehaviorRegistry } from './engine/behaviors.js';
import { ExecutionEngine } from './engine/executor.js';
import { TriggerRegistry } from './engine/triggers.js';
import { MetricsEngine } from './engine/metrics.js';
import { RecordingEngine } from './engine/recordings.js';

function getVarString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0];
  return val;
}

export function registerAllResources(server: any): void {
  // 1. runtime-status
  server.registerResource(
    'runtime-status',
    new NativeResourceTemplate('runtime:///{project}/status', { list: undefined }),
    {
      title: 'Runtime Status Template',
      description: 'Current execution status, active behavior, and tick counter',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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
    new NativeResourceTemplate('runtime:///{project}/active_tree', { list: undefined }),
    {
      title: 'Runtime Active Behavior Tree Template',
      description: 'Active behavior tree node hierarchy and current active path',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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
    new NativeResourceTemplate('runtime:///{project}/metrics', { list: undefined }),
    {
      title: 'Runtime Metrics Template',
      description: 'Telemetry and tick performance aggregations',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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
    new NativeResourceTemplate('runtime:///{project}/triggers', { list: undefined }),
    {
      title: 'Runtime Triggers Template',
      description: 'Registered reactive triggers and fire history',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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
    new NativeResourceTemplate('runtime:///{project}/recordings', { list: undefined }),
    {
      title: 'Runtime Recordings Template',
      description: 'Saved action recordings for replay',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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
    new NativeResourceTemplate('runtime:///{project}/behaviors', { list: undefined }),
    {
      title: 'Runtime Behavior Registry Template',
      description: 'Registered behavior tree definitions and tree hashes',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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
    new NativeResourceTemplate('runtime:///{project}/blackboard', { list: undefined }),
    {
      title: 'Runtime Blackboard State Template',
      description: 'Current behavior tree blackboard variable state',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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
    new NativeResourceTemplate('runtime:///{project}/watchdog', { list: undefined }),
    {
      title: 'Runtime Watchdog Health Template',
      description: 'Watchdog status, stuck detection counters, and rate limit metrics',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
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

  // 9. runtime-health
  server.registerResource(
    'runtime-health',
    'runtime:///health',
    {
      title: 'Behavior Runtime Health',
      description: 'Server health status, version, and timestamp',
      mimeType: 'application/json',
    },
    async (uri: URL) => {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'healthy',
              version: getVersion(),
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }
  );

  // Register pv://docs/... documentation resources (E13)
  for (const tool of toolDefinitions) {
    server.registerResource(
      `docs-${tool.name}`,
      `pv://docs/${tool.name}`,
      {
        title: `${tool.name} Documentation`,
        description: `Complete parameter schema and documentation for ${tool.name}`,
        mimeType: 'application/json',
      },
      async (uri: URL) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                tool: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              },
              null,
              2
            ),
          },
        ],
      })
    );
  }

  server.registerResource(
    'tool-docs-template',
    new NativeResourceTemplate('pv://docs/{toolName}', { list: undefined }),
    {
      title: 'Tool Documentation Template',
      description: 'Fetch detailed tool documentation and parameter schema via pv://docs/{toolName}',
      mimeType: 'application/json',
    },
    async (uri: URL, variables: any) => {
      const toolName = Array.isArray(variables.toolName) ? variables.toolName[0] : variables.toolName;
      const tool = toolDefinitions.find((t) => t.name === toolName);
      if (!tool) {
        throw new Error(`Documentation not found for tool: "${toolName}"`);
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify(
              {
                tool: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}

export function createNativeServer(): NativeMcpServer {
  const native = new NativeMcpServer({
    name: 'io.github.putervision/behavior-mcp',
    version: getVersion(),
  });

  registerAllResources(native);
  registerAllTools(native);
  registerAllPrompts(native);

  return native;
}

export const server = createNativeServer();
