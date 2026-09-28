import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/engine/migrations.js';
import { registerAllTools } from '../../src/tools/handlers.js';
import {
  loadProjectConfig,
  getPentadHmacSecret,
  ProjectConfigSchema,
} from '../../src/engine/config.js';
import { TriggerRegistry, TriggerConditionRegistry } from '../../src/engine/triggers.js';
import { ConditionRegistry } from '../../src/engine/browser/conditions.js';
import { canonicalJsonStringify } from '../../src/utils/canonical-json.js';
import { getVersion } from '../../src/utils/version.js';
import { redactData } from '../../src/utils/redact.js';
import { validatePath } from '../../src/utils/path-validator.js';

describe('Behavior-MCP Engine & Handlers Coverage Boost', () => {
  it('covers config functions and schema validation', () => {
    expect(ProjectConfigSchema.safeParse('not an object').success).toBe(false);
    expect(ProjectConfigSchema.safeParse({ tickRateHz: 60 }).success).toBe(true);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'behav_cfg_'));
    const cfgFile = path.join(tmpDir, '.behavior-mcp.json');
    fs.writeFileSync(cfgFile, JSON.stringify({ tickRateHz: 30, pentadHmacSecret: 'file_secret' }));

    const cfg = loadProjectConfig(tmpDir);
    expect(cfg.tickRateHz).toBe(30);

    // Test PUTERVISION_PROJECT_SLUG
    process.env.PUTERVISION_PROJECT_SLUG = 'slug_behavior';
    const cfg2 = loadProjectConfig('/tmp/nonexistent_' + Date.now());
    expect(cfg2.projectName).toBe('slug_behavior');
    delete process.env.PUTERVISION_PROJECT_SLUG;

    // Test getPentadHmacSecret with env and with config
    process.env.PENTAD_HMAC_SECRET = 'env_secret';
    expect(getPentadHmacSecret(tmpDir)).toBe('env_secret');
    delete process.env.PENTAD_HMAC_SECRET;
    expect(getPentadHmacSecret(tmpDir)).toBe('file_secret');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('covers TriggerConditionRegistry and TriggerRegistry errors', () => {
    // hp_threshold
    expect(TriggerConditionRegistry.hp_threshold({ threshold: 20 }, { hp: 15 })).toBe(true);
    expect(TriggerConditionRegistry.hp_threshold({ threshold: 20 }, { hp: 50 })).toBe(false);

    // enemy_proximity
    expect(TriggerConditionRegistry.enemy_proximity({ radius: 5 }, { enemy_distance: 3 })).toBe(
      true
    );
    expect(TriggerConditionRegistry.enemy_proximity({ radius: 5 }, { enemy_distance: 10 })).toBe(
      false
    );

    // semantic
    expect(
      TriggerConditionRegistry.semantic({ key: 'see_gold', expected: true }, { see_gold: true })
    ).toBe(true);
    expect(
      TriggerConditionRegistry.semantic({ key: 'see_gold', expected: false }, { see_gold: true })
    ).toBe(false);

    const testDb = new Database(':memory:');
    runMigrations(testDb);

    expect(() =>
      TriggerRegistry.registerTrigger(testDb, {
        project: 'p',
        name: '',
        behavior_name: 'b',
        condition_type: 'semantic',
        condition_params: {},
      })
    ).toThrow('Trigger name, behavior_name, and condition_type are required');

    testDb.close();
  });

  it('covers browser condition registry semantic checks and expiry', () => {
    const ctx: any = {
      tick: 100,
      blackboard: {},
      telemetry: { target_distance: 5 },
    };

    // timer_elapsed & proximity_check
    expect(ConditionRegistry.timer_elapsed({ threshold_ticks: 50 }, ctx)).toBe(true);
    expect(ConditionRegistry.proximity_check({ radius: 10 }, ctx)).toBe(true);
    expect(ConditionRegistry.blackboard_check({ key: 'k', expected: 'val' }, ctx)).toBe(false);

    // semantic_check missing
    expect(ConditionRegistry.semantic_check({ key: 'door_open' }, ctx)).toBe(false);

    // semantic_check with object entry and timestamp expired
    ctx.blackboard['semantic_decision_door_open'] = { result: true, timestamp: Date.now() - 10000 };
    expect(ConditionRegistry.semantic_check({ key: 'door_open' }, ctx)).toBe(false);

    // semantic_check with object entry valid
    ctx.blackboard['semantic_decision_door_open'] = { result: true, timestamp: Date.now() };
    expect(ConditionRegistry.semantic_check({ key: 'door_open' }, ctx)).toBe(true);

    // semantic_check with primitive entry and separate timestamp
    ctx.blackboard['semantic_decision_light_on'] = true;
    ctx.blackboard['semantic_timestamp_light_on'] = Date.now() - 10000;
    expect(ConditionRegistry.semantic_check({ key: 'light_on', expected: true }, ctx)).toBe(false);

    ctx.blackboard['semantic_timestamp_light_on'] = Date.now();
    expect(ConditionRegistry.semantic_check({ key: 'light_on', expected: true }, ctx)).toBe(true);
  });

  it('covers utils (canonical-json, version, redactData, path-validator)', () => {
    expect(canonicalJsonStringify(undefined)).toBe('');
    expect(canonicalJsonStringify(null)).toBe('null');
    expect(canonicalJsonStringify(-0)).toBe('0');
    expect(canonicalJsonStringify([undefined, 1])).toBe('[null,1]');
    expect(canonicalJsonStringify({ a: undefined, b: 2 })).toBe('{"b":2}');
    expect(() => canonicalJsonStringify(Infinity)).toThrow('Invalid non-finite number');

    expect(getVersion()).toBe('0.3.1');
    (globalThis as any).__APP_VERSION__ = '1.0.9';
    expect(getVersion()).toBe('1.0.9');
    delete (globalThis as any).__APP_VERSION__;

    const redactedArr = redactData(['Bearer secrettoken', { myApiKey: 'sk-12345678901234567890' }]);
    expect(redactedArr[0]).toContain('[REDACTED]');

    expect(() => validatePath('', { projectRoot: '/tmp' })).toThrow(
      'File path must be a non-empty string'
    );
    expect(() => validatePath('/etc/shadow', { projectRoot: '/tmp' })).toThrow('Access denied');
    expect(validatePath('state.json', { projectRoot: '/tmp' })).toBe('/tmp/state.json');
  });

  it('covers manage_runtime_db actions and handler error advice', async () => {
    let dbHandler: Function = () => {};
    let abortHandler: Function = () => {};
    const mockServer = {
      tool: (name: string, desc: string, schema: any, fn: Function) => {
        if (name === 'manage_runtime_db') dbHandler = fn;
        if (name === 'abort_behavior') abortHandler = fn;
      },
    };
    registerAllTools(mockServer as any);

    // Test manage_runtime_db doctor
    const docRes = await dbHandler({ project: 'test_behav_p', action: 'doctor' });
    expect(docRes.isError).toBeUndefined();
    const docData = JSON.parse(docRes.content[0].text);
    expect(docData.status).toBe('healthy');

    // Test manage_runtime_db snapshot & diff & restore
    const snapRes = await dbHandler({
      project: 'test_behav_p',
      action: 'snapshot',
      name: 'snap_1',
    });
    expect(snapRes.isError).toBeUndefined();

    const diffRes = await dbHandler({ project: 'test_behav_p', action: 'diff' });
    expect(diffRes.isError).toBeUndefined();

    const restoreRes = await dbHandler({
      project: 'test_behav_p',
      action: 'restore',
      name: 'snap_1',
    });
    expect(restoreRes.isError).toBeUndefined();

    // Test invalid actions triggering error advice
    const badDbRes = await dbHandler({ project: 'test_behav_p', action: 'nonexistent_action' });
    expect(badDbRes.isError).toBe(true);

    const badAbortRes = await abortHandler({ project: 'test_behav_p', action: 'bad_action' });
    expect(badAbortRes.isError).toBe(true);
  });
});
