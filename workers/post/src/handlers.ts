// workers/post/src/handlers.ts
import type { Db } from './db';
import type { Env, Program, Subscriber } from './types';
import { byId, items, sequence } from './content';
import { DOW_NAMES, nextDayDowEastern } from './schedule';
import {
  addDays,
  catchUpBacklog,
  catchUpClaimed,
  catchUpFinishesOn,
  catchUpLastDay,
  catchUpOpen,
  catchUpStartsOn,
  firstLiveDay,
  monthDayLabel,
  nextOnDate,
  numberWord,
  parseCatchUpItems,
  SEASON_OPENS,
  seasonCloses,
  seasonOpens,
  seasonStartYear,
  weekdayDateLabel
} from './season';
import { STALE_PENDING_DAYS } from './deliver';
import { signToken, verifyToken, type TokenPurpose } from './tokens';
import {
  escapeHtml,
  itemDisplayName,
  renderConfirmation,
  renderWelcome,
  type CalendarWelcome,
  type EmailContext,
  type RenderedEmail,
  type WelcomeDetails
} from './email';
import type { Sender } from './resend';
import { renderDashboard, renderDashboardError } from './dashboard';
import { sendAndRecord } from './send-tracking';
import { getVisitActivity } from './cloudflare-analytics';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function page(html: string, status = 200, noStore = false): Response {
  const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8' };
  if (noStore) headers['Cache-Control'] = 'no-store';
  return new Response(html, { status, headers });
}

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

async function handleDashboard(
  request: Request,
  env: Env,
  db: Db,
  fetchImpl: typeof fetch
): Promise<Response> {
  if (request.method !== 'GET') {
    return dashboardPage(renderDashboardError(
      'That request is not supported',
      'Open this page normally to see the current figures.'
    ), 405, { Allow: 'GET' });
  }
  const refreshedAt = new Date();
  try {
    const [stats, weeklyDays] = await Promise.all([
      db.getSubscriberStats(),
      db.getWeeklyDayStats()
    ]);
    const [emailResult, subscriptionResult, visitResult] = await Promise.allSettled([
      db.getEmailActivity(refreshedAt),
      db.getSubscriptionActivity(refreshedAt),
      getVisitActivity(env, refreshedAt, fetchImpl)
    ]);
    if (emailResult.status === 'rejected') console.error('dashboard email activity unavailable');
    if (subscriptionResult.status === 'rejected') console.error('dashboard subscription activity unavailable');
    if (visitResult.status === 'rejected') console.error('dashboard visit activity unavailable');
    return dashboardPage(renderDashboard(
      stats,
      weeklyDays,
      emailResult.status === 'fulfilled' ? emailResult.value : null,
      refreshedAt,
      {
        visits: visitResult.status === 'fulfilled' ? visitResult.value : null,
        subscriptions: subscriptionResult.status === 'fulfilled'
          ? subscriptionResult.value
          : null
      }
    ));
  } catch {
    return dashboardPage(renderDashboardError(), 500);
  }
}

async function emailContext(env: Env, sub: Subscriber): Promise<EmailContext> {
  const manage = await signToken(sub.id, 'manage', env.TOKEN_SECRET, sub.token_secret);
  const unsub = await signToken(sub.id, 'unsub', env.TOKEN_SECRET, sub.token_secret);
  return {
    siteUrl: env.SITE_URL,
    postalAddress: env.POSTAL_ADDRESS,
    manageUrl: `${env.SITE_URL}/manage?token=${manage}`,
    unsubscribeUrl: `${env.SITE_URL}/api/unsubscribe?token=${unsub}`
  };
}

async function deliver(
  env: Env,
  db: Db,
  send: Sender,
  sub: Subscriber,
  mail: RenderedEmail,
  ctx: EmailContext
) {
  await sendAndRecord(env, db, send, {
    from: env.FROM_ADDRESS, to: sub.email, subject: mail.subject,
    html: mail.html, text: mail.text, unsubscribeUrl: ctx.unsubscribeUrl
  });
}

async function verifyTurnstile(env: Env, token: string | null, ip: string | null): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true;
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token ?? '', remoteip: ip ?? '' })
  });
  const data = (await response.json()) as { success: boolean };
  return data.success;
}

