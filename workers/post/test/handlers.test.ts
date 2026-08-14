// workers/post/test/handlers.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/handlers';
import type { Db } from '../src/db';
import type { Env, Subscriber } from '../src/types';

const SUB: Subscriber = {
  id: 7, email: 'reader@example.com', program: 'weekly', status: 'pending',
  progress_index: 0, send_dow: 6, paused_until: null, token_secret: 'subsecret', confirmed_at: null,
  makeup_pending: 0
};

function makeStubDb(overrides: Partial<Db> = {}): Db {
  return {
    getSubscriberStats: vi.fn(async () => ({
      active: 0, pending: 0, gone: 0, weekly: 0, asItHappened: 0
    })),
    getWeeklyDayStats: vi.fn(async () => []),
    getSubscriptionActivity: vi.fn(async () => ({ days: [] })),
    recordEmailSend: vi.fn(async () => {}),
    getEmailActivity: vi.fn(async () => ({ last24Hours: 0, days: [] })),
    purgeEmailSends: vi.fn(async () => {}),
    getSubscriberById: vi.fn(async () => SUB),
    getSubscriberByEmail: vi.fn(async () => null),
    upsertPending: vi.fn(async () => SUB),
    activate: vi.fn(async (_id: number, _confirmIp: string | null) => {}),
    setStatus: vi.fn(async () => {}),
    setProgram: vi.fn(async () => {}),
    setProgress: vi.fn(async () => {}),
    clearMakeupPending: vi.fn(async () => {}),
    setSendDow: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
    unsubscribeByEmail: vi.fn(async () => {}),
    listDeliverable: vi.fn(async () => []),
    autoResume: vi.fn(async () => {}),
    claimDelivery: vi.fn(async () => true),
    markDelivery: vi.fn(async () => {}),
    listRetryable: vi.fn(async () => []),
    purgeUnsubscribed: vi.fn(async () => {}),
    purgeStalePending: vi.fn(async () => {}),
    recordDailyRun: vi.fn(async () => {}),
    ...overrides
  };
}

const ENV = {
  SITE_URL: 'https://federalistreader.org',
  FROM_ADDRESS: 'Publius <publius@federalistreader.org>',
  RESEND_API_KEY: 'test-key',
  TOKEN_SECRET: 'env-secret',
  POSTAL_ADDRESS: '1 Test Lane'
} as Env;

let sent: Array<{ to: string; subject: string }>;
const sender = async (_key: string, mail: { to: string; subject: string }) => {
  sent.push(mail);
  return 'msg_test';
};
beforeEach(() => { sent = []; });

