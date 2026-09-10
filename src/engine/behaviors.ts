import crypto from 'crypto';
import Database from 'better-sqlite3';
import { BehaviorDefinition, BehaviorId } from '../schema/types.js';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse, safeJsonStringify } from '../utils/json-validator.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { logRuntimeEvent } from './events.js';

export function computeTreeHash(treeJson: string): string {
  return crypto.createHash('sha256').update(treeJson.trim()).digest('hex');
}

export class BehaviorRegistry {
  static registerBehavior(
    db: Database.Database,
    params: {
      project: string;
      name: string;
      version?: number;
      description?: string;
      tree: unknown;
      client_request_id?: string;
    }
  ): BehaviorDefinition {
    if (!params.name) throw new ValidationError('Behavior name is required.');
    if (!params.tree) throw new ValidationError('Behavior tree definition is required.');

    if (params.client_request_id) {
      const existing = db
        .prepare('SELECT * FROM behavior_definitions WHERE project = ? AND client_request_id = ?')
        .get(params.project, params.client_request_id) as any;
      if (existing) {
        return this.mapRowToBehavior(existing);
      }
    }

    const treeJson = safeJsonStringify(params.tree);
    const treeHash = computeTreeHash(treeJson);
    const version = params.version || 1;
    const now = getCurrentIsoString();
    const id = generateId() as BehaviorId;

    db.prepare(
      `
      INSERT INTO behavior_definitions (
        id, project, name, version, description, tree_json, tree_hash,
        is_active, client_request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(project, name, version) DO UPDATE SET
        description = excluded.description,
        tree_json = excluded.tree_json,
        tree_hash = excluded.tree_hash,
        created_at = excluded.created_at
    `
    ).run(
      id,
      params.project,
      params.name,
      version,
      params.description ?? null,
      treeJson,
      treeHash,
      params.client_request_id ?? null,
      now
    );

    logRuntimeEvent(db, {
      project: params.project,
      entity_id: id,
      entity_type: 'behavior',
      action: 'register',
      details: { name: params.name, version, tree_hash: treeHash },
    });

    return {
      id,
      project: params.project,
      name: params.name,
      version,
      description: params.description,
      tree_json: treeJson,
      tree_hash: treeHash,
      is_active: true,
      client_request_id: params.client_request_id,
      created_at: now,
    };
  }

  static getBehavior(
    db: Database.Database,
    params: { project: string; name: string; version?: number }
  ): BehaviorDefinition {
    let sql = 'SELECT * FROM behavior_definitions WHERE project = ? AND name = ?';
    const sqlParams: any[] = [params.project, params.name];

    if (params.version) {
      sql += ' AND version = ?';
      sqlParams.push(params.version);
    } else {
      sql += ' ORDER BY version DESC LIMIT 1';
    }

    const row = db.prepare(sql).get(...sqlParams) as any;
    if (!row)
      throw new NotFoundError(
        `Behavior "${params.name}" (v${params.version || 'latest'}) not found.`
      );
    return this.mapRowToBehavior(row);
  }

  static listBehaviors(db: Database.Database, project: string): BehaviorDefinition[] {
    const rows = db
      .prepare(
        'SELECT * FROM behavior_definitions WHERE project = ? ORDER BY name ASC, version DESC'
      )
      .all(project) as any[];
    return rows.map((r) => this.mapRowToBehavior(r));
  }

  private static mapRowToBehavior(row: any): BehaviorDefinition {
    return {
      id: row.id as BehaviorId,
      project: row.project,
      name: row.name,
      version: row.version,
      description: row.description,
      tree_json: row.tree_json,
      tree_hash: row.tree_hash,
      is_active: row.is_active === 1,
      metadata: safeJsonParse(row.metadata_json, undefined),
      client_request_id: row.client_request_id,
      created_at: row.created_at,
    };
  }
}
