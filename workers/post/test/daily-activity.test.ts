import { describe, expect, it } from 'vitest';
import {
  easternDate,
  easternWindow,
  recentEasternDates,
  summarizeDailyActivity
} from '../src/daily-activity';

describe('daily activity', () => {
  it('returns 30 chronological Eastern labels including today', () => {
    const now = new Date('2026-07-31T16:00:00.000Z');
    const labels = recentEasternDates(now);
    expect(labels).toHaveLength(30);
    expect(labels[0]).toBe('2026-07-02');
    expect(labels.at(-1)).toBe('2026-07-31');
  });

  it('fills missing dates and groups timestamped counts in Eastern Time', () => {
    const result = summarizeDailyActivity([
      { occurredAt: '2026-07-31T03:30:00.000Z', count: 2 },
      { occurredAt: '2026-07-31T14:00:00.000Z', count: 3 }
    ], new Date('2026-07-31T16:00:00.000Z'));
    expect(result.days.find((day) => day.date === '2026-07-30')?.count).toBe(2);
    expect(result.days.at(-1)).toEqual({ date: '2026-07-31', count: 3 });
  });

  it('uses exact Eastern bounds across spring forward', () => {
    const transitionWindow = easternWindow(new Date('2026-04-06T16:00:00.000Z'));
    const followingWindow = easternWindow(new Date('2026-04-07T16:00:00.000Z'));
    expect(transitionWindow.labels[0]).toBe('2026-03-08');
    expect(transitionWindow.start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(followingWindow.labels[0]).toBe('2026-03-09');
    expect(followingWindow.start.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(followingWindow.start.getTime() - transitionWindow.start.getTime())
      .toBe(23 * 60 * 60 * 1000);
    expect(transitionWindow.end.toISOString()).toBe('2026-04-06T16:00:00.000Z');
  });

  it('uses exact Eastern bounds across fall back', () => {
    const transitionWindow = easternWindow(new Date('2026-11-30T16:00:00.000Z'));
    const followingWindow = easternWindow(new Date('2026-12-01T16:00:00.000Z'));
    expect(transitionWindow.labels[0]).toBe('2026-11-01');
    expect(transitionWindow.start.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    expect(followingWindow.labels[0]).toBe('2026-11-02');
    expect(followingWindow.start.toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(followingWindow.start.getTime() - transitionWindow.start.getTime())
      .toBe(25 * 60 * 60 * 1000);
  });

  it('ignores malformed, negative, fractional, and out-of-window rows', () => {
    const result = summarizeDailyActivity([
      { occurredAt: 'bad', count: 1 },
      { occurredAt: '2026-07-31T12:00:00.000Z', count: -1 },
      { occurredAt: '2026-07-31T12:00:00.000Z', count: 1.5 },
      { occurredAt: '2026-06-01T12:00:00.000Z', count: 8 }
    ], new Date('2026-07-31T16:00:00.000Z'));
    expect(result.days.every((day) => day.count === 0)).toBe(true);
  });
});
