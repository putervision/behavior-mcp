import Database from 'better-sqlite3';
import { ExecutionMetrics, ExecutionRecording, RecordingId } from '../schema/types.js';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse, safeJsonStringify } from '../utils/json-validator.js';
import { NotFoundError } from '../utils/errors.js';

export class MetricsEngine {
  static recordMetrics(
    db: Database.Database,
    params: {
      project: string;
      execution_id: string;
      session_id?: string;
      intention_id?: string;
      behavior_name: string;
      status: any;
      tick_count: number;
      duration_ms: number;
      avg_tick_ms?: number;
      max_tick_ms?: number;
      stuck_count?: number;
      interrupt_count?: number;
      category_metrics?: Record<string, unknown>;
    }
  ): ExecutionMetrics {
    const id = generateId();
    const now = getCurrentIsoString();

    db.prepare(`
      INSERT INTO execution_metrics (
        id, project, execution_id, session_id, intention_id, behavior_name,
        status, tick_count, duration_ms, avg_tick_ms, max_tick_ms, stuck_count,
        interrupt_count, category_metrics_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.project,
      params.execution_id,
      params.session_id ?? null,
      params.intention_id ?? null,
      params.behavior_name,
      params.status,
      params.tick_count,
      params.duration_ms,
      params.avg_tick_ms ?? 16.6,
      params.max_tick_ms ?? 25.0,
      params.stuck_count ?? 0,
      params.interrupt_count ?? 0,
      safeJsonStringify(params.category_metrics || {}),
      now
    );

    return {
      id,
      project: params.project,
      execution_id: params.execution_id as any,
      session_id: params.session_id,
      intention_id: params.intention_id,
      behavior_name: params.behavior_name,
      status: params.status,
      tick_count: params.tick_count,
      duration_ms: params.duration_ms,
      avg_tick_ms: params.avg_tick_ms ?? 16.6,
      max_tick_ms: params.max_tick_ms ?? 25.0,
      stuck_count: params.stuck_count ?? 0,
      interrupt_count: params.interrupt_count ?? 0,
      category_metrics: params.category_metrics,
      created_at: now,
    };
  }

  static getMetrics(db: Database.Database, params: { project: string; execution_id?: string; behavior_name?: string; limit?: number }): ExecutionMetrics[] {
    let sql = 'SELECT * FROM execution_metrics WHERE project = ?';
    const sqlParams: any[] = [params.project];

    if (params.execution_id) {
      sql += ' AND execution_id = ?';
      sqlParams.push(params.execution_id);
    }
    if (params.behavior_name) {
      sql += ' AND behavior_name = ?';
      sqlParams.push(params.behavior_name);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    sqlParams.push(params.limit || 50);

    const rows = db.prepare(sql).all(...sqlParams) as any[];
    return rows.map((r) => ({
      id: r.id,
      project: r.project,
      execution_id: r.execution_id,
      session_id: r.session_id,
      intention_id: r.intention_id,
      behavior_name: r.behavior_name,
      status: r.status,
      tick_count: r.tick_count,
      duration_ms: r.duration_ms,
      avg_tick_ms: r.avg_tick_ms,
      max_tick_ms: r.max_tick_ms,
      stuck_count: r.stuck_count,
      interrupt_count: r.interrupt_count,
      category_metrics: safeJsonParse(r.category_metrics_json, undefined),
      created_at: r.created_at,
    }));
  }
}

export class RecordingEngine {
  static saveRecording(
    db: Database.Database,
    params: {
      project: string;
      execution_id: string;
      behavior_name: string;
      frames: any[];
      duration_ms?: number;
    }
  ): ExecutionRecording {
    const id = generateId() as RecordingId;
    const now = getCurrentIsoString();
    const durationMs = params.duration_ms || Math.round(params.frames.length * 16.6);

    db.prepare(`
      INSERT INTO recordings (id, project, execution_id, behavior_name, total_frames, frames_json, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.project, params.execution_id, params.behavior_name, params.frames.length, safeJsonStringify(params.frames), durationMs, now);

    return {
      id,
      project: params.project,
      execution_id: params.execution_id as any,
      behavior_name: params.behavior_name,
      total_frames: params.frames.length,
      frames_json: safeJsonStringify(params.frames),
      duration_ms: durationMs,
      created_at: now,
    };
  }

  static listRecordings(db: Database.Database, project: string): ExecutionRecording[] {
    const rows = db.prepare('SELECT * FROM recordings WHERE project = ? ORDER BY created_at DESC LIMIT 50').all(project) as any[];
    return rows.map((r) => ({
      id: r.id as RecordingId,
      project: r.project,
      execution_id: r.execution_id,
      behavior_name: r.behavior_name,
      total_frames: r.total_frames,
      frames_json: r.frames_json,
      duration_ms: r.duration_ms,
      created_at: r.created_at,
    }));
  }
}

export class BlackboardEngine {
  static getBlackboard(db: Database.Database, params: { project: string; execution_id: string }): Record<string, unknown> {
    const row = db.prepare('SELECT blackboard_json FROM execution_state WHERE project = ? AND id = ?').get(params.project, params.execution_id) as any;
    if (!row) throw new NotFoundError(`Execution state "${params.execution_id}" not found.`);
    return safeJsonParse(row.blackboard_json, {});
  }

  static setBlackboardKey(db: Database.Database, params: { project: string; execution_id: string; key: string; value: unknown }): Record<string, unknown> {
    const bb = this.getBlackboard(db, params);
    bb[params.key] = params.value;
    db.prepare('UPDATE execution_state SET blackboard_json = ?, updated_at = ? WHERE id = ?').run(safeJsonStringify(bb), getCurrentIsoString(), params.execution_id);
    return bb;
  }
}
