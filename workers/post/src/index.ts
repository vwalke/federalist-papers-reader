// workers/post/src/index.ts
import type { Env } from './types';
import { makeDb } from './db';
import { handleRequest } from './handlers';
import { runDaily } from './deliver';
import { easternToday } from './season';
import { sendBatchEmails, sendEmail } from './resend';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, makeDb(env.DB), sendEmail);
  },
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // Use the cron's scheduled time, not invocation time, so a delayed start
    // still delivers the intended day's papers. The day is the Eastern one
    // (at the 11:00 UTC cron it is also the UTC one).
    await runDaily(env, makeDb(env.DB), sendBatchEmails,
      easternToday(new Date(event.scheduledTime)), sendEmail);
  }
};
