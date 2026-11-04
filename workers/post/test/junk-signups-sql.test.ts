/// <reference types="node" />
// workers/post/test/junk-signups-sql.test.ts
//
// The operator's listing of the 2026-11-03 bot signups (ops/) runs on the real
// schema, picks out only never-confirmed rows from the attack window, and
// cannot change anything.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const SQL = readFileSync(new URL('../ops/list-junk-signups-2026-11-03.sql', import.meta.url), 'utf8');
const statements = SQL.replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean);

function seeded(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(name, dir), 'utf8'));
  }
  db.exec(`INSERT INTO subscribers (email, program, status, token_secret, created_at, confirmed_at, unsubscribed_at) VALUES
    ('before@example.com',  'weekly',   'pending',      't', '2026-11-03 20:59:59', NULL, NULL),
    ('bot1@example.com',    'weekly',   'pending',      't', '2026-11-03 21:00:00', NULL, NULL),
    ('bot2@example.com',    'calendar', 'pending',      't', '2026-11-04 02:15:00', NULL, NULL),
    ('bounced@example.com', 'weekly',   'unsubscribed', 't', '2026-11-03 22:00:00', NULL, '2026-11-03 22:00:04'),
    ('real@example.com',    'weekly',   'active',       't', '2026-11-03 23:00:00', '2026-11-03 23:05:00', NULL)`);
  return db;
}

describe('ops/list-junk-signups-2026-11-03.sql', () => {
  it('only reads', () => {
    expect(statements).toHaveLength(3);
    for (const sql of statements) {
      expect(sql).toMatch(/^SELECT\b/i);
      expect(sql).not.toMatch(/\b(DELETE|UPDATE|INSERT|DROP|ALTER|REPLACE)\b/i);
    }
  });

  it('lists pending never-confirmed signups from 21:00 UTC on, and the bounced ones separately', () => {
    const db = seeded();
    const [junk, byHour, gone] = statements.map((sql) => db.prepare(sql).all());
    expect(junk.map((r) => r.email)).toEqual(['bot1@example.com', 'bot2@example.com']);
    expect(byHour).toEqual([
      { program: 'weekly', hour_utc: '2026-11-03 21', signups: 1 },
      { program: 'calendar', hour_utc: '2026-11-04 02', signups: 1 }
    ]);
    expect(gone.map((r) => r.email)).toEqual(['bounced@example.com']);
    expect(db.prepare('SELECT COUNT(*) AS n FROM subscribers').get()).toEqual({ n: 5 });
  });
});
