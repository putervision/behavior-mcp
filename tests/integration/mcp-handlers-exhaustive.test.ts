import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from '../../src/tools/handlers.js';
import { runMigrations } from '../../src/engine/migrations.js';
import { EmergencySafety } from '../../src/engine/safety.js';
import * as dbModule from '../../src/engine/db.js';

describe('behavior-mcp Exhaustive MCP Handlers Integration Test Suite', () => {
  let db: Database.Database;
  const project = 'integration-test-project';
  const toolMap = new Map<string, Function>();

  const mockServer = {
    tool: (name: string, desc: string, schema: any, handler: Function) => {
      toolMap.set(name, handler);
    },
  };

  beforeEach(() => {
    EmergencySafety.resetSafety();
    db = new Database(':memory:');
    runMigrations(db);
    toolMap.clear();

    // Mock db lookup
    vi.spyOn(dbModule, 'getDb').mockReturnValue(db);
    vi.spyOn(dbModule, 'getReadOnlyDb').mockReturnValue(db);
    vi.spyOn(dbModule, 'getProjectSlug').mockReturnValue(project);

    registerAllTools(mockServer as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
  });

  it('registers behavior, loads execution, manages blackboard, queries status, and aborts safely', async () => {
    // 1. manage_behaviors: register
    const manageBehaviors = toolMap.get('manage_behaviors')!;
    const tree = {
      id: 'harvest_loop',
      type: 'sequence',
      children: [{ id: 'a1', type: 'action', name: 'gather_wood' }],
    };

    const regRes = await manageBehaviors({
      action: 'register',
      name: 'harvest_loop',
      tree,
      description: 'Wood gathering loop',
    });
    expect(regRes.isError).toBeUndefined();
    const regData = JSON.parse(regRes.content[0].text);
    expect(regData.name).toBe('harvest_loop');
    expect(regData.tree_hash).toBeDefined();

    // 2. load_behavior
    const loadBehavior = toolMap.get('load_behavior')!;
    const loadRes = await loadBehavior({
      action: 'load',
      behavior_name: 'harvest_loop',
      parameters: { target_yield: 50 },
    });
    expect(loadRes.isError).toBeUndefined();
    const loadData = JSON.parse(loadRes.content[0].text);
    expect(loadData.id).toBeDefined();
    expect(loadData.status).toBe('running');
    expect(loadData._suggestions).toBeDefined();

    const execId = loadData.id;

    // 3. get_status
    const getStatus = toolMap.get('get_status')!;
    const statusRes = await getStatus({
      action: 'current',
      execution_id: execId,
    });
    const statusData = JSON.parse(statusRes.content[0].text);
    expect(statusData.id).toBe(execId);
    expect(statusData.status).toBe('running');

    // 4. manage_blackboard: set and get
    const manageBlackboard = toolMap.get('manage_blackboard')!;
    await manageBlackboard({
      action: 'set',
      execution_id: execId,
      key: 'inventory_count',
      value: 12,
    });

    const getBbRes = await manageBlackboard({
      action: 'get',
      execution_id: execId,
    });
    const bbData = JSON.parse(getBbRes.content[0].text);
    expect(bbData.inventory_count).toBe(12);

    // 5. abort_behavior
    const abortBehavior = toolMap.get('abort_behavior')!;
    const abortRes = await abortBehavior({
      action: 'abort',
      execution_id: execId,
      reason: 'Testing normal abort',
    });
    const abortData = JSON.parse(abortRes.content[0].text);
    expect(abortData.status).toBe('aborted');
  });

  it('handles triggers, recordings, and database maintenance', async () => {
    // 1. register_trigger: register and list
    const registerTrigger = toolMap.get('register_trigger')!;
    const regTrigRes = await registerTrigger({
      action: 'register',
      name: 'low_stamina_guard',
      behavior_name: 'rest_action',
      condition_type: 'stamina_threshold',
      condition_params: { min: 10 },
      priority: 5,
      cooldown_ms: 1000,
    });
    const trigData = JSON.parse(regTrigRes.content[0].text);
    expect(trigData.name).toBe('low_stamina_guard');

    const listTrigRes = await registerTrigger({ action: 'list' });
    const listTrigData = JSON.parse(listTrigRes.content[0].text);
    expect(listTrigData.length).toBe(1);

    // 2. replay_recording: capture and list
    const manageBehaviors = toolMap.get('manage_behaviors')!;
    await manageBehaviors({
      action: 'register',
      name: 'harvest_record_tree',
      tree: { id: 't1', type: 'action', name: 'gather' },
    });
    const loadBehavior = toolMap.get('load_behavior')!;
    const loadRes = await loadBehavior({
      action: 'load',
      behavior_name: 'harvest_record_tree',
    });
    const execId = JSON.parse(loadRes.content[0].text).id;

    const replayRecording = toolMap.get('replay_recording')!;
    const captureRes = await replayRecording({
      action: 'capture',
      execution_id: execId,
      name: 'harvest_recording',
      frames: [{ tick: 1, action: 'chop' }],
    });
    const captureData = JSON.parse(captureRes.content[0].text);
    expect(captureData.id).toBeDefined();

    const listRecRes = await replayRecording({ action: 'list' });
    const listRecData = JSON.parse(listRecRes.content[0].text);
    expect(listRecData.length).toBe(1);

    // 3. manage_runtime_db: stats and audit
    const manageDb = toolMap.get('manage_runtime_db')!;
    const statsRes = await manageDb({ action: 'stats' });
    const statsData = JSON.parse(statsRes.content[0].text);
    expect(statsData.triggersCount).toBe(1);

    const auditRes = await manageDb({ action: 'audit' });
    const auditData = JSON.parse(auditRes.content[0].text);
    expect(auditData.valid).toBe(true);
  });

  it('rejects execution when EmergencySafety kill switch is active', async () => {
    EmergencySafety.engageKillSwitch();
    const loadBehavior = toolMap.get('load_behavior')!;
    const res = await loadBehavior({
      action: 'load',
      behavior_name: 'test_behavior',
    });
    expect(res.isError).toBe(true);
    const errData = JSON.parse(res.content[0].text);
    expect(errData.error).toContain('kill switch is engaged');
  });

  it('rejects disallowed behavior names through PolicyGate', async () => {
    const loadBehavior = toolMap.get('load_behavior')!;
    const res = await loadBehavior({
      action: 'load',
      behavior_name: 'delete_item',
    });
    expect(res.isError).toBe(true);
    const errData = JSON.parse(res.content[0].text);
    expect(errData.error).toContain('PolicyGate blocked');
  });
});