function post(path: string, form: Record<string, string>): Request {
  return new Request(`https://federalistreader.org${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString()
  });
}

async function manageToken(): Promise<string> {
  const { signToken } = await import('../src/tokens');
  return signToken(7, 'manage', ENV.TOKEN_SECRET, SUB.token_secret);
}

const THIRTY_DAILY_VALUES = [
  { date: '2026-07-02', count: 0 }, { date: '2026-07-03', count: 1 },
  { date: '2026-07-04', count: 0 }, { date: '2026-07-05', count: 0 },
  { date: '2026-07-06', count: 1 }, { date: '2026-07-07', count: 0 },
  { date: '2026-07-08', count: 0 }, { date: '2026-07-09', count: 1 },
  { date: '2026-07-10', count: 0 }, { date: '2026-07-11', count: 0 },
  { date: '2026-07-12', count: 1 }, { date: '2026-07-13', count: 0 },
  { date: '2026-07-14', count: 0 }, { date: '2026-07-15', count: 1 },
  { date: '2026-07-16', count: 0 }, { date: '2026-07-17', count: 0 },
  { date: '2026-07-18', count: 1 }, { date: '2026-07-19', count: 0 },
  { date: '2026-07-20', count: 0 }, { date: '2026-07-21', count: 1 },
  { date: '2026-07-22', count: 0 }, { date: '2026-07-23', count: 0 },
  { date: '2026-07-24', count: 1 }, { date: '2026-07-25', count: 0 },
  { date: '2026-07-26', count: 0 }, { date: '2026-07-27', count: 1 },
  { date: '2026-07-28', count: 0 }, { date: '2026-07-29', count: 0 },
  { date: '2026-07-30', count: 1 }, { date: '2026-07-31', count: 0 }
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('operator dashboard', () => {
  it.each(['/post-office', '/post-office/'])('renders aggregate counts at %s', async (path) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T16:00:00.000Z'));
    const getEmailActivity = vi.fn(async (_now: Date) => ({
      last24Hours: 2,
      days: [{ date: '2026-07-25', count: 2 }]
    }));
    const getSubscriptionActivity = vi.fn(async (_now: Date) => ({ days: THIRTY_DAILY_VALUES }));
    const db = makeStubDb({
      getSubscriberStats: vi.fn(async () => ({
        active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13
      })),
      getWeeklyDayStats: vi.fn(async () => [
        { sendDow: 0, active: 1, pending: 0 },
        { sendDow: 5, active: 10, pending: 1 }
      ]),
      getEmailActivity,
      getSubscriptionActivity
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: { viewer: { accounts: [{ hourly: [
        { dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: 5 } }
      ] }] } }, errors: null
    }))) as unknown as typeof fetch;
    try {
      const res = await handleRequest(
        new Request(`https://federalistreader.org${path}`),
        { ...ENV, CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_ANALYTICS_TOKEN: 'secret' },
        db,
        sender,
        fetchImpl
      );
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toBe('private, no-store');
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
      expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
      expect(html).toContain('Post Office');
      expect(html).toContain('<span class="stat__value">34</span>');
      expect(html).toContain('<th scope="row">Friday</th>');
      expect(html).toContain('Visits by Eastern date');
      expect(html).toContain('Confirmed subscriptions by Eastern date');
      expect(html).toContain('Sent mail');
      expect(getEmailActivity).toHaveBeenCalledOnce();
      expect(getSubscriptionActivity).toHaveBeenCalledOnce();
      expect(getSubscriptionActivity.mock.calls[0][0]).toBe(getEmailActivity.mock.calls[0][0]);
      expect(html).not.toMatch(/reader@example\.com|secret/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps visits and core figures when subscription and email activity fail', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T16:00:00.000Z'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeStubDb({
      getSubscriberStats: vi.fn(async () => ({
        active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13
      })),
      getSubscriptionActivity: vi.fn(async () => { throw new Error('private subscription error'); }),
      getEmailActivity: vi.fn(async () => { throw new Error('private email error'); })
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: { viewer: { accounts: [{ hourly: [
        { dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: 5 } }
      ] }] } }, errors: null
    }))) as unknown as typeof fetch;
    try {
      const res = await handleRequest(
        new Request('https://federalistreader.org/post-office/'),
        { ...ENV, CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_ANALYTICS_TOKEN: 'secret' },
        db,
        sender,
        fetchImpl
      );
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('<span class="stat__value">34</span>');
      expect(html).toContain('Visits by Eastern date');
      expect(html).toContain('Subscription activity temporarily unavailable');
      expect(html).toContain('Email activity temporarily unavailable');
      expect(html).not.toMatch(/private subscription error|private email error|secret/);
      expect(errorSpy.mock.calls).toEqual([
        ['dashboard email activity unavailable'],
        ['dashboard subscription activity unavailable']
      ]);
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('keeps visits and email activity when only subscription activity fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T16:00:00.000Z'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeStubDb({
      getSubscriptionActivity: vi.fn(async () => { throw new Error('private subscription error'); }),
      getEmailActivity: vi.fn(async () => ({
        last24Hours: 2,
        days: [{ date: '2026-07-31', count: 2 }]
      }))
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: { viewer: { accounts: [{ hourly: [
        { dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: 5 } }
      ] }] } }, errors: null
    }))) as unknown as typeof fetch;
    try {
      const res = await handleRequest(
        new Request('https://federalistreader.org/post-office/'),
        { ...ENV, CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_ANALYTICS_TOKEN: 'secret' },
        db,
        sender,
        fetchImpl
      );
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('Visits by Eastern date');
      expect(html).toContain('Sent emails by Eastern date');
      expect(html).toContain('Subscription activity temporarily unavailable');
      expect(html).not.toContain('Email activity temporarily unavailable');
      expect(html).not.toMatch(/private subscription error|secret/);
      expect(errorSpy.mock.calls).toEqual([
        ['dashboard subscription activity unavailable']
      ]);
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('keeps subscription and email activity when visit activity fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T16:00:00.000Z'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeStubDb({
      getSubscriptionActivity: vi.fn(async () => ({ days: THIRTY_DAILY_VALUES })),
      getEmailActivity: vi.fn(async () => ({
        last24Hours: 2,
        days: [{ date: '2026-07-31', count: 2 }]
      }))
    });
    const fetchImpl = vi.fn(async () => { throw new Error('private fetch error'); }) as unknown as typeof fetch;
    try {
      const res = await handleRequest(
        new Request('https://federalistreader.org/post-office/'),
        { ...ENV, CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_ANALYTICS_TOKEN: 'secret' },
        db,
        sender,
        fetchImpl
      );
      const html = await res.text();
      expect(res.status).toBe(200);
      expect(html).toContain('Confirmed subscriptions by Eastern date');
      expect(html).toContain('Sent emails by Eastern date');
      expect(html).toContain('Visit activity temporarily unavailable');
      expect(html).not.toMatch(/private fetch error|secret/);
      expect(errorSpy.mock.calls).toEqual([
        ['dashboard visit activity unavailable']
      ]);
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it('starts all optional dashboard loads before waiting for any one source', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T16:00:00.000Z'));
    const email = deferred<{ last24Hours: number; days: Array<{ date: string; count: number }> }>();
    const subscriptions = deferred<{ days: Array<{ date: string; count: number }> }>();
    const visits = deferred<Response>();
    const getEmailActivity = vi.fn(() => email.promise);
    const getSubscriptionActivity = vi.fn(() => subscriptions.promise);
    const fetchImpl = vi.fn(() => visits.promise) as unknown as typeof fetch;
    const db = makeStubDb({ getEmailActivity, getSubscriptionActivity });
    try {
      const responsePromise = handleRequest(
        new Request('https://federalistreader.org/post-office/'),
        { ...ENV, CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_ANALYTICS_TOKEN: 'secret' },
        db,
        sender,
        fetchImpl
      );
      await new Promise<void>((resolve) => queueMicrotask(resolve));

      expect(getEmailActivity).toHaveBeenCalledOnce();
      expect(getSubscriptionActivity).toHaveBeenCalledOnce();
      expect(fetchImpl).toHaveBeenCalledOnce();

      email.resolve({ last24Hours: 0, days: [] });
      subscriptions.resolve({ days: THIRTY_DAILY_VALUES });
      visits.resolve(new Response(JSON.stringify({
        data: { viewer: { accounts: [{ hourly: [] }] } }, errors: null
      })));
      expect((await responsePromise).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects non-GET methods without querying D1', async () => {
    const db = makeStubDb();
    const res = await handleRequest(new Request(
      'https://federalistreader.org/post-office/',
      { method: 'POST' }
    ), ENV, db, sender);

    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(db.getSubscriberStats).not.toHaveBeenCalled();
    expect(db.getWeeklyDayStats).not.toHaveBeenCalled();
  });

  it('returns a private generic error when a statistics query fails', async () => {
    const db = makeStubDb({
      getSubscriberStats: vi.fn(async () => {
        throw new Error('D1_ERROR: SELECT email FROM subscribers');
      })
    });
    const res = await handleRequest(
      new Request('https://federalistreader.org/post-office/'), ENV, db, sender);
    const html = await res.text();

    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(html).toContain('The figures could not be loaded');
    expect(html).not.toContain('D1_ERROR');
    expect(html).not.toContain('SELECT email');
  });

  it('keeps visits and subscription activity when only email activity fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T16:00:00.000Z'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = makeStubDb({
      getSubscriberStats: vi.fn(async () => ({
        active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13
      })),
      getWeeklyDayStats: vi.fn(async () => [
        { sendDow: 5, active: 10, pending: 1 }
      ]),
      getSubscriptionActivity: vi.fn(async () => ({ days: THIRTY_DAILY_VALUES })),
      getEmailActivity: vi.fn(async () => {
        throw new Error('D1_ERROR: private@example.com');
      })
    });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: { viewer: { accounts: [{ hourly: [
        { dimensions: { datetimeHour: '2026-07-31T14:00:00Z' }, sum: { visits: 5 } }
      ] }] } }, errors: null
    }))) as unknown as typeof fetch;
    try {
      const res = await handleRequest(
        new Request('https://federalistreader.org/post-office/'),
        { ...ENV, CLOUDFLARE_ACCOUNT_ID: 'account', CLOUDFLARE_ANALYTICS_TOKEN: 'secret' },
        db,
        sender,
        fetchImpl
      );
      const html = await res.text();

      expect(res.status).toBe(200);
      expect(html).toContain('<span class="stat__value">34</span>');
      expect(html).toContain('<th scope="row">Friday</th>');
      expect(html).toContain('Visits by Eastern date');
      expect(html).toContain('Confirmed subscriptions by Eastern date');
      expect(html).toContain('Email activity temporarily unavailable');
      expect(html).not.toContain('Visit activity temporarily unavailable');
      expect(html).not.toContain('Subscription activity temporarily unavailable');
      expect(html).not.toMatch(/D1_ERROR|private@example\.com|secret/);
      expect(errorSpy.mock.calls).toEqual([
        ['dashboard email activity unavailable']
      ]);
    } finally {
      errorSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});

