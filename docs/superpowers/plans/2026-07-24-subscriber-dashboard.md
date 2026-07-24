# Subscriber Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a phone-friendly, Cloudflare Access-protected dashboard that shows current aggregate subscriber counts without querying or rendering PII.

**Architecture:** The existing `publius-post` Worker will own a new `/post-office/` route because it already has the production D1 binding. Two aggregate-only database methods feed a dedicated server-side HTML renderer; the handler adds privacy headers and never exposes a JSON API. Cloudflare Access protects the path before the Worker route is deployed.

**Tech Stack:** TypeScript, Cloudflare Workers, Cloudflare D1, Cloudflare Access, Vitest, Wrangler

## Global Constraints

- The dashboard URL is `https://federalistreader.org/post-office/`.
- Cloudflare Access must allow only members of the current Cloudflare account and use a one-month session.
- Never select, return, log, or render email addresses, subscriber IDs, confirmation IP addresses, token secrets, or other subscriber-level data.
- Match the existing `workers/post/stats.mjs` definitions for active, pending, gone, weekly, and as-it-happened counts.
- Render Sunday through Saturday in calendar order, including zero-count days.
- Do not add the dashboard to Astro, public navigation, or the sitemap.
- Send `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, and `Referrer-Policy: no-referrer`.
- Do not add a JSON endpoint, client-side JavaScript, subscriber search, lists, exports, mutations, charts, historical trends, or delivery logs.
- Do not deploy the Worker route until Cloudflare Access intercepts `/post-office*`.
- Explicitly disable the Worker's `workers.dev` hostname and preview URLs so they cannot bypass the custom-domain Access policy.

## File Structure

- `workers/post/src/db.ts` — owns the aggregate D1 query types and methods.
- `workers/post/test/db.test.ts` — verifies aggregate result mapping and that the new SQL does not select PII fields.
- `workers/post/src/dashboard.ts` — owns weekday normalization and complete server-rendered dashboard/error HTML.
- `workers/post/test/dashboard.test.ts` — verifies content, weekday order, zero filling, semantics, and PII-free output.
- `workers/post/src/handlers.ts` — routes `/post-office`, enforces GET-only behavior, handles D1 failure, and attaches privacy headers.
- `workers/post/test/handlers.test.ts` — verifies request-level routing, headers, failure behavior, and existing stub compatibility.
- `workers/post/wrangler.toml` — binds the `/post-office*` production route to `publius-post`.
- `docs/deployment.md` — documents Access configuration, safe deployment order, and production verification.

---

### Task 1: Aggregate-only D1 statistics

**Files:**
- Create: `workers/post/test/db.test.ts`
- Modify: `workers/post/src/db.ts:1-24,26-127`

**Interfaces:**
- Produces: `SubscriberStats`, `WeeklyDayStats`
- Produces: `Db.getSubscriberStats(): Promise<SubscriberStats>`
- Produces: `Db.getWeeklyDayStats(): Promise<WeeklyDayStats[]>`
- Consumes: the existing `D1Database` binding and `subscribers` schema

- [ ] **Step 1: Write the failing database tests**

Create `workers/post/test/db.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm exec vitest run workers/post/test/db.test.ts
```

Expected: FAIL because `Db` has no `getSubscriberStats` or
`getWeeklyDayStats` methods.

- [ ] **Step 3: Add the aggregate types and methods**

At the top of `workers/post/src/db.ts`, after the import, add:

```ts
export interface SubscriberStats {
  active: number;
  pending: number;
  gone: number;
  weekly: number;
  asItHappened: number;
}

export interface WeeklyDayStats {
  sendDow: number;
  active: number;
  pending: number;
}

interface SubscriberStatsRow {
  active: number;
  pending: number;
  gone: number;
  weekly: number;
  as_it_happened: number;
}

interface WeeklyDayStatsRow {
  send_dow: number;
  active: number;
  pending: number;
}
```

Add these methods to `Db`:

```ts
  getSubscriberStats(): Promise<SubscriberStats>;
  getWeeklyDayStats(): Promise<WeeklyDayStats[]>;
