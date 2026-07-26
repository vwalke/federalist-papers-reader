# Batched Scheduled Email Delivery

## Purpose

Change the daily Publius by Post cron from one Resend API request per
recipient to Resend batch requests containing at most 100 separately rendered
emails. This restores the batching promised by the original subscription
design, avoids the Cloudflare Workers free-plan external-subrequest ceiling at
approximately 50 due emails, and removes the per-recipient pacing delay.

Immediate transactional emails remain unchanged. Confirmation, welcome, and
already-subscribed messages continue to use Resend's single-email endpoint
because each originates in a separate reader request and must be sent
immediately.

## Architecture

The Resend adapter will expose a scheduled-delivery batch sender alongside the
existing single-email sender. The batch sender accepts one to 100
`OutboundEmail` values plus an idempotency key, posts them to
`POST /emails/batch`, and returns one ordered outcome per input email.

The daily delivery service will retain responsibility for:

- selecting due subscribers and retryable delivery rows;
- claiming delivery rows before sending;
- rendering each subscriber's personalized issue, including unique manage and
  unsubscribe links;
- grouping ready issues into chunks of at most 100;
- applying each provider outcome to the corresponding subscriber and claimed
  delivery rows.

No queue, new service, schema migration, or new runtime dependency is required.
D1 statements remain per delivery; batching them would reduce round trips but
would not reduce D1 row-based billing and is outside this change.

## Batch Request

Each request will:

- use `POST https://api.resend.com/emails/batch`;
- include the existing authorization and JSON content headers;
- include `x-batch-validation: permissive`;
- include a deterministic `Idempotency-Key`;
- contain no more than 100 email objects;
- preserve the current `List-Unsubscribe` and
  `List-Unsubscribe-Post` headers on every email object.

The idempotency key will be derived with SHA-256 from the ordered delivery
identities in the chunk. A delivery identity consists of subscriber ID,
scheduled date, and claimed paper numbers. The resulting key will use a short
versioned prefix plus the hexadecimal digest and remain below Resend's
256-character limit.

The key reduces duplicate sends when an identical chunk is retried within
Resend's 24-hour idempotency window. It does not change the service's existing
at-least-once guarantee: a crash after Resend accepts a batch but after only
some D1 status updates may cause a later retry chunk to have different
membership.

## Result Mapping and Failure Handling

Resend permissive validation returns provider IDs for accepted items and
indexed errors for rejected items. The adapter will normalize this into an
ordered array with exactly one success or failure outcome for every input
email. A malformed response, including missing or extra outcomes, fails the
whole request rather than risking assignment of a provider ID to the wrong
subscriber.

For each successful outcome, the delivery service will:

1. attempt to record the accepted provider message ID in `email_sends`;
2. mark every claimed paper represented by that email as `sent` with the
   provider message ID;
3. advance weekly progress when the sent paper is ahead of the subscriber's
   current progress.

As today, failure to record email activity must not turn an accepted delivery
into a failed delivery.

For each per-email validation failure, the service will mark every claimed
paper represented by that email as `failed` and leave weekly progress
unchanged. If the entire HTTP request fails, every delivery in that chunk is
handled the same way. Existing retry selection and the 48-hour retry window
remain responsible for later attempts.

Main due deliveries are sent in batches first. The service then loads
retryable rows and sends those in batches, preserving the current ordering and
retry behavior. Calendar issues containing multiple papers remain one
personalized email and one batch item; all paper rows share that item's
provider outcome.

## Runtime Behavior

The 600 millisecond pause after every send attempt will be removed. Batch
requests execute sequentially so the Worker has at most one Resend request in
flight and remains below Resend's request-rate limit. A run with 1,000 due
emails therefore makes 10 Resend API calls instead of 1,000.

The cron itself remains one Cloudflare Worker invocation. Resend webhooks
remain per-email events and are not changed by outbound batching.

## Interfaces

The existing `Sender` and `sendEmail` interfaces remain available to HTTP
handlers without behavioral changes.

The Resend adapter will add:

- an ordered discriminated result type for accepted and rejected batch items;
- a `BatchSender` dependency type;
- a production `sendBatchEmails` implementation.

`runDaily` will receive a `BatchSender` instead of a single-email `Sender`.
Its injected dependency keeps the cron logic testable without live Resend
requests.

## Testing

Adapter tests will prove that:

- two personalized emails become one `/emails/batch` request;
- every item carries its own unsubscribe headers;
- permissive validation and the idempotency key are sent;
- successful IDs and indexed validation errors map back to input order;
- HTTP errors and malformed result counts reject the batch.

Delivery tests will prove that:

- up to 100 due emails use one batch call;
- 101 due emails use chunks of 100 and one;
- successful results mark the matching deliveries sent and advance weekly
  progress;
- a partial validation failure marks only the matching delivery failed;
- a whole-batch failure marks every delivery in the chunk failed;
- retryable deliveries use the batch sender;
- email-activity recording failure does not undo an accepted delivery;
- rerunning the same date does not reclaim an already claimed delivery.

Existing handler tests will continue to prove that immediate transactional
emails use the single-email sender.

## Success Criteria

- The Worker makes at most `ceil(due emails / 100)` Resend requests for main
  scheduled deliveries, plus the same calculation for retry deliveries.
- Personalization, unsubscribe behavior, delivery claiming, weekly progress,
  retry behavior, and activity tracking retain their existing semantics.
- The Worker test suite and TypeScript no-emit check pass.
- No production deployment is performed as part of the implementation unless
  explicitly requested.
