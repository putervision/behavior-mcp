import Database from 'better-sqlite3';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse, safeJsonStringify } from '../utils/json-validator.js';
import { OutcomeSpoolEntry } from '../schema/types.js';

export class SpoolEngine {
  static ensureTable(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS outcome_spool (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        behavior_name TEXT NOT NULL,
        execution_id TEXT,
        session_id TEXT,
        node_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        parameters_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL,
        duration_ms REAL NOT NULL DEFAULT 0.0,
        tick INTEGER NOT NULL DEFAULT 0,
        synced INTEGER NOT NULL DEFAULT 0,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_spool_project_synced ON outcome_spool(project, synced);
      CREATE INDEX IF NOT EXISTS idx_spool_timestamp ON outcome_spool(timestamp);
    `);
  }

  static spoolOutcome(
    db: Database.Database,
    entry: {
      project: string;
      behavior_name: string;
      execution_id?: string;
      session_id?: string;
      node_id: string;
      action_type: string;
      parameters?: Record<string, unknown>;
      status: string;
      duration_ms?: number;
      tick?: number;
    }
  ): OutcomeSpoolEntry {
    this.ensureTable(db);
    const id = generateId();
    const now = getCurrentIsoString();
    const duration_ms = entry.duration_ms ?? 0.0;
    const tick = entry.tick ?? 0;
    const paramsJson = safeJsonStringify(entry.parameters || {});

    db.prepare(`
      INSERT INTO outcome_spool (
        id, project, behavior_name, execution_id, session_id,
        node_id, action_type, parameters_json, status,
        duration_ms, tick, synced, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      id,
      entry.project,
      entry.behavior_name,
      entry.execution_id ?? null,
      entry.session_id ?? null,
      entry.node_id,
      entry.action_type,
      paramsJson,
      entry.status,
      duration_ms,
      tick,
      now
    );

    return {
      id,
      project: entry.project,
      behavior_name: entry.behavior_name,
      node_id: entry.node_id,
      action_type: entry.action_type,
      parameters: entry.parameters || {},
      status: entry.status,
      duration_ms,
      tick,
      timestamp: now,
      synced: false,
    };
  }

  static getSpoolEntries(
    db: Database.Database,
    params: {
      project: string;
      limit?: number;
      unsynced_only?: boolean;
    }
  ): OutcomeSpoolEntry[] {
    this.ensureTable(db);
    let sql = 'SELECT * FROM outcome_spool WHERE project = ?';
    const sqlParams: any[] = [params.project];

    if (params.unsynced_only) {
      sql += ' AND synced = 0';
    }

    sql += ' ORDER BY timestamp ASC LIMIT ?';
    sqlParams.push(params.limit || 100);

    const rows = db.prepare(sql).all(...sqlParams) as any[];
    return rows.map((r) => ({
      id: r.id,
      project: r.project,
      behavior_name: r.behavior_name,
      node_id: r.node_id,
      action_type: r.action_type,
      parameters: safeJsonParse(r.parameters_json, {}),
      status: r.status,
      duration_ms: r.duration_ms,
      tick: r.tick,
      timestamp: r.timestamp,
      synced: r.synced === 1,
    }));
  }

  static markSynced(
    db: Database.Database,
    params: {
      project: string;
      ids: string[];
    }
  ): number {
    this.ensureTable(db);
    if (!params.ids || params.ids.length === 0) return 0;
    const placeholders = params.ids.map(() => '?').join(',');
    const res = db
      .prepare(`UPDATE outcome_spool SET synced = 1 WHERE project = ? AND id IN (${placeholders})`)
      .run(params.project, ...params.ids);
    return res.changes;
  }

  static clearSynced(
    db: Database.Database,
    params: {
      project: string;
    }
  ): number {
    this.ensureTable(db);
    const res = db.prepare('DELETE FROM outcome_spool WHERE project = ? AND synced = 1').run(params.project);
    return res.changes;
  }
}
