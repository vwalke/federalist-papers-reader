# D1 subscriber backup design

**Date:** July 19, 2026
**Status:** Approved

## Problem

The `publius-post` D1 database (subscribers, deliveries) is the only state in
the project that cannot be regenerated from git. Nothing backs it up; a bad
migration or account incident would lose the subscriber list permanently.

## Decision

A scheduled GitHub Actions workflow exports the production database with
wrangler's canonical dump and uploads it to an S3 bucket. Retention is a
bucket lifecycle rule, not workflow logic. GitHub Actions was chosen over a
worker-side dump because `wrangler d1 export` is the exact format
`wrangler d1 execute --file` restores from, the whole job is ~40 lines of
YAML with no worker code changes, and GitHub emails on failed scheduled runs
for free. Storing the copy on AWS rather than R2 is deliberate: the backup
survives a Cloudflare account problem.

## Shape

- `.github/workflows/backup-d1.yml`, daily at 12:00 UTC (an hour after the
  11:00 UTC delivery cron, so each dump includes that day's deliveries), plus
  `workflow_dispatch` for manual runs.
- Steps: checkout → `npx wrangler@4 d1 export publius-post --remote` from
  `workers/post/` → sanity gate (dump must contain `CREATE TABLE`, mention
  the subscribers table, and exceed a minimum size) → upload to
  `s3://$BACKUP_BUCKET/d1/publius-post-<UTC timestamp>.sql`.
- Filenames carry date and time, so a manual run never overwrites the
  scheduled one. The workflow only ever writes new objects.
- Retention: S3 lifecycle rule expires objects under `d1/` after 365 days.
  At a few KB per day, storage cost is effectively zero.
- AWS auth: a dedicated IAM user whose only permission is `s3:PutObject` on
  the `d1/` prefix (documented default), or OIDC role assumption via an
  `AWS_ROLE_ARN` secret — the workflow supports both and picks OIDC when the
  role secret is present.
- Cloudflare auth: an API token scoped to Account → D1 → Edit (the export
  endpoint requires write scope), stored with the account id in GitHub
  Actions secrets.

## Operational notes

- GitHub disables scheduled workflows after 60 days without repo activity
  (with an email warning first); noted in the runbook.
- Restore procedure: create a fresh D1 database, apply the dump with
  `wrangler d1 execute --remote --file`, and repoint `database_id` in
  `workers/post/wrangler.toml`. Documented in `docs/deployment.md`.

## Out of scope

Backing up anything reproducible from git (site content, worker code),
notification wiring beyond GitHub's default failure email, and R2 mirroring.
