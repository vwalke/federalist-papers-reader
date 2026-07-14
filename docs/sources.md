# Text and Editorial Sources

## Original text

The committed essay text is imported from Project Gutenberg’s HTML edition of *The Federalist Papers* (ebook 1404). The Library of Congress full-text guide states that its web-friendly presentation also uses Project Gutenberg’s e-text. The importer is kept in `scripts/import-federalist.mjs`, and the exact source URL is recorded in every paper.

- [Library of Congress full-text guide](https://guides.loc.gov/federalist-papers/full-text)
- [Project Gutenberg HTML source](https://www.gutenberg.org/files/1404/1404-h/1404-h.htm)
- [Founders Online introductory note](https://founders.archives.gov/documents/Hamilton/01-04-02-0151-0001)

The importer preserves wording and punctuation while normalizing HTML whitespace into Markdown paragraphs. It separates the publication line, author, and recipient from the body so the site can present those elements in a period newspaper hierarchy without altering the essay.

## Publication metadata

Papers 1–77 use the date and venue in the source heading. Papers 78–85 are labeled as first published in McLean’s bound second volume on May 28, 1788, before their later newspaper appearance. The display notes preserve this distinction.

Papers 18–20 are labeled as joint work by James Madison with Alexander Hamilton. Papers 49–58 and 62–63 use Madison as the conventional attribution while explicitly marking the historical dispute.

## Editorial companions

The index summaries, nutshells, key arguments, historical notes, and discussion questions in `src/data/editorial.json` are original editorial material written for this edition. They summarize the authors’ arguments in plain language and do not replace the original text. Historical context is intentionally brief and nonpartisan.

## Representative comparison

During import verification, Papers 1, 10, 51, 78, and 85 were checked for complete openings and endings, correct author lines, recipient lines, and the newspaper-versus-book publication distinction. Automated validation additionally requires exactly 85 unique files, Papers 1 through 85 without gaps, nonempty bodies, all companion fields, quoted ISO dates, and index summaries no longer than 18 words.
