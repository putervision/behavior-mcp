import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { SpoolEngine } from '../../src/engine/spool.js';
import { runMigrations } from '../../src/engine/migrations.js';
import { registerAllTools } from '../../src/tools/handlers.js';
import * as dbModule from '../../src/engine/db.js';

describe('SpoolEngine 60Hz Outcome Spool Suite', () => {
  let db: Database.Database;
  const project = 'spool-test-project';
  const toolMap = new Map<string, Function>();

  const mockServer = {
    tool: (name: string, desc: string, schema: any, handler: Function) => {
      toolMap.set(name, handler);
    },
  };

  beforeEach(() => {
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

  it('spools action outcome records and retrieves them', () => {
    const entry1 = SpoolEngine.spoolOutcome(db, {
      project,
      behavior_name: 'patrol',
      node_id: 'move_to_waypoint',
      action_type: 'navigate',
      parameters: { x: 10, y: 0, z: 20 },
      status: 'success',
      duration_ms: 15.4,
      tick: 42,
    });

    expect(entry1.id).toBeDefined();
    expect(entry1.synced).toBe(false);
    expect(entry1.tick).toBe(42);

    const entry2 = SpoolEngine.spoolOutcome(db, {
      project,
      behavior_name: 'patrol',
      node_id: 'scan_horizon',
      action_type: 'look_around',
      status: 'success',
      duration_ms: 8.2,
      tick: 43,
    });

    const entries = SpoolEngine.getSpoolEntries(db, { project, unsynced_only: true });
    expect(entries.length).toBe(2);
    expect(entries[0].node_id).toBe('move_to_waypoint');
    expect(entries[1].node_id).toBe('scan_horizon');
  });

  it('marks entries as synced and clears synced records', () => {
    const e1 = SpoolEngine.spoolOutcome(db, {
      project,
      behavior_name: 'mine',
      node_id: 'strike',
      action_type: 'attack',
      status: 'success',
    });

    const e2 = SpoolEngine.spoolOutcome(db, {
      project,
      behavior_name: 'mine',
      node_id: 'collect',
      action_type: 'interact',
      status: 'success',
    });

    const updated = SpoolEngine.markSynced(db, { project, ids: [e1.id] });
    expect(updated).toBe(1);

    const unsynced = SpoolEngine.getSpoolEntries(db, { project, unsynced_only: true });
    expect(unsynced.length).toBe(1);
    expect(unsynced[0].id).toBe(e2.id);

    const all = SpoolEngine.getSpoolEntries(db, { project, unsynced_only: false });
    expect(all.length).toBe(2);

    const cleared = SpoolEngine.clearSynced(db, { project });
    expect(cleared).toBe(1);

    const remaining = SpoolEngine.getSpoolEntries(db, { project, unsynced_only: false });
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(e2.id);
  });

  it('handles spool and drain_spool via get_metrics tool', async () => {
    const getMetrics = toolMap.get('get_metrics')!;

    SpoolEngine.spoolOutcome(db, {
      project,
      behavior_name: 'combat',
      node_id: 'dodge',
      action_type: 'jump',
      status: 'success',
    });

    SpoolEngine.spoolOutcome(db, {
      project,
      behavior_name: 'combat',
      node_id: 'strike',
      action_type: 'slash',
      status: 'failure',
    });

    // Query spool
    const spoolRes = await getMetrics({ action: 'spool', project });
    const spoolData = JSON.parse(spoolRes.content[0].text);
    expect(spoolData.action).toBe('spool');
    expect(spoolData.total).toBe(2);

    // Drain spool
    const drainRes = await getMetrics({ action: 'drain_spool', project });
    const drainData = JSON.parse(drainRes.content[0].text);
    expect(drainData.action).toBe('drain_spool');
    expect(drainData.drained_count).toBe(2);

    // Now unsynced count should be 0
    const emptyDrain = await getMetrics({ action: 'drain_spool', project });
    const emptyData = JSON.parse(emptyDrain.content[0].text);
    expect(emptyData.drained_count).toBe(0);
  });
});
