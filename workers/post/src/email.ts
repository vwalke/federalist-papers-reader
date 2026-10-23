// workers/post/src/email.ts
import type { DebateItem, EssayContent } from './types';
import { numberWord } from './season';

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
const RULE = 'rgba(42,33,24,0.28)';

// Clients that honour prefers-color-scheme (Apple Mail, iOS Mail, Outlook)
// get a dark sheet set by hand: lamp-black surround, dark paper, warm ink.
// Clients that ignore it (Gmail) keep the light sheet or apply their own
// inversion; the inline colors stay the source of truth.
const DARK_MODE_STYLE = `<style>
@media (prefers-color-scheme: dark) {
  .fr-bg { background:#15120E !important; }
  .fr-sheet { background:#221D17 !important; color:#ECE4D3 !important; border-color:rgba(236,228,211,0.22) !important; }
  .fr-muted, .fr-muted a { color:#B8AD97 !important; }
  .fr-rule { border-top-color:rgba(236,228,211,0.24) !important; }
  .fr-double { border-top-color:#ECE4D3 !important; }
  .fr-link { color:#8FCBC3 !important; }
  .fr-nutshell { border-left-color:#5FA59D !important; }
}
</style>`;

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

export function shell(bodyHtml: string, ctx: EmailContext, masthead: Masthead = GAZETTE_MASTHEAD): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
${DARK_MODE_STYLE}</head><body class="fr-bg" style="margin:0;padding:24px 12px;background:#E7DFCE;">
<div class="fr-sheet" style="max-width:560px;margin:0 auto;background:${PAPER};color:${INK};font-family:${SERIF};padding:32px 28px;border:1px solid ${RULE};">
<div style="text-align:center;">
  <div style="font-size:28px;letter-spacing:2px;">${masthead.name}</div>
  <div class="fr-muted" style="font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${MUTED};margin-top:4px;">${masthead.subline}</div>
</div>
<hr class="fr-double" style="border:none;border-top:3px double ${INK};margin:18px 0;">
${bodyHtml}
<hr class="fr-rule" style="border:none;border-top:1px solid ${RULE};margin:22px 0 14px;">
<p class="fr-muted" style="font-size:11px;color:${MUTED};text-align:center;line-height:1.7;font-family:Arial,sans-serif;">
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