```

Add these methods at the beginning of the object returned by `makeDb`:

```ts
    async getSubscriberStats() {
      const row = await d1.prepare(`SELECT
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status NOT IN ('active','pending')) AS gone,
        COUNT(*) FILTER (WHERE program = 'weekly' AND status = 'active') AS weekly,
        COUNT(*) FILTER (WHERE program = 'calendar' AND status = 'active') AS as_it_happened
        FROM subscribers`).first<SubscriberStatsRow>();
      if (!row) throw new Error('subscriber stats returned no row');
      return {
        active: Number(row.active),
        pending: Number(row.pending),
        gone: Number(row.gone),
        weekly: Number(row.weekly),
        asItHappened: Number(row.as_it_happened)
      };
    },
    async getWeeklyDayStats() {
      const { results } = await d1.prepare(`SELECT send_dow,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending
        FROM subscribers
        WHERE program = 'weekly'
        GROUP BY send_dow
        ORDER BY send_dow`).all<WeeklyDayStatsRow>();
      return results.map((row) => ({
        sendDow: Number(row.send_dow),
        active: Number(row.active),
        pending: Number(row.pending)
      }));
    },
```

- [ ] **Step 4: Add neutral defaults to the existing handler stub**

In `makeStubDb` inside `workers/post/test/handlers.test.ts`, add these entries
before `getSubscriberById`:

```ts
    getSubscriberStats: vi.fn(async () => ({
      active: 0, pending: 0, gone: 0, weekly: 0, asItHappened: 0
    })),
    getWeeklyDayStats: vi.fn(async () => []),
```

- [ ] **Step 5: Run database and existing handler tests**

Run:

```bash
pnpm exec vitest run workers/post/test/db.test.ts workers/post/test/handlers.test.ts
```

Expected: both files PASS.

- [ ] **Step 6: Commit the aggregate data layer**

```bash
git add workers/post/src/db.ts workers/post/test/db.test.ts workers/post/test/handlers.test.ts
git commit -m "feat: add aggregate subscriber statistics queries"
```

---

### Task 2: PII-free responsive dashboard renderer

**Files:**
- Create: `workers/post/src/dashboard.ts`
- Create: `workers/post/test/dashboard.test.ts`

**Interfaces:**
- Consumes: `SubscriberStats`, `WeeklyDayStats` from `./db`
- Produces: `normalizeWeeklyDays(rows: WeeklyDayStats[]): DashboardDay[]`
- Produces: `renderDashboard(stats: SubscriberStats, rows: WeeklyDayStats[], refreshedAt: Date): string`
- Produces: `renderDashboardError(heading?: string, message?: string): string`

- [ ] **Step 1: Write the failing renderer tests**

Create `workers/post/test/dashboard.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the renderer test and verify it fails**

Run:

```bash
pnpm exec vitest run workers/post/test/dashboard.test.ts
```

Expected: FAIL because `../src/dashboard` does not exist.

- [ ] **Step 3: Implement the complete renderer**

Create `workers/post/src/dashboard.ts`:

