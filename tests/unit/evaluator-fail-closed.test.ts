import { describe, it, expect } from 'vitest';
import { BehaviorTreeEvaluator } from '../../src/engine/browser/executor-bundle.js';
import { BehaviorTreeNode } from '../../src/schema/types.js';

describe('BehaviorTreeEvaluator - Fail-Closed & Node Scope Verification', () => {
  it('throws an explicit error on unknown node types (enforcing fail-closed)', () => {
    const unknownTree: any = {
      id: 'unk1',
      type: 'parallel_quantum_node',
      children: [],
    };

    const evaluator = new BehaviorTreeEvaluator(unknownTree);
    expect(() => evaluator.step({})).toThrowError(/Unknown behavior tree node type/i);
  });

  it('throws an explicit error when unsupported node types are attempted', () => {
    const parallelTree: any = {
      id: 'par1',
      type: 'parallel',
      children: [
        { id: 'a1', type: 'action', name: 'move' },
        { id: 'a2', type: 'action', name: 'look' },
      ],
    };

    const evaluator = new BehaviorTreeEvaluator(parallelTree);
    expect(() => evaluator.step({})).toThrowError(/Unknown behavior tree node type: "parallel"/i);
  });

  it('evaluates guard nodes - returns child status when condition is satisfied', () => {
    const guardedTree: BehaviorTreeNode = {
      id: 'g1',
      type: 'guard',
      name: 'energy_available',
      parameters: { min_energy: 50 },
      children: [
        { id: 'a1', type: 'action', name: 'cast_spell', parameters: { spell: 'fireball' } },
      ],
    };

    const evaluator = new BehaviorTreeEvaluator(guardedTree);
    // When condition passes (no blocker in blackboard or satisfied):
    const resultSuccess = evaluator.step({ energy: 80 });
    expect(resultSuccess.status).toBe('SUCCESS');
    expect(resultSuccess.blackboard.last_spell).toBe('fireball');
  });

  it('evaluates timeout nodes - succeeds if child finishes within threshold', () => {
    const timeoutTree: BehaviorTreeNode = {
      id: 't1',
      type: 'timeout',
      parameters: { timeout_ms: 1000 },
      children: [{ id: 'a1', type: 'action', name: 'instant_action' }],
    };

    const evaluator = new BehaviorTreeEvaluator(timeoutTree);
    const result = evaluator.step({ tick_duration_ms: 10 });
    expect(result.status).toBe('SUCCESS');
  });

  it('evaluates timeout nodes - fails if execution exceeds timeout threshold', () => {
    const timeoutTree: BehaviorTreeNode = {
      id: 't2',
      type: 'timeout',
      parameters: { timeout_ms: 50 },
      children: [{ id: 'a1', type: 'action', name: 'long_action' }],
    };

    const evaluator = new BehaviorTreeEvaluator(timeoutTree);
    const result = evaluator.step({ tick_duration_ms: 100 });
    expect(result.status).toBe('FAILURE');
  });

  it('evaluates deeply nested sequence-selector compositions deterministically', () => {
    const complexTree: BehaviorTreeNode = {
      id: 'root',
      type: 'selector',
      children: [
        {
          id: 'combat_branch',
          type: 'sequence',
          children: [
            {
              id: 'cond_enemy',
              type: 'condition',
              name: 'enemy_in_range',
              parameters: { range: 10 },
            },
            {
              id: 'combat_sel',
              type: 'selector',
              children: [
                {
                  id: 'seq_melee',
                  type: 'sequence',
                  children: [
                    { id: 'cond_melee', type: 'condition', name: 'melee_distance' },
                    { id: 'act_swing', type: 'action', name: 'swing_sword' },
                  ],
                },
                { id: 'act_shoot', type: 'action', name: 'shoot_arrow' },
              ],
            },
          ],
        },
        {
          id: 'patrol_branch',
          type: 'sequence',
          children: [{ id: 'act_patrol', type: 'action', name: 'patrol_area' }],
        },
      ],
    };

    const evaluator = new BehaviorTreeEvaluator(complexTree);

    // Scenario A: No enemy in range -> falls back to patrol (child index 1)
    const resultA = evaluator.step({ enemy_distance: 50 });
    expect(resultA.status).toBe('SUCCESS');
    expect(resultA.activePath).toContain('sel_1_sequence');

    // Scenario B: Enemy in range (dist=8), melee dist=2 -> swings sword
    const resultB = evaluator.step({ enemy_distance: 8, target_range: 2 });
    expect(resultB.status).toBe('SUCCESS');
    expect(resultB.blackboard.last_combat_action).toBe('swing_sword');
  });
});