describe('POST /api/subscribe', () => {
  it('creates a pending subscriber with a next-day send day, sends confirmation, redirects', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-20T16:00:00Z')); // Monday noon Eastern
    try {
      const db = makeStubDb();
      const res = await handleRequest(
        post('/api/subscribe', { email: 'reader@example.com', program: 'weekly' }), ENV, db, sender);
      expect(res.status).toBe(303);
      expect(res.headers.get('Location')).toBe('https://federalistreader.org/subscribe/check-inbox/');
      expect(db.upsertPending).toHaveBeenCalledWith('reader@example.com', 'weekly', expect.any(String), 2);
      expect(sent[0].subject).toContain('Confirm');
      expect(db.recordEmailSend).toHaveBeenCalledWith('msg_test', expect.any(String), 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('tolerates a trailing slash on the route (trailingSlash: always site)', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/subscribe/', { email: 'reader@example.com', program: 'weekly' }), ENV, db, sender);
    expect(res.status).toBe(303);
    expect(db.upsertPending).toHaveBeenCalled();
  });

  it('silently accepts honeypot submissions without touching the database', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/subscribe', { email: 'bot@example.com', program: 'weekly', contact_time: 'gotcha' }),
      ENV, db, sender);
    expect(res.status).toBe(303);
    expect(db.upsertPending).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
  });

  it('rejects an invalid program or email with 400', async () => {
    const res = await handleRequest(
      post('/api/subscribe', { email: 'not-an-email', program: 'daily' }), ENV, makeStubDb(), sender);
    expect(res.status).toBe(400);
  });

  it('sends a manage link instead of re-confirming an active subscriber', async () => {
    const db = makeStubDb({ getSubscriberByEmail: vi.fn(async () => ({ ...SUB, status: 'active' as const })) });
    await handleRequest(post('/api/subscribe', { email: SUB.email, program: 'weekly' }), ENV, db, sender);
    expect(db.upsertPending).not.toHaveBeenCalled();
    expect(sent[0].subject).toContain('already');
    expect(db.recordEmailSend).toHaveBeenCalledWith('msg_test', expect.any(String), 1);
  });
});

