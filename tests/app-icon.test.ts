import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildAppIconSvg, placeMonogram } from '../scripts/generate-app-icons.mjs';

function pngDimensions(bytes: Buffer) {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('Federalist app identity', () => {
  it('builds an outlined F broadside without runtime SVG text', async () => {
    const { default: opentype } = await import('opentype.js');
    const fontPath = new URL(
      '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
      import.meta.url,
    );
    const font = await opentype.load(fileURLToPath(fontPath));
    const svg = buildAppIconSvg(font);

    expect(svg).toContain('data-app-icon="federalist-reader"');
    expect(svg).toContain('data-monogram="F"');
    expect(svg).toContain('<path');
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('filter=');
  });

  it('centers the F between the printer ornaments', async () => {
    const { default: opentype } = await import('opentype.js');
    const fontPath = new URL(
      '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
      import.meta.url,
    );
    const font = await opentype.load(fileURLToPath(fontPath));
    const { bounds } = placeMonogram(font);

    expect((bounds.y1 + bounds.y2) / 2).toBeCloseTo(256, 1);
    expect(bounds.y1).toBeGreaterThan(140);
    expect(bounds.y2).toBeLessThan(372);
  });

  it.each([
    ['apple-touch-icon.png', 180],
    ['icons/icon-192.png', 192],
    ['icons/icon-512.png', 512],
    ['icons/icon-maskable-512.png', 512],
  ])('commits %s at %ipx', async (path, size) => {
    const bytes = await readFile(new URL(`../public/${path}`, import.meta.url));
    expect(pngDimensions(bytes)).toEqual({ width: size, height: size });
  });

  it('declares the standalone manifest and maskable icon', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../public/site.webmanifest', import.meta.url), 'utf8'),
    );

    expect(manifest).toMatchObject({
      name: 'Federalist Reader',
      short_name: 'Federalist',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#e7deca',
      theme_color: '#26231f',
    });
    expect(manifest.icons).toContainEqual(
      expect.objectContaining({ src: '/icons/icon-maskable-512.png', purpose: 'maskable' }),
    );
  });
});
