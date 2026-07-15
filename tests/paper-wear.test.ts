import { describe, expect, it } from 'vitest';

import { getPaperWear } from '../src/lib/paper-wear';

const EDGE_SIDES = ['top', 'right', 'bottom', 'left'] as const;
const CORNERS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const;

describe('paper wear fingerprints', () => {
  it('gives all 85 papers stable, unique archival surfaces', () => {
    const surfaces = Array.from({ length: 85 }, (_, index) => getPaperWear(index + 1));

    expect(new Set(surfaces.map((wear) => wear.signature))).toHaveLength(85);
    expect(getPaperWear(51)).toEqual(getPaperWear(51));
  });

  it('builds a seamless shallow deckle tile for every edge', () => {
    for (let number = 1; number <= 85; number += 1) {
      const wear = getPaperWear(number);

      expect(wear.edges.map((edge) => edge.side)).toEqual([...EDGE_SIDES]);
      for (const edge of wear.edges) {
        expect(edge.tileLength).toBeGreaterThanOrEqual(340);
        expect(edge.tileLength).toBeLessThanOrEqual(520);
        expect(edge.depth).toBeGreaterThanOrEqual(2);
        expect(edge.depth).toBeLessThanOrEqual(8);
        expect(edge.depths.length).toBeGreaterThanOrEqual(24);
        expect(edge.depths.at(0)).toBeCloseTo(edge.depths.at(-1) ?? Number.NaN, 5);
        expect(edge.depths.every((depth) => depth >= 0.3 && depth <= edge.depth)).toBe(true);
        expect(edge.path.startsWith('M ')).toBe(true);
        expect(edge.path.endsWith(' Z')).toBe(true);
        expect(edge.path).not.toContain('NaN');
      }
    }
  });

  it('keeps nicks tiny, discrete, and away from the corners', () => {
    for (let number = 1; number <= 85; number += 1) {
      const wear = getPaperWear(number);

      expect(wear.nicks.length).toBeGreaterThanOrEqual(2);
      expect(wear.nicks.length).toBeLessThanOrEqual(4);
      for (const nick of wear.nicks) {
        expect(EDGE_SIDES).toContain(nick.side);
        expect(nick.offset).toBeGreaterThanOrEqual(8);
        expect(nick.offset).toBeLessThanOrEqual(92);
        expect(nick.width).toBeGreaterThanOrEqual(18);
        expect(nick.width).toBeLessThanOrEqual(44);
        expect(nick.depth).toBeGreaterThanOrEqual(4);
        expect(nick.depth).toBeLessThanOrEqual(9);
        expect(nick.path).not.toContain('NaN');
      }
    }
  });

  it('anchors creases inside the gutters and padding zones', () => {
    for (let number = 1; number <= 85; number += 1) {
      const wear = getPaperWear(number);

      expect(wear.creases.length).toBeGreaterThanOrEqual(1);
      expect(wear.creases.length).toBeLessThanOrEqual(2);
      const vertical = wear.creases.filter((crease) => crease.orientation === 'vertical');
      expect(vertical).toHaveLength(1);

      for (const crease of wear.creases) {
        if (crease.orientation === 'vertical') {
          expect(['left', 'right']).toContain(crease.anchor);
          expect(crease.offset).toBeGreaterThanOrEqual(14);
          expect(crease.offset).toBeLessThanOrEqual(30);
        } else {
          expect(['top', 'bottom']).toContain(crease.anchor);
          if (crease.anchor === 'top') {
            expect(crease.offset).toBeGreaterThanOrEqual(60);
            expect(crease.offset).toBeLessThanOrEqual(140);
          } else {
            expect(crease.offset).toBeGreaterThanOrEqual(30);
            expect(crease.offset).toBeLessThanOrEqual(90);
          }
        }
        expect(Math.abs(crease.skew)).toBeLessThanOrEqual(1.5);
        expect(crease.shadowAlpha).toBeGreaterThanOrEqual(0.03);
        expect(crease.shadowAlpha).toBeLessThanOrEqual(0.07);
        expect(crease.lightAlpha).toBeGreaterThanOrEqual(0.12);
        expect(crease.lightAlpha).toBeLessThanOrEqual(0.34);
        expect(crease.reach).toBeGreaterThanOrEqual(8);
        expect(crease.reach).toBeLessThanOrEqual(16);
      }
    }
  });

  it('lifts one corner gently and softens the rest', () => {
    for (let number = 1; number <= 85; number += 1) {
      const wear = getPaperWear(number);

      expect(CORNERS).toContain(wear.cornerFold.corner);
      expect(wear.cornerFold.size).toBeGreaterThanOrEqual(64);
      expect(wear.cornerFold.size).toBeLessThanOrEqual(120);
      expect(wear.cornerFold.liftAlpha).toBeGreaterThanOrEqual(0.1);
      expect(wear.cornerFold.liftAlpha).toBeLessThanOrEqual(0.3);

      expect(wear.cornerSofteners.length).toBeGreaterThanOrEqual(2);
      expect(wear.cornerSofteners.length).toBeLessThanOrEqual(3);
      const chipCorners = wear.cornerSofteners.map((chip) => chip.corner);
      expect(new Set(chipCorners)).toHaveLength(chipCorners.length);
      for (const chip of wear.cornerSofteners) {
        expect(chip.corner).not.toBe(wear.cornerFold.corner);
        expect(chip.size).toBeGreaterThanOrEqual(6);
        expect(chip.size).toBeLessThanOrEqual(14);
        expect(chip.path).not.toContain('NaN');
      }
    }
  });

  it('carries no painted-on grime from earlier attempts', () => {
    const wear = getPaperWear(12);

    expect(wear).not.toHaveProperty('stains');
    expect(wear).not.toHaveProperty('abrasions');
    expect(wear).not.toHaveProperty('folds');
    expect(wear).not.toHaveProperty('grainSeed');
  });

  it('rejects numbers outside the collection', () => {
    expect(() => getPaperWear(0)).toThrow(/1 through 85/);
    expect(() => getPaperWear(86)).toThrow(/1 through 85/);
    expect(() => getPaperWear(1.5)).toThrow(/1 through 85/);
  });
});
