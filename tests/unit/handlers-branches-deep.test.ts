import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { registerAllTools, jsonSchemaToZod } from '../../src/tools/handlers.js';
import { runMigrations } from '../../src/engine/migrations.js';
import { EmergencySafety } from '../../src/engine/safety.js';
import * as dbModule from '../../src/engine/db.js';
import { registerAllPrompts } from '../../src/tools/prompts.js';
import { ExecutionEngine } from '../../src/engine/executor.js';
import { BehaviorTreeEvaluator } from '../../src/engine/browser/executor-bundle.js';
import { TriggerRegistry } from '../../src/engine/triggers.js';
import { MetricsEngine } from '../../src/engine/metrics.js';
import { BehaviorTreeNode } from '../../src/schema/types.js';

describe('behavior-mcp Handlers & Executor Deep Branches', () => {
  let db: Database.Database;
  const project = 'deep-branch-test';
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

    vi.spyOn(dbModule, 'getDb').mockReturnValue(db);
    vi.spyOn(dbModule, 'getReadOnlyDb').mockReturnValue(db);
    vi.spyOn(dbModule, 'getProjectSlug').mockReturnValue(project);

    registerAllTools(mockServer as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.close();
  });

  describe('Zod Schema Converter Edge Cases', () => {
    it('should handle primitives and nested object schemas', () => {
      expect(jsonSchemaToZod(null)).toBeDefined();
      expect(jsonSchemaToZod('string')).toBeDefined();
      expect(jsonSchemaToZod({ type: 'number' })).toBeDefined();
      expect(jsonSchemaToZod({ type: 'boolean' })).toBeDefined();
      expect(jsonSchemaToZod({ type: 'array', items: { type: 'string' } })).toBeDefined();
      expect(
        jsonSchemaToZod({
          type: 'object',
          properties: { field: { type: 'string' } },
          required: ['field'],
        })
      ).toBeDefined();
    });
  });

  describe('Manage Behaviors Deep Actions', () => {
    it('should register, get with version, list, and handle not found', async () => {
      const manageBehaviors = toolMap.get('manage_behaviors')!;
      const tree = {
        id: 'sample_tree',
        type: 'sequence' as const,
        children: [
          { id: 'child_1', type: 'action' as const, name: 'log', parameters: { message: 'hello' } },
        ],
      };

      const regRes = await manageBehaviors({
        action: 'register',
        project,
        name: 'sample_tree',
        tree,
      });
      expect(regRes.content[0].text).toContain('sample_tree');

      const getRes = await manageBehaviors({
        action: 'get',
        project,
        name: 'sample_tree',
        version: 1,
      });
      expect(getRes.content[0].text).toContain('sample_tree');

      const listRes = await manageBehaviors({
        action: 'list',
        project,
      });
      expect(listRes.content[0].text).toContain('sample_tree');

      const notFound = await manageBehaviors({
        action: 'get',
        project,
        name: 'non_existent',
      });
      expect(notFound.content[0].text).toContain('not found');

      const unsupported = await manageBehaviors({
        action: 'unsupported_action',
        project,
      });
      expect(unsupported.content[0].text).toContain('Unsupported manage_behaviors action');
    });
  });

  describe('Manage Runtime DB Deep Actions', () => {
    it('should handle stats, snapshot, diff, restore, audit, and invalid action', async () => {
      const manageDb = toolMap.get('manage_runtime_db')!;

      // Stats
      const statsRes = await manageDb({
        action: 'stats',
        project,
      });
      expect(statsRes.content[0].text).toContain('behaviorsCount');

      // Snapshot
      const snapRes = await manageDb({
        action: 'snapshot',
        project,
        name: 'test_snap',
      });
      expect(snapRes.content[0].text).toContain('test_snap');

      // Diff
      const diffRes = await manageDb({
        action: 'diff',
        project,
      });
      expect(diffRes.content[0].text).toContain('test_snap');

      // Restore
      const restoreRes = await manageDb({
        action: 'restore',
        project,
        name: 'test_snap',
      });
      expect(restoreRes.content[0].text).toContain('restored');

      // Audit
      const auditRes = await manageDb({
        action: 'audit',
        project,
      });
      expect(auditRes.content[0].text).toContain('valid');

      // Invalid
      const invalidRes = await manageDb({
        action: 'invalid_action',
        project,
      });
      expect(invalidRes.content[0].text).toContain('Unsupported manage_runtime_db action');
    });
  });

  describe('Manage Blackboard Tool', () => {
    it('should handle set, get, and validation errors', async () => {
      const loadTool = toolMap.get('load_behavior')!;
      const manageBehaviors = toolMap.get('manage_behaviors')!;
      const manageBlackboard = toolMap.get('manage_blackboard')!;

      await manageBehaviors({
        action: 'register',
        name: 'bb_tree',
        tree: { type: 'action', name: 'log' },
      });

      const loaded = await loadTool({
        action: 'load',
        behavior_name: 'bb_tree',
      });
      const execId = JSON.parse(loaded.content[0].text).id;

      // Set
      const setRes = await manageBlackboard({
        action: 'set',
        execution_id: execId,
        key: 'score',
        value: 100,
      });
      expect(setRes.content[0].text).toContain('100');

      // Get
      const getRes = await manageBlackboard({
        action: 'get',
        execution_id: execId,
      });
      expect(getRes.content[0].text).toContain('100');

      // Invalid action
      const invalid = await manageBlackboard({
        action: 'unknown',
        execution_id: execId,
      });
      expect(invalid.content[0].text).toContain('Unsupported manage_blackboard action');
    });
  });

  describe('Execution Engine Direct Ticking & Swapping', () => {
    it('should tick and swap execution state directly', () => {
      const manageBehaviors = toolMap.get('manage_behaviors')!;
      manageBehaviors({
        action: 'register',
        name: 'tick_tree',
        tree: { type: 'action', name: 'log' },
      });

      const exec = ExecutionEngine.startExecution(db, {
        project,
        behavior_name: 'tick_tree',
      });

      const ticked = ExecutionEngine.tickExecution(db, {
        project,
        execution_id: exec.id,
        active_node_path: 'root/seq_0',
        status: 'running',
        stuck_score: 0.1,
        blackboard: { mana: 80 },
      });

      expect(ticked.current_tick).toBe(1);
      expect(ticked.status).toBe('running');
      expect(ticked.active_node_path).toBe('root/seq_0');
      expect(ticked.blackboard_json).toContain('80');
    });
  });

  describe('Get Metrics Tool Deep Filters', () => {
    it('should filter metrics by execution_id and behavior_name', async () => {
      const loadTool = toolMap.get('load_behavior')!;
      const manageBehaviors = toolMap.get('manage_behaviors')!;
      const metricsTool = toolMap.get('get_metrics')!;

      await manageBehaviors({
        action: 'register',
        name: 'patrol_metrics',
        tree: { type: 'action', name: 'log' },
      });

      const loaded = await loadTool({
        action: 'load',
        behavior_name: 'patrol_metrics',
      });
      const execId = JSON.parse(loaded.content[0].text).id;

      MetricsEngine.recordMetrics(db, {
        project,
        execution_id: execId,
        behavior_name: 'patrol_metrics',
        status: 'completed',
        tick_count: 60,
        duration_ms: 1000,
        avg_tick_ms: 16.6,
        max_tick_ms: 20.0,
        stuck_count: 0,
        interrupt_count: 0,
      });

      const execMetrics = await metricsTool({
        action: 'history',
        execution_id: execId,
      });
      expect(execMetrics.content[0].text).toContain('patrol_metrics');

      const behaviorMetrics = await metricsTool({
        action: 'history',
        behavior_name: 'patrol_metrics',
      });
      expect(behaviorMetrics.content[0].text).toContain('patrol_metrics');
    });
  });

  describe('Trigger Registry Proximity & Cooldown', () => {
    it('should evaluate enemy_proximity trigger condition and obey cooldown', () => {
      TriggerRegistry.registerTrigger(db, {
        project,
        name: 'proximity_alert',
        behavior_name: 'flee',
        condition_type: 'enemy_proximity',
        condition_params: { radius: 15 },
        cooldown_ms: 5000,
      });

      const fired = TriggerRegistry.evaluateTriggers(db, {
        project,
        telemetry: { enemy_distance: 10 },
      });
      expect(fired).not.toBeNull();
      expect(fired?.name).toBe('proximity_alert');

      // Second check in cooldown should return null
      const inCooldown = TriggerRegistry.evaluateTriggers(db, {
        project,
        telemetry: { enemy_distance: 5 },
      });
      expect(inCooldown).toBeNull();
    });
  });

  describe('Executor Bundle In-Browser Evaluator Branches', () => {
    it('should handle selector failure when all fail', () => {
      const tree: BehaviorTreeNode = {
        id: 'sel-1',
        type: 'selector',
        children: [
          { id: 'c1', type: 'condition', name: 'hp_below', parameters: { threshold: 10 } },
          { id: 'c2', type: 'condition', name: 'enemy_in_range', parameters: { max_range: 5 } },
        ],
      };
      const evaluator = new BehaviorTreeEvaluator(tree);
      const res = evaluator.step({ hp: 100, enemy_distance: 50 });
      expect(res.status).toBe('FAILURE');
    });

    it('should handle inverter running status', () => {
      const tree: BehaviorTreeNode = {
        id: 'inv-1',
        type: 'inverter',
        children: [
          {
            id: 'a1',
            type: 'action',
            name: 'move_to',
            parameters: { target: 'base', duration_ticks: 5 },
          },
        ],
      };
      const evaluator = new BehaviorTreeEvaluator(tree);
      const res = evaluator.step();
      expect(res.status).toBeDefined();
    });

    it('should handle guard node with guard subtree and condition name', () => {
      const guardWithSubtree: BehaviorTreeNode = {
        id: 'g1',
        type: 'guard',
        guard: { id: 'gc1', type: 'condition', name: 'hp_below', parameters: { threshold: 20 } },
        children: [{ id: 'ga1', type: 'action', name: 'log', parameters: { message: 'safe' } }],
      };
      const eval1 = new BehaviorTreeEvaluator(guardWithSubtree);
      const res1 = eval1.step({ hp: 50 });
      expect(res1.status).toBe('FAILURE');

      const guardWithName: BehaviorTreeNode = {
        id: 'g2',
        type: 'guard',
        name: 'hp_below',
        parameters: { threshold: 20 },
        children: [{ id: 'ga2', type: 'action', name: 'log', parameters: { message: 'safe' } }],
      };
      const eval2 = new BehaviorTreeEvaluator(guardWithName);
      const res2 = eval2.step({ hp: 50 });
      expect(res2.status).toBe('FAILURE');
    });

    it('should handle timeout node expiration', () => {
      const tree: BehaviorTreeNode = {
        id: 'to-1',
        type: 'timeout',
        timeout_ms: 100,
        children: [{ id: 'a2', type: 'action', name: 'move_to', parameters: {} }],
      };
      const evaluator = new BehaviorTreeEvaluator(tree);
      const res = evaluator.step({ tick_duration_ms: 500 });
      expect(res.status).toBe('FAILURE');
    });
  });

  describe('Prompt Callbacks Direct Invocations', () => {
    it('should execute prompt callbacks successfully', async () => {
      const promptMap = new Map<string, Function>();
      const mockPromptServer = {
        prompt: (name: string, desc: string, schema: any, handler: Function) => {
          promptMap.set(name, handler);
        },
      };

      registerAllPrompts(mockPromptServer as any);
      expect(promptMap.size).toBe(4);

      for (const [, handler] of promptMap.entries()) {
        const res = await handler({
          project,
          objective: 'Test Combat',
          execution_id: 'e1',
          behavior_name: 'test_tree',
        });
        expect(res.messages[0].content.text.length).toBeGreaterThan(0);
      }
    });
  });
});
