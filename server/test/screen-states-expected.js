// The stored expected drawings of this repository's screen definitions (TASK-426): what the screen-states drawer draws
// from screen-states-pictures.json, the pinned hub's corthex-hub/0.3 pictures of docs/08-screens, each with its file's
// SHA-256, which tests/test_screen_states_pictures.py makes and checks. test/screen-states.test.js compares the drawings
// with screen-states-expected.json exactly. node --test also runs this file, which holds no test and writes nothing.
//
// To make both files again, from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_screen_states_pictures.py --write
//     (cd server && node test/screen-states-expected.js --write)

import { readFileSync, writeFileSync } from 'node:fs';
import { screenStates } from '../src/screen-states.js';

export const STAGE = '08-screen-states';
const PICTURES = new URL('./screen-states-pictures.json', import.meta.url);
const EXPECTED = new URL('./screen-states-expected.json', import.meta.url);

// The stored pictures: { source, checks, left_out, pictures: [{ part, stage, key, source: { text }, sha256 }] }.
export function storedPictures() {
  return JSON.parse(readFileSync(PICTURES, 'utf8'));
}

// The stored expected drawings, { drawings: [{ key, name, elements }] }, in the pictures' order.
export function storedDrawings() {
  return JSON.parse(readFileSync(EXPECTED, 'utf8'));
}

// What the drawer draws of a screen file, given as the push gives it: the file's key as its source, its whole text,
// and no warnings.
export function drawingOf({ part = '', key, text }) {
  return screenStates({ stage: STAGE, part, key, kind: 'screen_states', source: key, text, read: () => null, warnings: [] });
}

// The drawings of the stored pictures.
export function drawingsOf({ pictures }) {
  return { drawings: pictures.map(({ part, key, source }) => ({ key, ...drawingOf({ part, key, text: source.text }) })) };
}

if (process.argv.includes('--write')) {
  writeFileSync(EXPECTED, `${JSON.stringify(drawingsOf(storedPictures()), null, 1)}\n`);
  console.log('Wrote the expected drawings of test/screen-states-pictures.json');
}
