import { access } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import manifest from '../src/data/printings-images.json';
import {
  formatPaperNumbers,
  getPrintingForPaper,
  printingAnchor,
  printingImagePath,
  printings
} from '../src/data/printings';

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

  it('carries real dimensions, labels, and distinct alt text', () => {
    for (const printing of printings) {
      const alts = new Set(printing.pages.map((page) => page.alt));
      expect(alts.size).toBe(printing.pages.length);
      for (const page of printing.pages) {
        expect(page.alt.length).toBeGreaterThan(20);
        expect(page.label.length).toBeGreaterThan(0);
        expect(page.thumb.w).toBeGreaterThan(0);
        expect(page.large.w).toBeGreaterThan(page.thumb.w);
      }
    }
  });

  it('maps essays to printings, ordered Federalist-first by number', () => {
    expect(getPrintingForPaper(1)?.slug).toBe('federalist-1-pennsylvania-journal');
    expect(getPrintingForPaper(2)?.slug).toBe('federalist-2-pennsylvania-journal');
    expect(getPrintingForPaper(7)?.slug).toBe('federalist-7-8-new-york-packet');
    expect(getPrintingForPaper(8)?.slug).toBe('federalist-7-8-new-york-packet');
    expect(getPrintingForPaper(13)?.slug).toBe('federalist-13-massachusetts-centinel');
    expect(getPrintingForPaper(85)?.slug).toBe('federalist-85-new-york-packet');
    expect(getPrintingForPaper(51)).toBeUndefined();

    const federalist = printings.filter((printing) => printing.paperNumbers.length > 0);
    expect(federalist.flatMap((printing) => printing.paperNumbers)).toEqual([1, 2, 7, 8, 13, 85]);
    expect(printings.findIndex((printing) => printing.paperNumbers.length === 0)).toBeGreaterThan(
      printings.findLastIndex((printing) => printing.paperNumbers.length > 0)
    );
  });

  it('formats anchors and number labels for single and paired essays', () => {
    const pair = getPrintingForPaper(7)!;
    expect(printingAnchor(pair)).toBe('federalist-7-8');
    expect(formatPaperNumbers(pair)).toBe('Nos. 7 & 8');
    const single = getPrintingForPaper(85)!;
    expect(printingAnchor(single)).toBe('federalist-85');
    expect(formatPaperNumbers(single)).toBe('No. 85');
    expect(printingAnchor(printings.find((p) => p.slug === 'new-haven-gazette-1787')!)).toBe(
      'new-haven-gazette-1787'
    );
  });

  it("follows Seth's corrected credit table", () => {
    const credits = Object.fromEntries(
      printings.map((printing) => [printing.inventory, printing.credit])
    );
    expect(credits).toEqual({
      '27488': 'Collection of David M. Rubenstein.',
      '22899.44': 'Collection of David M. Rubenstein.',
      '26169': 'Collection of David M. Rubenstein.',
      '26566': 'Now at the Peoria Riverfront Museum.',
      '24854': 'Collection of David M. Rubenstein.',
      '25030': undefined,
      '30282': undefined
    });
  });
});
