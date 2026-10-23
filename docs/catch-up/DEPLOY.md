# Deploy checklist: As It Happened catch-up

The Worker and D1 are deployed by hand; the site builds on Cloudflare Pages on
merge. **Deploy the Worker before the site goes out.** The new signup form posts
`catchup=1`. The old Worker would ignore it and send the old welcome letter, so
the reader would get no catch-up and no explanation.

Migration: **`0007_calendar_catch_up.sql`**. It is additive only (four new
`subscribers` columns), so the ordinary order applies and the cron needs no
pause (see `docs/deployment.md`).

Avoid the minutes around the daily run, 7am Eastern. That is 11:00 UTC under
daylight time and 12:00 UTC under standard time (from November 1, 2026). The
Worker has a cron trigger at each and runs only the one that is 7am in New
York; deploying the Worker (`pnpm run deploy` in `workers/post`) is what puts
both triggers in place.

1. **Verify locally**
   ```sh
   PUBLIC_SITE_URL=https://federalistreader.org corepack pnpm build
   corepack pnpm test
   PUBLIC_SITE_URL=https://federalistreader.org corepack pnpm check
   npx tsc --noEmit -p workers/post
   ```
2. **Back up D1** (as usual before a migration). The nightly backup workflow, or:
   ```sh
   cd workers/post
   npx wrangler d1 export publius-post --remote --output=backup-before-0007.sql
   ```
3. **Apply the migration**
   ```sh
   cd workers/post
   npx wrangler d1 migrations apply publius-post --remote
   ```
   Confirm `0007_calendar_catch_up.sql` is the only pending migration, then check:
   ```sh
   npx wrangler d1 execute publius-post --remote \
     --command "SELECT catchup_requested, catchup_items, catchup_starts_on, caught_up_on FROM subscribers LIMIT 1"
   ```
4. **Deploy the Worker**
   ```sh
   cd workers/post
   pnpm run deploy
   ```
5. **Merge the branch.** Pages rebuilds the site with the catch-up option on
   `/subscribe/`.
6. **Smoke test** (before November 21):
   - Open `/subscribe/` and choose *As It Happened*. "Catch up on the … already
     printed" appears, ticked. Choose the Weekly Course and it disappears.
   - Subscribe a test address with catch-up ticked and confirm it. The welcome
     names how many papers, the first catch-up morning, and the last.
   - Open that address's manage link. It shows *Catching up: 0 of N sent* and
     *End the catch-up*.
   - The next morning, after 7am Eastern, the test address receives
     *Catch-up 1 of N* (combined with the day's paper if one ran), and
     `deliveries` has one row per item for that date.
   - Unsubscribe the test address.
7. **Rollback.** Redeploy the previous Worker. The new columns are harmless to
   it and need not be dropped. Readers mid-catch-up then stop getting catch-up
   papers but keep their on-date ones.

After **November 28, 2026** (the last day a cut-off request can still be
confirmed) no new catch-ups start; the last finishes by December 14. Nothing to
switch off: the window is in the code and reopens each October 18.
