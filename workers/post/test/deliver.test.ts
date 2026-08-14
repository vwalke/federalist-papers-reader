// workers/post/test/deliver.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runDaily } from '../src/deliver';
import type { Db } from '../src/db';
import type { Env, Subscriber } from '../src/types';
import type { BatchEmailOutcome } from '../src/resend';

const ENV = {
  SITE_URL: 'https://federalistreader.org', FROM_ADDRESS: 'Publius <p@f.org>',
  RESEND_API_KEY: 'k', TOKEN_SECRET: 's', POSTAL_ADDRESS: 'addr'
} as Env;

function sub(overrides: Partial<Subscriber>): Subscriber {
  return {
    id: 1, email: 'a@example.com', program: 'weekly', status: 'active',
    progress_index: 0, send_dow: 6, paused_until: null, makeup_pending: 0,
    token_secret: 'ts', confirmed_at: '2026-07-01T00:00:00Z', ...overrides
  };
}

function makeStubDb(subscribers: Subscriber[]): Db & { claimed: string[] } {
  const claimed: string[] = [];
  return {
    claimed,
    getSubscriberStats: vi.fn(),
    getWeeklyDayStats: vi.fn(),
    getSubscriptionActivity: vi.fn(async () => ({ days: [] })),
    recordEmailSend: vi.fn(async () => {}),
    getEmailActivity: vi.fn(),
    purgeEmailSends: vi.fn(async () => {}),
    getSubscriberById: vi.fn(async (id) => subscribers.find((s) => s.id === id) ?? null),
    getSubscriberByEmail: vi.fn(async () => null),
    upsertPending: vi.fn(), activate: vi.fn(), setStatus: vi.fn(), setProgram: vi.fn(),
    unsubscribe: vi.fn(), unsubscribeByEmail: vi.fn(), purgeUnsubscribed: vi.fn(async () => {}),
    purgeStalePending: vi.fn(async () => {}),
    setProgress: vi.fn(async () => {}),
    clearMakeupPending: vi.fn(async () => {}),
    setSendDow: vi.fn(async () => {}),
    listDeliverable: vi.fn(async () => subscribers.filter((s) => s.status === 'active')),
    autoResume: vi.fn(async () => {}),
    claimDelivery: vi.fn(async (id, item, date) => {
      const key = `${id}:${item}:${date}`;
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
  let batchSizes: number[];
  let nextMessageId: number;
  const batchSender = async (
    _key: string,
    mails: Array<{ to: string; subject: string }>,
    _idempotencyKey: string
  ): Promise<BatchEmailOutcome[]> => {
    batchSizes.push(mails.length);
    sent.push(...mails);
    return mails.map(() => ({ status: 'sent', id: `msg_${nextMessageId++}` }));
  };
  beforeEach(() => {
    sent = [];
    batchSizes = [];
    nextMessageId = 1;
  });

  it('purges stale pending signups older than seven days', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, batchSender, '2026-07-18');
    expect(db.purgeStalePending).toHaveBeenCalledWith(7);
    expect(db.purgeEmailSends).toHaveBeenCalledWith(45);
  });

  it('opens a brand-new weekly subscriber with Brutus No. I', async () => {
    // Deliberate: progress 0 means sequence[0], and the debate begins with the
    // opposition — new readers meet Brutus before Publius answers.
    const db = makeStubDb([sub({ progress_index: 0 })]);
    await runDaily(ENV, db, batchSender, '2026-07-18'); // a Saturday
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('Brutus No. I');
    expect(db.setProgress).toHaveBeenCalledWith(1, 1);
  });

  it('sends the next merged item on Saturday and advances progress', async () => {
    // progress 4 = [Brutus I, Fed 1, Fed 2, Brutus II] consumed → Fed 3 is next.
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, batchSender, '2026-07-18'); // a Saturday
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('Federalist No. 3');
    expect(db.setProgress).toHaveBeenCalledWith(1, 5);
    expect(db.recordEmailSend).toHaveBeenCalledWith('msg_1', expect.any(String), 1);
  });

  it('is idempotent across reruns of the same day', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, batchSender, '2026-07-18');
    await runDaily(ENV, db, batchSender, '2026-07-18');
    expect(sent).toHaveLength(1);
  });

  it('sends nothing on a non-send day', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, batchSender, '2026-07-20'); // Monday
    expect(sent).toHaveLength(0);
  });

  it('sends one combined issue to calendar subscribers on a paper anniversary', async () => {
    const db = makeStubDb([sub({ program: 'calendar' })]);
    await runDaily(ENV, db, batchSender, '2026-10-27');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('No. 1');
  });

  it('sends Brutus No. I to calendar subscribers on October 18', async () => {
    const db = makeStubDb([sub({ program: 'calendar' })]);
    await runDaily(ENV, db, batchSender, '2026-10-18');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('Brutus No. I');
    expect(db.setProgress).not.toHaveBeenCalled();
  });

  describe('the make-up issue', () => {
    it('sends one catch-up email, records a delivery per essay, and clears the flag', async () => {
      // Migrated old progress 5 → 8; Brutus I & II and Cato IV ran behind.
      const db = makeStubDb([sub({ progress_index: 8, makeup_pending: 1 })]);
      await runDaily(ENV, db, batchSender, '2026-07-18');
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toBe('The other side of the argument — a catch-up from the New-York Journal');
      for (const essayId of [101, 102, 154]) {
        expect(db.claimDelivery).toHaveBeenCalledWith(1, essayId, '2026-07-18');
        expect(db.markDelivery).toHaveBeenCalledWith(1, essayId, '2026-07-18', 'sent', 'msg_1');
      }
      expect(db.clearMakeupPending).toHaveBeenCalledWith(1);
      expect(db.setProgress).not.toHaveBeenCalled();
    });

    it('does not double the make-up on a same-day rerun', async () => {
      const db = makeStubDb([sub({ progress_index: 8, makeup_pending: 1 })]);
      await runDaily(ENV, db, batchSender, '2026-07-18');
      await runDaily(ENV, db, batchSender, '2026-07-18');
      expect(sent).toHaveLength(1);
    });

    it('clears the flag even when the send fails, leaving retries to the failed rows', async () => {
      const db = makeStubDb([sub({ progress_index: 8, makeup_pending: 1 })]);
      const failing = async () => { throw new Error('resend down'); };
      await runDaily(ENV, db, failing, '2026-07-18');
      expect(db.clearMakeupPending).toHaveBeenCalledWith(1);
      expect(db.markDelivery).toHaveBeenCalledWith(1, 101, '2026-07-18', 'failed', undefined);
      expect(db.setProgress).not.toHaveBeenCalled();
    });

    it('resumes the merged sequence the week after the make-up', async () => {
      const db = makeStubDb([sub({ progress_index: 8, makeup_pending: 0 })]);
      await runDaily(ENV, db, batchSender, '2026-07-18');
      expect(sent).toHaveLength(1);
      expect(sent[0].subject).toContain('Federalist No. 6'); // sequence[8]
      expect(db.setProgress).toHaveBeenCalledWith(1, 9);
    });
  });

  it('marks a delivery failed when the sender throws, without advancing progress', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    const failing = async () => { throw new Error('resend down'); };
    await runDaily(ENV, db, failing, '2026-07-18');
    expect(db.markDelivery).toHaveBeenCalledWith(1, 3, '2026-07-18', 'failed', undefined);
    expect(db.setProgress).not.toHaveBeenCalled();
  });

  it('retries a failed delivery, marks it sent, and advances weekly progress', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    vi.mocked(db.listRetryable).mockResolvedValue([
      { subscriber_id: 1, paper_number: 3, scheduled_for: '2026-07-18' }
    ]);
    await runDaily(ENV, db, batchSender, '2026-07-20'); // Monday: main loop no-ops
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('Federalist No. 3');
    expect(db.markDelivery).toHaveBeenCalledWith(1, 3, '2026-07-18', 'sent', 'msg_1');
    expect(db.setProgress).toHaveBeenCalledWith(1, 5);
    expect(db.recordEmailSend).toHaveBeenCalledWith('msg_1', expect.any(String), 1);
  });

  it('keeps an accepted delivery sent when activity recording fails', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    vi.mocked(db.recordEmailSend).mockRejectedValue(new Error('D1 unavailable'));

    await runDaily(ENV, db, batchSender, '2026-07-18');

    expect(sent).toHaveLength(1);
    expect(db.markDelivery).toHaveBeenCalledWith(1, 3, '2026-07-18', 'sent', 'msg_1');
    expect(db.setProgress).toHaveBeenCalledWith(1, 5);
  });

  it('retries a make-up essay as its own issue without advancing progress', async () => {
    const db = makeStubDb([sub({ progress_index: 8 })]);
    vi.mocked(db.listRetryable).mockResolvedValue([
      { subscriber_id: 1, paper_number: 101, scheduled_for: '2026-07-18' }
    ]);
    await runDaily(ENV, db, batchSender, '2026-07-20');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toContain('Brutus No. I');
    expect(db.markDelivery).toHaveBeenCalledWith(1, 101, '2026-07-18', 'sent', 'msg_1');
    expect(db.setProgress).not.toHaveBeenCalled();
  });

  it('records the heartbeat after a completed run', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    await runDaily(ENV, db, batchSender, '2026-07-18');
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-07-18');
  });

  it('records the heartbeat even when every send fails', async () => {
    const db = makeStubDb([sub({ progress_index: 4 })]);
    const failing = async () => { throw new Error('resend down'); };
    await runDaily(ENV, db, failing, '2026-07-18');
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-07-18');
  });

  it('skips a retry whose subscriber has since unsubscribed', async () => {
    const db = makeStubDb([sub({ status: 'unsubscribed', progress_index: 4 })]);
    vi.mocked(db.listRetryable).mockResolvedValue([
      { subscriber_id: 1, paper_number: 3, scheduled_for: '2026-07-18' }
    ]);
    await runDaily(ENV, db, batchSender, '2026-07-20');
    expect(sent).toHaveLength(0);
    expect(db.markDelivery).not.toHaveBeenCalled();
  });

  it('sends 100 due subscribers in one batch', async () => {
    const subscribers = Array.from({ length: 100 }, (_, index) => sub({
      id: index + 1,
      email: `reader${index + 1}@example.com`,
      progress_index: 4
    }));
    await runDaily(ENV, makeStubDb(subscribers), batchSender, '2026-07-18');
    expect(sent).toHaveLength(100);
    expect(batchSizes).toEqual([100]);
  });

  it('splits 101 due subscribers into batches of 100 and one', async () => {
    const subscribers = Array.from({ length: 101 }, (_, index) => sub({
      id: index + 1,
      email: `reader${index + 1}@example.com`,
      progress_index: 4
    }));
    await runDaily(ENV, makeStubDb(subscribers), batchSender, '2026-07-18');
    expect(sent).toHaveLength(101);
    expect(batchSizes).toEqual([100, 1]);
  });

  it('flushes a full batch before preparing the next subscriber', async () => {
    const subscribers = Array.from({ length: 101 }, (_, index) => sub({
      id: index + 1,
      email: `reader${index + 1}@example.com`,
      progress_index: 4
    }));
    const db = makeStubDb(subscribers);
    const events: string[] = [];
    vi.mocked(db.claimDelivery).mockImplementation(async (id) => {
      events.push(`claim:${id}`);
      return true;
    });
    const observingSender = async (
      _key: string,
      mails: Array<{ to: string; subject: string }>
    ): Promise<BatchEmailOutcome[]> => {
      events.push(`send:${mails.length}`);
      return mails.map((_, index) => ({ status: 'sent', id: `msg_${index + 1}` }));
    };

    await runDaily(ENV, db, observingSender, '2026-07-18');

    expect(events.indexOf('send:100')).toBeLessThan(events.indexOf('claim:101'));
  });

  it('uses a stable versioned idempotency key for the same delivery chunk', async () => {
    const keys: string[] = [];
    const collectingSender = async (
      _key: string,
      mails: Array<{ to: string; subject: string }>,
      idempotencyKey: string
    ): Promise<BatchEmailOutcome[]> => {
      keys.push(idempotencyKey);
      return mails.map((_, index) => ({ status: 'sent', id: `msg_${index + 1}` }));
    };
    const subscribers = [sub({ id: 7, progress_index: 4 })];

    await runDaily(ENV, makeStubDb(subscribers), collectingSender, '2026-07-18');
    await runDaily(ENV, makeStubDb(subscribers), collectingSender, '2026-07-18');

    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^scheduled-delivery\/v1\/[a-f0-9]{64}$/);
    expect(keys[1]).toBe(keys[0]);
  });

  it('marks only a rejected batch item failed', async () => {
    const subscribers = [
      sub({ id: 1, email: 'first@example.com', progress_index: 4 }),
      sub({ id: 2, email: 'second@example.com', progress_index: 4 })
    ];
    const db = makeStubDb(subscribers);
    const partial = async (): Promise<BatchEmailOutcome[]> => [
      { status: 'sent', id: 'msg_ok' },
      { status: 'failed', error: 'invalid recipient' }
    ];

    await runDaily(ENV, db, partial, '2026-07-18');

    expect(db.markDelivery).toHaveBeenCalledWith(
      1, 3, '2026-07-18', 'sent', 'msg_ok'
    );
    expect(db.markDelivery).toHaveBeenCalledWith(
      2, 3, '2026-07-18', 'failed', undefined
    );
    expect(db.setProgress).toHaveBeenCalledWith(1, 5);
    expect(db.setProgress).not.toHaveBeenCalledWith(2, 5);
  });

  it('marks every item failed when a batch request rejects', async () => {
    const subscribers = [
      sub({ id: 1, email: 'first@example.com', progress_index: 4 }),
      sub({ id: 2, email: 'second@example.com', progress_index: 4 })
    ];
    const db = makeStubDb(subscribers);
    const rejected = async (): Promise<BatchEmailOutcome[]> => {
      throw new Error('Resend 503');
    };

    await runDaily(ENV, db, rejected, '2026-07-18');

    expect(db.markDelivery).toHaveBeenCalledWith(
      1, 3, '2026-07-18', 'failed', undefined
    );
    expect(db.markDelivery).toHaveBeenCalledWith(
      2, 3, '2026-07-18', 'failed', undefined
    );
    expect(db.setProgress).not.toHaveBeenCalled();
  });
});
