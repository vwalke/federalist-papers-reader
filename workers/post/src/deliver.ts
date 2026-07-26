// workers/post/src/deliver.ts
import papersJson from '../content/papers.json';
import type { Db } from './db';
import type { Env, PaperContent, Subscriber } from './types';
import { papersDueOnDate, weeklyPaperDue } from './schedule';
import { renderPaperIssue, type EmailContext } from './email';
import { signToken } from './tokens';
import type {
  BatchEmailOutcome,
  BatchSender,
  OutboundEmail
} from './resend';

const papers = papersJson as PaperContent[];
const byNumber = new Map(papers.map((p) => [p.number, p]));
const BATCH_SIZE = 100;

interface PreparedDelivery {
  sub: Subscriber;
  paperNumbers: number[];
  scheduledFor: string;
  mail: OutboundEmail;
}

async function contextFor(env: Env, sub: Subscriber): Promise<EmailContext> {
  const manage = await signToken(sub.id, 'manage', env.TOKEN_SECRET, sub.token_secret);
  const unsub = await signToken(sub.id, 'unsub', env.TOKEN_SECRET, sub.token_secret);
  return {
    siteUrl: env.SITE_URL, postalAddress: env.POSTAL_ADDRESS,
    manageUrl: `${env.SITE_URL}/manage?token=${manage}`,
    unsubscribeUrl: `${env.SITE_URL}/api/unsubscribe?token=${unsub}`
  };
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function batchIdempotencyKey(deliveries: PreparedDelivery[]): Promise<string> {
  const identity = deliveries.map((delivery) =>
    `${delivery.sub.id}:${delivery.scheduledFor}:${delivery.paperNumbers.join(',')}`
  ).join('|');
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identity)
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `scheduled-delivery/v1/${hex}`;
}

async function renderDelivery(
  env: Env,
  sub: Subscriber,
  paperNumbers: number[],
  scheduledFor: string
): Promise<PreparedDelivery> {
  const issue = paperNumbers
    .map((number) => byNumber.get(number))
    .filter((paper): paper is PaperContent => paper !== undefined);
  if (issue.length !== paperNumbers.length) {
    throw new Error('claimed papers have no content');
  }
  const ctx = await contextFor(env, sub);
  if (sub.program === 'weekly') {
    ctx.progressLine = `Paper ${paperNumbers[0]} of 85 · The Weekly Course`;
  }
  const mail = renderPaperIssue(issue, ctx);
  return {
    sub,
    paperNumbers,
    scheduledFor,
    mail: {
      from: env.FROM_ADDRESS,
      to: sub.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      unsubscribeUrl: ctx.unsubscribeUrl
    }
  };
}

async function markFailed(
  db: Db,
  sub: Subscriber,
  paperNumbers: number[],
  scheduledFor: string
): Promise<void> {
  for (const paperNumber of paperNumbers) {
    await db.markDelivery(
      sub.id,
      paperNumber,
      scheduledFor,
      'failed',
      undefined
    );
  }
}

async function applyOutcome(
  db: Db,
  delivery: PreparedDelivery,
  outcome: BatchEmailOutcome
): Promise<'sent' | 'failed'> {
  if (outcome.status === 'failed') {
    await markFailed(
      db,
      delivery.sub,
      delivery.paperNumbers,
      delivery.scheduledFor
    );
    console.error('deliver batch item failed', {
      subscriberId: delivery.sub.id,
      papers: delivery.paperNumbers,
      error: outcome.error
    });
    return 'failed';
  }

  try {
    await db.recordEmailSend(outcome.id, new Date().toISOString(), 1);
  } catch {
    console.error('accepted email activity could not be recorded');
  }
  for (const paperNumber of delivery.paperNumbers) {
    await db.markDelivery(
      delivery.sub.id,
      paperNumber,
      delivery.scheduledFor,
      'sent',
      outcome.id
    );
  }
  const lastPaper = Math.max(...delivery.paperNumbers);
  if (delivery.sub.program === 'weekly' && lastPaper > delivery.sub.progress_index) {
    await db.setProgress(delivery.sub.id, lastPaper);
  }
  return 'sent';
}

