// The stored expected drawing of this repository's mockup page (TASK-427): what the mockup drawer draws from
// mockup-picture.json, the pinned hub's picture of design/mockup/nexus-mockup.html with the file's SHA-256, which
// tests/test_mockup_picture.py makes and checks. test/mockup.test.js compares the drawing with mockup-expected.json
// exactly. node --test also runs this file, which holds no test and writes nothing.
//
// To make both files again, from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_mockup_picture.py --write
//     (cd server && node test/mockup-expected.js --write)

import { readFileSync, writeFileSync } from 'node:fs';
import { mockup } from '../src/mockup.js';

export const STAGE = '09-mockup';
const PICTURE = new URL('./mockup-picture.json', import.meta.url);
const EXPECTED = new URL('./mockup-expected.json', import.meta.url);

// The stored picture: { source, sha256, part, checks, left_out, picture }, picture { part, stage, key, source: { text } }.
export function storedPicture() {
  return JSON.parse(readFileSync(PICTURE, 'utf8'));
}

// The stored expected drawing, { elements }.
export function storedDrawing() {
  return JSON.parse(readFileSync(EXPECTED, 'utf8'));
}

// What the drawer draws of a page, given as the push gives a file's picture: its whole text, and no warnings.
export function drawingOf({ part, picture }) {
  return mockup({
    stage: STAGE, part, key: picture.key, kind: 'mockup', source: picture.key, text: picture.source.text, read: () => null, warnings: [],
  });
}

if (process.argv.includes('--write')) {
  writeFileSync(EXPECTED, `${JSON.stringify(drawingOf(storedPicture()), null, 1)}\n`);
  console.log('Wrote the expected drawing of test/mockup-picture.json');
}
