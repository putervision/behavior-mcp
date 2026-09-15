import Database from 'better-sqlite3';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse, safeJsonStringify } from '../utils/json-validator.js';
import { NotFoundError } from '../utils/errors.js';

export class BlackboardEngine {
  static getBlackboard(
    db: Database.Database,
    params: { project: string; execution_id: string }
  ): Record<string, unknown> {
    const row = db
      .prepare('SELECT blackboard_json FROM execution_state WHERE project = ? AND id = ?')
      .get(params.project, params.execution_id) as any;
    if (!row) throw new NotFoundError(`Execution state "${params.execution_id}" not found.`);
    return safeJsonParse(row.blackboard_json, {});
  }

  static setBlackboardKey(
    db: Database.Database,
    params: { project: string; execution_id: string; key: string; value: unknown }
  ): Record<string, unknown> {
    const bb = this.getBlackboard(db, params);
    bb[params.key] = params.value;
    db.prepare('UPDATE execution_state SET blackboard_json = ?, updated_at = ? WHERE id = ?').run(
      safeJsonStringify(bb),
      getCurrentIsoString(),
      params.execution_id
    );
    return bb;
  }

  static deleteBlackboardKey(
    db: Database.Database,
    params: { project: string; execution_id: string; key: string }
  ): { success: boolean; key: string; remaining_keys: string[] } {
    const bb = this.getBlackboard(db, params);
    const existed = params.key in bb;
    delete bb[params.key];
    if (existed) {
      db.prepare('UPDATE execution_state SET blackboard_json = ?, updated_at = ? WHERE id = ?').run(
        safeJsonStringify(bb),
        getCurrentIsoString(),
        params.execution_id
      );
    }
    return { success: existed, key: params.key, remaining_keys: Object.keys(bb) };
  }

  static listBlackboard(
    db: Database.Database,
    params: { project: string; execution_id: string }
  ): { keys: string[]; count: number; entries: { key: string; type: string }[] } {
    const bb = this.getBlackboard(db, params);
    const keys = Object.keys(bb).filter((k) => k !== '_locks');
    const entries = keys.map((k) => ({
      key: k,
      type: Array.isArray(bb[k]) ? 'array' : typeof bb[k],
    }));
    return { keys, count: keys.length, entries };
  }

  static leaseBlackboard(
    db: Database.Database,
    params: {
      project: string;
      execution_id: string;
      key: string;
      agent_id: string;
      duration_seconds?: number;
      mode?: 'acquire' | 'release';
    }
  ): { success: boolean; message: string; expires_at?: string } {
    const bb = this.getBlackboard(db, params);
    const locks = (bb._locks as Record<string, { agent_id: string; expires_at: string }>) || {};
    const mode = params.mode || 'acquire';
    const now = getCurrentIsoString();

    if (mode === 'release') {
      const activeLock = locks[params.key];
      if (activeLock && activeLock.agent_id === params.agent_id) {
        delete locks[params.key];
        bb._locks = locks;
        db.prepare(
          'UPDATE execution_state SET blackboard_json = ?, updated_at = ? WHERE id = ?'
        ).run(safeJsonStringify(bb), now, params.execution_id);
        return {
          success: true,
          message: `Lock on key "${params.key}" released by agent "${params.agent_id}".`,
        };
      }
      return {
        success: false,
        message: `No active lock on key "${params.key}" held by agent "${params.agent_id}".`,
      };
    }

    // Acquire
    const activeLock = locks[params.key];
    if (activeLock && activeLock.agent_id !== params.agent_id && activeLock.expires_at > now) {
      return {
        success: false,
        message: `Key "${params.key}" is currently leased by agent "${activeLock.agent_id}" until ${activeLock.expires_at}.`,
        expires_at: activeLock.expires_at,
      };
    }

    const duration = params.duration_seconds || 60;
    const expiresAt = new Date(Date.now() + duration * 1000).toISOString();
    locks[params.key] = { agent_id: params.agent_id, expires_at: expiresAt };
    bb._locks = locks;

    db.prepare('UPDATE execution_state SET blackboard_json = ?, updated_at = ? WHERE id = ?').run(
      safeJsonStringify(bb),
      now,
      params.execution_id
    );

    return {
      success: true,
      message: `Key "${params.key}" successfully leased by agent "${params.agent_id}" for ${duration}s.`,
      expires_at: expiresAt,
    };
  }
}
