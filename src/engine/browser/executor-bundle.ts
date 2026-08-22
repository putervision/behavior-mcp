import { BehaviorTreeNode, NodeStatus } from '../../schema/types.js';
import { ConditionRegistry } from './conditions.js';
import { GameConditionRegistry } from './conditions-game.js';
import { ActionRegistry } from './actions.js';
import { GameActionRegistry } from './actions-game.js';

export class BehaviorTreeEvaluator {
  private tree: BehaviorTreeNode;
  private blackboard: Record<string, unknown>;
  private tickCount: number = 0;

  constructor(tree: BehaviorTreeNode, initialBlackboard: Record<string, unknown> = {}) {
    this.tree = tree;
    this.blackboard = { ...initialBlackboard };
  }

  public step(telemetry: Record<string, unknown> = {}): { status: NodeStatus; activePath: string; blackboard: Record<string, unknown> } {
    this.tickCount++;
    const ctx = {
      blackboard: this.blackboard,
      telemetry,
      tick: this.tickCount,
    };

    const res = this.evaluateNode(this.tree, 'root', ctx);
    return {
      status: res.status,
      activePath: res.activePath,
      blackboard: this.blackboard,
    };
  }

  private evaluateNode(node: BehaviorTreeNode, path: string, ctx: any): { status: NodeStatus; activePath: string } {
    switch (node.type) {
      case 'sequence': {
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
          const childPath = `${path}/seq_${i}_${children[i].type}`;
          const childRes = this.evaluateNode(children[i], childPath, ctx);
          if (childRes.status !== 'SUCCESS') {
            return { status: childRes.status, activePath: childRes.activePath };
          }
        }
        return { status: 'SUCCESS', activePath: path };
      }

      case 'selector': {
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
          const childPath = `${path}/sel_${i}_${children[i].type}`;
          const childRes = this.evaluateNode(children[i], childPath, ctx);
          if (childRes.status !== 'FAILURE') {
            return { status: childRes.status, activePath: childRes.activePath };
          }
        }
        return { status: 'FAILURE', activePath: path };
      }

      case 'condition': {
        const condFn = ConditionRegistry[node.name || ''] || GameConditionRegistry[node.name || ''];
        const passed = condFn ? condFn(node.parameters || {}, ctx) : true;
        return { status: (passed ? 'SUCCESS' : 'FAILURE') as NodeStatus, activePath: path };
      }

      case 'action': {
        const actFn = ActionRegistry[node.name || ''] || GameActionRegistry[node.name || ''];
        const actRes = actFn ? actFn(node.parameters || {}, ctx) : { status: 'SUCCESS' as NodeStatus };
        return { status: actRes.status as NodeStatus, activePath: path };
      }

      case 'inverter': {
        if (!node.children || node.children.length === 0) return { status: 'SUCCESS', activePath: path };
        const childRes = this.evaluateNode(node.children[0], `${path}/inv`, ctx);
        if (childRes.status === 'SUCCESS') return { status: 'FAILURE', activePath: childRes.activePath };
        if (childRes.status === 'FAILURE') return { status: 'SUCCESS', activePath: childRes.activePath };
        return childRes;
      }

      default:
        return { status: 'SUCCESS', activePath: path };
    }
  }
}
