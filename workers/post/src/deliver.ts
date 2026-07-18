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

// Resend's default rate limit is ~2 req/s, so pause after every send attempt.
// At ~1000 subscribers this is ~10 min per run, inside the 15-min cron limit;
// revisit with batching if the list approaches that size.
function pace(pauseMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, pauseMs));
}

type SendOutcome = 'sent' | 'failed' | 'noop';

async function sendIssue(
  env: Env, db: Db, send: Sender, sub: Subscriber, paperNumbers: number[],
  todayIso: string, pauseMs: number
): Promise<SendOutcome> {
  const claimedNumbers: number[] = [];
  for (const n of paperNumbers) {
    if (await db.claimDelivery(sub.id, n, todayIso)) claimedNumbers.push(n);
  }
  if (claimedNumbers.length === 0) return 'noop';
  const issue = claimedNumbers
    .map((n) => byNumber.get(n))
    .filter((p): p is PaperContent => p !== undefined);
  if (issue.length === 0) {
    console.error('deliver claimed papers with no content',
      { subscriberId: sub.id, papers: claimedNumbers });
    for (const n of claimedNumbers) await db.markDelivery(sub.id, n, todayIso, 'failed', undefined);
    return 'failed';
  }
  const ctx = await contextFor(env, sub);
  if (sub.program === 'weekly') ctx.progressLine = `Paper ${claimedNumbers[0]} of 85 · The Weekly Course`;
  try {
    const mail = renderPaperIssue(issue, ctx);
    const messageId = await send(env.RESEND_API_KEY, {
      from: env.FROM_ADDRESS, to: sub.email, subject: mail.subject,
      html: mail.html, text: mail.text, unsubscribeUrl: ctx.unsubscribeUrl
    });
    for (const n of claimedNumbers) await db.markDelivery(sub.id, n, todayIso, 'sent', messageId);
    return 'sent';
  } catch (error) {
    console.error('deliver send failed',
      { subscriberId: sub.id, papers: claimedNumbers, error: String(error) });
    for (const n of claimedNumbers) await db.markDelivery(sub.id, n, todayIso, 'failed', undefined);
    return 'failed';
  } finally {
    await pace(pauseMs);
  }
}

export async function runDaily(
  env: Env, db: Db, send: Sender, todayIso: string, pauseMs = 600
): Promise<void> {
  await db.autoResume(todayIso);
  await db.purgeUnsubscribed(30);
  await db.purgeStalePending(7);
  const dueCalendarPapers = papersDueOnDate(papers, todayIso);
  let sent = 0, failed = 0, retried = 0;

  // Each iteration is isolated: one bad row must not abort delivery for everyone after it.
  for (const sub of await db.listDeliverable()) {
    try {
      if (sub.program === 'weekly') {
        const next = weeklyPaperDue(sub, todayIso);
        if (next === null) continue;
        const outcome = await sendIssue(env, db, send, sub, [next], todayIso, pauseMs);
        if (outcome === 'sent') { await db.setProgress(sub.id, next); sent++; }
        else if (outcome === 'failed') failed++;
      } else if (dueCalendarPapers.length > 0) {
        const outcome = await sendIssue(env, db, send, sub, dueCalendarPapers, todayIso, pauseMs);
        if (outcome === 'sent') sent++;
        else if (outcome === 'failed') failed++;
      }
    } catch (error) {
      failed++;
      console.error('deliver failed', { subscriberId: sub.id, error: String(error) });
    }
  }

  // Retry recent failures and stale queued claims (claim rows already exist; re-render and re-send).
  for (const retry of await db.listRetryable()) {
    let attemptedSend = false;
    try {
      const sub = await db.getSubscriberById(retry.subscriber_id);
      if (!sub || sub.status !== 'active') continue;
      const paper = byNumber.get(retry.paper_number);
      if (!paper) continue;
      const ctx = await contextFor(env, sub);
      if (sub.program === 'weekly') ctx.progressLine = `Paper ${retry.paper_number} of 85 · The Weekly Course`;
      const mail = renderPaperIssue([paper], ctx);
      attemptedSend = true;
      retried++;
      const messageId = await send(env.RESEND_API_KEY, {
        from: env.FROM_ADDRESS, to: sub.email, subject: mail.subject,
        html: mail.html, text: mail.text, unsubscribeUrl: ctx.unsubscribeUrl
      });
      await db.markDelivery(sub.id, retry.paper_number, retry.scheduled_for, 'sent', messageId);
      // A recovered failure advances weekly progress so next week sends the following paper.
      if (sub.program === 'weekly' && retry.paper_number > sub.progress_index) {
        await db.setProgress(sub.id, retry.paper_number);
      }
      sent++;
    } catch (error) {
      // Delivery stays failed; listRetryable's 48h window gives up naturally.
      if (attemptedSend) failed++;
      console.error('deliver retry failed',
        { subscriberId: retry.subscriber_id, paper: retry.paper_number, error: String(error) });
    } finally {
      if (attemptedSend) await pace(pauseMs);
    }
  }

  // The dead-man's switch: written only when the run reaches the end, so the
  // nightly backup workflow can tell a completed run from a silent death.
  await db.recordDailyRun(todayIso);
  console.log('runDaily done', { date: todayIso, sent, failed, retried });
}
