// workers/post/src/email.ts
import type { DebateItem, EssayContent, Program } from './types';

export interface RenderedEmail { subject: string; html: string; text: string; }

export interface EmailContext {
  siteUrl: string;
  postalAddress: string;
  manageUrl: string;
  unsubscribeUrl: string;
  progressLine?: string;
}

const INK = '#2A2118', PAPER = '#F4EFE2', MUTED = '#6E6353', VERDIGRIS = '#1F6B66';
const SERIF = "Georgia, 'Times New Roman', serif";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface Masthead { name: string; subline: string; }

const GAZETTE_MASTHEAD: Masthead = {
  name: 'The F&oelig;deralist',
  subline: 'Publius &middot; By Post from Federalist Reader'
};
const JOURNAL_MASTHEAD: Masthead = {
  name: 'The New-York Journal',
  subline: 'Brutus &amp; Cato &middot; By Post from Federalist Reader'
};

function shell(bodyHtml: string, ctx: EmailContext, masthead: Masthead = GAZETTE_MASTHEAD): string {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px 12px;background:#E7DFCE;">
<div style="max-width:560px;margin:0 auto;background:${PAPER};color:${INK};font-family:${SERIF};padding:32px 28px;border:1px solid rgba(42,33,24,0.28);">
<div style="text-align:center;">
  <div style="font-size:28px;letter-spacing:2px;">${masthead.name}</div>
  <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${MUTED};margin-top:4px;">${masthead.subline}</div>
</div>
<hr style="border:none;border-top:3px double ${INK};margin:18px 0;">
${bodyHtml}
<hr style="border:none;border-top:1px solid rgba(42,33,24,0.28);margin:22px 0 14px;">
<p style="font-size:11px;color:${MUTED};text-align:center;line-height:1.7;font-family:Arial,sans-serif;">
${ctx.progressLine ? escapeHtml(ctx.progressLine) + '<br>' : ''}
<a href="${escapeHtml(ctx.manageUrl)}" style="color:${MUTED};">Manage subscription</a> &middot;
<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:${MUTED};">Unsubscribe</a><br>
Federalist Reader &middot; ${escapeHtml(ctx.postalAddress)}
</p></div></body></html>`;
}

function itemUrl(item: DebateItem, ctx: EmailContext): string {
  return item.kind === 'paper'
    ? `${ctx.siteUrl}/papers/${item.number}/`
    : `${ctx.siteUrl}/antifederalist/${item.slug}/`;
}

function itemDisplayName(item: DebateItem): string {
  return item.kind === 'paper' ? `Federalist No. ${item.number}` : item.displayName;
}

/** "Brutus No. I" -> "BRUTUS. No. I." — the Journal's own heading style. */
function essayHeading(essay: EssayContent): string {
  return `${essay.series.toUpperCase()}. ${essay.displayName.slice(essay.series.length + 1)}.`;
}

function itemHeading(item: DebateItem): string {
  return item.kind === 'paper' ? `No. ${item.number}.` : essayHeading(item);
}

function itemSection(item: DebateItem, ctx: EmailContext): string {
  const url = itemUrl(item, ctx);
  const excerpt = item.excerptParagraphs
    .map((p) => `<p style="font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`)
    .join('');
  // Where Publius signs off into the Gazette, the Journal's essays carry their
  // pseudonymous signature — BRUTUS. or CATO. — at the close of the excerpt.
  const signature = item.kind === 'essay'
    ? `<p style="text-align:right;font-size:14px;letter-spacing:2px;margin:18px 0 6px;">${escapeHtml(item.series.toUpperCase())}.</p>`
    : '';
  const readAt = item.kind === 'paper' ? 'Continue Reading at the Gazette' : 'Continue Reading at the Journal';
  return `
<p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};font-family:Arial,sans-serif;">${escapeHtml(item.datelineLabel)}</p>
<h1 style="font-size:20px;text-align:center;font-weight:600;margin:14px 0 4px;">${escapeHtml(itemHeading(item))} &mdash; ${escapeHtml(item.title)}</h1>
<p style="text-align:center;font-style:italic;color:${MUTED};margin-top:0;">${escapeHtml(item.recipient)}</p>
<div style="border-left:2px solid ${VERDIGRIS};padding-left:12px;font-style:italic;color:${MUTED};font-size:14px;margin:16px 0;">${escapeHtml(item.nutshell)}</div>
${excerpt}${signature}
<p style="text-align:center;margin:22px 0;"><a href="${escapeHtml(url)}" style="background:${VERDIGRIS};color:${PAPER};font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:12px 22px;display:inline-block;">${readAt}</a></p>
<p style="font-size:14px;"><strong>Talk it over.</strong> <em>${escapeHtml(item.talkItOver)}</em></p>`;
}

function issueSubject(items: DebateItem[]): string {
  if (items.length === 1) return `${itemDisplayName(items[0])} — ${items[0].title}`;
  if (items.every((item) => item.kind === 'paper')) {
    return `Federalist Nos. ${items.map((item) => item.number).join(' & ')}`;
  }
  return items.map(itemDisplayName).join(' & ');
}

