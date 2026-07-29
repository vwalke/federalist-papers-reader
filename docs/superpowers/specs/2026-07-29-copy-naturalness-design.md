# Copy Naturalness Editorial Design

## Goal

Reduce the conspicuous repetition and polished rhetorical cadence that can make
Federalist Reader's original copy sound machine-made, while preserving its warm
personal voice, historical atmosphere, and factual precision.

## Editorial Decision

Use a conservative, page-level edit rather than a mechanical phrase purge.
Repetition is the problem when the same device appears several times in a short
span or when a sentence merely restates the sentence before it. Antithesis is not
itself a problem: much of the subject matter depends on explaining one form of
government in contrast with another.

The revised copy should:

- sound like one person speaking plainly about a project he knows well;
- prefer concrete actions and objects over praise adjectives;
- say each idea once within an interaction path;
- vary sentence endings so every paragraph does not close on an aphorism;
- keep memorable lines when they express a real editorial choice;
- preserve the period-post conceit where it helps the site's personality.

## Review of Claude's Findings

Claude correctly identified four habits worth checking: dense epigrammatic
closers, repeated `not X` contrasts, repeated negative-list ladders, and generic
praise adjectives. The findings are strongest on About and Colophon and useful
on Subscribe, Teachers, the home page, and two guides.

The findings should not be applied mechanically. The reported contrasts in the
paper frontmatter mostly state the substance of Publius's arguments: republic
versus democracy, law versus force, judgment versus purse or sword, and similar
distinctions. Removing those contrasts would make the companion notes less
precise. The five suggested high-traffic papers—Nos. 1, 10, 51, 70, and 78—do
not contain a cluster that warrants rewriting.

Several of Claude's proposed replacements also need refinement:

- Repeating "a standing conversation between us" in shorter form does not solve
  the duplication on About; the body should describe talking about each arriving
  paper instead.
- "Well made" and "a great gift for anyone who likes history" remain generic
  praise; the LetterJoy passage should describe the mailed format and the
  conversation it created.
- "That's quite a thread" is still a summarizing flourish; the Thomson section
  should close with a direct connection to the family reading.
- Breaking a three-part negative list with punctuation does not remove the
  repeated ladder; the Teachers assurances should be recast as plain positive
  statements.

## Scope

### About

- Remove the duplicated "standing conversation" formulation from the origin
  paragraph and replace the monument contrast with a concrete description of
  reading each paper as it arrived.
- Replace the LetterJoy praise adjectives with details about historic writing
  arriving by mail, one installment at a time.
- Let the Charles Thomson facts carry the paragraph and close with a direct,
  unembellished family connection.
- Remove "extraordinary," replace the photograph's self-announcing setup with a
  direct description, shorten the four-item description of original documents,
  and make the Seth Kaller link description concrete.
- Clarify that the newspaper view borrows from early printings without claiming
  to reproduce one exactly.
- Keep "A companion, not a lecture" as one intentional statement of the
  editorial philosophy, but remove the nearby second contrast.
- Change "genuinely like to hear it" to the plainer "like to hear it."

### Colophon

- Keep "I chose the feeling over the footnote," the page's strongest expression
  of a real design decision.
- Remove "An honest admission belongs here" and the duplicate "costume" closer.
- End the text-size explanation after the factual statement that headings and
  rules never scale.
- Describe the paper wear directly, without "damage theater" or the
  preserved-versus-neglected contrast.
- Remove the closing sentence that repeats the standfirst's statement that the
  staging serves the reading.

### Subscribe

- State that everyone begins with No. 1 whenever they join.
- Keep the useful no-account assurance near the decision point.
- Reduce the repeated unsubscribe ladder to one direct sentence.

### Teachers

- Make the opening availability statement and device support sentence plainer.
- Express the lack of account, password, and district setup as two short factual
  statements.
- Describe discussion prompts as open questions the essays still raise today.
- Rewrite the "Free means free" paragraph as direct sentences about cost, source,
  ads, accounts, and cookieless analytics.
- Keep "Built for reading, not scrolling" because it is a single purposeful
  heading rather than part of a cluster.

### Home and Guides

- Replace the coffee-and-conversation triad on the home page with a plain
  description of reading one essay at a time.
- Remove the duplicated "essays everyone cites" and "questions the series keeps
  returning to" phrasing between the home page and the Where to Start guide.
- Open the Faction guide with Madison's substantive response rather than "What
  is striking."
- Remove "actually" from the Separation of Powers guide.

## Explicit Non-Goals

- Do not edit the original text of any Federalist paper.
- Do not sweep the 85 companion notes for every instance of `not`, `rather
  than`, `without`, or another contrast marker.
- Do not edit the print-room captions.
- Do not remove the period-post vocabulary in the subscription flow.
- Do not change layout, styling, functionality, factual claims, or link targets.

## Verification

- Run the content validator and Astro type/content checks.
- Run the complete unit-test suite and production build.
- Run the Impeccable mechanical detector once over the changed web targets.
- Review the final diff for accidental factual changes, duplicated phrases,
  malformed Astro/Markdown, and edits outside the approved scope.
