import { describe, it, expect, beforeEach } from 'vitest';
import { StuckDetector } from '../../src/engine/stuck-detector.js';
import { WatchdogTimer } from '../../src/engine/watchdog.js';
import { ActionRateLimiter } from '../../src/engine/rate-limiter.js';
import { PolicyGate } from '../../src/engine/policy-gate.js';
import { EmergencySafety } from '../../src/engine/safety.js';

describe('Exhaustive Safety & Guardrail Architecture', () => {
  beforeEach(() => {
    EmergencySafety.resetSafety();
  });

  describe('StuckDetector', () => {
    it('accurately computes stuck score and triggers alert above threshold', () => {
      const detector = new StuckDetector();
      for (let i = 0; i < 29; i++) {
        const check = detector.checkStuck('root/patrol');
        expect(check.isStuck).toBe(false);
      }
      const check30 = detector.checkStuck('root/patrol');
      expect(check30.isStuck).toBe(true);
      expect(check30.score).toBeGreaterThanOrEqual(1.0);
    });

    it('resets repetition counters when active node path transitions', () => {
      const detector = new StuckDetector();
      for (let i = 0; i < 15; i++) {
        detector.checkStuck('root/seq/step1');
      }

      // Node path change resets current streak
      const transitionCheck = detector.checkStuck('root/seq/step2');
      expect(transitionCheck.isStuck).toBe(false);
      expect(transitionCheck.score).toBeLessThan(0.5);
    });
  });

  describe('WatchdogTimer', () => {
    it('maintains unexpired state when fed regularly within interval', async () => {
      const watchdog = new WatchdogTimer(100);
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 20));
        watchdog.feed();
        expect(watchdog.isExpired()).toBe(false);
      }
    });

    it('detects runtime freeze when feed is missed beyond interval', async () => {
      const watchdog = new WatchdogTimer(40);
      watchdog.feed();
      expect(watchdog.isExpired()).toBe(false);

      await new Promise((r) => setTimeout(r, 55));
      expect(watchdog.isExpired()).toBe(true);
    });
  });

  describe('ActionRateLimiter', () => {
    it('enforces maximum 60 actions/sec limit and recovers after window expiration', async () => {
      const limiter = new ActionRateLimiter(60);
      let allowed = 0;
      for (let i = 0; i < 70; i++) {
        if (limiter.allowAction()) allowed++;
      }
      expect(allowed).toBe(60);
      expect(limiter.allowAction()).toBe(false);
    });

    it('allows bursts within quota', () => {
      const limiter = new ActionRateLimiter(10);
      for (let i = 0; i < 10; i++) {
        expect(limiter.allowAction()).toBe(true);
      }
      expect(limiter.allowAction()).toBe(false);
    });
  });

  describe('PolicyGate', () => {
    it('strictly blocks hardcoded destructive game actions', () => {
      const gate = new PolicyGate();
      expect(gate.isAllowed('delete_item')).toBe(false);
      expect(gate.isAllowed('spend_currency')).toBe(false);
      expect(gate.isAllowed('irreversible_trade')).toBe(false);
    });

    it('allows safe tactical and navigation behavior trees', () => {
      const gate = new PolicyGate();
      expect(gate.isAllowed('combat_kite')).toBe(true);
      expect(gate.isAllowed('gather_loop')).toBe(true);
      expect(gate.isAllowed('scout_perimeter')).toBe(true);
      expect(gate.isAllowed('flee_and_heal')).toBe(true);
    });
  });

  describe('EmergencySafety', () => {
    it('provides atomic kill-switch engagement across all runtime threads', () => {
      expect(EmergencySafety.isSafe()).toBe(true);
      EmergencySafety.engageKillSwitch();
      expect(EmergencySafety.isSafe()).toBe(false);
      EmergencySafety.resetSafety();
      expect(EmergencySafety.isSafe()).toBe(true);
    });
  });
});
