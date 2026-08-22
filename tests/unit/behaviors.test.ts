import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/engine/migrations.js';
import { BehaviorRegistry } from '../../src/engine/behaviors.js';

describe('BehaviorRegistry', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  it('registers behavior tree and computes SHA-256 tree_hash', () => {
    const tree = {
      id: 'test_tree',
      type: 'sequence',
      children: [{ id: 'action1', type: 'action', name: 'move_to' }],
    };

    const b = BehaviorRegistry.registerBehavior(db, {
      project: 'test',
      name: 'patrol',
      tree,
    });

    expect(b.name).toBe('patrol');
    expect(b.tree_hash).toHaveLength(64);
    expect(b.version).toBe(1);

    const fetched = BehaviorRegistry.getBehavior(db, { project: 'test', name: 'patrol' });
    expect(fetched.tree_hash).toBe(b.tree_hash);
  });

  it('supports idempotency via client_request_id', () => {
    const tree = { id: 'tree_1', type: 'sequence' };
    const b1 = BehaviorRegistry.registerBehavior(db, {
      project: 'test',
      name: 'gather',
      tree,
      client_request_id: 'req_gather_1',
    });

    const b2 = BehaviorRegistry.registerBehavior(db, {
      project: 'test',
      name: 'gather_diff',
      tree,
      client_request_id: 'req_gather_1',
    });

    expect(b1.id).toBe(b2.id);
  });
});
