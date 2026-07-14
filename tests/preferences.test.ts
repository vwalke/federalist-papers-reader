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

  it('recovers from unavailable or malformed storage', () => {
    const brokenStorage = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); }
    } as unknown as Storage;
    const preferences = createPreferences(brokenStorage);

    expect(preferences.getReadingMode()).toBe('gazette');
    expect(preferences.getReadPapers()).toEqual(new Set());
    expect(() => preferences.setPaperRead(1, true)).not.toThrow();
  });

  it('finds the next unread paper and wraps once', () => {
    expect(getNextUnread([1, 2, 3, 4], new Set([1, 2]), 2)).toBe(3);
    expect(getNextUnread([1, 2, 3, 4], new Set([1, 3, 4]), 4)).toBe(2);
    expect(getNextUnread([1, 2], new Set([1, 2]), 1)).toBeNull();
  });
});