export function renderIssue(items: DebateItem[], ctx: EmailContext): RenderedEmail {
  const masthead = items.every((item) => item.kind === 'essay') ? JOURNAL_MASTHEAD : GAZETTE_MASTHEAD;
  const html = shell(
    items.map((item) => itemSection(item, ctx)).join('<hr style="border:none;border-top:1px solid rgba(42,33,24,0.28);margin:26px 0;">'),
    ctx,
    masthead
  );
  const text = items.map((item) =>
    `${item.datelineLabel}\n\n${itemHeading(item)} — ${item.title}\n${item.recipient}\n\n${item.nutshell}\n\n` +
    `${item.excerptParagraphs.join('\n\n')}\n\n` +
    (item.kind === 'essay' ? `${item.series.toUpperCase()}.\n\n` : '') +
    `Continue reading: ${itemUrl(item, ctx)}\n\nTalk it over: ${item.talkItOver}`
  ).join('\n\n— — —\n\n') +
    `\n\n${ctx.progressLine ?? ''}\nManage: ${ctx.manageUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`;
  return { subject: issueSubject(items), html, text };
}

const MAKEUP_SUBJECT = 'The other side of the argument — a catch-up from the New-York Journal';

const MAKEUP_FRAMING =
  'The ratification debate had two sides. The essays below answered Publius in the ' +
  'New-York Journal, and each ran before the point you have reached in the course. ' +
  'From next week your letters continue in the order the whole debate reached ' +
  'readers — both sides included.';

/** One catch-up issue covering the essays a migrated weekly reader has passed. */
export function renderMakeupIssue(essays: EssayContent[], ctx: EmailContext): RenderedEmail {
  const blocks = essays.map((essay) => `
<h2 style="font-size:16px;font-weight:600;margin:20px 0 4px;">${escapeHtml(essay.displayName)} &mdash; ${escapeHtml(essay.title)}</h2>
<div style="border-left:2px solid ${VERDIGRIS};padding-left:12px;font-style:italic;color:${MUTED};font-size:14px;margin:10px 0;">${escapeHtml(essay.nutshell)}</div>
<p style="font-size:14px;margin:8px 0 0;"><a href="${escapeHtml(itemUrl(essay, ctx))}" style="color:${VERDIGRIS};">Read ${escapeHtml(essay.displayName)} at the Journal</a></p>`
  ).join('<hr style="border:none;border-top:1px solid rgba(42,33,24,0.28);margin:22px 0;">');
  const html = shell(
    `<p style="font-size:15px;line-height:1.6;">${escapeHtml(MAKEUP_FRAMING)}</p>${blocks}`,
    ctx,
    JOURNAL_MASTHEAD
  );
  const text = `${MAKEUP_FRAMING}\n\n` +
    essays.map((essay) =>
      `${essay.displayName} — ${essay.title}\n${essay.nutshell}\nRead: ${itemUrl(essay, ctx)}`
    ).join('\n\n— — —\n\n') +
    `\n\nManage: ${ctx.manageUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`;
  return { subject: MAKEUP_SUBJECT, html, text };
}

export function renderConfirmation(confirmUrl: string, ctx: EmailContext): RenderedEmail {
  const html = shell(`
<p style="font-size:15px;line-height:1.6;">You asked to receive the great debate by post &mdash; the eighty-five Federalist papers and the eight essays that answered them. One click seals it &mdash; if this wasn't you, simply ignore this letter and nothing more will arrive.</p>
<p style="text-align:center;margin:22px 0;"><a href="${escapeHtml(confirmUrl)}" style="background:${VERDIGRIS};color:${PAPER};font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:12px 22px;display:inline-block;">Confirm Subscription</a></p>`, ctx);
  return {
    subject: 'Confirm your subscription — The Federalist by Post',
    html,
    text: `Confirm your subscription: ${confirmUrl}\nIf this wasn't you, ignore this email.`
  };
}

/**
 * @param firstDelivery Human-formatted date for the reader (e.g. "July 25, 2026"),
 *   not an ISO string — it is interpolated verbatim into the email copy.
 * @param sendDayName Weekday name of the subscriber's send day (weekly program only).
 */
export function renderWelcome(
  program: Program, firstDelivery: string, sendDayName: string, ctx: EmailContext
): RenderedEmail {
  const body = program === 'weekly'
    ? `<p style="font-size:15px;line-height:1.6;">Welcome to <strong>The Weekly Course</strong>. The debate opens with Brutus No. I, arriving <strong>${escapeHtml(sendDayName)}, ${escapeHtml(firstDelivery)}</strong>, and one letter follows each ${escapeHtml(sendDayName)} &mdash; the eighty-five papers and the eight essays that answered them, in the order they first reached readers.</p>`
    : `<p style="font-size:15px;line-height:1.6;">Welcome to <strong>As It Happened</strong>. The season opens <strong>October 18</strong> &mdash; Brutus No. I fires first &mdash; and each paper and essay arrives on the anniversary of its first printing, through the season's close on April 26.</p>`;
  const manageLine = program === 'weekly'
    ? 'Change your delivery day, pause, switch, or stop any time from the manage link below.'
    : 'Pause, switch, or stop any time from the manage link below.';
  const html = shell(body + `<p style="font-size:14px;color:${MUTED};">${manageLine}</p>`, ctx);
  const textBody = program === 'weekly'
    ? `Welcome to The Weekly Course. The debate opens with Brutus No. I, arriving ${sendDayName}, ${firstDelivery}, and one letter follows each ${sendDayName} — the eighty-five papers and the eight essays that answered them, in the order they first reached readers.`
    : `Welcome to As It Happened. The season opens October 18 — Brutus No. I fires first — and each paper and essay arrives on the anniversary of its first printing, through the season's close on April 26.`;
  return {
    subject: 'Welcome — The Federalist by Post',
    html,
    text: `${textBody}\n\n${manageLine.replace(' from the manage link below', '')}: ${ctx.manageUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`
  };
}
