/**
 * THESIS: An operator's tally sheet, not a SaaS dashboard; current figures are
 * the whole task, so ornament never competes with scanning.
 * OWN-WORLD: One newsprint sheet, dense ink, oxblood kicker, double rules,
 * square ledger cells, Georgia for the printed voice, and system sans for
 * utility labels.
 * STORY: Confirm the subscriber roll, check pending or gone counts, inspect
 * weekly load by day, then refresh when another current reading is needed.
 * FIRST VIEWPORT: Post Office and UTC freshness share the masthead; the five
 * totals form one ruled register immediately below; weekday distribution
 * follows without navigation or secondary actions.
 * FORM: A compact broadside register extending Federalist Reader's established
 * newspaper world for an Operate surface; shaped directly because the content
 * and single action are precisely specified.
 */
import type { EmailActivity, SubscriberStats, WeeklyDayStats } from './db';
import type { DailyActivity } from './daily-activity';
import { DOW_NAMES } from './schedule';

export interface DashboardDay {
  day: string;
  active: number;
  pending: number;
}

export interface ProgressActivity {
  visits: DailyActivity | null;
  subscriptions: DailyActivity | null;
}

const EMPTY_PROGRESS: ProgressActivity = { visits: null, subscriptions: null };

export function normalizeWeeklyDays(rows: WeeklyDayStats[]): DashboardDay[] {
  const byDay = new Map(rows.map((row) => [row.sendDow, row]));
  return DOW_NAMES.map((day, sendDow) => ({
    day,
    active: byDay.get(sendDow)?.active ?? 0,
    pending: byDay.get(sendDow)?.pending ?? 0
  }));
}