export function itemDisplayName(item: DebateItem): string {
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
<p class="fr-muted" style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:${MUTED};font-family:Arial,sans-serif;">${escapeHtml(item.datelineLabel)}</p>
<h1 style="font-size:20px;text-align:center;font-weight:600;margin:14px 0 4px;">${escapeHtml(itemHeading(item))} &mdash; ${escapeHtml(item.title)}</h1>
<p class="fr-muted" style="text-align:center;font-style:italic;color:${MUTED};margin-top:0;">${escapeHtml(item.recipient)}</p>
<div class="fr-muted fr-nutshell" style="border-left:2px solid ${VERDIGRIS};padding-left:12px;font-style:italic;color:${MUTED};font-size:14px;margin:16px 0;">${escapeHtml(item.nutshell)}</div>
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

const ISSUE_RULE = `<hr class="fr-rule" style="border:none;border-top:1px solid ${RULE};margin:26px 0;">`;
const TEXT_RULE = '\n\n— — —\n\n';

function itemText(item: DebateItem, ctx: EmailContext): string {
  return `${item.datelineLabel}\n\n${itemHeading(item)} — ${item.title}\n${item.recipient}\n\n${item.nutshell}\n\n` +
    `${item.excerptParagraphs.join('\n\n')}\n\n` +
    (item.kind === 'essay' ? `${item.series.toUpperCase()}.\n\n` : '') +
    `Continue reading: ${itemUrl(item, ctx)}\n\nTalk it over: ${item.talkItOver}`;
}

function textFooter(ctx: EmailContext): string {
  return `\n\n${ctx.progressLine ?? ''}\nManage: ${ctx.manageUrl}\nUnsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`;
}

function mastheadFor(items: DebateItem[]): Masthead {
  return items.every((item) => item.kind === 'essay') ? JOURNAL_MASTHEAD : GAZETTE_MASTHEAD;
}

export function renderIssue(items: DebateItem[], ctx: EmailContext): RenderedEmail {
  const html = shell(items.map((item) => itemSection(item, ctx)).join(ISSUE_RULE), ctx, mastheadFor(items));
  const text = items.map((item) => itemText(item, ctx)).join(TEXT_RULE) + textFooter(ctx);
  return { subject: issueSubject(items), html, text };
}

const P = '<p style="font-size:15px;line-height:1.6;">';
const NOTE = `<p class="fr-muted" style="font-size:14px;line-height:1.6;font-style:italic;color:${MUTED};margin:0 0 18px;">`;
const LABEL = `<p class="fr-muted" style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${MUTED};font-family:Arial,sans-serif;text-align:center;margin:0 0 6px;">`;
const SIGNATURE = '<p style="text-align:right;font-size:14px;letter-spacing:2px;margin:18px 0 6px;">PUBLIUS.</p>';

/** The As It Happened catch-up paper riding in a morning's letter. */
export interface CatchUpIssue {
  item: DebateItem;
  /** 1-based place in the reader's backlog. */
  position: number;
  total: number;
  /** For the last catch-up: the next paper due on its anniversary, if the season has one. */
  next?: { name: string; dateLabel: string } | null;
}

function catchUpLabel(catchUp: CatchUpIssue): string {
  return `Catch-up ${catchUp.position} of ${catchUp.total}`;
}

/** The orienting line at the head of a catch-up morning, or '' when none is needed. */
function catchUpLead(catchUp: CatchUpIssue, combined: boolean): string {
  if (combined) {
    return catchUp.position === catchUp.total
      ? 'Two papers this morning: today’s, on its anniversary, and below it the last of your catch-up.'
      : 'Two papers this morning: today’s, on its anniversary, and below it the next of your catch-up.';
  }
  if (catchUp.position === 1 && catchUp.total > 1) {
    return `Here your catch-up begins: ${numberWord(catchUp.total)} papers already printed, the earliest ` +
      'first, one each morning alongside any new paper, until you are current.';
  }
  return '';
}

function caughtUpNote(catchUp: CatchUpIssue): { html: string; text: string } {
  const opening = catchUp.total === 1
    ? 'That was the one paper printed before you joined.'
    : 'That was the last of the papers printed before you joined.';
  const body = `${opening} From tomorrow the debate reaches you as it reached New York: ` +
    'each paper on its anniversary, and quiet on the days between.';
  const next = catchUp.next ? ` The next, ${catchUp.next.name}, comes on ${catchUp.next.dateLabel}.` : '';
  return {
    html: `${P}<strong>You are caught up.</strong> ${escapeHtml(body + next)}</p>${SIGNATURE}`,
    text: `You are caught up. ${body}${next}\n\nPublius`
  };
}

function calendarSubject(live: DebateItem[], catchUp: CatchUpIssue): string {
  const last = catchUp.position === catchUp.total;
  if (live.length === 0) {
    const item = catchUp.item;
    const name = `${itemDisplayName(item)} — ${item.title}`;
    return last ? `The last catch-up: ${name}` : `${catchUpLabel(catchUp)}: ${name}`;
  }
  const today = live.length === 1 ? itemDisplayName(live[0]) : issueSubject(live);
  return last ? `${today}, with the last catch-up` : `${today}, with catch-up ${catchUp.position} of ${catchUp.total}`;
}

/**
 * A calendar morning carrying a catch-up paper: the catch-up alone, or today's
 * on-date paper first with the catch-up below it, in one letter. The last
 * catch-up closes with the caught-up note, signed by Publius.
 */
export function renderCalendarIssue(
  live: DebateItem[],
  catchUp: CatchUpIssue,
  ctx: EmailContext
): RenderedEmail {
  const combined = live.length > 0;
  const last = catchUp.position === catchUp.total;
  const lead = catchUpLead(catchUp, combined);
  const label = catchUpLabel(catchUp);
  const footerCtx = { ...ctx, progressLine: `${label} · As It Happened` };
  const note = last ? caughtUpNote(catchUp) : null;

  const html = shell(
    (lead ? `${NOTE}${escapeHtml(lead)}</p>` : '') +
    live.map((item) => itemSection(item, ctx)).join(ISSUE_RULE) +
    (combined ? ISSUE_RULE : '') +
    `${LABEL}${escapeHtml(label)}</p>` +
    itemSection(catchUp.item, ctx) +
    (note ? ISSUE_RULE + note.html : ''),
    footerCtx,
    mastheadFor([...live, catchUp.item])
  );
  const text = (lead ? `${lead}\n\n` : '') +
    live.map((item) => itemText(item, ctx)).join(TEXT_RULE) +
    (combined ? TEXT_RULE : '') +
    `${label.toUpperCase()}\n\n${itemText(catchUp.item, ctx)}` +
    (note ? `${TEXT_RULE}${note.text}` : '') +
    textFooter(footerCtx);
  return { subject: calendarSubject(live, catchUp), html, text };
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

const REMINDER_BODY =
  'A few days ago you asked to receive the great debate by post, but the subscription ' +
  'was never confirmed. One click confirms it.';
const REMINDER_IGNORE =
  "If you didn't sign up, simply ignore this letter. The address will be removed " +
  'within a few days and nothing more will arrive.';

const REMINDER_CATCH_UP =
  'The catch-up you asked for is kept for you: once you confirm, the papers already ' +
  'printed follow, one each morning, until you are current.';

/**
 * The one reminder sent ~3 days after an unconfirmed signup.
 * @param catchUp True when the signup asked for As It Happened catch-up.
 */
export function renderConfirmReminder(confirmUrl: string, ctx: EmailContext, catchUp = false): RenderedEmail {
  const html = shell(`
<p style="font-size:15px;line-height:1.6;">${escapeHtml(REMINDER_BODY)}</p>${catchUp ? `
<p style="font-size:15px;line-height:1.6;">${escapeHtml(REMINDER_CATCH_UP)}</p>` : ''}
<p style="text-align:center;margin:22px 0;"><a href="${escapeHtml(confirmUrl)}" style="background:${VERDIGRIS};color:${PAPER};font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-decoration:none;padding:12px 22px;display:inline-block;">Confirm Subscription</a></p>
<p style="font-size:14px;color:${MUTED};">${escapeHtml(REMINDER_IGNORE)}</p>
<p style="text-align:right;font-size:14px;letter-spacing:2px;margin:18px 0 6px;">PUBLIUS.</p>`, ctx);
  return {
    subject: 'Reminder: confirm your subscription — The Federalist by Post',
    html,
    text: `${REMINDER_BODY}\n\n${catchUp ? `${REMINDER_CATCH_UP}\n\n` : ''}` +
      `Confirm your subscription: ${confirmUrl}\n\n${REMINDER_IGNORE}\n\nPublius`
  };
}

/** Where an As It Happened reader stands on the morning they confirm. */
export type CalendarWelcome =
  /** Before opening day: the season is still to come. */
  | { state: 'before-season'; opens: string; closes: string }
  /** Mid-season with catch-up: `behind` papers, one a morning from `startsOn` to `finishesOn`. */
  | { state: 'catch-up'; opened: string; behind: number; startsOn: string; finishesOn: string }
  /** Mid-season without catch-up: live from the next paper on its anniversary. */
  | { state: 'live'; opened: string; closes: string; next: { name: string; dateLabel: string } }
  /** After the season's last paper: the next season is still to come. */
  | { state: 'between-seasons'; closed: string; opens: string };

export type WelcomeDetails =
  /** firstDelivery is human-formatted for the reader (e.g. "July 25, 2026"), not ISO. */
  | { program: 'weekly'; firstDelivery: string; sendDayName: string }
  | { program: 'calendar'; season: CalendarWelcome };

const B = (value: string) => `<strong>${escapeHtml(value)}</strong>`;

/** Paragraphs as [html, text] pairs, so the two versions cannot drift. */
function calendarWelcomeBody(season: CalendarWelcome, ctx: EmailContext): Array<[string, string]> {
  const welcome = 'Welcome to <strong>As It Happened</strong>.';
  const welcomeText = 'Welcome to As It Happened.';
  switch (season.state) {
    case 'before-season':
      return [[
        `${welcome} The season opens ${B(season.opens)} &mdash; Brutus No. I fires first &mdash; and each paper and essay arrives on the anniversary of its first printing, through the season's close on ${escapeHtml(season.closes)}.`,
        `${welcomeText} The season opens ${season.opens} — Brutus No. I fires first — and each paper and essay arrives on the anniversary of its first printing, through the season's close on ${season.closes}.`
      ]];
    case 'catch-up': {
      const opened = `The season opened on ${season.opened} with Brutus No. I`;
      if (season.behind === 1) {
        return [[
          `${welcome} ${escapeHtml(opened)}, and one paper was printed before you joined. You asked to catch up, so it arrives on ${B(season.startsOn)}, and from then on you read the debate as New York did: each paper on its anniversary.`,
          `${welcomeText} ${opened}, and one paper was printed before you joined. You asked to catch up, so it arrives on ${season.startsOn}, and from then on you read the debate as New York did: each paper on its anniversary.`
        ]];
      }
      const behind = numberWord(season.behind);
      return [[
        `${welcome} ${escapeHtml(opened)}, and ${behind} papers were printed before you joined. You asked to catch up, so they begin on ${B(season.startsOn)}: the earliest first, one each morning, alongside any new paper on its anniversary.`,
        `${welcomeText} ${opened}, and ${behind} papers were printed before you joined. You asked to catch up, so they begin on ${season.startsOn}: the earliest first, one each morning, alongside any new paper on its anniversary.`
      ], [
        `The last arrives on ${B(season.finishesOn)}. From then on you read the debate as New York did, each paper on its own day.`,
        `The last arrives on ${season.finishesOn}. From then on you read the debate as New York did, each paper on its own day.`
      ]];
    }
    case 'live': {
      const readBack = `${ctx.siteUrl}/#all-papers`;
      return [[
        `${welcome} The season opened on ${escapeHtml(season.opened)} with Brutus No. I and is under way. Your first paper, ${B(season.next.name)}, arrives on ${B(season.next.dateLabel)}, the anniversary of its first printing, and each that follows comes on its own, through the season's close on ${escapeHtml(season.closes)}.`,
        `${welcomeText} The season opened on ${season.opened} with Brutus No. I and is under way. Your first paper, ${season.next.name}, arrives on ${season.next.dateLabel}, the anniversary of its first printing, and each that follows comes on its own, through the season's close on ${season.closes}.`
      ], [
        `Everything printed so far is on the site, should you like to <a href="${escapeHtml(readBack)}" class="fr-link" style="color:${VERDIGRIS};">read back</a>.`,
        `Everything printed so far is on the site, should you like to read back: ${readBack}`
      ]];
    }
    case 'between-seasons':
      return [[
        `${welcome} This season closed on ${escapeHtml(season.closed)}. The next opens on ${B(season.opens)} with Brutus No. I, and each paper and essay arrives on the anniversary of its first printing.`,
        `${welcomeText} This season closed on ${season.closed}. The next opens on ${season.opens} with Brutus No. I, and each paper and essay arrives on the anniversary of its first printing.`
      ]];
  }
}

export function renderWelcome(details: WelcomeDetails, ctx: EmailContext): RenderedEmail {
  let paragraphs: Array<[string, string]>;
  let manageLine: string;
  if (details.program === 'weekly') {
    const { firstDelivery, sendDayName } = details;
    paragraphs = [[
      `Welcome to <strong>The Weekly Course</strong>. The debate opens with Brutus No. I, arriving <strong>${escapeHtml(sendDayName)}, ${escapeHtml(firstDelivery)}</strong>, and one letter follows each ${escapeHtml(sendDayName)} &mdash; the eighty-five papers and the eight essays that answered them, in the order they first reached readers.`,
      `Welcome to The Weekly Course. The debate opens with Brutus No. I, arriving ${sendDayName}, ${firstDelivery}, and one letter follows each ${sendDayName} — the eighty-five papers and the eight essays that answered them, in the order they first reached readers.`
    ]];
    manageLine = 'Change your delivery day, pause, switch, or stop any time from the manage link below.';
  } else {
    paragraphs = calendarWelcomeBody(details.season, ctx);
    manageLine = details.season.state === 'catch-up'
      ? 'Pause, end the catch-up early, switch, or stop any time from the manage link below.'
      : 'Pause, switch, or stop any time from the manage link below.';
  }
  const html = shell(
    paragraphs.map(([para]) => `${P}${para}</p>`).join('\n') +
    `\n<p class="fr-muted" style="font-size:14px;color:${MUTED};">${manageLine}</p>${SIGNATURE}`,
    ctx
  );
  return {
    subject: 'Welcome — The Federalist by Post',
    html,
    text: `${paragraphs.map(([, text]) => text).join('\n\n')}\n\n` +
      `${manageLine.replace(' from the manage link below.', '')}: ${ctx.manageUrl}\n\nPublius\n\n` +
      `Unsubscribe: ${ctx.unsubscribeUrl}\n${ctx.postalAddress}`
  };
}
