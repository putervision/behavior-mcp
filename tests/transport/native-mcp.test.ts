import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NativeMcpServer,
  NativeStdioTransport,
  NativeResourceTemplate,
  ErrorCode,
  McpError,
  validateParams,
} from '../../src/transport/native-mcp.js';
import { createNativeServer } from '../../src/server.js';
import { getVersion } from '../../src/utils/version.js';

describe('behavior-mcp NativeMcpServer Conformance Suite', () => {
  let server: NativeMcpServer;

  beforeEach(() => {
    server = new NativeMcpServer({
      name: 'io.github.putervision/behavior-mcp',
      version: getVersion(),
    });

    // Register a test tool with strict validation
    server.registerTool(
      'test_tool',
      {
        title: 'Test Tool',
        description: 'A test tool for parameter validation',
        inputSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['load', 'abort', 'pause'] },
            ticks: { type: 'number' },
            tags: { type: 'array' },
            config: { type: 'object' },
            enabled: { type: 'boolean' },
          },
          required: ['action'],
        },
      },
      async (args: any, extra?: { signal?: AbortSignal }) => {
        if (args.action === 'slow') {
          // Allow testing cancellation
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 500);
            extra?.signal?.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Aborted'));
            });
          });
        }
        return { success: true, receivedAction: args.action };
      }
    );

    // Register a static resource
    server.registerResource(
      'runtime-health',
      'runtime:///health',
      { title: 'Runtime Health', mimeType: 'application/json' },
      async () => ({
        contents: [
          { uri: 'runtime:///health', mimeType: 'application/json', text: '{"status":"healthy"}' },
        ],
      })
    );

    // Register a templated resource
    server.registerResource(
      'runtime-status',
      new NativeResourceTemplate('runtime:///{project}/status'),
      { title: 'Runtime Status', mimeType: 'application/json' },
      async (uri, vars) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: 'application/json',
            text: JSON.stringify({ project: vars.project, status: 'idle' }),
          },
        ],
      })
    );

    // Register a test prompt
    server.registerPrompt(
      'test-prompt',
      {
        title: 'Test Prompt',
        description: 'A test prompt template',
        argsSchema: {
          properties: {
            goal: { type: 'string', description: 'The behavior goal' },
          },
          required: ['goal'],
        },
      },
      async (args) => ({
        description: 'Test prompt output',
        messages: [{ role: 'user', content: { type: 'text', text: `Goal is ${args.goal}` } }],
      })
    );
  });

  describe('1. Handshake & Protocol Version Negotiation', () => {
    it('handles initialize with requested protocolVersion 2024-11-05', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05', clientInfo: { name: 'cursor', version: '1.0' } },
      });

      expect(resp).not.toBeNull();
      expect(resp?.error).toBeUndefined();
      expect(resp?.result).toMatchObject({
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: expect.any(Object),
          resources: expect.any(Object),
          prompts: expect.any(Object),
        },
        serverInfo: {
          name: 'io.github.putervision/behavior-mcp',
          version: getVersion(),
        },
      });
    });

    it('handles initialize with backward-compatible 2024-10-07 version', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'initialize',
        params: { protocolVersion: '2024-10-07' },
      });

      expect(resp?.result).toMatchObject({
        protocolVersion: '2024-10-07',
      });
    });

    it('falls back to default 2024-11-05 when unsupported version requested', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
        params: { protocolVersion: '2023-01-01' },
      });

      expect(resp?.result).toMatchObject({
        protocolVersion: '2024-11-05',
      });
    });

    it('returns null on notifications/initialized', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      });

      expect(resp).toBeNull();
    });

    it('handles ping request', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 'ping-1',
        method: 'ping',
      });

      expect(resp?.result).toEqual({});
    });
  });

  describe('2. Tools Conformance & -32602 Validation', () => {
    it('lists registered tools with valid inputSchema', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 10,
        method: 'tools/list',
      });

      expect(resp?.result).toHaveProperty('tools');
      const tools = (resp?.result as any).tools;
      expect(tools.length).toBeGreaterThanOrEqual(1);
      const testTool = tools.find((t: any) => t.name === 'test_tool');
      expect(testTool).toBeDefined();
      expect(testTool.inputSchema.required).toContain('action');
    });

    it('executes tool with valid arguments', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 11,
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: { action: 'load', ticks: 60, enabled: true },
        },
      });

      expect(resp?.error).toBeUndefined();
      expect(resp?.result).toHaveProperty('content');
      const content = (resp?.result as any).content;
      expect(content[0].type).toBe('text');
      expect(JSON.parse(content[0].text)).toMatchObject({ success: true, receivedAction: 'load' });
    });

    it('returns -32602 when missing required parameter', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 12,
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: { ticks: 10 }, // missing 'action'
        },
      });

      expect(resp?.result).toBeUndefined();
      expect(resp?.error?.code).toBe(ErrorCode.InvalidParams); // -32602
      expect(resp?.error?.message).toContain('Missing required argument: "action"');
    });

    it('returns -32602 when property type is wrong', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 13,
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: { action: 'load', ticks: 'not-a-number' },
        },
      });

      expect(resp?.error?.code).toBe(ErrorCode.InvalidParams);
      expect(resp?.error?.message).toContain('expected number, got string');
    });

    it('returns -32602 when enum value is not allowed', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 14,
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: { action: 'unsupported_action' },
        },
      });

      expect(resp?.error?.code).toBe(ErrorCode.InvalidParams);
      expect(resp?.error?.message).toContain('expected one of [load, abort, pause]');
    });

    it('returns -32601 on unknown tool name', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 15,
        method: 'tools/call',
        params: {
          name: 'non_existent_tool',
          arguments: {},
        },
      });

      expect(resp?.error?.code).toBe(ErrorCode.MethodNotFound);
      expect(resp?.error?.message).toContain('Unknown tool');
    });

    it('returns -32602 when mandatory project slug is missing on registered tools (E7)', async () => {
      const fullServer = createNativeServer();
      const oldProject = process.env.BEHAVIOR_MCP_PROJECT;
      const oldPv = process.env.PV_PROJECT;
      delete process.env.BEHAVIOR_MCP_PROJECT;
      delete process.env.PV_PROJECT;

      try {
        const resp = await fullServer.handleMessage({
          jsonrpc: '2.0',
          id: 16,
          method: 'tools/call',
          params: {
            name: 'manage_behaviors',
            arguments: {
              action: 'list',
            },
          },
        });

        expect(resp?.result).toBeUndefined();
        expect(resp?.error?.code).toBe(ErrorCode.InvalidParams); // -32602
        expect(resp?.error?.message).toContain('Parameter "project" is required');
      } finally {
        if (oldProject !== undefined) process.env.BEHAVIOR_MCP_PROJECT = oldProject;
        if (oldPv !== undefined) process.env.PV_PROJECT = oldPv;
      }
    });
  });

  describe('3. Resources Conformance', () => {
    it('lists static and templated resources', async () => {
      const listResp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 20,
        method: 'resources/list',
      });
      expect(listResp?.result).toHaveProperty('resources');
      const resources = (listResp?.result as any).resources;
      expect(resources.some((r: any) => r.uri === 'runtime:///health')).toBe(true);

      const tplResp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 21,
        method: 'resources/templates/list',
      });
      expect(tplResp?.result).toHaveProperty('resourceTemplates');
      const templates = (tplResp?.result as any).resourceTemplates;
      expect(templates.some((t: any) => t.uriTemplate === 'runtime:///{project}/status')).toBe(
        true
      );
    });

    it('reads static resource', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 22,
        method: 'resources/read',
        params: { uri: 'runtime:///health' },
      });

      expect(resp?.result).toHaveProperty('contents');
      const contents = (resp?.result as any).contents;
      expect(contents[0].text).toContain('healthy');
    });

    it('reads templated resource with URI variable extraction', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 23,
        method: 'resources/read',
        params: { uri: 'runtime:///my-game-agent/status' },
      });

      expect(resp?.result).toHaveProperty('contents');
      const contents = (resp?.result as any).contents;
      const parsed = JSON.parse(contents[0].text);
      expect(parsed.project).toBe('my-game-agent');
      expect(parsed.status).toBe('idle');
    });

    it('returns error when resource not found', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 24,
        method: 'resources/read',
        params: { uri: 'runtime:///unknown/not-found' },
      });

      expect(resp?.error?.code).toBe(ErrorCode.InvalidRequest);
      expect(resp?.error?.message).toContain('Resource not found');
    });
  });

  describe('4. Prompts Conformance', () => {
    it('lists registered prompts', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 30,
        method: 'prompts/list',
      });

      expect(resp?.result).toHaveProperty('prompts');
      const prompts = (resp?.result as any).prompts;
      expect(prompts.some((p: any) => p.name === 'test-prompt')).toBe(true);
    });

    it('retrieves prompt with arguments', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 31,
        method: 'prompts/get',
        params: { name: 'test-prompt', arguments: { goal: 'Harvest wood' } },
      });

      expect(resp?.result).toHaveProperty('messages');
      const messages = (resp?.result as any).messages;
      expect(messages[0].content.text).toBe('Goal is Harvest wood');
    });

    it('returns -32601 on unknown prompt', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 32,
        method: 'prompts/get',
        params: { name: 'unknown-prompt' },
      });

      expect(resp?.error?.code).toBe(ErrorCode.MethodNotFound);
      expect(resp?.error?.message).toContain('Unknown prompt');
    });
  });

  describe('5. Request Cancellation', () => {
    it('aborts active request when notifications/cancelled received', async () => {
      // Launch a slow tool call
      const callPromise = server.handleMessage({
        jsonrpc: '2.0',
        id: 99,
        method: 'tools/call',
        params: {
          name: 'test_tool',
          arguments: { action: 'slow' },
        },
      });

      // Send cancellation immediately
      await server.handleMessage({
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: { requestId: 99 },
      });

      const resp = await callPromise;
      expect(resp?.error?.code).toBe(-32000);
      expect(resp?.error?.message).toBe('Request cancelled');
    });
  });

  describe('6. Error Envelope Handling', () => {
    it('returns -32600 on invalid envelope without method', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 101,
      } as any);

      expect(resp?.error?.code).toBe(ErrorCode.InvalidRequest);
    });

    it('returns -32601 on unsupported method', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 102,
        method: 'unknown/method',
      });

      expect(resp?.error?.code).toBe(ErrorCode.MethodNotFound);
    });
  });

  describe('7. Latency Benchmark', () => {
    it('handles initialize and tools/list in sub-15ms', async () => {
      const start = performance.now();

      await server.handleMessage({
        jsonrpc: '2.0',
        id: 'bench-init',
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      });

      await server.handleMessage({
        jsonrpc: '2.0',
        id: 'bench-tools',
        method: 'tools/list',
      });

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(15);
    });
  });

  describe('8. Production createNativeServer Factory Integration', () => {
    it('instantiates native server with all 10 tools, resources, and prompts', async () => {
      const prodServer = createNativeServer();

      // Test initialize
      const initResp = await prodServer.handleMessage({
        jsonrpc: '2.0',
        id: 201,
        method: 'initialize',
        params: { protocolVersion: '2024-11-05' },
      });
      expect(initResp?.error).toBeUndefined();
      expect((initResp?.result as any).serverInfo.name).toBe('io.github.putervision/behavior-mcp');

      // Test tools/list contains all 10 tools
      const toolsResp = await prodServer.handleMessage({
        jsonrpc: '2.0',
        id: 202,
        method: 'tools/list',
      });
      const toolList = (toolsResp?.result as any).tools;
      expect(toolList).toHaveLength(10);
      const toolNames = toolList.map((t: any) => t.name);
      expect(toolNames).toContain('load_behavior');
      expect(toolNames).toContain('set_parameters');
      expect(toolNames).toContain('get_status');
      expect(toolNames).toContain('abort_behavior');
      expect(toolNames).toContain('register_trigger');
      expect(toolNames).toContain('replay_recording');
      expect(toolNames).toContain('get_metrics');
      expect(toolNames).toContain('manage_behaviors');
      expect(toolNames).toContain('manage_blackboard');
      expect(toolNames).toContain('manage_runtime_db');

      // Test resources/list and resources/templates/list
      const resResp = await prodServer.handleMessage({
        jsonrpc: '2.0',
        id: 203,
        method: 'resources/list',
      });
      const resList = (resResp?.result as any).resources;
      expect(resList.some((r: any) => r.uri === 'runtime:///health')).toBe(true);
      expect(resList.some((r: any) => r.uri === 'pv://docs/load_behavior')).toBe(true);

      const tplResp = await prodServer.handleMessage({
        jsonrpc: '2.0',
        id: 204,
        method: 'resources/templates/list',
      });
      const tplList = (tplResp?.result as any).resourceTemplates;
      expect(tplList.length).toBe(9);
      expect(tplList.some((t: any) => t.uriTemplate === 'pv://docs/{toolName}')).toBe(true);

      // Test reading pv://docs/load_behavior
      const readDocResp = await prodServer.handleMessage({
        jsonrpc: '2.0',
        id: 205,
        method: 'resources/read',
        params: { uri: 'pv://docs/load_behavior' },
      });
      expect(readDocResp?.error).toBeUndefined();
      const readDocContent = JSON.parse((readDocResp?.result as any).contents[0].text);
      expect(readDocContent.tool).toBe('load_behavior');
      expect(readDocContent.description).toBeDefined();
      expect(readDocContent.inputSchema).toBeDefined();

      // Test reading pv://docs/{toolName} via template
      const readTplDocResp = await prodServer.handleMessage({
        jsonrpc: '2.0',
        id: 206,
        method: 'resources/read',
        params: { uri: 'pv://docs/manage_blackboard' },
      });
      expect(readTplDocResp?.error).toBeUndefined();
      const readTplDocContent = JSON.parse((readTplDocResp?.result as any).contents[0].text);
      expect(readTplDocContent.tool).toBe('manage_blackboard');

      // Test prompts/list contains 4 prompts
      const promptsResp = await prodServer.handleMessage({
        jsonrpc: '2.0',
        id: 207,
        method: 'prompts/list',
      });
      const promptList = (promptsResp?.result as any).prompts;
      expect(promptList.length).toBe(4);
      const promptNames = promptList.map((p: any) => p.name);
      expect(promptNames).toContain('behavior-design');
      expect(promptNames).toContain('debug-stuck');
      expect(promptNames).toContain('optimize-behavior');
      expect(promptNames).toContain('trigger-design');
    });
  });

  describe('7. Transport Lifecycle, Prompts, Resources & Edge Cases', () => {
    it('handles resources/read error cases (missing URI, not found)', async () => {
      const missingUri = await server.handleMessage({
        jsonrpc: '2.0',
        id: 701,
        method: 'resources/read',
        params: {},
      });
      expect(missingUri?.error?.code).toBe(ErrorCode.InvalidParams);
      expect(missingUri?.error?.message).toContain('Missing uri');

      const notFound = await server.handleMessage({
        jsonrpc: '2.0',
        id: 702,
        method: 'resources/read',
        params: { uri: 'runtime:///nonexistent' },
      });
      expect(notFound?.error?.code).toBe(ErrorCode.InvalidRequest);
      expect(notFound?.error?.message).toContain('Resource not found');
    });

    it('handles prompts/get success and error cases', async () => {
      const missingName = await server.handleMessage({
        jsonrpc: '2.0',
        id: 703,
        method: 'prompts/get',
        params: {},
      });
      expect(missingName?.error?.code).toBe(ErrorCode.InvalidParams);
      expect(missingName?.error?.message).toContain('Missing prompt name');

      const notFound = await server.handleMessage({
        jsonrpc: '2.0',
        id: 704,
        method: 'prompts/get',
        params: { name: 'nonexistent-prompt' },
      });
      expect(notFound?.error?.code).toBe(ErrorCode.MethodNotFound);
      expect(notFound?.error?.message).toContain('Unknown prompt');

      const success = await server.handleMessage({
        jsonrpc: '2.0',
        id: 705,
        method: 'prompts/get',
        params: { name: 'test-prompt', arguments: { goal: 'survive' } },
      });
      expect(success?.error).toBeUndefined();
      expect(success?.result).toMatchObject({
        description: 'Test prompt output',
        messages: [{ role: 'user', content: { type: 'text', text: 'Goal is survive' } }],
      });
    });

    it('handles unsupported methods with -32601 MethodNotFound', async () => {
      const resp = await server.handleMessage({
        jsonrpc: '2.0',
        id: 706,
        method: 'custom/unsupported',
      });
      expect(resp?.error?.code).toBe(ErrorCode.MethodNotFound);
      expect(resp?.error?.message).toContain('Method not supported');
    });

    it('connects to transport, handles message passing, and closes cleanly', async () => {
      const sent: any[] = [];
      let messageHandler: ((msg: any) => void) | undefined;
      let startCalled = false;
      let closeCalled = false;

      const mockTransport: any = {
        onMessage: (cb: (msg: any) => void) => {
          messageHandler = cb;
        },
        start: () => {
          startCalled = true;
        },
        send: (res: any) => {
          sent.push(res);
        },
        close: () => {
          closeCalled = true;
        },
      };

      await server.connect(mockTransport);
      expect(startCalled).toBe(true);
      expect(messageHandler).toBeDefined();

      // Send a request through the transport callback
      await messageHandler?.({
        jsonrpc: '2.0',
        id: 707,
        method: 'tools/list',
      });

      expect(sent.length).toBe(1);
      expect(sent[0].id).toBe(707);
      expect(sent[0].result.tools).toBeDefined();

      // Test close
      await server.close();
      expect(closeCalled).toBe(true);
    });

    it('handles aborting active requests on server.close()', async () => {
      // Start a slow tool call
      const slowPromise = server.handleMessage({
        jsonrpc: '2.0',
        id: 708,
        method: 'tools/call',
        params: { name: 'test_tool', arguments: { action: 'slow' } },
      });

      // Give it a tiny moment to start running
      await new Promise((r) => setTimeout(r, 10));

      // Close server while request is active
      await server.close();

      const resp = await slowPromise;
      expect(resp?.error).toBeDefined();
    });

    it('tests NativeStdioTransport send and close directly', () => {
      const transport = new NativeStdioTransport();
      const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

      transport.send({ jsonrpc: '2.0', id: 1, result: { ok: true } });
      expect(stdoutSpy).toHaveBeenCalledWith(
        JSON.stringify({ jsonrpc: '2.0', id: 1, result: { ok: true } }) + '\n'
      );

      transport.close();
      stdoutSpy.mockRestore();
    });
  });
});
