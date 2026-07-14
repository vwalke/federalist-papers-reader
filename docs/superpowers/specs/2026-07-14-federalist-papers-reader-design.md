# Federalist Papers Reader — Design Specification

**Date:** July 14, 2026  
**Status:** Approved for implementation  
**Working title:** *Publius: The Federalist Papers*

## Purpose

Create a warm, engaging website for lay readers to work through all 85 Federalist Papers. The defining experience is a simulated late-eighteenth-century newspaper that captures the drama and material character of the original publication without reproducing the era's barriers to reading. Every essay also has a clean modern-typography mode, a concise reading companion, and an index that makes the collection easy to navigate.

The project is intended for inexpensive static hosting in the owner's AWS account. It requires no accounts, backend, database, or runtime content service.

## Audience and Voice

The primary audience is an interested general reader, not a scholar or researcher. Commentary should sound like a thoughtful, warm reading companion: plainspoken, accurate, and encouraging. Historical context and citations should appear only where they add useful color or clarify the argument.

The site must remain nonpartisan in tone. It explains what each author argues and why the argument mattered without treating the papers as beyond criticism or projecting modern party categories onto the ratification debate.

## Historical and Editorial Principles

1. Preserve the original essay wording. The clean reader modernizes typography, spacing, and layout only; it does not modernize spelling, punctuation, or prose.
2. Use authoritative public-domain text and metadata. The Library of Congress full-text guide is the primary collection reference. Founders Online and Library of Congress historic-newspaper guides provide publication and contextual verification.
3. Treat `first publication` as the index's date field. Papers 78–85, which first appeared in the bound second volume before later newspaper publication, must be labeled accordingly.
4. Represent disputed authorship honestly in metadata and explanatory notes rather than forcing a single attribution.
5. Use a historically grounded visual vocabulary—mastheads, datelines, column rules, restrained ornament, letterpress-like type, and broadsheet proportions—without simulating torn paper, stains, low contrast, long-s typography, or other effects that obstruct reading.
6. Give each paper a stable, unique pattern of subtle edge wear and shallow creases in Gazette mode. The pattern must never intrude on the text, repeat across papers, appear in Reader or print mode, or reduce mobile legibility.

### Primary References