function timestamp(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function document(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="color-scheme" content="light">
  <meta name="theme-color" content="#2a2118">
  <title>${title}</title>
  <style>
    :root {
      --ink: #2a2118;
      --muted: #6e6353;
      --newsprint: #e7dfce;
      --paper: #f4efe2;
      --rule: #a99b83;
      --accent: #7b2519;
      --focus: #1f6b66;
      color: var(--ink);
      background: var(--ink);
      font-family: Georgia, "Times New Roman", serif;
      font-synthesis: none;
      text-rendering: optimizeLegibility;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { min-width: 20rem; background: var(--ink); }
    body { min-height: 100vh; margin: 0; background: var(--ink); line-height: 1.45; }
    p, h1, h2, dl, dd { margin: 0; }
    a { color: currentColor; }
    .skip {
      position: fixed;
      z-index: 2;
      inset: .75rem auto auto .75rem;
      padding: .65rem 1rem;
      color: var(--paper);
      background: var(--ink);
      font: 700 .78rem/1.2 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      transform: translateY(-180%);
    }
    .skip:focus { transform: translateY(0); }
    :focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
    main {
      width: min(100%, 46rem);
      min-height: 100vh;
      margin: 0 auto;
      padding: max(1.25rem, env(safe-area-inset-top))
        max(1rem, env(safe-area-inset-right))
        max(2.5rem, env(safe-area-inset-bottom))
        max(1rem, env(safe-area-inset-left));
      background-color: var(--newsprint);
      background-image:
        linear-gradient(rgb(42 33 24 / 2%), rgb(42 33 24 / 2%)),
        url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='2' stitchTiles='stitchTiles'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.12'/%3E%3C/svg%3E");
      box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 30%);
    }
    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 4px double var(--ink);
    }
    .kicker, .updated, .stat__label, thead, .refresh, .note,
    .email-summary, .email-values summary, .progress-meta,
    .progress-values summary, .plot-label {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .kicker {
      margin-bottom: .3rem;
      color: var(--accent);
      font-size: .7rem;
      font-weight: 700;
      letter-spacing: .14em;
      text-transform: uppercase;
    }
    h1 {
      font-size: clamp(2.25rem, 11vw, 3.75rem);
      font-weight: 400;
      letter-spacing: -.025em;
      line-height: .92;
    }
    h2 {
      margin: 2.25rem 0 .75rem;
      font-size: clamp(1.35rem, 5vw, 1.65rem);
      font-weight: 400;
      line-height: 1.1;
    }
    .updated {
      flex: 0 0 auto;
      color: var(--muted);
      font-size: .7rem;
      line-height: 1.45;
      text-align: right;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      border-block: 1px solid var(--ink);
      border-inline-start: 1px solid var(--ink);
      background: rgb(244 239 226 / 38%);
      font-variant-numeric: tabular-nums lining-nums;
    }
    .stat {
      min-width: 0;
      padding: .9rem .8rem;
      border-inline-end: 1px solid var(--ink);
      border-block-end: 1px solid var(--rule);
    }
    .stat:last-child {
      grid-column: 1 / -1;
      border-block-end: 0;
    }
    .stat__label {
      display: block;
      overflow-wrap: anywhere;
      color: var(--muted);
      font-size: .66rem;
      font-weight: 700;
      letter-spacing: .075em;
      line-height: 1.25;
      text-transform: uppercase;
    }
    .stat__value {
      display: block;
      margin-top: .3rem;
      font-size: clamp(1.9rem, 9vw, 2.55rem);
      line-height: 1;
    }
    .note {
      margin-top: .65rem;
      color: var(--muted);
      font-size: .72rem;
      line-height: 1.45;
    }
    .table-wrap {
      overflow-x: auto;
      border-block: 1px solid var(--ink);
      background: rgb(244 239 226 / 38%);
    }
    .progress-meta {
      margin: -.35rem 0 .85rem;
      color: var(--muted);
      font-size: .72rem;
    }
    .progress-plot + .progress-plot { margin-top: 1rem; }
    .activity-chart {
      display: block;
      width: 100%;
      height: auto;
      overflow: visible;
    }
    .activity-chart text {
      fill: var(--muted);
      font: 13px ui-sans-serif, system-ui, sans-serif;
    }
    .activity-rule { stroke: var(--rule); }
    .visit-line { fill: none; stroke: var(--focus); stroke-width: 2; }
    .visit-point { fill: var(--focus); }
    .subscription-bar { fill: var(--accent); }
    .progress-values { margin-top: .75rem; }
    .email-summary {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 1rem;
      padding: .85rem 0 .55rem;
      font-size: .72rem;
    }
    .email-summary strong {
      color: var(--ink);
      font: 400 2rem/1 Georgia, "Times New Roman", serif;
    }
    .quota-meter {
      height: .55rem;
      overflow: hidden;
      border: 1px solid var(--ink);
      background: rgb(244 239 226 / 38%);
    }
    .quota-meter span {
      display: block;
      height: 100%;
      background: var(--accent);
    }
    .email-chart {
      display: block;
      width: 100%;
      height: auto;
      margin-top: 1rem;
      overflow: visible;
      color: var(--ink);
    }
    .email-bar { fill: var(--accent); }
    .email-rule { stroke: var(--rule); }
    .email-quota { stroke: var(--ink); stroke-dasharray: 4 4; }
    .email-chart text {
      fill: var(--muted);
      font: 13px ui-sans-serif, system-ui, sans-serif;
    }
    .email-values { margin-top: .75rem; }
    .email-values summary, .progress-values summary {
      min-height: 44px;
      padding-block: .7rem;
      cursor: pointer;
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-variant-numeric: tabular-nums lining-nums;
    }
    caption {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
    th, td {
      padding: .72rem .5rem;
      border-bottom: 1px solid var(--rule);
    }
    tr:last-child th, tr:last-child td { border-bottom: 0; }
    th { text-align: left; font-weight: 400; }
    td { width: 25%; text-align: right; }
    thead th {
      color: var(--muted);
      font-size: .66rem;
      font-weight: 700;
      letter-spacing: .075em;
      text-transform: uppercase;
    }
    tbody th { font-size: .96rem; }
    .refresh {
      display: inline-flex;
      min-height: 44px;
      align-items: center;
      justify-content: center;
      margin-top: 1.5rem;
      padding: .65rem 1rem;
      border: 1px solid var(--ink);
      color: var(--paper);
      background: var(--ink);
      font-size: .72rem;
      font-weight: 700;
      letter-spacing: .08em;
      text-decoration: none;
      text-transform: uppercase;
      transition: color 160ms cubic-bezier(.25, 1, .5, 1),
        background-color 160ms cubic-bezier(.25, 1, .5, 1);
    }
    .refresh:hover { color: var(--ink); background: transparent; }
    @media (min-width: 38rem) {
      main { min-height: calc(100vh - 3rem); margin-block: 1.5rem; padding: 2rem 2.25rem 3rem; }
      .stats { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      .stat { padding: 1rem .7rem; border-block-end: 0; }
      .stat:last-child { grid-column: auto; }
      th, td { padding: .72rem .8rem; }
    }
    @media (forced-colors: active) {
      :root, html, body, main { background: Canvas; color: CanvasText; }
      main { background-image: none; box-shadow: none; }
      .kicker, .updated, .stat__label, .note, .progress-meta, thead th { color: CanvasText; }
      .refresh { color: ButtonText; background: ButtonFace; }
      .email-bar, .visit-point, .subscription-bar, .quota-meter span {
        fill: CanvasText;
        background: CanvasText;
      }
      .email-chart text, .activity-chart text { fill: CanvasText; }
      .email-rule, .email-quota, .visit-line, .activity-rule { stroke: CanvasText; }
    }
    @media (prefers-reduced-transparency: reduce) {
      main { background-image: none; }
    }
  </style>
</head>
<body>
  <a class="skip" href="#figures">Skip to figures</a>
  <main id="figures">${content}</main>
</body>
</html>`;
}

function shortDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric'
  }).format(new Date(`${isoDate}T12:00:00.000Z`));
}

function xFor(index: number, length: number, left = 42, width = 538): number {
  return left + (length <= 1 ? width / 2 : index * width / (length - 1));
}

function yFor(count: number, max: number, top = 14, height = 120): number {
  return top + height - (count / Math.max(max, 1)) * height;
}

function renderDateLabels(activity: DailyActivity): string {
  return activity.days.map((day, index) => {
    const isEndpoint = index === 0 || index === activity.days.length - 1;
    const isWeekly = index % 7 === 0 && index < activity.days.length - 2;
    if (!isEndpoint && !isWeekly) return '';
    return `<text class="plot-label" x="${xFor(index, activity.days.length).toFixed(2)}" y="166" text-anchor="middle">${shortDate(day.date)}</text>`;
  }).join('');
}

function renderVisitsChart(activity: DailyActivity): string {
  const actualMax = Math.max(...activity.days.map((day) => day.count), 0);
  const scaleMax = Math.max(actualMax, 1);
  const points = activity.days.map((day, index) =>
    `${xFor(index, activity.days.length).toFixed(2)},${yFor(day.count, scaleMax).toFixed(2)}`
  ).join(' ');
  const marks = activity.days.map((day, index) => {
    const label = `${shortDate(day.date)}: ${day.count} ${day.count === 1 ? 'visit' : 'visits'}`;
    return `<g><title>${label}</title><circle class="visit-point" cx="${xFor(index, activity.days.length).toFixed(2)}" cy="${yFor(day.count, scaleMax).toFixed(2)}" r="2.75"></circle></g>`;
  }).join('');

  return `<div class="progress-plot">
        <svg class="activity-chart" viewBox="0 0 600 180" role="img" aria-labelledby="visit-chart-title visit-chart-desc">
          <title id="visit-chart-title">Visits by Eastern date</title>
          <desc id="visit-chart-desc">Visits for the most recent 30 days, grouped by Eastern date. The current date may be partial. The vertical scale is independent.</desc>
          <text class="plot-label" x="42" y="11">Visits</text>
          <text class="plot-label" x="36" y="18" text-anchor="end">${actualMax}</text>
          <text class="plot-label" x="36" y="138" text-anchor="end">0</text>
          <line class="activity-rule" x1="42" y1="134" x2="580" y2="134" vector-effect="non-scaling-stroke"></line>
          <polyline class="visit-line" points="${points}" vector-effect="non-scaling-stroke"></polyline>
          ${marks}${renderDateLabels(activity)}
        </svg>
      </div>`;
}

function renderSubscriptionsChart(activity: DailyActivity): string {
  const plotBottom = 134;
  const actualMax = Math.max(...activity.days.map((day) => day.count), 0);
  const scaleMax = Math.max(actualMax, 1);
  const slot = 538 / Math.max(activity.days.length, 1);
  const barWidth = slot * .56;
  const bars = activity.days.map((day, index) => {
    const height = day.count === 0 ? 0 : Math.max(1, plotBottom - yFor(day.count, scaleMax));
    const x = xFor(index, activity.days.length) - barWidth / 2;
    const y = plotBottom - height;
    const noun = day.count === 1 ? 'confirmed subscription' : 'confirmed subscriptions';
    return `<g><title>${shortDate(day.date)}: ${day.count} ${noun}</title><rect class="subscription-bar" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}"></rect></g>`;
  }).join('');

  return `<div class="progress-plot">
        <svg class="activity-chart" viewBox="0 0 600 180" role="img" aria-labelledby="subscription-chart-title subscription-chart-desc">
          <title id="subscription-chart-title">Confirmed subscriptions by Eastern date</title>
          <desc id="subscription-chart-desc">Confirmed subscriptions for the most recent 30 days, grouped by Eastern date. The current date may be partial. The vertical scale is independent.</desc>
          <text class="plot-label" x="42" y="11">New subscriptions</text>
          <text class="plot-label" x="36" y="18" text-anchor="end">${actualMax}</text>
          <text class="plot-label" x="36" y="138" text-anchor="end">0</text>
          <line class="activity-rule" x1="42" y1="134" x2="580" y2="134" vector-effect="non-scaling-stroke"></line>
          ${bars}${renderDateLabels(activity)}
        </svg>
      </div>`;
}

