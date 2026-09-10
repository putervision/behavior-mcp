import { describe, it, expect } from 'vitest';
import { ActionRegistry } from '../../src/engine/browser/actions.js';
import { GameActionRegistry } from '../../src/engine/browser/actions-game.js';
import { ConditionRegistry } from '../../src/engine/browser/conditions.js';
import { GameConditionRegistry } from '../../src/engine/browser/conditions-game.js';
import { BrowserInjector } from '../../src/engine/browser/injector.js';
import { RuntimeContext } from '../../src/engine/browser/node-types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllPrompts } from '../../src/tools/prompts.js';
import {
  LoadBehaviorSchema,
  SetParametersSchema,
  GetStatusSchema,
  AbortBehaviorSchema,
  RegisterTriggerSchema,
  ReplayRecordingSchema,
  GetMetricsSchema,
  ManageBehaviorsSchema,
  ManageBlackboardSchema,
  ManageRuntimeDbSchema,
} from '../../src/schema/schemas.js';

describe('behavior-mcp Browser Actions, Conditions, Injector & Prompts & Schemas', () => {
  const mockContext = (): RuntimeContext => ({
    tick: 10,
    blackboard: {},
    telemetry: {},
  });

  describe('Standard Action Registry', () => {
    it('should execute move_to action', () => {
      const ctx = mockContext();
      const res = ActionRegistry.move_to({ destination: [10, 20, 30] }, ctx);
      expect(res.status).toBe('SUCCESS');
      expect(ctx.blackboard.current_destination).toEqual([10, 20, 30]);

      const resDef = ActionRegistry.move_to({}, ctx);
      expect(resDef.status).toBe('SUCCESS');
      expect(ctx.blackboard.current_destination).toEqual([0, 0, 0]);
    });

    it('should execute wait action with tick modulo', () => {
      const ctx = mockContext();
      ctx.tick = 10;
      expect(ActionRegistry.wait({ ticks: 10 }, ctx).status).toBe('SUCCESS');
      ctx.tick = 7;
      expect(ActionRegistry.wait({ ticks: 10 }, ctx).status).toBe('RUNNING');
    });

    it('should execute interact action', () => {
      const ctx = mockContext();
      const res = ActionRegistry.interact({ target: 'chest_01' }, ctx);
      expect(res.status).toBe('SUCCESS');
      expect(ctx.blackboard.last_interaction).toBe('chest_01');
    });

    it('should execute log action', () => {
      const ctx = mockContext();
      const res = ActionRegistry.log({ message: 'test log' }, ctx);
      expect(res.status).toBe('SUCCESS');
      expect(res.output?.message).toBe('test log');
    });

    it('should execute spell casting and combat actions', () => {
      const ctx = mockContext();
      expect(ActionRegistry.cast_spell({ spell: 'fireball' }, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.last_spell).toBe('fireball');

      expect(ActionRegistry.swing_sword({}, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.last_combat_action).toBe('swing_sword');

      expect(ActionRegistry.shoot_arrow({}, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.last_combat_action).toBe('shoot_arrow');

      expect(ActionRegistry.patrol_area({}, ctx).status).toBe('SUCCESS');
      expect(ActionRegistry.patrol({}, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.patrolling).toBe(true);
    });
  });

  describe('Game Action Registry', () => {
    it('should execute game action handlers', () => {
      const ctx = mockContext();
      expect(GameActionRegistry.attack_nearest({}, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.last_attack_target).toBe('nearest_enemy');

      expect(GameActionRegistry.flee_to_safety({}, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.fleeing).toBe(true);

      ctx.blackboard.resource_count = 5;
      expect(GameActionRegistry.gather({}, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.resource_count).toBe(6);

      expect(GameActionRegistry.heal({}, ctx).status).toBe('SUCCESS');
      expect(ctx.blackboard.healing).toBe(true);
    });
  });

  describe('Standard & Game Conditions', () => {
    it('should evaluate timer_elapsed condition', () => {
      const ctx = mockContext();
      ctx.tick = 100;
      expect(ConditionRegistry.timer_elapsed({ threshold_ticks: 60 }, ctx)).toBe(true);
      ctx.tick = 20;
      expect(ConditionRegistry.timer_elapsed({ threshold_ticks: 60 }, ctx)).toBe(false);
    });

    it('should evaluate blackboard_check condition', () => {
      const ctx = mockContext();
      ctx.blackboard.is_alert = true;
      expect(ConditionRegistry.blackboard_check({ key: 'is_alert', expected: true }, ctx)).toBe(
        true
      );
      expect(ConditionRegistry.blackboard_check({ key: 'is_alert', expected: false }, ctx)).toBe(
        false
      );
    });

    it('should evaluate proximity_check condition', () => {
      const ctx = mockContext();
      ctx.telemetry.target_distance = 5;
      expect(ConditionRegistry.proximity_check({ radius: 10 }, ctx)).toBe(true);
      ctx.telemetry.target_distance = 50;
      expect(ConditionRegistry.proximity_check({ radius: 10 }, ctx)).toBe(false);
    });

    it('should evaluate game conditions (hp_below, enemy_in_range, resource_above)', () => {
      const ctx = mockContext();
      ctx.telemetry.hp = 20;
      expect(GameConditionRegistry.hp_below({ threshold: 30 }, ctx)).toBe(true);
      ctx.telemetry.hp = 80;
      expect(GameConditionRegistry.hp_below({ threshold: 30 }, ctx)).toBe(false);

      ctx.telemetry.enemy_distance = 8;
      expect(GameConditionRegistry.enemy_in_range({ range: 15 }, ctx)).toBe(true);
      ctx.telemetry.enemy_distance = 30;
      expect(GameConditionRegistry.enemy_in_range({ range: 15 }, ctx)).toBe(false);

      ctx.blackboard.resource_count = 25;
      expect(GameConditionRegistry.resource_above({ capacity: 20 }, ctx)).toBe(true);
      ctx.blackboard.resource_count = 5;
      expect(GameConditionRegistry.resource_above({ capacity: 20 }, ctx)).toBe(false);
    });
  });

  describe('Browser Injector', () => {
    it('should generate valid injection script with PuterVision telemetry bridge', () => {
      const script = BrowserInjector.getInjectionScript({ id: 'test_tree', type: 'sequence' }, [
        'https://game.com',
      ]);
      expect(script).toContain('window.__BEHAVIOR_RUNTIME__');
      expect(script).toContain('window.__PUTERVISION_TELEMETRY__');
      expect(script).toContain('window.__PUTERVISION_GAME_STATE__');
      expect(script).toContain('putervision:telemetry');
      expect(script).toContain('test_tree');
    });
  });

  describe('Prompts Registration', () => {
    it('should register MCP standard prompts', () => {
      const server = new McpServer({ name: 'test', version: '1.0.0' });
      registerAllPrompts(server);
      expect(server).toBeDefined();
    });
  });

  describe('Zod Schema Validation Coverage', () => {
    it('should validate all 10 MCP tool schemas', () => {
      expect(LoadBehaviorSchema.safeParse({ action: 'load', behavior_name: 'test' }).success).toBe(
        true
      );
      expect(
        SetParametersSchema.safeParse({ action: 'set', parameters: { speed: 2 } }).success
      ).toBe(true);
      expect(GetStatusSchema.safeParse({ action: 'current' }).success).toBe(true);
      expect(AbortBehaviorSchema.safeParse({ action: 'abort' }).success).toBe(true);
      expect(RegisterTriggerSchema.safeParse({ action: 'list' }).success).toBe(true);
      expect(ReplayRecordingSchema.safeParse({ action: 'list' }).success).toBe(true);
      expect(GetMetricsSchema.safeParse({ action: 'current' }).success).toBe(true);
      expect(ManageBehaviorsSchema.safeParse({ action: 'list' }).success).toBe(true);
      expect(ManageBlackboardSchema.safeParse({ action: 'dump' }).success).toBe(true);
      expect(ManageRuntimeDbSchema.safeParse({ action: 'stats' }).success).toBe(true);
    });
  });
});
