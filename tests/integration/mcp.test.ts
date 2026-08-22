import { describe, it, expect } from 'vitest';
import { toolDefinitions } from '../../src/tools/definitions.js';

describe('Runtime MCP Server Registration', () => {
  it('registers all 10 MCP runtime tools', () => {
    expect(toolDefinitions).toHaveLength(10);
    const names = toolDefinitions.map((t) => t.name);
    expect(names).toContain('load_behavior');
    expect(names).toContain('set_parameters');
    expect(names).toContain('get_status');
    expect(names).toContain('abort_behavior');
    expect(names).toContain('register_trigger');
    expect(names).toContain('replay_recording');
    expect(names).toContain('get_metrics');
    expect(names).toContain('manage_behaviors');
    expect(names).toContain('manage_blackboard');
    expect(names).toContain('manage_runtime_db');
  });
});
