// The stored expected drawing of this repository's DDD board (TASK-421): what the DDD board drawer draws from
// ddd-board-picture.json, the pinned hub's picture of the stage-01 documents with their SHA-256, which
// tests/test_ddd_board_picture.py makes and checks. test/ddd-board.test.js compares the drawing with
// ddd-board-expected.json exactly. node --test also runs this file, which holds no test and writes nothing.
//
// To make both files again, from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_ddd_board_picture.py --write
//     (cd server && node test/ddd-board-expected.js --write)

import { readFileSync, writeFileSync } from 'node:fs';
import { dddBoard } from '../src/ddd-board.js';
import { pictureWarnings } from '../src/drawing.js';

export const STAGE = '01-domain';
const PICTURE = new URL('./ddd-board-picture.json', import.meta.url);
const EXPECTED = new URL('./ddd-board-expected.json', import.meta.url);

// The stored picture: { source, part, documents, checks, picture }.
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
  return dddBoard({
    stage: STAGE, part, key: null, kind: 'ddd_board', source, text: JSON.stringify(picture), read: () => null, warnings: pictureWarnings(checks, STAGE, part),
  });
}

if (process.argv.includes('--write')) {
  writeFileSync(EXPECTED, `${JSON.stringify(drawingOf(storedPicture()), null, 1)}\n`);
  console.log('Wrote the expected drawing of test/ddd-board-picture.json');
}
