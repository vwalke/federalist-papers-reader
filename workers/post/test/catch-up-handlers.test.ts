// workers/post/test/catch-up-handlers.test.ts
//
// Catch-up through the HTTP surface: the signup form's request, the grant at
// confirmation with the welcome letter for each season state, and the manage
// page's opt-in and opt-out.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleRequest } from '../src/handlers';
import { signToken } from '../src/tokens';
import type { Db } from '../src/db';
import type { DeliveredItem } from '../src/season';
import type { Env, Subscriber } from '../src/types';
import type { OutboundEmail } from '../src/resend';

const ENV = {
  SITE_URL: 'https://federalistreader.org',
  FROM_ADDRESS: 'Publius <publius@federalistreader.org>',
  RESEND_API_KEY: 'test-key',
  TOKEN_SECRET: 'env-secret',
  POSTAL_ADDRESS: '1 Test Lane'
} as Env;

function reader(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 7, email: 'reader@example.com', program: 'calendar', status: 'pending',
    progress_index: 0, send_dow: 6, paused_until: null, token_secret: 'subsecret', confirmed_at: null,
    makeup_pending: 0, catchup_requested: 0, catchup_items: null, catchup_starts_on: null, caught_up_on: null,
    ...overrides
  };
}

/** Every Db method is a no-op spy unless overridden. */
function stubDb(sub: Subscriber, opts: { lastRun?: string | null; held?: DeliveredItem[] } = {}) {
  const fns: Record<string, ReturnType<typeof vi.fn>> = {
    getSubscriberById: vi.fn(async () => sub),
    getSubscriberByEmail: vi.fn(async () => null),
    upsertPending: vi.fn(async () => sub),
    activate: vi.fn(async () => true),
    getLastDailyRun: vi.fn(async () => opts.lastRun ?? null),
    listDeliveredItems: vi.fn(async () => opts.held ?? [])
  };
  return new Proxy(fns, {
    get(target, key: string) {
      target[key] ??= vi.fn(async () => undefined);
      return target[key];
    }
  }) as unknown as { [K in keyof Db]: Db[K] & ReturnType<typeof vi.fn> };
}

let sent: OutboundEmail[];
const sender = async (_key: string, mail: OutboundEmail) => {
  sent.push(mail);
  return 'msg_test';
};