function renderProgressActivity(progress: ProgressActivity): string {
  const { visits, subscriptions } = progress;
  if (!visits && !subscriptions) {
    return `<section aria-labelledby="progress-heading">
      <h2 id="progress-heading">Progress</h2>
      <p class="note">Progress activity temporarily unavailable. Refresh counts to try again.</p>
    </section>`;
  }

  const sourceDays = visits?.days ?? subscriptions!.days;
  const visitCounts = new Map(visits?.days.map((day) => [day.date, day.count]));
  const subscriptionCounts = new Map(subscriptions?.days.map((day) => [day.date, day.count]));
  const rows = sourceDays.map((day) => `<tr>
          <th scope="row"><time datetime="${day.date}">${shortDate(day.date)}</time></th>
          <td>${visits ? visitCounts.get(day.date) ?? 0 : '&mdash;'}</td>
          <td>${subscriptions ? subscriptionCounts.get(day.date) ?? 0 : '&mdash;'}</td>
        </tr>`).join('');
  const unavailableNote = !visits
    ? '<p class="note">Visit activity temporarily unavailable. Refresh counts to try again.</p>'
    : !subscriptions
      ? '<p class="note">Confirmed subscription activity temporarily unavailable. Refresh counts to try again.</p>'
      : '';

  return `<section aria-labelledby="progress-heading">
      <h2 id="progress-heading">Progress</h2>
      <p class="progress-meta">30 days · Eastern Time</p>
      ${visits ? renderVisitsChart(visits) : ''}
      ${subscriptions ? renderSubscriptionsChart(subscriptions) : ''}
      ${unavailableNote}
      <details class="progress-values">
        <summary>Exact daily values</summary>
        <div class="table-wrap"><table>
          <caption>Visits and confirmed subscriptions by Eastern date</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Visits</th><th scope="col">Confirmed subscriptions</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </details>
    </section>`;
}

