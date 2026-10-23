// workers/post/src/deliver.ts
import { byId, items, sequence, sequencePosition } from './content';
import type { Db } from './db';
import type { DebateItem, EssayContent, Env, Subscriber } from './types';
import { itemsDueOnDate, weeklyItemDue } from './schedule';
import {
  addDays,
  catchUpItemDue,
  catchUpPosition,
  nextOnDate,
  seasonOpens,
  weekdayDateLabel
} from './season';
import {
  itemDisplayName,
  renderCalendarIssue,
  renderConfirmReminder,
  renderIssue,
  renderMakeupIssue,
  type EmailContext,
  type RenderedEmail
} from './email';
import { signToken } from './tokens';
import { AIH_SEASON_ANNOUNCEMENT, type Announcement } from './announcement';
import {
  sendEmail,
  type BatchEmailOutcome,
  type BatchSender,
  type OutboundEmail,
  type Sender
} from './resend';
import { sendAndRecord } from './send-tracking';

const BATCH_SIZE = 100;

/** Days after signup before the one confirmation reminder goes out. */
export const CONFIRM_REMINDER_AFTER_DAYS = 3;
/** Days after signup when an unconfirmed address is purged. */
export const STALE_PENDING_DAYS = 7;

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
  } else if (sub.program === 'calendar' && sub.catchup_items) {
    mail = renderCalendarMorning(sub, issue, scheduledFor, ctx);
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

/**
 * A calendar morning for a reader with a catch-up backlog. Whichever claimed
 * item is a catch-up paper (it is going out after its anniversary) rides below
 * the day's on-date paper in one letter; a morning with no catch-up item, such
 * as a retried on-date paper, is an ordinary issue.
 */
function renderCalendarMorning(
  sub: Subscriber,
  issue: DebateItem[],
  scheduledFor: string,
  ctx: EmailContext
): RenderedEmail {
  for (const item of issue) {
    const place = catchUpPosition(sub, items, item.id, scheduledFor);
    if (!place) continue;
    const last = place.position === place.total;
    const next = last ? nextOnDate(items, addDays(scheduledFor, 1)) : null;
    const nextItem = next ? byId.get(next.id) : undefined;
    return renderCalendarIssue(
      issue.filter((other) => other !== item),
      {
        item,
        ...place,
        next: nextItem && next
          ? { name: itemDisplayName(nextItem), dateLabel: weekdayDateLabel(next.date) }
          : null
      },
      ctx
    );
  }
  return renderIssue(issue, ctx);
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

async function sendAnnouncementBatches(
  env: Env,
  db: Db,
  sendBatch: BatchSender,
  announcement: Announcement,
  subs: Subscriber[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const chunk of chunks(subs, BATCH_SIZE)) {
    const ready: Array<{ sub: Subscriber; mail: OutboundEmail }> = [];
    for (const sub of chunk) {
      try {
        const ctx = await contextFor(env, sub);
        const mail = announcement.render(sub.program, ctx);
        ready.push({
          sub,
          mail: {
            from: env.FROM_ADDRESS, to: sub.email, subject: mail.subject,
            html: mail.html, text: mail.text, unsubscribeUrl: ctx.unsubscribeUrl
          }
        });
      } catch (error) {
        failed++;
        await db.markAnnouncement(sub.id, announcement.id, 'failed');
        console.error('announcement preparation failed', {
          subscriberId: sub.id, announcement: announcement.id, error: String(error)
        });
      }
    }
    if (ready.length === 0) continue;

    let outcomes: BatchEmailOutcome[];
    try {
      // Same recipients, same key: a same-day retry of an ambiguous failure is
      // deduplicated by Resend rather than mailed twice.
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
        ready.map(({ sub }) => sub.id).join(',')
      ));
      const hex = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('');
      outcomes = await sendBatch(
        env.RESEND_API_KEY,
        ready.map(({ mail }) => mail),
        `announcement/v1/${announcement.id}/${hex}`
      );
      if (outcomes.length !== ready.length) {
        throw new Error('batch sender returned the wrong outcome count');
      }
    } catch (error) {
      console.error('announcement batch failed', { size: ready.length, error: String(error) });
      outcomes = ready.map(() => ({ status: 'failed', error: String(error) }));
    }

    for (let index = 0; index < ready.length; index++) {
      const { sub } = ready[index];
      const outcome = outcomes[index];
      try {
        if (outcome.status === 'failed') {
          failed++;
          await db.markAnnouncement(sub.id, announcement.id, 'failed');
          console.error('announcement batch item failed', {
            subscriberId: sub.id, announcement: announcement.id, error: outcome.error
          });
          continue;
        }
        try {
          await db.recordEmailSend(outcome.id, new Date().toISOString(), 1);
        } catch {
          console.error('accepted email activity could not be recorded');
        }
        await db.markAnnouncement(sub.id, announcement.id, 'sent', outcome.id);
        sent++;
      } catch (error) {
        console.error('announcement outcome persistence failed', {
          subscriberId: sub.id, announcement: announcement.id, error: String(error)
        });
      }
    }
  }
  return { sent, failed };
}

