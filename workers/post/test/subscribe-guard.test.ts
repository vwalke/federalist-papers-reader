/// <reference types="node" />
// workers/post/test/subscribe-guard.test.ts
//
// POST /api/subscribe against the real migration chain (node:sqlite) and a
// siteverify stand-in that behaves like Cloudflare's published Turnstile test
// secrets: nothing reaches D1 or Resend without a verified token, and the
// per-IP and per-address limits hold.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeDb } from '../src/db';
import { handleRequest } from '../src/handlers';
import type { OutboundEmail } from '../src/resend';
import {
  isSameOrigin,
  rateLimitKey,
  SIGNUP_IP_LIMIT,
  TURNSTILE_SITEVERIFY,
  verifyTurnstile
} from '../src/signup-guard';
import type { Env } from '../src/types';

// https://developers.cloudflare.com/turnstile/troubleshooting/testing/
const PASS_SECRET = '1x0000000000000000000000000000000AA';
const FAIL_SECRET = '2x0000000000000000000000000000000AA';
const SPENT_SECRET = '3x0000000000000000000000000000000AA';
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

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

/** Answers like siteverify does for each test secret. */
const siteverify = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  const body = new URLSearchParams(String(init?.body));
  const secret = body.get('secret');
  if (!body.get('response')) return Response.json({ success: false, 'error-codes': ['missing-input-response'] });
  if (secret === PASS_SECRET) return Response.json({ success: true, 'error-codes': [] });
  if (secret === SPENT_SECRET) return Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] });
  return Response.json({ success: false, 'error-codes': ['invalid-input-response'] });
}) as unknown as typeof fetch & ReturnType<typeof vi.fn>;

function env(overrides: Partial<Env> = {}): Env {
  return {
    SITE_URL: 'https://federalistreader.org',
    FROM_ADDRESS: 'Publius <publius@federalistreader.org>',
    RESEND_API_KEY: 'test-key',
    TOKEN_SECRET: 'env-secret',
    POSTAL_ADDRESS: '1 Test Lane',
    TURNSTILE_SECRET: PASS_SECRET,
    ...overrides
  } as Env;
}

let sent: OutboundEmail[];
const sender = async (_key: string, mail: OutboundEmail) => {
  sent.push(mail);
  return `msg_${sent.length}`;
};

let sqlite: DatabaseSync;
beforeEach(() => {
  sent = [];
  sqlite = migratedDb();
  siteverify.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-04T16:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  sqlite.close();
});

function signup(
  form: Record<string, string>,
  { ip = '203.0.113.7', headers = { Origin: 'https://federalistreader.org' } as Record<string, string> } = {}
): Request {
  return new Request('https://federalistreader.org/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'CF-Connecting-IP': ip, ...headers },
    body: new URLSearchParams(form).toString()
  });
}

const subscribe = (request: Request, e: Env = env()) =>
  handleRequest(request, e, makeDb(d1(sqlite)), sender, siteverify);

const rows = () => sqlite.prepare('SELECT email, status, program FROM subscribers ORDER BY id').all();

