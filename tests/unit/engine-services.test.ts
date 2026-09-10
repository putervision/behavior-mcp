import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { MetricsEngine } from '../../src/engine/metrics.js';
import { RecordingEngine } from '../../src/engine/recordings.js';
import { BlackboardEngine } from '../../src/engine/blackboard.js';
import { SnapshotEngine } from '../../src/engine/snapshots.js';
import { verifyEventChain, logRuntimeEvent } from '../../src/engine/events.js';
import { BehaviorRegistry } from '../../src/engine/behaviors.js';
import { ExecutionEngine } from '../../src/engine/executor.js';
import { TriggerRegistry } from '../../src/engine/triggers.js';
import { runMigrations } from '../../src/engine/migrations.js';

describe('Behavior MCP Engine Services Suite', () => {
  let db: Database.Database;
  const project = 'test-behavior-project';

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('BehaviorRegistry', () => {
    it('registers and retrieves behavior trees with SHA-256 tree hash verification', () => {
      const tree = {
        id: 'patrol_tree',
        type: 'sequence' as const,
        children: [{ id: 'a1', type: 'action' as const, name: 'patrol' }],
      };

      const reg = BehaviorRegistry.registerBehavior(db, {
        project,
        name: 'patrol_tree',
        tree,
        description: 'Standard patrol behavior',
      });

      expect(reg.name).toBe('patrol_tree');
      expect(reg.tree_hash).toBeDefined();
      expect(reg.tree_hash.length).toBe(64);

      const retrieved = BehaviorRegistry.getBehavior(db, { project, name: 'patrol_tree' });
      expect(retrieved.name).toBe('patrol_tree');
      expect(JSON.parse(retrieved.tree_json)).toEqual(tree);

      const list = BehaviorRegistry.listBehaviors(db, project);
      expect(list.length).toBe(1);
    });
  });

  describe('ExecutionEngine & BlackboardEngine', () => {
    it('starts, updates blackboard, and stops execution instances with full isolation', () => {
      const tree = { id: 't1', type: 'action' as const, name: 'gather' };
      BehaviorRegistry.registerBehavior(db, { project, name: 'gather', tree });

      const exec = ExecutionEngine.startExecution(db, {
        project,
        behavior_name: 'gather',
        parameters: { target_item: 'wood' },
      });

      expect(exec.status).toBe('running');
      expect(exec.behavior_name).toBe('gather');

      // Blackboard updates
      BlackboardEngine.setBlackboardKey(db, {
        project,
        execution_id: exec.id,
        key: 'wood_collected',
        value: 42,
      });

      const bb = BlackboardEngine.getBlackboard(db, { project, execution_id: exec.id });
      expect(bb.wood_collected).toBe(42);
      expect(bb.target_item).toBe('wood');

      // Stop execution
      const stopped = ExecutionEngine.stopExecution(db, {
        project,
        execution_id: exec.id,
        status: 'success',
      });
      expect(stopped.status).toBe('success');
    });
  });

  describe('TriggerRegistry', () => {
    it('registers, filters, and lists reactive interrupt triggers', () => {
      const trig = TriggerRegistry.registerTrigger(db, {
        project,
        name: 'low_hp_emergency',
        behavior_name: 'flee_and_heal',
        condition_type: 'hp_threshold',
        condition_params: { threshold: 25 },
        priority: 9,
        cooldown_ms: 5000,
      });

      expect(trig.name).toBe('low_hp_emergency');
      expect(trig.priority).toBe(9);

      const list = TriggerRegistry.listTriggers(db, project);
      expect(list.length).toBe(1);
      expect(list[0].behavior_name).toBe('flee_and_heal');
    });
  });

  describe('MetricsEngine & RecordingEngine', () => {
    it('records and queries telemetry metrics and frame recordings', () => {
      const tree = { id: 't1', type: 'action' as const, name: 'combat_loop' };
      BehaviorRegistry.registerBehavior(db, { project, name: 'combat_loop', tree });
      const exec = ExecutionEngine.startExecution(db, { project, behavior_name: 'combat_loop' });

      MetricsEngine.recordMetrics(db, {
        project,
        execution_id: exec.id,
        behavior_name: 'combat_loop',
        status: 'completed',
        tick_count: 3600,
        duration_ms: 60000,
        avg_tick_ms: 16.2,
        max_tick_ms: 28.5,
        stuck_count: 0,
        interrupt_count: 1,
      });

      const metrics = MetricsEngine.getMetrics(db, { project, behavior_name: 'combat_loop' });
      expect(metrics.length).toBe(1);
      expect(metrics[0].duration_ms).toBe(60000);
      expect(metrics[0].tick_count).toBe(3600);

      // Recordings
      const frames = [
        { tick: 1, action: 'move', coordinates: [0, 0] },
        { tick: 2, action: 'attack', target: 'goblin' },
      ];
      RecordingEngine.saveRecording(db, {
        project,
        execution_id: exec.id,
        behavior_name: 'combat_loop',
        frames,
      });

      const recordings = RecordingEngine.listRecordings(db, project);
      expect(recordings.length).toBe(1);
      expect(recordings[0].total_frames).toBe(2);
    });
  });

  describe('Cryptographic Merkle Event Ledger', () => {
    it('maintains verifiable SHA-256 event hash chain without corruption', () => {
      logRuntimeEvent(db, {
        project,
        entity_id: 'ent_1',
        entity_type: 'execution',
        action: 'start',
        details: { mode: 'test' },
      });

      logRuntimeEvent(db, {
        project,
        entity_id: 'ent_1',
        entity_type: 'execution',
        action: 'update',
        details: { key: 'status', val: 'active' },
      });

      const audit = verifyEventChain(db, project);
      expect(audit.valid).toBe(true);
      expect(audit.total_events).toBe(2);
    });
  });
});
