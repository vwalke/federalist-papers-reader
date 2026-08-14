// workers/post/src/deliver.ts
import { byId, items, sequence, sequencePosition } from './content';
import type { Db } from './db';
import type { DebateItem, EssayContent, Env, Subscriber } from './types';
import { itemsDueOnDate, weeklyItemDue } from './schedule';
import { renderIssue, renderMakeupIssue, type EmailContext, type RenderedEmail } from './email';
import { signToken } from './tokens';
import type {
  BatchEmailOutcome,
  BatchSender,
  OutboundEmail
} from './resend';

const BATCH_SIZE = 100;

type DeliveryKind = 'issue' | 'makeup';

interface PreparedDelivery {
  sub: Subscriber;
  itemIds: number[];
  scheduledFor: string;
  kind: DeliveryKind;
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
    `${delivery.sub.id}:${delivery.scheduledFor}:${delivery.itemIds.join(',')}`
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
  itemIds: number[],
  scheduledFor: string,
  kind: DeliveryKind = 'issue'
): Promise<PreparedDelivery> {
  const issue = itemIds
    .map((id) => byId.get(id))
    .filter((item): item is DebateItem => item !== undefined);
  if (issue.length !== itemIds.length) {
    throw new Error('claimed items have no content');
  }
  const ctx = await contextFor(env, sub);
  let mail: RenderedEmail;
  if (kind === 'makeup') {
    const essays = issue.filter((item): item is EssayContent => item.kind === 'essay');
    if (essays.length !== issue.length) {
      throw new Error('make-up issues carry only essays');
    }
    mail = renderMakeupIssue(essays, ctx);
  } else {
    if (sub.program === 'weekly') {
      const position = sequencePosition.get(itemIds[0]);
      if (position !== undefined) {
        ctx.progressLine = `${position + 1} of ${sequence.length} · The Weekly Course`;
      }
    }
    mail = renderIssue(issue, ctx);
  }
  return {
    sub,
    itemIds,
    scheduledFor,
    kind,
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
  itemIds: number[],
  scheduledFor: string
): Promise<void> {
  for (const itemId of itemIds) {
    await db.markDelivery(
      sub.id,
      itemId,
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
      delivery.itemIds,
      delivery.scheduledFor
    );
    console.error('deliver batch item failed', {
      subscriberId: delivery.sub.id,
      items: delivery.itemIds,
      error: outcome.error
    });
    return 'failed';
  }

  try {
    await db.recordEmailSend(outcome.id, new Date().toISOString(), 1);
  } catch {
    console.error('accepted email activity could not be recorded');
  }
  for (const itemId of delivery.itemIds) {
    await db.markDelivery(
      delivery.sub.id,
      itemId,
      delivery.scheduledFor,
      'sent',
      outcome.id
    );
  }
  // A make-up never advances progress: the next regular send resumes the
  // merged sequence from where the subscriber already stood.
  if (delivery.kind === 'issue' && delivery.sub.program === 'weekly') {
    const progressAfter = Math.max(
      ...delivery.itemIds.map((id) => (sequencePosition.get(id) ?? -1) + 1)
    );
    if (progressAfter > delivery.sub.progress_index) {
      await db.setProgress(delivery.sub.id, progressAfter);
    }
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
          items: chunk[index].itemIds,
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
  itemIds: number[],
  scheduledFor: string,
  kind: DeliveryKind = 'issue'
): Promise<PreparedDelivery | null> {
  const claimedIds: number[] = [];
  for (const itemId of itemIds) {
    if (await db.claimDelivery(sub.id, itemId, scheduledFor)) {
      claimedIds.push(itemId);
    }
  }
  if (claimedIds.length === 0) return null;

  try {
    return await renderDelivery(env, sub, claimedIds, scheduledFor, kind);
  } catch (error) {
    await markFailed(db, sub, claimedIds, scheduledFor);
    console.error('deliver preparation failed', {
      subscriberId: sub.id,
      items: claimedIds,
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
  const dueCalendarItems = itemsDueOnDate(items, todayIso);
  let sent = 0;
  let failed = 0;
  let retried = 0;

  let due: PreparedDelivery[] = [];
  for (const sub of await db.listDeliverable()) {
    try {
      let itemIds: number[] = [];
      let kind: DeliveryKind = 'issue';
      if (sub.program === 'weekly') {
        const next = weeklyItemDue(sub, todayIso, sequence);
        if (next?.kind === 'item') itemIds = [next.id];
        else if (next?.kind === 'makeup') {
          itemIds = next.essayIds;
          kind = 'makeup';
        }
      } else if (dueCalendarItems.length > 0) {
        itemIds = dueCalendarItems;
      }
      if (itemIds.length === 0) continue;
      const delivery = await prepareClaimedDelivery(
        env,
        db,
        sub,
        itemIds,
        todayIso,
        kind
      );
      if (kind === 'makeup') {
        // The flag is consumed the moment the make-up is claimed: a failed
        // send rides the ordinary retry machinery (individual essay issues)
        // instead of doubling as a second make-up next week.
        await db.clearMakeupPending(sub.id);
      }
      if (delivery) {
        due.push(delivery);
        if (due.length === BATCH_SIZE) {
          const result = await sendPrepared(env, db, sendBatch, due);
          sent += result.sent;
          failed += result.failed;
          due = [];
        }
      }
    } catch (error) {
      failed++;
      console.error('deliver failed', {
        subscriberId: sub.id,
        error: String(error)
      });
    }
  }

  const remainingDueResult = await sendPrepared(env, db, sendBatch, due);
  sent += remainingDueResult.sent;
  failed += remainingDueResult.failed;

  let retries: PreparedDelivery[] = [];
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
      retried++;
      if (retries.length === BATCH_SIZE) {
        const result = await sendPrepared(env, db, sendBatch, retries);
        sent += result.sent;
        failed += result.failed;
        retries = [];
      }
    } catch (error) {
      failed++;
      console.error('deliver retry preparation failed', {
        subscriberId: retry.subscriber_id,
        item: retry.paper_number,
        error: String(error)
      });
    }
  }

  const remainingRetryResult = await sendPrepared(env, db, sendBatch, retries);
  sent += remainingRetryResult.sent;
  failed += remainingRetryResult.failed;

  // The dead-man's switch: written only when the run reaches the end, so the
  // nightly backup workflow can tell a completed run from a silent death.
  await db.recordDailyRun(todayIso);
  console.log('runDaily done', { date: todayIso, sent, failed, retried });
}
