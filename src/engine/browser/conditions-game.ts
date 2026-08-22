import { RuntimeContext } from './node-types.js';

export const GameConditionRegistry: Record<
  string,
  (params: Record<string, unknown>, ctx: RuntimeContext) => boolean
> = {
  hp_below: (params, ctx) => {
    const hp = (ctx.telemetry.hp as number) ?? 100;
    const threshold = (params.threshold as number) ?? 30;
    return hp < threshold;
  },
  enemy_in_range: (params, ctx) => {
    const enemyDist = (ctx.telemetry.enemy_distance as number) ?? 999;
    const range = (params.range as number) ?? 15;
    return enemyDist <= range;
  },
  resource_above: (params, ctx) => {
    const amount = (ctx.blackboard.resource_count as number) ?? 0;
    const capacity = (params.capacity as number) ?? 20;
    return amount >= capacity;
  },
};