describe('GET /api/confirm', () => {
  it('activates on a valid token and sends the welcome email', async () => {
    const { signToken } = await import('../src/tokens');
    const token = await signToken(7, 'confirm', ENV.TOKEN_SECRET, SUB.token_secret);
    const db = makeStubDb();
    const res = await handleRequest(
      new Request(`https://federalistreader.org/api/confirm?token=${token}`), ENV, db, sender);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://federalistreader.org/subscribe/confirmed/');
    expect(db.activate).toHaveBeenCalledWith(7, null);
    expect(sent[0].subject).toContain('Welcome');
    expect(db.recordEmailSend).toHaveBeenCalledWith('msg_test', expect.any(String), 1);
  });

  it('keeps confirmation successful when activity recording fails', async () => {
    const db = makeStubDb({
      recordEmailSend: vi.fn(async () => {
        throw new Error('D1 unavailable');
      })
    });
    const res = await handleRequest(
      post('/api/subscribe', { email: 'reader@example.com', program: 'weekly' }),
      ENV,
      db,
      sender
    );

    expect(res.status).toBe(303);
    expect(sent).toHaveLength(1);
  });

  it('rejects a bad token with 400', async () => {
    const res = await handleRequest(
      new Request('https://federalistreader.org/api/confirm?token=junk'), ENV, makeStubDb(), sender);
    expect(res.status).toBe(400);
  });
});

