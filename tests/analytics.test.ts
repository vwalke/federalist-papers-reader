import { describe, expect, it } from 'vitest';

import { createCloudflareBeaconData } from '../src/lib/analytics';

const VALID_TOKEN = '0123456789abcdef0123456789abcdef';

describe('Cloudflare Web Analytics configuration', () => {
  it('stays disabled outside production', () => {
    expect(createCloudflareBeaconData(false, VALID_TOKEN)).toBeUndefined();
  });

  it('stays disabled when production configuration is missing or invalid', () => {
    expect(createCloudflareBeaconData(true, undefined)).toBeUndefined();
    expect(createCloudflareBeaconData(true, '   ')).toBeUndefined();
    expect(createCloudflareBeaconData(true, 'not a valid token')).toBeUndefined();
  });

  it('trims and serializes a valid production site token', () => {
    expect(createCloudflareBeaconData(true, `  ${VALID_TOKEN}  `)).toBe(
      `{"token":"${VALID_TOKEN}"}`,
    );
  });
});
