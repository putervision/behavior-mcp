import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

export const ProjectConfigSchema = z
  .object({
    projectName: z.string().optional(),
    defaultBranch: z.string().optional(),
    storagePath: z.string().optional(),
    allowedExportDirs: z.array(z.string()).optional(),
    busyTimeoutMs: z.number().int().positive().optional(),
    mmapSizeBytes: z.number().int().positive().optional(),
    tickRateHz: z.number().int().positive().optional(),
    stuckThreshold: z.number().int().positive().optional(),
    maxActionsPerSec: z.number().int().positive().optional(),
    allowlistOrigins: z.array(z.string()).optional(),
    accessMode: z.enum(['normal', 'read_only']).optional(),
  })
  .passthrough();

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

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
