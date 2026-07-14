export interface IndexPaper {
  number: number;
  title: string;
  author: string;
  publicationDate: string;
  indexSummary: string;
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
  return [paper.number, paper.title, paper.author, paper.publicationDate, paper.indexSummary]
    .join(' ')
    .toLocaleLowerCase();
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
