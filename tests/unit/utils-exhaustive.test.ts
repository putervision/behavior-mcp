import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { logger, getLogLevel, LOG_LEVELS } from '../../src/utils/logger.js';
import {
  BehaviorRuntimeError,
  DatabaseError,
  ValidationError,
  NotFoundError,
  ExecutionError,
  SafetyError,
} from '../../src/utils/errors.js';
import { getCurrentBranch } from '../../src/utils/git.js';
import {
  validatePath,
  getDefaultAllowedDirs,
  loadPathConfig,
} from '../../src/utils/path-validator.js';
import { redactText, redactData } from '../../src/utils/redact.js';
import { getCurrentIsoString, parseIsoString, getElapsedTimeMs } from '../../src/utils/time.js';
import { getVersion } from '../../src/utils/version.js';
import { safeJsonParse, safeJsonStringify } from '../../src/utils/json-validator.js';

describe('behavior-mcp Comprehensive Utils Suite', () => {
  describe('Errors Module', () => {
    it('should instantiate all error types with proper inheritance and defaults', () => {
      const baseErr = new BehaviorRuntimeError('base error');
      expect(baseErr.name).toBe('BehaviorRuntimeError');
      expect(baseErr.code).toBe('INTERNAL_ERROR');
      expect(baseErr instanceof Error).toBe(true);

      const dbErr = new DatabaseError('db failed', { query: 'SELECT 1' });
      expect(dbErr.name).toBe('DatabaseError');
      expect(dbErr.code).toBe('DATABASE_ERROR');
      expect(dbErr.details).toEqual({ query: 'SELECT 1' });

      const valErr = new ValidationError('invalid schema');
      expect(valErr.name).toBe('ValidationError');
      expect(valErr.code).toBe('VALIDATION_ERROR');

      const notFoundErr = new NotFoundError('item not found');
      expect(notFoundErr.name).toBe('NotFoundError');
      expect(notFoundErr.code).toBe('NOT_FOUND_ERROR');

      const execErr = new ExecutionError('tick loop crashed');
      expect(execErr.name).toBe('ExecutionError');
      expect(execErr.code).toBe('EXECUTION_ERROR');

      const safeErr = new SafetyError('policy gate denied action');
      expect(safeErr.name).toBe('SafetyError');
      expect(safeErr.code).toBe('SAFETY_ERROR');
    });
  });

  describe('Logger Module', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    it('should resolve log levels from BEHAVIOR_LOG_LEVEL or fallback', () => {
      process.env.BEHAVIOR_LOG_LEVEL = 'debug';
      expect(getLogLevel()).toBe(LOG_LEVELS.debug);

      process.env.BEHAVIOR_LOG_LEVEL = 'warn';
      expect(getLogLevel()).toBe(LOG_LEVELS.warn);

      delete process.env.BEHAVIOR_LOG_LEVEL;
      process.env.BEHAVIOR_RUNTIME_MCP_LOG_LEVEL = 'error';
      expect(getLogLevel()).toBe(LOG_LEVELS.error);

      delete process.env.BEHAVIOR_RUNTIME_MCP_LOG_LEVEL;
      expect(getLogLevel()).toBe(LOG_LEVELS.info);
    });

    it('should log messages via console.error for all log levels', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      process.env.BEHAVIOR_LOG_LEVEL = 'debug';

      logger.debug('debug message', { key: 'val' });
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleSpy).toHaveBeenCalledTimes(4);
    });
  });

  describe('Git Utils Module', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should detect current branch from ref: refs/heads/ in .git/HEAD', () => {
      const gitDir = path.join(tmpDir, '.git');
      fs.mkdirSync(gitDir, { recursive: true });
      fs.writeFileSync(path.join(gitDir, 'HEAD'), 'ref: refs/heads/release-v1.0\n');

      const branch = getCurrentBranch(tmpDir);
      expect(branch).toBe('release-v1.0');
    });

    it('should handle detached HEAD SHA in .git/HEAD', () => {
      const gitDir = path.join(tmpDir, '.git');
      fs.mkdirSync(gitDir, { recursive: true });
      fs.writeFileSync(path.join(gitDir, 'HEAD'), '0123456789abcdef0123456789abcdef01234567\n');

      const branch = getCurrentBranch(tmpDir);
      expect(branch).toBe('HEAD');
    });

    it('should fallback to main when directory is not a git repository', () => {
      const branch = getCurrentBranch(tmpDir);
      expect(branch).toBe('main');
    });
  });

  describe('Path Validator Module', () => {
    it('should compute default allowed dirs', () => {
      const root = '/tmp/test-project';
      const allowed = getDefaultAllowedDirs(root);
      expect(allowed).toContain(path.resolve(root));
      expect(allowed.some((d) => d.includes('.behavior-mcp'))).toBe(true);
    });

    it('should validate allowed paths and reject directory traversal attacks', () => {
      const root = path.resolve('/tmp/test-project');
      const config = loadPathConfig(root);

      const validSub = path.join(root, 'sub', 'file.json');
      expect(validatePath(validSub, config)).toBe(validSub);

      expect(() => validatePath('/etc/passwd', config)).toThrow(ValidationError);
      expect(() => validatePath(path.join(root, '..', 'outside.txt'), config)).toThrow(
        ValidationError
      );
    });
  });

  describe('Redact Module', () => {
    it('should redact sensitive patterns in text', () => {
      const input =
        'My token is Bearer secret_token_12345 and email is test@domain.com with password=hunter2';
      const output = redactText(input);

      expect(output).toContain('[REDACTED]');
      expect(output).not.toContain('secret_token_12345');
      expect(output).not.toContain('test@domain.com');
      expect(output).not.toContain('hunter2');
    });

    it('should redact sensitive keys in nested objects', () => {
      const payload = {
        name: 'test',
        apiKey: 'sk-1234567890abcdef',
        secret: 'supersecret',
        nested: {
          authorization: 'Bearer token',
          safeValue: 42,
        },
      };

      const sanitized = redactData(payload);
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.secret).toBe('[REDACTED]');
      expect(sanitized.nested.authorization).toBe('[REDACTED]');
      expect(sanitized.nested.safeValue).toBe(42);
    });
  });

  describe('Time & Version & JSON Validator Modules', () => {
    it('should generate and parse ISO timestamps', () => {
      const iso = getCurrentIsoString();
      const parsed = parseIsoString(iso);
      expect(parsed).toBeInstanceOf(Date);
      expect(getElapsedTimeMs(new Date(Date.now() - 500).toISOString())).toBeGreaterThanOrEqual(
        400
      );
    });

    it('should retrieve package version or fallback', () => {
      const ver = getVersion();
      expect(typeof ver).toBe('string');
      expect(ver.length).toBeGreaterThan(0);
    });

    it('should safely parse and stringify JSON', () => {
      const valid = safeJsonParse('{"key":"value"}', {});
      expect(valid).toEqual({ key: 'value' });

      const fallback = safeJsonParse('invalid-json', { fallback: true });
      expect(fallback).toEqual({ fallback: true });

      const str = safeJsonStringify({ a: 1 });
      expect(str).toBe('{"a":1}');

      const circular: any = {};
      circular.self = circular;
      expect(safeJsonStringify(circular)).toBe('{}');
    });
  });
});
