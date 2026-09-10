import Database from 'better-sqlite3';
import { ExecutionMetrics } from '../schema/types.js';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse, safeJsonStringify } from '../utils/json-validator.js';

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

    db.prepare(
      `
      INSERT INTO execution_metrics (
        id, project, execution_id, session_id, intention_id, behavior_name,
        status, tick_count, duration_ms, avg_tick_ms, max_tick_ms, stuck_count,
        interrupt_count, category_metrics_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
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

  static getMetrics(
    db: Database.Database,
    params: { project: string; execution_id?: string; behavior_name?: string; limit?: number }
  ): ExecutionMetrics[] {
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
