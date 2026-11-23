// The stored expected drawing of this repository's ERD (TASK-422): what the ERD drawer draws from erd-picture.json, the
// pinned hub's picture of db/nexus.sql with the file's SHA-256, which tests/test_erd_picture.py makes and checks.
// test/erd.test.js compares the drawing with erd-expected.json exactly. node --test also runs this file, which holds no
// test and writes nothing.
//
// To make both files again, from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_erd_picture.py --write
//     (cd server && node test/erd-expected.js --write)

import { readFileSync, writeFileSync } from 'node:fs';
import { pictureWarnings } from '../src/drawing.js';
import { erd } from '../src/erd.js';

export const STAGE = '05-erd';
const PICTURE = new URL('./erd-picture.json', import.meta.url);
const EXPECTED = new URL('./erd-expected.json', import.meta.url);

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
  return erd({
    stage: STAGE, part, key: null, kind: 'erd', source, text: JSON.stringify(picture), read: () => null, warnings: pictureWarnings(checks, STAGE, part),
  });
}

if (process.argv.includes('--write')) {
  writeFileSync(EXPECTED, `${JSON.stringify(drawingOf(storedPicture()), null, 1)}\n`);
  console.log('Wrote the expected drawing of test/erd-picture.json');
}
