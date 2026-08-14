export interface IndexPaper {
  number: number;
  title: string;
  author: string;
  publicationDate: string;
  indexSummary: string;
  /**
   * Optional haystack override for search. Papers omit it (their number is
   * user-visible and searchable); essays exclude their synthetic progressId.
   */
  searchText?: string;
}

export type IndexSort = 'number' | 'author' | 'date';
export type IndexStatus = 'all' | 'read' | 'unread';

export interface IndexSelection {
  query?: string;
  sort?: IndexSort;
  status?: IndexStatus;
  readNumbers?: ReadonlySet<number>;
}

function searchableText(paper: IndexPaper): string {
  return (
    paper.searchText ??
    [paper.number, paper.title, paper.author, paper.publicationDate, paper.indexSummary].join(' ')
  ).toLocaleLowerCase();
}

/** A Journal essay as the combined ledger needs it; the shelf carries more. */
export interface IndexEssay {
  /** Read-state id in the shared number space (Brutus 100+n, Cato 150+n). */
  progressId: number;
  title: string;
  series: string;
  publicationDate: string;
  indexSummary: string;
}

/**
 * The "with the opposition" view: essays take the papers' shape (the
 * progressId stands in for the paper number, the series for the author) and
 * the whole run is forced into publication order. Date ties resolve through
 * the number tiebreak, which puts papers (1–85) before essays (101+) and
 * orders the essays by series, then series number.
 */
export function selectDebateIndex(
  papers: readonly IndexPaper[],
  essays: readonly IndexEssay[],
  selection: Omit<IndexSelection, 'sort'> = {}
): IndexPaper[] {
  const combined = [
    ...papers,
    ...essays.map((essay) => ({
      number: essay.progressId,
      title: essay.title,
      author: essay.series,
      publicationDate: essay.publicationDate,
      indexSummary: essay.indexSummary,
      /* The progressId is bookkeeping, never print: searching "101" must not
         surface Brutus I, so the haystack skips the number. */
      searchText: [essay.title, essay.series, essay.publicationDate, essay.indexSummary].join(' ')
    }))
  ];
  return selectIndexPapers(combined, { ...selection, sort: 'date' });
}

export function selectIndexPapers(papers: readonly IndexPaper[], selection: IndexSelection = {}): IndexPaper[] {
  const query = selection.query?.trim().toLocaleLowerCase() ?? '';
  const status = selection.status ?? 'all';
  const readNumbers = selection.readNumbers ?? new Set<number>();
  const sort = selection.sort ?? 'number';

  return papers
    .filter((paper) => !query || searchableText(paper).includes(query))
    .filter((paper) => {
      if (status === 'read') return readNumbers.has(paper.number);
      if (status === 'unread') return !readNumbers.has(paper.number);
      return true;
    })
    .sort((left, right) => {
      if (sort === 'author') {
        return left.author.localeCompare(right.author) || left.number - right.number;
      }
      if (sort === 'date') {
        return left.publicationDate.localeCompare(right.publicationDate) || left.number - right.number;
      }
      return left.number - right.number;
    });
}
