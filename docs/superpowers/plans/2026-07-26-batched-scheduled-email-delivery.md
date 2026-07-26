# Batched Scheduled Email Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send scheduled and retry paper emails through Resend in personalized batches of at most 100 while preserving the current delivery, retry, progress, and activity-tracking semantics.

**Architecture:** Add a batch-specific adapter beside the existing single-email Resend adapter. Refactor the daily cron into preparation and batch-processing stages: claim and render personalized deliveries, split them into chunks, call the batch adapter once per chunk, then apply each ordered outcome to its matching D1 rows.

**Tech Stack:** TypeScript, Cloudflare Workers, Web Crypto, D1, Resend REST API, Vitest

## Global Constraints

- Batch only scheduled paper deliveries and retries; confirmation, welcome, and already-subscribed emails remain immediate single sends.
- Each Resend request contains at most 100 separately personalized email objects.
- Use Resend permissive batch validation and preserve each email's one-click unsubscribe headers.
- Use a deterministic SHA-256 batch idempotency key shorter than 256 characters.
- Preserve existing at-least-once delivery semantics and the 48-hour retry window.
- Email-activity persistence failure must not turn an accepted email into a failed delivery.
- Execute Resend batch requests sequentially and remove the 600 millisecond per-email delay.
- Do not add a queue, schema migration, runtime dependency, or production deployment.

---

### Task 1: Resend Batch Adapter

**Files:**
- Modify: `workers/post/test/resend.test.ts`
- Modify: `workers/post/src/resend.ts`

**Interfaces:**
- Consumes: existing `OutboundEmail`
- Produces: `BatchEmailOutcome`, `BatchSender`, and `sendBatchEmails(apiKey, mails, idempotencyKey)`
- `BatchEmailOutcome` is `{ status: 'sent'; id: string } | { status: 'failed'; error: string }`
- `BatchSender` is `(apiKey: string, mails: OutboundEmail[], idempotencyKey: string) => Promise<BatchEmailOutcome[]>`

- [ ] **Step 1: Write failing adapter tests**

Add imports for `sendBatchEmails` and cover the real fetch boundary:

```ts
const MAILS = [
  {
    from: 'Publius <publius@federalistreader.org>',
    to: 'first@example.com',
    subject: 'First',
    html: '<p>first</p>',
    text: 'first',
    unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=first'
  },
  {
    from: 'Publius <publius@federalistreader.org>',
    to: 'second@example.com',
    subject: 'Second',
    html: '<p>second</p>',
    text: 'second',
    unsubscribeUrl: 'https://federalistreader.org/api/unsubscribe?token=second'
  }
];

it('sends personalized emails in one permissive batch request', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({
      data: [{ id: 'msg_1' }, { id: 'msg_2' }],
      errors: []
    }), { status: 200 })
  );

  await expect(sendBatchEmails('key', MAILS, 'scheduled/v1/digest')).resolves.toEqual([
    { status: 'sent', id: 'msg_1' },
    { status: 'sent', id: 'msg_2' }
  ]);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails/batch');
  expect((init as RequestInit).headers).toMatchObject({
    Authorization: 'Bearer key',
    'Content-Type': 'application/json',
    'Idempotency-Key': 'scheduled/v1/digest',
    'x-batch-validation': 'permissive'
  });
  const body = JSON.parse((init as RequestInit).body as string);
  expect(body).toHaveLength(2);
  expect(body[0].to).toEqual(['first@example.com']);
  expect(body[0].headers['List-Unsubscribe']).toContain('token=first');
  expect(body[1].headers['List-Unsubscribe']).toContain('token=second');
  expect(body[0].headers['List-Unsubscribe-Post']).toBe(
    'List-Unsubscribe=One-Click'
  );
});

it('maps permissive validation errors back to their input indexes', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({
      data: [{ id: 'msg_1' }],
      errors: [{ index: 1, message: 'invalid recipient' }]
    }), { status: 200 })
  );

  await expect(sendBatchEmails('key', MAILS, 'scheduled/v1/digest')).resolves.toEqual([
    { status: 'sent', id: 'msg_1' },
    { status: 'failed', error: 'invalid recipient' }
  ]);
});

it('rejects a malformed batch response instead of misassigning provider ids', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify({
      data: [{ id: 'msg_1' }],
      errors: []
    }), { status: 200 })
  );

  await expect(
    sendBatchEmails('key', MAILS, 'scheduled/v1/digest')
  ).rejects.toThrow(/outcome count/i);
});

it('rejects a failed batch request with the provider response', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response('rate limited', { status: 429 })
  );

  await expect(
    sendBatchEmails('key', MAILS, 'scheduled/v1/digest')
  ).rejects.toThrow(/429.*rate limited/i);
});
```

