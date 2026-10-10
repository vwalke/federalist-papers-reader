/// <reference types="node" />
// workers/post/test/announcement-migration.test.ts
//
// Applies the full migration chain through 0005 to a real SQLite engine and
// drives the Worker's own announcement queries (db.ts) through a minimal D1
// shim, proving the claim is exactly-once and retries see only what they
// should.
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { makeDb } from '../src/db';

const MIGRATIONS = [
  '0001_init.sql',
  '0002_ops_meta.sql',
  '0003_email_sends.sql',
  '0004_debate.sql',
  '0005_announcement_deliveries.sql'
];

const ID = 'aih-season-2026';

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const name of MIGRATIONS) {
    db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  db.exec(`INSERT INTO subscribers (email, program, status, token_secret) VALUES
    ('weekly@example.com', 'weekly',   'active',       't'),
    ('season@example.com', 'calendar', 'active',       't'),
    ('gone@example.com',   'weekly',   'unsubscribed', 't');`);
  return db;
}

/** Just enough of D1's prepared-statement surface for db.ts. */
function d1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      let params: Array<string | number | null> = [];
      const stmt = {
        bind(...values: Array<string | number | null>) { params = values; return stmt; },
        async run() {
          const result = db.prepare(sql).run(...params);
          return { meta: { changes: Number(result.changes) } };
        },
        async all() { return { results: db.prepare(sql).all(...params) }; },
        async first() { return db.prepare(sql).get(...params) ?? null; }
      };
      return stmt;
    }
  } as unknown as D1Database;
}

describe('announcement_deliveries on a real SQLite engine', () => {
  it('claims each subscriber exactly once per announcement', async () => {
    const posts = makeDb(d1(migratedDb()));
    expect(await posts.claimAnnouncement(1, ID)).toBe(true);
    expect(await posts.claimAnnouncement(1, ID)).toBe(false);
    expect(await posts.claimAnnouncement(1, 'some-later-note')).toBe(true);
    expect(await posts.claimAnnouncement(2, ID)).toBe(true);
  });

  it('retries failed and stranded claims for active subscribers only', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    for (const id of [1, 2, 3]) await posts.claimAnnouncement(id, ID);
    await posts.markAnnouncement(1, ID, 'failed');
    await posts.markAnnouncement(2, ID, 'sent', 'msg_2');
    await posts.markAnnouncement(3, ID, 'failed');
    expect((await posts.listRetryableAnnouncement(ID)).map((s) => s.email))
      .toEqual(['weekly@example.com']);

    // A claim left queued by a run that died mid-send is retried after an hour.
    sqlite.exec(`UPDATE announcement_deliveries SET status = 'queued',
      created_at = datetime('now', '-2 hours') WHERE subscriber_id = 2`);
    expect((await posts.listRetryableAnnouncement(ID)).map((s) => s.email).sort())
      .toEqual(['season@example.com', 'weekly@example.com']);

    // Past the two-day window nothing is retried.
    sqlite.exec(`UPDATE announcement_deliveries SET created_at = datetime('now', '-3 days')`);
    expect(await posts.listRetryableAnnouncement(ID)).toEqual([]);
  });

  it('records the provider id on a sent claim', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.claimAnnouncement(2, ID);
    await posts.markAnnouncement(2, ID, 'sent', 'msg_x');
    expect(sqlite.prepare(
      'SELECT status, provider_message_id FROM announcement_deliveries WHERE subscriber_id = 2'
    ).get()).toEqual({ status: 'sent', provider_message_id: 'msg_x' });
  });

  it('cascades claims away with a purged subscriber', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.claimAnnouncement(3, ID);
    sqlite.exec('DELETE FROM subscribers WHERE id = 3');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM announcement_deliveries').get())
      .toEqual({ n: 0 });
  });
});
