import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function recipientCount(record) {
  return Math.max(
    1,
    (Array.isArray(record.to) ? record.to.length : 0) +
    (Array.isArray(record.cc) ? record.cc.length : 0) +
    (Array.isArray(record.bcc) ? record.bcc.length : 0)
  );
}

export async function listRetainedSends(apiKey, fetchImpl = fetch) {
  const rows = [];
  let after;

  do {
    const url = new URL(RESEND_EMAILS_URL);
    url.searchParams.set('limit', '100');
    if (after) url.searchParams.set('after', after);
    const response = await fetchImpl(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    if (!response.ok) {
      throw new Error(`Resend list failed with status ${response.status}`);
    }
    const page = await response.json();
    if (!page || typeof page !== 'object' || !Array.isArray(page.data) ||
      typeof page.has_more !== 'boolean') {
      throw new Error('Invalid Resend list response');
    }

    for (const record of page.data) {
      if (!record || typeof record !== 'object' ||
        typeof record.id !== 'string' || !UUID_LIKE.test(record.id) ||
        typeof record.created_at !== 'string' ||
        !Number.isFinite(Date.parse(record.created_at))) {
        throw new Error('Invalid retained email record');
      }
      rows.push({
        id: record.id,
        createdAt: new Date(record.created_at).toISOString(),
        recipientCount: recipientCount(record)
      });
    }

    if (!page.has_more) break;
    const finalRecord = page.data.at(-1);
    if (!finalRecord || typeof finalRecord.id !== 'string' ||
      finalRecord.id === after) {
      throw new Error('Invalid Resend pagination cursor');
    }
    after = finalRecord.id;
  } while (true);

  return rows;
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function renderBackfillSql(rows) {
  if (rows.length === 0) return '';
  const statements = rows.map((row) => `INSERT INTO email_sends
  (provider_message_id, sent_at, recipient_count)
VALUES (${sqlString(row.id)}, ${sqlString(row.createdAt)}, ${row.recipientCount})
ON CONFLICT(provider_message_id) DO UPDATE SET
  sent_at = excluded.sent_at,
  recipient_count = excluded.recipient_count;`);
  return `${statements.join('\n')}\n`;
}

async function executeRemoteSql(sql) {
  const directory = await mkdtemp(join(tmpdir(), 'publius-email-backfill-'));
  const sqlPath = join(directory, 'email-sends.sql');
  try {
    await writeFile(sqlPath, sql, { encoding: 'utf8', mode: 0o600 });
    await new Promise((resolve, reject) => {
      const child = spawn(
        'pnpm',
        ['exec', 'wrangler', 'd1', 'execute', 'publius-post', '--remote', '--file', sqlPath],
        { cwd: new URL('.', import.meta.url), env: process.env, stdio: 'inherit' }
      );
      child.once('error', reject);
      child.once('exit', (code, signal) => {
        if (code === 0) resolve();
        else reject(new Error(
          signal ? `Wrangler terminated by ${signal}` : `Wrangler exited with status ${code}`
        ));
      });
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

export async function main(options = {}) {
  const apiKey = options.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is required');
  const rows = await listRetainedSends(apiKey, options.fetchImpl);
  const sql = renderBackfillSql(rows);
  if (sql) await (options.runSql ?? executeRemoteSql)(sql);
  (options.log ?? console.log)(`Backfilled ${rows.length} sent-email records.`);
}

const invokedPath = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : '';
if (import.meta.url === invokedPath) {
  main().catch(() => {
    console.error('Sent-email backfill failed.');
    process.exitCode = 1;
  });
}
