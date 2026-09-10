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
}
