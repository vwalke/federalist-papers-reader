// workers/post/test/handlers.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/handlers';
import type { Db } from '../src/db';
import type { Env, Subscriber } from '../src/types';

const SUB: Subscriber = {
  id: 7, email: 'reader@example.com', program: 'weekly', status: 'pending',
  progress_index: 0, send_dow: 6, paused_until: null, token_secret: 'subsecret', confirmed_at: null
};

function makeStubDb(overrides: Partial<Db> = {}): Db {
  return {
    getSubscriberById: vi.fn(async () => SUB),
    getSubscriberByEmail: vi.fn(async () => null),
    upsertPending: vi.fn(async () => SUB),
    activate: vi.fn(async () => {}),
    setStatus: vi.fn(async () => {}),
    setProgram: vi.fn(async () => {}),
    setProgress: vi.fn(async () => {}),
    unsubscribe: vi.fn(async () => {}),
    unsubscribeByEmail: vi.fn(async () => {}),
    listDeliverable: vi.fn(async () => []),
    autoResume: vi.fn(async () => {}),
    claimDelivery: vi.fn(async () => true),
    markDelivery: vi.fn(async () => {}),
    listRetryable: vi.fn(async () => []),
    purgeUnsubscribed: vi.fn(async () => {}),
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

describe('POST /api/subscribe', () => {
  it('creates a pending subscriber, sends confirmation, redirects', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      post('/api/subscribe', { email: 'reader@example.com', program: 'weekly' }), ENV, db, sender);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('https://federalistreader.org/subscribe/check-inbox/');
    expect(db.upsertPending).toHaveBeenCalledWith('reader@example.com', 'weekly', expect.any(String));
    expect(sent[0].subject).toContain('Confirm');
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
    expect(db.activate).toHaveBeenCalledWith(7);
    expect(sent[0].subject).toContain('Welcome');
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
    expect(await res.text()).toContain('Paper 23 of 85');
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
});

describe('unsubscribe', () => {
  it('honors the one-click GET link', async () => {
    const { signToken } = await import('../src/tokens');
    const token = await signToken(7, 'unsub', ENV.TOKEN_SECRET, SUB.token_secret);
    const db = makeStubDb();
    const res = await handleRequest(
      new Request(`https://federalistreader.org/api/unsubscribe?token=${token}`), ENV, db, sender);
    expect(res.status).toBe(200);
    expect(db.unsubscribe).toHaveBeenCalledWith(7);
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
  it('unsubscribes on bounce when no signing secret is configured (dev mode)', async () => {
    const db = makeStubDb();
    const res = await handleRequest(new Request('https://federalistreader.org/api/webhooks/resend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'email.bounced', data: { to: ['reader@example.com'] } })
    }), ENV, db, sender);
    expect(res.status).toBe(200);
    expect(db.unsubscribeByEmail).toHaveBeenCalledWith('reader@example.com');
  });
});
