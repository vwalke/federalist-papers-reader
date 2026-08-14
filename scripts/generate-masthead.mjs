import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';

const WIDTH = 1200;
/* Both nameplates fill the same measure the Independent Journal title set:
   its 68/5 run lands at ~1186 units inside the 1200 viewBox. */
export const NAMEPLATE_MEASURE = 1186;

export function measureRun(font, text, size, spacing) {
  return [...text].reduce((width, character, index) => {
    const glyph = font.charToGlyph(character);
    const advance = ((glyph.advanceWidth ?? font.unitsPerEm / 2) / font.unitsPerEm) * size;
    return width + advance + (index === text.length - 1 ? 0 : spacing);
  }, 0);
}

function outlineRun(font, text, y, size, spacing) {
  const width = measureRun(font, text, size, spacing);
  const left = (WIDTH - width) / 2;
  let x = left;
  let data = '';

  for (const [index, character] of [...text].entries()) {
    const glyph = font.charToGlyph(character);
    data += glyph.getPath(x, y, size).toPathData(2);
    x += ((glyph.advanceWidth ?? font.unitsPerEm / 2) / font.unitsPerEm) * size;
    if (index < text.length - 1) x += spacing;
  }

  return { data, left, right: left + width };
}

/**
 * The Federalist-side lockup: an idealized two-tier nameplate — all-caps
 * title over an ornamented subtitle row with printer's diamonds and side
 * rules. Kept exactly as first cut; the Independent Journal asset must stay
 * byte-identical across regenerations.
 */
function buildTwoTierSvg(titleFont, subtitleFont, options) {
  const {
    titleText = 'THE INDEPENDENT JOURNAL',
    subtitleText = 'OR, THE GENERAL ADVERTISER',
    slug = 'independent-journal',
    // IM Fell English runs wider than Caslon; 68/5 fills the same measure
    // the Caslon setting did at 76/6.5.
    titleSize = 68,
    titleSpacing = 5
  } = options;
  const title = outlineRun(titleFont, titleText, 103, titleSize, titleSpacing);
  const subtitle = outlineRun(subtitleFont, subtitleText, 159, 24, 7);
  const gap = 24;
  const leftAccentEnd = subtitle.left - gap;
  const rightAccentStart = subtitle.right + gap;
  const leftDiamond = leftAccentEnd - 22;
  const rightDiamond = rightAccentStart + 22;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 35 1200 145" data-masthead-art="${slug}">`,
    `<g fill="#28241f" stroke="#28241f" stroke-width="0.22"><path d="${title.data}"/></g>`,
    `<g fill="#28241f"><path d="${subtitle.data}"/></g>`,
    `<g fill="#28241f" stroke="#28241f" stroke-width="1.5" data-subtitle-left="${subtitle.left.toFixed(2)}" data-subtitle-right="${subtitle.right.toFixed(2)}" data-left-accent-end="${leftAccentEnd.toFixed(2)}" data-right-accent-start="${rightAccentStart.toFixed(2)}">`,
    `<line x1="112" y1="151" x2="${(leftDiamond - 10).toFixed(2)}" y2="151"/>`,
    `<path d="M${leftDiamond.toFixed(2)} 151l7-3v6zM${(leftDiamond + 14).toFixed(2)} 151l-7-3v6z"/>`,
    `<line x1="${(leftDiamond + 24).toFixed(2)}" y1="151" x2="${leftAccentEnd.toFixed(2)}" y2="151"/>`,
    `<line x1="${rightAccentStart.toFixed(2)}" y1="151" x2="${(rightDiamond - 24).toFixed(2)}" y2="151"/>`,
    `<path d="M${(rightDiamond - 14).toFixed(2)} 151l7-3v6zM${rightDiamond.toFixed(2)} 151l-7-3v6z"/>`,
    `<line x1="${(rightDiamond + 10).toFixed(2)}" y1="151" x2="1088" y2="151"/>`,
    '</g></svg>\n'
  ].join('');
}

/**
 * The Journal-side lockup, after the surviving Greenleaf sheets (e.g. the
 * Nov 1, 1787 front page in public/images/antifederalist/brutus-2/): the
 * full name runs as ONE mixed-case line — "The New-York Journal, and Weekly
 * Register." — with no ornaments, no diamonds, and no separate subtitle
 * tier. The size is solved so the line fills the shared nameplate measure.
 */
function buildSingleLineSvg(titleFont, options) {
  const { titleText, slug, titleSpacing = 2.5 } = options;
  // Width is linear in size when spacing scales with it: solve directly.
  const probeSize = 60;
  const probeWidth = measureRun(titleFont, titleText, probeSize, titleSpacing * (probeSize / 60));
  const size = probeSize * (NAMEPLATE_MEASURE / probeWidth);
  const spacing = titleSpacing * (size / 60);
  // Baseline sits low in the shared 145-unit box, as on the printed sheet,
  // leaving the paper's headroom above the name.
  const title = outlineRun(titleFont, titleText, 128, size, spacing);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 35 1200 145" data-masthead-art="${slug}" data-title-size="${size.toFixed(2)}">`,
    `<g fill="#28241f" stroke="#28241f" stroke-width="0.2"><path d="${title.data}"/></g>`,
    '</svg>\n'
  ].join('');
}

export function buildMastheadSvg(titleFont, subtitleFont = titleFont, options = {}) {
  if (options.layout === 'single-line') {
    return buildSingleLineSvg(titleFont, options);
  }
  return buildTwoTierSvg(titleFont, subtitleFont, options);
}

export const MASTHEADS = [
  {
    slug: 'independent-journal',
    layout: 'two-tier',
    titleText: 'THE INDEPENDENT JOURNAL',
    subtitleText: 'OR, THE GENERAL ADVERTISER',
    titleSize: 68,
    titleSpacing: 5,
    output: 'masthead-independent-journal.svg'
  },
  {
    slug: 'new-york-journal',
    layout: 'single-line',
    titleText: 'The New-York Journal, and Weekly Register.',
    output: 'masthead-new-york-journal.svg'
  }
];

async function generate() {
  const titleFontPath = fileURLToPath(
    new URL(
      '../node_modules/@fontsource/im-fell-english/files/im-fell-english-latin-400-normal.woff',
      import.meta.url
    )
  );
  const subtitleFontPath = fileURLToPath(
    new URL(
      '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
      import.meta.url
    )
  );
  const titleFont = await opentype.load(titleFontPath);
  const subtitleFont = await opentype.load(subtitleFontPath);

  await mkdir(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });

  for (const masthead of MASTHEADS) {
    const outputPath = fileURLToPath(new URL(`../public/${masthead.output}`, import.meta.url));
    await writeFile(outputPath, buildMastheadSvg(titleFont, subtitleFont, masthead), 'utf8');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generate();
}
