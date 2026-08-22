import Database from 'better-sqlite3';
import { ExecutionState, ExecutionId, ExecutionStatus, Outcome } from '../schema/types.js';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse, safeJsonStringify } from '../utils/json-validator.js';
import { NotFoundError } from '../utils/errors.js';
import { BehaviorRegistry } from './behaviors.js';
import { logRuntimeEvent } from './events.js';

export class ExecutionEngine {
  static startExecution(
    db: Database.Database,
    params: {
      project: string;
      behavior_name: string;
      behavior_version?: number;
      session_id?: string;
      intention_id?: string;
      parameters?: Record<string, unknown>;
      client_request_id?: string;
    }
  ): ExecutionState {
    const behavior = BehaviorRegistry.getBehavior(db, {
      project: params.project,
      name: params.behavior_name,
      version: params.behavior_version,
    });

    const id = generateId() as ExecutionId;
    const now = getCurrentIsoString();

    db.prepare(`
      INSERT INTO execution_state (
        id, project, behavior_name, behavior_version, session_id, intention_id,
        status, active_node_path, blackboard_json, current_tick, tick_rate_hz,
        duration_ms, stuck_score, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'running', 'root', ?, 0, 60, 0, 0.0, ?, ?)
    `).run(
      id,
      params.project,
      behavior.name,
      behavior.version,
      params.session_id ?? null,
      params.intention_id ?? null,
      safeJsonStringify(params.parameters || {}),
      now,
      now
    );

    logRuntimeEvent(db, {
      project: params.project,
      entity_id: id,
      entity_type: 'execution',
      action: 'start',
      details: { behavior_name: behavior.name, intention_id: params.intention_id },
    });

    return {
      id,
      project: params.project,
      behavior_name: behavior.name,
      behavior_version: behavior.version,
      session_id: params.session_id,
      intention_id: params.intention_id,
      status: 'running',
      active_node_path: 'root',
      blackboard_json: safeJsonStringify(params.parameters || {}),
      current_tick: 0,
      tick_rate_hz: 60,
      duration_ms: 0,
      stuck_score: 0.0,
      created_at: now,
      updated_at: now,
    };
  }

  static tickExecution(
    db: Database.Database,
    params: {
      project: string;
      execution_id: string;
      active_node_path?: string;
      status?: ExecutionStatus;
      stuck_score?: number;
      blackboard?: Record<string, unknown>;
    }
  ): ExecutionState {
    const current = this.getExecution(db, { project: params.project, id: params.execution_id });
    const now = getCurrentIsoString();
    const newTick = current.current_tick + 1;
    const durationMs = Math.round(newTick * (1000 / current.tick_rate_hz));
    const status = params.status || current.status;
    const nodePath = params.active_node_path || current.active_node_path;
    const stuckScore = params.stuck_score !== undefined ? params.stuck_score : current.stuck_score;
    const bbJson = params.blackboard ? safeJsonStringify(params.blackboard) : current.blackboard_json;

    db.prepare(`
      UPDATE execution_state SET
        current_tick = ?, duration_ms = ?, status = ?, active_node_path = ?,
        stuck_score = ?, blackboard_json = ?, updated_at = ?
      WHERE id = ?
    `).run(newTick, durationMs, status, nodePath, stuckScore, bbJson, now, current.id);

    return {
      ...current,
      current_tick: newTick,
      duration_ms: durationMs,
      status,
      active_node_path: nodePath,
      stuck_score: stuckScore,
      blackboard_json: bbJson,
      updated_at: now,
    };
  }

  static stopExecution(
    db: Database.Database,
    params: {
      project: string;
      execution_id: string;
      status: ExecutionStatus;
      error_message?: string;
    }
  ): Outcome {
    const current = this.getExecution(db, { project: params.project, id: params.execution_id });
    const now = getCurrentIsoString();

    db.prepare(`
      UPDATE execution_state SET
        status = ?, error = ?, updated_at = ?
      WHERE id = ?
    `).run(params.status, params.error_message ?? null, now, current.id);

    logRuntimeEvent(db, {
      project: params.project,
      entity_id: current.id,
      entity_type: 'execution',
      action: 'stop',
      details: { status: params.status, error: params.error_message },
    });

    return {
      intention_id: current.intention_id || 'manual',
      execution_id: current.id,
      session_id: current.session_id || 'default',
      status: params.status,
      active_node: current.active_node_path,
      tick_count: current.current_tick,
      duration_ms: current.duration_ms,
      error_message: params.error_message,
      completed_at: now,
    };
  }

  static getExecution(db: Database.Database, params: { project: string; id: string }): ExecutionState {
    const row = db.prepare('SELECT * FROM execution_state WHERE project = ? AND id = ?').get(params.project, params.id) as any;
    if (!row) throw new NotFoundError(`Execution instance "${params.id}" not found.`);
    return this.mapRowToExecution(row);
  }

  static listExecutions(
    db: Database.Database,
    params: { project: string; status?: ExecutionStatus; limit?: number }
  ): ExecutionState[] {
    let sql = 'SELECT * FROM execution_state WHERE project = ?';
    const sqlParams: any[] = [params.project];

    if (params.status) {
      sql += ' AND status = ?';
      sqlParams.push(params.status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    sqlParams.push(params.limit || 50);

    const rows = db.prepare(sql).all(...sqlParams) as any[];
    return rows.map((r) => this.mapRowToExecution(r));
  }

  private static mapRowToExecution(row: any): ExecutionState {
    return {
      id: row.id as ExecutionId,
      project: row.project,
      behavior_name: row.behavior_name,
      behavior_version: row.behavior_version,
      session_id: row.session_id,
      intention_id: row.intention_id,
      status: row.status as ExecutionStatus,
      active_node_path: row.active_node_path,
      blackboard_json: row.blackboard_json || '{}',
      current_tick: row.current_tick,
      tick_rate_hz: row.tick_rate_hz,
      duration_ms: row.duration_ms,
      stuck_score: row.stuck_score,
      error: row.error,
      metadata: safeJsonParse(row.metadata_json, undefined),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
