import crypto from 'crypto';
import { BehaviorTreeNode, NodeStatus, DispatchToken } from '../../schema/types.js';
import { ConditionRegistry } from './conditions.js';
import { GameConditionRegistry } from './conditions-game.js';
import { ActionRegistry } from './actions.js';
import { GameActionRegistry } from './actions-game.js';

import { canonicalJsonStringify } from '../../utils/canonical-json.js';

const MAX_TREE_DEPTH = 64;
const CLOCK_SKEW_MS = 2000;

const usedTokenIds = new Map<string, number>();

export function clearUsedTokensForTest(): void {
  usedTokenIds.clear();
}

function pruneExpiredTokens(now: number): void {
  for (const [id, exp] of usedTokenIds.entries()) {
    if (now > exp + CLOCK_SKEW_MS) {
      usedTokenIds.delete(id);
    }
  }
}

export function verifyIntentionDispatch(
  intention: { id: string; behavior_name?: string; parameters?: Record<string, unknown> },
  token: DispatchToken,
  secret?: string
): boolean {
  const effectiveSecret = secret || process.env.PENTAD_HMAC_SECRET;
  if (!effectiveSecret || effectiveSecret.trim() === '') return false;
  if (!token || typeof token !== 'object') return false;
  if (token.aud !== 'behavior-mcp') return false;

  const now = Date.now();
  const expiresAt = Date.parse(token.expires_at);
  const issuedAt = Date.parse(token.issued_at);
  if (Number.isNaN(expiresAt) || Number.isNaN(issuedAt)) return false;

  if (now > expiresAt + CLOCK_SKEW_MS) return false;
  if (now < issuedAt - CLOCK_SKEW_MS) return false;
  if (token.intention_id !== intention.id) return false;
  if (intention.behavior_name && token.behavior_name !== intention.behavior_name) return false;

  // Validate params_hash against intention parameters
  const actionParams = intention.parameters || {};
  const computedHash = crypto
    .createHash('sha256')
    .update(canonicalJsonStringify(actionParams), 'utf8')
    .digest('hex');
  if (token.params_hash !== computedHash) return false;

  // Anti-replay check
  pruneExpiredTokens(now);
  if (usedTokenIds.has(token.token_id)) return false;

  const expectedSig = crypto
    .createHmac('sha256', effectiveSecret)
    .update(
      `${token.token_id}:${token.intention_id}:${token.behavior_name}:${token.params_hash}:${token.aud}:${token.issued_at}:${token.expires_at}`
    )
    .digest('hex');

  const sigBuf = Buffer.from(token.hmac_signature || '', 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  // Verify buffer lengths before calling crypto.timingSafeEqual() to avoid RangeError on tampered tokens
  if (sigBuf.length !== expectedBuf.length || sigBuf.length === 0) return false;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return false;

  // Mark token as used to prevent replay
  usedTokenIds.set(token.token_id, expiresAt);
  return true;
}

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

    const res = this.evaluateNode(this.tree, 'root', ctx, 0);
    return {
      status: res.status,
      activePath: res.activePath,
      blackboard: this.blackboard,
    };
  }

  private evaluateNode(node: BehaviorTreeNode, path: string, ctx: any, depth = 0): { status: NodeStatus; activePath: string } {
    if (depth > MAX_TREE_DEPTH) {
      return { status: 'FAILURE', activePath: `${path}/depth_exceeded` };
    }

    switch (node.type) {
      case 'sequence': {
        const children = node.children || [];
        for (let i = 0; i < children.length; i++) {
          const childPath = `${path}/seq_${i}_${children[i].type}`;
          const childRes = this.evaluateNode(children[i], childPath, ctx, depth + 1);
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
          const childRes = this.evaluateNode(children[i], childPath, ctx, depth + 1);
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
        const childRes = this.evaluateNode(node.children[0], `${path}/inv`, ctx, depth + 1);
        if (childRes.status === 'SUCCESS') return { status: 'FAILURE', activePath: childRes.activePath };
        if (childRes.status === 'FAILURE') return { status: 'SUCCESS', activePath: childRes.activePath };
        return childRes;
      }

      case 'guard': {
        if (node.guard) {
          const guardRes = this.evaluateNode(node.guard, `${path}/guard_cond`, ctx, depth + 1);
          if (guardRes.status !== 'SUCCESS') {
            return { status: 'FAILURE', activePath: guardRes.activePath };
          }
        } else if (node.name) {
          const condFn = ConditionRegistry[node.name] || GameConditionRegistry[node.name];
          const passed = condFn ? condFn(node.parameters || {}, ctx) : true;
          if (!passed) {
            return { status: 'FAILURE', activePath: `${path}/guard_cond` };
          }
        }
        if (!node.children || node.children.length === 0) return { status: 'SUCCESS', activePath: path };
        return this.evaluateNode(node.children[0], `${path}/guard_child`, ctx, depth + 1);
      }

      case 'timeout': {
        const timeoutMs = node.timeout_ms || (node.parameters?.timeout_ms as number) || 5000;
        const currentElapsedMs =
          (ctx.telemetry?.tick_duration_ms as number) !== undefined
            ? (ctx.telemetry.tick_duration_ms as number)
            : (ctx.tick || 1) * 16.6;
        if (currentElapsedMs > timeoutMs) {
          return { status: 'FAILURE', activePath: `${path}/timeout_exceeded` };
        }
        if (!node.children || node.children.length === 0) return { status: 'SUCCESS', activePath: path };
        return this.evaluateNode(node.children[0], `${path}/timeout_child`, ctx, depth + 1);
      }

      default:
        throw new Error(`Unknown behavior tree node type: "${(node as any)?.type}" at path "${path}". Fail-closed enforced.`);
    }
  }
}
