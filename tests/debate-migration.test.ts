// tests/debate-migration.test.ts
//
// Keeps migration 0004 honest: its progress-remapping CASE table is generated
// from the debate content, and this test re-derives the mapping from the
// content and cross-checks it against the committed SQL.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  new URL('../workers/post/migrations/0004_debate.sql', import.meta.url),
  'utf8'
);
const { sequence } = JSON.parse(
  readFileSync(new URL('../workers/post/content/debate.json', import.meta.url), 'utf8')
) as { sequence: number[] };

describe('migration 0004', () => {
  it('remaps every weekly progress value to its merged-sequence position', () => {
    const embedded = new Map(
      [...sql.matchAll(/WHEN (\d+) THEN (\d+)/g)].map((m) => [Number(m[1]), Number(m[2])])
    );
    const derived = new Map(
      Array.from({ length: 85 }, (_, i) => {
        const paper = i + 1;
        return [paper, sequence.indexOf(paper) + 1] as const;
      })
    );
    expect(embedded.size).toBe(85);
    expect(Object.fromEntries(embedded)).toEqual(Object.fromEntries(derived));
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
