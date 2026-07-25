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
