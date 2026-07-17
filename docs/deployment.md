# Deploying Publius to the personal AWS account

This is a fully static site: 88 generated HTML pages, self-hosted fonts, CSS, and small browser scripts. It needs no server, database, account system, or runtime API. AWS Amplify Hosting is the recommended host because it supplies HTTPS, a global CDN, a default `amplifyapp.com` address, custom-domain support, and straightforward static deployments.

AWS describes static sites as very low-cost and estimates roughly $1–3 per month outside free-tier limits for the tutorial-sized workload. Actual cost depends on storage, build minutes, and traffic.

## Non-negotiable account guard

Every AWS command in this project uses the explicit personal profile and region:

```bash
--profile walkeonline --region us-east-1
```

Before any command that creates or changes a resource, run:

```bash
aws sts get-caller-identity --profile walkeonline --output json
aws iam list-account-aliases --profile walkeonline --output json
```

The deployment prepared on July 14, 2026 expects account `243117234794`, IAM user `vwalke`, and alias `vawscloud`. Stop immediately if any value differs. Never substitute a default profile and never use a MotionPro, Vinli, or SOFICO credential.

## Recommended first deployment: Amplify manual hosting

Manual hosting avoids granting AWS access to the private GitHub repository. It deploys the generated `dist/` files directly. AWS documents a 5 GB limit for the zipped build artifact; this site is only a few megabytes.

The safe sequence is:

1. Create one Amplify app named `publius-federalist-reader` and one `production` branch in `us-east-1`.
2. Read the app’s `defaultDomain` from AWS.
3. Add `production.<defaultDomain>` in the Cloudflare Web Analytics dashboard and copy its site token.
4. Run `pnpm install --frozen-lockfile` and `pnpm check`.
5. Build the upload artifact with `PUBLIC_SITE_URL=https://production.<defaultDomain> PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<site-token> pnpm build` so canonical metadata and analytics are configured before upload.
6. Zip the *contents* of `dist/`, not the `dist` directory itself.
7. Call `create-deployment`, upload to its short-lived `zipUploadUrl`, then call `start-deployment` with the returned job ID.
8. Wait for the job status to become `SUCCEED`, then verify `/`, `/papers/1/`, `/papers/85/`, and an unknown route.

The relevant AWS CLI operations are:

```bash
aws amplify create-app --name publius-federalist-reader --platform WEB \
  --profile walkeonline --region us-east-1

aws amplify create-branch --app-id <app-id> --branch-name production \
  --stage PRODUCTION --profile walkeonline --region us-east-1

aws amplify create-deployment --app-id <app-id> --branch-name production \
  --profile walkeonline --region us-east-1

aws amplify start-deployment --app-id <app-id> --branch-name production \
  --job-id <job-id> --profile walkeonline --region us-east-1
```

`create-deployment` returns both the job ID and the pre-signed upload URL. The URL expires, and AWS requires `start-deployment` within eight hours of `create-deployment`.

## Optional continuous deployment later

If automatic deploys on every push become useful, connect the private `vwalke/federalist-papers-reader` repository in the Amplify console. The committed `amplify.yml` installs the pinned pnpm version, validates all 85 content files, builds the Astro static output, and publishes `dist/`.

Set these Amplify environment variables for canonical URLs and aggregate traffic analytics:

```text
PUBLIC_SITE_URL=https://<your-production-domain>
PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<your-Cloudflare-site-token>
```

Create the site token by adding the production hostname in the Cloudflare Web Analytics dashboard. The token is embedded in the public beacon markup and is not an account credential. If the analytics token is missing or invalid, the site still builds normally and emits no analytics beacon.

## Updating a manual deployment

For each update:

1. Pull the desired Git commit.
2. Run `pnpm install --frozen-lockfile` and `pnpm check`.
3. Create the upload artifact with `PUBLIC_SITE_URL=<live-url> PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN=<site-token> pnpm build`.
4. Zip the contents of the fresh `dist/` output.
5. Repeat `create-deployment`, upload, and `start-deployment` for the existing app and `production` branch.
6. Verify the live routes and clear the local test progress if needed.

## Apple Home Screen verification

After each production deployment, verify the standalone experience on a real iPhone or iPad:

1. Open the production site in Safari, use **Share → Add to Home Screen**, and confirm the suggested name is **Federalist**.
2. Confirm the installed icon is the framed oxblood **F**, not a generic webpage thumbnail.
3. Launch the site from the Home Screen and confirm it opens without Safari's address and tab bars.
4. Open a paper in portrait and landscape. Check that the header clears the camera/notch area, the footer clears the Home indicator, and no content scrolls sideways.
5. At phone widths, confirm Gazette and Reader share the first toolbar row, text size occupies the second row, and every control remains easy to tap.
6. Mark a paper as read and confirm the outlined oxblood check becomes a filled oxblood button with a light check. Relaunch the Home Screen app and confirm the read state remains.

This is intentionally a polished standalone website, not an offline-first PWA. It does not install a service worker or promise that essays will open without a connection.

## Sources

- [AWS: Deploying without a Git repository](https://docs.aws.amazon.com/amplify/latest/userguide/manual-deploys.html)
- [AWS CLI: `create-deployment`](https://docs.aws.amazon.com/cli/latest/reference/amplify/create-deployment.html)
- [AWS: Host a static website](https://docs.aws.amazon.com/hands-on/latest/host-static-website/host-static-website.html)
- [Cloudflare: Enable Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/)
