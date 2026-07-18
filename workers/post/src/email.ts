// workers/post/src/email.ts
import type { PaperContent, Program } from './types';

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

function shell(bodyHtml: string, ctx: EmailContext): string {
  return `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#E7DFCE;">
<div style="max-width:560px;margin:0 auto;background:${PAPER};color:${INK};font-family:${SERIF};padding:32px 28px;border:1px solid rgba(42,33,24,0.28);">
<div style="text-align:center;">
  <div style="font-size:28px;letter-spacing:2px;">The F&oelig;deralist</div>
  <div style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${MUTED};margin-top:4px;">Publius &middot; By Post from Federalist Reader</div>
</div>
<hr style="border:none;border-top:3px double ${INK};margin:18px 0;">
${bodyHtml}
<hr style="border:none;border-top:1px solid rgba(42,33,24,0.28);margin:22px 0 14px;">
<p style="font-size:11px;color:${MUTED};text-align:center;line-height:1.7;font-family:Arial,sans-serif;">
${ctx.progressLine ? escapeHtml(ctx.progressLine) + '<br>' : ''}
<a href="${ctx.manageUrl}" style="color:${MUTED};">Manage subscription</a> &middot;
<a href="${ctx.unsubscribeUrl}" style="color:${MUTED};">Unsubscribe</a><br>
Federalist Reader &middot; ${escapeHtml(ctx.postalAddress)}
</p></div></body></html>`;
}

function paperSection(paper: PaperContent, ctx: EmailContext): string {
  const url = `${ctx.siteUrl}/papers/${paper.number}/`;
  const excerpt = paper.excerptParagraphs
    .map((p) => `<p style="font-size:15px;line-height:1.6;">${escapeHtml(p)}</p>`)
    .join('');
  return `
<p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};font-family:Arial,sans-serif;">${escapeHtml(paper.datelineLabel)}</p>
<h1 style="font-size:20px;text-align:center;font-weight:600;margin:14px 0 4px;">No. ${paper.number}. &mdash; ${escapeHtml(paper.title)}</h1>
<p style="text-align:center;font-style:italic;color:${MUTED};margin-top:0;">${escapeHtml(paper.recipient)}</p>
<div style="border-left:2px solid ${VERDIGRIS};padding-left:12px;font-style:italic;color:${MUTED};font-size:14px;margin:16px 0;">${escapeHtml(paper.nutshell)}</div>
${excerpt}
<p style="text-align:center;margin:22px 0;"><a href="${url}" style="background:${VERDIGRIS};color:${PAPER};font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:12px 22px;display:inline-block;">Continue Reading at the Gazette</a></p>
<p style="font-size:14px;"><strong>Talk it over.</strong> <em>${escapeHtml(paper.talkItOver)}</em></p>`;
}

export function renderPaperIssue(papers: PaperContent[], ctx: EmailContext): RenderedEmail {
  const subject = papers.length === 1
    ? `Federalist No. ${papers[0].number} — ${papers[0].title}`
    : `Federalist Nos. ${papers.map((p) => p.number).join(' & ')}`;
  const html = shell(
    papers.map((p) => paperSection(p, ctx)).join('<hr style="border:none;border-top:1px solid rgba(42,33,24,0.28);margin:26px 0;">'),
    ctx
  );
  const text = papers.map((p) =>
    `${p.datelineLabel}\n\nNo. ${p.number}. — ${p.title}\n${p.recipient}\n\n${p.nutshell}\n\n` +
    `${p.excerptParagraphs.join('\n\n')}\n\nContinue reading: ${ctx.siteUrl}/papers/${p.number}/\n\nTalk it over: ${p.talkItOver}`
  ).join('\n\n— — —\n\n') +
    `\n\n${ctx.progressLine ?? ''}\nManage: ${ctx.manageUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`;
  return { subject, html, text };
}

export function renderConfirmation(confirmUrl: string, ctx: EmailContext): RenderedEmail {
  const html = shell(`
<p style="font-size:15px;line-height:1.6;">You asked to receive the Federalist Papers by post. One click seals it — if this wasn't you, simply ignore this letter and nothing more will arrive.</p>
<p style="text-align:center;margin:22px 0;"><a href="${confirmUrl}" style="background:${VERDIGRIS};color:${PAPER};font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:12px 22px;display:inline-block;">Confirm Subscription</a></p>`, ctx);
  return {
    subject: 'Confirm your subscription — The Federalist by Post',
    html,
    text: `Confirm your subscription: ${confirmUrl}\nIf this wasn't you, ignore this email.`
  };
}

export function renderWelcome(program: Program, firstDelivery: string, ctx: EmailContext): RenderedEmail {
  const body = program === 'weekly'
    ? `<p style="font-size:15px;line-height:1.6;">Welcome to <strong>The Weekly Course</strong>. Federalist No. 1 arrives Saturday, <strong>${escapeHtml(firstDelivery)}</strong>, and one paper follows each Saturday for eighty-five weeks.</p>`
    : `<p style="font-size:15px;line-height:1.6;">Welcome to <strong>As It Happened</strong>. The season opens <strong>October 27</strong> — Federalist No. 1's own date — and each paper arrives on the anniversary of its first printing, through the season's close on April 26.</p>`;
  const html = shell(body + `<p style="font-size:14px;color:${MUTED};">Pause, switch, or stop any time from the manage link below.</p>`, ctx);
  const textBody = program === 'weekly'
    ? `Welcome to The Weekly Course. Federalist No. 1 arrives Saturday, ${firstDelivery}, and one paper follows each Saturday for eighty-five weeks.`
    : `Welcome to As It Happened. The season opens October 27 — Federalist No. 1's own date — and each paper arrives on the anniversary of its first printing, through the season's close on April 26.`;
  return {
    subject: 'Welcome — The Federalist by Post',
    html,
    text: `${textBody}\n\nPause, switch, or stop any time: ${ctx.manageUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`
  };
}
