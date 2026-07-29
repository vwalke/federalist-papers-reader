# Copy Naturalness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Federalist Reader's original editorial copy sound more natural by removing clear repetition and clustered rhetorical habits without flattening its voice.

**Architecture:** This is a copy-only refinement across existing Astro pages and Markdown guides. Each edit preserves the current content hierarchy, factual claims, links, components, period-post vocabulary, and historical essay text; verification uses the existing content validator, Astro checks, tests, production build, and one bounded interface-copy detector pass.

**Tech Stack:** Astro 7, Markdown content collections, TypeScript, pnpm, Vitest, Impeccable detector

## Global Constraints

- Use a conservative, page-level edit rather than a mechanical phrase purge.
- Prefer concrete actions and objects over praise adjectives.
- Say each idea once within an interaction path.
- Preserve content-bearing antithesis and the period-post conceit.
- Do not edit the original text, the 85 companion notes, print-room captions, layout, styling, functionality, factual claims, or link targets.

---

### Task 1: Refine the personal and maker pages

**Files:**
- Modify: `src/pages/about.astro`
- Modify: `src/pages/colophon.astro`

**Interfaces:**
- Consumes: Existing Astro page structure, links, images, and semantic headings.
- Produces: The same rendered About and Colophon pages with revised prose only.

- [ ] **Step 1: Rewrite the duplicated origin and generic LetterJoy praise**

In `src/pages/about.astro`, replace the second origin paragraph with:

```astro
<p>
  Soon we were talking about each new paper as it arrived. At that weekly pace, the
  essays feel like what they first were: public letters meant to be read, considered,
  and talked over. If you would like that same rhythm in your own inbox, you can{' '}
  <a href="/subscribe/">subscribe to have each paper delivered by post</a>.
</p>
```

Replace the main LetterJoy callout paragraph with:

```astro
<p>
  LetterJoy mails historic writing on period-inspired paper, one installment at a time.
  Its Federalist Papers series gave Mom one essay to read each week and gave the two of
  us something to discuss afterward.
</p>
```

- [ ] **Step 2: Let the Thomson facts carry the family passage**

In the last paragraph of the Charles Thomson section, keep the linked list of his work
and replace the two-sentence recap after the Septuagint link with:

```astro
{' '}
Mom and I think of that history as we read these arguments together.
```

- [ ] **Step 3: Make the original-document passage concrete**

In `src/pages/about.astro`:

- Change `an extraordinary exhibition curated by Seth and the museum` to
  `an exhibition curated by Seth and the museum`.
- Replace the photograph paragraph's opening with
  `In this photograph, Seth is showing Mom a historic printing of the Declaration of Independence carrying the printed signature of Charles Thomson—her fifth-great-uncle.`
- Replace the opening sentence of the following paragraph with
  `Seeing an original reveals its scale and physical presence in a way a screen cannot.`
- Change `Seth’s collection is a fascinating place to begin` to
  `Seth’s site is a good place to start looking`.

- [ ] **Step 4: Remove the remaining nearby sincerity and contrast markers**

In `src/pages/about.astro`:

- Replace `The newspaper view is atmosphere, not a claim that every rule and column exactly reproduces one historic printing.` with
  `The newspaper view borrows the atmosphere of early printings without reproducing any one of them exactly.`
- Replace `Historical details appear when they add color or make the stakes clearer—not simply because they are available.` with
  `Historical details add color and make the stakes clearer.`
- Change `I would genuinely like to hear it.` to `I would like to hear it.`
- Keep the heading `A companion, not a lecture`.

- [ ] **Step 5: Thin the Colophon epigrams**

In `src/pages/colophon.astro`:

- Start the Caslon paragraph with `A 1787 New York paper would most likely have been set in Caslon.`
- Delete `The costume stops where reading suffers.`
- End the scaling sentence after `Mastheads, headings, and rules never scale.`
- Replace the wear paragraph with:

```astro
<p>
  There are no stains or burns. The sheets are meant to look carefully preserved.
  Wear never touches the text, and it withdraws entirely in Reader mode, in print,
  and for readers who ask for high contrast or reduced transparency.
</p>
```

- Delete `All of this staging serves the reading, never the other way around.` so the
  final section starts with `The words are the authors’ own`.
- Keep `I chose the feeling over the footnote.`

- [ ] **Step 6: Validate the first copy batch**

Run:

```bash
pnpm validate:content
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the personal and maker page edits**

```bash
git add src/pages/about.astro src/pages/colophon.astro
git commit -m "edit: make personal site copy more natural"
```

---

### Task 2: Simplify subscription and classroom assurances

**Files:**
- Modify: `src/pages/subscribe.astro`
- Modify: `src/pages/teachers.astro`

**Interfaces:**
- Consumes: Existing subscription programs, classroom ledger, links, metadata, and form flow.
- Produces: The same subscription and classroom behavior with less repetitive assurance copy.

- [ ] **Step 1: Remove duplicate subscription reassurance**

In `src/pages/subscribe.astro`:

- Replace the final sentence of the Weekly Course paragraph with:
  `Your first paper, No. 1, arrives the morning after you confirm, so everyone begins in the same place, whenever they join.`
- Replace the privacy paragraph with:

```astro
<p class="subscribe-privacy">
  Unsubscribing takes one click and is honored instantly.
</p>
```

Keep the no-account assurance in the standfirst and the period-post language in the
heading, program descriptions, and coupon.

- [ ] **Step 2: Rewrite the Teachers introduction**

Replace the introductory paragraph in `src/pages/teachers.astro` with:

```astro
<p>
  Every Federalist essay on the AP U.S. Government required list is here in full,
  with no login required. The site works on school networks and library desktops
  as well as students’ phones.
