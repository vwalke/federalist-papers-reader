// workers/post/test/tokens.test.ts
import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../src/tokens';

const ENV_SECRET = 'env-secret';
const SUB_SECRET = 'per-subscriber';

describe('tokens', () => {
  it('round-trips a valid token', async () => {
    const token = await signToken(42, 'manage', ENV_SECRET, SUB_SECRET);
    const parsed = await verifyToken(token, 'manage', ENV_SECRET, async () => SUB_SECRET);
    expect(parsed).toBe(42);
  });

  it('rejects a tampered signature', async () => {
    const token = await signToken(42, 'manage', ENV_SECRET, SUB_SECRET);
    const bad = token.slice(0, -2) + 'xx';
    expect(await verifyToken(bad, 'manage', ENV_SECRET, async () => SUB_SECRET)).toBeNull();
  });

  it('rejects the wrong purpose', async () => {
    const token = await signToken(42, 'unsub', ENV_SECRET, SUB_SECRET);
    expect(await verifyToken(token, 'manage', ENV_SECRET, async () => SUB_SECRET)).toBeNull();
  });

  it('rejects after the subscriber secret rotates (revocation)', async () => {
    const token = await signToken(42, 'manage', ENV_SECRET, SUB_SECRET);
    expect(await verifyToken(token, 'manage', ENV_SECRET, async () => 'rotated')).toBeNull();
  });

  it('rejects garbage without throwing', async () => {
    expect(await verifyToken('not-a-token', 'manage', ENV_SECRET, async () => SUB_SECRET)).toBeNull();
    expect(await verifyToken('9.manage', 'manage', ENV_SECRET, async () => null)).toBeNull();
  });
});