describe('manage', () => {
  it('renders the manage page for a valid token', async () => {
    const db = makeStubDb({ getSubscriberById: vi.fn(async () => ({ ...SUB, status: 'active' as const, progress_index: 23 })) });
    const res = await handleRequest(
      new Request(`https://federalistreader.org/manage?token=${await manageToken()}`), ENV, db, sender);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('23 of 93 in the debate');
  });

  it('pauses with an optional resume date', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/manage', { token: await manageToken(), action: 'pause', until: '2026-09-01' }), ENV, db, sender);
    expect(res.status).toBe(303);
    expect(db.setStatus).toHaveBeenCalledWith(7, 'paused', '2026-09-01');
  });

  it('switches program and restarts', async () => {
    const db = makeStubDb();
    await handleRequest(post('/api/manage', { token: await manageToken(), action: 'switch' }), ENV, db, sender);
    expect(db.setProgram).toHaveBeenCalledWith(7, 'calendar', 0);
    await handleRequest(post('/api/manage', { token: await manageToken(), action: 'restart' }), ENV, db, sender);
    expect(db.setProgress).toHaveBeenCalledWith(7, 0);
  });

  it('shows the delivery day and a picker for weekly subscribers', async () => {
    const db = makeStubDb({ getSubscriberById: vi.fn(async () => ({ ...SUB, status: 'active' as const, send_dow: 2 })) });
    const res = await handleRequest(
      new Request(`https://federalistreader.org/manage?token=${await manageToken()}`), ENV, db, sender);
    const html = await res.text();
    expect(html).toContain('arriving Tuesdays');
    expect(html).toContain('<option value="2" selected>Tuesday</option>');
  });

  it('hides the day picker for calendar subscribers', async () => {
    const db = makeStubDb({ getSubscriberById: vi.fn(async () => ({ ...SUB, status: 'active' as const, program: 'calendar' as const })) });
    const res = await handleRequest(
      new Request(`https://federalistreader.org/manage?token=${await manageToken()}`), ENV, db, sender);
    expect(await res.text()).not.toContain('name="dow"');
  });

  it('sets the delivery day', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/manage', { token: await manageToken(), action: 'setday', dow: '3' }), ENV, db, sender);
    expect(res.status).toBe(303);
    expect(db.setSendDow).toHaveBeenCalledWith(7, 3);
  });

  it('rejects an out-of-range day with 400', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/manage', { token: await manageToken(), action: 'setday', dow: '9' }), ENV, db, sender);
    expect(res.status).toBe(400);
    expect(db.setSendDow).not.toHaveBeenCalled();
  });

  it('rejects a POST with an invalid token', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/manage', { token: 'junk', action: 'pause' }), ENV, db, sender);
    expect(res.status).toBe(400);
    expect(db.setStatus).not.toHaveBeenCalled();
  });

  it('rejects actions for an unsubscribed subscriber', async () => {
    const db = makeStubDb({ getSubscriberById: vi.fn(async () => ({ ...SUB, status: 'unsubscribed' as const })) });
    const res = await handleRequest(
      post('/api/manage', { token: await manageToken(), action: 'resume' }), ENV, db, sender);
    expect(res.status).toBe(400);
    expect(db.setStatus).not.toHaveBeenCalled();
    expect(db.setProgram).not.toHaveBeenCalled();
  });

  it('rejects a malformed pause date with 400', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/manage', { token: await manageToken(), action: 'pause', until: 'next Tuesday' }), ENV, db, sender);
    expect(res.status).toBe(400);
    expect(db.setStatus).not.toHaveBeenCalled();
  });
});

describe('unsubscribe', () => {
  it('renders a confirm form on GET without unsubscribing (scanner-safe)', async () => {
    const { signToken } = await import('../src/tokens');
    const token = await signToken(7, 'unsub', ENV.TOKEN_SECRET, SUB.token_secret);
    const db = makeStubDb();
    const res = await handleRequest(
      new Request(`https://federalistreader.org/api/unsubscribe?token=${token}`), ENV, db, sender);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<form');
    expect(db.unsubscribe).not.toHaveBeenCalled();
  });

  it('honors the RFC 8058 POST', async () => {
    const { signToken } = await import('../src/tokens');
    const token = await signToken(7, 'unsub', ENV.TOKEN_SECRET, SUB.token_secret);
    const db = makeStubDb();
    const res = await handleRequest(
      post(`/api/unsubscribe?token=${token}`, { 'List-Unsubscribe': 'One-Click' }), ENV, db, sender);
    expect(res.status).toBe(200);
    expect(db.unsubscribe).toHaveBeenCalledWith(7);
  });
});

