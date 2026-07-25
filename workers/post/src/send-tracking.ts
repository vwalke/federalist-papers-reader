import type { Db } from './db';
import type { OutboundEmail, Sender } from './resend';
import type { Env } from './types';

export async function sendAndRecord(
  env: Pick<Env, 'RESEND_API_KEY'>,
  db: Db,
  send: Sender,
  mail: OutboundEmail,
  now: () => Date = () => new Date()
): Promise<string> {
  const providerMessageId = await send(env.RESEND_API_KEY, mail);
  try {
    await db.recordEmailSend(providerMessageId, now().toISOString(), 1);
  } catch {
    console.error('accepted email activity could not be recorded');
  }
  return providerMessageId;
}
