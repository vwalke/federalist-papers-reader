import { describe, expect, it } from 'vitest';

import { formatAuthorAttribution } from '../src/lib/author-attribution';

describe('author attribution', () => {
  it('identifies a certain author quietly at the end of the companion', () => {
    expect(formatAuthorAttribution('Alexander Hamilton', 'certain')).toBe(
      'Essay by Alexander Hamilton.'
    );
  });

  it('preserves joint authorship wording', () => {
    expect(formatAuthorAttribution('James Madison with Alexander Hamilton', 'joint')).toBe(
      'Essay by James Madison with Alexander Hamilton.'
    );
  });

  it('states disputed authorship without repeating the stored qualifier', () => {
    expect(
      formatAuthorAttribution('James Madison (attribution disputed)', 'disputed')
    ).toBe('Commonly attributed to James Madison; authorship disputed.');
  });
});
