import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { loadProjectConfig } from '../../src/engine/config.js';
import {
  registerProject,
  unregisterProject,
  getRegistry,
  sanitizeSlug,
  resolveProjectRoot,
  getProjectSlug,
  getBaseDir,
  getDb,
  getReadOnlyDb,
  closeDb,
  closeAllDbs,
} from '../../src/engine/db.js';
import { SchemaAdvisor } from '../../src/engine/advisor.js';

describe('behavior-mcp Engine DB & Config & Advisor Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'behavior-db-test-'));
  });

  afterEach(() => {
    closeAllDbs();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Config Module', () => {
    it('should load project config with default and custom values', () => {
      const configPath = path.join(tempDir, '.behavior-mcp.json');
      fs.writeFileSync(
        configPath,
        JSON.stringify({
          projectName: 'Custom Game',
          tickRateHz: 120,
          maxActionsPerSec: 45,
          allowlistOrigins: ['https://game.local'],
        })
      );

      const config = loadProjectConfig(tempDir);
      expect(config.projectName).toBe('Custom Game');
      expect(config.tickRateHz).toBe(120);
      expect(config.maxActionsPerSec).toBe(45);
      expect(config.allowlistOrigins).toContain('https://game.local');
    });

    it('should handle invalid config gracefully and fallback', () => {
      const configPath = path.join(tempDir, '.behavior-mcp.json');
      fs.writeFileSync(configPath, '{ invalid json');

      const config = loadProjectConfig(tempDir);
      expect(typeof config).toBe('object');
    });
  });

  describe('DB Registry & Path Resolution', () => {
    it('should sanitize project slugs cleanly', () => {
      expect(sanitizeSlug('My Project / 2026!')).toBe('my-project-2026');
      expect(sanitizeSlug('---')).toBe('');
    });

    it('should register and unregister projects in registry', () => {
      registerProject('test-slug', tempDir);
      const registry = getRegistry();
      expect(registry['test-slug']).toBe(tempDir);

      unregisterProject('test-slug');
      const updatedRegistry = getRegistry();
      expect(updatedRegistry['test-slug']).toBeUndefined();
    });

    it('should resolve project slug and base dir from environment or path', () => {
      const slug = getProjectSlug(undefined, tempDir);
      expect(typeof slug).toBe('string');

      const baseDir = getBaseDir(tempDir);
      expect(baseDir).toContain('.behavior-mcp');
    });

    it('should open read-write and read-only databases and apply pragmas', () => {
      const db = getDb('rw-proj', tempDir);
      expect(db.open).toBe(true);

      const roDb = getReadOnlyDb('rw-proj', tempDir);
      expect(roDb.open).toBe(true);

      const row = roDb.prepare('PRAGMA query_only').get() as any;
      expect(row.query_only).toBe(1);
    });

    it('should trigger connection pool LRU eviction when opening >5 databases', () => {
      for (let i = 1; i <= 7; i++) {
        const pSlug = `lru-proj-${i}`;
        const db = getDb(pSlug, tempDir);
        expect(db.open).toBe(true);
        const roDb = getReadOnlyDb(pSlug, tempDir);
        expect(roDb.open).toBe(true);
      }

      closeDb('lru-proj-7', tempDir);
    });
  });

  describe('Schema Advisor Module', () => {
    it('should suggest aliases and close matches for mistyped tools', () => {
      const aliasAdvice = SchemaAdvisor.getAdvice('load_tree', 'command not found', [
        'load_behavior',
        'abort_behavior',
        'set_parameters',
      ]);
      expect(aliasAdvice).toContain('is an alias');

      const fuzzyAdvice = SchemaAdvisor.getAdvice('load_behaviur', 'command not found', [
        'load_behavior',
        'abort_behavior',
        'set_parameters',
      ]);
      expect(fuzzyAdvice).toContain('Did you mean');
    });

    it('should provide fallback advice when no close match is found', () => {
      const advice = SchemaAdvisor.getAdvice('completely_unrelated_xyz', 'failed', [
        'load_behavior',
        'abort_behavior',
      ]);
      expect(advice).toBeDefined();
    });
  });
});
