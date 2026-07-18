import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('Federalist Reader X header', () => {
  it('builds the approved crop-aware Gazette Masthead markup', async () => {
    const module = await import('../scripts/generate-x-header.mjs');
    const html = module.headerHtml('/* embedded fonts */');

    expect(html).toContain('data-x-header="federalist-reader"');
    expect(html).toContain('data-safe-top="60"');
    expect(html).toContain('data-safe-bottom="440"');
    expect(html).toContain('data-avatar-safe-x="380"');
    expect(html).toContain('data-avatar-safe-y="330"');
    expect(html).toContain('THE INDEPENDENT JOURNAL');
    expect(html).toContain('OR, THE GENERAL ADVERTISER');
    expect(html).toContain('THE FŒDERALIST');
    expect(html).toContain('All Eighty-Five Essays, Made for Reading Together');
    expect(html).toContain('federalistreader.org');
    expect(html).toContain('PUBLIUS');
    expect(html).not.toContain('linear-gradient');
    expect(html).not.toContain('radial-gradient');
  });

  it('registers a deterministic header generation command', async () => {
    const packageJson = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    );

    expect(packageJson.scripts['generate:x-header']).toBe('node scripts/generate-x-header.mjs');
  });

  it('keeps the bottom content row inset inside the 60-pixel X crop', async () => {
    const { HEADER_LAYOUT } = await import('../scripts/generate-x-header.mjs');

    expect(HEADER_LAYOUT).toBeDefined();
    if (!HEADER_LAYOUT) return;
    expect(HEADER_LAYOUT.height - HEADER_LAYOUT.paddingBottom).toBeLessThanOrEqual(
      HEADER_LAYOUT.safeBottom - 12,
    );
  });

  it('commits the upload-ready header at 1500×500 and below 2 MB', async () => {
    const bytes = await readFile(
      new URL('../public/profile/federalist-reader-x-header.png', import.meta.url),
    );

    expect(pngDimensions(bytes)).toEqual({ width: 1500, height: 500 });
    expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
  });
});
