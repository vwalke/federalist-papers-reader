import { access } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import manifest from '../src/data/printings-images.json';
import { getPrintingForPaper, printingImagePath, printings } from '../src/data/printings';

describe('printings data', () => {
  it('matches the generated image manifest exactly', () => {
    expect(printings.map((printing) => printing.slug).sort()).toEqual(
      Object.keys(manifest).sort()
    );
    for (const printing of printings) {
      expect(printing.pages.length).toBeGreaterThan(0);
      expect(printing.pages.map((page) => page.page)).toEqual(
        printing.pages.map((_, index) => index + 1)
      );
    }
  });

  it('has every derivative image on disk', async () => {
    for (const printing of printings) {
      for (const page of printing.pages) {
        for (const variant of ['thumb', 'large'] as const) {
          for (const format of ['jpg', 'avif'] as const) {
            const path = printingImagePath(printing, page.page, variant, format);
            await expect(
              access(new URL(`../public${path}`, import.meta.url)),
              `missing ${path}`
            ).resolves.toBeUndefined();
          }
        }
      }
    }
  });

  it('carries real dimensions and distinct alt text', () => {
    for (const printing of printings) {
      const alts = new Set(printing.pages.map((page) => page.alt));
      expect(alts.size).toBe(printing.pages.length);
      for (const page of printing.pages) {
        expect(page.alt.length).toBeGreaterThan(20);
        expect(page.thumb.w).toBeGreaterThan(0);
        expect(page.large.w).toBeGreaterThan(page.thumb.w);
      }
    }
  });

  it('maps papers 2 and 85 to printings, ordered Federalist-first', () => {
    expect(getPrintingForPaper(2)?.slug).toBe('federalist-2-pennsylvania-journal');
    expect(getPrintingForPaper(85)?.slug).toBe('federalist-85-new-york-packet');
    expect(getPrintingForPaper(1)).toBeUndefined();
    expect(getPrintingForPaper(51)).toBeUndefined();

    const federalist = printings.filter((printing) => printing.paperNumber !== null);
    expect(federalist.map((printing) => printing.paperNumber)).toEqual([2, 85]);
    expect(printings.findIndex((printing) => printing.paperNumber === null)).toBeGreaterThan(
      printings.findLastIndex((printing) => printing.paperNumber !== null)
    );
  });

  it('credits the Rubenstein collection on both Federalist printings only', () => {
    expect(
      printings.filter((printing) => printing.rubenstein).map((printing) => printing.slug)
    ).toEqual(['federalist-2-pennsylvania-journal', 'federalist-85-new-york-packet']);
  });
});
