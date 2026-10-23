// workers/post/test/scheduled.test.ts
//
// The Worker's scheduled handler: two cron triggers fire each day, and only
// the one at 7am in New York runs the day, for that Eastern date. Reruns of
// the same morning lean on the delivery claims and send nothing more.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../src/db';
import type { Env, Subscriber } from '../src/types';
import type { BatchEmailOutcome, OutboundEmail } from '../src/resend';

const mocks = vi.hoisted(() => ({
  db: null as unknown,
  makeDb: vi.fn(),
  sendBatchEmails: vi.fn(),
  sendEmail: vi.fn()
}));

vi.mock('../src/db', () => ({ makeDb: mocks.makeDb }));
vi.mock('../src/resend', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/resend')>()),
  sendBatchEmails: mocks.sendBatchEmails,
  sendEmail: mocks.sendEmail
}));

const { default: worker } = await import('../src/index');

const ENV = {
  SITE_URL: 'https://federalistreader.org', FROM_ADDRESS: 'Publius <p@f.org>',
  RESEND_API_KEY: 'k', TOKEN_SECRET: 's', POSTAL_ADDRESS: 'addr', DB: {}
} as unknown as Env;

function reader(): Subscriber {
  return {
    id: 1, email: 'reader@example.com', program: 'calendar', status: 'active',
    progress_index: 0, send_dow: 6, paused_until: null, makeup_pending: 0,
    token_secret: 'ts', confirmed_at: '2026-10-01T15:00:00Z',
    catchup_requested: 0, catchup_items: null, catchup_starts_on: null, caught_up_on: null
  };
}

interface Row { subscriber_id: number; paper_number: number; scheduled_for: string; status: string }

/** An in-memory stand-in with a real claim table, so reruns behave as they do on D1. */
function memoryDb(subscribers: Subscriber[]) {
  const rows: Row[] = [];
  const same = (r: Row, id: number, paper: number, on: string) =>
    r.subscriber_id === id && r.paper_number === paper && r.scheduled_for === on;
  const db = {
    rows,
    recordEmailSend: vi.fn(async () => {}), purgeEmailSends: vi.fn(async () => {}),
    getSubscriberById: vi.fn(async (id: number) => subscribers.find((s) => s.id === id) ?? null),
    setProgress: vi.fn(async () => {}), clearMakeupPending: vi.fn(async () => {}),
    listDeliverable: vi.fn(async () => subscribers.filter((s) => s.status === 'active')),
    autoResume: vi.fn(async () => {}),
    claimDelivery: vi.fn(async (id: number, paper: number, on: string) => {
      if (rows.some((r) => same(r, id, paper, on))) return false;
      rows.push({ subscriber_id: id, paper_number: paper, scheduled_for: on, status: 'queued' });
      return true;
    }),
    markDelivery: vi.fn(async (id: number, paper: number, on: string, status: string) => {
      const row = rows.find((r) => same(r, id, paper, on));
      if (row) row.status = status;
    }),
    listRetryable: vi.fn(async () => rows.filter((r) => r.status === 'failed')),
    listDeliveredItems: vi.fn(async (id: number, sinceIso: string) =>
      rows.filter((r) => r.subscriber_id === id && r.scheduled_for >= sinceIso)
        .map(({ paper_number, scheduled_for }) => ({ paper_number, scheduled_for }))),
    markCaughtUp: vi.fn(async () => {}),
    claimAnnouncement: vi.fn(async () => false), markAnnouncement: vi.fn(async () => {}),
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
let db: ReturnType<typeof memoryDb>;

const fire = (iso: string) =>
  worker.scheduled({ scheduledTime: Date.parse(iso), cron: '', noRetry() {} } as ScheduledEvent, ENV);

beforeEach(() => {
  sent = [];
  db = memoryDb([reader()]);
  mocks.makeDb.mockReset().mockReturnValue(db);
  mocks.sendEmail.mockReset();
  mocks.sendBatchEmails.mockReset().mockImplementation(
    async (_key: string, mails: OutboundEmail[]): Promise<BatchEmailOutcome[]> => {
      sent.push(...mails);
      return mails.map((_, i) => ({ status: 'sent', id: `msg_${sent.length}_${i}` }));
    }
  );
});

describe('the scheduled handler', () => {
  it('skips the 12:00 UTC fire under daylight time without touching the database', async () => {
    await fire('2026-10-27T12:00:00Z'); // 8am EDT
    expect(mocks.makeDb).not.toHaveBeenCalled();
    expect(mocks.sendBatchEmails).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('runs the 11:00 UTC fire under daylight time, for the Eastern date', async () => {
    await fire('2026-10-27T11:00:00Z'); // 7am EDT
    expect(mocks.makeDb).toHaveBeenCalledWith(ENV.DB);
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-10-27');
    expect(sent).toHaveLength(1);
    expect(db.rows.every((r) => r.scheduled_for === '2026-10-27')).toBe(true);
  });

  it('skips 11:00 UTC and runs 12:00 UTC under standard time', async () => {
    await fire('2026-11-22T11:00:00Z'); // 6am EST
    expect(mocks.makeDb).not.toHaveBeenCalled();
    expect(sent).toHaveLength(0);
    await fire('2026-11-22T12:00:00Z'); // 7am EST
    expect(db.recordDailyRun).toHaveBeenCalledWith('2026-11-22');
    expect(sent.map((m) => m.subject)).toEqual([
      'Federalist No. 10 — The Same Subject Continued (The Union as a Safeguard Against Domestic Faction and Insurrection)'
    ]);
  });

  it('runs 12:00 UTC, 7am EST, on the morning clocks fall back', async () => {
    await fire('2026-11-01T11:00:00Z');
    expect(mocks.makeDb).not.toHaveBeenCalled();
    await fire('2026-11-01T12:00:00Z');
    expect(db.recordDailyRun).toHaveBeenCalledExactlyOnceWith('2026-11-01');
  });

  it('runs 11:00 UTC, 7am EDT, on the morning clocks spring forward', async () => {
    await fire('2027-03-14T11:00:00Z');
    expect(db.recordDailyRun).toHaveBeenCalledExactlyOnceWith('2027-03-14');
    await fire('2027-03-14T12:00:00Z');
    expect(mocks.makeDb).toHaveBeenCalledTimes(1);
  });

  it('sends nothing more when the same morning fires again', async () => {
    await fire('2026-11-22T12:00:00Z');
    expect(sent).toHaveLength(1);
    await fire('2026-11-22T12:00:00Z');
    await fire('2026-11-22T11:00:00Z');
    await fire('2026-11-22T12:00:00Z');
    expect(sent).toHaveLength(1);
    expect(db.rows).toHaveLength(1);
    expect(db.recordDailyRun).toHaveBeenCalledTimes(3);
  });
});
