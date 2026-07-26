// workers/post/src/resend.ts
export interface OutboundEmail {
  from: string; to: string; subject: string; html: string; text: string;
  unsubscribeUrl: string;
}

export type Sender = (apiKey: string, mail: OutboundEmail) => Promise<string>;

export type BatchEmailOutcome =
  | { status: 'sent'; id: string }
  | { status: 'failed'; error: string };

export type BatchSender = (
  apiKey: string,
  mails: OutboundEmail[],
  idempotencyKey: string
) => Promise<BatchEmailOutcome[]>;

interface BatchResponse {
  data?: Array<{ id: string }>;
  errors?: Array<{ index: number; message: string }>;
}

function resendPayload(mail: OutboundEmail) {
  return {
    from: mail.from,
    to: [mail.to],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: {
      'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    }
  };
}

export async function sendEmail(apiKey: string, mail: OutboundEmail): Promise<string> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(resendPayload(mail))
  });
  if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`);
  const data = (await response.json()) as { id: string };
  return data.id;
}

export async function sendBatchEmails(
  apiKey: string,
  mails: OutboundEmail[],
  idempotencyKey: string
): Promise<BatchEmailOutcome[]> {
  if (mails.length === 0 || mails.length > 100) {
    throw new Error(`Resend batch size must be between 1 and 100; got ${mails.length}`);
  }
  const response = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      'x-batch-validation': 'permissive'
    },
    body: JSON.stringify(mails.map(resendPayload))
  });
  if (!response.ok) {
    throw new Error(`Resend batch ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as BatchResponse;
  const successes = body.data ?? [];
  const failures = body.errors ?? [];
  const failureByIndex = new Map<number, string>();
  for (const failure of failures) {
    if (!Number.isInteger(failure.index) ||
      failure.index < 0 ||
      failure.index >= mails.length ||
      failureByIndex.has(failure.index) ||
      typeof failure.message !== 'string') {
      throw new Error('Resend batch returned malformed validation errors');
    }
    failureByIndex.set(failure.index, failure.message);
  }
  if (successes.length + failureByIndex.size !== mails.length ||
    successes.some((item) => typeof item.id !== 'string' || item.id.length === 0)) {
    throw new Error('Resend batch outcome count did not match request');
  }

  let successIndex = 0;
  return mails.map((_, index): BatchEmailOutcome => {
    const error = failureByIndex.get(index);
    if (error !== undefined) return { status: 'failed', error };
    return { status: 'sent', id: successes[successIndex++].id };
  });
}
