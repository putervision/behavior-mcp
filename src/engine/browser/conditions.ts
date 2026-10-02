import { RuntimeContext } from './node-types.js';
import { AffordanceBitmask } from '../../schema/types.js';

function isSpatialStale(blackboard: Record<string, unknown>): boolean {
  const expiresAt = blackboard['spatial._expires_at'] as string | undefined;
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

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

  // ── Typed Spatial Conditions (§3) ──────────────────────────────────────────
  spatial_entity_near: (params, ctx) => {
    if (isSpatialStale(ctx.blackboard)) return false;

    const nearby = (ctx.blackboard['spatial.nearby_entities'] || ctx.telemetry.nearby_entities) as Array<{
      id: string;
      type: string;
      distance: number;
      status?: string;
      affordance_mask?: number;
    }> | undefined;

    if (!Array.isArray(nearby) || nearby.length === 0) return false;

    const maxDist =
      (params.radius as number) ??
      (params.max_distance as number) ??
      (params.distance as number) ??
      10;
    const entityType = (params.entity_type as string) || (params.type as string);
    const requiredAffordances =
      (params.required_affordances as number) ?? (params.affordance_mask as number);

    return nearby.some((e) => {
      if (e.distance > maxDist) return false;
      if (entityType && !e.type.toLowerCase().includes(entityType.toLowerCase())) return false;
      if (
        requiredAffordances !== undefined &&
        ((e.affordance_mask ?? 0) & requiredAffordances) !== requiredAffordances
      ) {
        return false;
      }
      return true;
    });
  },

  affordance_check: (params, ctx) => {
    if (isSpatialStale(ctx.blackboard)) return false;

    const targetId = (params.target_id || params.target_entity_id) as string | undefined;
    const required = (params.required_affordances ?? params.required) as number | undefined;
    const forbidden = (params.forbidden_affordances ?? params.forbidden) as number | undefined;

    const nearby = ctx.blackboard['spatial.nearby_entities'] as Array<{
      id: string;
      affordance_mask?: number;
    }> | undefined;

    let mask = ctx.blackboard['spatial.affordance_mask'] as number | undefined;
    if (targetId && Array.isArray(nearby)) {
      const found = nearby.find((e) => e.id === targetId);
      if (found) mask = found.affordance_mask;
    }

    if (mask === undefined) return false;
    if (required !== undefined && (mask & required) !== required) return false;
    if (forbidden !== undefined && (mask & forbidden) !== 0) return false;
    return true;
  },

  threat_in_frustum: (params, ctx) => {
    if (isSpatialStale(ctx.blackboard)) return false;

    const threatLevel =
      (ctx.blackboard['vitals.threat_level'] as number) ??
      (ctx.telemetry.threat_level as number) ??
      0;
    const threshold = (params.threshold as number) ?? 0.5;
    if (threatLevel >= threshold) return true;

    const nearby = ctx.blackboard['spatial.nearby_entities'] as Array<{
      id: string;
      type: string;
      status?: string;
      affordance_mask?: number;
    }> | undefined;

    if (Array.isArray(nearby)) {
      return nearby.some(
        (e) =>
          ((e.affordance_mask ?? 0) & AffordanceBitmask.THREAT) !== 0 ||
          /hostile|enemy|threat/i.test(e.status || e.type)
      );
    }
    return false;
  },

  path_clear: (params, ctx) => {
    if (isSpatialStale(ctx.blackboard)) return false;

    const clearanceThreshold =
      (params.clearance_threshold as number) ?? (params.min_clearance as number) ?? 1.5;
    const nearby = ctx.blackboard['spatial.nearby_entities'] as Array<{
      id: string;
      distance: number;
      affordance_mask?: number;
    }> | undefined;

    if (!Array.isArray(nearby) || nearby.length === 0) return true;

    const blocking = nearby.some((e) => {
      if (e.distance < clearanceThreshold) {
        const mask = e.affordance_mask;
        if (mask !== undefined) {
          if (
            (mask & AffordanceBitmask.TRAVERSABLE) === 0 ||
            (mask & AffordanceBitmask.OCCLUDER) !== 0 ||
            (mask & AffordanceBitmask.THREAT) !== 0
          ) {
            return true;
          }
        }
      }
      return false;
    });

    return !blocking;
  },
};

// Aliases for PascalCase / camelCase tree specifications
ConditionRegistry.SpatialEntityNear = ConditionRegistry.spatial_entity_near;
ConditionRegistry.AffordanceCheck = ConditionRegistry.affordance_check;
ConditionRegistry.ThreatInFrustum = ConditionRegistry.threat_in_frustum;
ConditionRegistry.PathClear = ConditionRegistry.path_clear;