/**
 * Sweeps every active subscriber on `announcement.sendOn` (and on no other
 * day), claiming one row per subscriber so reruns never mail anyone twice,
 * then retries failed or stranded claims the way paper deliveries are retried.
 */
export async function runAnnouncement(
  env: Env,
  db: Db,
  sendBatch: BatchSender,
  todayIso: string,
  announcement: Announcement
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  if (todayIso === announcement.sendOn) {
    const claimed: Subscriber[] = [];
    for (const sub of await db.listDeliverable()) {
      if (await db.claimAnnouncement(sub.id, announcement.id)) claimed.push(sub);
    }
    const result = await sendAnnouncementBatches(env, db, sendBatch, announcement, claimed);
    sent += result.sent;
    failed += result.failed;
  }
  // Retries are never found before sendOn: no claim exists until then.
  const retries = await db.listRetryableAnnouncement(announcement.id);
  if (retries.length > 0) {
    const result = await sendAnnouncementBatches(env, db, sendBatch, announcement, retries);
    sent += result.sent;
    failed += result.failed;
  }
  if (sent + failed > 0) {
    console.log('announcement done', { announcement: announcement.id, sent, failed });
  }
  return { sent, failed };
}

/**
 * Sends one reminder to each pending signup between CONFIRM_REMINDER_AFTER_DAYS
 * and the stale-pending purge. Each reminder is claimed before it is sent: a
 * rerun never mails it twice, and a failed send is not retried. The first
 * failure stops the sweep so a provider outage or rate limit leaves the rest
 * unclaimed for tomorrow's run.
 */
export async function runConfirmReminders(
  env: Env,
  db: Db,
  send: Sender
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  for (const sub of await db.listConfirmReminderDue(CONFIRM_REMINDER_AFTER_DAYS, STALE_PENDING_DAYS)) {
    if (!(await db.claimConfirmReminder(sub.id))) continue;
    try {
      const ctx = await contextFor(env, sub);
      const confirm = await signToken(sub.id, 'confirm', env.TOKEN_SECRET, sub.token_secret);
      const mail = renderConfirmReminder(
        `${env.SITE_URL}/api/confirm?token=${confirm}`, ctx, sub.catchup_requested === 1
      );
      await sendAndRecord(env, db, send, {
        from: env.FROM_ADDRESS, to: sub.email, subject: mail.subject,
        html: mail.html, text: mail.text, unsubscribeUrl: ctx.unsubscribeUrl
      });
      sent++;
    } catch (error) {
      failed++;
      console.error('confirm reminder failed', { subscriberId: sub.id, error: String(error) });
      break;
    }
  }
  if (sent + failed > 0) console.log('confirm reminders done', { sent, failed });
  return { sent, failed };
}

export async function runDaily(
  env: Env,
  db: Db,
  sendBatch: BatchSender,
  todayIso: string,
  send: Sender = sendEmail
): Promise<void> {
  await db.autoResume(todayIso);
  await db.purgeUnsubscribed(30);
  // Before the purge, and fenced off so a reminder problem never costs the
  // day's papers or the heartbeat.
  try {
    await runConfirmReminders(env, db, send);
  } catch (error) {
    console.error('confirm reminder run failed', { error: String(error) });
  }
  await db.purgeStalePending(STALE_PENDING_DAYS);
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
      let caughtUp = false;
      if (sub.program === 'weekly') {
        const next = weeklyItemDue(sub, todayIso, sequence);
        if (next?.kind === 'item') itemIds = [next.id];
        else if (next?.kind === 'makeup') {
          itemIds = next.essayIds;
          kind = 'makeup';
        }
      } else {
        itemIds = [...dueCalendarItems];
        // One catch-up paper a morning, in the same letter as any on-date
        // paper. The backlog's progress lives in deliveries, so the claim
        // below is what advances it, exactly once however often the day runs.
        if (sub.catchup_items && !sub.caught_up_on) {
          const delivered = await db.listDeliveredItems(sub.id, seasonOpens(todayIso));
          const catchUp = catchUpItemDue(sub, todayIso, delivered);
          if (catchUp) {
            itemIds.push(catchUp.id);
            caughtUp = catchUp.position === catchUp.total;
          }
        }
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
      if (caughtUp) {
        // Like the make-up flag, consumed at claim: a failed last send is
        // retried as a catch-up letter by the ordinary retry machinery.
        await db.markCaughtUp(sub.id, todayIso);
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

  // After the day's papers, and fenced off so it can never cost the run its
  // heartbeat.
  try {
    const result = await runAnnouncement(env, db, sendBatch, todayIso, AIH_SEASON_ANNOUNCEMENT);
    sent += result.sent;
    failed += result.failed;
  } catch (error) {
    console.error('announcement run failed', { error: String(error) });
  }

  // The dead-man's switch: written only when the run reaches the end, so the
  // nightly backup workflow can tell a completed run from a silent death.
  await db.recordDailyRun(todayIso);
  console.log('runDaily done', { date: todayIso, sent, failed, retried });
}
