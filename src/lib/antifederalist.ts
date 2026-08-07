import { toRomanNumeral } from './paper-display';

export type AntifederalistSeries = 'Brutus' | 'Cato';

/** The frontmatter fields the helpers need; collection entries carry more. */
export interface AntifederalistData {
  series: AntifederalistSeries;
  seriesNumber: number;
  publicationDate: string;
  repliesTo: number[];
}

export function essaySlug(data: AntifederalistData): string {
  return `${data.series.toLowerCase()}-${data.seriesNumber}`;
}

export function essayDisplayName(data: AntifederalistData): string {
  return `${data.series} No. ${toRomanNumeral(data.seriesNumber)}`;
}

const SERIES_BASE: Record<AntifederalistSeries, number> = { Brutus: 100, Cato: 150 };

/**
 * Read-state and wear id shared with the Federalist papers' number space:
 * 1–85 belong to Publius, 100+n to Brutus, 150+n to Cato.
 */
export function progressId(data: AntifederalistData): number {
  return SERIES_BASE[data.series] + data.seriesNumber;
}

export function getOrderedEssays<T extends AntifederalistData>(essays: readonly T[]): T[] {
  return [...essays].sort(
    (left, right) =>
      left.publicationDate.localeCompare(right.publicationDate) ||
      left.series.localeCompare(right.series) ||
      left.seriesNumber - right.seriesNumber
  );
}

export function getObjectionsForPaper<T extends AntifederalistData>(
  essays: readonly T[],
  paperNumber: number
): T[] {
  return getOrderedEssays(essays.filter((essay) => essay.repliesTo.includes(paperNumber)));
}
