# Cloudflare Pages Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Federalist Reader from AWS Amplify to Cloudflare Pages, register and attach `FederalistReader.org`, preserve automatic GitHub deployments and aggregate analytics, and retire only the Federalist AWS resources after the Cloudflare site is verified.

**Architecture:** Cloudflare Pages will build the existing private GitHub repository on pushes to `main` using `pnpm build` and publish the static `dist/` directory. Cloudflare Registrar and DNS will own the apex domain, TLS, and `www` routing. The existing Amplify app remains available as a rollback target until the Pages deployment and custom domain pass route, metadata, mobile, and analytics checks.

**Tech Stack:** Astro 7 static output, pnpm 10.33.0, GitHub, Cloudflare Pages, Cloudflare Registrar/DNS/Web Analytics, AWS Amplify CLI for retirement

## Global Constraints

- Use only the personal Cloudflare account and the `vwalke/federalist-papers-reader` repository.
- Any AWS command must use `--profile walkeonline --region us-east-1` and account `243117234794` with alias `vawscloud`.
- Do not alter or delete the separate `walkeforward` Amplify app `dzx0moqwezbof`.
- Do not delete Amplify app `d3ngbcec5mdybl` until Cloudflare Pages and `FederalistReader.org` are live and verified.
- Do not commit Cloudflare credentials, API tokens, payment information, or other secrets.
- Preserve all 88 generated routes, the custom 404 behavior, HTTPS, canonical metadata, GitHub-triggered builds, and aggregate analytics.

---

### Task 1: Create and verify the Cloudflare Pages deployment

**Files:**
- No repository files changed.

**Interfaces:**
- Consumes: GitHub repository `vwalke/federalist-papers-reader`, production branch `main`, package scripts in `package.json`.
- Produces: a Cloudflare Pages project and a working `*.pages.dev` deployment URL.

- [ ] **Step 1: Connect the GitHub repository**

In Cloudflare **Workers & Pages**, create a Pages application by importing `vwalke/federalist-papers-reader`. Scope GitHub access to this repository only.

- [ ] **Step 2: Configure the build**

Use:

```text
Production branch: main
Build command: corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm install --frozen-lockfile && pnpm build
Build output directory: dist
Environment variable: PUBLIC_SITE_URL=https://federalistreader.org
```

- [ ] **Step 3: Deploy and inspect the build**

Wait for a successful production deployment. Record the assigned `*.pages.dev` URL and verify that the build log validates papers 1–85 and publishes `dist/`.

- [ ] **Step 4: Verify the temporary hostname**

Check `/`, `/about/`, `/papers/1/`, `/papers/85/`, `/site.webmanifest`, `/apple-touch-icon.png`, and `/not-a-real-page/`. Expect HTTP 200 for real routes/assets and the site's custom missing-page response for the unknown route.

### Task 2: Register and connect FederalistReader.org

**Files:**
- No repository files changed.

**Interfaces:**
- Consumes: verified Pages project from Task 1 and the user's Cloudflare payment approval.
- Produces: Cloudflare Registrar ownership, Cloudflare DNS, automatic TLS, and live apex/`www` hostnames.

- [ ] **Step 1: Register the domain**

Search for `FederalistReader.org` in Cloudflare Registrar, review the registration and renewal price, registrant details, auto-renewal, and payment method. The user completes or explicitly confirms the final purchase action.

- [ ] **Step 2: Attach the apex domain**

In the Pages project, add `federalistreader.org` as a custom domain. Wait for Cloudflare DNS and TLS status to become active.

- [ ] **Step 3: Attach the www hostname**

Add `www.federalistreader.org` and configure a permanent redirect to `https://federalistreader.org/:splat` using Cloudflare redirect rules.

- [ ] **Step 4: Enable aggregate analytics**

Enable Cloudflare Web Analytics for the Pages project. Do not set `PUBLIC_CLOUDFLARE_WEB_ANALYTICS_TOKEN` if Pages injects the beacon automatically; this prevents duplicate page views.

- [ ] **Step 5: Verify production**

Repeat the route and asset checks over `https://federalistreader.org`, confirm the canonical link uses the apex hostname, confirm `www` redirects, inspect one mobile paper, and confirm a page view appears in Web Analytics after Cloudflare's processing delay.

### Task 3: Replace AWS deployment configuration and documentation

