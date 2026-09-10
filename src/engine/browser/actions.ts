import { RuntimeContext } from './node-types.js';
import { NodeStatus } from '../../schema/types.js';

export const ActionRegistry: Record<
  string,
  (params: Record<string, unknown>, ctx: RuntimeContext) => { status: NodeStatus; output?: Record<string, unknown> }
> = {
  move_to: (params, ctx) => {
    ctx.blackboard.current_destination = params.destination || [0, 0, 0];
    return { status: 'SUCCESS', output: { destination: ctx.blackboard.current_destination } };
  },
  wait: (params, ctx) => {
    const ticks = (params.ticks as number) || 10;
    if (ctx.tick % ticks === 0) return { status: 'SUCCESS' };
    return { status: 'RUNNING' };
  },
  interact: (params, ctx) => {
    ctx.blackboard.last_interaction = params.target || 'object';
    return { status: 'SUCCESS', output: { interacted_with: ctx.blackboard.last_interaction } };
  },
  log: (params, ctx) => {
    return { status: 'SUCCESS', output: { message: params.message || 'Log action executed' } };
  },
  cast_spell: (params, ctx) => {
    ctx.blackboard.last_spell = params.spell || 'default_spell';
    return { status: 'SUCCESS', output: { spell: ctx.blackboard.last_spell } };
  },
  swing_sword: (params, ctx) => {
    ctx.blackboard.last_combat_action = 'swing_sword';
    return { status: 'SUCCESS', output: { combat: 'melee' } };
  },
  shoot_arrow: (params, ctx) => {
    ctx.blackboard.last_combat_action = 'shoot_arrow';
    return { status: 'SUCCESS', output: { combat: 'ranged' } };
  },
  patrol_area: (params, ctx) => {
    ctx.blackboard.patrolling = true;
    return { status: 'SUCCESS', output: { patrol: true } };
  },
  patrol: (params, ctx) => {
    ctx.blackboard.patrolling = true;
    return { status: 'SUCCESS', output: { patrol: true } };
  },
};
