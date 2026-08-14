# Deploying Federalist Reader

Federalist Reader has two deployable parts:

- a fully static Astro site served by Cloudflare Pages; and
- the `publius-post` Cloudflare Worker, which provides subscriptions, subscriber
  management, scheduled email delivery, and an access-controlled aggregate
  dashboard.

The production site is [federalistreader.org](https://federalistreader.org).

## Static site

Cloudflare Pages builds the `main` branch with:

```text
Framework preset: Astro
Build command: npm run build
Build output directory: dist
Node version: 22.22.2
```

The build accepts these environment variables:

```text
NODE_VERSION=22.22.2
PUBLIC_SITE_URL=https://federalistreader.org
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<optional-public-beacon-token>
PUBLIC_TURNSTILE_SITE_KEY=<optional-public-site-key>
```

The analytics token and Turnstile site key are public browser identifiers, not
account credentials. The site builds without either optional value.

Verify a site change locally:

```bash
pnpm install --frozen-lockfile
PUBLIC_SITE_URL=https://federalistreader.org pnpm check
PLAYWRIGHT_PORT=4399 pnpm test:e2e
```

A push to `main` triggers the Pages deployment. Afterward, verify the home page,
a representative paper such as `/papers/1/`, the About page, and any changed
route.

The apex domain is canonical. `www.federalistreader.org` redirects permanently
to the apex domain while preserving paths and query strings.

## Publius by Post Worker

The Worker lives in `workers/post/`. It uses:

- D1 for subscriber and delivery state;
- Resend for transactional email;
- a daily cron trigger for scheduled delivery;
- Turnstile as an optional subscription challenge; and
- Cloudflare Access as the security boundary for `/post-office*`.

Its public routes are declared in `workers/post/wrangler.toml`. Secrets are
configured with Wrangler and are never committed. The production secret names are:

```text
RESEND_API_KEY
TOKEN_SECRET
POSTAL_ADDRESS
RESEND_WEBHOOK_SECRET
TURNSTILE_SECRET
CLOUDFLARE_ANALYTICS_TOKEN
```

Configure the analytics zone as a plain Worker variable outside this repository,
for example in the Cloudflare dashboard:

```text
CLOUDFLARE_ZONE_ID (plain Worker variable set to the existing federalistreader.org zone ID)
```

The committed Wrangler configuration sets `keep_vars = true`, so deploys preserve
that dashboard-managed `CLOUDFLARE_ZONE_ID` instead of replacing it with the
repository's committed `[vars]` table. Do not commit the zone ID.

`CLOUDFLARE_ANALYTICS_TOKEN` must be a least-privilege Cloudflare API token
with analytics read access limited to the `federalistreader.org` zone. Store it
with `wrangler secret put CLOUDFLARE_ANALYTICS_TOKEN`. Configure that zone's ID
as the plain Worker variable `CLOUDFLARE_ZONE_ID`. If either value is absent or
invalid, only the visit chart is unavailable; the protected dashboard continues
to show D1-backed subscriber and email figures.

Install dependencies and run the root Vitest suite, which includes the Worker
tests, from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm test
```

Before deploying Worker code that expects a new schema, apply its committed D1
migrations:

```bash
cd workers/post
pnpm migrate:remote
pnpm run deploy
```

For purely additive migrations (new tables or columns the old Worker ignores)
that ordering is the whole story. A migration that changes the *meaning* of
existing data needs the stricter procedure below, because the old Worker keeps
running between `migrate:remote` and `deploy` and will read the migrated rows
with its old semantics.

### Semantic migrations (0004 and any like it)

Migration `0004_debate.sql` remaps weekly `progress_index` from "last paper
number sent" to "merged debate items consumed". If the daily cron (11:00 UTC)
fires after the migration but before the new Worker deploys, the old Worker's
`progress_index + 1` arithmetic sends the wrong paper and writes corrupted
progress. Apply such migrations like this:

1. Confirm today's cron already completed: check `ops_meta.last_daily_run`
   equals today's date (`wrangler d1 execute publius-post --remote --command
   "SELECT value FROM ops_meta WHERE key='last_daily_run'"`).
2. Take a D1 backup/export first (the operational backup commands live outside
   this repository), so a botched window can be rolled back.
3. Run `pnpm migrate:remote` and `pnpm run deploy` back-to-back, well clear of
   the 11:00 UTC cron — anywhere in the 12:00–10:00 UTC window. If a wider
   safety margin is wanted, first deploy a configuration with the cron trigger
   removed, migrate, deploy the new Worker, then restore the trigger.
4. Verify after the next cron run: `deliveries` rows with `paper_number > 85`
   appear for the make-up sends, `last_daily_run` advances, and spot-check
   `SELECT progress_index, makeup_pending FROM subscribers WHERE program =
   'weekly'` against the migration's CASE table.

The Worker and its account-level dependencies must exist before a static-site
change begins sending visitors to a new Worker route. Conversely, Cloudflare
Access must protect `/post-office*` before deploying a Worker version that
serves the operator dashboard.

After deployment, use an Access-authorized session to open `/post-office/` and
compare at least three daily visit values with the corresponding Cloudflare
Analytics values. Confirm that the route still sends `Cache-Control: private,
no-store` and an `X-Robots-Tag` value containing `noindex`. In a non-production
environment, repeat the dashboard check with an invalid analytics token: visits
must degrade to the inline unavailable state while the D1-backed subscriber,
subscription-history, and sent-mail figures remain visible.

## Generated email content

The Worker bundles its own copy of the debate — paper and essay metadata and
excerpts plus the merged sequence. After changing paper or essay frontmatter,
regenerate that copy from the repository root:

```bash
pnpm generate:email-content
```

The command also regenerates migration `0004_debate.sql`'s progress-remapping
CASE table from the content; the root test suite cross-checks the committed SQL
against the content and fails on drift. Commit the regenerated output and
redeploy the Worker; a Pages deployment alone does not update the Worker's
bundled content.

## Operations

Account-specific provisioning, credential setup, backup/restore commands,
dashboard administration, and production smoke-test records are maintained
outside the public repository.

## References

- [Cloudflare Pages Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