async function handleSubscribe(request: Request, env: Env, db: Db, send: Sender): Promise<Response> {
  const form = await request.formData();
  if (form.get('contact_time')) return redirect(`${env.SITE_URL}/subscribe/check-inbox/`); // honeypot
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const program = String(form.get('program') ?? '') as Program;
  if (!EMAIL_RE.test(email) || !['weekly', 'calendar'].includes(program)) {
    return page('<h1>Something was off with that form.</h1><p>Please go back and try again.</p>', 400);
  }
  if (!(await verifyTurnstile(env, form.get('cf-turnstile-response') as string | null,
    request.headers.get('CF-Connecting-IP')))) {
    return page('<h1>Verification failed.</h1><p>Please go back and try again.</p>', 400);
  }

  // Catch-up is As It Happened only, and only asked for through the cut-off.
  const today = new Date().toISOString().slice(0, 10);
  const catchupRequested = program === 'calendar' && form.get('catchup') === '1' && catchUpOpen(today);

  const existing = await db.getSubscriberByEmail(email);
  if (existing && (existing.status === 'active' || existing.status === 'paused')) {
    const ctx = await emailContext(env, existing);
    const catchUpHint = catchupRequested && existing.program === 'calendar' && !existing.catchup_items
      ? ' To catch up on the papers already printed, open the manage page.' : '';
    await deliver(env, db, send, existing, {
      subject: 'You are already subscribed — The Federalist by Post',
      html: `<p>This address already receives the papers.${catchUpHint} Manage your subscription here: <a href="${ctx.manageUrl}">${ctx.manageUrl}</a></p>`,
      text: `Already subscribed.${catchUpHint} Manage: ${ctx.manageUrl}`
    }, ctx);
    return redirect(`${env.SITE_URL}/subscribe/check-inbox/`);
  }

  const tokenSecret = crypto.randomUUID();
  const sub = await db.upsertPending(email, program, tokenSecret, nextDayDowEastern(new Date()), catchupRequested);
  const ctx = await emailContext(env, sub);
  const confirm = await signToken(sub.id, 'confirm', env.TOKEN_SECRET, sub.token_secret);
  await deliver(env, db, send, sub, renderConfirmation(`${env.SITE_URL}/api/confirm?token=${confirm}`, ctx), ctx);
  return redirect(`${env.SITE_URL}/subscribe/check-inbox/`);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-07-25' -> 'July 25, 2026' — no ICU dependence. */
function humanDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/**
 * The catch-up backlog `sub` would have if catch-up began today: every paper of
 * the season dated before their first live morning, less what they already
 * hold this season. The last daily run says whether today's paper has gone.
 */
async function catchUpBacklogFor(db: Db, sub: Subscriber, todayIso: string): Promise<{
  backlog: number[]; firstLive: string; ranToday: boolean;
}> {
  const lastRun = await db.getLastDailyRun();
  const ranToday = lastRun !== null && lastRun >= todayIso;
  const firstLive = firstLiveDay(todayIso, ranToday);
  const held = await db.listDeliveredItems(sub.id, seasonOpens(firstLive));
  return {
    backlog: catchUpBacklog(items, firstLive, new Set(held.map((row) => row.paper_number))),
    firstLive,
    ranToday
  };
}

/**
 * Where a newly confirmed As It Happened reader stands, starting their
 * catch-up when they asked for it. A request made by the cut-off is honoured
 * for the life of the signup (it is purged unconfirmed after STALE_PENDING_DAYS),
 * so a slow inbox does not cost the reader their catch-up.
 */
async function calendarWelcome(db: Db, sub: Subscriber, todayIso: string): Promise<CalendarWelcome> {
  const opens = seasonOpens(todayIso);
  const closes = seasonCloses(todayIso);
  const { backlog, firstLive } = await catchUpBacklogFor(db, sub, todayIso);
  if (firstLive <= opens) {
    return { state: 'before-season', opens: monthDayLabel(opens), closes: monthDayLabel(closes) };
  }
  const honoured = todayIso <= addDays(catchUpLastDay(todayIso), STALE_PENDING_DAYS);
  if (sub.catchup_requested === 1 && honoured && backlog.length > 0) {
    const startsOn = catchUpStartsOn(todayIso);
    await db.startCatchUp(sub.id, backlog, startsOn);
    return {
      state: 'catch-up',
      opened: monthDayLabel(opens),
      behind: backlog.length,
      startsOn: weekdayDateLabel(startsOn),
      finishesOn: weekdayDateLabel(catchUpFinishesOn(startsOn, backlog.length))
    };
  }
  const next = nextOnDate(items, firstLive);
  const nextItem = next ? byId.get(next.id) : undefined;
  if (!next || !nextItem) {
    return {
      state: 'between-seasons',
      closed: monthDayLabel(closes),
      opens: monthDayLabel(`${seasonStartYear(todayIso) + 1}-${SEASON_OPENS}`)
    };
  }
  return {
    state: 'live',
    opened: monthDayLabel(opens),
    closes: monthDayLabel(closes),
    next: { name: itemDisplayName(nextItem), dateLabel: weekdayDateLabel(next.date) }
  };
}

/** Next occurrence of sendDow strictly after fromIso — mirrors weeklyItemDue's 1-day guard. */
function nextSendDate(fromIso: string, sendDow: number): string {
  const date = new Date(`${fromIso}T00:00:00Z`);
  do { date.setUTCDate(date.getUTCDate() + 1); } while (date.getUTCDay() !== sendDow);
  return date.toISOString().slice(0, 10);
}

async function requireSubscriber(
  token: string | null, purpose: TokenPurpose, env: Env, db: Db
): Promise<Subscriber | null> {
  if (!token) return null;
  const id = await verifyToken(token, purpose, env.TOKEN_SECRET,
    async (subscriberId) => (await db.getSubscriberById(subscriberId))?.token_secret ?? null);
  return id === null ? null : db.getSubscriberById(id);
}

const INVALID_CONFIRM =
  '<h1>That link is not valid.</h1><p>It may have expired — subscribe again from the site.</p>';

// GET must not mutate: mail scanners prefetch links and would confirm addresses
// nobody asked to subscribe. GET renders a single-button POST form; POST
// confirms. Links in already-sent emails point at this GET URL.
async function handleConfirmGet(request: Request, env: Env, db: Db): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'confirm', env, db);
  if (!sub || sub.status === 'unsubscribed') return page(INVALID_CONFIRM, 400, true);
  if (sub.status !== 'pending') {
    return page(plainPage('Already confirmed', `<h1>Already confirmed</h1>
<p>This address is already subscribed. <a href="/subscribe/confirmed/">What happens next</a></p>`), 200, true);
  }
  return page(plainPage('Confirm your subscription', `<h1>Confirm your subscription</h1>
<p>One click and the papers begin arriving by post.</p>
<form method="post" action="/api/confirm?token=${escapeHtml(token!)}"><button>Confirm subscription</button></form>`), 200, true);
}

