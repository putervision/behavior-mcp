import { RuntimeContext } from './node-types.js';
import { NodeStatus } from '../../schema/types.js';

export const GameActionRegistry: Record<
  string,
  (params: Record<string, unknown>, ctx: RuntimeContext) => { status: NodeStatus; output?: Record<string, unknown> }
> = {
  attack_nearest: (params, ctx) => {
    ctx.blackboard.last_attack_target = 'nearest_enemy';
    return { status: 'SUCCESS', output: { action: 'attack', target: 'nearest_enemy' } };
  },
  flee_to_safety: (params, ctx) => {
    ctx.blackboard.fleeing = true;
    return { status: 'SUCCESS', output: { action: 'flee', waypoint: 'base' } };
  },
  gather: (params, ctx) => {
    const current = (ctx.blackboard.resource_count as number) || 0;
    ctx.blackboard.resource_count = current + 1;
    return { status: 'SUCCESS', output: { resource_count: ctx.blackboard.resource_count } };
  },
  heal: (params, ctx) => {
    ctx.blackboard.healing = true;
    return { status: 'SUCCESS', output: { action: 'use_potion' } };
  },
};