```ts
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
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>${title}</title>
  <style>
    :root{color-scheme:light;--ink:#2a2118;--muted:#6e6353;--paper:#e7dfce;--sheet:#f4efe2;--rule:#b9aa91;--accent:#7b2519}
    *{box-sizing:border-box}
    dd{margin:0}
    body{margin:0;background:var(--paper);color:var(--ink);font-family:Georgia,"Times New Roman",serif;line-height:1.45}
    main{width:min(100% - 2rem,44rem);margin:0 auto;padding:2rem 0 3rem}
    header{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;border-bottom:2px solid var(--ink);padding-bottom:1rem}
    .eyebrow,.updated,.stat__label,thead,.refresh,.note{font-family:Arial,sans-serif}
    .eyebrow{margin:0 0 .25rem;color:var(--accent);font-size:.72rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
    h1,h2,p{margin-top:0}
    h1{margin-bottom:0;font-size:clamp(2rem,10vw,3.25rem);font-weight:400;line-height:.95}
    h2{margin:2rem 0 .75rem;font-size:1.35rem}
    .updated{margin:0;color:var(--muted);font-size:.72rem;text-align:right}
    .stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;margin:1.25rem 0 0}
    .stat{margin:0;background:var(--sheet);border:1px solid var(--rule);padding:1rem}
    .stat:first-child{grid-column:1/-1}
    .stat__label{display:block;color:var(--muted);font-size:.7rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    .stat__value{display:block;margin-top:.15rem;font-size:2rem;line-height:1}
    .table-wrap{overflow-x:auto;background:var(--sheet);border:1px solid var(--rule)}
    table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
    th,td{padding:.72rem .85rem;border-bottom:1px solid var(--rule)}
    tr:last-child th,tr:last-child td{border-bottom:0}
    th{text-align:left;font-weight:400}
    td{text-align:right}
    thead th{background:rgba(42,33,24,.06);font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
    tbody th{font-size:.95rem}
    .note{margin:.65rem 0 0;color:var(--muted);font-size:.72rem}
    .refresh{display:inline-flex;min-height:44px;align-items:center;margin-top:1.5rem;padding:.65rem 1rem;border:1px solid var(--ink);color:var(--ink);font-size:.72rem;font-weight:700;letter-spacing:.08em;text-decoration:none;text-transform:uppercase}
    .refresh:hover,.refresh:focus-visible{background:var(--ink);color:var(--sheet)}
    .refresh:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
    @media (min-width:38rem){main{padding-top:3rem}.stats{grid-template-columns:repeat(5,minmax(0,1fr))}.stat:first-child{grid-column:auto}.stat{padding:1rem .8rem}.stat__value{font-size:2.25rem}}
  </style>
</head>
<body>
  <main>${content}</main>
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
  const cards = [
    ['Active', stats.active],
    ['Pending', stats.pending],
    ['Gone', stats.gone],
    ['Weekly', stats.weekly],
    ['As it happened', stats.asItHappened]
  ].map(([label, value]) => `<div class="stat">
      <dt class="stat__label">${label}</dt>
      <dd><span class="stat__value">${value}</span></dd>
    </div>`).join('');
  const rows = days.map((row) => `<tr>
          <th scope="row">${row.day}</th>
          <td>${row.active}</td>
          <td>${row.pending}</td>
        </tr>`).join('');

  return document('Post Office — Federalist Reader', `<header>
      <div><p class="eyebrow">Federalist Reader</p><h1>Post Office</h1></div>
      <p class="updated">Updated<br><time datetime="${iso}">${timestamp(refreshedAt)}</time></p>
    </header>
    <section aria-labelledby="subscriber-heading">
      <h2 id="subscriber-heading">Subscribers</h2>
      <dl class="stats">${cards}</dl>
      <p class="note">Gone includes paused and unsubscribed rows awaiting cleanup.</p>
    </section>
    <section aria-labelledby="weekly-heading">
      <h2 id="weekly-heading">Weekly send days</h2>
      <div class="table-wrap"><table>
        <thead><tr><th scope="col">Day</th><th scope="col">Active</th><th scope="col">Pending</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </section>
    <a class="refresh" href="/post-office/">Refresh counts</a>`);
}

export function renderDashboardError(
  heading = 'The figures could not be loaded',
  message = 'Please wait a moment and try again.'
): string {
  return document('Post Office unavailable — Federalist Reader', `<header>
      <div><p class="eyebrow">Federalist Reader</p><h1>Post Office</h1></div>
    </header>
    <section><h2>${heading}</h2>
      <p>${message}</p>
      <a class="refresh" href="/post-office/">Try again</a>
    </section>`);
}
```

- [ ] **Step 4: Run the renderer tests**

Run:

```bash
pnpm exec vitest run workers/post/test/dashboard.test.ts
```

