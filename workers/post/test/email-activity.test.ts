import { describe, expect, it } from 'vitest';
import { easternDate, summarizeEmailActivity } from '../src/email-activity';

const row = (sent_at: string, recipient_count = 1) => ({
  sent_at,
  recipient_count
});

describe('email activity aggregation', () => {
  it('returns 30 chronological Eastern dates and fills empty days', () => {
    const result = summarizeEmailActivity(
      [row('2026-07-25T03:30:00.000Z', 2)],
      new Date('2026-07-25T16:00:00.000Z')
    );

    expect(result.days).toHaveLength(30);
    expect(result.days[0].date).toBe('2026-06-26');
    expect(result.days.at(-1)).toEqual({ date: '2026-07-25', count: 0 });
    expect(result.days.find((day) => day.date === '2026-07-24'))
      .toEqual({ date: '2026-07-24', count: 2 });
  });

  it('uses an inclusive rolling cutoff and ignores future rows', () => {
    const result = summarizeEmailActivity([
      row('2026-07-24T16:00:00.000Z', 3),
      row('2026-07-24T15:59:59.999Z', 7),
      row('2026-07-25T16:00:00.001Z', 11)
    ], new Date('2026-07-25T16:00:00.000Z'));

    expect(result.last24Hours).toBe(3);
    expect(result.days.at(-1)?.count).toBe(0);
  });

  it('uses the 23-hour spring-forward Eastern day', () => {
    expect(easternDate(new Date('2026-03-08T04:59:59.999Z'))).toBe('2026-03-07');
    expect(easternDate(new Date('2026-03-08T05:00:00.000Z'))).toBe('2026-03-08');
    expect(easternDate(new Date('2026-03-09T03:59:59.999Z'))).toBe('2026-03-08');
    expect(easternDate(new Date('2026-03-09T04:00:00.000Z'))).toBe('2026-03-09');
  });

  it('uses the 25-hour fall-back Eastern day', () => {
    expect(easternDate(new Date('2026-11-01T03:59:59.999Z'))).toBe('2026-10-31');
    expect(easternDate(new Date('2026-11-01T04:00:00.000Z'))).toBe('2026-11-01');
    expect(easternDate(new Date('2026-11-02T04:59:59.999Z'))).toBe('2026-11-01');
    expect(easternDate(new Date('2026-11-02T05:00:00.000Z'))).toBe('2026-11-02');
  });

  it('skips malformed historical rows without breaking the dashboard', () => {
    const result = summarizeEmailActivity([
      row('not-a-date'),
      row('2026-07-25T12:00:00.000Z', 0),
      row('2026-07-25T13:00:00.000Z', 1.5),
      row('2026-07-25T14:00:00.000Z', 4)
    ], new Date('2026-07-25T16:00:00.000Z'));

    expect(result.last24Hours).toBe(4);
    expect(result.days.at(-1)?.count).toBe(4);
  });
});
