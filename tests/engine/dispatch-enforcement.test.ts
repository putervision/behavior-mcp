import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'crypto';
import {
  verifyIntentionDispatch,
  clearUsedTokensForTest,
} from '../../src/engine/browser/executor-bundle.js';
import { BrowserInjector } from '../../src/engine/browser/injector.js';
import { z } from '../../src/schema/schemas.js';
import { canonicalJsonStringify } from '../../src/utils/canonical-json.js';

describe('Dispatch Token Enforcement & Security', () => {
  const secret = 'test-pentad-hmac-secret-12345';

  beforeEach(() => {
    clearUsedTokensForTest();
  });

  function createValidToken(params: {
    tokenId?: string;
    intentionId?: string;
    behaviorName?: string;
    actionParams?: Record<string, unknown>;
    ttlMs?: number;
    customSecret?: string;
  }) {
    const tokenId = params.tokenId || 'token-001';
    const intentionId = params.intentionId || 'intent-001';
    const behaviorName = params.behaviorName || 'patrol_route';
    const actionParams = params.actionParams || { speed: 1.5 };
    const ttlMs = params.ttlMs ?? 10000;
    const effectiveSecret = params.customSecret || secret;

    const paramsHash = crypto
      .createHash('sha256')
      .update(canonicalJsonStringify(actionParams), 'utf8')
      .digest('hex');

    const now = Date.now();
    const issuedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + ttlMs).toISOString();

    const preimage = `${tokenId}:${intentionId}:${behaviorName}:${paramsHash}:behavior-mcp:${issuedAt}:${expiresAt}`;
    const hmacSignature = crypto
      .createHmac('sha256', effectiveSecret)
      .update(preimage, 'utf8')
      .digest('hex');

    return {
      token: {
        token_id: tokenId,
        intention_id: intentionId,
        behavior_name: behaviorName,
        params_hash: paramsHash,
        aud: 'behavior-mcp' as const,
        issued_at: issuedAt,
        expires_at: expiresAt,
        hmac_signature: hmacSignature,
      },
      intention: {
        id: intentionId,
        behavior_name: behaviorName,
        parameters: actionParams,
      },
    };
  }

  it('validates a properly signed dispatch token', () => {
    const { token, intention } = createValidToken({});
    const valid = verifyIntentionDispatch(intention, token, secret);
    expect(valid).toBe(true);
  });

  it('rejects an expired token', () => {
    const { token, intention } = createValidToken({ ttlMs: -5000 });
    const valid = verifyIntentionDispatch(intention, token, secret);
    expect(valid).toBe(false);
  });

  it('prevents token replay', () => {
    const { token, intention } = createValidToken({ tokenId: 'replay-token-123' });
    const firstCheck = verifyIntentionDispatch(intention, token, secret);
    expect(firstCheck).toBe(true);

    const secondCheck = verifyIntentionDispatch(intention, token, secret);
    expect(secondCheck).toBe(false);
  });

  it('rejects token when parameters do not match params_hash', () => {
    const { token, intention } = createValidToken({ actionParams: { speed: 1.5 } });
    intention.parameters = { speed: 2.5 }; // Tampered params
    const valid = verifyIntentionDispatch(intention, token, secret);
    expect(valid).toBe(false);
  });

  it('rejects token when behavior_name does not match', () => {
    const { token, intention } = createValidToken({ behaviorName: 'patrol_route' });
    intention.behavior_name = 'attack_target';
    const valid = verifyIntentionDispatch(intention, token, secret);
    expect(valid).toBe(false);
  });

  it('rejects token when secret is missing or invalid', () => {
    const { token, intention } = createValidToken({});
    const validWrongSecret = verifyIntentionDispatch(intention, token, 'wrong-secret');
    expect(validWrongSecret).toBe(false);

    const validNoSecret = verifyIntentionDispatch(intention, token, '');
    expect(validNoSecret).toBe(false);
  });

  it('safely escapes tree.id in BrowserInjector to prevent script injection', () => {
    const maliciousTree = {
      id: "malicious'; alert('pwned'); '",
      type: 'action' as const,
      name: 'test_node',
    };
    const script = BrowserInjector.getInjectionScript(maliciousTree);
    expect(script).toContain(JSON.stringify(maliciousTree.id));
    // Verify script parses as valid JavaScript without syntax breakout
    expect(() => new Function(script)).not.toThrow();
  });

  it('filters __proto__, constructor, and prototype in RecordSchema', () => {
    const schema = z.record(z.string());
    const payload = JSON.parse(
      '{"safeKey":"value","__proto__":{"polluted":"yes"},"constructor":"bad"}'
    );
    const parsed = schema.parse(payload);
    expect(parsed.safeKey).toBe('value');
    expect(Object.keys(parsed)).toEqual(['safeKey']);
    expect((parsed as any).polluted).toBeUndefined();
  });
});
