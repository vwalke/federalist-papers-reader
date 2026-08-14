import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  buildMastheadSvg,
  MASTHEADS,
  measureRun,
  NAMEPLATE_MEASURE
} from '../scripts/generate-masthead.mjs';

describe('Masthead artwork', () => {
  it.each(MASTHEADS)(
    'generates vector outlines instead of machine-readable SVG text ($slug)',
    async (masthead) => {
      const { default: opentype } = await import('opentype.js');
      const titleFontPath = new URL(
        '../node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff',
        import.meta.url
      );
      const subtitleFontPath = new URL(
        '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
        import.meta.url
      );
      const titleFont = await opentype.load(fileURLToPath(titleFontPath));
      const subtitleFont = await opentype.load(fileURLToPath(subtitleFontPath));
      const svg = buildMastheadSvg(titleFont, subtitleFont, masthead);

      // Every lockup shares the 1200-unit measure; heights vary per layout
      // (the ornamented two-tier box, the hugged single line, the stack).
      expect(svg).toMatch(/viewBox="0 35 1200 \d+"/);
      expect(svg).toContain(`data-masthead-art="${masthead.slug}"`);
      expect(svg).toContain('<path');
      expect(svg).not.toMatch(/<text/i);

      if (masthead.layout === 'two-tier') {
        // The Federalist lockup keeps its ornamented subtitle row.
        expect(svg).toContain('<line');

        const subtitleLeft = Number(svg.match(/data-subtitle-left="([\d.]+)"/)?.[1]);
        const subtitleRight = Number(svg.match(/data-subtitle-right="([\d.]+)"/)?.[1]);
        const leftAccentEnd = Number(svg.match(/data-left-accent-end="([\d.]+)"/)?.[1]);
        const rightAccentStart = Number(svg.match(/data-right-accent-start="([\d.]+)"/)?.[1]);

        expect(leftAccentEnd).toBeLessThan(subtitleLeft);
        expect(rightAccentStart).toBeGreaterThan(subtitleRight);
      } else {
        // The Journal lockup follows the surviving Greenleaf sheets: one
        // mixed-case line, no ornaments, no rules, no subtitle tier.
        expect(svg).not.toContain('<line');
        expect(svg).not.toContain('data-subtitle-left');

        // Its solved size must fill the shared nameplate measure edge to
        // edge, within ±1%, like every nameplate on the site.
        const size = Number(svg.match(/data-title-size="([\d.]+)"/)?.[1]);
        expect(size).toBeGreaterThan(0);
        const spacing = 2.5 * (size / 60);
        const width = measureRun(titleFont, masthead.titleText, size, spacing);
        expect(Math.abs(width - NAMEPLATE_MEASURE) / NAMEPLATE_MEASURE).toBeLessThan(0.01);
      }
    }
  );

  it('commits the generated asset used by the site', async () => {
    const svg = await readFile(
      new URL('../public/masthead-independent-journal.svg', import.meta.url),
      'utf8'
    );

    expect(svg).toContain('data-masthead-art="independent-journal"');
    expect(svg).not.toMatch(/<text/i);
  });

  it('commits the New-York Journal masthead variant', async () => {
    const svg = await readFile(
      new URL('../public/masthead-new-york-journal.svg', import.meta.url),
      'utf8'
    );
    expect(svg).toContain('data-masthead-art="new-york-journal"');
    expect(svg).not.toMatch(/<text/i);
  });

  it('commits the stacked narrow-viewport Journal lockup', async () => {
    const svg = await readFile(
      new URL('../public/masthead-new-york-journal-stacked.svg', import.meta.url),
      'utf8'
    );
    expect(svg).toContain('data-masthead-art="new-york-journal-stacked"');
    expect(svg).not.toMatch(/<text/i);
    // Two lines drawn as two paths in one group.
    expect(svg.match(/<path/g)).toHaveLength(2);
  });
});