async function sendPrepared(
  env: Env,
  db: Db,
  sendBatch: BatchSender,
  deliveries: PreparedDelivery[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const chunk of chunks(deliveries, BATCH_SIZE)) {
    let outcomes: BatchEmailOutcome[];
    try {
      outcomes = await sendBatch(
        env.RESEND_API_KEY,
        chunk.map((delivery) => delivery.mail),
        await batchIdempotencyKey(chunk)
      );
      if (outcomes.length !== chunk.length) {
        throw new Error('batch sender returned the wrong outcome count');
      }
    } catch (error) {
      console.error('deliver batch failed', {
        size: chunk.length,
        error: String(error)
      });
      outcomes = chunk.map(() => ({
        status: 'failed',
        error: String(error)
      }));
    }

    for (let index = 0; index < chunk.length; index++) {
      try {
        const status = await applyOutcome(db, chunk[index], outcomes[index]);
        if (status === 'sent') sent++;
        else failed++;
      } catch (error) {
        failed++;
        console.error('deliver outcome persistence failed', {
          subscriberId: chunk[index].sub.id,
          papers: chunk[index].paperNumbers,
          error: String(error)
        });
      }
    }
  }
  return { sent, failed };
}

async function prepareClaimedDelivery(
  env: Env,
  db: Db,
  sub: Subscriber,
  paperNumbers: number[],
  scheduledFor: string
): Promise<PreparedDelivery | null> {
  const claimedNumbers: number[] = [];
  for (const paperNumber of paperNumbers) {
    if (await db.claimDelivery(sub.id, paperNumber, scheduledFor)) {
      claimedNumbers.push(paperNumber);
    }
  }
  if (claimedNumbers.length === 0) return null;

  try {
    return await renderDelivery(env, sub, claimedNumbers, scheduledFor);
  } catch (error) {
    await markFailed(db, sub, claimedNumbers, scheduledFor);
    console.error('deliver preparation failed', {
      subscriberId: sub.id,
      papers: claimedNumbers,
      error: String(error)
    });
    return null;
  }
}

export async function runDaily(
  env: Env,
  db: Db,
  sendBatch: BatchSender,
  todayIso: string
): Promise<void> {
  await db.autoResume(todayIso);
  await db.purgeUnsubscribed(30);
  await db.purgeStalePending(7);
  await db.purgeEmailSends(45);
  const dueCalendarPapers = papersDueOnDate(papers, todayIso);
  let sent = 0;
  let failed = 0;
  let retried = 0;

  const due: PreparedDelivery[] = [];
  for (const sub of await db.listDeliverable()) {
    try {
      let paperNumbers: number[] = [];
      if (sub.program === 'weekly') {
        const next = weeklyPaperDue(sub, todayIso);
        if (next !== null) paperNumbers = [next];
      } else if (dueCalendarPapers.length > 0) {
        paperNumbers = dueCalendarPapers;
      }
      if (paperNumbers.length === 0) continue;
      const delivery = await prepareClaimedDelivery(
        env,
        db,
        sub,
        paperNumbers,
        todayIso
      );
      if (delivery) due.push(delivery);
    } catch (error) {
      failed++;
      console.error('deliver failed', {
        subscriberId: sub.id,
        error: String(error)
      });
    }
  }

  const dueResult = await sendPrepared(env, db, sendBatch, due);
  sent += dueResult.sent;
  failed += dueResult.failed;

  const retries: PreparedDelivery[] = [];
  for (const retry of await db.listRetryable()) {
    try {
      const sub = await db.getSubscriberById(retry.subscriber_id);
      if (!sub || sub.status !== 'active') continue;
      retries.push(await renderDelivery(
        env,
        sub,
        [retry.paper_number],
        retry.scheduled_for
      ));
    } catch (error) {
      failed++;
      console.error('deliver retry preparation failed', {
        subscriberId: retry.subscriber_id,
        paper: retry.paper_number,
        error: String(error)
      });
    }
  }
  retried = retries.length;

  const retryResult = await sendPrepared(env, db, sendBatch, retries);
  sent += retryResult.sent;
  failed += retryResult.failed;

  // The dead-man's switch: written only when the run reaches the end, so the
  // nightly backup workflow can tell a completed run from a silent death.
  await db.recordDailyRun(todayIso);
  console.log('runDaily done', { date: todayIso, sent, failed, retried });
}
