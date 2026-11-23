// The stored expected drawing of this repository's sitemap (TASK-425): what the sitemap drawer draws from
// sitemap-picture.json, the pinned hub's picture of docs/07-sitemap/nexus.yaml with the file's SHA-256, which
// tests/test_sitemap_picture.py makes and checks. test/sitemap.test.js compares the drawing with sitemap-expected.json
// exactly. node --test also runs this file, which holds no test and writes nothing.
//
// To make both files again, from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_sitemap_picture.py --write
//     (cd server && node test/sitemap-expected.js --write)

import { readFileSync, writeFileSync } from 'node:fs';
import { pictureWarnings } from '../src/drawing.js';
import { sitemap } from '../src/sitemap.js';

export const STAGE = '07-sitemap';
const PICTURE = new URL('./sitemap-picture.json', import.meta.url);
const EXPECTED = new URL('./sitemap-expected.json', import.meta.url);

// The stored picture: { source, sha256, part, checks, picture }.
export function storedPicture() {
  return JSON.parse(readFileSync(PICTURE, 'utf8'));
}

// The stored expected drawing, { elements }.
export function storedDrawing() {
  return JSON.parse(readFileSync(EXPECTED, 'utf8'));
}

// What the drawer draws of a stored picture, given as the push gives it: the picture as JSON, and the warnings of its
// stage and part from the checks.
export function drawingOf({ source, part, checks, picture }) {
  return sitemap({
    stage: STAGE, part, key: null, kind: 'sitemap', source, text: JSON.stringify(picture), read: () => null, warnings: pictureWarnings(checks, STAGE, part),
  });
}

if (process.argv.includes('--write')) {
  writeFileSync(EXPECTED, `${JSON.stringify(drawingOf(storedPicture()), null, 1)}\n`);
  console.log('Wrote the expected drawing of test/sitemap-picture.json');
}