function at(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

beforeEach(() => { sent = []; });
afterEach(() => { vi.useRealTimers(); });

function post(path: string, form: Record<string, string>): Request {
  return new Request(`https://federalistreader.org${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString()
  });
}

async function confirm(db: Db): Promise<OutboundEmail> {
  const token = await signToken(7, 'confirm', ENV.TOKEN_SECRET, 'subsecret');
  await handleRequest(new Request(`https://federalistreader.org/api/confirm?token=${token}`, { method: 'POST' }),
    ENV, db, sender);
  expect(sent).toHaveLength(1);
  return sent[0];
}

const manageToken = () => signToken(7, 'manage', ENV.TOKEN_SECRET, 'subsecret');

describe('signup asks for catch-up', () => {
  const subscribe = (db: Db, form: Record<string, string>) =>
    handleRequest(post('/api/subscribe', { email: 'reader@example.com', ...form }), ENV, db, sender);

  it('records the request for As It Happened inside the window', async () => {
    at('2026-11-10T16:00:00Z');
    const db = stubDb(reader());
    await subscribe(db, { program: 'calendar', catchup: '1' });
    expect(db.upsertPending).toHaveBeenCalledWith('reader@example.com', 'calendar', expect.any(String), 3, true);
  });

  it('ignores it for the Weekly Course, after the cut-off, or when unticked', async () => {
    at('2026-11-10T16:00:00Z');
    const weekly = stubDb(reader());
    await subscribe(weekly, { program: 'weekly', catchup: '1' });
    expect(weekly.upsertPending).toHaveBeenCalledWith('reader@example.com', 'weekly', expect.any(String), 3, false);
    const unticked = stubDb(reader());
    await subscribe(unticked, { program: 'calendar' });
    expect(unticked.upsertPending.mock.calls[0][4]).toBe(false);
    at('2026-11-22T16:00:00Z');
    const late = stubDb(reader());
    await subscribe(late, { program: 'calendar', catchup: '1' });
    expect(late.upsertPending.mock.calls[0][4]).toBe(false);
  });

  it('points an existing calendar reader to the manage page', async () => {
    at('2026-11-10T16:00:00Z');
    const db = stubDb(reader());
    db.getSubscriberByEmail.mockResolvedValue(reader({ status: 'active' }));
    await subscribe(db, { program: 'calendar', catchup: '1' });
    expect(sent[0].text).toContain('To catch up on the papers already printed, open the manage page.');
    expect(db.upsertPending).not.toHaveBeenCalled();
  });
});

describe('confirmation grants catch-up and writes the right welcome', () => {
  it('after the morning run: everything through today, from tomorrow', async () => {
    at('2026-11-10T16:00:00Z');
    const db = stubDb(reader({ catchup_requested: 1 }), { lastRun: '2026-11-10' });
    const mail = await confirm(db);
    expect(db.startCatchUp).toHaveBeenCalledWith(7, [101, 1, 2, 102, 3, 4, 154, 5], '2026-11-11');
    expect(mail.text).toContain('eight papers were printed before you joined');
    expect(mail.text).toContain('they begin on Wednesday, November 11');
    expect(mail.text).toContain('The last arrives on Wednesday, November 18.');
    expect(mail.text).toContain('end the catch-up early');
    expect(mail.html).toContain('PUBLIUS.');
    expect(mail.html).not.toContain('The season opens <strong>October 18');
  });

  it('before the morning run: today’s paper comes live, so it is not in the backlog', async () => {
    at('2026-11-10T09:00:00Z');
    const db = stubDb(reader({ catchup_requested: 1 }), { lastRun: '2026-11-09' });
    await confirm(db);
    expect(db.startCatchUp).toHaveBeenCalledWith(7, [101, 1, 2, 102, 3, 4, 154], '2026-11-11');
  });

  it('a returning reader catches up only on what they do not already hold', async () => {
    at('2026-11-10T16:00:00Z');
    const held = [{ paper_number: 101, scheduled_for: '2026-10-18' }, { paper_number: 1, scheduled_for: '2026-10-27' }];
    const db = stubDb(reader({ catchup_requested: 1 }), { lastRun: '2026-11-10', held });
    await confirm(db);
    expect(db.startCatchUp).toHaveBeenCalledWith(7, [2, 102, 3, 4, 154, 5], '2026-11-11');
    expect(db.listDeliveredItems).toHaveBeenCalledWith(7, '2026-10-18');
  });

  it('a single paper behind reads in the singular', async () => {
    at('2026-10-20T16:00:00Z');
    const db = stubDb(reader({ catchup_requested: 1 }), { lastRun: '2026-10-20' });
    const mail = await confirm(db);
    expect(db.startCatchUp).toHaveBeenCalledWith(7, [101], '2026-10-21');
    expect(mail.text).toContain('one paper was printed before you joined');
    expect(mail.text).toContain('it arrives on Wednesday, October 21');
  });

  it('honours a request made by the cut-off through the life of the signup, and no further', async () => {
    at('2026-11-28T16:00:00Z');
    const slow = stubDb(reader({ catchup_requested: 1 }), { lastRun: '2026-11-28' });
    await confirm(slow);
    expect(slow.startCatchUp.mock.calls[0][1]).toHaveLength(16);
    sent = [];
    at('2026-11-29T16:00:00Z');
    const tooLate = stubDb(reader({ catchup_requested: 1 }), { lastRun: '2026-11-29' });
    const mail = await confirm(tooLate);
    expect(tooLate.startCatchUp).not.toHaveBeenCalled();
    expect(mail.text).toContain('Your first paper, Federalist No. 14, arrives on Monday, November 30');
  });

  it('without catch-up, names the first paper and its date instead of October 18', async () => {
    at('2026-11-10T16:00:00Z');
    const db = stubDb(reader(), { lastRun: '2026-11-10' });
    const mail = await confirm(db);
    expect(db.startCatchUp).not.toHaveBeenCalled();
    expect(mail.text).toContain('The season opened on October 18 with Brutus No. I and is under way.');
    expect(mail.text).toContain('Your first paper, Federalist No. 6, arrives on Saturday, November 14');
    expect(mail.text).toContain('read back: https://federalistreader.org/#all-papers');
    expect(mail.text).not.toContain('The season opens October 18');
  });

  it('before opening day keeps the season-opens letter', async () => {
    at('2026-10-12T16:00:00Z');
    const mail = await confirm(stubDb(reader({ catchup_requested: 1 }), { lastRun: '2026-10-12' }));
    expect(mail.text).toContain('The season opens October 18 — Brutus No. I fires first');
  });

  it('after the last paper looks ahead to the next season', async () => {
    at('2027-04-28T16:00:00Z');
    const mail = await confirm(stubDb(reader(), { lastRun: '2027-04-28' }));
    expect(mail.text).toContain('This season closed on April 26. The next opens on October 18');
  });

  it('the Weekly Course welcome is unchanged in substance', async () => {
    at('2026-11-10T16:00:00Z');
    const db = stubDb(reader({ program: 'weekly', send_dow: 3, catchup_requested: 1 }));
    const mail = await confirm(db);
    expect(db.startCatchUp).not.toHaveBeenCalled();
    expect(mail.text).toContain('Welcome to The Weekly Course.');
    expect(mail.text).toContain('Wednesday, November 11, 2026');
  });
});

describe('manage page', () => {
  const view = async (db: Db) => {
    const res = await handleRequest(
      new Request(`https://federalistreader.org/manage?token=${await manageToken()}`), ENV, db, sender);
    return res.text();
  };

  it('offers catch-up to a late calendar reader inside the window', async () => {
    at('2026-11-10T16:00:00Z');
    const html = await view(stubDb(reader({ status: 'active' }), { lastRun: '2026-11-10' }));
    expect(html).toContain('<h2>Catch up</h2>');
    expect(html).toContain('Eight papers were printed before you joined.');
    expect(html).toContain('value="catchup"');
  });

  it('offers nothing to a reader who has everything, to Weekly readers, or after the cut-off', async () => {
    at('2026-11-10T16:00:00Z');
    const held = [101, 1, 2, 102, 3, 4, 154, 5].map((id) => ({ paper_number: id, scheduled_for: '2026-11-01' }));
    expect(await view(stubDb(reader({ status: 'active' }), { lastRun: '2026-11-10', held }))).not.toContain('Catch up');
    expect(await view(stubDb(reader({ status: 'active', program: 'weekly' })))).not.toContain('Catch up');
    at('2026-11-22T16:00:00Z');
    expect(await view(stubDb(reader({ status: 'active' }), { lastRun: '2026-11-22' }))).not.toContain('Catch up');
  });

  it('shows progress and the finishing date while catching up', async () => {
    at('2026-11-14T16:00:00Z');
    const held = [101, 1, 2].map((id, i) => ({ paper_number: id, scheduled_for: `2026-11-1${1 + i}` }));
    const sub = reader({ status: 'active', catchup_items: '101,1,2,102,3,4,154,5', catchup_starts_on: '2026-11-11' });
    const html = await view(stubDb(sub, { lastRun: '2026-11-14', held }));
    expect(html).toContain('<h2>Catching up</h2>');
    expect(html).toContain('3 of 8 sent. The last arrives Thursday, November 19.');
    expect(html).toContain('End the catch-up');
  });

  it('says the catch-up waits while paused', async () => {
    at('2026-11-14T16:00:00Z');
    const sub = reader({ status: 'paused', catchup_items: '101,1', catchup_starts_on: '2026-11-11' });
    expect(await view(stubDb(sub))).toContain('The catch-up waits while your subscription is paused.');
  });

  it('starts and ends a catch-up', async () => {
    at('2026-11-10T16:00:00Z');
    const db = stubDb(reader({ status: 'active' }), { lastRun: '2026-11-10' });
    await handleRequest(post('/api/manage', { token: await manageToken(), action: 'catchup' }), ENV, db, sender);
    expect(db.startCatchUp).toHaveBeenCalledWith(7, [101, 1, 2, 102, 3, 4, 154, 5], '2026-11-11');
    await handleRequest(post('/api/manage', { token: await manageToken(), action: 'catchup-stop' }), ENV, db, sender);
    expect(db.stopCatchUp).toHaveBeenCalledWith(7);
  });

  it('refuses an opt-in after the cut-off or while already catching up', async () => {
    at('2026-11-22T16:00:00Z');
    const late = stubDb(reader({ status: 'active' }), { lastRun: '2026-11-22' });
    await handleRequest(post('/api/manage', { token: await manageToken(), action: 'catchup' }), ENV, late, sender);
    expect(late.startCatchUp).not.toHaveBeenCalled();
    at('2026-11-10T16:00:00Z');
    const already = stubDb(reader({ status: 'active', catchup_items: '101' }));
    await handleRequest(post('/api/manage', { token: await manageToken(), action: 'catchup' }), ENV, already, sender);
    expect(already.startCatchUp).not.toHaveBeenCalled();
  });
});