These tests catch endpoint regression, loss of personalized unsubscribe
headers, incorrect partial-result indexing, unsafe ID assignment, and swallowed
provider errors.

- [ ] **Step 2: Run the adapter tests and verify RED**

Run:

```bash
pnpm test -- workers/post/test/resend.test.ts
```

Expected: FAIL because `sendBatchEmails` is not exported.

- [ ] **Step 3: Implement the minimal batch adapter**

In `workers/post/src/resend.ts`, retain `sendEmail` unchanged and add:

```ts
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
```

Refactor the existing `sendEmail` payload construction to use
`resendPayload(mail)` so single and batch sends cannot drift on unsubscribe
headers.

- [ ] **Step 4: Run the adapter tests and verify GREEN**

Run:

```bash
pnpm test -- workers/post/test/resend.test.ts
```

Expected: all tests in `resend.test.ts` PASS.

- [ ] **Step 5: Commit the adapter**

```bash
git add workers/post/src/resend.ts workers/post/test/resend.test.ts
git commit -m "feat: add Resend batch adapter"
```

---

### Task 2: Batch the Daily Delivery Pipeline

**Files:**
- Modify: `workers/post/test/deliver.test.ts`
- Modify: `workers/post/src/deliver.ts`

**Interfaces:**
- Consumes: `BatchSender` and `BatchEmailOutcome` from Task 1
- Produces: `runDaily(env, db, sendBatch, todayIso)` using a `BatchSender`
- Internal `PreparedDelivery` contains `sub`, `paperNumbers`, `scheduledFor`, and `mail`

- [ ] **Step 1: Convert the delivery fake to the batch contract**

Replace the single-message test sender with a batch-aware fake:

```ts
import type { BatchEmailOutcome } from '../src/resend';

let sent: Array<{ to: string; subject: string }>;
let batchSizes: number[];
let nextMessageId: number;
const batchSender = async (
  _key: string,
  mails: Array<{ to: string; subject: string }>,
  _idempotencyKey: string
): Promise<BatchEmailOutcome[]> => {
  batchSizes.push(mails.length);
  sent.push(...mails);
  return mails.map(() => ({ status: 'sent', id: `msg_${nextMessageId++}` }));
};

beforeEach(() => {
  sent = [];
  batchSizes = [];
  nextMessageId = 1;
});
```

Update existing `runDaily` calls to pass `batchSender` and remove the obsolete
pause argument. Replace hard-coded `'msg'` expectations with the corresponding
`'msg_1'` literal.

- [ ] **Step 2: Add failing chunking and partial-outcome tests**

Add these behaviors:

