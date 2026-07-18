# Hub Pages — Design

*Date: 2026-07-18. Status: approved for planning.*

## Overview

Add a set of **guide / hub pages** that rank for broad, high-level searches about
the Federalist Papers ("where to start," "most important Federalist Papers,"
"Federalist Papers on separation of powers") and funnel readers down into the 85
essays. Pages match the site's period-newspaper aesthetic and reuse existing
layout vocabulary.

This is the next phase of the SEO work in `docs/social/seo-plan.md` (the on-page
titles, sitemap, and structured data already shipped).

## Goals

- Capture broad, evergreen "guide-level" search demand the per-paper pages don't.
- Give newcomers an inviting on-ramp (a curated reading path).
- Strengthen internal linking (hub → papers, paper → theme, site-wide nav/footer).
- Stay consistent with the existing design and content model; easy to edit later.

## 1. Pages & URLs

All under a `/guides/` parent (trailing slash, matching site config):

| URL | Page | Primary search intent |
|---|---|---|
| `/guides/` | Guides index (lists all six) | "federalist papers guide / explained" |
| `/guides/where-to-start/` | Where to start | "how / where to start with the Federalist Papers" |
| `/guides/most-important/` | Most important papers | "most important / famous Federalist Papers" |
| `/guides/faction/` | Theme: Faction | "Federalist Papers on faction" |
| `/guides/separation-of-powers/` | Theme: Separation of powers | "separation of powers / checks and balances" |
| `/guides/the-presidency/` | Theme: The presidency | "Federalist Papers on the presidency / executive" |
| `/guides/the-judiciary/` | Theme: The judiciary | "Federalist Papers on the judiciary / courts" |

Six content pages + one index = seven routes.

## 2. Data model

A new markdown content collection **`guides`** (parallels the existing `papers`
collection), one file per guide, so content is editable without touching code.

Frontmatter schema (`src/content.config.ts`):

```
guides:
  title: string          # <h1> and default <title>
  metaTitle?: string      # optional SEO <title> override
  description: string     # meta description (~150–160 chars)
  kicker: string          # small label above the title
  standfirst: string      # one-sentence intro under the title
  order: number           # sort order on /guides/ index
  kind: 'guide' | 'theme' # 'theme' pages feed the paper→theme cross-links
  papers:                 # curated list, in display order
    - number: int (1–85)
      why: string         # custom "why read this" blurb
```

Markdown body = the intro prose (and, for "where to start," a short "how to use
this site" passage).

`papers[].number` is validated against the real papers; the page pulls each
paper's `topic`, `author`, and canonical link from the `papers` collection at
render time, so guides never duplicate that data.

## 3. Components & rendering

- **`src/components/CuratedList.astro`** — the editorial-column layout (approved
  option A). Each entry: `No. N — {topic}`, the `why` line, and a
  `Read No. N →` link to `/papers/N/`. Takes the guide's `papers` array, resolves
  each against the `papers` collection. Reused on all six content pages.
- **`src/pages/guides/[slug].astro`** — renders any guide via `getStaticPaths`
  over the collection: compact `GazetteMasthead`, `kicker` + `<h1>` +
  `standfirst`, rendered markdown intro, `CuratedList`, then a cross-link block to
  the other guides. Uses `BaseLayout`, `.paper-sheet`, existing type styles, and a
  small new `src/styles/guide.css`.
- **`src/pages/guides/index.astro`** — the guides landing page: masthead, short
  intro, and a list of the six guides (by `order`) with their standfirsts.

## 4. Discovery & internal linking

- **Top nav** (`BaseLayout`): add `Start here` → `/guides/where-to-start/`.
- **Homepage** (`index.astro`): a short "New here?" section linking the
  where-to-start and most-important guides.
- **Footer** (`BaseLayout`): add `Guides` → `/guides/`.
- **Paper → theme** (`PaperLayout`): a small "Explore the theme" link on each
  paper page to the theme guide(s) that include it. Built by inverting the
  `kind: 'theme'` guides' `papers` lists (a paper may map to more than one theme;
  show each). No per-paper hand-linking.

## 5. SEO plumbing

- **Sitemap** (`sitemap.xml.ts`): add the seven guide URLs.
- **Per guide page:** canonical, meta description, `og:type=article`, per-guide
  OG image (fall back to the default card), and JSON-LD `CollectionPage`
  containing an `ItemList` of its papers (position + name + url).
- **Titles:** `{title} | Federalist Reader` (or `metaTitle` when set).

## 6. Testing

Matching the existing `dist`-reading test style (e.g. `tests/shell.test.ts`):

- All seven guide routes build and emit `<title>`, canonical, and meta
  description.
- `CuratedList` renders the right paper links and resolved topics.
- `sitemap.xml` includes the guide URLs.
- Header nav renders the `Start here` link; footer renders `Guides`.
- Paper pages render the theme cross-link for a paper known to be in a theme
  (e.g. No. 10 → Faction).

Run `pnpm build` + `pnpm test`; `astro check` clean.

## 7. Content plan (written during implementation)

Curated selections + why-read blurbs, grounded in the essays and the
`paper-theme-index`:

- **Where to start:** ~5–6 papers (e.g. 1, 10, 51, 70, 78) as a first reading
  path, plus a short "how to use the site" note.
- **Most important:** ~8 essentials (10, 51, 70, 78, 84, 39, 68, 45 — final set
  chosen at write time).
- **Faction:** 9, 10, 51 (+ 50).
- **Separation of powers:** 47, 48, 51.
- **The presidency:** 67–77 highlights (68, 69, 70, 73, 74).
- **The judiciary:** 78, 79, 80, 81, 83.

## 8. Out of scope

- No changes to the visible historical titles/headings on paper pages.
- No new analytics; Cloudflare + Search Console remain the stack.
- Short-form video, additional social platforms, paid tools — tracked elsewhere
  (`docs/social/marketing-plan.md`).

## File touch list

New: `src/content/guides/*.md` (6), `src/pages/guides/[slug].astro`,
`src/pages/guides/index.astro`, `src/components/CuratedList.astro`,
`src/styles/guide.css`, guide tests.
Modified: `src/content.config.ts` (guides collection), `src/layouts/BaseLayout.astro`
(nav + footer), `src/pages/index.astro` (homepage section),
`src/layouts/PaperLayout.astro` (theme cross-link), `src/pages/sitemap.xml.ts`.
