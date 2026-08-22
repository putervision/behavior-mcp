import { RuntimeContext } from './node-types.js';

export const ConditionRegistry: Record<
  string,
  (params: Record<string, unknown>, ctx: RuntimeContext) => boolean
> = {
  timer_elapsed: (params, ctx) => {
    const threshold = (params.threshold_ticks as number) || 60;
    return ctx.tick >= threshold;
  },
  blackboard_check: (params, ctx) => {
    const key = params.key as string;
    const expected = params.expected;
    return ctx.blackboard[key] === expected;
  },
  proximity_check: (params, ctx) => {
    const dist = (ctx.telemetry.target_distance as number) ?? 999;
    const radius = (params.radius as number) ?? 10;
    return dist <= radius;
  },
};
