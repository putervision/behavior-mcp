import { BehaviorTreeNode, NodeStatus } from '../../schema/types.js';

export type NodeExecutionResult = {
  status: NodeStatus;
  activePath: string;
  actionOutput?: Record<string, unknown>;
};

export interface RuntimeContext {
  blackboard: Record<string, unknown>;
  telemetry: Record<string, unknown>;
  tick: number;
}