**Files:**
- Delete: `amplify.yml`
- Modify: `docs/deployment.md`
- Test: `tests/shell.test.ts`

**Interfaces:**
- Consumes: verified Cloudflare project settings and production hostname from Tasks 1–2.
- Produces: repository documentation describing Cloudflare as the sole production host and retaining the Apple Home Screen checklist.

- [ ] **Step 1: Write the failing deployment-documentation test**

Add assertions that `docs/deployment.md` names Cloudflare Pages, `federalistreader.org`, `pnpm build`, and `dist`, and no longer describes AWS Amplify as the current or recommended host.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm vitest run tests/shell.test.ts
```

Expected: FAIL because the deployment guide still declares AWS Amplify as the current production host.

- [ ] **Step 3: Replace deployment documentation**

Rewrite `docs/deployment.md` with the Pages project, GitHub connection, build command, output directory, `PUBLIC_SITE_URL`, domain/DNS/TLS setup, analytics behavior, deployment verification, rollback window, and Apple Home Screen checklist. Retain a short historical note identifying retired Amplify app `d3ngbcec5mdybl`; remove Amplify operating instructions.

- [ ] **Step 4: Remove the obsolete Amplify build file**

Delete `amplify.yml`. Cloudflare's dashboard configuration owns the production build, while `package.json` remains the provider-neutral build contract.

- [ ] **Step 5: Verify GREEN and the full project**

Run:

```bash
pnpm check
pnpm test:e2e
```

Expected: zero Astro diagnostics, all unit/static tests pass, and all Playwright tests pass.

- [ ] **Step 6: Commit and push**

```bash
git add docs/deployment.md tests/shell.test.ts
git add -u amplify.yml
git commit -m "docs: move production hosting to Cloudflare"
git push origin main
```

Confirm Cloudflare automatically deploys the pushed commit successfully.

### Task 4: Retire the Federalist AWS integration

**Files:**
- No repository files changed.

**Interfaces:**
- Consumes: fully verified Cloudflare production deployment and pushed migration documentation.
- Produces: deletion of only Amplify app `d3ngbcec5mdybl` and removal of its repository-scoped GitHub access if no longer needed.

- [ ] **Step 1: Reconfirm the AWS safety guard**

Run:

```bash
aws sts get-caller-identity --profile walkeonline --region us-east-1 --output json
aws iam list-account-aliases --profile walkeonline --region us-east-1 --output json
aws amplify get-app --app-id d3ngbcec5mdybl --profile walkeonline --region us-east-1 --output json
```

Proceed only if the account is `243117234794`, alias is `vawscloud`, and the app is `federalist-papers-reader` connected to `vwalke/federalist-papers-reader`.

- [ ] **Step 2: Capture final rollback evidence**

Record the latest successful `main` deployment commit and verify the Cloudflare production site serves the same commit. Do not delete the separate `walkeforward` app.

- [ ] **Step 3: Delete the Federalist Amplify app**

After explicit final confirmation at deletion time, run:

```bash
aws amplify delete-app --app-id d3ngbcec5mdybl --profile walkeonline --region us-east-1
```

- [ ] **Step 4: Verify AWS cleanup**

Run `aws amplify list-apps` again and confirm `d3ngbcec5mdybl` is absent while `walkeforward` app `dzx0moqwezbof` remains.

- [ ] **Step 5: Remove obsolete GitHub authorization**

In GitHub's installed-app settings, remove the AWS Amplify app's access to `vwalke/federalist-papers-reader` only if that installation is no longer used by any wanted AWS deployment. Keep Cloudflare Pages access scoped to this repository.

### Task 5: Final production acceptance

**Files:**
- No repository files changed.

**Interfaces:**
- Consumes: the completed Cloudflare deployment, domain, repository update, and AWS cleanup.
- Produces: a final operational record and confirmed production site.

- [ ] **Step 1: Run public checks**

Verify apex HTTPS, `www` redirect, homepage/About titles, representative paper routes, missing-page behavior, manifest/icon assets, canonical metadata, and no browser console errors.

- [ ] **Step 2: Confirm deployment automation**

Confirm the migration documentation commit is the active Pages production deployment and that future pushes to `main` trigger builds.

- [ ] **Step 3: Report retained and retired resources**

Report the Pages project URL, production domain, analytics status, GitHub integration scope, retired Amplify app ID, preserved `walkeforward` app ID, and any remaining user-owned payment or registrar actions.
