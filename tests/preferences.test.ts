import { describe, expect, it } from 'vitest';

import { createPreferences, getNextUnread } from '../src/lib/preferences';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe('browser-only reading preferences', () => {
  it('persists a preferred mode and valid read numbers', () => {
    const storage = new MemoryStorage();
    const preferences = createPreferences(storage);

    preferences.setReadingMode('reader');
    preferences.setPaperRead(1, true);
    preferences.setPaperRead(51, true);

    expect(preferences.getReadingMode()).toBe('reader');
    expect([...preferences.getReadPapers()]).toEqual([1, 51]);
    expect(preferences.isPaperRead(51)).toBe(true);
  });

  it('persists only the known text scale steps', () => {
    const storage = new MemoryStorage();
    const preferences = createPreferences(storage);

    expect(preferences.getTextScale()).toBe(1);

    preferences.setTextScale(1.25);
    expect(preferences.getTextScale()).toBe(1.25);

    preferences.setTextScale(3);
    expect(preferences.getTextScale()).toBe(1.25);

    storage.setItem('publius:text-scale', 'enormous');
    expect(preferences.getTextScale()).toBe(1);
  });

  it('recovers from unavailable or malformed storage', () => {
    const brokenStorage = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); }
    } as unknown as Storage;
    const preferences = createPreferences(brokenStorage);

    expect(preferences.getReadingMode()).toBe('gazette');
    expect(preferences.getReadPapers()).toEqual(new Set());
    expect(preferences.getTextScale()).toBe(1);
    expect(() => preferences.setPaperRead(1, true)).not.toThrow();
    expect(() => preferences.setTextScale(1.25)).not.toThrow();
  });

  it('finds the next unread paper and wraps once', () => {
    expect(getNextUnread([1, 2, 3, 4], new Set([1, 2]), 2)).toBe(3);
    expect(getNextUnread([1, 2, 3, 4], new Set([1, 3, 4]), 4)).toBe(2);
    expect(getNextUnread([1, 2], new Set([1, 2]), 1)).toBeNull();
  });

  it('honors the caller-given reading order for the Journal shelf', () => {
    /* The shelf passes PUBLICATION order, where Cato IV (154) sits between
       Brutus II (102) and Brutus IV (104). A numeric sort here would skip
       Cato — this pins the reading-order contract. */
    const shelfOrder = [101, 102, 154, 104, 106, 110, 112, 115];
    expect(getNextUnread(shelfOrder, new Set([101, 102]))).toBe(154);
    expect(getNextUnread(shelfOrder, new Set([101, 102, 154]))).toBe(104);
    expect(getNextUnread(shelfOrder, new Set(shelfOrder))).toBeNull();
  });

  it('accepts Anti-Federalist progress ids (Brutus 100+n, Cato 150+n)', () => {
    const storage = new MemoryStorage();
    const preferences = createPreferences(storage);

    preferences.setPaperRead(101, true);
    preferences.setPaperRead(154, true);

    expect(preferences.isPaperRead(101)).toBe(true);
    expect(preferences.isPaperRead(154)).toBe(true);
    expect([...preferences.getReadPapers()]).toContain(101);
    expect([...preferences.getReadPapers()]).toContain(154);
  });

  it('rejects ids outside the Publius/Brutus/Cato ranges and non-integers', () => {
    const storage = new MemoryStorage();
    const preferences = createPreferences(storage);
    const invalidIds = [0, 86, 100, 117, 150, 167, 101.5];

    for (const id of invalidIds) {
      expect(preferences.isPaperRead(id)).toBe(false);

      preferences.setPaperRead(id, true);
      expect(preferences.isPaperRead(id)).toBe(false);
    }

    storage.setItem('publius:read-papers', JSON.stringify([...invalidIds, 1, 101]));
    expect([...preferences.getReadPapers()]).toEqual([1, 101]);
  });
});
