import { describe, expect, it, vi } from 'vitest';
import { makeDb } from '../src/db';

function d1WithResults(
  subscriberRow: Record<string, number> | null,
  weeklyRows: Array<Record<string, number>>
): { d1: D1Database; sql: string[] } {
  const sql: string[] = [];
  const d1 = {
    prepare: vi.fn((query: string) => {
      sql.push(query);
      if (query.includes('AS as_it_happened')) {
        return { first: vi.fn(async () => subscriberRow) };
      }
      return { all: vi.fn(async () => ({ results: weeklyRows })) };
    })
  } as unknown as D1Database;
  return { d1, sql };
}

describe('subscriber statistics queries', () => {
  it('maps the aggregate subscriber and weekly-day rows', async () => {
    const { d1 } = d1WithResults(
      { active: 34, pending: 3, gone: 2, weekly: 21, as_it_happened: 13 },
      [
        { send_dow: 1, active: 3, pending: 0 },
        { send_dow: 6, active: 5, pending: 1 }
      ]
    );
    const db = makeDb(d1);

    await expect(db.getSubscriberStats()).resolves.toEqual({
      active: 34,
      pending: 3,
      gone: 2,
      weekly: 21,
      asItHappened: 13
    });
    await expect(db.getWeeklyDayStats()).resolves.toEqual([
      { sendDow: 1, active: 3, pending: 0 },
      { sendDow: 6, active: 5, pending: 1 }
    ]);
  });

  it('uses aggregate-only SQL with the same status semantics as pnpm stats', async () => {
    const { d1, sql } = d1WithResults(
      { active: 0, pending: 0, gone: 0, weekly: 0, as_it_happened: 0 },
      []
    );
    const db = makeDb(d1);

    await db.getSubscriberStats();
    await db.getWeeklyDayStats();

    const queries = sql.join('\n');
    expect(queries).toContain("status = 'active'");
    expect(queries).toContain("status = 'pending'");
    expect(queries).toContain("status NOT IN ('active','pending')");
    expect(queries).toContain("program = 'weekly'");
    expect(queries).toContain("program = 'calendar'");
    expect(queries).not.toMatch(/\b(email|confirm_ip|token_secret|subscriber_id)\b/);
  });

  it('fails rather than inventing totals when the summary row is absent', async () => {
    const { d1 } = d1WithResults(null, []);
    await expect(makeDb(d1).getSubscriberStats())
      .rejects.toThrow('subscriber stats returned no row');
  });
});

describe('email activity queries', () => {
  it('upserts aggregate send data by provider message ID', async () => {
    const calls: Array<{ sql: string; bind: unknown[] }> = [];
    const d1 = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...bind: unknown[]) => ({
          run: vi.fn(async () => {
            calls.push({ sql, bind });
          })
        }))
      }))
    } as unknown as D1Database;

    await makeDb(d1).recordEmailSend(
      '56761188-7520-42d8-8898-ff6fc54ce618',
      '2026-07-25T12:00:00.000Z',
      3
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('ON CONFLICT(provider_message_id) DO UPDATE');
    expect(calls[0].bind).toEqual([
      '56761188-7520-42d8-8898-ff6fc54ce618',
      '2026-07-25T12:00:00.000Z',
      3
    ]);
  });

  it('queries aggregate rows with a bound cutoff and summarizes them', async () => {
    const calls: Array<{ sql: string; bind: unknown[] }> = [];
    const d1 = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...bind: unknown[]) => ({
          all: vi.fn(async () => {
            calls.push({ sql, bind });
            return {
              results: [
                { sent_at: '2026-07-25T12:00:00.000Z', recipient_count: 2 },
                { sent_at: '2026-07-25T13:00:00.000Z', recipient_count: 1 }
              ]
            };
          })
        }))
      }))
    } as unknown as D1Database;

    const result = await makeDb(d1)
      .getEmailActivity(new Date('2026-07-25T14:00:00.000Z'));

    expect(result.last24Hours).toBe(3);
    expect(result.days).toHaveLength(30);
    expect(calls[0].sql).toContain('SELECT sent_at, recipient_count');
    expect(calls[0].bind).toEqual(['2026-06-24T14:00:00.000Z']);
  });

  it('purges old rows using a bound ISO cutoff', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-25T14:00:00.000Z'));
    const calls: Array<{ sql: string; bind: unknown[] }> = [];
    const d1 = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...bind: unknown[]) => ({
          run: vi.fn(async () => {
            calls.push({ sql, bind });
          })
        }))
      }))
    } as unknown as D1Database;

    try {
      await makeDb(d1).purgeEmailSends(45);
    } finally {
      vi.useRealTimers();
    }

    expect(calls).toEqual([{
      sql: 'DELETE FROM email_sends WHERE sent_at < ?',
      bind: ['2026-06-10T14:00:00.000Z']
    }]);
  });
});

describe('confirmed subscription activity queries', () => {
  it('queries only bounded confirmation timestamps and summarizes them', async () => {
    const calls: Array<{ sql: string; bind: unknown[] }> = [];
    const d1 = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...bind: unknown[]) => ({
          all: vi.fn(async () => {
            calls.push({ sql, bind });
            return { results: [
              { confirmed_at: '2026-07-31T03:30:00Z' },
              { confirmed_at: '2026-07-31T14:00:00Z' }
            ] };
          })
        }))
      }))
    } as unknown as D1Database;

    const result = await makeDb(d1)
      .getSubscriptionActivity(new Date('2026-07-31T16:00:00.000Z'));

    expect(result.days.find((day) => day.date === '2026-07-30')?.count).toBe(1);
    expect(result.days.at(-1)?.count).toBe(1);
    expect(calls[0].sql).toContain('confirmed_at IS NOT NULL');
    expect(calls[0].sql).toContain("strftime('%Y-%m-%dT%H:%M:%SZ', confirmed_at)");
    expect(calls[0].sql).not.toMatch(/\b(email|confirm_ip|token_secret|subscriber_id)\b/);
    expect(calls[0].sql).not.toContain('status =');
    expect(calls[0].bind).toHaveLength(1);
  });
});
