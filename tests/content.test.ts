import { describe, expect, it } from 'vitest';

import { getAdjacentPapers, getOrderedPapers, getPaperByNumber, validatePaperSet } from '../src/lib/papers';

describe('Federalist collection contract', () => {
  it('accepts every number from 1 through 85 exactly once', () => {
    const papers = Array.from({ length: 85 }, (_, index) => ({ number: index + 1 }));

    expect(validatePaperSet(papers)).toEqual({
      valid: true,
      missing: [],
      duplicates: [],
      unexpected: []
    });
  });

  it('reports missing, duplicate, and out-of-range numbers', () => {
    expect(validatePaperSet([{ number: 1 }, { number: 1 }, { number: 3 }, { number: 86 }])).toEqual({
      valid: false,
      missing: expect.arrayContaining([2, 85]),
      duplicates: [1],
      unexpected: [86]
    });
  });
});

describe('paper lookup helpers', () => {
  const papers = [{ number: 3 }, { number: 1 }, { number: 2 }];

  it('orders papers without mutating the source array', () => {
    expect(getOrderedPapers(papers).map(({ number }) => number)).toEqual([1, 2, 3]);
    expect(papers.map(({ number }) => number)).toEqual([3, 1, 2]);
  });

  it('finds a paper by number', () => {
    expect(getPaperByNumber(papers, 2)).toEqual({ number: 2 });
    expect(getPaperByNumber(papers, 85)).toBeUndefined();
  });

  it('returns null at either edge of adjacent navigation', () => {
    expect(getAdjacentPapers(papers, 1)).toEqual({ previous: null, next: { number: 2 } });
    expect(getAdjacentPapers(papers, 3)).toEqual({ previous: { number: 2 }, next: null });
  });
});
