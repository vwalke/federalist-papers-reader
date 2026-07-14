import { describe, expect, it } from 'vitest';

import { formatIssueDateline, toRomanNumeral } from '../src/lib/paper-display';

describe('paper display helpers', () => {
  it('formats every supported paper number as an uppercase Roman numeral', () => {
    expect(toRomanNumeral(1)).toBe('I');
    expect(toRomanNumeral(10)).toBe('X');
    expect(toRomanNumeral(51)).toBe('LI');
    expect(toRomanNumeral(85)).toBe('LXXXV');
    expect(() => toRomanNumeral(0)).toThrow(/1 through 85/);
    expect(() => toRomanNumeral(86)).toThrow(/1 through 85/);
  });

  it('formats newspaper dates as New-York issue lines', () => {
    expect(formatIssueDateline('1787-10-27', 'newspaper')).toBe(
      'New-York, Saturday, October 27, 1787'
    );
  });

  it('labels first publication in the bound edition honestly', () => {
    expect(formatIssueDateline('1788-05-28', 'book')).toBe(
      'New-York · First collected May 28, 1788'
    );
  });
});
