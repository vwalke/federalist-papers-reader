export type ReadingMode = 'gazette' | 'reader';
export type IndexView = 'papers' | 'debate';

export const TEXT_SCALE_STEPS = [1, 1.12, 1.25, 1.4, 1.55] as const;
export type TextScale = (typeof TEXT_SCALE_STEPS)[number];

const MODE_KEY = 'publius:reading-mode';
const READ_KEY = 'publius:read-papers';
const SCALE_KEY = 'publius:text-scale';
const INDEX_VIEW_KEY = 'publius:index-view';

// Read-state ids span three ranges, matching the shared number space in
// src/lib/antifederalist.ts: 1–85 is Publius (The Federalist), 101–116 is
// Brutus, and 151–166 is Cato (SERIES_BASE 100/150 + seriesNumber, capped at
// 16 by the content schema). Kept as explicit ranges rather than importing
// antifederalist.ts so this module stays dependency-free.
function validPaperNumber(value: unknown): value is number {
  if (!Number.isInteger(value)) return false;
  const number = value as number;
  return (
    (number >= 1 && number <= 85) ||
    (number >= 101 && number <= 116) ||
    (number >= 151 && number <= 166)
  );
}

function validTextScale(value: unknown): value is TextScale {
  return TEXT_SCALE_STEPS.includes(value as TextScale);
}

export function createPreferences(storage: Storage | null | undefined) {
  function safeGet(key: string): string | null {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  function safeSet(key: string, value: string): void {
    try {
      storage?.setItem(key, value);
    } catch {
      // Local state is an enhancement; reading must survive storage being blocked.
    }
  }

  function getReadPapers(): Set<number> {
    try {
      const parsed: unknown = JSON.parse(safeGet(READ_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter(validPaperNumber).sort((left, right) => left - right));
    } catch {
      return new Set();
    }
  }

  return {
    getReadingMode(): ReadingMode {
      return safeGet(MODE_KEY) === 'reader' ? 'reader' : 'gazette';
    },
    setReadingMode(mode: ReadingMode): void {
      safeSet(MODE_KEY, mode);
    },
    getIndexView(): IndexView {
      return safeGet(INDEX_VIEW_KEY) === 'debate' ? 'debate' : 'papers';
    },
    setIndexView(view: IndexView): void {
      safeSet(INDEX_VIEW_KEY, view);
    },
    getTextScale(): TextScale {
      const parsed = Number(safeGet(SCALE_KEY));
      return validTextScale(parsed) ? parsed : 1;
    },
    setTextScale(scale: number): void {
      if (validTextScale(scale)) safeSet(SCALE_KEY, String(scale));
    },
    getReadPapers,
    isPaperRead(number: number): boolean {
      return getReadPapers().has(number);
    },
    setPaperRead(number: number, read: boolean): void {
      if (!validPaperNumber(number)) return;
      const papers = getReadPapers();
      if (read) papers.add(number);
      else papers.delete(number);
      safeSet(READ_KEY, JSON.stringify([...papers].sort((left, right) => left - right)));
    }
  };
}

export function getNextUnread(
  orderedNumbers: readonly number[],
  readNumbers: ReadonlySet<number>,
  afterNumber = 0
): number | null {
  if (orderedNumbers.length === 0) return null;
  const nextIndex = orderedNumbers.findIndex((number) => number > afterNumber);
  const startIndex = nextIndex === -1 ? 0 : nextIndex;

  for (let offset = 0; offset < orderedNumbers.length; offset += 1) {
    const number = orderedNumbers[(startIndex + offset) % orderedNumbers.length];
    if (!readNumbers.has(number)) return number;
  }

  return null;
}
