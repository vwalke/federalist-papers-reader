import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildMastheadSvg } from '../scripts/generate-masthead.mjs';

describe('Independent Journal masthead artwork', () => {
  it('generates vector outlines instead of machine-readable SVG text', async () => {
    const { default: opentype } = await import('opentype.js');
    const fontPath = new URL(
      '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
      import.meta.url
    );
    const font = await opentype.load(fileURLToPath(fontPath));
    const svg = buildMastheadSvg(font);

    expect(svg).toContain('viewBox="0 35 1200 145"');
    expect(svg).toContain('<path');
    expect(svg).toContain('<line');
    expect(svg).not.toContain('<text');

    const subtitleLeft = Number(svg.match(/data-subtitle-left="([\d.]+)"/)?.[1]);
    const subtitleRight = Number(svg.match(/data-subtitle-right="([\d.]+)"/)?.[1]);
    const leftAccentEnd = Number(svg.match(/data-left-accent-end="([\d.]+)"/)?.[1]);
    const rightAccentStart = Number(svg.match(/data-right-accent-start="([\d.]+)"/)?.[1]);

    expect(leftAccentEnd).toBeLessThan(subtitleLeft);
    expect(rightAccentStart).toBeGreaterThan(subtitleRight);
  });

  it('commits the generated asset used by the site', async () => {
    const svg = await readFile(
      new URL('../public/masthead-independent-journal.svg', import.meta.url),
      'utf8'
    );

    expect(svg).toContain('data-masthead-art="independent-journal"');
    expect(svg).not.toContain('<text');
  });
});
