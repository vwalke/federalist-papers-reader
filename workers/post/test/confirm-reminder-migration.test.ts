/// <reference types="node" />
// workers/post/test/confirm-reminder-migration.test.ts
//
// Applies the full migration chain through 0006 to a real SQLite engine and
// drives the Worker's own reminder, activation, and delivery-status queries
// (db.ts) through a minimal D1 shim.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { makeDb } from '../src/db';

const MIGRATIONS = [
  '0001_init.sql',
  '0002_ops_meta.sql',
  '0003_email_sends.sql',
  '0004_debate.sql',
  '0005_announcement_deliveries.sql',
  '0006_confirm_reminders_and_delivery_status.sql',
  // db.ts reads 0007's catch-up columns in upsertPending, so the chain runs through it.
  '0007_calendar_catch_up.sql'
];

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');
  for (const name of MIGRATIONS) {
    db.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  }
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

/** Inserts a subscriber whose signup is `ageHours` old. */
function signup(db: DatabaseSync, email: string, ageHours: number, status = 'pending'): void {
  db.prepare(`INSERT INTO subscribers (email, program, status, token_secret, created_at)
    VALUES (?, 'weekly', ?, 't', datetime('now', ?))`).run(email, status, `-${ageHours} hours`);
}

const emails = (rows: Array<{ email: string }>) => rows.map((row) => row.email);

describe('0006 migration file', () => {
  it('is the next migration in sequence and only adds columns', () => {
    const files = readdirSync(new URL('../migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
    expect(files).toEqual(MIGRATIONS);
    const sql = readFileSync(new URL(`../migrations/${MIGRATIONS[5]}`, import.meta.url), 'utf8');
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE)\b/i);
    expect(sql.match(/ALTER TABLE \w+ ADD COLUMN/g)).toHaveLength(3);
  });

  it('adds nullable columns that leave existing rows untouched', () => {
    const db = migratedDb();
    signup(db, 'a@example.com', 1);
    db.exec(`INSERT INTO email_sends (provider_message_id, sent_at) VALUES ('m1', '2026-10-01T00:00:00Z')`);
    expect(db.prepare('SELECT confirm_reminded_at FROM subscribers').get()).toEqual({ confirm_reminded_at: null });
    expect(db.prepare('SELECT delivery_status, delivery_status_at FROM email_sends').get())
      .toEqual({ delivery_status: null, delivery_status_at: null });
    expect(() => db.exec(`UPDATE email_sends SET delivery_status = 'opened'`)).toThrow(/CHECK/);
  });
});

describe('confirmation reminders on a real SQLite engine', () => {
  it('selects pending signups older than 3 days and not yet due for the 7-day purge', async () => {
    const sqlite = migratedDb();
    signup(sqlite, 'fresh@example.com', 2 * 24);
    signup(sqlite, 'day3@example.com', 3 * 24 + 1);
    signup(sqlite, 'day6@example.com', 6 * 24 + 23);
    signup(sqlite, 'stale@example.com', 7 * 24 + 1);
    signup(sqlite, 'active@example.com', 4 * 24, 'active');
    signup(sqlite, 'gone@example.com', 4 * 24, 'unsubscribed');
    const posts = makeDb(d1(sqlite));

    // Oldest first: the closest to being purged goes out first.
    expect(emails(await posts.listConfirmReminderDue(3, 7))).toEqual(['day6@example.com', 'day3@example.com']);

    // Nothing reminded this run is deleted by the purge that follows it.
    await posts.purgeStalePending(7);
    expect(emails(sqlite.prepare('SELECT email FROM subscribers ORDER BY id').all() as Array<{ email: string }>))
      .toEqual(['fresh@example.com', 'day3@example.com', 'day6@example.com', 'active@example.com', 'gone@example.com']);
  });

  it('claims a reminder exactly once and drops it from later selections', async () => {
    const sqlite = migratedDb();
    signup(sqlite, 'p@example.com', 4 * 24);
    const posts = makeDb(d1(sqlite));
    expect(await posts.claimConfirmReminder(1)).toBe(true);
    expect(await posts.claimConfirmReminder(1)).toBe(false);
    expect(await posts.listConfirmReminderDue(3, 7)).toEqual([]);
  });

  it('never claims a subscriber who has already confirmed', async () => {
    const sqlite = migratedDb();
    signup(sqlite, 'p@example.com', 4 * 24, 'active');
    expect(await makeDb(d1(sqlite)).claimConfirmReminder(1)).toBe(false);
  });

  it('clears the reminder mark when an unsubscribed address signs up again', async () => {
    const sqlite = migratedDb();
    signup(sqlite, 'p@example.com', 4 * 24);
    const posts = makeDb(d1(sqlite));
    await posts.claimConfirmReminder(1);
    await posts.unsubscribe(1);
    const again = await posts.upsertPending('p@example.com', 'weekly', 't2', 3);
    expect(again.status).toBe('pending');
    expect(sqlite.prepare('SELECT confirm_reminded_at FROM subscribers').get()).toEqual({ confirm_reminded_at: null });
  });

  it('keeps the reminder mark on a repeat signup while still pending', async () => {
    const sqlite = migratedDb();
    signup(sqlite, 'p@example.com', 4 * 24);
    const posts = makeDb(d1(sqlite));
    await posts.claimConfirmReminder(1);
    await posts.upsertPending('p@example.com', 'weekly', 't2', 3);
    expect(await posts.listConfirmReminderDue(3, 7)).toEqual([]);
  });
});

