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

## Sources

- [Cloudflare Pages: Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/)
- [Cloudflare Pages: Build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages: Custom domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)
- [Cloudflare Pages: Redirecting www to the apex domain](https://developers.cloudflare.com/pages/how-to/www-redirect/)
- [Cloudflare: Enable Web Analytics](https://developers.cloudflare.com/web-analytics/get-started/)
