import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';

const WIDTH = 1200;

function measureRun(font, text, size, spacing) {
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

export function buildMastheadSvg(titleFont, subtitleFont = titleFont) {
  // IM Fell English runs wider than Caslon; 68/5 fills the same measure
  // the Caslon setting did at 76/6.5.
  const title = outlineRun(titleFont, 'THE INDEPENDENT JOURNAL', 103, 68, 5);
  const subtitle = outlineRun(subtitleFont, 'OR, THE GENERAL ADVERTISER', 159, 24, 7);
  const gap = 24;
  const leftAccentEnd = subtitle.left - gap;
  const rightAccentStart = subtitle.right + gap;
  const leftDiamond = leftAccentEnd - 22;
  const rightDiamond = rightAccentStart + 22;

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 35 1200 145" data-masthead-art="independent-journal">',
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
  const outputPath = fileURLToPath(
    new URL('../public/masthead-independent-journal.svg', import.meta.url)
  );
  const titleFont = await opentype.load(titleFontPath);
  const subtitleFont = await opentype.load(subtitleFontPath);

  await mkdir(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
  await writeFile(outputPath, buildMastheadSvg(titleFont, subtitleFont), 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generate();
}