```ts
it('sends 100 due subscribers in one batch', async () => {
  const subscribers = Array.from({ length: 100 }, (_, index) => sub({
    id: index + 1,
    email: `reader${index + 1}@example.com`,
    progress_index: 4
  }));
  await runDaily(ENV, makeStubDb(subscribers), batchSender, '2026-07-18');
  expect(sent).toHaveLength(100);
  expect(batchSizes).toEqual([100]);
});

it('splits 101 due subscribers into batches of 100 and one', async () => {
  const subscribers = Array.from({ length: 101 }, (_, index) => sub({
    id: index + 1,
    email: `reader${index + 1}@example.com`,
    progress_index: 4
  }));
  await runDaily(ENV, makeStubDb(subscribers), batchSender, '2026-07-18');
  expect(sent).toHaveLength(101);
  expect(batchSizes).toEqual([100, 1]);
});

it('uses a stable versioned idempotency key for the same delivery chunk', async () => {
  const keys: string[] = [];
  const collectingSender = async (
    _key: string,
    mails: Array<{ to: string; subject: string }>,
    idempotencyKey: string
  ): Promise<BatchEmailOutcome[]> => {
    keys.push(idempotencyKey);
    return mails.map((_, index) => ({ status: 'sent', id: `msg_${index + 1}` }));
  };
  const subscribers = [sub({ id: 7, progress_index: 4 })];

  await runDaily(ENV, makeStubDb(subscribers), collectingSender, '2026-07-18');
  await runDaily(ENV, makeStubDb(subscribers), collectingSender, '2026-07-18');

  expect(keys).toHaveLength(2);
  expect(keys[0]).toMatch(/^scheduled-delivery\/v1\/[a-f0-9]{64}$/);
  expect(keys[1]).toBe(keys[0]);
});

it('marks only a rejected batch item failed', async () => {
  const subscribers = [
    sub({ id: 1, email: 'first@example.com', progress_index: 4 }),
    sub({ id: 2, email: 'second@example.com', progress_index: 4 })
  ];
  const db = makeStubDb(subscribers);
  const partial = async (): Promise<BatchEmailOutcome[]> => [
    { status: 'sent', id: 'msg_ok' },
    { status: 'failed', error: 'invalid recipient' }
  ];

  await runDaily(ENV, db, partial, '2026-07-18');

  expect(db.markDelivery).toHaveBeenCalledWith(
    1, 5, '2026-07-18', 'sent', 'msg_ok'
  );
  expect(db.markDelivery).toHaveBeenCalledWith(
    2, 5, '2026-07-18', 'failed', undefined
  );
  expect(db.setProgress).toHaveBeenCalledWith(1, 5);
  expect(db.setProgress).not.toHaveBeenCalledWith(2, 5);
});

it('marks every item failed when a batch request rejects', async () => {
  const subscribers = [
    sub({ id: 1, email: 'first@example.com', progress_index: 4 }),
    sub({ id: 2, email: 'second@example.com', progress_index: 4 })
  ];
  const db = makeStubDb(subscribers);
  const rejected = async (): Promise<BatchEmailOutcome[]> => {
    throw new Error('Resend 503');
  };

  await runDaily(ENV, db, rejected, '2026-07-18');

  expect(db.markDelivery).toHaveBeenCalledWith(
    1, 5, '2026-07-18', 'failed', undefined
  );
  expect(db.markDelivery).toHaveBeenCalledWith(
    2, 5, '2026-07-18', 'failed', undefined
  );
  expect(db.setProgress).not.toHaveBeenCalled();
});
```

These tests catch regression to per-email requests, an off-by-one chunk limit,
random or unstable idempotency keys, misassigned partial outcomes, and a
transport failure that leaves claimed rows permanently queued.

- [ ] **Step 3: Run the delivery tests and verify RED**

Run:

```bash
pnpm test -- workers/post/test/deliver.test.ts
```

Expected: FAIL because `runDaily` still calls its dependency once per email
with the single-email contract.

- [ ] **Step 4: Implement delivery preparation, chunking, and outcome application**

In `workers/post/src/deliver.ts`:

```ts
import type {
  BatchEmailOutcome,
  BatchSender,
  OutboundEmail
} from './resend';

const BATCH_SIZE = 100;

interface PreparedDelivery {
  sub: Subscriber;
  paperNumbers: number[];
  scheduledFor: string;
  mail: OutboundEmail;
}

function chunks<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

async function batchIdempotencyKey(
  deliveries: PreparedDelivery[]
): Promise<string> {
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
```

Replace `sendIssue` with a preparation function that performs the existing
claim, content lookup, rendering, and personalized context work but does not
send. It returns a `PreparedDelivery` when at least one paper was claimed and
marks claimed rows failed if their content is missing.

Add one batch processor:

```ts
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
      const delivery = chunk[index];
      const outcome = outcomes[index];
      if (outcome.status === 'failed') {
        failed++;
        for (const paperNumber of delivery.paperNumbers) {
          await db.markDelivery(
            delivery.sub.id,
            paperNumber,
            delivery.scheduledFor,
            'failed',
            undefined
          );
        }
        continue;
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
      if (delivery.sub.program === 'weekly' &&
        lastPaper > delivery.sub.progress_index) {
        await db.setProgress(delivery.sub.id, lastPaper);
      }
      sent++;
    }
  }
  return { sent, failed };
}
```

Refactor `runDaily` to:

1. perform the existing cleanup queries;
2. collect main due `PreparedDelivery` values in subscriber order;
3. call `sendPrepared` once for the main collection;
4. load retryable rows, render each active retry as a `PreparedDelivery`
   without claiming a new row, and collect them in query order;
5. call `sendPrepared` once for the retry collection;
6. record the daily heartbeat and structured completion counts.

Remove `pace`, `pauseMs`, `Sender`, and `sendAndRecord` from this file. Keep
per-subscriber preparation isolated with `try/catch`, and keep per-outcome D1
application isolated so one D1 failure does not prevent later subscriber
outcomes from being applied.

- [ ] **Step 5: Run the delivery tests and verify GREEN**

Run:

```bash
pnpm test -- workers/post/test/deliver.test.ts
```

Expected: all tests in `deliver.test.ts` PASS with no unhandled errors.

- [ ] **Step 6: Commit the delivery pipeline**

```bash
git add workers/post/src/deliver.ts workers/post/test/deliver.test.ts
git commit -m "feat: batch scheduled email delivery"
```

---

### Task 3: Wire Production and Verify the Worker

**Files:**
- Modify: `workers/post/src/index.ts`
- Verify: `workers/post/src/handlers.ts`
- Verify: `workers/post/test/handlers.test.ts`

**Interfaces:**
- Consumes: `sendBatchEmails` from Task 1 and `runDaily(..., BatchSender, ...)` from Task 2
- Produces: production cron wiring that uses Resend batching while HTTP handlers retain `sendEmail`

- [ ] **Step 1: Run the Worker typecheck and verify RED**

Run:

```bash
pnpm exec tsc --project workers/post/tsconfig.json --noEmit
```

Expected: FAIL because `index.ts` still passes `sendEmail` where `runDaily`
requires a `BatchSender`.

- [ ] **Step 2: Wire the batch sender only into the cron**

Update `workers/post/src/index.ts`:

```ts
import { sendBatchEmails, sendEmail } from './resend';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env, makeDb(env.DB), sendEmail);
  },
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    await runDaily(
      env,
      makeDb(env.DB),
      sendBatchEmails,
      new Date(event.scheduledTime).toISOString().slice(0, 10)
    );
  }
};
```

This is the production boundary proving transactional sends remain single and
cron sends become batched.

- [ ] **Step 3: Run focused Worker verification**

Run:

```bash
pnpm test -- workers/post/test/resend.test.ts workers/post/test/deliver.test.ts workers/post/test/handlers.test.ts
pnpm exec tsc --project workers/post/tsconfig.json --noEmit
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 4: Run complete repository verification**

Run:

```bash
pnpm test
git diff --check
git status --short
```

Expected: the full Vitest suite passes, `git diff --check` prints nothing, and
only the intentional implementation-plan or source/test changes are present.

- [ ] **Step 5: Review requirements against the design**

Confirm from the diff and tests:

- scheduled and retry emails use groups no larger than 100;
- unique unsubscribe headers remain on every item;
- permissive partial failures map to the correct subscriber;
- deterministic idempotency keys are present;
- immediate HTTP-triggered emails still use `sendEmail`;
- pacing is removed;
- no queue, schema, dependency, or deployment change was introduced.

- [ ] **Step 6: Commit production wiring**

```bash
git add workers/post/src/index.ts docs/superpowers/plans/2026-07-26-batched-scheduled-email-delivery.md
git commit -m "feat: enable scheduled email batching"
```
