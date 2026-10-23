// workers/post/test/catch-up-deliver.test.ts
//
// runDaily for As It Happened readers who are catching up, against an
// in-memory stand-in for the deliveries table so progress, reruns, and
// retries behave as they do on D1.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runConfirmReminders, runDaily } from '../src/deliver';
import { addDays } from '../src/season';
import type { Db } from '../src/db';
import type { Env, Subscriber } from '../src/types';
import type { BatchEmailOutcome, OutboundEmail } from '../src/resend';

const ENV = {
  SITE_URL: 'https://federalistreader.org', FROM_ADDRESS: 'Publius <p@f.org>',
  RESEND_API_KEY: 'k', TOKEN_SECRET: 's', POSTAL_ADDRESS: 'addr'
} as Env;

/** Joined on November 21 after the run: twelve to catch up, from November 22. */
const TWELVE = '101,1,2,102,3,4,154,5,6,7,8,9';

function reader(overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 1, email: 'late@example.com', program: 'calendar', status: 'active',
    progress_index: 0, send_dow: 6, paused_until: null, makeup_pending: 0,
    token_secret: 'ts', confirmed_at: '2026-11-21T15:00:00Z',
    catchup_requested: 0, catchup_items: TWELVE, catchup_starts_on: '2026-11-22', caught_up_on: null,
    ...overrides
  };
}

interface Row { subscriber_id: number; paper_number: number; scheduled_for: string; status: string }

function makeDb(subscribers: Subscriber[]) {
  const rows: Row[] = [];
  const db = {
    rows,
    getSubscriberStats: vi.fn(), getWeeklyDayStats: vi.fn(), getSubscriptionActivity: vi.fn(),
    recordEmailSend: vi.fn(async () => {}), recordEmailDelivery: vi.fn(async () => {}),
    getEmailActivity: vi.fn(), purgeEmailSends: vi.fn(async () => {}),
    getSubscriberById: vi.fn(async (id: number) => subscribers.find((s) => s.id === id) ?? null),
    getSubscriberByEmail: vi.fn(async () => null),
    upsertPending: vi.fn(), activate: vi.fn(), setStatus: vi.fn(), setProgram: vi.fn(),
    setProgress: vi.fn(async () => {}), clearMakeupPending: vi.fn(async () => {}),
    setSendDow: vi.fn(async () => {}), unsubscribe: vi.fn(), unsubscribeByEmail: vi.fn(),
    listDeliverable: vi.fn(async () => subscribers.filter((s) => s.status === 'active')),
    autoResume: vi.fn(async () => {}),
    claimDelivery: vi.fn(async (subscriberId: number, paperNumber: number, scheduledFor: string) => {
      if (rows.some((r) => r.subscriber_id === subscriberId && r.paper_number === paperNumber &&
        r.scheduled_for === scheduledFor)) return false;
      rows.push({ subscriber_id: subscriberId, paper_number: paperNumber, scheduled_for: scheduledFor, status: 'queued' });
      return true;
    }),
    markDelivery: vi.fn(async (subscriberId: number, paperNumber: number, scheduledFor: string, status: string) => {
      const row = rows.find((r) => r.subscriber_id === subscriberId && r.paper_number === paperNumber &&
        r.scheduled_for === scheduledFor);
      if (row) row.status = status;
    }),
    listRetryable: vi.fn(async () => rows.filter((r) => r.status === 'failed')),
    listDeliveredItems: vi.fn(async (subscriberId: number, sinceIso: string) =>
      rows.filter((r) => r.subscriber_id === subscriberId && r.scheduled_for >= sinceIso)
        .map(({ paper_number, scheduled_for }) => ({ paper_number, scheduled_for }))),
    startCatchUp: vi.fn(async () => {}),
    stopCatchUp: vi.fn(async () => {}),
    markCaughtUp: vi.fn(async (id: number, onIso: string) => {
      const sub = subscribers.find((s) => s.id === id);
      if (sub && !sub.caught_up_on) sub.caught_up_on = onIso;
    }),
    getLastDailyRun: vi.fn(async () => null),
    claimAnnouncement: vi.fn(async () => true), markAnnouncement: vi.fn(async () => {}),
    listRetryableAnnouncement: vi.fn(async () => []),
    purgeUnsubscribed: vi.fn(async () => {}),
    listConfirmReminderDue: vi.fn(async () => [] as Subscriber[]),
    claimConfirmReminder: vi.fn(async () => true),
    purgeStalePending: vi.fn(async () => {}),
    recordDailyRun: vi.fn(async () => {})
  };
  return db as unknown as Db & typeof db;
}

