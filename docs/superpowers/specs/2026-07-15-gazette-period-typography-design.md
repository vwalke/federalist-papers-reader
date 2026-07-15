# Gazette Period Typography Design

## Purpose

Refine the Federalist paper page so its Gazette mode feels more like a late-eighteenth-century printing while remaining easy to read. The change addresses four tightly related details: the cramped gap below the reading toolbar, the wrapping paper title, the display face used for that title, and restrained period typography such as the `œ` in `Fœderal`.

## Approved Direction

- Restore **IM FELL English** for the Gazette paper title. This was the display face in the site's first visual system and has the narrow, irregular texture needed for this ceremonial line.
- Keep **Libre Caslon Text** for essay body copy, commentary, metadata, and Reader mode. The long-form text remains the most readable part of the page.
- Do not introduce the long `ſ`.
- Use period typography as a restrained layer, not a full diplomatic transcription of every historical spelling variant.

## Layout and Spacing

The rule below the Gazette/Reader toolbar currently sits too close to the first-column heading and the tops of the other columns. Add `0.75rem` of block-start padding to the complete essay flow. Because the padding belongs to the multi-column container rather than only the heading, all Gazette columns begin on the same calmer baseline.

The title must render as one unbroken line in both modes:

> THE FEDERALIST. No. XX.

The heading will retain semantic text rather than an image. Its font size will scale down at narrow widths so Papers I through LXXXV fit without clipping or horizontal scrolling. Gazette mode will use a smaller size ceiling because the heading occupies the first newspaper column; Reader mode will use the wider reading measure.

## Typographic Roles

### Gazette mode

- Paper title: IM FELL English, regular, with common and font-supported historical ligatures enabled.
- Recipient line: IM FELL English italic, giving the title group a coherent printed voice.
- `PUBLIUS`, body copy, toolbar, and companion: Libre Caslon Text.
- Body text enables common ligatures plus any discretionary or historical ligatures the font actually provides. No synthetic letter substitutions will be used for unsupported ligatures.

### Reader mode

- Paper title uses Libre Caslon Display; the recipient and article text use Libre Caslon Text.
- Period spelling variants are normalized for easier reading.
- The same one-line title and responsive fit requirements apply.

## Period Spelling Rendering

The normalized Markdown remains the canonical source. A local build-time HAST transform, registered through Astro 7's native Sätteri Markdown processor, will wrap only exact, case-preserving occurrences of the standalone word `federal` in rendered paper prose. It will not touch `Federalist`, metadata, links, code, or substrings inside larger words.

Each transformed word will carry two values:

- modern: `federal`, `Federal`, or `FEDERAL`
- Gazette: `fœderal`, `Fœderal`, or `FŒDERAL`

The server-rendered default is the Gazette form. The existing reading-mode controller swaps the visible text when Reader mode is applied, including a stored Reader preference on initial load. The span retains an accessible normalized label, so assistive technology is not required to interpret the historical character. If JavaScript is unavailable, the complete essay remains present and readable in its Gazette form.

This transformation deliberately stops at `federal`. Other historical spellings will be added only when supported by a reliable source and explicitly approved; this feature must not guess at archaic forms.

## Fonts and Hosting

Add the self-hosted `@fontsource/im-fell-english` package and import its regular and italic Latin files through the base layout. No third-party font CDN or runtime network request is introduced. Existing fallbacks remain in place.

Use a dedicated `--font-period-display` token rather than changing the global `--font-display` token. This prevents the Gazette adjustment from unintentionally changing the homepage, About page, index, masthead art, or Reader mode.

## Accessibility and Failure Behavior

- The heading remains a real `h1` and keeps its full accessible name.
- Historical spelling is visual atmosphere; assistive text remains normalized.
- No content depends on color, motion, or JavaScript to exist.
- At 200% zoom, the layout must collapse without horizontal overflow.
- Print keeps a single readable column and inherits the spelling visible in the selected reading mode.

## Verification

Automated tests will prove:

1. The period-spelling transform handles lower-, title-, and uppercase `federal` without altering `Federalist` or larger words.
2. Gazette mode shows `Fœderal`; Reader mode shows `Federal`.
3. The complete title stays on one visual line at 320px, 390px, tablet, desktop, and a 200%-zoom-equivalent width.
4. The essay flow has the intended separation from the toolbar rule and no horizontal overflow.
5. The computed Gazette heading uses IM FELL English while Reader mode retains the modern Caslon treatment.
6. The existing build, content validation, unit tests, browser tests, accessibility checks, and print behavior continue to pass.

## Out of Scope

- Long `ſ` rendering.
- A full scholarly or diplomatic transcription of all 85 original newspaper printings.
- Changes to the masthead artwork, article body size, commentary layout, paper wear, or index typography.
- Rasterized heading text or typography that cannot resize and reflow accessibly.
