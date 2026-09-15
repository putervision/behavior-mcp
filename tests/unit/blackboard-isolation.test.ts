import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { BlackboardEngine } from '../../src/engine/blackboard.js';
import { BehaviorRegistry } from '../../src/engine/behaviors.js';
import { ExecutionEngine } from '../../src/engine/executor.js';
import { runMigrations } from '../../src/engine/migrations.js';

describe('Blackboard Concurrency & Isolation Suite', () => {
  let db: Database.Database;
  const project = 'blackboard-test-project';

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('preserves complex nested structures, arrays, and primitive datatypes', () => {
    const tree = { id: 't_bb', type: 'action' as const, name: 'bb_action' };
    BehaviorRegistry.registerBehavior(db, { project, name: 'bb_behavior', tree });
    const exec = ExecutionEngine.startExecution(db, { project, behavior_name: 'bb_behavior' });

    // String
    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: exec.id,
      key: 'agent_name',
      value: 'Sentinel-01',
    });

    // Number
    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: exec.id,
      key: 'energy_level',
      value: 98.6,
    });

    // Array of objects
    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: exec.id,
      key: 'waypoint_queue',
      value: [
        { x: 10, y: 0, z: 25 },
        { x: 50, y: 5, z: 100 },
      ],
    });

    // Nested configuration object
    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: exec.id,
      key: 'tactical_matrix',
      value: {
        aggression_multiplier: 1.5,
        retreat_health_pct: 0.25,
        priority_targets: ['boss', 'healer'],
      },
    });

    const state = BlackboardEngine.getBlackboard(db, { project, execution_id: exec.id });

    expect(state.agent_name).toBe('Sentinel-01');
    expect(state.energy_level).toBe(98.6);
    expect(Array.isArray(state.waypoint_queue)).toBe(true);
    expect((state.waypoint_queue as any[])[0].x).toBe(10);
    expect((state.tactical_matrix as any).priority_targets).toContain('boss');
  });

  it('guarantees complete isolation across concurrent execution instances', () => {
    const tree = { id: 't_iso', type: 'action' as const, name: 'iso_action' };
    BehaviorRegistry.registerBehavior(db, { project, name: 'iso_behavior', tree });

    const execA = ExecutionEngine.startExecution(db, { project, behavior_name: 'iso_behavior' });
    const execB = ExecutionEngine.startExecution(db, { project, behavior_name: 'iso_behavior' });

    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: execA.id,
      key: 'target_id',
      value: 'TARGET_ALPHA',
    });

    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: execB.id,
      key: 'target_id',
      value: 'TARGET_BETA',
    });

    const stateA = BlackboardEngine.getBlackboard(db, { project, execution_id: execA.id });
    const stateB = BlackboardEngine.getBlackboard(db, { project, execution_id: execB.id });

    expect(stateA.target_id).toBe('TARGET_ALPHA');
    expect(stateB.target_id).toBe('TARGET_BETA');
    expect(stateA.target_id).not.toBe(stateB.target_id);
  });

  it('supports delete, list, and lease operations on execution blackboard', () => {
    const tree = { id: 't_verbs', type: 'action' as const, name: 'verbs_action' };
    BehaviorRegistry.registerBehavior(db, { project, name: 'verbs_behavior', tree });
    const exec = ExecutionEngine.startExecution(db, { project, behavior_name: 'verbs_behavior' });

    // 1. set and list
    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: exec.id,
      key: 'status',
      value: 'running',
    });
    BlackboardEngine.setBlackboardKey(db, {
      project,
      execution_id: exec.id,
      key: 'tick',
      value: 42,
    });

    const listRes = BlackboardEngine.listBlackboard(db, { project, execution_id: exec.id });
    expect(listRes.keys).toContain('status');
    expect(listRes.keys).toContain('tick');
    expect(listRes.count).toBe(2);

    // 2. lease
    const lease1 = BlackboardEngine.leaseBlackboard(db, {
      project,
      execution_id: exec.id,
      key: 'status',
      agent_id: 'agent_alpha',
      duration_seconds: 30,
      mode: 'acquire',
    });
    expect(lease1.success).toBe(true);
    expect(lease1.expires_at).toBeDefined();

    // Conflicting lease
    const leaseConflict = BlackboardEngine.leaseBlackboard(db, {
      project,
      execution_id: exec.id,
      key: 'status',
      agent_id: 'agent_beta',
      mode: 'acquire',
    });
    expect(leaseConflict.success).toBe(false);

    // Release lease
    const leaseRelease = BlackboardEngine.leaseBlackboard(db, {
      project,
      execution_id: exec.id,
      key: 'status',
      agent_id: 'agent_alpha',
      mode: 'release',
    });
    expect(leaseRelease.success).toBe(true);

    // 3. delete
    const delRes = BlackboardEngine.deleteBlackboardKey(db, {
      project,
      execution_id: exec.id,
      key: 'tick',
    });
    expect(delRes.success).toBe(true);
    expect(delRes.remaining_keys).not.toContain('tick');
  });
});
