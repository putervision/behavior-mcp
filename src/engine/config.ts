import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger.js';

export interface ProjectConfig {
  projectName?: string;
  defaultBranch?: string;
  storagePath?: string;
  allowedExportDirs?: string[];
  busyTimeoutMs?: number;
  mmapSizeBytes?: number;
  tickRateHz?: number;
  stuckThreshold?: number;
  maxActionsPerSec?: number;
  allowlistOrigins?: string[];
  accessMode?: 'normal' | 'read_only';
  [key: string]: any;
}

export const ProjectConfigSchema = {
  safeParse(
    val: unknown
  ): { success: true; data: ProjectConfig } | { success: false; error: { message: string } } {
    if (!val || typeof val !== 'object' || Array.isArray(val)) {
      return { success: false, error: { message: 'Expected object' } };
    }
    return { success: true, data: val as ProjectConfig };
  },
};

const cachedConfigs = new Map<string, { config: ProjectConfig; timestamp: number }>();
const CONFIG_TTL_MS = 2000;

export function loadProjectConfig(projectRoot: string): ProjectConfig {
  const now = Date.now();
  const cached = cachedConfigs.get(projectRoot);
  if (cached && now - cached.timestamp < CONFIG_TTL_MS) {
    return cached.config;
  }

  const effectiveRoot = process.env.PUTERVISION_PROJECT_DIR || projectRoot;
  const configPath = path.join(effectiveRoot, '.behavior-mcp.json');
  const legacyConfigPath = path.join(effectiveRoot, '.behavior-runtime-mcp.json');
  let config: ProjectConfig = {};

  const activePath = fs.existsSync(configPath)
    ? configPath
    : fs.existsSync(legacyConfigPath)
      ? legacyConfigPath
      : null;

  if (activePath) {
    try {
      const raw = fs.readFileSync(activePath, 'utf-8');
      const parsed = JSON.parse(raw);
      const validated = ProjectConfigSchema.safeParse(parsed);
      if (validated.success) {
        config = validated.data;
      } else {
        logger.warn(`Invalid ${path.basename(activePath)} schema: ${validated.error.message}`);
        config = parsed;
      }
    } catch (err: any) {
      logger.warn(`Failed to parse ${path.basename(activePath)}: ${err.message}`);
    }
  }

  if (process.env.PUTERVISION_PROJECT_SLUG && !config.projectName) {
    config.projectName = process.env.PUTERVISION_PROJECT_SLUG;
  }

  cachedConfigs.set(projectRoot, { config, timestamp: now });
  return config;
}

export function getPentadHmacSecret(projectRoot = process.cwd()): string | undefined {
  if (process.env.PENTAD_HMAC_SECRET) {
    return process.env.PENTAD_HMAC_SECRET;
  }
  const config = loadProjectConfig(projectRoot);
  return config.pentadHmacSecret || config.hmacSecret;
}

