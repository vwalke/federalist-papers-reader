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
import type { SubscriberStats, WeeklyDayStats } from './db';
import { DOW_NAMES } from './schedule';

export interface DashboardDay {
  day: string;
  active: number;
  pending: number;
}

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
    .kicker, .updated, .stat__label, thead, .refresh, .note {
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
      .kicker, .updated, .stat__label, .note, thead th { color: CanvasText; }
      .refresh { color: ButtonText; background: ButtonFace; }
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

export function renderDashboard(
  stats: SubscriberStats,
  weeklyRows: WeeklyDayStats[],
  refreshedAt: Date
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
