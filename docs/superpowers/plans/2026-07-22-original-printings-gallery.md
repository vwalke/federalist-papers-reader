# Original Printings Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/printings/` — The Print Room — a gallery of Seth Kaller's scans of original Federalist printings, with derivatives pipeline, lightbox, credits, and cross-links.

**Architecture:** A sharp-based generator turns local source scans into committed AVIF/JPEG derivatives plus a dimensions manifest; a typed data module (`src/data/printings.ts`) drives one static Astro page, per-paper cross-links in `PaperLayout`, footer nav, and the sitemap. Tests read `dist/` per repo convention.

**Tech Stack:** Astro 7 (static), sharp (already a devDependency), vitest dist-reading tests, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-22-original-printings-gallery-design.md`

---

### Task 1: Image pipeline

**Files:**
- Create: `scripts/generate-printings.mjs`
- Create (generated, committed): `public/images/printings/<slug>/page-N-{thumb,large}.{jpg,avif}`
- Create (generated, committed): `src/data/printings-images.json`
- Modify: `package.json` (add `generate:printings` script)

Steps:
- [ ] Write `scripts/generate-printings.mjs` with a `SETS` config mapping the four source folders/filename patterns to slugs (`federalist-2-pennsylvania-journal` ← `22899.44/22899.44_post_pN.jpg`; `federalist-85-new-york-packet` ← `21076/SJR 021_Ks21076_pN.jpg`; `new-haven-gazette-1787` ← `25030/25030 pN.jpg`; `massachusetts-centinel-1788` ← `30282/30282 p0N.jpg` with `cropRight` fraction to remove color bars). Source root from `PRINTINGS_SOURCE_DIR` (default `~/Downloads/z Federalist Nw`); exit with a clear message if absent. Emit 640px thumbs and 2000px large, JPEG (q80, mozjpeg) + AVIF (q50), skip up-to-date outputs, write manifest JSON `{ slug: [{ page, thumb: {w,h}, large: {w,h} }] }`.
- [ ] Add `"generate:printings": "node scripts/generate-printings.mjs"` to package.json.
- [ ] Run it; eyeball one thumb and one large per set (especially the 30282 crop).
- [ ] Commit script + package.json (`feat:`), derivatives + manifest (same or follow-up commit).

### Task 2: Data module + integrity test

**Files:**
- Create: `src/data/printings.ts`
- Test: `tests/printings-data.test.ts`

Steps:
- [ ] Define `Printing` interface: `slug`, `inventory`, `paperNumber: number | null`, `newspaper`, `imprint` (city/printer/date line), `dateLabel`, `heading`, `caption: string[]`, `excerpt?`, `excerptSource?`, `pages: { alt: string }[]`, `rubenstein: boolean`, `readPath?`. Export `printings` (order: Fed 2, Fed 85, then context items chronologically) and `getPrintingForPaper(number)`.
- [ ] Captions condensed from Kaller catalog copy (see spec + source docs); Rubenstein `true` for both Federalist items.
- [ ] Test: manifest slugs === data slugs; page counts match; every derivative file exists in `public/`; `getPrintingForPaper(2)` and `(85)` found, `(1)` undefined; alt text non-empty and unique per printing.
- [ ] Run `pnpm test printings-data`, commit.

### Task 3: The page

**Files:**
- Create: `src/pages/printings.astro`
- Test: `tests/printings-page.test.ts`

Steps:
- [ ] Page per spec: BaseLayout (`pageClass="printings-page"`, WebPage JSON-LD), compact masthead ("The print room" dateline), guide-lead header, Federalist entries with ids `federalist-2` / `federalist-85`, thumbnail strip (`<a href="…large.jpg">` wrapping `<picture>` AVIF+JPEG, width/height from manifest, first thumb eager, rest lazy), captions, excerpt blockquote, "Read No. N →" links, credit lines, "Setting the stage" section, credits footer.
- [ ] One `<dialog>` lightbox + inline `<script>`: open on thumb click, arrow-key/button paging within a printing, Escape close, focus restore.
- [ ] Scoped styles matching DESIGN.md (ink rules, IM Fell headings via existing custom properties, restrained hover lift, 44px targets, mobile: horizontally scrollable strip).
- [ ] Build (`PUBLIC_SITE_URL=https://federalistreader.org npx astro build`), write dist-reading test (structure, order, credits incl. "Collection of David M. Rubenstein" twice, alt text, no target=_blank, no Fed 13/51 entries), run, commit.

### Task 4: Cross-links

**Files:**
- Modify: `src/layouts/PaperLayout.astro` (print-room note), `src/layouts/BaseLayout.astro` (footer nav), `src/pages/about.astro` (one sentence), `src/pages/sitemap.xml.ts` (path)
- Test: extend `tests/printings-page.test.ts` (or paper-page test) for cross-links; sitemap assertion

Steps:
- [ ] PaperLayout: `getPrintingForPaper(data.number)`; when found render an `aside.essay-printing-link` ("The original printing" kicker + one sentence + link to `/printings/#federalist-N`) beside the theme-guides block.
- [ ] Footer nav: "Print room" between About and Colophon. About page: link sentence in "History in the room". Sitemap: `/printings/` after `/colophon/`.
- [ ] Rebuild, test cross-link assertions (papers/2 and /85 link, papers/1 does not; sitemap contains `/printings/`), commit.

### Task 5: Verification

- [ ] `PUBLIC_SITE_URL=https://federalistreader.org npx astro build` then `pnpm check` (astro check + analytics verify + full vitest).
- [ ] `PLAYWRIGHT_PORT=4399 pnpm test:e2e`; **rebuild with PUBLIC_SITE_URL afterwards** (e2e rebuilds dist without it).
- [ ] Browser-pane proof via `astro-preview-dist` launch config (port 4310): full-page screenshot of `/printings/`, lightbox open state, and the No. 2 paper-page cross-link.
