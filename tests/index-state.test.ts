import { describe, expect, it } from 'vitest';

import { selectIndexPapers, type IndexPaper } from '../src/lib/index-state';

const papers: IndexPaper[] = [
  {
    number: 2,
    title: 'Concerning Dangers from Foreign Force and Influence',
    author: 'John Jay',
    publicationDate: '1787-10-31',
    indexSummary: 'A united country can better resist foreign pressure.'
  },
  {
    number: 51,
    title: 'The Structure of the Government Must Furnish the Proper Checks and Balances',
    author: 'James Madison',
    publicationDate: '1788-02-06',
    indexSummary: 'Ambition must counteract ambition.'
  },
  {
    number: 1,
    title: 'General Introduction',
    author: 'Alexander Hamilton',
    publicationDate: '1787-10-27',
    indexSummary: 'Introduces the ratification debate.'
  }
];

describe('index selection', () => {
  it('searches number, title, author, date, and summary without regard to case', () => {
    expect(selectIndexPapers(papers, { query: '51' }).map(({ number }) => number)).toEqual([51]);
    expect(selectIndexPapers(papers, { query: 'JAY' }).map(({ number }) => number)).toEqual([2]);
    expect(selectIndexPapers(papers, { query: 'foreign pressure' }).map(({ number }) => number)).toEqual([2]);
    expect(selectIndexPapers(papers, { query: '1787-10-27' }).map(({ number }) => number)).toEqual([1]);
  });

  it('sorts by number, author, or date with deterministic ties', () => {
    expect(selectIndexPapers(papers, { sort: 'number' }).map(({ number }) => number)).toEqual([1, 2, 51]);
    expect(selectIndexPapers(papers, { sort: 'author' }).map(({ number }) => number)).toEqual([1, 51, 2]);
    expect(selectIndexPapers(papers, { sort: 'date' }).map(({ number }) => number)).toEqual([1, 2, 51]);
  });

  it('can show only unread papers', () => {
    expect(
      selectIndexPapers(papers, { status: 'unread', readNumbers: new Set([1, 51]) }).map(({ number }) => number)
    ).toEqual([2]);
  });
});