async function handleConfirmPost(request: Request, env: Env, db: Db, send: Sender): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'confirm', env, db);
  if (!sub || sub.status === 'unsubscribed') return page(INVALID_CONFIRM, 400, true);
  // Only the request that actually moves the row out of 'pending' sends the
  // welcome; a double-click or replay just lands on the confirmed page.
  if (!(await db.activate(sub.id, request.headers.get('CF-Connecting-IP')))) {
    return redirect(`${env.SITE_URL}/subscribe/confirmed/`);
  }
  const ctx = await emailContext(env, sub);
  const today = new Date().toISOString().slice(0, 10);
  const details: WelcomeDetails = sub.program === 'weekly'
    ? {
      program: 'weekly',
      firstDelivery: humanDate(nextSendDate(today, sub.send_dow)),
      sendDayName: DOW_NAMES[sub.send_dow]
    }
    : { program: 'calendar', season: await calendarWelcome(db, sub, today) };
  await deliver(env, db, send, sub, renderWelcome(details, ctx), ctx);
  return redirect(`${env.SITE_URL}/subscribe/confirmed/`);
}

const PAGE_STYLE = `<style>body{font-family:Georgia,serif;background:#E7DFCE;color:#2A2118;max-width:34rem;margin:2rem auto;padding:0 1rem;}
form{display:inline}button{font-family:Arial,sans-serif;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;
background:#F4EFE2;border:1px solid #2A2118;padding:0.6rem 1rem;margin:0.25rem 0.25rem 0.25rem 0;cursor:pointer}
button.quit{color:#7B2519}
select{font-family:Arial,sans-serif;font-size:0.8rem;padding:0.5rem;background:#F4EFE2;border:1px solid #2A2118}</style>`;

