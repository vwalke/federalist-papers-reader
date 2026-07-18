#!/usr/bin/env node
// Operator stats for Publius by Post: pnpm stats
// Read-only queries against the production D1 database.
import { execFileSync } from 'node:child_process';

const DB = 'publius-post';

function run(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, '--remote', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
  );
  return JSON.parse(out)[0].results;
}

function table(rows) {
  if (!rows.length) return console.log('  (none)');
  const cols = Object.keys(rows[0]);
  const width = cols.map((c) => Math.max(c.length, ...rows.map((r) => String(r[c] ?? '').length)));
  console.log('  ' + cols.map((c, i) => c.padEnd(width[i])).join('  '));
  for (const r of rows) {
    console.log('  ' + cols.map((c, i) => String(r[c] ?? '').padEnd(width[i])).join('  '));
  }
}

console.log('Subscribers');
table(run(`SELECT
  COUNT(*) FILTER (WHERE status = 'active')                          AS active,
  COUNT(*) FILTER (WHERE status = 'pending')                         AS pending,
  COUNT(*) FILTER (WHERE status NOT IN ('active','pending'))         AS gone,
  COUNT(*) FILTER (WHERE program = 'weekly'   AND status = 'active') AS weekly,
  COUNT(*) FILTER (WHERE program = 'calendar' AND status = 'active') AS as_it_happened
FROM subscribers`));

console.log('\nRecent signups');
table(run(`SELECT id, email, program, status, created_at, confirmed_at
FROM subscribers ORDER BY created_at DESC LIMIT 10`));

console.log('\nRecent deliveries');
table(run(`SELECT scheduled_for, paper_number, status, COUNT(*) AS emails
FROM deliveries GROUP BY scheduled_for, paper_number, status
ORDER BY scheduled_for DESC LIMIT 10`));
