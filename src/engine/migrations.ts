import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const currentVersionRow = db
    .prepare("SELECT value FROM schema_meta WHERE key = 'version'")
    .get() as { value: string } | undefined;
  const currentVersion = currentVersionRow ? parseInt(currentVersionRow.value, 10) : 0;

  if (currentVersion < 1) {
    logger.info('Applying migration v1 for behavior-mcp...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS behavior_definitions (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        name TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        description TEXT,
        tree_json TEXT NOT NULL,
        tree_hash TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT,
        client_request_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(project, name, version)
      );
      CREATE INDEX IF NOT EXISTS idx_behaviors_project ON behavior_definitions(project);
      CREATE INDEX IF NOT EXISTS idx_behaviors_name ON behavior_definitions(project, name);
      CREATE INDEX IF NOT EXISTS idx_behaviors_client_req ON behavior_definitions(project, client_request_id);

      CREATE TABLE IF NOT EXISTS execution_state (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        behavior_name TEXT NOT NULL,
        behavior_version INTEGER NOT NULL DEFAULT 1,
        session_id TEXT,
        intention_id TEXT,
        status TEXT NOT NULL DEFAULT 'idle',
        active_node_path TEXT,
        blackboard_json TEXT NOT NULL DEFAULT '{}',
        current_tick INTEGER NOT NULL DEFAULT 0,
        tick_rate_hz INTEGER NOT NULL DEFAULT 60,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        stuck_score REAL NOT NULL DEFAULT 0.0,
        error TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_execution_project ON execution_state(project);
      CREATE INDEX IF NOT EXISTS idx_execution_status ON execution_state(project, status);
      CREATE INDEX IF NOT EXISTS idx_execution_intention ON execution_state(intention_id);

      CREATE TABLE IF NOT EXISTS triggers (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        name TEXT NOT NULL,
        behavior_name TEXT NOT NULL,
        condition_type TEXT NOT NULL,
        condition_params_json TEXT NOT NULL,
        priority REAL NOT NULL DEFAULT 0.5,
        cooldown_ms INTEGER NOT NULL DEFAULT 1000,
        last_fired_at TEXT,
        is_enabled INTEGER NOT NULL DEFAULT 1,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(project, name)
      );
      CREATE INDEX IF NOT EXISTS idx_triggers_project ON triggers(project);
      CREATE INDEX IF NOT EXISTS idx_triggers_enabled ON triggers(project, is_enabled);

      CREATE TABLE IF NOT EXISTS execution_metrics (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        session_id TEXT,
        intention_id TEXT,
        behavior_name TEXT NOT NULL,
        status TEXT NOT NULL,
        tick_count INTEGER NOT NULL DEFAULT 0,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        avg_tick_ms REAL NOT NULL DEFAULT 0.0,
        max_tick_ms REAL NOT NULL DEFAULT 0.0,
        stuck_count INTEGER NOT NULL DEFAULT 0,
        interrupt_count INTEGER NOT NULL DEFAULT 0,
        category_metrics_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (execution_id) REFERENCES execution_state(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_metrics_project ON execution_metrics(project);
      CREATE INDEX IF NOT EXISTS idx_metrics_execution ON execution_metrics(execution_id);
      CREATE INDEX IF NOT EXISTS idx_metrics_behavior ON execution_metrics(project, behavior_name);

      CREATE TABLE IF NOT EXISTS recordings (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        behavior_name TEXT NOT NULL,
        total_frames INTEGER NOT NULL DEFAULT 0,
        frames_json TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        metadata_json TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (execution_id) REFERENCES execution_state(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_recordings_project ON recordings(project);
      CREATE INDEX IF NOT EXISTS idx_recordings_execution ON recordings(execution_id);

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        action TEXT NOT NULL,
        prev_hash TEXT NOT NULL,
        hash TEXT NOT NULL,
        details_json TEXT,
        timestamp TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_project ON events(project);
      CREATE INDEX IF NOT EXISTS idx_events_entity ON events(project, entity_id);
      CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

      CREATE TABLE IF NOT EXISTS snapshots (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(project, name)
      );
      CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project);

      INSERT INTO schema_meta (key, value) VALUES ('version', '1')
      ON CONFLICT(key) DO UPDATE SET value = '1';
    `);
  }
}
