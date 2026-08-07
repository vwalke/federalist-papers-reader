import { describe, expect, it } from 'vitest';

import {
  essayDisplayName,
  essaySlug,
  getObjectionsForPaper,
  getOrderedEssays,
  progressId,
  type AntifederalistData
} from '../src/lib/antifederalist';

const make = (overrides: Partial<AntifederalistData>): AntifederalistData => ({
  series: 'Brutus',
  seriesNumber: 1,
  publicationDate: '1787-10-18',
  repliesTo: [10],
  ...overrides
});

describe('antifederalist helpers', () => {
  it('builds slugs and display names from series and number', () => {
    expect(essaySlug(make({}))).toBe('brutus-1');
    expect(essaySlug(make({ series: 'Cato', seriesNumber: 4 }))).toBe('cato-4');
    expect(essayDisplayName(make({ seriesNumber: 15 }))).toBe('Brutus No. XV');
    expect(essayDisplayName(make({ series: 'Cato', seriesNumber: 4 }))).toBe('Cato No. IV');
  });

  it('assigns collision-free progress ids per series', () => {
    expect(progressId(make({ seriesNumber: 1 }))).toBe(101);
    expect(progressId(make({ seriesNumber: 15 }))).toBe(115);
    expect(progressId(make({ series: 'Cato', seriesNumber: 4 }))).toBe(154);
  });

  it('orders essays by publication date, then series', () => {
    const essays = [
      make({ series: 'Cato', seriesNumber: 4, publicationDate: '1787-11-08' }),
      make({ seriesNumber: 2, publicationDate: '1787-11-01' }),
      make({ seriesNumber: 1, publicationDate: '1787-10-18' })
    ];
    expect(getOrderedEssays(essays).map(essaySlug)).toEqual(['brutus-1', 'brutus-2', 'cato-4']);
  });

  it('breaks same-date ties by series, then by series number', () => {
    const crossSeries = [
      make({ series: 'Cato', seriesNumber: 3, publicationDate: '1787-11-01' }),
      make({ series: 'Brutus', seriesNumber: 5, publicationDate: '1787-11-01' })
    ];
    expect(getOrderedEssays(crossSeries).map(essaySlug)).toEqual(['brutus-5', 'cato-3']);

    const sameSeries = [
      make({ series: 'Brutus', seriesNumber: 5, publicationDate: '1787-11-15' }),
      make({ series: 'Brutus', seriesNumber: 3, publicationDate: '1787-11-15' })
    ];
    expect(getOrderedEssays(sameSeries).map(essaySlug)).toEqual(['brutus-3', 'brutus-5']);
  });

  it('finds the essays objecting to a Federalist paper', () => {
    const essays = [
      make({ seriesNumber: 12, publicationDate: '1788-02-07', repliesTo: [78] }),
      make({ seriesNumber: 15, publicationDate: '1788-03-20', repliesTo: [78, 81] }),
      make({ series: 'Cato', seriesNumber: 4, publicationDate: '1787-11-08', repliesTo: [67, 68, 69] })
    ];
    expect(getObjectionsForPaper(essays, 78).map(essaySlug)).toEqual(['brutus-12', 'brutus-15']);
    expect(getObjectionsForPaper(essays, 68).map(essaySlug)).toEqual(['cato-4']);
    expect(getObjectionsForPaper(essays, 1)).toEqual([]);
  });
});