- [Library of Congress: Full Text of The Federalist Papers](https://guides.loc.gov/federalist-papers/full-text)
- [Library of Congress: Federalist Essays in Historic Newspapers](https://guides.loc.gov/federalist-essays-in-historic-newspapers)
- [Library of Congress: The Federalist Papers—Written for Newspapers](https://blogs.loc.gov/headlinesandheroes/2026/03/the-federalist-papers-written-for-newspapers/)
- [Founders Online: Introductory Note to The Federalist](https://founders.archives.gov/documents/Hamilton/01-04-02-0151-0001)

## Information Architecture

### Home and Index

The home page behaves like the front page of a newspaper and introduces the collection, the three authors, and the reading modes. Its primary action opens the first unread paper; if no progress exists, it opens Paper No. 1.

The complete index is visible on the same page as a compact newspaper ledger. Each row includes:

- Paper number
- Original or standard title
- Author attribution
- First-publication date
- One-sentence summary of the central message
- Read/unread state

Readers can search titles and summaries, sort by number, author, or date, and filter by author or read status. The default order is paper number. On narrow screens, ledger rows reflow into stacked entries rather than using horizontal scrolling.

### Essay Pages

Each essay has a stable static route such as `/papers/10/`. The page contains:

1. Site utility navigation and mode switch
2. Newspaper masthead
3. Issue number, first-publication line, and relevant source note
4. `The Fœderalist` heading and paper number
5. Original address to the people of New York when present
6. Author attribution, including `Publius`
7. Complete original essay text
8. Mark-as-read control
9. Reading companion commentary
10. Previous-paper, next-paper, and next-unread navigation

Changing reading modes never changes the URL, content, or reading position.

### Supporting Pages

- **About this edition:** sources, editorial choices, publication history, authorship caveats, and the distinction between atmosphere and literal facsimile.
- **Not found:** a period-appropriate but clear recovery page with routes back to the index and the next unread essay.

## Reading Modes

### Gazette Mode

Gazette mode is the default and the project's defining visual experience.

On wide screens, the essay is set in two or three balanced newspaper columns depending on available width and text length. It uses a strong masthead, double rules, compact dateline, centered article heading, drop cap, justified text where spacing remains acceptable, and restrained print texture created through color and typography rather than image overlays.

On phones, Gazette mode becomes an intentional single-column broadside. It preserves the masthead, dateline, rules, headline hierarchy, drop cap, and period rhythm while using comfortable line length, left-aligned body copy, and no horizontal scrolling. It must never render a scaled-down desktop newspaper.

### Reader Mode

Reader mode presents the same text in a calm single column with modern typographic conventions, generous leading, and a maximum line length of approximately 68 characters. It retains the essay metadata and navigation but reduces ornamental newspaper treatment.

The reader's mode preference is stored locally in the browser.

## Reading Companion

Every paper includes a companion note following the original essay. Its target length is 180–300 words, excluding citations. It contains:

- **In a nutshell:** two or three sentences summarizing the paper
- **Key arguments:** three to five concise points
- **Why it mattered:** a short historical connection when it materially aids understanding
- **Talk it over:** one open-ended question suitable for two people reading together
- **Sources:** only the essential source links supporting contextual claims

The index uses a separate summary capped at roughly 18 words so all 85 messages can be scanned quickly.

## Progress and Personalization

Read status is stored per paper in `localStorage`; no account or cross-device synchronization is provided. The site also stores the preferred reading mode. A reader can mark an essay read or unread from its page, see progress in the index, filter to unread papers, and open the next unread paper.

If browser storage is disabled, full reading and navigation remain available. The interface omits persistent progress claims and gives a quiet, non-blocking explanation if the reader attempts to save status.

## Technical Architecture

Use Astro as a static site generator. All 85 essay pages, the index, about page, and error page are pre-rendered to HTML at build time. JavaScript is limited to index controls, reading-mode preference, read progress, and small progressive enhancements.

Content is stored in a typed local collection with one entry per paper. The content schema requires:

- Unique integer number from 1 through 85
- Title
- Author attribution and attribution certainty
- Publication venue/type
- ISO date or documented date qualifier
- Short index summary
- Reading time derived during the build
- Original essay body
- Complete reading companion fields
- Source references

Shared components own mastheads, publication metadata, reading controls, index rows, commentary, and adjacent-paper navigation. Layout and behavior remain independently testable.

## Hosting and Deployment

The production build is a static `dist/` directory. AWS Amplify Hosting is the recommended deployment target because it provides managed HTTPS, CDN delivery, and Git-based continuous deployment without requiring a server. A manual deployment remains possible.

The repository will include:

- An Amplify build configuration
- A deployment guide covering repository connection, build settings, custom domains, and cache behavior
- A plain static-build fallback suitable for S3 plus CloudFront

No AWS resources will be created or changed during implementation without separate authorization.

### AWS References

- [AWS: Hosting a static website using Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html)
- [AWS: Getting started with Amplify Hosting](https://docs.aws.amazon.com/amplify/latest/userguide/getting-started.html)
- [AWS: Secure static website with S3 and CloudFront](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/getting-started-secure-static-website-cloudformation-template.html)

## Responsive and Accessibility Requirements

- Functional and polished from 320px through large desktop widths
- Single-column Gazette body copy on mobile; newspaper columns only when the viewport can support readable measures
- No horizontal page scrolling at any supported width
- Body copy contrast of at least 4.5:1
- Semantic headings, landmarks, buttons, and tables/lists
- Full keyboard access with clearly visible focus
- Mode and progress controls expose state to assistive technology
- Text remains usable at 200% zoom and with browser font scaling
- All motion honors `prefers-reduced-motion`
- Print CSS produces a clean, single-column essay and companion note without interactive controls

## Error Handling and Resilience

The content schema and build validation must fail the build when:

- The collection does not contain exactly 85 papers
- A paper number is missing, duplicated, or outside 1–85
- Required metadata, essay content, summary, commentary, or source data is absent
- A previous/next link or internal route cannot be resolved

Client-side enhancement failures must not hide essay text or core navigation. If local storage cannot be read or written, the site remains a fully functional static reader. Search and filters default to the complete index if script execution is unavailable.

## Verification Plan

### Automated

- Schema and completeness tests for all 85 papers
- Unit tests for sorting, filtering, progress state, next-unread behavior, and reading-mode persistence
- Static build verification
- Internal-link and route checks
- Accessibility checks for representative home, essay, about, and error pages

### Browser and Visual

- Responsive checks at 320, 375, 768, and 1440 pixels
- Representative short, medium, and long essays in Gazette and Reader modes
- Chrome and Safari behavior
- Keyboard-only navigation and focus order
- 200% zoom, large text, reduced motion, and no-storage fallback
- Visual review against the approved responsive facsimile mockup
- Performance review of the production build, including JavaScript payload and layout stability

## Definition of Done

The site is complete when:

1. All 85 original essays and all required metadata are present and validated.
2. Each essay has a finished warm, accessible companion note and index summary.
3. Gazette and Reader modes work across the supported responsive range.
4. Sorting, filtering, searching, read progress, and next-unread navigation work without accounts.
5. Accessibility, route, content, and production-build checks pass.
6. The repository includes verified instructions for a low-cost AWS Amplify deployment and an S3/CloudFront fallback.

## Explicit Non-Goals

- User accounts or cross-device synchronization
- Comments, social features, or shared annotations
- Runtime AI-generated commentary
- Modernized or abridged essay text
- Pixel-for-pixel reproduction of damaged or difficult-to-read historic scans
- Server-side rendering, database storage, or a content-management system
