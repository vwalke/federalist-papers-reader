import { describe, expect, it } from 'vitest';
import { normalizeWeeklyDays, renderDashboard, renderDashboardError } from '../src/dashboard';

const days = (last: number) => Array.from({ length: 30 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 6, 2 + index)).toISOString().slice(0, 10),
  count: index === 29 ? last : index % 5
}));

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
      null,
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
      null,
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

  it('renders an accessible 30-day Eastern Time sent-mail chart', () => {
    const activity = {
      last24Hours: 42,
      days: Array.from({ length: 30 }, (_, index) => ({
        date: new Date(Date.UTC(2026, 5, 26 + index)).toISOString().slice(0, 10),
        count: index === 29 ? 87 : index
      }))
    };

    const html = renderDashboard(
      { active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13 },
      [],
      activity,
      new Date('2026-07-25T12:34:56.000Z')
    );

    expect(html).toContain('Sent mail');
    expect(html).toContain('Last 24 hours');
    expect(html).toContain('42');
    expect(html).toContain('of 100 sent');
    expect(html).toContain('Eastern Time');
    expect(html).toMatch(/<svg[\s\S]*<title[^>]*>Sent emails by Eastern date<\/title>/);
    expect(html).toMatch(/<desc[^>]*>[\s\S]*30 days[\s\S]*<\/desc>/);
    expect(html.match(/class="email-bar"/g)).toHaveLength(30);
    expect(html.match(/class="email-axis-label"/g)).toHaveLength(5);
    expect(html).toContain('data-value="100"');
    expect(html).toContain('<th scope="row"><time datetime="2026-06-26">Jun 26</time></th>');
    expect(html).toContain('<th scope="row"><time datetime="2026-07-25">Jul 25</time></th>');
    expect(html).not.toMatch(/reader@example\.com|mailto:|provider_message_id/i);
  });

  it('caps the rolling usage meter at 100 percent', () => {
    const html = renderDashboard(
      { active: 0, pending: 0, gone: 0, weekly: 0, asItHappened: 0 },
      [],
      { last24Hours: 140, days: [] },
      new Date('2026-07-25T12:34:56.000Z')
    );

    expect(html).toContain('style="width:100%"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).not.toContain('width:140%');
  });

  it('keeps subscriber figures visible when email activity is unavailable', () => {
    const html = renderDashboard(
      { active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13 },
      [{ sendDow: 5, active: 10, pending: 0 }],
      null,
      new Date('2026-07-25T12:34:56.000Z')
    );

    expect(html).toContain('<span class="stat__value">34</span>');
    expect(html).toContain('<th scope="row">Friday</th>');
    expect(html).toContain('Email activity temporarily unavailable');
  });

  it('renders aligned accessible visit and confirmed-subscription charts', () => {
    const html = renderDashboard(
      { active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13 },
      [],
      { last24Hours: 2, days: days(2) },
      new Date('2026-07-31T16:00:00.000Z'),
      { visits: { days: days(42) }, subscriptions: { days: days(3) } }
    );

    expect(html).toContain('<h2 id="progress-heading">Progress</h2>');
    expect(html).toContain('30 days · Eastern Time');
    expect(html).toMatch(/<title[^>]*>Visits by Eastern date<\/title>/);
    expect(html).toMatch(/<title[^>]*>Confirmed subscriptions by Eastern date<\/title>/);
    expect(html.match(/class="visit-point"/g)).toHaveLength(30);
    expect(html.match(/class="subscription-bar"/g)).toHaveLength(30);
    expect(html).toContain('Jul 31: 42 visits');
    expect(html).toContain('Jul 31: 3 confirmed subscriptions');
    expect(html).toContain('<th scope="col">Visits</th>');
    expect(html).toContain('<th scope="col">Confirmed subscriptions</th>');
    expect(html.indexOf('id="weekly-heading"')).toBeLessThan(html.indexOf('id="progress-heading"'));
    expect(html.indexOf('id="progress-heading"')).toBeLessThan(html.indexOf('id="email-heading"'));
  });

  it('renders visits with unavailable subscriptions marked by em dashes', () => {
    const html = renderDashboard(
      { active: 0, pending: 0, gone: 0, weekly: 0, asItHappened: 0 },
      [],
      null,
      new Date('2026-07-31T16:00:00.000Z'),
      { visits: { days: days(42) }, subscriptions: null }
    );

    expect(html.match(/class="visit-point"/g)).toHaveLength(30);
    expect(html).not.toContain('class="subscription-bar"');
    expect(html).toContain('<th scope="col">Visits</th>');
    expect(html).toContain('<th scope="col">Confirmed subscriptions</th>');
    expect(html).toContain('<time datetime="2026-07-31">Jul 31</time></th>\n          <td>42</td>\n          <td>&mdash;</td>');
    expect(html).toContain('<time datetime="2026-07-02">Jul 2</time></th>\n          <td>0</td>\n          <td>&mdash;</td>');
  });

  it('renders subscriptions with unavailable visits marked by em dashes', () => {
    const html = renderDashboard(
      { active: 0, pending: 0, gone: 0, weekly: 0, asItHappened: 0 },
      [],
      null,
      new Date('2026-07-31T16:00:00.000Z'),
      { visits: null, subscriptions: { days: days(3) } }
    );

    expect(html).not.toContain('class="visit-point"');
    expect(html.match(/class="subscription-bar"/g)).toHaveLength(30);
    expect(html).toContain('<th scope="col">Visits</th>');
    expect(html).toContain('<th scope="col">Confirmed subscriptions</th>');
    expect(html).toContain('<time datetime="2026-07-31">Jul 31</time></th>\n          <td>&mdash;</td>\n          <td>3</td>');
    expect(html).toContain('<time datetime="2026-07-02">Jul 2</time></th>\n          <td>&mdash;</td>\n          <td>0</td>');
  });

  it('renders one progress-unavailable note without empty charts', () => {
    const html = renderDashboard(
      { active: 0, pending: 0, gone: 0, weekly: 0, asItHappened: 0 },
      [],
      null,
      new Date('2026-07-31T16:00:00.000Z'),
      { visits: null, subscriptions: null }
    );

    expect(html.match(/Progress activity temporarily unavailable/g)).toHaveLength(1);
    expect(html).not.toContain('class="activity-chart"');
    expect(html).not.toContain('class="progress-values"');
  });
});