describe('a real signup with the Turnstile test keys', () => {
  it('verifies the token, saves a pending row, sends one confirmation, and confirms end to end', async () => {
    const res = await subscribe(signup({ email: 'Reader@Example.com', program: 'calendar', 'cf-turnstile-response': DUMMY_TOKEN }));
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://federalistreader.org/subscribe/check-inbox/');

    expect(siteverify).toHaveBeenCalledTimes(1);
    const [url, init] = siteverify.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(TURNSTILE_SITEVERIFY);
    const body = new URLSearchParams(String(init.body));
    expect(body.get('secret')).toBe(PASS_SECRET);
    expect(body.get('response')).toBe(DUMMY_TOKEN);
    expect(body.get('remoteip')).toBe('203.0.113.7');

    expect(rows()).toEqual([{ email: 'reader@example.com', status: 'pending', program: 'calendar' }]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('reader@example.com');

    // Follow the link in the confirmation email: GET shows the button, POST confirms.
    const confirmUrl = /Confirm your subscription: (\S+)/.exec(sent[0].text)![1];
    expect((await subscribe(new Request(confirmUrl))).status).toBe(200);
    const confirmed = await subscribe(new Request(confirmUrl, { method: 'POST' }));
    expect(confirmed.headers.get('Location')).toBe('https://federalistreader.org/subscribe/confirmed/');
    expect(rows()).toEqual([{ email: 'reader@example.com', status: 'active', program: 'calendar' }]);
    expect(sent).toHaveLength(2); // the welcome
  });
});

describe('rejected without a valid Turnstile token', () => {
  const nothingHappened = () => {
    expect(rows()).toEqual([]);
    expect(sent).toHaveLength(0);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM rate_limits').get()).toEqual({ n: 0 });
  };

  it('rejects a scripted POST with no token, without calling siteverify', async () => {
    const res = await subscribe(signup({ email: 'bot1@example.com', program: 'weekly' }, { headers: {} }));
    expect(res.status).toBe(403);
    expect(siteverify).not.toHaveBeenCalled();
    nothingHappened();
  });

  it('rejects a token siteverify refuses', async () => {
    const res = await subscribe(
      signup({ email: 'bot2@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }),
      env({ TURNSTILE_SECRET: FAIL_SECRET }));
    expect(res.status).toBe(403);
    nothingHappened();
  });

  it('rejects a spent (replayed) token', async () => {
    const res = await subscribe(
      signup({ email: 'bot3@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }),
      env({ TURNSTILE_SECRET: SPENT_SECRET }));
    expect(res.status).toBe(403);
    nothingHappened();
  });

  it('fails closed when the Worker has no Turnstile secret', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await subscribe(
        signup({ email: 'bot4@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }),
        env({ TURNSTILE_SECRET: undefined }));
      expect(res.status).toBe(403);
      expect(siteverify).not.toHaveBeenCalled();
      nothingHappened();
    } finally {
      error.mockRestore();
    }
  });

  it('fails closed when siteverify is unreachable', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    siteverify.mockRejectedValueOnce(new TypeError('network down'));
    try {
      const res = await subscribe(
        signup({ email: 'bot5@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }));
      expect(res.status).toBe(403);
      nothingHappened();
    } finally {
      error.mockRestore();
    }
  });

  it('rejects a form posted from another site before reading it', async () => {
    const res = await subscribe(signup(
      { email: 'bot6@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN },
      { headers: { Origin: 'https://evil.example' } }));
    expect(res.status).toBe(403);
    expect(siteverify).not.toHaveBeenCalled();
    nothingHappened();
  });

  it('quietly drops a filled honeypot without siteverify, a row, or an email', async () => {
    const res = await subscribe(signup(
      { email: 'bot7@example.com', program: 'weekly', contact_time: 'now', 'cf-turnstile-response': DUMMY_TOKEN }));
    expect(res.status).toBe(303);
    expect(siteverify).not.toHaveBeenCalled();
    nothingHappened();
  });
});

describe('rate limits', () => {
  it(`allows ${SIGNUP_IP_LIMIT.limit} signups an hour from one IP, then answers 429 until the next hour`, async () => {
    for (let i = 0; i < SIGNUP_IP_LIMIT.limit; i++) {
      const res = await subscribe(signup({ email: `class${i}@example.com`, program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }));
      expect(res.status).toBe(303);
    }
    const blocked = await subscribe(signup({ email: 'one-more@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('3600');
    expect(sent).toHaveLength(SIGNUP_IP_LIMIT.limit);
    expect(rows()).toHaveLength(SIGNUP_IP_LIMIT.limit);

    // Another address is unaffected…
    const elsewhere = await subscribe(signup(
      { email: 'one-more@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }, { ip: '198.51.100.9' }));
    expect(elsewhere.status).toBe(303);
    // …and the first one recovers in the next window.
    vi.setSystemTime(new Date('2026-11-04T17:00:00Z'));
    const later = await subscribe(signup({ email: 'later@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }));
    expect(later.status).toBe(303);
  });

  it('does not re-send a confirmation to a pending address within ten minutes, or more than three a day', async () => {
    const again = () => subscribe(signup({ email: 'reader@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }));
    expect((await again()).status).toBe(303);
    expect(sent).toHaveLength(1);
    const createdAt = sqlite.prepare('SELECT created_at FROM subscribers').get();

    vi.setSystemTime(new Date('2026-11-04T16:05:00Z'));
    const repeat = await again();
    expect(repeat.status).toBe(303); // looks the same to the visitor…
    expect(sent).toHaveLength(1); // …but nothing is sent
    expect(sqlite.prepare('SELECT created_at FROM subscribers').get()).toEqual(createdAt);

    vi.setSystemTime(new Date('2026-11-04T16:20:00Z'));
    await again();
    vi.setSystemTime(new Date('2026-11-04T16:40:00Z'));
    await again();
    expect(sent).toHaveLength(3);
    vi.setSystemTime(new Date('2026-11-04T17:00:00Z'));
    await again();
    expect(sent).toHaveLength(3); // daily cap
  });

  it('applies the same per-address limit to the already-subscribed notice', async () => {
    sqlite.exec(`INSERT INTO subscribers (email, program, status, token_secret) VALUES ('member@example.com', 'weekly', 'active', 't')`);
    const poke = () => subscribe(signup({ email: 'member@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }));
    await poke();
    await poke();
    expect(sent.map((m) => m.subject)).toEqual(['You are already subscribed — The Federalist by Post']);
  });

  it('stores only keyed hashes, never the IP or the address', async () => {
    await subscribe(signup({ email: 'reader@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN }));
    const keys = (sqlite.prepare('SELECT key FROM rate_limits').all() as Array<{ key: string }>).map((r) => r.key);
    expect(keys).toHaveLength(3);
    expect(keys.join(' ')).not.toMatch(/203\.0\.113\.7|reader@example\.com/);
    expect(keys).toContain(await rateLimitKey('ip', '203.0.113.7', 'env-secret'));
  });

  it('purges counters from long-past windows', async () => {
    const posts = makeDb(d1(sqlite));
    await posts.hitRateLimit('old', 3600, new Date('2026-11-01T00:00:00Z'));
    await posts.hitRateLimit('new', 3600);
    await posts.purgeRateLimits(2 * 86_400);
    expect(sqlite.prepare('SELECT key FROM rate_limits').all()).toEqual([{ key: 'new' }]);
  });

  it('lets a verified signup through when the rate_limits table is missing', async () => {
    sqlite.exec('DROP TABLE rate_limits');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const blocked = await subscribe(signup({ email: 'bot@example.com', program: 'weekly' }, { headers: {} }));
      expect(blocked.status).toBe(403);
      expect(rows()).toEqual([]);
      expect(sent).toHaveLength(0);

      const res = await subscribe(signup({
        email: 'reader@example.com', program: 'weekly', 'cf-turnstile-response': DUMMY_TOKEN
      }));
      expect(res.status).toBe(303);
      expect(rows()).toEqual([{ email: 'reader@example.com', status: 'pending', program: 'weekly' }]);
      expect(sent).toHaveLength(1);
      expect(error.mock.calls.some((call) => String(call[0]).includes('rate_limits table missing'))).toBe(true);
    } finally {
      error.mockRestore();
    }
  });
});

describe('isSameOrigin', () => {
  const req = (headers: Record<string, string>, url = 'https://federalistreader.org/api/subscribe') =>
    new Request(url, { method: 'POST', headers });
  const SITE = 'https://federalistreader.org';

  it('accepts the site origin and the Worker’s own origin (local wrangler dev)', () => {
    expect(isSameOrigin(req({ Origin: SITE }), SITE)).toBe(true);
    expect(isSameOrigin(req({ Origin: 'http://localhost:8787' }, 'http://localhost:8787/api/subscribe'), SITE)).toBe(true);
  });

  it('rejects another origin, including look-alikes', () => {
    expect(isSameOrigin(req({ Origin: 'https://evil.example' }), SITE)).toBe(false);
    expect(isSameOrigin(req({ Origin: 'https://federalistreader.org.evil.example' }), SITE)).toBe(false);
    expect(isSameOrigin(req({ Origin: 'http://federalistreader.org' }), SITE)).toBe(false);
  });

  it('falls back to Referer when Origin is absent or opaque', () => {
    expect(isSameOrigin(req({ Origin: 'null', Referer: `${SITE}/subscribe/` }), SITE)).toBe(true);
    expect(isSameOrigin(req({ Referer: 'https://evil.example/form' }), SITE)).toBe(false);
    expect(isSameOrigin(req({ Referer: 'not a url' }), SITE)).toBe(false);
  });

  it('leaves a request with neither header to Turnstile', () => {
    expect(isSameOrigin(req({}), SITE)).toBe(true);
  });
});

describe('verifyTurnstile', () => {
  it('rejects an oversized token without calling siteverify', async () => {
    expect(await verifyTurnstile(PASS_SECRET, 'x'.repeat(2049), null, siteverify)).toBe(false);
    expect(siteverify).not.toHaveBeenCalled();
  });

  it('rejects a non-200 answer from siteverify', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const down = vi.fn(async () => new Response('bad gateway', { status: 502 })) as unknown as typeof fetch;
    try {
      expect(await verifyTurnstile(PASS_SECRET, DUMMY_TOKEN, null, down)).toBe(false);
    } finally {
      error.mockRestore();
    }
  });

  it('omits remoteip when the client IP is unknown', async () => {
    expect(await verifyTurnstile(PASS_SECRET, DUMMY_TOKEN, null, siteverify)).toBe(true);
    const body = new URLSearchParams(String((siteverify.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.has('remoteip')).toBe(false);
  });
});
