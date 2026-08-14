import { describe, expect, it } from 'vitest';

import debateSequence from '../src/data/debate-sequence.json';
import {
  READING_CONTEXT_KEY,
  findNeighbors,
  normalizePath,
  readGuideContext,
  type SequenceItem
} from '../src/lib/reading-context';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const ITEMS: SequenceItem[] = [
  { href: '/papers/10/', label: 'Federalist No. 10' },
  { href: '/papers/51/', label: 'Federalist No. 51' },
  { href: '/antifederalist/brutus-1/', label: 'Brutus No. I' }
];

describe('normalizePath', () => {
  it('adds the trailing slash directory URLs carry', () => {
    expect(normalizePath('/papers/10')).toBe('/papers/10/');
    expect(normalizePath('/papers/10/')).toBe('/papers/10/');
  });
});

describe('findNeighbors', () => {
  it('walks the sequence in list order', () => {
    expect(findNeighbors(ITEMS, '/papers/51/')).toEqual({
      previous: ITEMS[0],
      next: ITEMS[2]
    });
  });

  it('marks the sequence ends with nulls', () => {
    expect(findNeighbors(ITEMS, '/papers/10/')).toEqual({ previous: null, next: ITEMS[1] });
    expect(findNeighbors(ITEMS, '/antifederalist/brutus-1/')).toEqual({
      previous: ITEMS[1],
      next: null
    });
  });

  it('matches hrefs regardless of trailing slash', () => {
    expect(findNeighbors(ITEMS, '/papers/10')).toEqual({ previous: null, next: ITEMS[1] });
  });

  it('returns null for a page outside the sequence', () => {
    expect(findNeighbors(ITEMS, '/papers/2/')).toBeNull();
  });
});

describe('readGuideContext', () => {
  const CONTEXT = {
    kind: 'guide',
    title: 'The Most Important Federalist Papers',
    home: '/guides/most-important/',
    items: [{ href: '/papers/10/', label: 'Federalist No. 10: The Union as a Safeguard' }]
  };

  it('round-trips a stored journey', () => {
    const storage = new MemoryStorage();
    storage.setItem(READING_CONTEXT_KEY, JSON.stringify(CONTEXT));
    expect(readGuideContext(storage)).toEqual(CONTEXT);
  });

  it('rejects malformed or foreign payloads', () => {
    const storage = new MemoryStorage();
    expect(readGuideContext(storage)).toBeNull();
    expect(readGuideContext(null)).toBeNull();

    for (const bad of [
      'not json',
      '42',
      JSON.stringify({ ...CONTEXT, kind: 'tour' }),
      JSON.stringify({ ...CONTEXT, title: 7 }),
      JSON.stringify({ ...CONTEXT, home: undefined }),
      JSON.stringify({ ...CONTEXT, items: [] }),
      JSON.stringify({ ...CONTEXT, items: [{ href: '/papers/10/' }] })
    ]) {
      storage.setItem(READING_CONTEXT_KEY, bad);
      expect(readGuideContext(storage), bad).toBeNull();
    }
  });
});

describe('the committed debate sequence', () => {
  it('carries all ninety-three items, Brutus I first', () => {
    expect(debateSequence).toHaveLength(93);
    expect(debateSequence[0]).toEqual({
      href: '/antifederalist/brutus-1/',
      label: 'Brutus No. I',
      title: expect.any(String)
    });
    expect(debateSequence[debateSequence.length - 1].label).toBe('Federalist No. 85');
  });

  it('links every item with the site href shapes', () => {
    for (const item of debateSequence) {
      expect(item.href).toMatch(/^\/(papers\/\d{1,2}|antifederalist\/(brutus|cato)-\d{1,2})\/$/);
      expect(item.label).toMatch(/^(Federalist No\. \d{1,2}|(Brutus|Cato) No\. [IVX]+)$/);
      expect(item.title.length).toBeGreaterThan(0);
    }
    expect(new Set(debateSequence.map((item) => item.href)).size).toBe(93);
    expect(debateSequence.filter((item) => item.href.startsWith('/papers/'))).toHaveLength(85);
  });

  it('keeps the interleave the home ledger promises: Fed 2, then Brutus II, then Fed 3', () => {
    const hrefs = debateSequence.map((item) => item.href);
    expect(hrefs.indexOf('/antifederalist/brutus-2/')).toBe(hrefs.indexOf('/papers/2/') + 1);
    expect(hrefs.indexOf('/papers/3/')).toBe(hrefs.indexOf('/antifederalist/brutus-2/') + 1);
  });
});