function plainPage(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — The Federalist</title>
${PAGE_STYLE}</head><body>
${body}
</body></html>`;
}

type CatchUpView =
  | { kind: 'none' }
  | { kind: 'offer'; behind: number }
  | { kind: 'catching-up'; sent: number; total: number; finishesOn: string | null }
  | { kind: 'caught-up'; on: string };

async function catchUpView(db: Db, sub: Subscriber, todayIso: string): Promise<CatchUpView> {
  if (sub.program !== 'calendar') return { kind: 'none' };
  const total = parseCatchUpItems(sub.catchup_items).length;
  if (total > 0 && sub.caught_up_on) {
    return sub.caught_up_on >= seasonOpens(todayIso) ? { kind: 'caught-up', on: sub.caught_up_on } : { kind: 'none' };
  }
  if (total > 0) {
    const delivered = await db.listDeliveredItems(sub.id, seasonOpens(todayIso));
    const sent = catchUpClaimed(sub, delivered);
    let finishesOn: string | null = null;
    if (sub.status === 'active') {
      const lastRun = await db.getLastDailyRun();
      const nextRun = firstLiveDay(todayIso, lastRun !== null && lastRun >= todayIso);
      const from = sub.catchup_starts_on && sub.catchup_starts_on > nextRun ? sub.catchup_starts_on : nextRun;
      finishesOn = catchUpFinishesOn(from, total - sent);
    }
    return { kind: 'catching-up', sent, total, finishesOn };
  }
  if (!catchUpOpen(todayIso)) return { kind: 'none' };
  const { backlog } = await catchUpBacklogFor(db, sub, todayIso);
  return backlog.length > 0 ? { kind: 'offer', behind: backlog.length } : { kind: 'none' };
}

function catchUpSection(view: CatchUpView, field: string): string {
  switch (view.kind) {
    case 'none': return '';
    case 'offer': {
      const behind = view.behind === 1 ? 'One paper was' : `${numberWord(view.behind)[0].toUpperCase()}${numberWord(view.behind).slice(1)} papers were`;
      return `<h2>Catch up</h2>
<p>${behind} printed before you joined. Catch up, and ${view.behind === 1 ? 'it arrives' : 'they arrive'} one extra each morning, earliest first, until you are current.</p>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="catchup"><button>Catch up</button></form>`;
    }
    case 'catching-up':
      return `<h2>Catching up</h2>
<p>${view.sent} of ${view.total} sent.${view.finishesOn
        ? ` The last arrives ${escapeHtml(weekdayDateLabel(view.finishesOn))}.`
        : ' The catch-up waits while your subscription is paused.'}</p>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="catchup-stop"><button>End the catch-up</button></form>`;
    case 'caught-up':
      return `<p>Caught up on ${escapeHtml(weekdayDateLabel(view.on))}.</p>`;
  }
}

function managePage(sub: Subscriber, token: string, catchUp: CatchUpView = { kind: 'none' }): string {
  const progress = sub.program === 'weekly'
    ? `${sub.progress_index} of ${sequence.length} in the debate — The Weekly Course, arriving ${DOW_NAMES[sub.send_dow]}s`
    : 'As It Happened — papers and essays arrive on their original dates';
  const status = sub.status === 'paused'
    ? `<p><strong>Paused${sub.paused_until ? ` until ${escapeHtml(sub.paused_until)}` : ''}.</strong></p>` : '';
  const field = `<input type="hidden" name="token" value="${escapeHtml(token)}">`;
  const dayOptions = DOW_NAMES.map((name, dow) =>
    `<option value="${dow}"${dow === sub.send_dow ? ' selected' : ''}>${name}</option>`).join('');
  const dayForm = sub.program === 'weekly'
    ? `<p><form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="setday">
<label>Delivery day <select name="dow">${dayOptions}</select></label> <button>Set day</button></form></p>`
    : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manage subscription — The Federalist</title>
${PAGE_STYLE}</head><body>
<h1>Your subscription</h1><p>${progress}</p>${status}
${dayForm}${catchUpSection(catchUp, field)}
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="pause"><button>Pause</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="resume"><button>Resume</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="switch"><button>Switch program</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="restart"><button>Restart from the beginning</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="unsubscribe"><button class="quit">Unsubscribe</button></form>
<p style="font-size:0.85rem;color:#6E6353;">To pause until a date, use Pause and reply to any paper email — or unsubscribe and return any time.</p>
</body></html>`;
}

