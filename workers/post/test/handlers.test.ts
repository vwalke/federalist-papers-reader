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
    activate: vi.fn(async (_id: number, _confirmIp: string | null) => {}),
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
    purgeStalePending: vi.fn(async () => {}),
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

  function webhookRequest(headers: Record<string, string>): Request {
    return new Request('https://federalistreader.org/api/webhooks/resend', {
      method: 'POST', headers, body: BOUNCE
    });
  }

  it('fails closed with 401 when no signing secret is configured', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      webhookRequest(await svixHeaders(BOUNCE)), ENV, db, sender);
    expect(res.status).toBe(401);
    expect(db.unsubscribeByEmail).not.toHaveBeenCalled();
  });

  it('unsubscribes on bounce with a valid signature', async () => {
    const db = makeStubDb();
    const res = await handleRequest(
      webhookRequest(await svixHeaders(BOUNCE)), WEBHOOK_ENV, db, sender);
    expect(res.status).toBe(200);
    expect(db.unsubscribeByEmail).toHaveBeenCalledWith('reader@example.com');
  });

  it('rejects a bad signature with 401', async () => {
    const db = makeStubDb();
    const headers = await svixHeaders(BOUNCE);
    headers['svix-signature'] = `v1,${btoa('forged-signature-bytes-here-1234')}`;
    const res = await handleRequest(webhookRequest(headers), WEBHOOK_ENV, db, sender);
    expect(res.status).toBe(401);
    expect(db.unsubscribeByEmail).not.toHaveBeenCalled();
  });
});
