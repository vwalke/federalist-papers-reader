// workers/post/test/deliver.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDaily } from '../src/deliver';
import type { Db } from '../src/db';
import type { Env, Subscriber } from '../src/types';

const ENV = {
  SITE_URL: 'https://federalistreader.org', FROM_ADDRESS: 'Publius <p@f.org>',
  RESEND_API_KEY: 'k', TOKEN_SECRET: 's', POSTAL_ADDRESS: 'addr'
} as Env;

function sub(overrides: Partial<Subscriber>): Subscriber {
  return {
    id: 1, email: 'a@example.com', program: 'weekly', status: 'active',
    progress_index: 0, send_dow: 6, paused_until: null,
    token_secret: 'ts', confirmed_at: '2026-07-01T00:00:00Z', ...overrides
  };
}

function makeStubDb(subscribers: Subscriber[]): Db & { claimed: string[] } {
  const claimed: string[] = [];
  return {
    claimed,
    getSubscriberById: vi.fn(async (id) => subscribers.find((s) => s.id === id) ?? null),
    getSubscriberByEmail: vi.fn(async () => null),
    upsertPending: vi.fn(), activate: vi.fn(), setStatus: vi.fn(), setProgram: vi.fn(),
    unsubscribe: vi.fn(), unsubscribeByEmail: vi.fn(), purgeUnsubscribed: vi.fn(async () => {}),
    purgeStalePending: vi.fn(async () => {}),
    setProgress: vi.fn(async () => {}),
    setSendDow: vi.fn(async () => {}),
    listDeliverable: vi.fn(async () => subscribers.filter((s) => s.status === 'active')),
    autoResume: vi.fn(async () => {}),
    claimDelivery: vi.fn(async (id, paper, date) => {
      const key = `${id}:${paper}:${date}`;
      if (claimed.includes(key)) return false;
      claimed.push(key);
      return true;
    }),
    markDelivery: vi.fn(async () => {}),
    listRetryable: vi.fn(async () => []),
    recordDailyRun: vi.fn(async () => {})
  } as unknown as Db & { claimed: string[] };
}

describe('runDaily', () => {
  let sent: Array<{ to: string; subject: string }>;
  const sender = async (_k: string, mail: { to: string; subject: string }) => {
    sent.push(mail); return 'msg';
  };
  beforeEach(() => { sent = []; });

  it('purges stale pending signups older than seven days', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, sender, '2026-07-18', 0);
    expect(db.purgeStalePending).toHaveBeenCalledWith(7);
  });

  it('sends the next weekly paper on Saturday and advances progress', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, sender, '2026-07-18', 0); // a Saturday
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('No. 5');
    expect(db.setProgress).toHaveBeenCalledWith(1, 5);
  });

  it('is idempotent across reruns of the same day', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, sender, '2026-07-18', 0);
    await runDaily(ENV, db, sender, '2026-07-18', 0);
    expect(sent).toHaveLength(1);
  });

  it('sends nothing on a non-send day', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, sender, '2026-07-20', 0); // Monday
    expect(sent).toHaveLength(0);
  });

  it('sends one combined issue to calendar subscribers on the season opener', async () => {
    const db = makeStubDb([sub({ program: 'calendar' })]);
    await runDaily(ENV, db, sender, '2026-10-27', 0);
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('No. 1');
  });

  it('marks a delivery failed when the sender throws, without advancing progress', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    const failing = async () => { throw new Error('resend down'); };
    await runDaily(ENV, db, failing, '2026-07-18', 0);
    expect(db.markDelivery).toHaveBeenCalledWith(1, 5, '2026-07-18', 'failed', undefined);
    expect(db.setProgress).not.toHaveBeenCalled();
  });

  it('retries a failed delivery, marks it sent, and advances weekly progress', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    vi.mocked(db.listRetryable).mockResolvedValue([
      { subscriber_id: 1, paper_number: 5, scheduled_for: '2026-07-18' }
    ]);
    await runDaily(ENV, db, sender, '2026-07-20', 0); // Monday: main loop no-ops
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('No. 5');
    expect(db.markDelivery).toHaveBeenCalledWith(1, 5, '2026-07-18', 'sent', 'msg');
    expect(db.setProgress).toHaveBeenCalledWith(1, 5);
  });

  it('retries without advancing progress when the paper is not ahead of it', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    vi.mocked(db.listRetryable).mockResolvedValue([
      { subscriber_id: 1, paper_number: 3, scheduled_for: '2026-07-04' }
    ]);
    await runDaily(ENV, db, sender, '2026-07-20', 0);
    expect(sent).toHaveLength(1);
    expect(db.markDelivery).toHaveBeenCalledWith(1, 3, '2026-07-04', 'sent', 'msg');
    expect(db.setProgress).not.toHaveBeenCalled();
  });

  it('records the heartbeat after a completed run', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, sender, '2026-07-18', 0);
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-07-18');
  });

  it('records the heartbeat even when every send fails', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    const failing = async () => { throw new Error('resend down'); };
    await runDaily(ENV, db, failing, '2026-07-18', 0);
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-07-18');
  });

  it('skips a retry whose subscriber has since unsubscribed', async () => {
    const db = makeStubDb([sub({ status: 'unsubscribed', progress_index: 4 })]);
    vi.mocked(db.listRetryable).mockResolvedValue([
      { subscriber_id: 1, paper_number: 5, scheduled_for: '2026-07-18' }
    ]);
    await runDaily(ENV, db, sender, '2026-07-20', 0);
    expect(sent).toHaveLength(0);
    expect(db.markDelivery).not.toHaveBeenCalled();
  });
});
