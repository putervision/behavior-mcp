import { BehaviorTreeNode } from '../../schema/types.js';

export class BrowserInjector {
  static getInjectionScript(tree: BehaviorTreeNode, allowlistOrigins: string[] = ['*']): string {
    return `
      (function() {
        const allowed = ${JSON.stringify(allowlistOrigins)};
        const origin = window.location.origin;
        if (!allowed.includes('*') && !allowed.includes(origin)) {
          console.warn('[BEHAVIOR_RUNTIME] Origin rejected: ' + origin);
          return;
        }

        window.__BEHAVIOR_RUNTIME__ = window.__BEHAVIOR_RUNTIME__ || {
          enabled: true,
          tickCount: 0,
          currentStatus: 'idle',
          activeNodePath: 'root',
          blackboard: {},
          tree: ${JSON.stringify(tree)},
        };

        console.log('[BEHAVIOR_RUNTIME] Injected behavior runtime for tree: ' + '${tree.id || "root"}');
      })();
    `;
  }
}
