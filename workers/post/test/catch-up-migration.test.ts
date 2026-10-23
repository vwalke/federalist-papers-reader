/// <reference types="node" />
// workers/post/test/catch-up-migration.test.ts
//
// Applies the migration chain through 0007 to a real SQLite engine and drives
// db.ts's catch-up queries and the re-subscribe reset through a D1 shim.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { makeDb } from '../src/db';

const MIGRATIONS = readdirSync(new URL('../migrations/', import.meta.url))
  .filter((f) => f.endsWith('.sql')).sort();

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const name of MIGRATIONS) {
    db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
  return db;
}

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

const row = (db: DatabaseSync) => db.prepare('SELECT * FROM subscribers WHERE id = 1').get() as Record<string, unknown>;

describe('0007 migration file', () => {
  it('is the last in the chain and only adds columns', () => {
    expect(MIGRATIONS.at(-1)).toBe('0007_calendar_catch_up.sql');
    const sql = readFileSync(new URL('../migrations/0007_calendar_catch_up.sql', import.meta.url), 'utf8')
      .replace(/--.*$/gm, '');
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE)\b/i);
    expect(sql.match(/ALTER TABLE subscribers ADD COLUMN/g)).toHaveLength(4);
  });

  it('leaves existing subscribers not catching up', () => {
    const sqlite = new DatabaseSync(':memory:');
    for (const name of MIGRATIONS.slice(0, -1)) {
      sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    sqlite.exec(`INSERT INTO subscribers (email, program, status, token_secret) VALUES ('a@example.com', 'calendar', 'active', 't')`);
    sqlite.exec(readFileSync(new URL('../migrations/0007_calendar_catch_up.sql', import.meta.url), 'utf8'));
    expect(row(sqlite)).toMatchObject({ catchup_requested: 0, catchup_items: null, catchup_starts_on: null, caught_up_on: null });
  });
});

describe('re-subscribing is a fresh signup', () => {
  it('resets the signup date, confirmation, and catch-up after an unsubscribe', async () => {
    const sqlite = migratedDb();
    sqlite.exec(`INSERT INTO subscribers (email, program, status, token_secret, created_at, confirmed_at,
      catchup_items, catchup_starts_on, caught_up_on)
      VALUES ('r@example.com', 'calendar', 'unsubscribed', 't', datetime('now', '-60 days'), datetime('now', '-59 days'),
      '101,1', '2026-10-20', '2026-10-21')`);
    const posts = makeDb(d1(sqlite));
    const again = await posts.upsertPending('r@example.com', 'calendar', 't2', 3, true);
    expect(again.status).toBe('pending');
    expect(again.confirmed_at).toBeNull();
    expect(again).toMatchObject({ catchup_requested: 1, catchup_items: null, catchup_starts_on: null, caught_up_on: null });
    const age = sqlite.prepare(`SELECT julianday('now') - julianday(created_at) AS days FROM subscribers`).get() as { days: number };
    expect(age.days).toBeLessThan(0.01);
    // So the fresh signup is neither purged nor reminded on the old clock.
    await posts.purgeStalePending(7);
    expect(await posts.getSubscriberByEmail('r@example.com')).not.toBeNull();
    expect(await posts.listConfirmReminderDue(3, 7)).toEqual([]);
  });

  it('restarts the seven-day window when a pending signup asks again', async () => {
    const sqlite = migratedDb();
    sqlite.exec(`INSERT INTO subscribers (email, program, token_secret, created_at)
      VALUES ('p@example.com', 'calendar', 't', datetime('now', '-6 days', '-23 hours'))`);
    const posts = makeDb(d1(sqlite));
    await posts.upsertPending('p@example.com', 'calendar', 't2', 3, true);
    await posts.purgeStalePending(7);
    expect(await posts.getSubscriberByEmail('p@example.com')).toMatchObject({ status: 'pending', catchup_requested: 1, token_secret: 't' });
  });

  it('leaves an active reader, and their catch-up, untouched', async () => {
    const sqlite = migratedDb();
    sqlite.exec(`INSERT INTO subscribers (email, program, status, token_secret, created_at, catchup_items)
      VALUES ('a@example.com', 'calendar', 'active', 't', '2026-10-01 00:00:00', '101')`);
    await makeDb(d1(sqlite)).upsertPending('a@example.com', 'weekly', 't2', 3, false);
    expect(row(sqlite)).toMatchObject({ program: 'calendar', created_at: '2026-10-01 00:00:00', catchup_items: '101' });
  });
});

describe('catch-up queries', () => {
  it('start, deliveries, caught up, stop, and switching away', async () => {
    const sqlite = migratedDb();
    sqlite.exec(`INSERT INTO subscribers (email, program, status, token_secret, catchup_requested)
      VALUES ('c@example.com', 'calendar', 'active', 't', 1)`);
    const posts = makeDb(d1(sqlite));
    await posts.startCatchUp(1, [101, 1, 2], '2026-11-11');
    expect(row(sqlite)).toMatchObject({ catchup_items: '101,1,2', catchup_starts_on: '2026-11-11', catchup_requested: 0 });

    expect(await posts.claimDelivery(1, 101, '2026-11-11')).toBe(true);
    expect(await posts.claimDelivery(1, 101, '2026-11-11')).toBe(false); // the rerun guard
    await posts.claimDelivery(1, 5, '2026-11-10');
    await posts.claimDelivery(1, 3, '2025-11-03'); // last season
    expect(await posts.listDeliveredItems(1, '2026-10-18')).toEqual([
      { paper_number: 5, scheduled_for: '2026-11-10' },
      { paper_number: 101, scheduled_for: '2026-11-11' }
    ]);

    await posts.markCaughtUp(1, '2026-11-13');
    await posts.markCaughtUp(1, '2026-11-14');
    expect(row(sqlite).caught_up_on).toBe('2026-11-13');

    await posts.stopCatchUp(1);
    expect(row(sqlite)).toMatchObject({ catchup_items: null, catchup_starts_on: null, caught_up_on: null });

    await posts.startCatchUp(1, [101], '2026-11-12');
    await posts.setProgram(1, 'weekly', 0);
    expect(row(sqlite)).toMatchObject({ program: 'weekly', catchup_items: null });
  });

  it('reads the last daily run', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    expect(await posts.getLastDailyRun()).toBeNull();
    await posts.recordDailyRun('2026-11-10');
    expect(await posts.getLastDailyRun()).toBe('2026-11-10');
  });
});
