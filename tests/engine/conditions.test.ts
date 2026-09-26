import { describe, it, expect } from 'vitest';
import { ConditionRegistry } from '../../src/engine/browser/conditions.js';
import { ActionRegistry } from '../../src/engine/browser/actions.js';
import { RuntimeContext } from '../../src/engine/browser/node-types.js';

describe('Behavior-MCP Conditions & 60Hz Tick Invariant', () => {
  const createContext = (blackboard: Record<string, unknown> = {}): RuntimeContext => ({
    tick: 1,
    telemetry: {},
    blackboard,
  });

  it('registers semantic_check in ConditionRegistry as a synchronous lookup', () => {
    expect('semantic_check' in ConditionRegistry).toBe(true);
    const handler = ConditionRegistry['semantic_check']!;

    // Pure synchronous execution test: must not return a Promise
    const ctx = createContext();
    const result = handler({ key: 'door_open' }, ctx);
    expect(typeof result).toBe('boolean');
  });

  it('evaluates semantic_check as true when fresh decision is present (<5000ms)', () => {
    const handler = ConditionRegistry['semantic_check']!;
    const ctx = createContext({
      semantic_decision_threat_clear: {
        result: true,
        timestamp: Date.now() - 1000, // 1 second ago
      },
    });

    const result = handler({ key: 'threat_clear' }, ctx);
    expect(result).toBe(true);
  });

  it('evaluates semantic_check as false when decision is stale (>5000ms)', () => {
    const handler = ConditionRegistry['semantic_check']!;
    const ctx = createContext({
      semantic_decision_threat_clear: {
        result: true,
        timestamp: Date.now() - 6000, // 6 seconds ago (stale)
      },
    });

    const result = handler({ key: 'threat_clear' }, ctx);
    expect(result).toBe(false);
  });

  it('evaluates semantic_check as false when decision is missing', () => {
    const handler = ConditionRegistry['semantic_check']!;
    const ctx = createContext({});

    const result = handler({ key: 'unseen_key' }, ctx);
    expect(result).toBe(false);
  });

  it('runs request_semantic_evaluation companion action without blocking tick', () => {
    expect('request_semantic_evaluation' in ActionRegistry).toBe(true);
    const handler = ActionRegistry['request_semantic_evaluation']!;

    const ctx = createContext();
    const res = handler(
      { key: 'target_hostile', query: 'Is entity hostile?', context_data: { entity_id: 'e1' } },
      ctx
    );

    // Companion action must yield RUNNING to preserve 60Hz tick
    expect(res.status).toBe('RUNNING');

    // Must set blackboard request flag for host fulfillment
    const request = ctx.blackboard['semantic_request_target_hostile'] as any;
    expect(request).toBeDefined();
    expect(request.query).toBe('Is entity hostile?');
    expect(request.context_data).toEqual({ entity_id: 'e1' });
    expect(request.timestamp).toBeDefined();
  });
});
