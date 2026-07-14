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
  let x = (WIDTH - measureRun(font, text, size, spacing)) / 2;
  let data = '';

  for (const character of text) {
    const glyph = font.charToGlyph(character);
    data += glyph.getPath(x, y, size).toPathData(2);
    x += ((glyph.advanceWidth ?? font.unitsPerEm / 2) / font.unitsPerEm) * size + spacing;
  }

  return data;
}

export function buildMastheadSvg(font) {
  const title = outlineRun(font, 'THE INDEPENDENT JOURNAL', 103, 76, 6.5);
  const subtitle = outlineRun(font, 'OR, THE GENERAL ADVERTISER', 159, 24, 7);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 190" data-masthead-art="independent-journal">',
    `<g fill="#28241f"><path d="${title}"/><path d="${subtitle}"/></g>`,
    '<g fill="#28241f" stroke="#28241f" stroke-width="1.5">',
    '<line x1="112" y1="151" x2="340" y2="151"/>',
    '<path d="M356 151l8-3v6zM372 151l-8-3v6z"/>',
    '<line x1="388" y1="151" x2="421" y2="151"/>',
    '<line x1="779" y1="151" x2="812" y2="151"/>',
    '<path d="M828 151l8-3v6zM844 151l-8-3v6z"/>',
    '<line x1="860" y1="151" x2="1088" y2="151"/>',
    '</g></svg>\n'
  ].join('');
}

async function generate() {
  const fontPath = fileURLToPath(
    new URL(
      '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
      import.meta.url
    )
  );
  const outputPath = fileURLToPath(
    new URL('../public/masthead-independent-journal.svg', import.meta.url)
  );
  const font = await opentype.load(fontPath);

  await mkdir(fileURLToPath(new URL('../public/', import.meta.url)), { recursive: true });
  await writeFile(outputPath, buildMastheadSvg(font), 'utf8');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generate();
}
