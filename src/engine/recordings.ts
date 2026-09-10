import Database from 'better-sqlite3';
import { ExecutionRecording, RecordingId } from '../schema/types.js';
import { generateId } from '../utils/id.js';
import { getCurrentIsoString } from '../utils/time.js';
import { safeJsonStringify } from '../utils/json-validator.js';

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

    db.prepare(
      `
      INSERT INTO recordings (id, project, execution_id, behavior_name, total_frames, frames_json, duration_ms, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      params.project,
      params.execution_id,
      params.behavior_name,
      params.frames.length,
      safeJsonStringify(params.frames),
      durationMs,
      now
    );

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
    const rows = db
      .prepare('SELECT * FROM recordings WHERE project = ? ORDER BY created_at DESC LIMIT 50')
      .all(project) as any[];
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
