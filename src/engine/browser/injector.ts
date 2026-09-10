import { BehaviorTreeNode } from '../../schema/types.js';

export interface GameTelemetryPayload {
  hp?: number;
  max_hp?: number;
  mana?: number;
  max_mana?: number;
  stamina?: number;
  position?: { x: number; y: number; z?: number };
  inventory_weight?: number;
  inventory?: Array<{ id: string; name: string; quantity: number }>;
  enemies_in_range?: number;
  target_id?: string;
  in_combat?: boolean;
  metadata?: Record<string, unknown>;
}

export class BrowserInjector {
  /**
   * Generates the browser evaluation script injecting the ~60Hz Behavior Tree runtime,
   * safety rate limiters, and the PuterVision Game Telemetry Bridge.
   */
  static getInjectionScript(tree: BehaviorTreeNode, allowlistOrigins: string[] = ['*']): string {
    return `
      (function() {
        const allowed = ${JSON.stringify(allowlistOrigins)};
        const origin = window.location.origin;
        if (!allowed.includes('*') && !allowed.includes(origin)) {
          console.warn('[BEHAVIOR_RUNTIME] Origin rejected: ' + origin);
          return;
        }

        // Initialize PuterVision Global Runtime
        window.__BEHAVIOR_RUNTIME__ = window.__BEHAVIOR_RUNTIME__ || {
          enabled: true,
          tickCount: 0,
          currentStatus: 'idle',
          activeNodePath: 'root',
          blackboard: {},
          tree: ${JSON.stringify(tree)},
        };

        // Initialize PuterVision Game Telemetry Bridge
        window.__PUTERVISION_GAME_STATE__ = window.__PUTERVISION_GAME_STATE__ || {};
        window.__PUTERVISION_TELEMETRY__ = {
          update: function(telemetry) {
            if (!telemetry || typeof telemetry !== 'object') return;
            Object.assign(window.__PUTERVISION_GAME_STATE__, telemetry);
            if (window.__BEHAVIOR_RUNTIME__ && window.__BEHAVIOR_RUNTIME__.blackboard) {
              Object.assign(window.__BEHAVIOR_RUNTIME__.blackboard, telemetry);
            }
          },
          get: function() {
            return Object.assign({}, window.__PUTERVISION_GAME_STATE__);
          },
          clear: function() {
            window.__PUTERVISION_GAME_STATE__ = {};
          }
        };

        // Listen for standard custom telemetry events dispatched by web games
        window.addEventListener('putervision:telemetry', function(evt) {
          if (evt.detail && window.__PUTERVISION_TELEMETRY__) {
            window.__PUTERVISION_TELEMETRY__.update(evt.detail);
          }
        });

        console.log('[BEHAVIOR_RUNTIME] Injected behavior runtime & PuterVision telemetry bridge for tree: ' + '${tree.id || "root"}');
      })();
    `;
  }
}
