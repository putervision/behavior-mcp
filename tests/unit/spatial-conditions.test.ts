import { describe, it, expect } from 'vitest';
import { ConditionRegistry } from '../../src/engine/browser/conditions.js';
import { ExecutionContext, AffordanceBitmask } from '../../src/schema/types.js';

describe('Typed Spatial Conditions Suite', () => {
  const mockContext = (blackboard: Record<string, unknown>): ExecutionContext => ({
    blackboard,
    telemetry: {
      fps: 60,
      frame_time_ms: 16.6,
      threat_level: 0,
      consecutive_failures: 0,
    },
    tick_count: 10,
    duration_ms: 166,
  });

  const now = Date.now();
  const freshBlackboard = (extra: Record<string, unknown> = {}) => ({
    'spatial._expires_at': new Date(now + 10000).toISOString(),
    ...extra,
  });

  const staleBlackboard = (extra: Record<string, unknown> = {}) => ({
    'spatial._expires_at': new Date(now - 1000).toISOString(),
    ...extra,
  });

  describe('spatial_entity_near', () => {
    it('evaluates true when target entity is within max_distance', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.nearby_entities': [
            { id: 'door_1', type: 'door', distance: 3.2, affordance_mask: AffordanceBitmask.INTERACTABLE },
          ],
        })
      );

      const res = ConditionRegistry.spatial_entity_near(
        { entity_type: 'door', max_distance: 5.0 },
        ctx
      );
      expect(res).toBe(true);
    });

    it('evaluates false when entity is outside max_distance', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.nearby_entities': [
            { id: 'door_1', type: 'door', distance: 8.5, affordance_mask: AffordanceBitmask.INTERACTABLE },
          ],
        })
      );

      const res = ConditionRegistry.spatial_entity_near(
        { entity_type: 'door', max_distance: 5.0 },
        ctx
      );
      expect(res).toBe(false);
    });

    it('fails closed when spatial slice is stale', () => {
      const ctx = mockContext(
        staleBlackboard({
          'spatial.nearby_entities': [
            { id: 'door_1', type: 'door', distance: 1.0, affordance_mask: AffordanceBitmask.INTERACTABLE },
          ],
        })
      );

      const res = ConditionRegistry.spatial_entity_near(
        { entity_type: 'door', max_distance: 5.0 },
        ctx
      );
      expect(res).toBe(false);
    });
  });

  describe('affordance_check', () => {
    it('evaluates true when required affordances match', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.affordance_mask': AffordanceBitmask.TRAVERSABLE | AffordanceBitmask.INTERACTABLE,
        })
      );

      const res = ConditionRegistry.affordance_check(
        { required: AffordanceBitmask.TRAVERSABLE },
        ctx
      );
      expect(res).toBe(true);
    });

    it('evaluates false when forbidden affordance is present', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.affordance_mask': AffordanceBitmask.TRAVERSABLE | AffordanceBitmask.THREAT,
        })
      );

      const res = ConditionRegistry.affordance_check(
        { required: AffordanceBitmask.TRAVERSABLE, forbidden: AffordanceBitmask.THREAT },
        ctx
      );
      expect(res).toBe(false);
    });

    it('evaluates target entity affordance mask from nearby_entities', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.nearby_entities': [
            { id: 'terminal_A', affordance_mask: AffordanceBitmask.INTERACTABLE },
          ],
        })
      );

      const res = ConditionRegistry.affordance_check(
        { target_id: 'terminal_A', required: AffordanceBitmask.INTERACTABLE },
        ctx
      );
      expect(res).toBe(true);
    });
  });

  describe('threat_in_frustum', () => {
    it('detects threat entities in nearby list', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.nearby_entities': [
            { id: 'sentry_1', type: 'hostile_robot', affordance_mask: AffordanceBitmask.THREAT },
          ],
        })
      );

      const res = ConditionRegistry.threat_in_frustum({}, ctx);
      expect(res).toBe(true);
    });

    it('detects high threat level in vitals blackboard', () => {
      const ctx = mockContext(
        freshBlackboard({
          'vitals.threat_level': 0.85,
        })
      );

      const res = ConditionRegistry.threat_in_frustum({ threshold: 0.7 }, ctx);
      expect(res).toBe(true);
    });

    it('evaluates false when no threats present and threat level low', () => {
      const ctx = mockContext(
        freshBlackboard({
          'vitals.threat_level': 0.1,
          'spatial.nearby_entities': [
            { id: 'plant', type: 'vegetation', affordance_mask: AffordanceBitmask.DESTRUCTIBLE },
          ],
        })
      );

      const res = ConditionRegistry.threat_in_frustum({}, ctx);
      expect(res).toBe(false);
    });
  });

  describe('path_clear', () => {
    it('evaluates true when nearby entities are far or traversable', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.nearby_entities': [
            { id: 'carpet', distance: 0.5, affordance_mask: AffordanceBitmask.TRAVERSABLE },
            { id: 'pillar', distance: 5.0, affordance_mask: AffordanceBitmask.OCCLUDER },
          ],
        })
      );

      const res = ConditionRegistry.path_clear({ min_clearance: 1.5 }, ctx);
      expect(res).toBe(true);
    });

    it('evaluates false when non-traversable obstacle is within clearance threshold', () => {
      const ctx = mockContext(
        freshBlackboard({
          'spatial.nearby_entities': [
            { id: 'wall', distance: 0.8, affordance_mask: AffordanceBitmask.OCCLUDER },
          ],
        })
      );

      const res = ConditionRegistry.path_clear({ min_clearance: 1.5 }, ctx);
      expect(res).toBe(false);
    });
  });
});
