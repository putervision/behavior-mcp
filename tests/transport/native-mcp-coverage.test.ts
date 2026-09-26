import { describe, it, expect } from 'vitest';
import {
  NativeMcpServer,
  NativeClient,
  NativeInMemoryTransport,
} from '../../src/transport/native-mcp.js';
import { z } from '../../src/schema/schemas.js';

describe('Behavior-MCP Native Transport & Client Exhaustive Coverage', () => {
  it('handles client-server initialize, tools, prompts, resources, and error forwarding', async () => {
    const server = new NativeMcpServer({ name: 'test-behavior-server', version: '1.0.0' });

    // Register a tool
    server.tool('echo_tool', 'Echo tool', { text: z.string() }, async (args: any) => ({
      content: [{ type: 'text', text: `Echo: ${args.text}` }],
    }));

    // Register a prompt
    server.prompt('system_prompt', 'System prompt', { role: { type: 'string' } }, (args: any) => ({
      messages: [{ role: 'user', content: { type: 'text', text: `Role: ${args.role}` } }],
    }));

    // Register a resource
    server.registerResource('config', 'config://app', { title: 'config' }, async () => ({
      contents: [{ uri: 'config://app', mimeType: 'application/json', text: '{"debug":true}' }],
    }));

    const [clientTransport, serverTransport] = NativeInMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new NativeClient(
      { name: 'test-client', version: '1.0.0' },
      { capabilities: { prompts: {}, resources: {} } }
    );
    await client.connect(clientTransport);

    // 1. tools
    const tools = await client.listTools();
    expect(tools.tools.some((t: any) => t.name === 'echo_tool')).toBe(true);

    const toolRes = await client.callTool({ name: 'echo_tool', arguments: { text: 'hello' } });
    expect(toolRes.content[0].text).toBe('Echo: hello');

    const badTool = await client.callTool({ name: 'unknown_tool', arguments: {} });
    expect(badTool.isError).toBe(true);

    // 2. prompts
    const prompts = await client.listPrompts();
    expect(prompts.prompts.some((p: any) => p.name === 'system_prompt')).toBe(true);

    const promptRes = await client.getPrompt({
      name: 'system_prompt',
      arguments: { role: 'tester' },
    });
    expect(promptRes.messages[0].content.text).toBe('Role: tester');
    expect(server._registeredPrompts['system_prompt']).toBeDefined();

    // 3. resources
    const resources = await client.listResources();
    expect(resources.resources.some((r: any) => r.name === 'config')).toBe(true);

    const resourceRes = await client.readResource({ uri: 'config://app' });
    expect(resourceRes.contents[0].text).toContain('"debug":true');

    // 4. close
    await client.close();
    await server.close();
  });
});
