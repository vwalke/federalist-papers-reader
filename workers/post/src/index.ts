// workers/post/src/index.ts
import type { Env } from './types';
import { makeDb } from './db';
import { handleRequest } from './handlers';
import { runDaily } from './deliver';
import { easternToday, isDailyRunHour } from './season';
import { sendBatchEmails, sendEmail } from './resend';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, makeDb(env.DB), sendEmail);
  },
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // Use the cron's scheduled time, not invocation time, so a delayed start
    // still delivers the intended day's papers. Two crons fire each day
    // (11:00 and 12:00 UTC); only the one at 7am Eastern runs, and the other
    // returns before touching the database. The day is the Eastern one.
    const at = new Date(event.scheduledTime);
    if (!isDailyRunHour(at)) return;
    await runDaily(env, makeDb(env.DB), sendBatchEmails, easternToday(at), sendEmail);
  }
};
