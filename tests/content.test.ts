import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

import { getAdjacentPapers, getOrderedPapers, getPaperByNumber, validatePaperSet } from '../src/lib/papers';
import { validateContentDirectory } from '../scripts/validate-content.mjs';

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

describe('committed content', () => {
  it('contains 85 complete, uniquely numbered papers', async () => {
    const report = await validateContentDirectory(new URL('../src/content/papers/', import.meta.url));

    expect(report.count).toBe(85);
    expect(report.missingNumbers).toEqual([]);
    expect(report.duplicateNumbers).toEqual([]);
    expect(report.missingFields).toEqual([]);
    expect(report.emptyBodies).toEqual([]);
    expect(report.shortSummariesOver18Words).toEqual([]);
    expect(report.unquotedDates).toEqual([]);
    expect(report.commentaryOutsideTarget).toEqual([]);
  });

  it('records Federalist No. 26 in its 1787 publication chronology', async () => {
    const source = await readFile(new URL('../src/content/papers/026.md', import.meta.url), 'utf8');

    expect(source).toContain('publicationDate: "1787-12-22"');
    expect(source).toContain('Saturday, December 22, 1787');
    expect(source).not.toContain('December 22, 1788');
  });
});