async function handleManageGet(request: Request, env: Env, db: Db): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'manage', env, db);
  if (!sub || sub.status === 'unsubscribed') return page('<h1>That link is not valid.</h1>', 400, true);
  const today = new Date().toISOString().slice(0, 10);
  return page(managePage(sub, token!, await catchUpView(db, sub, today)), 200, true);
}

async function handleManagePost(request: Request, env: Env, db: Db): Promise<Response> {
  const form = await request.formData();
  const token = form.get('token') as string | null;
  const sub = await requireSubscriber(token, 'manage', env, db);
  if (!sub || sub.status === 'unsubscribed') return page('<h1>That link is not valid.</h1>', 400);
  const action = String(form.get('action') ?? '');
  const until = (form.get('until') as string | null) || null;
  if (until !== null && !/^\d{4}-\d{2}-\d{2}$/.test(until)) {
    return page('<h1>That date is not valid.</h1><p>Use the form YYYY-MM-DD.</p>', 400);
  }
  switch (action) {
    case 'pause': await db.setStatus(sub.id, 'paused', until); break;
    case 'resume': await db.setStatus(sub.id, 'active', null); break;
    case 'switch':
      await db.setProgram(sub.id, sub.program === 'weekly' ? 'calendar' : 'weekly', 0); break;
    case 'restart': await db.setProgress(sub.id, 0); break;
    case 'catchup': {
      // Opting in from the manage page follows the signup rule: through the cut-off only.
      const today = new Date().toISOString().slice(0, 10);
      if (sub.program !== 'calendar' || sub.catchup_items || !catchUpOpen(today)) break;
      const { backlog } = await catchUpBacklogFor(db, sub, today);
      if (backlog.length > 0) await db.startCatchUp(sub.id, backlog, catchUpStartsOn(today));
      break;
    }
    case 'catchup-stop': await db.stopCatchUp(sub.id); break;
    case 'setday': {
      const dow = Number(form.get('dow'));
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return page('<h1>That day is not valid.</h1>', 400);
      }
      await db.setSendDow(sub.id, dow);
      break;
    }
    case 'unsubscribe':
      await db.unsubscribe(sub.id);
      return page('<h1>Unsubscribed.</h1><p>Publius will call no more. You may re-subscribe from the site any time.</p>');
    default: return page('<h1>Unknown action.</h1>', 400);
  }
  return redirect(`${env.SITE_URL}/manage?token=${token}`);
}

// GET must not mutate: mail scanners prefetch links and would silently unsubscribe
// readers. GET renders a single-button POST form; POST performs the unsubscribe.
async function handleUnsubscribeGet(request: Request, env: Env, db: Db): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'unsub', env, db);
  if (!sub) return page('<h1>That link is not valid.</h1>', 400, true);
  return page(`<h1>Unsubscribe</h1>
<form method="post" action="/api/unsubscribe?token=${escapeHtml(token!)}"><button>Unsubscribe</button></form>`, 200, true);
}

async function handleUnsubscribePost(request: Request, env: Env, db: Db): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'unsub', env, db);
  if (!sub) return page('<h1>That link is not valid.</h1>', 400, true);
  await db.unsubscribe(sub.id);
  return page('<h1>Unsubscribed.</h1><p>Publius will call no more. <a href="/subscribe/">Re-subscribe</a> any time.</p>', 200, true);
}

const SVIX_TOLERANCE_SECONDS = 5 * 60;

async function verifySvix(request: Request, secret: string, payload: string): Promise<boolean> {
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatures = request.headers.get('svix-signature');
  if (!id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SVIX_TOLERANCE_SECONDS) return false;
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return signatures.split(' ').some((part) => part.startsWith('v1,') && part.slice(3) === expected);
}

