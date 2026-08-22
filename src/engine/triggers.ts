import Database from 'better-sqlite3';
import { ReactiveTrigger, TriggerId } from '../schema/types.js';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse, safeJsonStringify } from '../utils/json-validator.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { logRuntimeEvent } from './events.js';

export class TriggerRegistry {
  static registerTrigger(
    db: Database.Database,
    params: {
      project: string;
      name: string;
      behavior_name: string;
      condition_type: string;
      condition_params: Record<string, unknown>;
      priority?: number;
      cooldown_ms?: number;
    }
  ): ReactiveTrigger {
    if (!params.name || !params.behavior_name || !params.condition_type) {
      throw new ValidationError('Trigger name, behavior_name, and condition_type are required.');
    }

    const id = generateId() as TriggerId;
    const now = getCurrentIsoString();
    const priority = params.priority !== undefined ? params.priority : 0.5;
    const cooldown_ms = params.cooldown_ms !== undefined ? params.cooldown_ms : 1000;

    db.prepare(`
      INSERT INTO triggers (
        id, project, name, behavior_name, condition_type, condition_params_json,
        priority, cooldown_ms, is_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(project, name) DO UPDATE SET
        behavior_name = excluded.behavior_name,
        condition_type = excluded.condition_type,
        condition_params_json = excluded.condition_params_json,
        priority = excluded.priority,
        cooldown_ms = excluded.cooldown_ms,
        updated_at = excluded.updated_at
    `).run(id, params.project, params.name, params.behavior_name, params.condition_type, safeJsonStringify(params.condition_params || {}), priority, cooldown_ms, now, now);

    logRuntimeEvent(db, {
      project: params.project,
      entity_id: id,
      entity_type: 'trigger',
      action: 'register',
      details: { name: params.name, behavior_name: params.behavior_name, priority },
    });

    return {
      id,
      project: params.project,
      name: params.name,
      behavior_name: params.behavior_name,
      condition_type: params.condition_type,
      condition_params: params.condition_params || {},
      priority,
      cooldown_ms,
      is_enabled: true,
      created_at: now,
      updated_at: now,
    };
  }

  static listTriggers(db: Database.Database, project: string): ReactiveTrigger[] {
    const rows = db.prepare('SELECT * FROM triggers WHERE project = ? ORDER BY priority DESC, name ASC').all(project) as any[];
    return rows.map((r) => this.mapRowToTrigger(r));
  }

  static evaluateTriggers(
    db: Database.Database,
    params: { project: string; telemetry: Record<string, any> }
  ): ReactiveTrigger | null {
    const triggers = this.listTriggers(db, params.project).filter((t) => t.is_enabled);
    const now = Date.now();

    for (const trig of triggers) {
      if (trig.last_fired_at && now - new Date(trig.last_fired_at).getTime() < trig.cooldown_ms) {
        continue; // In cooldown
      }

      let matches = false;
      if (trig.condition_type === 'hp_threshold') {
        const hp = params.telemetry.hp ?? 100;
        const threshold = (trig.condition_params.threshold as number) ?? 30;
        matches = hp <= threshold;
      } else if (trig.condition_type === 'enemy_proximity') {
        const enemyDist = params.telemetry.enemy_distance ?? 999;
        const radius = (trig.condition_params.radius as number) ?? 10;
        matches = enemyDist <= radius;
      }

      if (matches) {
        db.prepare('UPDATE triggers SET last_fired_at = ?, updated_at = ? WHERE id = ?').run(new Date(now).toISOString(), new Date(now).toISOString(), trig.id);
        return trig;
      }
    }
    return null;
  }

  private static mapRowToTrigger(row: any): ReactiveTrigger {
    return {
      id: row.id as TriggerId,
      project: row.project,
      name: row.name,
      behavior_name: row.behavior_name,
      condition_type: row.condition_type,
      condition_params: safeJsonParse(row.condition_params_json, {}),
      priority: row.priority,
      cooldown_ms: row.cooldown_ms,
      last_fired_at: row.last_fired_at,
      is_enabled: row.is_enabled === 1,
      metadata: safeJsonParse(row.metadata_json, undefined),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