let sent: OutboundEmail[];
let failures: number;
const batchSender = async (_key: string, mails: OutboundEmail[]): Promise<BatchEmailOutcome[]> => {
  if (failures > 0) {
    failures--;
    return mails.map(() => ({ status: 'failed', error: 'provider down' }));
  }
  sent.push(...mails);
  return mails.map((_, i) => ({ status: 'sent', id: `msg_${sent.length}_${i}` }));
};
beforeEach(() => {
  sent = [];
  failures = 0;
});

describe('catch-up mornings', () => {
  it('sends nothing before the first catch-up morning but the day’s own paper', async () => {
    const db = makeDb([reader({ catchup_starts_on: '2026-11-23' })]);
    await runDaily(ENV, db, batchSender, '2026-11-22');
    expect(sent.map((m) => m.subject)).toEqual(['Federalist No. 10 — The Same Subject Continued (The Union as a Safeguard Against Domestic Faction and Insurrection)']);
  });

  it('carries today’s paper and the first catch-up in one letter, today’s first', async () => {
    const db = makeDb([reader()]);
    await runDaily(ENV, db, batchSender, '2026-11-22');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Federalist No. 10, with catch-up 1 of 12');
    const html = sent[0].html;
    expect(html.indexOf('No. 10.')).toBeLessThan(html.indexOf('BRUTUS. No. I.'));
    expect(html).toContain('Two papers this morning');
    expect(html).toContain('Catch-up 1 of 12 · As It Happened');
    expect(db.rows.map((r) => [r.paper_number, r.scheduled_for])).toEqual([[10, '2026-11-22'], [101, '2026-11-22']]);
  });

  it('sends a catch-up alone on a morning with no anniversary', async () => {
    const db = makeDb([reader({ catchup_starts_on: '2026-11-23' })]);
    await runDaily(ENV, db, batchSender, '2026-11-23');
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Catch-up 1 of 12: Brutus No. I — Against the Consolidated Republic');
    // A lone essay keeps the Journal's masthead; the first catch-up says what is coming.
    expect(sent[0].html).toContain('The New-York Journal');
    expect(sent[0].html).toContain('Here your catch-up begins: twelve papers already printed');
    expect(sent[0].text).toContain('CATCH-UP 1 OF 12');
  });

  it('is idempotent across reruns of the same morning', async () => {
    const db = makeDb([reader()]);
    await runDaily(ENV, db, batchSender, '2026-11-23');
    await runDaily(ENV, db, batchSender, '2026-11-23');
    await runDaily(ENV, db, batchSender, '2026-11-23');
    expect(sent).toHaveLength(1);
    expect(db.rows).toHaveLength(1);
  });

  it('runs the whole backlog, one a morning, and closes with the caught-up note', async () => {
    const sub = reader();
    const db = makeDb([sub]);
    for (let day = '2026-11-22'; day <= '2026-12-04'; day = addDays(day, 1)) {
      await runDaily(ENV, db, batchSender, day);
    }
    const catchUps = sent.filter((m) => /catch-up/i.test(m.subject));
    expect(catchUps).toHaveLength(12);
    const last = catchUps.at(-1)!;
    // December 3 carries no anniversary, so the last catch-up goes alone.
    expect(last.subject).toBe('The last catch-up: Federalist No. 9 — The Union as a Safeguard Against Domestic Faction and Insurrection');
    expect(last.html).toContain('<strong>You are caught up.</strong>');
    expect(last.html).toContain('The next, Federalist No. 16, comes on Friday, December 4.');
    expect(last.html).toContain('PUBLIUS.');
    expect(last.text).toContain('You are caught up.');
    expect(sub.caught_up_on).toBe('2026-12-03');
    expect(db.markCaughtUp).toHaveBeenCalledTimes(1);
    // Afterwards: anniversaries only, and no more backlog lookups.
    const lookups = db.listDeliveredItems.mock.calls.length;
    await runDaily(ENV, db, batchSender, '2026-12-05');
    expect(sent.at(-1)!.subject).toMatch(/^Federalist No\. 17 — /);
    expect(db.listDeliveredItems.mock.calls.length).toBe(lookups);
  });

  it('closes a combined last morning with the note below both papers', async () => {
    const db = makeDb([reader({ catchup_items: '101,1', catchup_starts_on: '2026-11-21' })]);
    await runDaily(ENV, db, batchSender, '2026-11-21');
    await runDaily(ENV, db, batchSender, '2026-11-22');
    expect(sent.at(-1)!.subject).toBe('Federalist No. 10, with the last catch-up');
    expect(sent.at(-1)!.html).toContain('below it the last of your catch-up');
    expect(sent.at(-1)!.html).toContain('You are caught up.');
  });

  it('pauses with the subscription and resumes where it left off', async () => {
    const sub = reader({ catchup_starts_on: '2026-11-23' });
    const db = makeDb([sub]);
    await runDaily(ENV, db, batchSender, '2026-11-23');
    sub.status = 'paused';
    await runDaily(ENV, db, batchSender, '2026-11-25');
    await runDaily(ENV, db, batchSender, '2026-11-26');
    sub.status = 'active';
    await runDaily(ENV, db, batchSender, '2026-11-27');
    expect(sent.map((m) => m.subject)).toEqual([
      'Catch-up 1 of 12: Brutus No. I — Against the Consolidated Republic',
      'Federalist No. 12, with catch-up 2 of 12'
    ]);
  });

  it('retries a failed catch-up as a catch-up letter, without a second paper the next morning', async () => {
    const db = makeDb([reader({ catchup_starts_on: '2026-11-23' })]);
    failures = 2; // the send, and the same run's retry of it
    await runDaily(ENV, db, batchSender, '2026-11-23');
    expect(sent).toHaveLength(0);
    // Next morning: the retry goes out as catch-up 1, and catch-up 2 rides with today's paper.
    await runDaily(ENV, db, batchSender, '2026-11-24');
    expect(sent.map((m) => m.subject)).toEqual([
      'Federalist No. 11, with catch-up 2 of 12',
      'Catch-up 1 of 12: Brutus No. I — Against the Consolidated Republic'
    ]);
  });

  it('leaves Weekly Course readers and caught-up readers alone', async () => {
    const weekly = reader({ id: 2, program: 'weekly', send_dow: 1 });
    const done = reader({ id: 3, caught_up_on: '2026-11-20' });
    const db = makeDb([weekly, done]);
    await runDaily(ENV, db, batchSender, '2026-11-23');
    expect(sent).toHaveLength(1); // the weekly reader's Monday letter
    expect(sent[0].subject).not.toMatch(/catch-up/i);
    expect(db.listDeliveredItems).not.toHaveBeenCalled();
  });
});

describe('confirmation reminder', () => {
  it('reassures a reader who asked for catch-up that it is kept for them', async () => {
    const mails: OutboundEmail[] = [];
    const db = makeDb([]);
    db.listConfirmReminderDue.mockResolvedValue([
      reader({ status: 'pending', catchup_requested: 1, catchup_items: null }),
      reader({ id: 2, email: 'b@example.com', status: 'pending', catchup_requested: 0, catchup_items: null })
    ]);
    await runConfirmReminders(ENV, db, async (_key, mail) => {
      mails.push(mail);
      return `msg_${mails.length}`;
    });
    expect(mails[0].text).toContain('The catch-up you asked for is kept for you');
    expect(mails[1].text).not.toContain('catch-up');
  });
});