Expected: all renderer tests PASS.

- [ ] **Step 5: Type-check the Worker**

Run:

```bash
pnpm exec tsc -p workers/post/tsconfig.json
```

Expected: exit code 0 with no diagnostics.

- [ ] **Step 6: Commit the renderer**

```bash
git add workers/post/src/dashboard.ts workers/post/test/dashboard.test.ts
git commit -m "feat: render subscriber statistics dashboard"
```

---

### Task 3: Private dashboard request handling

**Files:**
- Modify: `workers/post/src/handlers.ts:1-21, final handleRequest function`
- Modify: `workers/post/test/handlers.test.ts:after helper setup and before subscribe tests`

**Interfaces:**
- Consumes: `Db.getSubscriberStats()`, `Db.getWeeklyDayStats()`
- Consumes: `renderDashboard(...)`, `renderDashboardError()`
- Produces: `GET /post-office` and `GET /post-office/`
- Produces: dashboard response headers and `405`/`500` behavior

- [ ] **Step 1: Write failing request-handler tests**

Add this block to `workers/post/test/handlers.test.ts` before
`describe('POST /api/subscribe', ...)`:

```ts
describe('operator dashboard', () => {
  it.each(['/post-office', '/post-office/'])('renders aggregate counts at %s', async (path) => {
    const db = makeStubDb({
      getSubscriberStats: vi.fn(async () => ({
        active: 34, pending: 3, gone: 0, weekly: 21, asItHappened: 13
      })),
      getWeeklyDayStats: vi.fn(async () => [
        { sendDow: 0, active: 1, pending: 0 },
        { sendDow: 5, active: 10, pending: 1 }
      ])
    });
    const res = await handleRequest(
      new Request(`https://federalistreader.org${path}`), ENV, db, sender);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(html).toContain('Post Office');
    expect(html).toContain('<span class="stat__value">34</span>');
    expect(html).toContain('<th scope="row">Friday</th>');
    expect(html).not.toContain(SUB.email);
  });

  it('rejects non-GET methods without querying D1', async () => {
    const db = makeStubDb();
    const res = await handleRequest(new Request(
      'https://federalistreader.org/post-office/',
      { method: 'POST' }
    ), ENV, db, sender);

    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(db.getSubscriberStats).not.toHaveBeenCalled();
    expect(db.getWeeklyDayStats).not.toHaveBeenCalled();
  });

  it('returns a private generic error when a statistics query fails', async () => {
    const db = makeStubDb({
      getSubscriberStats: vi.fn(async () => {
        throw new Error('D1_ERROR: SELECT email FROM subscribers');
      })
    });
    const res = await handleRequest(
      new Request('https://federalistreader.org/post-office/'), ENV, db, sender);
    const html = await res.text();

    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive');
    expect(html).toContain('The figures could not be loaded');
    expect(html).not.toContain('D1_ERROR');
    expect(html).not.toContain('SELECT email');
  });
});
```

- [ ] **Step 2: Run the handler tests and verify they fail**

Run:

```bash
pnpm exec vitest run workers/post/test/handlers.test.ts
```

Expected: the new dashboard cases FAIL with `404`.

- [ ] **Step 3: Add the dashboard imports and response helper**

Add this import near the top of `workers/post/src/handlers.ts`:

```ts
import { renderDashboard, renderDashboardError } from './dashboard';
```

After the existing `page` helper, add:

```ts
const DASHBOARD_HEADERS: Record<string, string> = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer'
};

function dashboardPage(html: string, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(html, {
    status,
    headers: { ...DASHBOARD_HEADERS, ...extraHeaders }
  });
}

