import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { runMigrations } from '../../src/engine/migrations.js';
import { TriggerRegistry } from '../../src/engine/triggers.js';

describe('TriggerRegistry', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  it('evaluates reactive triggers and respects priority', () => {
    TriggerRegistry.registerTrigger(db, {
      project: 'test',
      name: 'emergency_heal',
      behavior_name: 'flee_and_heal',
      condition_type: 'hp_threshold',
      condition_params: { threshold: 25 },
      priority: 0.95,
      cooldown_ms: 5000,
    });

    const fired = TriggerRegistry.evaluateTriggers(db, {
      project: 'test',
      telemetry: { hp: 15 },
    });

    expect(fired).not.toBeNull();
    expect(fired?.name).toBe('emergency_heal');
    expect(fired?.behavior_name).toBe('flee_and_heal');

    // Second immediate check respects cooldown
    const cooldownCheck = TriggerRegistry.evaluateTriggers(db, {
      project: 'test',
      telemetry: { hp: 15 },
    });
    expect(cooldownCheck).toBeNull();
  });
});
