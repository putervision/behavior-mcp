// src/utils/logger.ts
var LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};
function getLogLevel() {
  const envLevel = (process.env.BEHAVIOR_LOG_LEVEL || process.env.BEHAVIOR_RUNTIME_MCP_LOG_LEVEL)?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return LOG_LEVELS[envLevel];
  }
  return LOG_LEVELS.info;
}
var logger = {
  debug: (message, ...args) => {
    if (getLogLevel() <= LOG_LEVELS.debug) {
      console.error(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message, ...args) => {
    if (getLogLevel() <= LOG_LEVELS.info) {
      console.error(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message, ...args) => {
    if (getLogLevel() <= LOG_LEVELS.warn) {
      console.error(`[WARN] ${message}`, ...args);
    }
  },
  error: (message, ...args) => {
    if (getLogLevel() <= LOG_LEVELS.error) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }
};

// src/utils/errors.ts
var BehaviorRuntimeError = class extends Error {
  code;
  details;
  constructor(message, code = "INTERNAL_ERROR", details) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
var DatabaseError = class extends BehaviorRuntimeError {
  constructor(message, details) {
    super(message, "DATABASE_ERROR", details);
  }
};
var ValidationError = class extends BehaviorRuntimeError {
  constructor(message, details) {
    super(message, "VALIDATION_ERROR", details);
  }
};
var NotFoundError = class extends BehaviorRuntimeError {
  constructor(message, details) {
    super(message, "NOT_FOUND_ERROR", details);
  }
};
var ExecutionError = class extends BehaviorRuntimeError {
  constructor(message, details) {
    super(message, "EXECUTION_ERROR", details);
  }
};
var SafetyError = class extends BehaviorRuntimeError {
  constructor(message, details) {
    super(message, "SAFETY_ERROR", details);
  }
};

// src/engine/db.ts
import Database from "better-sqlite3";
import * as path3 from "path";
import * as fs2 from "fs";
import * as os2 from "os";

// src/engine/config.ts
import * as fs from "fs";
import * as path from "path";
var cachedConfigs = /* @__PURE__ */ new Map();
var CONFIG_TTL_MS = 2e3;
function loadProjectConfig(projectRoot) {
  const now = Date.now();
  const cached = cachedConfigs.get(projectRoot);
  if (cached && now - cached.timestamp < CONFIG_TTL_MS) {
    return cached.config;
  }
  const configPath = path.join(projectRoot, ".behavior-runtime-mcp.json");
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(raw);
    } catch (err) {
      logger.warn(`Failed to parse .behavior-runtime-mcp.json: ${err.message}`);
    }
  }
  cachedConfigs.set(projectRoot, { config, timestamp: now });
  return config;
}

// src/utils/path-validator.ts
import * as path2 from "path";
import * as os from "os";
function getDefaultAllowedDirs(projectRoot) {
  const resolvedRoot = path2.resolve(projectRoot);
  const homeBackups = path2.join(os.homedir(), ".behavior-runtime-mcp", "backups");
  return [resolvedRoot, homeBackups];
}
function loadPathConfig(projectRoot) {
  return {
    projectRoot: path2.resolve(projectRoot),
    allowedExportDirs: getDefaultAllowedDirs(projectRoot)
  };
}
function validatePath(filePath, config) {
  if (!filePath || typeof filePath !== "string") {
    throw new ValidationError("File path must be a non-empty string.");
  }
  let resolved;
  if (path2.isAbsolute(filePath)) {
    resolved = path2.resolve(filePath);
  } else {
    resolved = path2.resolve(config.projectRoot, filePath);
  }
  const allowed = (config.allowedExportDirs || [config.projectRoot]).map((d) => path2.resolve(d));
  const isAllowed = allowed.some((dir) => {
    return resolved === dir || resolved.startsWith(dir + path2.sep);
  });
  if (!isAllowed) {
    throw new ValidationError(
      `Access denied: path "${filePath}" resolves outside allowed directories.`
    );
  }
  return resolved;
}

// src/engine/migrations.ts
function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const currentVersionRow = db.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get();
  const currentVersion = currentVersionRow ? parseInt(currentVersionRow.value, 10) : 0;
  if (currentVersion < 1) {
    logger.info("Applying migration v1 for behavior-runtime-mcp...");
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

// src/engine/db.ts
function validatePath2(filePath, project) {
  const projectRoot = resolveProjectRoot(project);
  const pathConfig = loadPathConfig(projectRoot);
  return validatePath(filePath, pathConfig);
}
var DEFAULT_REGISTRY_PATH = path3.join(os2.homedir(), ".behavior-runtime-mcp", "projects.json");
function getRegistryPath() {
  return process.env.BEHAVIOR_REGISTRY_PATH || DEFAULT_REGISTRY_PATH;
}
var registryCache = null;
var REGISTRY_TTL_MS = 2e3;
function getRegistry() {
  const now = Date.now();
  if (registryCache && now - registryCache.timestamp < REGISTRY_TTL_MS) {
    return registryCache.registry;
  }
  const regPath = getRegistryPath();
  try {
    if (fs2.existsSync(regPath)) {
      const raw = fs2.readFileSync(regPath, "utf-8");
      const registry = JSON.parse(raw);
      registryCache = { registry, timestamp: now };
      return registry;
    }
  } catch (err) {
    logger.warn(`Failed to read registry: ${err.message}`);
  }
  return {};
}
function registerProject(projectName, projectRoot) {
  const regPath = getRegistryPath();
  const dir = path3.dirname(regPath);
  if (!fs2.existsSync(dir)) {
    fs2.mkdirSync(dir, { recursive: true });
  }
  const registry = getRegistry();
  const slug = sanitizeSlug(projectName);
  registry[slug] = path3.resolve(projectRoot);
  const tmpPath = `${regPath}.tmp.${Math.random().toString(36).substring(2, 8)}`;
  fs2.writeFileSync(tmpPath, JSON.stringify(registry, null, 2) + "\n", { mode: 384 });
  fs2.renameSync(tmpPath, regPath);
  registryCache = { registry, timestamp: Date.now() };
  logger.debug(`Registered project: ${slug} -> ${projectRoot}`);
}
function unregisterProject(projectName) {
  const regPath = getRegistryPath();
  const registry = getRegistry();
  const slug = sanitizeSlug(projectName);
  if (registry[slug]) {
    delete registry[slug];
    const tmpPath = `${regPath}.tmp.${Math.random().toString(36).substring(2, 8)}`;
    fs2.writeFileSync(tmpPath, JSON.stringify(registry, null, 2) + "\n", { mode: 384 });
    fs2.renameSync(tmpPath, regPath);
    registryCache = { registry, timestamp: Date.now() };
  }
}
function sanitizeSlug(str) {
  return str.trim().toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
}
function resolveProjectRoot(project, cwd = process.cwd()) {
  if (project) {
    const registry = getRegistry();
    const slug = sanitizeSlug(project);
    if (registry[slug] && fs2.existsSync(registry[slug])) {
      return registry[slug];
    }
    if (registry[project] && fs2.existsSync(registry[project])) {
      return registry[project];
    }
  }
  let curr = path3.resolve(cwd);
  const home = os2.homedir();
  while (curr !== path3.dirname(curr) && curr !== home) {
    if (fs2.existsSync(path3.join(curr, ".git")) || fs2.existsSync(path3.join(curr, ".behavior-runtime-mcp"))) {
      return curr;
    }
    curr = path3.dirname(curr);
  }
  return path3.resolve(cwd);
}
function getProjectSlug(project, cwd = process.cwd()) {
  if (project && project.trim().length > 0) {
    return sanitizeSlug(project);
  }
  const root = resolveProjectRoot(project, cwd);
  const config = loadProjectConfig(root);
  if (config.projectName) {
    return sanitizeSlug(config.projectName);
  }
  return sanitizeSlug(path3.basename(root));
}
function getBaseDir(projectRoot) {
  const config = loadProjectConfig(projectRoot);
  if (config.storagePath) {
    return path3.resolve(projectRoot, config.storagePath);
  }
  if (process.env.BEHAVIOR_MCP_DIR || process.env.BEHAVIOR_RUNTIME_MCP_DIR) {
    return path3.resolve(projectRoot, process.env.BEHAVIOR_MCP_DIR || process.env.BEHAVIOR_RUNTIME_MCP_DIR);
  }
  return path3.join(projectRoot, ".behavior-runtime-mcp");
}
function getProjectDbDir(project, cwd = process.cwd()) {
  const root = resolveProjectRoot(project, cwd);
  const slug = getProjectSlug(project, cwd);
  const baseDir = getBaseDir(root);
  return path3.join(baseDir, slug);
}
function getDbPath(project, cwd = process.cwd()) {
  const dbDir = getProjectDbDir(project, cwd);
  return path3.join(dbDir, "behavior.db");
}
var dbCache = /* @__PURE__ */ new Map();
var readOnlyDbCache = /* @__PURE__ */ new Map();
var MAX_CACHED_DBS = 5;
function getDb(project, cwd = process.cwd()) {
  const dbPath = getDbPath(project, cwd);
  if (dbCache.has(dbPath)) {
    return dbCache.get(dbPath);
  }
  const dbDir = path3.dirname(dbPath);
  if (!fs2.existsSync(dbDir)) {
    fs2.mkdirSync(dbDir, { recursive: true, mode: 448 });
  }
  const root = resolveProjectRoot(project, cwd);
  const config = loadProjectConfig(root);
  try {
    const db = new Database(dbPath, {
      timeout: config.busyTimeoutMs || 5e3
    });
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma(`busy_timeout = ${config.busyTimeoutMs || 5e3}`);
    db.pragma("foreign_keys = ON");
    db.pragma("cache_size = -20000");
    db.pragma(`mmap_size = ${config.mmapSizeBytes || 134217728}`);
    db.pragma("trusted_schema = OFF");
    runMigrations(db);
    if (dbCache.size >= MAX_CACHED_DBS) {
      const firstKey = dbCache.keys().next().value;
      if (firstKey) {
        try {
          dbCache.get(firstKey)?.close();
        } catch {
        }
        dbCache.delete(firstKey);
      }
    }
    dbCache.set(dbPath, db);
    return db;
  } catch (err) {
    throw new DatabaseError(`Failed to open behavior-runtime database at ${dbPath}: ${err.message}`);
  }
}
function getReadOnlyDb(project, cwd = process.cwd()) {
  const dbPath = getDbPath(project, cwd);
  if (readOnlyDbCache.has(dbPath)) {
    return readOnlyDbCache.get(dbPath);
  }
  if (!fs2.existsSync(dbPath)) {
    getDb(project, cwd);
  }
  const root = resolveProjectRoot(project, cwd);
  const config = loadProjectConfig(root);
  try {
    const db = new Database(dbPath, {
      readonly: true,
      timeout: config.busyTimeoutMs || 5e3
    });
    db.pragma("query_only = ON");
    db.pragma(`busy_timeout = ${config.busyTimeoutMs || 5e3}`);
    db.pragma("foreign_keys = ON");
    db.pragma("enable_load_extension = 0");
    db.pragma("cache_size = -20000");
    db.pragma(`mmap_size = ${config.mmapSizeBytes || 134217728}`);
    db.pragma("trusted_schema = OFF");
    if (readOnlyDbCache.size >= MAX_CACHED_DBS) {
      const firstKey = readOnlyDbCache.keys().next().value;
      if (firstKey) {
        try {
          readOnlyDbCache.get(firstKey)?.close();
        } catch {
        }
        readOnlyDbCache.delete(firstKey);
      }
    }
    readOnlyDbCache.set(dbPath, db);
    return db;
  } catch (err) {
    throw new DatabaseError(`Failed to open read-only behavior database at ${dbPath}: ${err.message}`);
  }
}
function closeDb(project, cwd = process.cwd()) {
  const dbPath = getDbPath(project, cwd);
  if (dbCache.has(dbPath)) {
    try {
      dbCache.get(dbPath)?.close();
    } catch {
    }
    dbCache.delete(dbPath);
  }
  if (readOnlyDbCache.has(dbPath)) {
    try {
      readOnlyDbCache.get(dbPath)?.close();
    } catch {
    }
    readOnlyDbCache.delete(dbPath);
  }
}
function closeAllDbs() {
  for (const [key, db] of dbCache.entries()) {
    try {
      db.close();
    } catch {
    }
  }
  dbCache.clear();
  for (const [key, db] of readOnlyDbCache.entries()) {
    try {
      db.close();
    } catch {
    }
  }
  readOnlyDbCache.clear();
}

// src/utils/id.ts
import * as crypto from "crypto";
var ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function generateId() {
  let now = Date.now();
  let timeStr = "";
  for (let i = 0; i < 10; i++) {
    const mod = now % 32;
    timeStr = ENCODING.charAt(mod) + timeStr;
    now = Math.floor(now / 32);
  }
  const randomBytes2 = crypto.randomBytes(16);
  let randomStr = "";
  for (let i = 0; i < 16; i++) {
    randomStr += ENCODING.charAt(randomBytes2[i] % 32);
  }
  return timeStr + randomStr;
}

// src/utils/time.ts
function getCurrentIsoString() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function parseIsoString(iso) {
  return new Date(iso);
}
function getElapsedTimeMs(startTimeIso) {
  return Date.now() - new Date(startTimeIso).getTime();
}

// src/engine/events.ts
import crypto2 from "crypto";

// src/utils/json-validator.ts
function safeJsonParse(str, fallback) {
  if (!str || typeof str !== "string") return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}
function safeJsonStringify(obj, fallback = "{}") {
  try {
    return JSON.stringify(obj);
  } catch {
    return fallback;
  }
}

// src/engine/events.ts
function computeEventHash(params) {
  const data = [
    params.prev_hash,
    params.id,
    params.project,
    params.entity_id,
    params.entity_type,
    params.action,
    params.timestamp,
    JSON.stringify(params.details || {})
  ].join("|");
  return crypto2.createHash("sha256").update(data).digest("hex");
}
function logRuntimeEvent(db, params) {
  const lastRow = db.prepare("SELECT hash FROM events WHERE project = ? ORDER BY rowid DESC LIMIT 1").get(params.project);
  const prevHash = lastRow?.hash || "0".repeat(64);
  const eventId = generateId();
  const timestamp = getCurrentIsoString();
  const hash = computeEventHash({
    prev_hash: prevHash,
    id: eventId,
    project: params.project,
    entity_id: params.entity_id,
    entity_type: params.entity_type,
    action: params.action,
    timestamp,
    details: params.details
  });
  db.prepare(`
    INSERT INTO events (id, project, entity_id, entity_type, action, prev_hash, hash, details_json, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
    timestamp
  };
}
function verifyEventChain(db, project) {
  const rows = db.prepare("SELECT * FROM events WHERE project = ? ORDER BY rowid ASC").all(project);
  if (rows.length === 0) {
    return { valid: true, total_events: 0 };
  }
  let expectedPrevHash = "0".repeat(64);
  for (const row of rows) {
    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        total_events: rows.length,
        corrupted_event_id: row.id,
        error: `Prev hash mismatch at event ${row.id}: expected ${expectedPrevHash}, found ${row.prev_hash}`
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
      details: safeJsonParse(row.details_json, {})
    });
    if (calculatedHash !== row.hash) {
      return {
        valid: false,
        total_events: rows.length,
        corrupted_event_id: row.id,
        error: `Data tamper detected at event ${row.id}: hash mismatch`
      };
    }
    expectedPrevHash = row.hash;
  }
  return { valid: true, total_events: rows.length };
}

// src/engine/behaviors.ts
import crypto3 from "crypto";
function computeTreeHash(treeJson) {
  return crypto3.createHash("sha256").update(treeJson.trim()).digest("hex");
}
var BehaviorRegistry = class {
  static registerBehavior(db, params) {
    if (!params.name) throw new ValidationError("Behavior name is required.");
    if (!params.tree) throw new ValidationError("Behavior tree definition is required.");
    if (params.client_request_id) {
      const existing = db.prepare("SELECT * FROM behavior_definitions WHERE project = ? AND client_request_id = ?").get(params.project, params.client_request_id);
      if (existing) {
        return this.mapRowToBehavior(existing);
      }
    }
    const treeJson = safeJsonStringify(params.tree);
    const treeHash = computeTreeHash(treeJson);
    const version = params.version || 1;
    const now = getCurrentIsoString();
    const id = generateId();
    db.prepare(`
      INSERT INTO behavior_definitions (
        id, project, name, version, description, tree_json, tree_hash,
        is_active, client_request_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(project, name, version) DO UPDATE SET
        description = excluded.description,
        tree_json = excluded.tree_json,
        tree_hash = excluded.tree_hash,
        created_at = excluded.created_at
    `).run(id, params.project, params.name, version, params.description ?? null, treeJson, treeHash, params.client_request_id ?? null, now);
    logRuntimeEvent(db, {
      project: params.project,
      entity_id: id,
      entity_type: "behavior",
      action: "register",
      details: { name: params.name, version, tree_hash: treeHash }
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
      created_at: now
    };
  }
  static getBehavior(db, params) {
    let sql = "SELECT * FROM behavior_definitions WHERE project = ? AND name = ?";
    const sqlParams = [params.project, params.name];
    if (params.version) {
      sql += " AND version = ?";
      sqlParams.push(params.version);
    } else {
      sql += " ORDER BY version DESC LIMIT 1";
    }
    const row = db.prepare(sql).get(...sqlParams);
    if (!row) throw new NotFoundError(`Behavior "${params.name}" (v${params.version || "latest"}) not found.`);
    return this.mapRowToBehavior(row);
  }
  static listBehaviors(db, project) {
    const rows = db.prepare("SELECT * FROM behavior_definitions WHERE project = ? ORDER BY name ASC, version DESC").all(project);
    return rows.map((r) => this.mapRowToBehavior(r));
  }
  static mapRowToBehavior(row) {
    return {
      id: row.id,
      project: row.project,
      name: row.name,
      version: row.version,
      description: row.description,
      tree_json: row.tree_json,
      tree_hash: row.tree_hash,
      is_active: row.is_active === 1,
      metadata: safeJsonParse(row.metadata_json, void 0),
      client_request_id: row.client_request_id,
      created_at: row.created_at
    };
  }
};

// src/engine/executor.ts
var ExecutionEngine = class {
  static startExecution(db, params) {
    const behavior = BehaviorRegistry.getBehavior(db, {
      project: params.project,
      name: params.behavior_name,
      version: params.behavior_version
    });
    const id = generateId();
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
      entity_type: "execution",
      action: "start",
      details: { behavior_name: behavior.name, intention_id: params.intention_id }
    });
    return {
      id,
      project: params.project,
      behavior_name: behavior.name,
      behavior_version: behavior.version,
      session_id: params.session_id,
      intention_id: params.intention_id,
      status: "running",
      active_node_path: "root",
      blackboard_json: safeJsonStringify(params.parameters || {}),
      current_tick: 0,
      tick_rate_hz: 60,
      duration_ms: 0,
      stuck_score: 0,
      created_at: now,
      updated_at: now
    };
  }
  static tickExecution(db, params) {
    const current = this.getExecution(db, { project: params.project, id: params.execution_id });
    const now = getCurrentIsoString();
    const newTick = current.current_tick + 1;
    const durationMs = Math.round(newTick * (1e3 / current.tick_rate_hz));
    const status = params.status || current.status;
    const nodePath = params.active_node_path || current.active_node_path;
    const stuckScore = params.stuck_score !== void 0 ? params.stuck_score : current.stuck_score;
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
      updated_at: now
    };
  }
  static stopExecution(db, params) {
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
      entity_type: "execution",
      action: "stop",
      details: { status: params.status, error: params.error_message }
    });
    return {
      intention_id: current.intention_id || "manual",
      execution_id: current.id,
      session_id: current.session_id || "default",
      status: params.status,
      active_node: current.active_node_path,
      tick_count: current.current_tick,
      duration_ms: current.duration_ms,
      error_message: params.error_message,
      completed_at: now
    };
  }
  static getExecution(db, params) {
    const row = db.prepare("SELECT * FROM execution_state WHERE project = ? AND id = ?").get(params.project, params.id);
    if (!row) throw new NotFoundError(`Execution instance "${params.id}" not found.`);
    return this.mapRowToExecution(row);
  }
  static listExecutions(db, params) {
    let sql = "SELECT * FROM execution_state WHERE project = ?";
    const sqlParams = [params.project];
    if (params.status) {
      sql += " AND status = ?";
      sqlParams.push(params.status);
    }
    sql += " ORDER BY created_at DESC LIMIT ?";
    sqlParams.push(params.limit || 50);
    const rows = db.prepare(sql).all(...sqlParams);
    return rows.map((r) => this.mapRowToExecution(r));
  }
  static mapRowToExecution(row) {
    return {
      id: row.id,
      project: row.project,
      behavior_name: row.behavior_name,
      behavior_version: row.behavior_version,
      session_id: row.session_id,
      intention_id: row.intention_id,
      status: row.status,
      active_node_path: row.active_node_path,
      blackboard_json: row.blackboard_json || "{}",
      current_tick: row.current_tick,
      tick_rate_hz: row.tick_rate_hz,
      duration_ms: row.duration_ms,
      stuck_score: row.stuck_score,
      error: row.error,
      metadata: safeJsonParse(row.metadata_json, void 0),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
};

// src/engine/triggers.ts
var TriggerRegistry = class {
  static registerTrigger(db, params) {
    if (!params.name || !params.behavior_name || !params.condition_type) {
      throw new ValidationError("Trigger name, behavior_name, and condition_type are required.");
    }
    const id = generateId();
    const now = getCurrentIsoString();
    const priority = params.priority !== void 0 ? params.priority : 0.5;
    const cooldown_ms = params.cooldown_ms !== void 0 ? params.cooldown_ms : 1e3;
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
      entity_type: "trigger",
      action: "register",
      details: { name: params.name, behavior_name: params.behavior_name, priority }
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
      updated_at: now
    };
  }
  static listTriggers(db, project) {
    const rows = db.prepare("SELECT * FROM triggers WHERE project = ? ORDER BY priority DESC, name ASC").all(project);
    return rows.map((r) => this.mapRowToTrigger(r));
  }
  static evaluateTriggers(db, params) {
    const triggers = this.listTriggers(db, params.project).filter((t) => t.is_enabled);
    const now = Date.now();
    for (const trig of triggers) {
      if (trig.last_fired_at && now - new Date(trig.last_fired_at).getTime() < trig.cooldown_ms) {
        continue;
      }
      let matches = false;
      if (trig.condition_type === "hp_threshold") {
        const hp = params.telemetry.hp ?? 100;
        const threshold = trig.condition_params.threshold ?? 30;
        matches = hp <= threshold;
      } else if (trig.condition_type === "enemy_proximity") {
        const enemyDist = params.telemetry.enemy_distance ?? 999;
        const radius = trig.condition_params.radius ?? 10;
        matches = enemyDist <= radius;
      }
      if (matches) {
        db.prepare("UPDATE triggers SET last_fired_at = ?, updated_at = ? WHERE id = ?").run(new Date(now).toISOString(), new Date(now).toISOString(), trig.id);
        return trig;
      }
    }
    return null;
  }
  static mapRowToTrigger(row) {
    return {
      id: row.id,
      project: row.project,
      name: row.name,
      behavior_name: row.behavior_name,
      condition_type: row.condition_type,
      condition_params: safeJsonParse(row.condition_params_json, {}),
      priority: row.priority,
      cooldown_ms: row.cooldown_ms,
      last_fired_at: row.last_fired_at,
      is_enabled: row.is_enabled === 1,
      metadata: safeJsonParse(row.metadata_json, void 0),
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
};

// src/utils/version.ts
function getVersion() {
  if (true) {
    return "0.1.0";
  }
  return "0.1.0";
}

export {
  LOG_LEVELS,
  getLogLevel,
  logger,
  BehaviorRuntimeError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ExecutionError,
  SafetyError,
  validatePath2 as validatePath,
  getRegistryPath,
  getRegistry,
  registerProject,
  unregisterProject,
  sanitizeSlug,
  resolveProjectRoot,
  getProjectSlug,
  getBaseDir,
  getProjectDbDir,
  getDbPath,
  getDb,
  getReadOnlyDb,
  closeDb,
  closeAllDbs,
  generateId,
  getCurrentIsoString,
  parseIsoString,
  getElapsedTimeMs,
  safeJsonParse,
  safeJsonStringify,
  computeEventHash,
  logRuntimeEvent,
  verifyEventChain,
  computeTreeHash,
  BehaviorRegistry,
  ExecutionEngine,
  TriggerRegistry,
  getVersion
};
//# sourceMappingURL=chunk-TV72ORDW.js.map