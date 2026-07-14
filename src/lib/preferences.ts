export type ReadingMode = 'gazette' | 'reader';

const MODE_KEY = 'publius:reading-mode';
const READ_KEY = 'publius:read-papers';

function validPaperNumber(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 85;
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
