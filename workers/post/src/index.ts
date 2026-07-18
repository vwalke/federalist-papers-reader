import type { Env } from './types';

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response('Not found', { status: 404 });
  },
  async scheduled(_event: ScheduledEvent, _env: Env): Promise<void> {
    // wired up in Task 9
  }
};
