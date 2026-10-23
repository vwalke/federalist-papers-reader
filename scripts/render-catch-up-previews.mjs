// scripts/render-catch-up-previews.mjs
//
// Renders every email the As It Happened catch-up adds or changes, plus the
// signup form's catch-up offer, into docs/catch-up/ as HTML (and plain text)
// previews and PNG screenshots: light, dark, and phone width.
//
// The catch-up letters are produced by the Worker's real runDaily against an
// in-memory database, so the previews are exactly what a reader would get.
//
//   PUBLIC_SITE_URL=https://federalistreader.org corepack pnpm build   # for the signup page
//   node scripts/render-catch-up-previews.mjs [--no-screenshots]
//
// Screenshots use @playwright/test's Chromium, or CHROME_PATH (default
// /usr/bin/google-chrome) when the bundled browser is not installed.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { register } from 'node:module';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

register('./ts-worker-loader.mjs', import.meta.url);

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'docs/catch-up');
const worker = (file) => import(join(root, 'workers/post/src', file));

const { runDaily } = await worker('deliver.ts');
const { renderWelcome, renderConfirmReminder } = await worker('email.ts');

const ENV = {
  SITE_URL: 'https://federalistreader.org',
  FROM_ADDRESS: 'Publius — The Federalist <publius@federalistreader.org>',
  RESEND_API_KEY: 'preview',
  TOKEN_SECRET: 'preview',
  POSTAL_ADDRESS: '1 Example Street, New York, NY 10001'
};
const CTX = {
  siteUrl: ENV.SITE_URL,
  postalAddress: ENV.POSTAL_ADDRESS,
  manageUrl: `${ENV.SITE_URL}/manage?token=PREVIEW`,
  unsubscribeUrl: `${ENV.SITE_URL}/api/unsubscribe?token=PREVIEW`
};

/** Just enough of db.ts for runDaily, with deliveries kept in memory. */
function memoryDb(subscribers) {
  const rows = [];
  const find = (s, p, d) => rows.find((r) => r.subscriber_id === s && r.paper_number === p && r.scheduled_for === d);
  const noop = async () => {};
  return {
    autoResume: noop, purgeUnsubscribed: noop, purgeStalePending: noop, purgeEmailSends: noop,
    recordEmailSend: noop, recordDailyRun: noop, setProgress: noop, clearMakeupPending: noop,
    listConfirmReminderDue: async () => [], claimConfirmReminder: async () => false,
    claimAnnouncement: async () => false, markAnnouncement: noop, listRetryableAnnouncement: async () => [],
    listDeliverable: async () => subscribers.filter((s) => s.status === 'active'),
    getSubscriberById: async (id) => subscribers.find((s) => s.id === id) ?? null,
    claimDelivery: async (s, p, d) => {
      if (find(s, p, d)) return false;
      rows.push({ subscriber_id: s, paper_number: p, scheduled_for: d, status: 'queued' });
      return true;
    },
    markDelivery: async (s, p, d, status) => { const row = find(s, p, d); if (row) row.status = status; },
    listRetryable: async () => [],
    listDeliveredItems: async (s, since) => rows.filter((r) => r.subscriber_id === s && r.scheduled_for >= since),
    markCaughtUp: async (id, on) => { const sub = subscribers.find((s) => s.id === id); sub.caught_up_on ??= on; }
  };
}

function lateReader(id, backlog, startsOn) {
  return {
    id, email: `reader${id}@example.com`, program: 'calendar', status: 'active', progress_index: 0,
    send_dow: 6, paused_until: null, token_secret: 'preview', confirmed_at: null, makeup_pending: 0,
    catchup_requested: 0, catchup_items: backlog.join(','), catchup_starts_on: startsOn, caught_up_on: null
  };
}

/** Every letter runDaily sends, keyed `${subscriberId}:${date}`. */
async function morningsFor(readers, from, to) {
  const db = memoryDb(readers);
  const letters = new Map();
  let date = from;
  const send = async (_key, mails) => {
    for (const mail of mails) letters.set(`${mail.to}:${date}`, mail);
    return mails.map((_, i) => ({ status: 'sent', id: `preview_${date}_${i}` }));
  };
  const quiet = console.log;
  console.log = () => {};
  try {
    for (; date <= to; date = new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
      await runDaily(ENV, db, send, date);
    }
  } finally {
    console.log = quiet;
  }
  return letters;
}

// Two late joiners. A confirmed November 21 after the morning run: twelve
// behind, catching up November 22 – December 3. B confirmed November 22 after
// the run: thirteen behind, catching up November 23 – December 5.
const A = lateReader(1, [101, 1, 2, 102, 3, 4, 154, 5, 6, 7, 8, 9], '2026-11-22');
const B = lateReader(2, [101, 1, 2, 102, 3, 4, 154, 5, 6, 7, 8, 9, 10], '2026-11-23');
const letters = await morningsFor([A, B], '2026-11-22', '2026-12-05');
const letter = (sub, date) => {
  const mail = letters.get(`${sub.email}:${date}`);
  if (!mail) throw new Error(`no letter for ${sub.email} on ${date}`);
  return mail;
};

