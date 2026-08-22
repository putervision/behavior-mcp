import { describe, it, expect } from 'vitest';
import { StuckDetector } from '../../src/engine/stuck-detector.js';
import { WatchdogTimer } from '../../src/engine/watchdog.js';
import { ActionRateLimiter } from '../../src/engine/rate-limiter.js';
import { PolicyGate } from '../../src/engine/policy-gate.js';
import { EmergencySafety } from '../../src/engine/safety.js';

describe('Safety Guardrails', () => {
  it('detects infinite node loops in stuck detector', () => {
    const detector = new StuckDetector();
    for (let i = 0; i < 29; i++) {
      expect(detector.checkStuck('root/sel/attack').isStuck).toBe(false);
    }
    const check30 = detector.checkStuck('root/sel/attack');
    expect(check30.isStuck).toBe(true);
  });

  it('expires watchdog timer when tick loop freezes', async () => {
    const watchdog = new WatchdogTimer(50); // 50ms threshold
    watchdog.feed();
    expect(watchdog.isExpired()).toBe(false);

    await new Promise((r) => setTimeout(r, 60));
    expect(watchdog.isExpired()).toBe(true);
  });

  it('rate limits high frequency actions exceeding threshold', () => {
    const limiter = new ActionRateLimiter(5);
    for (let i = 0; i < 5; i++) {
      expect(limiter.allowAction()).toBe(true);
    }
    expect(limiter.allowAction()).toBe(false);
  });

  it('policy gate blocks high-risk irreversible actions', () => {
    const gate = new PolicyGate();
    expect(gate.isAllowed('move_to')).toBe(true);
    expect(gate.isAllowed('attack_nearest')).toBe(true);
    expect(gate.isAllowed('delete_item')).toBe(false);
    expect(gate.isAllowed('spend_currency')).toBe(false);
  });

  it('emergency kill switch halts safe operation', () => {
    EmergencySafety.resetSafety();
    expect(EmergencySafety.isSafe()).toBe(true);
    EmergencySafety.engageKillSwitch();
    expect(EmergencySafety.isSafe()).toBe(false);
    EmergencySafety.resetSafety();
  });
});