async function handleDashboard(request: Request, db: Db): Promise<Response> {
  if (request.method !== 'GET') {
    return dashboardPage(renderDashboardError(
      'That request is not supported',
      'Open this page normally to see the current figures.'
    ), 405, { Allow: 'GET' });
  }
  try {
    const [stats, weeklyDays] = await Promise.all([
      db.getSubscriberStats(),
      db.getWeeklyDayStats()
    ]);
    return dashboardPage(renderDashboard(stats, weeklyDays, new Date()));
  } catch {
    return dashboardPage(renderDashboardError(), 500);
  }
}
```

- [ ] **Step 4: Route the normalized dashboard path**

Inside `handleRequest`, immediately after calculating `method`, add:

```ts
  if (pathname === '/post-office') return handleDashboard(request, db);
```

This placement ensures `/post-office` handles its own method check while every
existing route retains its current method-and-path matching.

- [ ] **Step 5: Run focused and full Worker tests**

Run:

```bash
pnpm exec vitest run workers/post/test/handlers.test.ts workers/post/test/dashboard.test.ts workers/post/test/db.test.ts
pnpm exec vitest run workers/post/test
```

Expected: all focused tests and the complete Worker suite PASS.

- [ ] **Step 6: Type-check and dry-run the Worker bundle**

Run:

```bash
pnpm exec tsc -p workers/post/tsconfig.json
pnpm --dir workers/post exec wrangler deploy --dry-run
```

Expected: TypeScript exits cleanly and Wrangler reports a successful dry-run
bundle without deploying.

- [ ] **Step 7: Commit request handling**

```bash
git add workers/post/src/handlers.ts workers/post/test/handlers.test.ts
git commit -m "feat: serve private subscriber dashboard"
```

---

### Task 4: Route and operations documentation

**Files:**
- Modify: `workers/post/wrangler.toml:5-10`
- Modify: `docs/deployment.md:98-109,178-219,220-260`

**Interfaces:**
- Consumes: the implemented `/post-office/` Worker handler
- Produces: production route `federalistreader.org/post-office*`
- Produces: explicit `workers_dev = false` and `preview_urls = false` ingress controls
- Produces: reproducible Cloudflare Access and smoke-test instructions

- [ ] **Step 1: Add the Worker route**

Add these ingress controls after `compatibility_date`:

```toml
workers_dev = false
preview_urls = false
```

Then update the `routes` array in `workers/post/wrangler.toml` to:

```toml
routes = [
  { pattern = "federalistreader.org/api/*", zone_name = "federalistreader.org" },
  # Wildcard, not exact: exact routes fail to match when a query string is
  # present, and every emailed manage link carries ?token=...
  { pattern = "federalistreader.org/manage*", zone_name = "federalistreader.org" },
  # Cloudflare Access must protect /post-office* before this route is deployed.
  { pattern = "federalistreader.org/post-office*", zone_name = "federalistreader.org" }
]
```

- [ ] **Step 2: Document the Access setup**

In `docs/deployment.md`, update the Worker introduction to mention the
operator dashboard, then add this subsection under **External dashboard
setup**, before Resend:

```md
**Subscriber dashboard (Cloudflare Access).** The aggregate-only operator
dashboard lives at `https://federalistreader.org/post-office/`. Configure its
Access boundary before deploying the matching Worker route:

1. Go to **Zero Trust → Access controls → Applications** and add a
   **Self-hosted** application.
2. Set the public hostname to `federalistreader.org` and the path to
   `post-office*`. This suffix wildcard covers both `/post-office` and
   `/post-office/`; a `post-office/*` path would leave the parent path outside
   the Access application.
3. Choose **Cloudflare** as the login method.
4. Add an **Allow** policy with **Cloudflare Account Member** set to the
   current account. Do not use **Everyone** or an unrestricted login-method
   rule.
5. Set the policy or application session duration to **one month**.
6. Save the application, then visit `/post-office/` in a private browser and
   confirm Access intercepts the request. A Pages 404 after authentication is
   expected until the Worker route is deployed.

Cloudflare Access is the authentication boundary. The unlinked path and robot
directives reduce discovery but are not substitutes for the Access policy.
Keep `workers_dev = false` and `preview_urls = false` in `wrangler.toml`;
otherwise those hostnames could provide a second path to the Worker outside
this custom-domain Access application.
```

- [ ] **Step 3: Document route and production verification**

Update **Routes sanity check** to include
`federalistreader.org/post-office*`, and add this dashboard check to the
production smoke test:

```md
For `/post-office/`, verify all of the following after deployment:

1. A signed-out or private browser is sent to Cloudflare authentication.
2. A current Cloudflare account member can sign in and see live aggregate
   counts.
3. A non-member is denied.
4. Refreshing the page updates the UTC timestamp and current D1 values.
5. `curl -I https://federalistreader.org/post-office/` after authentication,
   or the browser network inspector, shows `Cache-Control: private, no-store`
   and `X-Robots-Tag: noindex, nofollow, noarchive`.
6. No email address or subscriber-level field appears in the HTML.
```

Add a deploy-order warning immediately above the existing Worker deploy
instruction:

```md
Do not deploy a change that adds the `/post-office*` Worker route until the
Cloudflare Access application above is saved and verified.
```

- [ ] **Step 4: Verify config, docs, and the entire repository**

Run:

```bash
pnpm --dir workers/post exec wrangler deploy --dry-run
pnpm check
git diff --check
```

Expected: Wrangler dry-run succeeds, Astro/type checks and all Vitest suites
PASS, and `git diff --check` prints nothing.

- [ ] **Step 5: Confirm the dashboard remains absent from the public site**

Run:

```bash
rg -n "post-office|Post Office" src public
```

Expected: no matches.

- [ ] **Step 6: Commit route and documentation**

```bash
git add workers/post/wrangler.toml docs/deployment.md
git commit -m "docs: add protected dashboard deployment"
```

---

### Task 5: Cloudflare Access configuration and production deployment

**Files:**
- No repository files

**Interfaces:**
- Consumes: verified commits from Tasks 1-4
- Produces: protected production dashboard at `https://federalistreader.org/post-office/`

- [ ] **Step 1: Re-run the final local verification**

Run from the repository root:

```bash
pnpm check
pnpm exec tsc -p workers/post/tsconfig.json
pnpm --dir workers/post exec wrangler deploy --dry-run
git status --short
```

Expected: all checks PASS and the worktree is clean.

- [ ] **Step 2: Create the Access application before deploying**

Using the authenticated Cloudflare dashboard, create the self-hosted
application exactly as documented in Task 4:

- Hostname: `federalistreader.org`
- Path: `post-office*`
- Login method: Cloudflare
- Allow selector: Cloudflare Account Member, current account
- Session duration: one month

Open `https://federalistreader.org/post-office/` in a private browser.
Expected: Cloudflare authentication appears before any origin response.

- [ ] **Step 3: Deploy the Worker**

Run:

```bash
pnpm --dir workers/post run deploy
```

Expected: Wrangler reports the deployed `publius-post` Worker, lists
`federalistreader.org/post-office*` among its routes, and does not publish a
`workers.dev` or preview URL.

- [ ] **Step 4: Verify authenticated and denied behavior**

On a phone or browser:

1. Open `/post-office/` signed out and verify the Access login page.
2. Sign in with the current Cloudflare account and verify the dashboard.
3. Confirm the displayed totals agree with `pnpm --dir workers/post run stats`.
4. Verify a non-member account is denied, if a second account is available.
5. Refresh and confirm the UTC timestamp changes.

- [ ] **Step 5: Verify privacy headers and public-site isolation**

In the authenticated browser's network inspector, verify the dashboard
response includes:

```text
Cache-Control: private, no-store
X-Robots-Tag: noindex, nofollow, noarchive
Referrer-Policy: no-referrer
```

Then verify `/`, `/subscribe/`, `/manage?token=invalid`, and one `/api/*`
request still resolve through their existing Pages/Worker paths. Do not place
an Access bypass around `/post-office*`; if Access does not intercept the
path, remove the Worker route before investigating. In **Workers & Pages →
publius-post → Settings → Domains & Routes**, also confirm `workers.dev` and
preview URLs are disabled.