const emails = [
  {
    slug: 'catch-up-first', title: 'Catch-up, first morning (catch-up alone)',
    note: 'Reader B, Monday November 23: no anniversary today, so the first catch-up paper arrives alone with an orienting line.',
    mail: letter(B, '2026-11-23'), dark: true
  },
  {
    slug: 'catch-up-combined', title: 'Catch-up on an anniversary (one combined letter)',
    note: 'Reader B, Tuesday November 24: Federalist No. 11 runs today, so it leads and catch-up 2 of 13 follows in the same letter.',
    mail: letter(B, '2026-11-24'), dark: true
  },
  {
    slug: 'caught-up', title: 'The last catch-up: the caught-up moment',
    note: 'Reader A, Thursday December 3: the twelfth and last catch-up paper, closing with the caught-up note signed by Publius.',
    mail: letter(A, '2026-12-03'), dark: true
  },
  {
    slug: 'caught-up-combined', title: 'The last catch-up on an anniversary',
    note: 'Reader B, Saturday December 5: Federalist No. 17 leads, the last catch-up follows, and the caught-up note closes the letter.',
    mail: letter(B, '2026-12-05')
  },
  {
    slug: 'welcome-catch-up', title: 'Welcome: late joiner who asked to catch up',
    note: 'Confirmed Tuesday November 10 after the morning run, with catch-up ticked: eight behind, November 11 – 18.',
    mail: renderWelcome({ program: 'calendar', season: {
      state: 'catch-up', opened: 'October 18', behind: 8,
      startsOn: 'Wednesday, November 11', finishesOn: 'Wednesday, November 18'
    } }, CTX), dark: true
  },
  {
    slug: 'welcome-catch-up-one', title: 'Welcome: one paper behind',
    note: 'Confirmed Tuesday October 20 with catch-up ticked: only Brutus No. I has run.',
    mail: renderWelcome({ program: 'calendar', season: {
      state: 'catch-up', opened: 'October 18', behind: 1,
      startsOn: 'Wednesday, October 21', finishesOn: 'Wednesday, October 21'
    } }, CTX)
  },
  {
    slug: 'welcome-live', title: 'Welcome: late joiner without catch-up (replaces the hard-coded October 18)',
    note: 'Confirmed Tuesday November 10 without catch-up (or after the cut-off): names the first paper and its date.',
    mail: renderWelcome({ program: 'calendar', season: {
      state: 'live', opened: 'October 18', closes: 'April 26',
      next: { name: 'Federalist No. 6', dateLabel: 'Saturday, November 14' }
    } }, CTX)
  },
  {
    slug: 'welcome-before-season', title: 'Welcome: before opening day',
    note: 'Confirmed before October 18: the season-opens letter, now signed.',
    mail: renderWelcome({ program: 'calendar', season: { state: 'before-season', opens: 'October 18', closes: 'April 26' } }, CTX)
  },
  {
    slug: 'welcome-between-seasons', title: 'Welcome: after the season’s last paper',
    note: 'Confirmed after April 26: looks ahead to the next season.',
    mail: renderWelcome({ program: 'calendar', season: { state: 'between-seasons', closed: 'April 26', opens: 'October 18' } }, CTX)
  },
  {
    slug: 'confirm-reminder-catch-up', title: 'Confirmation reminder for a catch-up signup',
    note: 'Three days after an unconfirmed signup that asked to catch up.',
    mail: renderConfirmReminder(`${ENV.SITE_URL}/api/confirm?token=PREVIEW`, CTX, true)
  }
];

await mkdir(join(out, 'emails'), { recursive: true });
await mkdir(join(out, 'screenshots'), { recursive: true });
for (const { slug, mail } of emails) {
  await writeFile(join(out, 'emails', `${slug}.html`), mail.html);
  await writeFile(join(out, 'emails', `${slug}.txt`), `Subject: ${mail.subject}\n\n${mail.text}\n`);
}