describe('resend webhook', () => {
  const WEBHOOK_SECRET = `whsec_${btoa('test-webhook-secret')}`;
  const WEBHOOK_ENV = { ...ENV, RESEND_WEBHOOK_SECRET: WEBHOOK_SECRET } as Env;
  const BOUNCE = JSON.stringify({ type: 'email.bounced', data: { to: ['reader@example.com'] } });

  async function svixHeaders(payload: string): Promise<Record<string, string>> {
    const id = 'msg_webhook_1';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const keyBytes = Uint8Array.from(atob(WEBHOOK_SECRET.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
    const key = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signed = await crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
    const signature = btoa(String.fromCharCode(...new Uint8Array(signed)));
    return {
      'Content-Type': 'application/json',
      'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}`
    };
  }

  function webhookRequest(payload: string, headers: Record<string, string>): Request {
    return new Request('https://federalistreader.org/api/webhooks/resend', {
      method: 'POST', headers, body: payload
    });
  }

  it('fails closed with 401 when no signing secret is configured', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      webhookRequest(BOUNCE, await svixHeaders(BOUNCE)), ENV, db, sender);
    expect(res.status).toBe(401);
    expect(db.unsubscribeByEmail).not.toHaveBeenCalled();
  });

  it('unsubscribes on bounce with a valid signature', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      webhookRequest(BOUNCE, await svixHeaders(BOUNCE)), WEBHOOK_ENV, db, sender);
    expect(res.status).toBe(200);
    expect(db.unsubscribeByEmail).toHaveBeenCalledWith('reader@example.com');
  });

  it('rejects a bad signature with 401', async () => {
    const db = makeStubDb();
    const headers = await svixHeaders(BOUNCE);
    headers['svix-signature'] = `v1,${btoa('forged-signature-bytes-here-1234')}`;
    const res = await handleRequest(webhookRequest(BOUNCE, headers), WEBHOOK_ENV, db, sender);
    expect(res.status).toBe(401);
    expect(db.unsubscribeByEmail).not.toHaveBeenCalled();
  });

  it('records aggregate recipient count for a valid email.sent event', async () => {
    const payload = JSON.stringify({
      type: 'email.sent',
      data: {
        email_id: '56761188-7520-42d8-8898-ff6fc54ce618',
        created_at: '2026-07-25T12:34:56Z',
        to: ['first@example.com', 'second@example.com'],
        cc: ['copy@example.com'],
        bcc: ['blind@example.com'],
        subject: 'Must not be persisted'
      }
    });
    const db = makeStubDb();

    const res = await handleRequest(
      webhookRequest(payload, await svixHeaders(payload)), WEBHOOK_ENV, db, sender);

    expect(res.status).toBe(200);
    expect(db.recordEmailSend).toHaveBeenCalledWith(
      '56761188-7520-42d8-8898-ff6fc54ce618',
      '2026-07-25T12:34:56.000Z',
      4
    );
  });

  it.each([
    { email_id: '', created_at: '2026-07-25T12:34:56Z' },
    { email_id: 'id', created_at: 'not-a-date' }
  ])('rejects malformed email.sent data', async (data) => {
    const payload = JSON.stringify({ type: 'email.sent', data });
    const db = makeStubDb();

    const res = await handleRequest(
      webhookRequest(payload, await svixHeaders(payload)), WEBHOOK_ENV, db, sender);

    expect(res.status).toBe(400);
    expect(db.recordEmailSend).not.toHaveBeenCalled();
  });

  it('uses one as the defensive minimum recipient count', async () => {
    const payload = JSON.stringify({
      type: 'email.sent',
      data: { email_id: 'id', created_at: '2026-07-25T12:34:56Z' }
    });
    const db = makeStubDb();

    await handleRequest(
      webhookRequest(payload, await svixHeaders(payload)), WEBHOOK_ENV, db, sender);

    expect(db.recordEmailSend).toHaveBeenCalledWith(
      'id', '2026-07-25T12:34:56.000Z', 1
    );
  });

  it('returns a generic 500 when email.sent persistence fails', async () => {
    const payload = JSON.stringify({
      type: 'email.sent',
      data: {
        email_id: 'private-provider-id',
        created_at: '2026-07-25T12:34:56Z',
        to: ['private@example.com'],
        subject: 'Private subject'
      }
    });
    const db = makeStubDb({
      recordEmailSend: vi.fn(async () => {
        throw new Error('SQL detail');
      })
    });

    const res = await handleRequest(
      webhookRequest(payload, await svixHeaders(payload)), WEBHOOK_ENV, db, sender);
    const body = await res.text();

    expect(res.status).toBe(500);
    expect(body).toBe('webhook persistence failed');
    expect(body).not.toMatch(/private|provider|subject|SQL|example\.com/i);
  });
});
