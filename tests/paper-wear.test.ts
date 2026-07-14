import { describe, expect, it } from 'vitest';

import { getPaperWear } from '../src/lib/paper-wear';

describe('paper wear fingerprints', () => {
  it('gives all 85 papers stable, unique archival surfaces', () => {
    const surfaces = Array.from({ length: 85 }, (_, index) => getPaperWear(index + 1));

    expect(new Set(surfaces.map((wear) => wear.id))).toHaveLength(85);
    expect(new Set(surfaces.map((wear) => wear.foldSignature))).toHaveLength(85);
    expect(getPaperWear(51)).toEqual(getPaperWear(51));
  });

  it('generates soft fold paths and restrained surface tones', () => {
    for (let number = 1; number <= 85; number += 1) {
      const wear = getPaperWear(number);

      expect(wear.folds).toHaveLength(3);
      expect(wear.folds.every((fold) => /^M [\d.-]+ [\d.-]+ C /.test(fold.path))).toBe(true);
      expect(wear.folds.every((fold) => !fold.path.includes('NaN'))).toBe(true);
      expect(wear.folds.every((fold) => fold.opacity >= 0.12 && fold.opacity <= 0.3)).toBe(true);
      expect(wear.opacity).toBeGreaterThanOrEqual(0.42);
      expect(wear.opacity).toBeLessThanOrEqual(0.7);
      expect(wear.grainFrequency).toBeGreaterThanOrEqual(0.58);
      expect(wear.grainFrequency).toBeLessThanOrEqual(0.82);
    }
  });

  it('keeps abrasions near the sheet edges and never removes page area', () => {
    for (let number = 1; number <= 85; number += 1) {
      const wear = getPaperWear(number);

      expect(wear.abrasions.length).toBeGreaterThanOrEqual(5);
      expect(
        wear.abrasions.every(({ x, y }) => x <= 3.5 || x >= 96.5 || y <= 2.5 || y >= 97.5)
      ).toBe(true);
      expect(wear).not.toHaveProperty('edgeDepth');
      expect(wear).not.toHaveProperty('nickOnePosition');
    }
  });

  it('rejects numbers outside the collection', () => {
    expect(() => getPaperWear(0)).toThrow(/1 through 85/);
    expect(() => getPaperWear(86)).toThrow(/1 through 85/);
    expect(() => getPaperWear(1.5)).toThrow(/1 through 85/);
  });
});