</p>
```

- [ ] **Step 3: Make the classroom management assurance direct**

Replace the `Nothing to manage` feature paragraph with:

```astro
<p class="curated-entry__why">
  Students do not need accounts or passwords. The site requires no district setup.
</p>
```

- [ ] **Step 4: Simplify the discussion-question explanation**

Replace the discussion introduction with:

```astro
<p>
  Every paper’s companion note ends with an open question under the heading “Talk it
  over.” Each asks what the essay still raises today. From the companion to No. 10:
</p>
```

- [ ] **Step 5: Rewrite the Free section as factual sentences**

Replace the first paragraph under `Free means free` with:

```astro
<p>
  The site is free and{' '}
  <a href="https://github.com/vwalke/federalist-papers-reader">open source</a>.
  It has no ads or accounts, and its analytics are cookieless. It began as a family
  reading project, and that story is on <a href="/about/">the About page</a>.
</p>
```

Keep the `Built for reading, not scrolling` and `Free means free` headings.

- [ ] **Step 6: Validate the second copy batch**

Run:

```bash
pnpm validate:content
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the subscription and classroom edits**

```bash
git add src/pages/subscribe.astro src/pages/teachers.astro
git commit -m "edit: simplify reader assurances"
```

---

### Task 3: Remove repeated phrasing from the home page and guides

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/content/guides/where-to-start.md`
- Modify: `src/content/guides/faction.md`
- Modify: `src/content/guides/separation-of-powers.md`

**Interfaces:**
- Consumes: Existing home-page navigation, guide frontmatter, guide collections, and paper links.
- Produces: The same navigation and guide content with varied, plainer prose.

- [ ] **Step 1: Replace the home-page triad**

In `src/pages/index.astro`, replace the `One paper at a time` paragraph with:

```astro
<p>
  The essays work well at the pace of their original publication: one at a time,
  with room to think between them. Your progress stays privately in this
  browser&mdash;there is no account to create.
</p>
```

- [ ] **Step 2: Make the home-page guide description specific**

Replace the `Follow a companion` paragraph with:

```astro
<p>
  Short guides point to the best-known essays on faction, the division of power,
  the presidency, and the courts.
</p>
```

- [ ] **Step 3: Remove the matching wording from Where to Start**

Replace the last paragraph of `src/content/guides/where-to-start.md` with:

```markdown
The simplest way in is to begin at the beginning and let Publius make his case in
order. If you would rather sample first, choose one of the companions below. Each
follows a subject through several essays: faction, the division of power, the
presidency, or the courts.
```

- [ ] **Step 4: Open the Faction guide with the substance**

Replace the final paragraph of `src/content/guides/faction.md` with:

```markdown
Madison treats faction as permanent. Trying to end it, he argues, would be worse
than the disease. His cure is structural: a republic large enough, and a
government divided enough, that no one faction can dominate the rest.
```

- [ ] **Step 5: Remove the filler intensifier from Separation of Powers**

In `src/content/guides/separation-of-powers.md`, change
`the design that actually holds` to `the design that holds`.

- [ ] **Step 6: Validate the final copy batch**

Run:

```bash
pnpm validate:content
git diff --check
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit the home-page and guide edits**

```bash
git add src/pages/index.astro src/content/guides/where-to-start.md src/content/guides/faction.md src/content/guides/separation-of-powers.md
git commit -m "edit: vary home and guide copy"
```

---

### Task 4: Verify the complete editorial change

**Files:**
- Inspect: `src/pages/about.astro`
- Inspect: `src/pages/colophon.astro`
- Inspect: `src/pages/subscribe.astro`
- Inspect: `src/pages/teachers.astro`
- Inspect: `src/pages/index.astro`
- Inspect: `src/content/guides/where-to-start.md`
- Inspect: `src/content/guides/faction.md`
- Inspect: `src/content/guides/separation-of-powers.md`

**Interfaces:**
- Consumes: All revised source files and the project's existing validation toolchain.
- Produces: Evidence that copy-only edits preserve valid content, tests, build output, and scope.

- [ ] **Step 1: Run the complete project checks**

Run:

```bash
pnpm check
```

Expected: Astro reports 0 errors, analytics verification passes, and Vitest reports
all tests passing.

- [ ] **Step 2: Run the production build**

Run:

```bash
pnpm build
```

Expected: content validation and the Astro production build exit 0.

- [ ] **Step 3: Run the bounded interface detector once**

Run:

```bash
node /Users/vwalke/.codex/plugins/cache/impeccable/impeccable/4.0.3/skills/impeccable/scripts/detect.mjs --json src/pages/about.astro src/pages/colophon.astro src/pages/subscribe.astro src/pages/teachers.astro src/pages/index.astro src/content/guides/where-to-start.md src/content/guides/faction.md src/content/guides/separation-of-powers.md
```

Expected: the detector completes. Review any findings only for defects introduced by
this change; do not expand into unrelated visual work.

- [ ] **Step 4: Audit the final diff against the approved scope**

Run:

```bash
git diff HEAD~3 --stat
git diff HEAD~3 --check
git diff HEAD~3 -- src/pages/about.astro src/pages/colophon.astro src/pages/subscribe.astro src/pages/teachers.astro src/pages/index.astro src/content/guides/where-to-start.md src/content/guides/faction.md src/content/guides/separation-of-powers.md
git status --short
```

Confirm:

- only the eight approved source files changed across the three implementation commits;
- no original Federalist text, companion-note frontmatter, print-room caption, link,
  component structure, style, or behavior changed;
- duplicate phrases named in the design are gone;
- retained contrasts are deliberate and isolated;
- the worktree is clean.
