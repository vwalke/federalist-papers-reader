# Federalist Reader

**[federalistreader.org](https://federalistreader.org)** — all eighty-five
Federalist Papers, set as the newspaper serial they originally were, and made
comfortable to read today.

In 1787 and 1788 the essays of "Publius" reached New Yorkers one at a time, in
the city's newspapers. This edition keeps that spirit: each paper renders as a
period gazette sheet — self-hosted IM Fell and Caslon type, ligatures, the
long-œ `FŒDERALIST` heading, and a unique build-time "wear" fingerprint per
paper — with a clean Reader mode one tap away, short plain-language companion
notes, and reading progress that lives in the browser. No accounts, no
tracking beyond Cloudflare's cookieless analytics.

**Subscribe by post:** [federalistreader.org/subscribe](https://federalistreader.org/subscribe/)
delivers the papers by email — one each Saturday in order, or each on the
anniversary of its original 1787–88 publication date.

It began as a family project: a LetterJoy subscription mailed one paper a week
to my mom, and we wanted a reading companion to match. The longer story is on
the [About page](https://federalistreader.org/about/).

## How it's built

- **Site:** [Astro](https://astro.build) static build, deployed to Cloudflare
  Pages on push to `main`.
- **Email programs:** a Cloudflare Worker (`workers/post/`) with D1 for
  subscribers and Resend for delivery. Secrets stay in Wrangler secrets; see
  `docs/deployment.md`.
- **Text:** imported from Project Gutenberg's edition (the same e-text the
  Library of Congress full-text guide presents), wording and punctuation
  preserved; provenance and editorial conventions are documented in
  [docs/sources.md](docs/sources.md).
- Built with AI assistance, reviewed by a human; the essays themselves are the
  originals, verified against the cited sources.

## Developing

```bash
pnpm install
pnpm dev                                  # dev server on :4321
pnpm build                                # validates content, builds static site
pnpm test                                 # vitest (unit + built-output checks)
PLAYWRIGHT_PORT=4399 pnpm test:e2e        # Playwright against a production build
pnpm check                                # astro check + verifications + tests
```

The worker has its own tests: `cd workers/post && pnpm test`.

## Licensing

Four layers, spelled out in [LICENSE](LICENSE):

| What | License |
|---|---|
| Source code | MIT |
| The essays themselves | Public domain |
| Editorial notes, summaries, and guides (`src/content/`) | CC BY 4.0 |
| Family photographs and the personal About narrative | All rights reserved |

A production of [Walke Forward, LLC](https://walkeforward.com). Questions and
corrections: publius@federalistreader.org.
