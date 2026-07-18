import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';
import sharp from 'sharp';

const NEWSPRINT = '#e7deca';
const INK = '#2a2722';
const OXBLOOD = '#672b28';
const SIZE = 512;

export function placeMonogram(font) {
  const initial = font.getPath('F', 0, 0, 286);
  const initialBounds = initial.getBoundingBox();
  const x = (SIZE - (initialBounds.x2 - initialBounds.x1)) / 2 - initialBounds.x1;
  const y = (SIZE - (initialBounds.y2 - initialBounds.y1)) / 2 - initialBounds.y1;
  const path = font.getPath('F', x, y, 286);

  return {
    bounds: path.getBoundingBox(),
    path: path.toPathData(2),
  };
}

export function buildAppIconSvg(font) {
  const { path } = placeMonogram(font);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" data-app-icon="federalist-reader" data-monogram="F">
  <rect width="512" height="512" fill="${NEWSPRINT}"/>
  <rect x="44" y="44" width="424" height="424" fill="none" stroke="${INK}" stroke-width="10"/>
  <rect x="60" y="60" width="392" height="392" fill="none" stroke="${INK}" stroke-width="4"/>
  <g fill="${OXBLOOD}"><path d="${path}"/></g>
  <g fill="${INK}" stroke="${INK}" stroke-width="4">
    <path d="M170 116H342M170 396H342"/>
    <path d="M256 103l13 13-13 13-13-13zM256 383l13 13-13 13-13-13z" fill="${OXBLOOD}" stroke="none"/>
  </g>
</svg>`;
}

export function buildXAvatarSvg(font) {
  const { path } = placeMonogram(font);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" data-x-avatar="federalist-reader" data-monogram="F">
  <circle cx="256" cy="256" r="256" fill="${NEWSPRINT}"/>
  <circle cx="256" cy="256" r="222" fill="none" stroke="${INK}" stroke-width="12"/>
  <circle cx="256" cy="256" r="203" fill="none" stroke="${INK}" stroke-width="4"/>
  <path d="${path}" fill="${OXBLOOD}"/>
  <path d="M256 99l13 13-13 13-13-13zM256 387l13 13-13 13-13-13z" fill="${OXBLOOD}"/>
</svg>`;
}

async function generate() {
  const fontPath = fileURLToPath(
    new URL(
      '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
      import.meta.url,
    ),
  );
  const font = await opentype.load(fontPath);
  const svg = buildAppIconSvg(font);
  const svgBuffer = Buffer.from(svg);
  const xAvatarSvg = buildXAvatarSvg(font);
  const iconsDirectory = new URL('../public/icons/', import.meta.url);
  const profileDirectory = new URL('../public/profile/', import.meta.url);

  await mkdir(iconsDirectory, { recursive: true });
  await mkdir(profileDirectory, { recursive: true });
  await writeFile(new URL('../public/app-icon.svg', import.meta.url), `${svg}\n`);
  await writeFile(new URL('../public/favicon.svg', import.meta.url), `${svg}\n`);
  await writeFile(
    new URL('../public/profile/federalist-reader-x-avatar.svg', import.meta.url),
    `${xAvatarSvg}\n`,
  );
  await sharp(Buffer.from(xAvatarSvg))
    .resize(400, 400)
    .png()
    .toFile(
      fileURLToPath(
        new URL('../public/profile/federalist-reader-x-avatar.png', import.meta.url),
      ),
    );
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(fileURLToPath(new URL('../public/apple-touch-icon.png', import.meta.url)));
  await sharp(svgBuffer)
    .resize(192, 192)
    .png()
    .toFile(fileURLToPath(new URL('../public/icons/icon-192.png', import.meta.url)));
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(fileURLToPath(new URL('../public/icons/icon-512.png', import.meta.url)));
  await sharp(svgBuffer)
    .resize(410, 410)
    .extend({ top: 51, right: 51, bottom: 51, left: 51, background: NEWSPRINT })
    .png()
    .toFile(fileURLToPath(new URL('../public/icons/icon-maskable-512.png', import.meta.url)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generate();
}
