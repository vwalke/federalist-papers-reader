# Original Printings Gallery — Design

**Date:** 2026-07-22
**Status:** Approved in conversation (build authorized; credits at maintainer's judgment; no placeholder entries until real scans arrive)

## Purpose

Seth Kaller, Inc. has provided high-quality scans and catalog descriptions of original
eighteenth-century newspaper printings of the Federalist Papers he has handled. A new
`/printings/` page — *The Print Room* — presents these originals: the essays as they first met
their readers. The page deepens the site's core claim ("Read the debate in the form it first
entered public life") with the physical evidence.

## Source material

Received from Seth Kaller (folder `~/Downloads/z Federalist Nw`), inventory numbers his:

| Item | Newspaper | Federalist content | Scans |
|---|---|---|---|
| 22899.44 | *Pennsylvania Journal*, Philadelphia, Nov 10 1787 | No. 2 (Jay), p. 2 | 4 pp., ~6,800×9,900 px |
| 21076 (desc. doc 24854 "DMR") | *The New-York Packet*, Aug 15 1788 | No. 85 (Hamilton), p. 2 | 4 pp., 2,000×3,000 px |
| 25963 | *The Daily Advertiser*, NY, Feb 11 1788 | No. 51 (Madison), misprinted "No. L" | none usable — **excluded until scans arrive** |
| 26566 | *Massachusetts Centinel*, Boston, Dec 8 1787 | No. 13 (Hamilton) | none — **excluded until scans arrive** |
| 25030 | *New-Haven Gazette and Connecticut Magazine*, Oct 25 1787 | none — Congress transmits the Constitution, two days before Federalist 1 | 8 pp. |
| 30282 | *Massachusetts Centinel*, Jan 9 1788 | none — Massachusetts ratifying-convention debate | 4 pp. (color bars in scan frame) |

The DHRC "Printings and Reprintings" chronology (Appendix IV) supplies caption facts.

## Credits

Seth's authorization: "Yes, feel free to use, with credit to Seth Kaller, Inc. On 27488,
22899.44 and 25963, add: Collection of David M. Rubenstein."

- Page-wide credit: **Images courtesy of Seth Kaller, Inc.** with link to sethkaller.com.
- **Collection of David M. Rubenstein** on the Pennsylvania Journal (22899.44, explicitly listed)
  and on the New-York Packet Federalist 85 (its catalog description is filenamed "DMR",
  Kaller's shorthand for that collection; 27488 in Seth's list matches no file received).
  Judgment call, made explicit so it can be flipped when Seth confirms.
- Context items carry no collection line.

## Page design (`/printings/`)

One `paper-sheet` article, following the colophon/about pattern: compact `GazetteMasthead`
(dateline "The print room"), `guide-lead` header, `section-kicker` labels, `guide-rule`
dividers, scoped styles. No wear treatment — the scans are the atmosphere.

1. **Lead** — kicker "Original printings"; heading "The print room"; standfirst on holding the
   actual newspapers; a short intro crediting Seth (linking the About-page story) and noting
   these are the very sheets, not reproductions.
2. **Federalist printings** — ordered by essay number (2, then 85). Each entry (an `article`
   with a stable id: `federalist-2`, `federalist-85`):
   - masthead-style heading: newspaper name (IM Fell English), city/printer/date line;
   - a horizontal strip of page thumbnails ("sheets"), each a link that opens the lightbox;
   - condensed caption from Kaller's catalog copy: what the essay argues, what is notable
     about this printing (Fed 2 reprinted from the New York Packet original; Fed 85 the
     conclusion of Publius, printed complete on page 2 alongside news of North Carolina's
     rejection);
   - a one-line excerpt pull quote from the essay;
   - a "Read No. N →" link into the site's own text;
   - the collection credit line.
3. **Setting the stage** — the two context issues with one caption paragraph each, bookending
   the series chronologically (before Publius spoke; the debate mid-fight in Massachusetts).
4. **Credits footer** — the Seth Kaller, Inc. credit and a link to the About-page section.

### Lightbox

Progressive enhancement: every thumbnail is a plain `<a>` to the large JPEG, so the gallery
works with JavaScript disabled. With JS, a single reused `<dialog>` opens the large image with
caption, close button, and previous/next paging across that printing's pages (arrow keys,
Escape). No dependency. Focus returns to the triggering thumbnail on close.

## Images

