import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyIntentionDispatch } from '../../src/engine/browser/executor-bundle.js';
import { DispatchToken } from '../../src/schema/types.js';

interface Intention {
  id: string;
  project?: string;
  behavior_name: string;
  parameters?: Record<string, unknown>;
  priority?: number;
  status?: string;
}

describe('Behavior-MCP DispatchToken HMAC Verification', () => {
  const secret = 'pentad_hmac_secret_key_for_testing_0123456789!';

  const sampleIntention: Intention = {
    id: 'intent_123',
    project: 'test_project',
    behavior_name: 'test_behavior',
    parameters: { speed: 1.0 },
    priority: 1,
    status: 'pending',
  };

  const createValidToken = (overrides: Partial<DispatchToken> = {}): DispatchToken => {
    const now = Date.now();
    const issuedAt = new Date(now).toISOString();
    const expiresAt = new Date(now + 30000).toISOString();
    const paramsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ speed: 1.0 }))
      .digest('hex');

    const tokenId = 'tok_001';
    const intentionId = overrides.intention_id || sampleIntention.id;
    const behaviorName = overrides.behavior_name || sampleIntention.behavior_name;
    const aud = overrides.aud || 'behavior-mcp';

    const preimage = `${tokenId}:${intentionId}:${behaviorName}:${paramsHash}:${aud}:${issuedAt}:${expiresAt}`;
    const hmacSignature = crypto.createHmac('sha256', secret).update(preimage).digest('hex');

    return {
      token_id: tokenId,
      intention_id: intentionId,
      behavior_name: behaviorName,
      params_hash: paramsHash,
      aud: aud as 'behavior-mcp',
      issued_at: issuedAt,
      expires_at: expiresAt,
      hmac_signature: hmacSignature,
      ...overrides,
    };
  };

  it('accepts valid token signed with matching secret', () => {
    const token = createValidToken();
    const isValid = verifyIntentionDispatch(sampleIntention, token, secret);
    expect(isValid).toBe(true);
  });

  it('rejects token with wrong audience', () => {
    const token = createValidToken({ aud: 'wrong-audience' as any });
    const isValid = verifyIntentionDispatch(sampleIntention, token, secret);
    expect(isValid).toBe(false);
  });

  it('rejects token for different intention_id', () => {
    const token = createValidToken({ intention_id: 'other_intent_456' });
    const isValid = verifyIntentionDispatch(sampleIntention, token, secret);
    expect(isValid).toBe(false);
  });

  it('tolerates minor clock skew within ±2000ms window', () => {
    const now = Date.now();
    // Issued 1500ms in the future (within 2000ms clock skew tolerance)
    const futureIssued = new Date(now + 1500).toISOString();
    const expiresAt = new Date(now + 30000).toISOString();
    const paramsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ speed: 1.0 }))
      .digest('hex');

    const preimage = `tok_skew:${sampleIntention.id}:${sampleIntention.behavior_name}:${paramsHash}:behavior-mcp:${futureIssued}:${expiresAt}`;
    const hmacSignature = crypto.createHmac('sha256', secret).update(preimage).digest('hex');

    const token: DispatchToken = {
      token_id: 'tok_skew',
      intention_id: sampleIntention.id,
      behavior_name: sampleIntention.behavior_name,
      params_hash: paramsHash,
      aud: 'behavior-mcp',
      issued_at: futureIssued,
      expires_at: expiresAt,
      hmac_signature: hmacSignature,
    };

    expect(verifyIntentionDispatch(sampleIntention, token, secret)).toBe(true);
  });

  it('rejects expired token outside clock skew window (>2000ms past expires_at)', () => {
    const now = Date.now();
    const issuedAt = new Date(now - 60000).toISOString();
    const expiresAt = new Date(now - 5000).toISOString(); // Expired 5s ago
    const paramsHash = crypto
      .createHash('sha256')
      .update(JSON.stringify({ speed: 1.0 }))
      .digest('hex');

    const preimage = `tok_exp:${sampleIntention.id}:${sampleIntention.behavior_name}:${paramsHash}:behavior-mcp:${issuedAt}:${expiresAt}`;
    const hmacSignature = crypto.createHmac('sha256', secret).update(preimage).digest('hex');

    const token: DispatchToken = {
      token_id: 'tok_exp',
      intention_id: sampleIntention.id,
      behavior_name: sampleIntention.behavior_name,
      params_hash: paramsHash,
      aud: 'behavior-mcp',
      issued_at: issuedAt,
      expires_at: expiresAt,
      hmac_signature: hmacSignature,
    };

    expect(verifyIntentionDispatch(sampleIntention, token, secret)).toBe(false);
  });

  it('safely rejects tampered signature buffer lengths without throwing RangeError', () => {
    const token = createValidToken({ hmac_signature: 'deadbeef' }); // Short signature
    expect(() => verifyIntentionDispatch(sampleIntention, token, secret)).not.toThrow();
    expect(verifyIntentionDispatch(sampleIntention, token, secret)).toBe(false);
  });

  it('fails closed when secret is empty', () => {
    const token = createValidToken();
    expect(verifyIntentionDispatch(sampleIntention, token, '')).toBe(false);
  });
});