function renderEmailBars(activity: EmailActivity): string {
  const plotLeft = 30;
  const plotTop = 12;
  const plotWidth = 550;
  const plotHeight = 170;
  const plotBottom = plotTop + plotHeight;
  const chartMax = Math.max(100, ...activity.days.map((day) => day.count), 1);
  const slot = plotWidth / Math.max(activity.days.length, 1);
  const barWidth = Math.max(2, slot * .62);
  const quotaY = plotBottom - (100 / chartMax) * plotHeight;
  const bars = activity.days.map((day, index) => {
    const height = (day.count / chartMax) * plotHeight;
    const x = plotLeft + index * slot + (slot - barWidth) / 2;
    const y = plotBottom - height;
    return `<g><title>${shortDate(day.date)}: ${day.count} sent</title><rect class="email-bar" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${height.toFixed(2)}"></rect></g>`;
  }).join('');
  const labels = activity.days.map((day, index) => {
    const isEndpoint = index === 0 || index === activity.days.length - 1;
    const isWeekly = index % 7 === 0 && index < activity.days.length - 2;
    if (!isEndpoint && !isWeekly) return '';
    const x = plotLeft + index * slot + slot / 2;
    return `<text class="email-axis-label" x="${x.toFixed(2)}" y="207" text-anchor="middle">${shortDate(day.date)}</text>`;
  }).join('');
  const quotaLabelY = quotaY < plotTop + 16 ? quotaY + 15 : quotaY - 4;

  return `<svg class="email-chart" viewBox="0 0 600 220" role="img" aria-labelledby="email-chart-title email-chart-desc">
        <title id="email-chart-title">Sent emails by Eastern date</title>
        <desc id="email-chart-desc">Daily sent-email totals for the most recent 30 days, grouped in Eastern Time.</desc>
        <line class="email-rule" x1="${plotLeft}" y1="${plotBottom}" x2="${plotLeft + plotWidth}" y2="${plotBottom}" vector-effect="non-scaling-stroke"></line>
        <line class="email-quota" data-value="100" x1="${plotLeft}" y1="${quotaY.toFixed(2)}" x2="${plotLeft + plotWidth}" y2="${quotaY.toFixed(2)}" vector-effect="non-scaling-stroke"></line>
        <text x="${plotLeft}" y="${quotaLabelY.toFixed(2)}">100-send reference</text>
        ${bars}${labels}
      </svg>`;
}