describe('activate on a real SQLite engine', () => {
  it('reports a transition only the first time', async () => {
    const sqlite = migratedDb();
    signup(sqlite, 'p@example.com', 1);
    const posts = makeDb(d1(sqlite));
    expect(await posts.activate(1, '203.0.113.9')).toBe(true);
    expect(await posts.activate(1, '203.0.113.9')).toBe(false);
    expect(sqlite.prepare('SELECT status, confirm_ip FROM subscribers').get())
      .toEqual({ status: 'active', confirm_ip: '203.0.113.9' });
  });
});

describe('delivery status on a real SQLite engine', () => {
  it('records delivered and delayed events, never downgrading delivered', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.recordEmailSend('m1', '2026-10-17T11:00:00.000Z', 1);
    await posts.recordEmailSend('m2', '2026-10-17T11:00:00.000Z', 1);

    await posts.recordEmailDelivery('m1', 'delivery_delayed', '2026-10-17T11:05:00.000Z');
    await posts.recordEmailDelivery('m1', 'delivered', '2026-10-17T11:30:00.000Z');
    await posts.recordEmailDelivery('m1', 'delivery_delayed', '2026-10-17T11:31:00.000Z');
    await posts.recordEmailDelivery('m2', 'delivery_delayed', '2026-10-17T11:05:00.000Z');

    expect(sqlite.prepare(
      'SELECT provider_message_id, delivery_status, delivery_status_at FROM email_sends ORDER BY 1'
    ).all()).toEqual([
      { provider_message_id: 'm1', delivery_status: 'delivered', delivery_status_at: '2026-10-17T11:30:00.000Z' },
      { provider_message_id: 'm2', delivery_status: 'delivery_delayed', delivery_status_at: '2026-10-17T11:05:00.000Z' }
    ]);
  });

  it('keeps the delivery status when a later email.sent webhook upserts the row', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.recordEmailSend('m1', '2026-10-17T11:00:00.000Z', 1);
    await posts.recordEmailDelivery('m1', 'delivered', '2026-10-17T11:01:00.000Z');
    await posts.recordEmailSend('m1', '2026-10-17T11:00:01.000Z', 1);
    expect(sqlite.prepare('SELECT delivery_status FROM email_sends').get()).toEqual({ delivery_status: 'delivered' });
  });

  it('ignores events for emails it never tracked', async () => {
    const sqlite = migratedDb();
    await makeDb(d1(sqlite)).recordEmailDelivery('unknown', 'delivered', '2026-10-17T11:01:00.000Z');
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM email_sends').get()).toEqual({ n: 0 });
  });
});