async function handleWebhook(request: Request, env: Env, db: Db): Promise<Response> {
  // Fail closed: without a configured signing secret we cannot authenticate the
  // caller, so never process the event.
  if (!env.RESEND_WEBHOOK_SECRET) return new Response('webhook secret not configured', { status: 401 });
  const payload = await request.text();
  if (!(await verifySvix(request, env.RESEND_WEBHOOK_SECRET, payload))) {
    return new Response('bad signature', { status: 401 });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return new Response('bad payload', { status: 400 });
  }
  if (!parsed || typeof parsed !== 'object') {
    return new Response('bad payload', { status: 400 });
  }
  const event = parsed as Record<string, unknown>;
  const data = event.data;
  if (!data || typeof data !== 'object') {
    return new Response('bad payload', { status: 400 });
  }
  const fields = data as Record<string, unknown>;

  if (event.type === 'email.sent') {
    if (typeof fields.email_id !== 'string' || fields.email_id.length === 0 ||
      typeof fields.created_at !== 'string' ||
      !Number.isFinite(Date.parse(fields.created_at))) {
      return new Response('bad payload', { status: 400 });
    }
    const recipientCount = Math.max(
      1,
      (Array.isArray(fields.to) ? fields.to.length : 0) +
      (Array.isArray(fields.cc) ? fields.cc.length : 0) +
      (Array.isArray(fields.bcc) ? fields.bcc.length : 0)
    );
    try {
      await db.recordEmailSend(
        fields.email_id,
        new Date(fields.created_at).toISOString(),
        recipientCount
      );
    } catch {
      console.error('email.sent webhook persistence failed');
      return new Response('webhook persistence failed', { status: 500 });
    }
  } else if (event.type === 'email.delivered' || event.type === 'email.delivery_delayed') {
    if (typeof fields.email_id !== 'string' || fields.email_id.length === 0) {
      return new Response('bad payload', { status: 400 });
    }
    const occurredAt = typeof event.created_at === 'string' && Number.isFinite(Date.parse(event.created_at))
      ? new Date(event.created_at).toISOString()
      : new Date().toISOString();
    try {
      await db.recordEmailDelivery(
        fields.email_id,
        event.type === 'email.delivered' ? 'delivered' : 'delivery_delayed',
        occurredAt
      );
    } catch {
      console.error(`${event.type} webhook persistence failed`);
      return new Response('webhook persistence failed', { status: 500 });
    }
  } else if (event.type === 'email.bounced' || event.type === 'email.complained') {
    const recipients = Array.isArray(fields.to) ? fields.to : [];
    for (const to of recipients) {
      if (typeof to === 'string') await db.unsubscribeByEmail(to);
    }
  }
  return new Response('ok');
}

export async function handleRequest(
  request: Request,
  env: Env,
  db: Db,
  send: Sender,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const rawPathname = new URL(request.url).pathname;
  // The site is built with trailingSlash: 'always', so tolerate a trailing
  // slash on every route rather than 404ing on /api/subscribe/.
  const pathname = rawPathname.length > 1 && rawPathname.endsWith('/')
    ? rawPathname.slice(0, -1)
    : rawPathname;
  const method = request.method;
  if (pathname === '/post-office') return handleDashboard(request, env, db, fetchImpl);
  if (method === 'POST' && pathname === '/api/subscribe') return handleSubscribe(request, env, db, send);
  if (method === 'GET' && pathname === '/api/confirm') return handleConfirmGet(request, env, db);
  if (method === 'POST' && pathname === '/api/confirm') return handleConfirmPost(request, env, db, send);
  if (method === 'GET' && pathname === '/manage') return handleManageGet(request, env, db);
  if (method === 'POST' && pathname === '/api/manage') return handleManagePost(request, env, db);
  if (method === 'GET' && pathname === '/api/unsubscribe') return handleUnsubscribeGet(request, env, db);
  if (method === 'POST' && pathname === '/api/unsubscribe') return handleUnsubscribePost(request, env, db);
  if (method === 'POST' && pathname === '/api/webhooks/resend') return handleWebhook(request, env, db);
  return new Response('Not found', { status: 404 });
}
