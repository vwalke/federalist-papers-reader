// tests/debate-migration.test.ts
//
// Keeps migration 0004 honest: its progress-remapping CASE table is generated
// from the debate content. Two independent checks guard it — a drift check
// (committed SQL vs the generator run over the committed content) and a
// formula-independent invariant (no reader is ever credited with a paper they
// never received, which the naive position+1 mapping violated around the
// out-of-order printing of Federalist 29).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { progressMapping } from '../scripts/generate-debate-migration.mjs';

const sql = readFileSync(
  new URL('../workers/post/migrations/0004_debate.sql', import.meta.url),
  'utf8'
);
const { sequence } = JSON.parse(
  readFileSync(new URL('../workers/post/content/debate.json', import.meta.url), 'utf8')
) as { sequence: number[] };

const embedded = new Map(
  [...sql.matchAll(/WHEN (\d+) THEN (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])])
);

describe('migration 0004', () => {
  it('matches the committed SQL to the mapping derived from the content', () => {
    const derived = progressMapping(sequence) as Map<number, number>;
    expect(embedded.size).toBe(85);
    expect(Object.fromEntries(embedded)).toEqual(Object.fromEntries(derived));
  });

  it('never credits a reader with a paper they have not received', () => {
    // The invariant, independent of the generator's formula: for every old
    // progress N, every paper at a merged position below the new progress must
    // be a paper the numeric-order course had already delivered (number <= N).
    for (const [oldProgress, newProgress] of embedded) {
      const creditedPapers = sequence
        .slice(0, newProgress)
        .filter((id) => id <= 85 && id > oldProgress);
      expect(creditedPapers, `old progress ${oldProgress}`).toEqual([]);
    }
  });

  it('pins the anchors, including the capped out-of-order paper 29', () => {
    expect(embedded.get(1)).toBe(2);
    expect(embedded.get(5)).toBe(8);
    expect(embedded.get(29)).toBe(33); // capped: naive position+1 would say 41
    expect(embedded.get(85)).toBe(93);
  });

  it('remaps inside the CASE only for mid-course weekly subscribers', () => {
    const remap = sql.slice(sql.indexOf('CASE progress_index'));
    expect(remap).toContain('ELSE progress_index');
    expect(remap).toContain("WHERE program = 'weekly' AND progress_index > 0");
  });

  it('widens the deliveries CHECK to the shared id space', () => {
    expect(sql).toContain('paper_number BETWEEN 1 AND 85');
    expect(sql).toContain('OR paper_number BETWEEN 101 AND 116');
    expect(sql).toContain('OR paper_number BETWEEN 151 AND 166');
    expect(sql).toContain('UNIQUE (subscriber_id, paper_number, scheduled_for)');
    expect(sql).toContain('CREATE INDEX idx_deliveries_status ON deliveries (status, created_at)');
    expect(sql).toContain('DROP TABLE deliveries');
  });

  it('flags every mid-course weekly subscriber for one make-up email', () => {
    expect(sql).toContain(
      'ALTER TABLE subscribers ADD COLUMN makeup_pending INTEGER NOT NULL DEFAULT 0'
    );
    expect(sql).toMatch(
      /UPDATE subscribers SET makeup_pending = 1\nWHERE program = 'weekly' AND progress_index > 0/
    );
  });

  it('covers the whole id space the content actually uses', () => {
    const inRange = (id: number) =>
      (id >= 1 && id <= 85) || (id >= 101 && id <= 116) || (id >= 151 && id <= 166);
    expect(sequence.every(inRange)).toBe(true);
  });
});