const escape = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
await writeFile(join(out, 'index.html'), `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>As It Happened catch-up: previews</title>
<style>body{font-family:Georgia,serif;background:#E7DFCE;color:#2A2118;max-width:46rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
h2{font-size:1.1rem;margin:2.5rem 0 .25rem}p{margin:.25rem 0}.subject{font-family:Arial,sans-serif;font-size:.85rem}
iframe{width:100%;height:46rem;border:1px solid rgba(42,33,24,.28);background:#fff;margin-top:.75rem}a{color:#1F6B66}</style></head><body>
<h1>As It Happened catch-up: previews</h1>
<p>Rendered by <code>scripts/render-catch-up-previews.mjs</code>. See <a href="DESIGN.md">DESIGN.md</a>. The signup form: <a href="signup.html">signup.html</a>.</p>
${emails.map(({ slug, title, note, mail }) => `<h2>${escape(title)}</h2><p>${escape(note)}</p>
<p class="subject"><strong>Subject:</strong> ${escape(mail.subject)} &middot; <a href="emails/${slug}.html">HTML</a> &middot; <a href="emails/${slug}.txt">text</a></p>
<iframe src="emails/${slug}.html" title="${escape(title)}" loading="lazy"></iframe>`).join('\n')}
</body></html>
`);
console.log(`wrote ${emails.length} email previews to docs/catch-up/emails/`);

if (process.argv.includes('--no-screenshots')) process.exit(0);

const { chromium } = await import('@playwright/test');
let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome' });
}

async function shoot(url, file, { width, dark = false, clock, before, fullPage = true, clip } = {}) {
  const page = await browser.newPage({
    viewport: { width, height: clip ? 900 : 360 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light'
  });
  if (clock) await page.clock.install({ time: new Date(clock) });
  await page.goto(url, { waitUntil: 'networkidle' });
  if (before) await before(page);
  const target = clip ? page.locator(clip) : page;
  await target.screenshot({ path: join(out, 'screenshots', file), ...(clip ? {} : { fullPage }) });
  await page.close();
}

for (const { slug, dark } of emails) {
  const url = `file://${join(out, 'emails', `${slug}.html`)}`;
  await shoot(url, `${slug}.png`, { width: 680 });
  await shoot(url, `${slug}-mobile.png`, { width: 390 });
  if (dark) {
    await shoot(url, `${slug}-dark.png`, { width: 680, dark: true });
    await shoot(url, `${slug}-dark-mobile.png`, { width: 390, dark: true });
  }
}
console.log('wrote email screenshots');

// The signup form, served from the built site with the clock set mid-window.
const dist = join(root, 'dist');
if (!existsSync(join(dist, 'subscribe/index.html'))) {
  console.warn('dist/ not built: skipping the signup screenshots');
} else {
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json' };
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = await readFile(join(dist, path));
      res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const site = `http://127.0.0.1:${server.address().port}`;
  const pickCalendar = async (page) => {
    await page.getByRole('radio', { name: /As It Happened/ }).check();
    await page.locator('.subscribe-coupon').scrollIntoViewIfNeeded();
  };
  // Friday October 23, noon Eastern: Brutus No. I and Federalist… not yet; one behind.
  // Tuesday November 10, noon Eastern: eight behind.
  const midWindow = '2026-11-10T17:00:00Z';
  await shoot(`${site}/subscribe/`, 'signup-calendar.png',
    { width: 1280, clock: midWindow, before: pickCalendar, clip: '.subscribe-coupon' });
  await shoot(`${site}/subscribe/`, 'signup-calendar-mobile.png',
    { width: 390, clock: midWindow, before: pickCalendar, clip: '.subscribe-coupon' });
  await shoot(`${site}/subscribe/`, 'signup-weekly.png',
    { width: 1280, clock: midWindow, clip: '.subscribe-coupon' });
  await shoot(`${site}/subscribe/`, 'signup-after-cut-off.png',
    { width: 1280, clock: '2026-11-22T17:00:00Z', before: pickCalendar, clip: '.subscribe-coupon' });
  await shoot(`${site}/subscribe/`, 'signup-page-mobile.png',
    { width: 390, clock: midWindow, before: pickCalendar });

  // A standalone HTML preview of the form in its catch-up state: the live DOM
  // after the script ran, with the site's stylesheets inlined.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.clock.install({ time: new Date(midWindow) });
  await page.goto(`${site}/subscribe/`, { waitUntil: 'networkidle' });
  await pickCalendar(page);
  let html = await page.content();
  for (const href of [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g)].map((m) => m[1])) {
    const css = (await readFile(join(dist, href), 'utf8')).replace(/url\(\/_astro\//g, 'url(../../dist/_astro/');
    html = html.replace(new RegExp(`<link[^>]+href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`), () => `<style>${css}</style>`);
  }
  html = html.replace(/<script[\s\S]*?<\/script>/g, '');
  await writeFile(join(out, 'signup.html'), `<!-- Preview: /subscribe/ on 2026-11-10 with As It Happened chosen. Rendered by scripts/render-catch-up-previews.mjs; fonts load from ../../dist when built. -->\n${html}`);
  await page.close();
  server.close();
  console.log('wrote signup screenshots and docs/catch-up/signup.html');
}
await browser.close();
