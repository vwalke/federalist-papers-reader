const ROMAN_NUMERALS = [
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I']
] as const;

export function toRomanNumeral(number: number) {
  if (!Number.isInteger(number) || number < 1 || number > 85) {
    throw new RangeError('Paper number must be an integer from 1 through 85.');
  }

  let remaining = number;
  let result = '';

  for (const [value, glyph] of ROMAN_NUMERALS) {
    while (remaining >= value) {
      result += glyph;
      remaining -= value;
    }
  }

  return result;
}

export function formatIssueDateline(
  publicationDate: string,
  publicationKind: 'newspaper' | 'book'
) {
  const date = new Date(`${publicationDate}T12:00:00Z`);
  const monthDayYear = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(date);

  if (publicationKind === 'book') {
    return `New-York · First collected ${monthDayYear}`;
  }

  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'UTC'
  }).format(date);

  return `New-York, ${weekday}, ${monthDayYear}`;
}
