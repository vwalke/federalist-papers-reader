// workers/post/src/content.ts
// The Worker's bundled copy of the debate: both sides, merged in the order the
// argument reached readers. Regenerate with `pnpm generate:email-content`.
import debateJson from '../content/debate.json';
import type { DebateItem } from './types';

const debate = debateJson as unknown as { items: DebateItem[]; sequence: number[] };

export const items: readonly DebateItem[] = debate.items;

/** Item ids in the canonical merged order; sequence[0] is Brutus No. I. */
export const sequence: readonly number[] = debate.sequence;

export const byId: ReadonlyMap<number, DebateItem> = new Map(
  items.map((item) => [item.id, item])
);

/** id -> zero-based position in the merged sequence. */
export const sequencePosition: ReadonlyMap<number, number> = new Map(
  sequence.map((id, index) => [id, index])
);
