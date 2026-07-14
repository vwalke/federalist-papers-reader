import { describe, expect, it } from 'vitest';

import { getPaperWear } from '../src/lib/paper-wear';

describe('paper wear fingerprints', () => {
  it('gives all 85 papers a stable, unique fingerprint', () => {
    const fingerprints = Array.from({ length: 85 }, (_, index) => getPaperWear(index + 1));

    expect(new Set(fingerprints.map((wear) => wear.id))).toHaveLength(85);
    expect(getPaperWear(51)).toEqual(getPaperWear(51));
  });

  it('keeps edge effects shallow and outside the reading area', () => {
    for (let number = 1; number <= 85; number += 1) {
      const wear = getPaperWear(number);

      expect(wear.edgeDepth).toBeGreaterThanOrEqual(0.15);
      expect(wear.edgeDepth).toBeLessThanOrEqual(0.85);
      expect(wear.creaseOnePosition).toBeGreaterThanOrEqual(1.5);
      expect(wear.creaseOnePosition).toBeLessThanOrEqual(7.5);
      expect(wear.creaseTwoPosition).toBeGreaterThanOrEqual(92.5);
      expect(wear.creaseTwoPosition).toBeLessThanOrEqual(98.5);
      expect(wear.opacity).toBeGreaterThanOrEqual(0.14);
      expect(wear.opacity).toBeLessThanOrEqual(0.32);
    }
  });

  it('rejects numbers outside the collection', () => {
    expect(() => getPaperWear(0)).toThrow(/1 through 85/);
    expect(() => getPaperWear(86)).toThrow(/1 through 85/);
    expect(() => getPaperWear(1.5)).toThrow(/1 through 85/);
  });
});
