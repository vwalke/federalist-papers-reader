import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildMastheadSvg, MASTHEADS, measureRun } from '../scripts/generate-masthead.mjs';

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

      expect(svg).toContain('viewBox="0 35 1200 145"');
      expect(svg).toContain(`data-masthead-art="${masthead.slug}"`);
      expect(svg).toContain('<path');
      expect(svg).toContain('<line');
      expect(svg).not.toMatch(/<text/i);

      const subtitleLeft = Number(svg.match(/data-subtitle-left="([\d.]+)"/)?.[1]);
      const subtitleRight = Number(svg.match(/data-subtitle-right="([\d.]+)"/)?.[1]);
      const leftAccentEnd = Number(svg.match(/data-left-accent-end="([\d.]+)"/)?.[1]);
      const rightAccentStart = Number(svg.match(/data-right-accent-start="([\d.]+)"/)?.[1]);

      expect(leftAccentEnd).toBeLessThan(subtitleLeft);
      expect(rightAccentStart).toBeGreaterThan(subtitleRight);

      // Every masthead's title run must fill the nameplate edge-to-edge like
      // the Independent Journal's does — within ±1% of its measured width —
      // so a shorter/narrower title never under-fills the measure.
      if (masthead.slug !== 'independent-journal') {
        const referenceMasthead = MASTHEADS.find((entry) => entry.slug === 'independent-journal');
        if (!referenceMasthead) throw new Error('independent-journal masthead config not found');
        const referenceWidth = measureRun(
          titleFont,
          referenceMasthead.titleText,
          referenceMasthead.titleSize,
          referenceMasthead.titleSpacing
        );
        const thisWidth = measureRun(
          titleFont,
          masthead.titleText,
          masthead.titleSize,
          masthead.titleSpacing
        );

        expect(Math.abs(thisWidth - referenceWidth) / referenceWidth).toBeLessThan(0.01);
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
});
