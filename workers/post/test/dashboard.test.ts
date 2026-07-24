import { describe, expect, it } from 'vitest';
import { normalizeWeeklyDays, renderDashboard, renderDashboardError } from '../src/dashboard';

describe('subscriber dashboard renderer', () => {
  it('fills and orders all seven weekly send days', () => {
    expect(normalizeWeeklyDays([
      { sendDow: 6, active: 5, pending: 0 },
      { sendDow: 1, active: 3, pending: 1 }
    ])).toEqual([
      { day: 'Sunday', active: 0, pending: 0 },
      { day: 'Monday', active: 3, pending: 1 },
      { day: 'Tuesday', active: 0, pending: 0 },
      { day: 'Wednesday', active: 0, pending: 0 },
      { day: 'Thursday', active: 0, pending: 0 },
      { day: 'Friday', active: 0, pending: 0 },
      { day: 'Saturday', active: 5, pending: 0 }
    ]);
  });

  it('renders current aggregate counts, timestamp, metadata, and no PII', () => {
    const html = renderDashboard(
      { active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13 },
      [{ sendDow: 5, active: 10, pending: 0 }],
      new Date('2026-07-24T12:34:56.000Z')
    );

    expect(html).toContain('<title>Post Office — Federalist Reader</title>');
    expect(html).toContain('name="robots" content="noindex, nofollow, noarchive"');
    expect(html).toContain('<dl class="stats"');
    expect(html).toContain('<span class="stat__value">34</span>');
    expect(html).toContain('<span class="stat__value">21</span>');
    expect(html).toContain('<span class="stat__value">13</span>');
    expect(html).toContain('2026-07-24 12:34 UTC');
    expect(html).toContain('href="/post-office/"');
    expect(html).toContain('paused and unsubscribed rows awaiting cleanup');
    expect(html).not.toContain('reader@example.com');
    expect(html).not.toMatch(/subscriber[_ -]?id|confirm_ip|token_secret/i);
  });

  it('renders weekday rows in calendar order', () => {
    const html = renderDashboard(
      { active: 0, pending: 0, gone: 0, weekly: 0, asItHappened: 0 },
      [],
      new Date('2026-07-24T12:34:56.000Z')
    );
    const positions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
      'Thursday', 'Friday', 'Saturday'].map((day) => html.indexOf(`<th scope="row">${day}</th>`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('keeps database details out of the generic error page', () => {
    const html = renderDashboardError();
    expect(html).toContain('The figures could not be loaded');
    expect(html).not.toContain('D1_ERROR');
    expect(html).not.toContain('SELECT');
  });
});
