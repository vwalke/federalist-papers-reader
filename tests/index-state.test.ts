import { describe, expect, it } from 'vitest';

import {
  selectDebateIndex,
  selectIndexPapers,
  type IndexEssay,
  type IndexPaper
} from '../src/lib/index-state';

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

describe('debate index selection', () => {
  const essays: IndexEssay[] = [
    {
      progressId: 110,
      title: 'On Standing Armies',
      series: 'Brutus',
      publicationDate: '1788-01-24',
      indexSummary: 'Warns that standing armies in peacetime endanger the republic.'
    },
    {
      progressId: 101,
      title: 'To the Citizens of the State of New-York',
      series: 'Brutus',
      publicationDate: '1787-10-18',
      indexSummary: 'The systematic case against consolidation.'
    }
  ];

  it('maps essays into the paper shape with the progressId as the number', () => {
    const brutusOne = selectDebateIndex([], essays)[0];
    expect(brutusOne).toEqual({
      number: 101,
      title: 'To the Citizens of the State of New-York',
      author: 'Brutus',
      publicationDate: '1787-10-18',
      indexSummary: 'The systematic case against consolidation.',
      searchText:
        'To the Citizens of the State of New-York Brutus 1787-10-18 The systematic case against consolidation.'
    });
  });

  it('keeps the synthetic progressId out of the search', () => {
    expect(selectDebateIndex(papers, essays, { query: '101' })).toEqual([]);
    expect(selectDebateIndex(papers, essays, { query: '110' })).toEqual([]);
    expect(
      selectDebateIndex(papers, essays, { query: 'brutus' }).map(({ number }) => number)
    ).toEqual([101, 110]);
  });

  it('forces publication order, so Brutus I precedes Federalist No. 1', () => {
    expect(selectDebateIndex(papers, essays).map(({ number }) => number)).toEqual([101, 1, 2, 110, 51]);
  });

  it('breaks date ties with papers before essays, then series order', () => {
    const sameDayPaper: IndexPaper = {
      number: 37,
      title: 'Concerning Difficulties of the Convention',
      author: 'James Madison',
      publicationDate: '1788-01-24',
      indexSummary: 'Framing is harder than criticizing.'
    };
    const sameDayCato: IndexEssay = {
      progressId: 154,
      title: 'On the Presidency',
      series: 'Cato',
      publicationDate: '1788-01-24',
      indexSummary: 'The executive resembles a king.'
    };
    expect(
      selectDebateIndex([sameDayPaper], [sameDayCato, essays[0]]).map(({ number }) => number)
    ).toEqual([37, 110, 154]);
  });

  it('searches and filters across both collections', () => {
    expect(
      selectDebateIndex(papers, essays, { query: 'standing armies' }).map(({ number }) => number)
    ).toEqual([110]);
    expect(
      selectDebateIndex(papers, essays, { status: 'read', readNumbers: new Set([2, 101]) }).map(
        ({ number }) => number
      )
    ).toEqual([101, 2]);
  });
});
