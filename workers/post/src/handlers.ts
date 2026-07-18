// workers/post/src/handlers.ts
import type { Db } from './db';
import type { Env, Program, Subscriber } from './types';
import { signToken, verifyToken, type TokenPurpose } from './tokens';
import { renderConfirmation, renderWelcome, type EmailContext, type RenderedEmail } from './email';
import type { OutboundEmail } from './resend';

export type Sender = (apiKey: string, mail: OutboundEmail) => Promise<string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

function page(html: string, status = 200): Response {
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
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

async function deliver(env: Env, send: Sender, sub: Subscriber, mail: RenderedEmail, ctx: EmailContext) {
  await send(env.RESEND_API_KEY, {
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

  const existing = await db.getSubscriberByEmail(email);
  if (existing && (existing.status === 'active' || existing.status === 'paused')) {
    const ctx = await emailContext(env, existing);
    await deliver(env, send, existing, {
      subject: 'You are already subscribed — The Federalist by Post',
      html: `<p>This address already receives the papers. Manage your subscription here: <a href="${ctx.manageUrl}">${ctx.manageUrl}</a></p>`,
      text: `Already subscribed. Manage: ${ctx.manageUrl}`
    }, ctx);
    return redirect(`${env.SITE_URL}/subscribe/check-inbox/`);
  }

  const tokenSecret = crypto.randomUUID();
  const sub = await db.upsertPending(email, program, tokenSecret);
  const ctx = await emailContext(env, sub);
  const confirm = await signToken(sub.id, 'confirm', env.TOKEN_SECRET, sub.token_secret);
  await deliver(env, send, sub, renderConfirmation(`${env.SITE_URL}/api/confirm?token=${confirm}`, ctx), ctx);
  return redirect(`${env.SITE_URL}/subscribe/check-inbox/`);
}

function nextSendDate(fromIso: string, sendDow: number): string {
  const date = new Date(`${fromIso}T00:00:00Z`);
  do { date.setUTCDate(date.getUTCDate() + 1); } while (date.getUTCDay() !== sendDow);
  const confirmed = new Date(`${fromIso}T00:00:00Z`);
  if (date.getTime() - confirmed.getTime() < 2 * 86_400_000) date.setUTCDate(date.getUTCDate() + 7);
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

async function handleConfirm(request: Request, env: Env, db: Db, send: Sender): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'confirm', env, db);
  if (!sub) return page('<h1>That link is not valid.</h1><p>It may have expired — subscribe again from the site.</p>', 400);
  await db.activate(sub.id);
  const ctx = await emailContext(env, sub);
  const today = new Date().toISOString().slice(0, 10);
  const firstDelivery = sub.program === 'weekly' ? nextSendDate(today, sub.send_dow) : 'October 27';
  await deliver(env, send, sub, renderWelcome(sub.program, firstDelivery, ctx), ctx);
  return redirect(`${env.SITE_URL}/subscribe/confirmed/`);
}

function managePage(sub: Subscriber, token: string): string {
  const progress = sub.program === 'weekly'
    ? `Paper ${sub.progress_index} of 85 — The Weekly Course`
    : 'As It Happened — papers arrive on their original dates';
  const status = sub.status === 'paused'
    ? `<p><strong>Paused${sub.paused_until ? ` until ${sub.paused_until}` : ''}.</strong></p>` : '';
  const field = `<input type="hidden" name="token" value="${token}">`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manage subscription — The Federalist</title>
<style>body{font-family:Georgia,serif;background:#E7DFCE;color:#2A2118;max-width:34rem;margin:2rem auto;padding:0 1rem;}
form{display:inline}button{font-family:Arial,sans-serif;font-size:0.8rem;letter-spacing:0.1em;text-transform:uppercase;
background:#F4EFE2;border:1px solid #2A2118;padding:0.6rem 1rem;margin:0.25rem 0.25rem 0.25rem 0;cursor:pointer}
button.quit{color:#7B2519}</style></head><body>
<h1>Your subscription</h1><p>${progress}</p>${status}
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="pause"><button>Pause</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="resume"><button>Resume</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="switch"><button>Switch program</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="restart"><button>Restart from Paper 1</button></form>
<form method="post" action="/api/manage">${field}<input type="hidden" name="action" value="unsubscribe"><button class="quit">Unsubscribe</button></form>
<p style="font-size:0.85rem;color:#6E6353;">To pause until a date, use Pause and reply to any paper email — or unsubscribe and return any time.</p>
</body></html>`;
}

async function handleManageGet(request: Request, env: Env, db: Db): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'manage', env, db);
  if (!sub || sub.status === 'unsubscribed') return page('<h1>That link is not valid.</h1>', 400);
  return page(managePage(sub, token!));
}

async function handleManagePost(request: Request, env: Env, db: Db): Promise<Response> {
  const form = await request.formData();
  const token = form.get('token') as string | null;
  const sub = await requireSubscriber(token, 'manage', env, db);
  if (!sub) return page('<h1>That link is not valid.</h1>', 400);
  const action = String(form.get('action') ?? '');
  const until = (form.get('until') as string | null) || null;
  switch (action) {
    case 'pause': await db.setStatus(sub.id, 'paused', until); break;
    case 'resume': await db.setStatus(sub.id, 'active', null); break;
    case 'switch':
      await db.setProgram(sub.id, sub.program === 'weekly' ? 'calendar' : 'weekly', 0); break;
    case 'restart': await db.setProgress(sub.id, 0); break;
    case 'unsubscribe':
      await db.unsubscribe(sub.id);
      return page('<h1>Unsubscribed.</h1><p>Publius will call no more. You may re-subscribe from the site any time.</p>');
    default: return page('<h1>Unknown action.</h1>', 400);
  }
  return redirect(`${env.SITE_URL}/manage?token=${token}`);
}

async function handleUnsubscribe(request: Request, env: Env, db: Db): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token');
  const sub = await requireSubscriber(token, 'unsub', env, db);
  if (!sub) return page('<h1>That link is not valid.</h1>', 400);
  await db.unsubscribe(sub.id);
  return page('<h1>Unsubscribed.</h1><p>Publius will call no more. <a href="/subscribe/">Re-subscribe</a> any time.</p>');
}

async function verifySvix(request: Request, secret: string, payload: string): Promise<boolean> {
  const id = request.headers.get('svix-id');
  const timestamp = request.headers.get('svix-timestamp');
  const signatures = request.headers.get('svix-signature');
  if (!id || !timestamp || !signatures) return false;
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${payload}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)));
  return signatures.split(' ').some((part) => part.split(',')[1] === expected);
}

async function handleWebhook(request: Request, env: Env, db: Db): Promise<Response> {
  const payload = await request.text();
  if (env.RESEND_WEBHOOK_SECRET &&
      !(await verifySvix(request, env.RESEND_WEBHOOK_SECRET, payload))) {
    return new Response('bad signature', { status: 401 });
  }
  const event = JSON.parse(payload) as { type: string; data: { to: string[] } };
  if (event.type === 'email.bounced' || event.type === 'email.complained') {
    for (const to of event.data.to ?? []) await db.unsubscribeByEmail(to);
  }
  return new Response('ok');
}

export async function handleRequest(request: Request, env: Env, db: Db, send: Sender): Promise<Response> {
  const { pathname } = new URL(request.url);
  const method = request.method;
  if (method === 'POST' && pathname === '/api/subscribe') return handleSubscribe(request, env, db, send);
  if (method === 'GET' && pathname === '/api/confirm') return handleConfirm(request, env, db, send);
  if (method === 'GET' && pathname === '/manage') return handleManageGet(request, env, db);
  if (method === 'POST' && pathname === '/api/manage') return handleManagePost(request, env, db);
  if (pathname === '/api/unsubscribe' && (method === 'GET' || method === 'POST'))
    return handleUnsubscribe(request, env, db);
  if (method === 'POST' && pathname === '/api/webhooks/resend') return handleWebhook(request, env, db);
  return new Response('Not found', { status: 404 });
}
