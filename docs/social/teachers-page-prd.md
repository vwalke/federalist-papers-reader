# PRD: "For Teachers" page

*Hand this file's contents to a build agent. Final draft 2026-07-22.*

```
Build a "For teachers" page for federalistreader.org.

CONTEXT
Repo: /Users/vwalke/Work/Federalist Papers — Astro 7 static site, deploys on
push to main. Read PRODUCT.md and DESIGN.md first; reuse the guide-page
compositional vocabulary (src/styles/guide.css, src/pages/guides/[slug].astro:
centered lead + ornament, diamond rules, ledger entries). Use the impeccable
skill. Voice: warm, plainspoken, zero edu-marketing jargon ("engage learners"
is banned). The audience is a busy AP Gov / civics / homeschool teacher
deciding in under a minute whether this link goes in their syllabus.

STRATEGIC PURPOSE (from docs/social/marketing-plan.md)
Teachers build syllabi in August. AP US Government requires specific founding
documents; this page makes federalistreader.org the obvious link for them.
It will be the target of librarian/LibGuides outreach and OER submissions.

PAGE
- Route: /teachers/  (sitemap, canonical, meta description, JSON-LD WebPage)
- Title: "For Teachers — The Federalist Papers, Readable | Federalist Reader"
- Meta description targeting: "federalist papers for students",
  "AP Gov required documents federalist"

CONTENT (verify every claim against the site; keep each section short)
1. Lead: the pitch in two sentences — every AP-required Federalist paper,
   free, readable, no logins, no ads, works on school networks and phones.
2. "The required documents, one click each" — a ledger (CuratedList-style)
   of the College Board's AP Gov required Federalist documents:
   No. 10, No. 51, No. 70, No. 78 — each with its existing topic line and a
   one-line classroom hook. Note Brutus No. 1 is also required and link the
   LOC or Founders Online text for it for now (do NOT claim we host it).
   IMPORTANT: verify the AP required-documents list before asserting it;
   cite it as "the AP U.S. Government required foundational documents."
3. "Built for reading, not scrolling" — three short points: original text
   with plain-English companion notes (nutshell, key moves, a discussion
   question per paper — written to work as bell-ringers); clean Reader mode
   + five-step text sizing; progress stays on the student's device, no
   accounts to manage, nothing to unblock.
4. "Discussion questions included" — explain each paper's "Talk it over"
   question; give one example verbatim from a required paper.
5. "Free means free" — no ads, no tracking beyond cookieless analytics, no
   accounts, no cost, open source. One sentence on why (a family project;
   link the About page). End the section with: "And if the papers hook you
   personally, they're available by email — one a week, or each on its
   original 1787–88 publication date."
6. Close: "If this is useful, share it with a colleague. Corrections and
   suggestions: publius@federalistreader.org."

LINKS INTO THE PAGE
- Footer nav (BaseLayout.astro): add "For teachers" → /teachers/.
  Extend tests/shell.test.ts footer assertions.
- /guides/ index: add a short "Teaching with the papers" entry linking it.

CONSTRAINTS
- No downloads/PDFs, no sign-up walls, no testimonials yet.
- Do NOT pitch the email programs to students anywhere on the page — the
  Weekly Course runs ~20 months and is an adult-reader product; the one
  teacher-directed sentence in section 5 is the only mention.
- Do not modify paper pages or other unrelated files. Check git status
  first; other sessions may have uncommitted work — leave it untouched.
- Commit style per repo convention, incl. the Co-Authored-By trailer.

VERIFICATION (all green before push; note the repo's rebuild trap:
after e2e or check, rebuild with PUBLIC_SITE_URL before trusting pnpm test)
- PUBLIC_SITE_URL=https://federalistreader.org pnpm build && pnpm test
- ASTRO_TELEMETRY_DISABLED=1 npx astro check
- PLAYWRIGHT_PORT=4399 pnpm test:e2e
- Confirm dist: /teachers/ title + canonical; sitemap entry; footer link.
- Visual check desktop + mobile before push (push deploys).
```

## Roadmap note (not part of the build)

If a classroom-shaped email program ever exists ("the four AP papers, one
per week for a month"), it belongs on this page. Until then, email stays a
one-line teacher aside.
