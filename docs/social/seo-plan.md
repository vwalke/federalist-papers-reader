# On-Page SEO Plan

*Last updated: 2026-07-18.*

Goal: own the steady, evergreen search demand for the Federalist Papers
("Federalist 10 summary," "who wrote Federalist 51," "Federalist Papers full
text," etc.) and funnel readers into the site.

## Starting point (already strong)

Each paper page already ships: a descriptive `<title>`, a meta description
(`indexSummary`), a canonical URL, per-paper OG/Twitter cards, a semantic `<h1>`,
and rich companion content (nutshell, key arguments, why-it-mattered). Static,
fast, cookie-free (Cloudflare analytics). This is a good foundation, not a
rescue.

## Done (implemented, verified in build)

- **`src/pages/sitemap.xml.ts`** — dependency-free sitemap: home, about, all 85
  papers. Absolute URLs from `PUBLIC_SITE_URL`.
- **`public/robots.txt`** — allows crawling, references the sitemap.
- **JSON-LD** on every paper (`Article` + `BreadcrumbList`) via a `jsonLd` prop
  on `BaseLayout`, built in `PaperLayout` from frontmatter (author, date,
  summary, image, series).
- **`og:type`** — `article` on papers (was `website`), still `website` elsewhere.

## Proposed (needs a call — editorial)

### 1. Titles (biggest on-page lever)
Current: `Federalist No. {n}: {title} — Publius`. Two problems:
- Many papers share a generic historical title ("The Same Subject Continued"),
  so titles don't differentiate in results.
- "— Publius" as the brand suffix means nothing to a searcher; "Federalist
  Reader" builds recognition.

Proposed:
- Add a short **`topic`** frontmatter field (3–6 words, e.g. No. 10 → "Faction
  and the Large Republic") and use it in the title when the historical title is
  generic. Also reusable in the on-page heading and the index.
- Change the suffix to **"| Federalist Reader"**.
- Keep "Federalist No. {n}" first (matches how people search) and keep the whole
  thing under ~60 characters where possible.

Example: `Federalist No. 10: Faction and the Large Republic | Federalist Reader`

### 2. Homepage title
Current `<title>` is just "The Federalist Papers" (competes head-on with
Wikipedia, no value or brand). Proposed: something like **"The Federalist Papers
— Read All 85 Essays Free, with Summaries | Federalist Reader."**

### 3. Hub / explainer pages (capture broad queries + internal linking)
New pages that rank for high-level searches and link down into the papers:
- **"Where to start with the Federalist Papers"** (targets beginners).
- **"The most important Federalist Papers"** (10, 51, 70, 78, 84…).
- **Topic clusters:** faction (10, 51), separation of powers (47, 48, 51), the
  presidency (69–77), the judiciary (78–83). Each links the relevant papers.

### 4. Meta descriptions
`indexSummary` works. Optional later pass to make a few more click-compelling
(~150–160 chars, active voice). Low priority.

## Off-page / setup (do now, separate from code)

- **Google Search Console** — verify the domain, submit `/sitemap.xml`. This is
  the source of truth for queries/rankings/indexing; Cloudflare analytics can't
  show search data. Not a client-side tracker, so it doesn't affect the privacy
  stance. Set up now — it needs weeks to accumulate data.
- **Bing Webmaster Tools** — same idea, free, later.

## Not doing

- No GA/Plausible — Cloudflare analytics + Search Console cover our needs; a
  client-side tracker would cut against the deliberate privacy-light choice.
- No paid SEO tools now (see `marketing-plan.md`): free stack first; a one-month
  Ahrefs Lite sprint only if/when SEO becomes the active push.
