# Deploying Federalist Reader with Cloudflare Pages

Federalist Reader is a fully static Astro site: generated HTML, self-hosted
fonts, CSS, and small browser scripts. It needs no server, database, account
system, or runtime API. Cloudflare Pages serves the site from GitHub with HTTPS,
a global CDN, and automatic deployments whenever `main` changes.

The production site is:

```text
https://federalistreader.org
```

## Current setup

The Cloudflare Pages project is named `federalist-papers-reader` and is
connected to the private `vwalke/federalist-papers-reader` GitHub repository.
Its production branch is `main`; a successful push to that branch builds and
deploys the site automatically.

Cloudflare Pages uses these build settings:

```text
Framework preset: Astro
Production branch: main
Build command: npm run build
Build output directory: dist
Node version: 22.22.2
```

Do not set `SKIP_DEPENDENCY_INSTALL`. Cloudflare Pages must install the
project's pinned pnpm dependencies before it runs the build.

## Environment variables

Set these production (and, if desired, preview) environment variables in
**Workers & Pages → federalist-papers-reader → Settings → Environment
variables**:

```text
NODE_VERSION=22.22.2
PUBLIC_SITE_URL=https://federalistreader.org
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<your-Cloudflare-Web-Analytics-site-token>
```

The analytics token is optional. It is a public browser beacon identifier, not
an account credential. If it is absent or invalid, the site continues to build
and read normally; it simply emits no analytics beacon.

## Updating the site

1. Make the change on a branch and verify it locally:

   ```bash
   pnpm install --frozen-lockfile
   pnpm check
   ```

2. Merge the verified change to `main` and push it to GitHub.
3. In Cloudflare Pages, open **Deployments** for `federalist-papers-reader` and
   confirm the new production deployment is marked **Success**.
4. Verify `https://federalistreader.org`, a representative paper such as
   `/papers/1/`, and the About page.

## Domains

`federalistreader.org` is attached to the Pages project as its production
domain. Its proxied DNS record is:

```text
CNAME  @  federalist-papers-reader.pages.dev
```

Keep the root domain as the public address. Configure `www.federalistreader.org`
as a proxied host with a permanent 301 redirect to the root domain, preserving
paths and query strings.

## Apple Home Screen verification

After a production deployment, verify the standalone experience on a real
iPhone or iPad:

1. Open the production site in Safari, use **Share → Add to Home Screen**, and
   confirm the suggested name is **Federalist**.
2. Confirm the installed icon is the framed oxblood **F**, not a generic webpage
   thumbnail.
3. Launch the site from the Home Screen and confirm it opens without Safari's
   address and tab bars.
4. Open a paper in portrait and landscape. Check that the header clears the
   camera/notch area, the footer clears the Home indicator, and no content
   scrolls sideways.
5. At phone widths, confirm Gazette and Reader share the first toolbar row,
   text size occupies the second row, and every control remains easy to tap.
6. Mark a paper as read and confirm the outlined oxblood check becomes a filled
   oxblood button with a light check. Relaunch the Home Screen app and confirm
   the read state remains.

## Publius by Post worker

Federalist Reader also ships a small Cloudflare Worker, `publius-post`, that
runs the "Publius by Post" email subscription. It serves the subscription API
(`/api/*`) and the subscriber `/manage` page, and on a daily cron it walks the
subscriber list and sends that day's paper through Resend. All subscriber and
delivery state lives in a D1 database; nothing is stored on the Pages site
itself.

Unlike the site, the worker is not built or deployed by Cloudflare Pages. It
is deployed by hand with `wrangler`, from `workers/post/`, whenever its code
changes.

### One-time provisioning

Run these once, from `workers/post/`, to stand the worker up in a fresh
Cloudflare account:

```bash
cd workers/post
npx wrangler d1 create publius-post
```

This prints a `database_id`. Paste it into `workers/post/wrangler.toml`,
replacing the `REPLACE-IN-TASK-13` placeholder in the `[[d1_databases]]`
block.

```bash
pnpm migrate:remote
```

Applies the worker's D1 migrations to the new remote database.

```bash
npx wrangler secret put RESEND_API_KEY
```