Originals (up to 42 MB/page; Cloudflare Pages caps deploy files at 25 MiB) never enter the
repo. `scripts/generate-printings.mjs` (sharp, matching the `generate:*` convention) reads a
local source directory (`PRINTINGS_SOURCE_DIR`, default `~/Downloads/z Federalist Nw`) and
emits committed derivatives to `public/images/printings/<slug>/`:

- `page-N-thumb.jpg` + `.avif` (640 px wide) for the strip;
- `page-N-large.jpg` + `.avif` (2,000 px wide) for the lightbox / no-JS view.

The script writes `src/data/printings-images.json` — per-page pixel dimensions for
`width`/`height` attributes. The Massachusetts Centinel (30282) scans get a configured
right-edge crop to remove the color calibration bars. Slugs:
`federalist-2-pennsylvania-journal`, `federalist-85-new-york-packet`,
`new-haven-gazette-1787`, `massachusetts-centinel-1788`.

## Data

`src/data/printings.ts` is the single source of truth: inventory number, slug, newspaper,
place/printer, date label, essay number (or null for context items), heading, caption
paragraphs, excerpt, per-page alt text, credit flags. Exports `printings` and
`getPrintingForPaper(number)`.

## Cross-links

- **Paper pages:** `PaperLayout` renders, for papers with a printing (2 and 85), a short
  "The original printing" note linking to `/printings/#federalist-N`, placed with the
  theme-guide links after the essay coda.
- **Footer nav:** "Print room" link between About and Colophon (site-wide, `BaseLayout`).
- **About page:** one sentence in the "History in the room" section linking to `/printings/`.
- **Sitemap:** `/printings/` added to the static paths.

## Accessibility

Server-rendered content throughout; the no-JS path is complete. Real alt text per page image
("Front page of the Pennsylvania Journal of November 10, 1787…"). Dialog traps focus, is
labelled by the visible caption, and restores focus on close. Thumbnails have 44 px targets.
`width`/`height` on every image to prevent layout shift; thumbs lazy-load except the first.

## Testing

Dist-reading vitest suites, per repo convention:

- `tests/printings-page.test.ts` — structure, order, credits (both lines), image attributes,
  alt text, no `target="_blank"`, lightbox dialog present, excluded items absent.
- `tests/printings-data.test.ts` — data integrity: slugs match manifest, page counts match,
  derivative files exist on disk, essay-numbered entries reference real papers.
- Cross-link assertions: `papers/2` and `papers/85` link to the print room; `papers/1` does
  not; footer nav and sitemap include `/printings/`.

## Update — Seth's corrections and second batch (2026-07-22)

Seth's corrected table and a second WeTransfer resolved the open questions:

| Item | Fed No. | Credit | Status |
|---|---|---|---|
| 27488 | 1 | Rubenstein | *Pennsylvania Journal*, Nov 7 1787 (issue 2215 — the issue before the Fed 2 issue), Fed 1 on the front page; 4 scans, added |
| 22899.44 | 2 | Rubenstein | unchanged |
| 26169 | 7 & 8 | Rubenstein | *New-York Packet*, Nov 20 1787 — first printing of No. 8; only a detail image survives; added with "Detail" label |
| 26566 | 13 | at the Peoria Riverfront Museum | 2 scans (of 4 pp.) added; credit line "Now at the Peoria Riverfront Museum." |
| 25693 | 51 | Rubenstein | still no scans received (marked WT 2 but absent) — still excluded |
| 24053 | 84 | — | listed as WT 1 but never received — not built |
| 24854 | 85 | Rubenstein | inventory corrected from 21076; Rubenstein confirmed |
| 30282 | — | — | confirmed "No Federalist issue" — stays a context item |

Data model changes: `paperNumber` → `paperNumbers: number[]` (the 7 & 8 pair), boolean
`rubenstein` → free-text `credit`, per-page `label` ("Detail"), helpers `printingAnchor`
(`federalist-7-8`) and `formatPaperNumbers` ("Nos. 7 & 8"). The generator gained a second
source root (`PRINTINGS_SOURCE_DIR_WT2`, default the wetransfer folder).

## Out of scope

- Federalist 13 and 51 entries (await scans — no placeholders).
- Deep-zoom viewer (OpenSeadragon etc.); revisit only if reader feedback asks for it.
- A dedicated social card for the page (uses `default.jpg`; can follow later).
