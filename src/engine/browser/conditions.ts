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
  semantic_check: (params, ctx) => {
    const key = (params.key as string) || (params.statement as string) || (params.query as string) || 'default';
    const decisionKey = `semantic_decision_${key}`;
    const entry = ctx.blackboard[decisionKey];
    if (entry === undefined || entry === null) {
      return false;
    }
    const now = Date.now();
    if (typeof entry === 'object' && entry !== null && 'result' in entry) {
      const obj = entry as { result: boolean; timestamp?: number };
      if (obj.timestamp !== undefined && now - obj.timestamp > 5000) {
        return false;
      }
      return obj.result === true;
    }
    const tsKey = `semantic_timestamp_${key}`;
    const ts = ctx.blackboard[tsKey] as number | undefined;
    if (ts !== undefined && now - ts > 5000) {
      return false;
    }
    const expected = params.expected ?? true;
    return entry === expected;
  },
};
