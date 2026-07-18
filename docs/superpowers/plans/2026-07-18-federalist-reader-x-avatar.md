# Federalist Reader X Avatar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an editable Pressmark F vector master and a verified 400×400 PNG ready to upload as the Federalist Reader X profile image.

**Architecture:** Extend the existing deterministic app-icon generator because it already owns the Caslon monogram geometry and brand colors. A new exported SVG builder will compose the circular mark, while the existing Sharp pipeline will write both the vector master and upload-ready PNG.

**Tech Stack:** Node.js 22, opentype.js, Sharp, Vitest, SVG, PNG

## Global Constraints

- Reuse the existing monogram path generated from Libre Caslon Display without distortion.
- Use newsprint `#e7deca`, ink `#2a2722`, and oxblood `#672b28`.
- Use a circular newsprint field, two inset ink rings, a centered oxblood “F,” and one oxblood printer's diamond above and below.
- Include no wording, gradients, shadows, stains, distressing, or artificial aging.
- Produce `public/profile/federalist-reader-x-avatar.svg` and a 400×400 `public/profile/federalist-reader-x-avatar.png` below 2 MB.

---

### Task 1: Generate and verify the Pressmark F avatar

**Files:**
- Modify: `tests/app-icon.test.ts`
- Modify: `scripts/generate-app-icons.mjs`
- Create: `public/profile/federalist-reader-x-avatar.svg`
- Create: `public/profile/federalist-reader-x-avatar.png`

**Interfaces:**
- Consumes: `placeMonogram(font)` from `scripts/generate-app-icons.mjs`
- Produces: `buildXAvatarSvg(font): string`, the committed SVG master, and the committed 400×400 PNG

- [x] **Step 1: Add failing structural and output tests**

Update the import in `tests/app-icon.test.ts`:

```ts
import {
  buildAppIconSvg,
  buildXAvatarSvg,
  placeMonogram,
} from '../scripts/generate-app-icons.mjs';
```

Add these tests inside `describe('Federalist app identity', ...)`:

```ts
it('builds the circular Pressmark F avatar from outlined vector geometry', async () => {
  const { default: opentype } = await import('opentype.js');
  const fontPath = new URL(
    '../node_modules/@fontsource/libre-caslon-display/files/libre-caslon-display-latin-400-normal.woff',
    import.meta.url,
  );
  const font = await opentype.load(fileURLToPath(fontPath));
  const svg = buildXAvatarSvg(font);

  expect(svg).toContain('data-x-avatar="federalist-reader"');
  expect(svg).toContain('data-monogram="F"');
  expect(svg.match(/<circle/g)).toHaveLength(3);
  expect(svg).toContain('fill="#e7deca"');
  expect(svg).toContain('stroke="#2a2722"');
  expect(svg).toContain('fill="#672b28"');
  expect(svg).toContain('M256 99l13 13-13 13-13-13z');
  expect(svg).not.toContain('<text');
  expect(svg).not.toContain('filter=');
});

it('commits the upload-ready X avatar at 400px and below 2 MB', async () => {
  const bytes = await readFile(
    new URL('../public/profile/federalist-reader-x-avatar.png', import.meta.url),
  );

  expect(pngDimensions(bytes)).toEqual({ width: 400, height: 400 });
  expect(bytes.byteLength).toBeLessThan(2 * 1024 * 1024);
});
```

- [x] **Step 2: Run the focused test and verify the new interface is missing**

Run:

```bash
pnpm test -- tests/app-icon.test.ts
```

Expected: FAIL because `buildXAvatarSvg` is not exported from `scripts/generate-app-icons.mjs`.

- [x] **Step 3: Implement the vector builder**

Add this function after `buildAppIconSvg` in `scripts/generate-app-icons.mjs`:

```js
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
```

- [x] **Step 4: Extend the existing generator to write both deliverables**

In `generate()` within `scripts/generate-app-icons.mjs`, create `xAvatarSvg` and `profileDirectory` alongside the existing values:

```js
const svg = buildAppIconSvg(font);
const svgBuffer = Buffer.from(svg);
const xAvatarSvg = buildXAvatarSvg(font);
const iconsDirectory = new URL('../public/icons/', import.meta.url);
const profileDirectory = new URL('../public/profile/', import.meta.url);

await mkdir(iconsDirectory, { recursive: true });
await mkdir(profileDirectory, { recursive: true });
```

After the existing SVG writes, add:

```js
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
```

- [x] **Step 5: Generate the assets and run the focused test**

Run:

```bash
pnpm generate:icons
pnpm test -- tests/app-icon.test.ts
```

Expected: the generator exits successfully and all tests in `tests/app-icon.test.ts` pass.

- [x] **Step 6: Run the full verification suite**

Run:

```bash
pnpm check
```

Expected: Astro checks, analytics verification, and all Vitest tests pass.

- [x] **Step 7: Inspect the final PNG at full and timeline sizes**

Open `public/profile/federalist-reader-x-avatar.png` at its native 400×400 size and at approximately 44×44. Confirm that the two rings remain inside the circular crop, both diamonds are distinct, the monogram is centered, and no element becomes muddy at timeline size.

- [x] **Step 8: Commit the generated avatar**

```bash
git add scripts/generate-app-icons.mjs tests/app-icon.test.ts public/profile/federalist-reader-x-avatar.svg public/profile/federalist-reader-x-avatar.png docs/superpowers/plans/2026-07-18-federalist-reader-x-avatar.md
git commit -m "feat: add Federalist Reader X avatar"
```
