// workers/post/src/deliver.ts
import papersJson from '../content/papers.json';
import type { Db } from './db';
import type { Env, PaperContent, Subscriber } from './types';
import { papersDueOnDate, weeklyPaperDue } from './schedule';
import { renderPaperIssue, type EmailContext } from './email';
import { signToken } from './tokens';
import type { Sender } from './handlers';

const papers = papersJson as PaperContent[];
const byNumber = new Map(papers.map((p) => [p.number, p]));

async function contextFor(env: Env, sub: Subscriber): Promise<EmailContext> {
  const manage = await signToken(sub.id, 'manage', env.TOKEN_SECRET, sub.token_secret);
  const unsub = await signToken(sub.id, 'unsub', env.TOKEN_SECRET, sub.token_secret);
  return {
    siteUrl: env.SITE_URL, postalAddress: env.POSTAL_ADDRESS,
    manageUrl: `${env.SITE_URL}/manage?token=${manage}`,
    unsubscribeUrl: `${env.SITE_URL}/api/unsubscribe?token=${unsub}`
  };
}

async function sendIssue(
  env: Env, db: Db, send: Sender, sub: Subscriber, paperNumbers: number[], todayIso: string
): Promise<boolean> {
  const claimedNumbers: number[] = [];
  for (const n of paperNumbers) {
    if (await db.claimDelivery(sub.id, n, todayIso)) claimedNumbers.push(n);
  }
  if (claimedNumbers.length === 0) return false;
  const issue = claimedNumbers.map((n) => byNumber.get(n)!).filter(Boolean);
  const ctx = await contextFor(env, sub);
  if (sub.program === 'weekly') ctx.progressLine = `Paper ${claimedNumbers[0]} of 85 · The Weekly Course`;
  try {
    const mail = renderPaperIssue(issue, ctx);
    const messageId = await send(env.RESEND_API_KEY, {
      from: env.FROM_ADDRESS, to: sub.email, subject: mail.subject,
      html: mail.html, text: mail.text, unsubscribeUrl: ctx.unsubscribeUrl
    });
    for (const n of claimedNumbers) await db.markDelivery(sub.id, n, todayIso, 'sent', messageId);
    return true;
  } catch {
    for (const n of claimedNumbers) await db.markDelivery(sub.id, n, todayIso, 'failed', undefined);
    return false;
  }
}

export async function runDaily(env: Env, db: Db, send: Sender, todayIso: string): Promise<void> {
  await db.autoResume(todayIso);
  await db.purgeUnsubscribed(30);
  const dueCalendarPapers = papersDueOnDate(papers, todayIso);

  for (const sub of await db.listDeliverable()) {
    if (sub.program === 'weekly') {
      const next = weeklyPaperDue(sub, todayIso);
      if (next !== null && (await sendIssue(env, db, send, sub, [next], todayIso))) {
        await db.setProgress(sub.id, next);
      }
    } else if (dueCalendarPapers.length > 0) {
      await sendIssue(env, db, send, sub, dueCalendarPapers, todayIso);
    }
  }

  // Retry recent failures and stale queued claims (claim rows already exist; re-render and re-send).
  for (const retry of await db.listRetryable()) {
    const sub = await db.getSubscriberById(retry.subscriber_id);
    if (!sub || sub.status !== 'active') continue;
    const paper = byNumber.get(retry.paper_number);
    if (!paper) continue;
    const ctx = await contextFor(env, sub);
    if (sub.program === 'weekly') ctx.progressLine = `Paper ${retry.paper_number} of 85 · The Weekly Course`;
    try {
      const mail = renderPaperIssue([paper], ctx);
      const messageId = await send(env.RESEND_API_KEY, {
        from: env.FROM_ADDRESS, to: sub.email, subject: mail.subject,
        html: mail.html, text: mail.text, unsubscribeUrl: ctx.unsubscribeUrl
      });
      await db.markDelivery(sub.id, retry.paper_number, retry.scheduled_for, 'sent', messageId);
      if (sub.program === 'weekly' && retry.paper_number > sub.progress_index) {
        await db.setProgress(sub.id, retry.paper_number);
      }
    } catch {
      // stays failed; listRetryable's 48h window gives up naturally
    }
  }
}
