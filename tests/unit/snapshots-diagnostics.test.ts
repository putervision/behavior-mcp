import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SnapshotEngine } from '../../src/engine/snapshots.js';
import { runMigrations } from '../../src/engine/migrations.js';
import { BehaviorRegistry } from '../../src/engine/behaviors.js';
import { TriggerRegistry } from '../../src/engine/triggers.js';

describe('behavior-mcp Snapshots, Diagnostics & State Rollback Test Suite', () => {
  let db: Database.Database;
  const project = 'snapshot-diagnostics-project';

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saves full system snapshots and lists registered checkpoints', () => {
    const tree = { id: 't_diag', type: 'action' as const, name: 'diag_action' };
    BehaviorRegistry.registerBehavior(db, { project, name: 'diag_behavior', tree });

    TriggerRegistry.registerTrigger(db, {
      project,
      name: 'trig_diag',
      behavior_name: 'diag_behavior',
      condition_type: 'event',
      condition_params: { type: 'alert' },
      priority: 8,
      cooldown_ms: 2000,
    });

    const snap = SnapshotEngine.saveSnapshot(db, {
      project,
      name: 'pre_experiment_checkpoint',
      description: 'Initial checkpoint before autonomous run',
    });

    expect(snap.snapshot_id).toBeDefined();
    expect(snap.name).toBe('pre_experiment_checkpoint');

    const list = SnapshotEngine.listSnapshots(db, { project });
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('pre_experiment_checkpoint');
  });

  it('restores previous checkpoint atomically and purges subsequent mutations', () => {
    BehaviorRegistry.registerBehavior(db, {
      project,
      name: 'core_behavior',
      tree: { id: 'core', type: 'action' as const, name: 'core_act' },
    });

    SnapshotEngine.saveSnapshot(db, {
      project,
      name: 'baseline_state',
    });

    // Mutate state with experimental behavior
    BehaviorRegistry.registerBehavior(db, {
      project,
      name: 'experimental_behavior',
      tree: { id: 'exp', type: 'action' as const, name: 'unsafe_act' },
    });

    expect(BehaviorRegistry.listBehaviors(db, project).length).toBe(2);

    // Rollback to baseline
    const restoreResult = SnapshotEngine.restoreSnapshot(db, {
      project,
      name: 'baseline_state',
    });

    expect(restoreResult.restored_behaviors).toBe(1);

    const afterRestoreList = BehaviorRegistry.listBehaviors(db, project);
    expect(afterRestoreList.length).toBe(1);
    expect(afterRestoreList[0].name).toBe('core_behavior');
  });
});
