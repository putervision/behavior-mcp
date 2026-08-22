import { describe, it, expect } from 'vitest';
import { BehaviorTreeEvaluator } from '../../src/engine/browser/executor-bundle.js';
import { BehaviorTreeNode } from '../../src/schema/types.js';

describe('BehaviorTreeEvaluator Traversal', () => {
  it('evaluates sequence nodes requiring all children to pass', () => {
    const seqTree: BehaviorTreeNode = {
      id: 'seq1',
      type: 'sequence',
      children: [
        { id: 'c1', type: 'condition', name: 'proximity_check', parameters: { radius: 20 } },
        { id: 'a1', type: 'action', name: 'move_to', parameters: { destination: [10, 0, 10] } },
      ],
    };

    const evaluator = new BehaviorTreeEvaluator(seqTree);
    const result = evaluator.step({ target_distance: 15 });
    expect(result.status).toBe('SUCCESS');
    expect(result.blackboard.current_destination).toEqual([10, 0, 10]);
  });

  it('evaluates selector node falling back to second child when first fails', () => {
    const selTree: BehaviorTreeNode = {
      id: 'sel1',
      type: 'selector',
      children: [
        {
          id: 'seq_emergency',
          type: 'sequence',
          children: [
            { id: 'cond_hp', type: 'condition', name: 'hp_below', parameters: { threshold: 20 } },
            { id: 'act_flee', type: 'action', name: 'flee_to_safety' },
          ],
        },
        { id: 'act_attack', type: 'action', name: 'attack_nearest' },
      ],
    };

    const evaluator = new BehaviorTreeEvaluator(selTree);
    // HP is 80 (not below 20), so emergency fails and it falls back to attack
    const result = evaluator.step({ hp: 80 });
    expect(result.status).toBe('SUCCESS');
    expect(result.blackboard.last_attack_target).toBe('nearest_enemy');
  });

  it('evaluates inverter decorator properly', () => {
    const invTree: BehaviorTreeNode = {
      id: 'inv1',
      type: 'inverter',
      children: [
        { id: 'cond_timer', type: 'condition', name: 'timer_elapsed', parameters: { threshold_ticks: 100 } },
      ],
    };

    const evaluator = new BehaviorTreeEvaluator(invTree);
    // At tick 1, timer_elapsed is false (FAILURE) -> inverter turns it into SUCCESS
    const result = evaluator.step({});
    expect(result.status).toBe('SUCCESS');
  });
});