function renderEmailActivity(activity: EmailActivity | null): string {
  if (!activity) {
    return `<section aria-labelledby="email-heading">
      <h2 id="email-heading">Sent mail</h2>
      <p class="note">Email activity temporarily unavailable. Subscriber figures above are current.</p>
    </section>`;
  }
  const usage = Math.min(100, Math.max(0, activity.last24Hours));
  const rows = activity.days.map((day) => `<tr>
          <th scope="row"><time datetime="${day.date}">${shortDate(day.date)}</time></th>
          <td>${day.count}</td>
        </tr>`).join('');

  return `<section aria-labelledby="email-heading">
      <h2 id="email-heading">Sent mail</h2>
      <div class="email-summary">
        <span>Last 24 hours<br><strong>${activity.last24Hours}</strong> of 100 sent</span>
        <span>Eastern Time</span>
      </div>
      <div class="quota-meter" role="meter" aria-label="Emails sent in the last 24 hours" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${usage}">
        <span style="width:${usage}%"></span>
      </div>
      ${renderEmailBars(activity)}
      <details class="email-values">
        <summary>Exact daily values</summary>
        <div class="table-wrap"><table>
          <caption>Emails sent by Eastern date</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Sent</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </details>
      <p class="note">The 100-send line is a reference. Resend’s daily allowance may also include inbound email.</p>
    </section>`;
}

export function renderDashboard(
  stats: SubscriberStats,
  weeklyRows: WeeklyDayStats[],
  emailActivity: EmailActivity | null,
  refreshedAt: Date,
  progress: ProgressActivity = EMPTY_PROGRESS
): string {
  const days = normalizeWeeklyDays(weeklyRows);
  const iso = refreshedAt.toISOString();
  const cards: Array<[string, number]> = [
    ['Active', stats.active],
    ['Pending', stats.pending],
    ['Gone', stats.gone],
    ['Weekly', stats.weekly],
    ['As it happened', stats.asItHappened]
  ];
  const totals = cards.map(([label, value]) => `<div class="stat">
        <dt class="stat__label">${label}</dt>
        <dd><span class="stat__value">${value}</span></dd>
      </div>`).join('');
  const rows = days.map((row) => `<tr>
          <th scope="row">${row.day}</th>
          <td>${row.active}</td>
          <td>${row.pending}</td>
        </tr>`).join('');

  return document('Post Office — Federalist Reader', `<header>
      <div>
        <p class="kicker">Federalist Reader</p>
        <h1>Post Office</h1>
      </div>
      <p class="updated">Updated<br><time datetime="${iso}">${timestamp(refreshedAt)}</time></p>
    </header>
    <section aria-labelledby="subscriber-heading">
      <h2 id="subscriber-heading">Subscribers</h2>
      <dl class="stats" aria-label="Subscriber totals">${totals}</dl>
      <p class="note">Gone includes paused and unsubscribed rows awaiting cleanup.</p>
    </section>
    <section aria-labelledby="weekly-heading">
      <h2 id="weekly-heading">Weekly send days</h2>
      <div class="table-wrap">
        <table>
          <caption>Active and pending weekly subscribers by delivery day</caption>
          <thead>
            <tr><th scope="col">Day</th><th scope="col">Active</th><th scope="col">Pending</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
    ${renderProgressActivity(progress)}
    ${renderEmailActivity(emailActivity)}
    <a class="refresh" href="/post-office/">Refresh counts</a>`);
}

export function renderDashboardError(
  heading = 'The figures could not be loaded',
  message = 'Please wait a moment and try again.'
): string {
  return document('Post Office unavailable — Federalist Reader', `<header>
      <div>
        <p class="kicker">Federalist Reader</p>
        <h1>Post Office</h1>
      </div>
    </header>
    <section>
      <h2>${heading}</h2>
      <p>${message}</p>
      <a class="refresh" href="/post-office/">Try again</a>
    </section>`);
}
