/// <reference types="node" />
// workers/post/test/delivery-receipts-migration.test.ts
//
// Applies the migration chain through 0008 to a real SQLite engine and drives
// db.ts's delivery-status writes in both orders: the Resend event before the
// email_sends row is saved, and after.
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

const statuses = (db: DatabaseSync) => db.prepare(
  'SELECT provider_message_id, delivery_status, delivery_status_at FROM email_sends ORDER BY 1'
).all();

describe('0008 migration file', () => {
  it('is the last in the chain and only creates the receipts table', () => {
    expect(MIGRATIONS.at(-1)).toBe('0008_email_delivery_receipts.sql');
    const sql = readFileSync(new URL('../migrations/0008_email_delivery_receipts.sql', import.meta.url), 'utf8')
      .replace(/--.*$/gm, '');
    expect(sql).not.toMatch(/\b(DROP|DELETE|UPDATE|ALTER)\b/i);
    expect(sql.match(/CREATE TABLE email_delivery_receipts/g)).toHaveLength(1);
  });

  it('leaves existing email_sends rows untouched and rejects unknown statuses', () => {
    const sqlite = new DatabaseSync(':memory:');
    for (const name of MIGRATIONS.slice(0, -1)) {
      sqlite.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
    }
    sqlite.exec(`INSERT INTO email_sends (provider_message_id, sent_at, delivery_status, delivery_status_at)
      VALUES ('m1', '2026-10-01T00:00:00Z', 'delivered', '2026-10-01T00:01:00Z')`);
    sqlite.exec(readFileSync(new URL('../migrations/0008_email_delivery_receipts.sql', import.meta.url), 'utf8'));
    expect(statuses(sqlite)).toEqual([
      { provider_message_id: 'm1', delivery_status: 'delivered', delivery_status_at: '2026-10-01T00:01:00Z' }
    ]);
    expect(() => sqlite.exec(`INSERT INTO email_delivery_receipts VALUES ('m2', 'opened', '2026-10-01T00:00:00Z')`))
      .toThrow(/CHECK/);
  });
});

describe('delivery receipts that arrive before the send row', () => {
  it('applies an early delivered event once the row is saved', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.recordEmailDelivery('m1', 'delivered', '2026-10-17T11:00:05.000Z');
    expect(statuses(sqlite)).toEqual([]);

    await posts.recordEmailSend('m1', '2026-10-17T11:00:40.000Z', 1);
    expect(statuses(sqlite)).toEqual([
      { provider_message_id: 'm1', delivery_status: 'delivered', delivery_status_at: '2026-10-17T11:00:05.000Z' }
    ]);
  });

  it('keeps delivered when a delay event follows it before the row is saved', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.recordEmailDelivery('m1', 'delivered', '2026-10-17T11:00:05.000Z');
    await posts.recordEmailDelivery('m1', 'delivery_delayed', '2026-10-17T11:00:06.000Z');
    await posts.recordEmailSend('m1', '2026-10-17T11:00:40.000Z', 1);
    expect(statuses(sqlite)).toEqual([
      { provider_message_id: 'm1', delivery_status: 'delivered', delivery_status_at: '2026-10-17T11:00:05.000Z' }
    ]);
  });

  it('upgrades an early delay to delivered when delivery lands after the row', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.recordEmailDelivery('m1', 'delivery_delayed', '2026-10-17T11:00:05.000Z');
    await posts.recordEmailSend('m1', '2026-10-17T11:00:40.000Z', 1);
    expect(statuses(sqlite)).toEqual([
      { provider_message_id: 'm1', delivery_status: 'delivery_delayed', delivery_status_at: '2026-10-17T11:00:05.000Z' }
    ]);
    await posts.recordEmailDelivery('m1', 'delivered', '2026-10-17T11:30:00.000Z');
    await posts.recordEmailDelivery('m1', 'delivery_delayed', '2026-10-17T11:31:00.000Z');
    expect(statuses(sqlite)).toEqual([
      { provider_message_id: 'm1', delivery_status: 'delivered', delivery_status_at: '2026-10-17T11:30:00.000Z' }
    ]);
  });

  it('never counts a send for a receipt alone, and purges old receipts', async () => {
    const sqlite = migratedDb();
    const posts = makeDb(d1(sqlite));
    await posts.recordEmailDelivery('old', 'delivered', '2020-01-01T00:00:00.000Z');
    await posts.recordEmailDelivery('new', 'delivered', new Date().toISOString());
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM email_sends').get()).toEqual({ n: 0 });
    await posts.purgeEmailSends(45);
    expect(sqlite.prepare('SELECT provider_message_id FROM email_delivery_receipts').all())
      .toEqual([{ provider_message_id: 'new' }]);
  });
});
