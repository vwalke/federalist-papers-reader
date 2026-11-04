import { describe, expect, it } from 'vitest';

import { TURNSTILE_TEST_SITE_KEY, turnstileSiteKey } from '../src/lib/turnstile';

describe('Turnstile site key', () => {
  it('uses the configured key, trimmed', () => {
    expect(turnstileSiteKey('  0x4AAAAAAAexample  ', 'main')).toBe('0x4AAAAAAAexample');
  });

  it('falls back to the always-passes test key outside production', () => {
    expect(turnstileSiteKey(undefined, undefined)).toBe(TURNSTILE_TEST_SITE_KEY);
    expect(turnstileSiteKey('   ', 'fix/some-branch')).toBe(TURNSTILE_TEST_SITE_KEY);
  });

  it('fails the production Pages build rather than ship the test key', () => {
    expect(() => turnstileSiteKey(undefined, 'main')).toThrow(/PUBLIC_TURNSTILE_SITE_KEY/);
  });
});
