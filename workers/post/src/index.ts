// workers/post/src/index.ts
import type { Env } from './types';
import { makeDb } from './db';
import { handleRequest } from './handlers';
import { runDaily } from './deliver';
import { sendEmail } from './resend';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, makeDb(env.DB), sendEmail);
  },
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // Use the cron's scheduled time, not invocation time, so a delayed start
    // still delivers the intended day's papers.
    await runDaily(env, makeDb(env.DB), sendEmail,
      new Date(event.scheduledTime).toISOString().slice(0, 10));
  }
};
