// tests/migration-chain.test.ts
//
// Applies the whole migration chain 0001 -> 0004 to a real SQLite engine
// (node:sqlite) against seeded pre-debate data, proving the SQL runs as
// written and 0004's remap, flags, rebuilt constraints, and cascade behave
// the way the Worker relies on.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, describe, expect, it } from 'vitest';

const MIGRATIONS = [
  '0001_init.sql',
  '0002_ops_meta.sql',
  '0003_email_sends.sql',
  '0004_debate.sql'
];

function migrationSql(name: string): string {
  return readFileSync(new URL(`../workers/post/migrations/${name}`, import.meta.url), 'utf8');
}

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;'); // D1 enforces foreign keys
  for (const name of MIGRATIONS.slice(0, 3)) db.exec(migrationSql(name));
  db.exec(`INSERT INTO subscribers (email, program, status, progress_index, token_secret) VALUES
    ('fresh@example.com',   'weekly',   'active', 0,  't'),
    ('mid5@example.com',    'weekly',   'active', 5,  't'),
    ('mid29@example.com',   'weekly',   'active', 29, 't'),
    ('done85@example.com',  'weekly',   'active', 85, 't'),
    ('season@example.com',  'calendar', 'active', 0,  't');`);
  db.exec(`INSERT INTO deliveries (id, subscriber_id, paper_number, scheduled_for, status, provider_message_id) VALUES
    (11, 2, 5,  '2026-07-11', 'sent',   'msg_a'),
    (12, 2, 6,  '2026-07-18', 'failed', NULL),
    (13, 3, 29, '2026-07-18', 'sent',   'msg_b');`);
  db.exec(migrationSql('0004_debate.sql'));
  return db;
}

const db = migratedDb();
afterAll(() => db.close());

describe('migrations 0001 -> 0004 on a real SQLite engine', () => {
  it('remaps weekly progress and flags the make-up, leaving calendar alone', () => {
    const rows = db.prepare(
      'SELECT email, progress_index, makeup_pending FROM subscribers ORDER BY id'
    ).all() as Array<{ email: string; progress_index: number; makeup_pending: number }>;
    expect(rows.map((r) => [r.email, r.progress_index, r.makeup_pending])).toEqual([
      ['fresh@example.com', 0, 0],
      ['mid5@example.com', 8, 1],
      ['mid29@example.com', 33, 1], // capped: paper 29 ran out of numeric order
      ['done85@example.com', 93, 1],
      ['season@example.com', 0, 0]
    ]);
  });

  it('preserves delivery rows, ids, and statuses through the table rebuild', () => {
    const rows = db.prepare(
      'SELECT id, subscriber_id, paper_number, status, provider_message_id FROM deliveries ORDER BY id'
    ).all();
    expect(rows).toEqual([
      { id: 11, subscriber_id: 2, paper_number: 5, status: 'sent', provider_message_id: 'msg_a' },
      { id: 12, subscriber_id: 2, paper_number: 6, status: 'failed', provider_message_id: null },
      { id: 13, subscriber_id: 3, paper_number: 29, status: 'sent', provider_message_id: 'msg_b' }
    ]);
  });

  it('accepts essay ids and rejects ids outside the shared space', () => {
    db.exec(
      `INSERT INTO deliveries (subscriber_id, paper_number, scheduled_for) VALUES
        (2, 101, '2026-08-15'), (2, 154, '2026-08-15'), (2, 85, '2026-08-15');`
    );
    expect(() => db.exec(
      `INSERT INTO deliveries (subscriber_id, paper_number, scheduled_for) VALUES (2, 99, '2026-08-15');`
    )).toThrow(/CHECK/);
    expect(() => db.exec(
      `INSERT INTO deliveries (subscriber_id, paper_number, scheduled_for) VALUES (2, 117, '2026-08-15');`
    )).toThrow(/CHECK/);
  });

  it('keeps the exactly-once UNIQUE on (subscriber, item, date)', () => {
    expect(() => db.exec(
      `INSERT INTO deliveries (subscriber_id, paper_number, scheduled_for) VALUES (2, 101, '2026-08-15');`
    )).toThrow(/UNIQUE/);
  });

  it('keeps the ON DELETE CASCADE from subscribers to deliveries', () => {
    db.exec(`DELETE FROM subscribers WHERE email = 'mid29@example.com';`);
    const orphans = db.prepare(
      'SELECT COUNT(*) AS n FROM deliveries WHERE subscriber_id = 3'
    ).get() as { n: number };
    expect(orphans.n).toBe(0);
  });
});
