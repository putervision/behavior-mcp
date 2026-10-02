import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { BlackboardEngine } from '../../src/engine/blackboard.js';
import { BehaviorRegistry } from '../../src/engine/behaviors.js';
import { ExecutionEngine } from '../../src/engine/executor.js';
import { runMigrations } from '../../src/engine/migrations.js';

describe('Blackboard Slice Projection & Staleness Suite', () => {
  let db: Database.Database;
  const project = 'slice-test-project';

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('projects slice payload with prefix and timestamp metadata', () => {
    const tree = { id: 't_slice', type: 'action' as const, name: 'slice_action' };
    BehaviorRegistry.registerBehavior(db, { project, name: 'slice_behavior', tree });
    const exec = ExecutionEngine.startExecution(db, { project, behavior_name: 'slice_behavior' });

    const spatialData = {
      player: { x: 10, y: 0, z: 20 },
      enemies: [{ id: 'goblin_1', distance: 4.5 }],
      navmesh_valid: true,
    };

    const res = BlackboardEngine.ingestSlice(db, {
      project,
      execution_id: exec.id,
      slice_type: 'spatial',
      payload: spatialData,
      ttl_ms: 10000,
    });

    expect(res.success).toBe(true);
    expect(res.slice_type).toBe('spatial');
    expect(res.keys_updated).toContain('spatial.player');
    expect(res.keys_updated.length).toBeGreaterThanOrEqual(3);
    expect(res.ttl_ms).toBe(10000);
    expect(res.ingested_at).toBeDefined();
    expect(res.expires_at).toBeDefined();

    const bb = BlackboardEngine.getBlackboard(db, { project, execution_id: exec.id });
    expect(bb['spatial.player']).toEqual({ x: 10, y: 0, z: 20 });
    expect(bb['spatial.enemies']).toEqual([{ id: 'goblin_1', distance: 4.5 }]);
    expect(bb['spatial.navmesh_valid']).toBe(true);
    expect(bb['spatial._ingested_at']).toBe(res.ingested_at);
    expect(bb['spatial._expires_at']).toBe(res.expires_at);
    expect(bb['spatial._ttl_ms']).toBe(10000);
  });

  it('correctly reports staleness with isSliceStale', () => {
    const tree = { id: 't_stale', type: 'action' as const, name: 'stale_action' };
    BehaviorRegistry.registerBehavior(db, { project, name: 'stale_behavior', tree });
    const exec = ExecutionEngine.startExecution(db, { project, behavior_name: 'stale_behavior' });

    // Ingest with tiny TTL (1ms)
    BlackboardEngine.ingestSlice(db, {
      project,
      execution_id: exec.id,
      slice_type: 'spatial',
      payload: { target: 'chest' },
      ttl_ms: 1,
    });

    // Ingest visual with large TTL (60s)
    BlackboardEngine.ingestSlice(db, {
      project,
      execution_id: exec.id,
      slice_type: 'visual',
      payload: { screen_state: 'dialog_open' },
      ttl_ms: 60000,
    });

    const bb = BlackboardEngine.getBlackboard(db, { project, execution_id: exec.id });
    expect(BlackboardEngine.isSliceStale(bb, 'visual')).toBe(false);

    // After 10ms, spatial should be stale
    const staleCheck = BlackboardEngine.isSliceStale(bb, 'spatial', Date.now() + 10);
    expect(staleCheck).toBe(true);

    // Non-existent slice is considered stale
    expect(BlackboardEngine.isSliceStale(bb, 'task')).toBe(true);
  });
});