An API key from [resend.com](https://resend.com), created after the sending
domain (below) is verified.

```bash
npx wrangler secret put TOKEN_SECRET
```

A random signing secret for manage/unsubscribe/confirmation tokens. Generate
one locally and paste it in:

```text
openssl rand -hex 32
```

```bash
npx wrangler secret put POSTAL_ADDRESS
```

The operator's own mailing address, used verbatim in the CAN-SPAM footer of
every email.

```bash
npx wrangler secret put RESEND_WEBHOOK_SECRET
```

The signing secret Resend generates for the webhook (set up below). This one
is required, not optional: the webhook handler verifies every inbound request
against it and rejects everything if it is unset.

```bash
npx wrangler secret put TURNSTILE_SECRET
```

The Turnstile widget's secret key (set up below). Optional — if it is unset,
the worker skips Turnstile verification on subscribe requests rather than
failing closed.

```bash
pnpm deploy
```

Deploys the worker and activates its routes.

### External dashboard setup

**Resend.** Add the domain `federalistreader.org`, then install the SPF and
DKIM records Resend prints for it into Cloudflare DNS. Wait for the domain to
show **Verified** before sending. Also add a DMARC TXT record:

```text
v=DMARC1; p=quarantine; rua=mailto:vann@walkeonline.com
```

In Resend, create a webhook pointed at
`https://federalistreader.org/api/webhooks/resend`, subscribed to the
`email.bounced` and `email.complained` events. Copy its signing secret into
the `RESEND_WEBHOOK_SECRET` worker secret above.

**Turnstile.** Create a widget for `federalistreader.org` in **invisible**
mode (this is a property of the sitekey itself, not a `data-size` attribute on
the embed). Put the site key in the Cloudflare Pages environment variable
`PUBLIC_TURNSTILE_SITE_KEY` (optional — the subscribe form falls back to no
challenge if it is unset) and the secret key in the `TURNSTILE_SECRET` worker
secret above. Invisible-mode tokens rendered implicitly expire after 300
seconds; during the production smoke test below, confirm
`data-refresh-expired='auto'` actually refreshes a stale token rather than
letting the subscribe form fail.

**Routes sanity check.** In the Cloudflare dashboard, confirm
`federalistreader.org/api/*` and `federalistreader.org/manage` route to the
`publius-post` worker, and that every other path still serves the Pages site.
If `www.federalistreader.org` is ever configured to serve the site directly
instead of redirecting to the apex domain, `/api` posts made from `www` will
miss the worker's routes entirely — keep the `www` → apex redirect (see
Domains, above) in place.

### Deploy order

The worker must be deployed and its routes live **before** any site change
that adds the subscribe coupon merges to `main`. If the site goes live first,
the coupon's form posts to `/api/subscribe` on a domain where nothing is
listening, and visitors get a 404.

### Ongoing operations

- **Paper content changes.** If a paper's frontmatter changes, re-run
  `pnpm generate:email-content` from the repo root, commit the regenerated
  output, and redeploy the worker with `pnpm deploy` from `workers/post/`. The
  worker reads its own bundled copy of this content, so a Pages deploy alone
  does not update it.
- **Deploys are manual.** The worker is never deployed by the Pages build.
  Every code or content change requires an explicit `pnpm deploy` from
  `workers/post/`.
- **Watching the cron.** Tail the worker live with `npx wrangler tail` from
  `workers/post/`. A successful daily run logs a `runDaily done` line with the
  date and counts of sent, failed, and retried deliveries.
- **Production smoke test.** After any worker deploy, or as part of initial
  setup: subscribe with a personal email address from the live site, confirm
  the confirmation email arrives, click through to confirm, and confirm the
  welcome email arrives. Check D1 directly if needed:

  ```bash
  npx wrangler d1 execute publius-post --remote --command "SELECT email, status FROM subscribers"
  ```

  To exercise a real send without waiting for the actual day, temporarily set
  that subscriber's `send_dow` to tomorrow's day-of-week, wait for the 11:00
  UTC cron, and verify the paper arrives with working manage and unsubscribe
  links. Set `send_dow` back afterward. Finally, click **Unsubscribe** from
  the email footer and confirm the one-click flow removes the subscriber.

### Costs

Resend's free tier covers 3,000 emails/month and 100/day. Cloudflare Workers
and D1 also have generous free tiers that this worker's traffic sits well
within. The binding constraint in practice is Resend's 100/day cap: because
subscribers largely share the same weekly send day, Saturday sends are the
first to cluster near that limit as the subscriber list grows.

## Sources

- [Cloudflare Pages: Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages: Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages: Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Pages: Redirecting www to the apex domain](https://developers.cloudflare.com/pages/how-to/www-redirect/)
- [Cloudflare: Enable Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/)
