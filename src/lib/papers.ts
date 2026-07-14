export interface PaperNumberReport {
  valid: boolean;
  missing: number[];
  duplicates: number[];
  unexpected: number[];
}

export interface NumberedPaper {
  number: number;
}

export function getOrderedPapers<T extends NumberedPaper>(papers: readonly T[]): T[] {
  return [...papers].sort((left, right) => left.number - right.number);
}

export function getPaperByNumber<T extends NumberedPaper>(papers: readonly T[], number: number): T | undefined {
  return papers.find((paper) => paper.number === number);
}

export function getAdjacentPapers<T extends NumberedPaper>(
  papers: readonly T[],
  number: number
): { previous: T | null; next: T | null } {
  const ordered = getOrderedPapers(papers);
  const index = ordered.findIndex((paper) => paper.number === number);

  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: ordered[index - 1] ?? null,
    next: ordered[index + 1] ?? null
  };
}

export function validatePaperSet(papers: Array<{ number: number }>): PaperNumberReport {
  const counts = new Map<number, number>();

  for (const { number } of papers) {
    counts.set(number, (counts.get(number) ?? 0) + 1);
  }

  const expected = Array.from({ length: 85 }, (_, index) => index + 1);
  const missing = expected.filter((number) => !counts.has(number));
  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([number]) => number)
    .sort((left, right) => left - right);
  const unexpected = [...counts.keys()]
    .filter((number) => !Number.isInteger(number) || number < 1 || number > 85)
    .sort((left, right) => left - right);

  return {
    valid: missing.length === 0 && duplicates.length === 0 && unexpected.length === 0,
    missing,
    duplicates,
    unexpected
  };
}
