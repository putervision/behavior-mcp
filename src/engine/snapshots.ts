import Database from 'better-sqlite3';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { ValidationError } from '../utils/errors.js';
import { safeJsonParse } from '../utils/json-validator.js';

export class SnapshotEngine {
  static saveSnapshot(
    db: Database.Database,
    params: { project: string; name: string; description?: string }
  ): { snapshot_id: string; name: string; timestamp: string } {
    if (!params.name || typeof params.name !== 'string') {
      throw new ValidationError('Snapshot name is required.');
    }

    const behaviors = db.prepare('SELECT * FROM behavior_definitions WHERE project = ?').all(params.project);
    const triggers = db.prepare('SELECT * FROM triggers WHERE project = ?').all(params.project);
    const executions = db.prepare('SELECT * FROM execution_state WHERE project = ?').all(params.project);

    const data = { behaviors, triggers, executions };
    const id = generateId();
    const now = getCurrentIsoString();

    db.prepare(`
      INSERT INTO snapshots (id, project, name, description, data_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(project, name) DO UPDATE SET
        description = excluded.description,
        data_json = excluded.data_json,
        created_at = excluded.created_at
    `).run(id, params.project, params.name, params.description ?? null, JSON.stringify(data), now);

    return { snapshot_id: id, name: params.name, timestamp: now };
  }

  static restoreSnapshot(
    db: Database.Database,
    params: { project: string; name: string }
  ): { restored_behaviors: number; restored_triggers: number } {
    const row = db
      .prepare('SELECT * FROM snapshots WHERE project = ? AND name = ?')
      .get(params.project, params.name) as any;

    if (!row) {
      throw new ValidationError(`Snapshot "${params.name}" not found for project "${params.project}".`);
    }

    const data = safeJsonParse(row.data_json, { behaviors: [], triggers: [] });

    db.transaction(() => {
      db.prepare('DELETE FROM triggers WHERE project = ?').run(params.project);
      db.prepare('DELETE FROM behavior_definitions WHERE project = ?').run(params.project);

      if (Array.isArray(data.behaviors)) {
        const stmt = db.prepare(`
          INSERT INTO behavior_definitions (id, project, name, version, description, tree_json, tree_hash, is_active, metadata_json, client_request_id, created_at)
          VALUES (@id, @project, @name, @version, @description, @tree_json, @tree_hash, @is_active, @metadata_json, @client_request_id, @created_at)
        `);
        for (const b of data.behaviors) stmt.run(b);
      }

      if (Array.isArray(data.triggers)) {
        const stmt = db.prepare(`
          INSERT INTO triggers (id, project, name, behavior_name, condition_type, condition_params_json, priority, cooldown_ms, last_fired_at, is_enabled, metadata_json, created_at, updated_at)
          VALUES (@id, @project, @name, @behavior_name, @condition_type, @condition_params_json, @priority, @cooldown_ms, @last_fired_at, @is_enabled, @metadata_json, @created_at, @updated_at)
        `);
        for (const t of data.triggers) stmt.run(t);
      }
    })();

    return {
      restored_behaviors: data.behaviors?.length || 0,
      restored_triggers: data.triggers?.length || 0,
    };
  }

  static listSnapshots(
    db: Database.Database,
    params: { project: string; limit?: number }
  ): Array<{ id: string; name: string; description?: string; created_at: string }> {
    return db
      .prepare('SELECT id, name, description, created_at FROM snapshots WHERE project = ? ORDER BY created_at DESC LIMIT ?')
      .all(params.project, params.limit || 50) as any[];
  }
}
