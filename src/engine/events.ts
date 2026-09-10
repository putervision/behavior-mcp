import crypto from 'crypto';
import Database from 'better-sqlite3';
import { RuntimeEvent, EventId } from '../schema/types.js';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonParse } from '../utils/json-validator.js';

export function computeEventHash(params: {
  prev_hash: string;
  id: string;
  project: string;
  entity_id: string;
  entity_type: string;
  action: string;
  timestamp: string;
  details?: Record<string, unknown>;
}): string {
  const data = [
    params.prev_hash,
    params.id,
    params.project,
    params.entity_id,
    params.entity_type,
    params.action,
    params.timestamp,
    JSON.stringify(params.details || {}),
  ].join('|');
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function logRuntimeEvent(
  db: Database.Database,
  params: {
    project: string;
    entity_id: string;
    entity_type: 'behavior' | 'execution' | 'trigger' | 'recording' | 'safety';
    action: string;
    details?: Record<string, unknown>;
  }
): RuntimeEvent {
  const lastRow = db
    .prepare('SELECT hash FROM events WHERE project = ? ORDER BY rowid DESC LIMIT 1')
    .get(params.project) as { hash?: string } | undefined;
  const prevHash = lastRow?.hash || '0'.repeat(64);

  const eventId = generateId() as EventId;
  const timestamp = getCurrentIsoString();
  const hash = computeEventHash({
    prev_hash: prevHash,
    id: eventId,
    project: params.project,
    entity_id: params.entity_id,
    entity_type: params.entity_type,
    action: params.action,
    timestamp,
    details: params.details,
  });

  db.prepare(
    `
    INSERT INTO events (id, project, entity_id, entity_type, action, prev_hash, hash, details_json, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(
    eventId,
    params.project,
    params.entity_id,
    params.entity_type,
    params.action,
    prevHash,
    hash,
    JSON.stringify(params.details || {}),
    timestamp
  );

  return {
    id: eventId,
    project: params.project,
    entity_id: params.entity_id,
    entity_type: params.entity_type,
    action: params.action,
    prev_hash: prevHash,
    hash,
    details: params.details,
    timestamp,
  };
}

export function verifyEventChain(
  db: Database.Database,
  project: string
): { valid: boolean; total_events: number; corrupted_event_id?: string; error?: string } {
  const rows = db
    .prepare('SELECT * FROM events WHERE project = ? ORDER BY rowid ASC')
    .all(project) as any[];

  if (rows.length === 0) {
    return { valid: true, total_events: 0 };
  }

  let expectedPrevHash = '0'.repeat(64);
  for (const row of rows) {
    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        total_events: rows.length,
        corrupted_event_id: row.id,
        error: `Prev hash mismatch at event ${row.id}: expected ${expectedPrevHash}, found ${row.prev_hash}`,
      };
    }

    const calculatedHash = computeEventHash({
      prev_hash: row.prev_hash,
      id: row.id,
      project: row.project,
      entity_id: row.entity_id,
      entity_type: row.entity_type,
      action: row.action,
      timestamp: row.timestamp,
      details: safeJsonParse(row.details_json, {}),
    });

    if (calculatedHash !== row.hash) {
      return {
        valid: false,
        total_events: rows.length,
        corrupted_event_id: row.id,
        error: `Data tamper detected at event ${row.id}: hash mismatch`,
      };
    }

    expectedPrevHash = row.hash;
  }

  return { valid: true, total_events: rows.length };
}
