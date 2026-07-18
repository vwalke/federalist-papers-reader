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
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await runDaily(env, makeDb(env.DB), sendEmail, new Date().toISOString().slice(0, 10));
  }
};
