# Text and Editorial Sources

## Original text

The committed essay text is imported from Project Gutenberg’s HTML edition of *The Federalist Papers* (ebook 1404). The Library of Congress full-text guide states that its web-friendly presentation also uses Project Gutenberg’s e-text. The importer is kept in `scripts/import-federalist.mjs`, and the exact source URL is recorded in every paper.

- [Library of Congress full-text guide](https://guides.loc.gov/federalist-papers/full-text)
- [Project Gutenberg HTML source](https://www.gutenberg.org/files/1404/1404-h/1404-h.htm)
- [Founders Online introductory note](https://founders.archives.gov/documents/Hamilton/01-04-02-0151-0001)

The importer preserves wording and punctuation while normalizing HTML whitespace into Markdown paragraphs. It separates the publication line, author, and recipient from the body so the site can present those elements in a period newspaper hierarchy without altering the essay.

## Anti-Federalist text

Seven Brutus essays (I, II, IV, VI, X, XII, XV) and Cato IV — the eight New-York Journal essays that answer papers in the collection — are imported from Teaching American History (Ashbrook Center). The importer is `scripts/import-antifederalist.mjs`; it requires `--download` to fetch the public-domain source explicitly, and `--force` to overwrite an already-imported file. Wording and punctuation are preserved, as with the Federalist import.

- [Teaching American History — Brutus documents](https://teachingamericanhistory.org/document/brutus-i/)
- [Documentary History of the Ratification of the Constitution (CSAC, UW–Madison)](https://archive.csac.history.wisc.edu/)
- [Library of Congress — Chronicling America](https://www.loc.gov/collections/chronicling-america/)

Two essays needed more than TAH could supply on its own:

- **Brutus I.** TAH's text carries one marked elision — after "posterity will execrate your memory" — cutting a 139-word passage ("Momentous then is the question … how you deposit the powers of government."). The committed file restores that passage from the CSAC Documentary History of the Ratification PDF. Sources: TAH, CSAC, and LOC.
- **Cato IV.** TAH's version is abridged — it drops the essay's opening paragraph and elides several passages internally — so the committed text is transcribed entirely from the CSAC Documentary History PDF instead. Sources: CSAC and LOC.

TAH publishes no reuse terms for its transcriptions; the underlying 1787–88 text is public domain, and only Ashbrook's presentation of it is not reused here. During import, the openings and closings of Brutus I, Brutus XV, and Cato IV were checked against source; Brutus VI and X received an additional paragraph-level fidelity check against TAH during review.

Authorship of both series is disputed by historians and marked so in each paper's frontmatter. Brutus is conventionally attributed to Robert Yates, though Melancton Smith and John Williams both have serious scholarly support as alternative authors. Cato is conventionally attributed to George Clinton.

## Anti-Federalist page images

Each essay shows the New-York Journal page that carried it, fetched over IIIF from the Library of Congress's Chronicling America collection (public domain) by `scripts/generate-antifederalist-pages.mjs`. The eight essays run across two digitized issue runs, LCCNs [sn83030565](https://www.loc.gov/resource/sn83030565/) and [sn83030566](https://www.loc.gov/resource/sn83030566/). Brutus III and XI are not digitized by Chronicling America — neither essay is in the selection.

The Brutus II issue (November 1, 1787) is digitized only as its outer sheet; the inner leaf carrying the essay was never scanned. That essay's page shows the issue's front page as a stand-in, flagged in the image manifest so the layout can caption it accordingly. Every other essay shows the actual page carrying it.

## Publication metadata

Papers 1–77 use the date and venue in the source heading. Papers 78–85 are labeled as first published in McLean’s bound second volume on May 28, 1788, before their later newspaper appearance. The display notes preserve this distinction.

Papers 18–20 are labeled as joint work by James Madison with Alexander Hamilton. Papers 49–58 and 62–63 use Madison as the conventional attribution while explicitly marking the historical dispute.

## Editorial companions

The index summaries, nutshells, key arguments, historical notes, and discussion questions in `src/data/editorial.json` are original editorial material written for this edition. They summarize the authors’ arguments in plain language and do not replace the original text. Historical context is intentionally brief and nonpartisan.

## Representative comparison

During import verification, Papers 1, 10, 51, 78, and 85 were checked for complete openings and endings, correct author lines, recipient lines, and the newspaper-versus-book publication distinction. Automated validation additionally requires exactly 85 unique files, Papers 1 through 85 without gaps, nonempty bodies, all companion fields, quoted ISO dates, and index summaries no longer than 18 words.
