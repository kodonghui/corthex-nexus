// The stored expected drawings of this repository's user flows (TASK-424): what the user-flow drawer draws from
// user-flow-pictures.json, the pinned hub's corthex-hub/0.3 pictures of docs/03-user-flow with each file's SHA-256,
// which tests/test_user_flow_pictures.py makes and checks. test/user-flow.test.js compares each drawing with
// user-flow-expected.json exactly. node --test also runs this file, which holds no test and writes nothing.
//
// To make both files again, from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_user_flow_pictures.py --write
//     (cd server && node test/user-flow-expected.js --write)

import { readFileSync, writeFileSync } from 'node:fs';
import { userFlow } from '../src/user-flow.js';

export const STAGE = '03-user-flow';
const PICTURES = new URL('./user-flow-pictures.json', import.meta.url);
const EXPECTED = new URL('./user-flow-expected.json', import.meta.url);

// The stored pictures: { stage, source, checks, left_out, pictures: [{ sha256, picture: { part, stage, key, source } }] }.
export function storedPictures() {
  return JSON.parse(readFileSync(PICTURES, 'utf8'));
}

// The stored expected drawings, { [the file's key]: { name, elements } }, in the pictures' order.
export function storedDrawings() {
  return JSON.parse(readFileSync(EXPECTED, 'utf8'));
}

// What the drawer draws of a stored picture, given as the push gives a file of stage 03: its key as the key and the
// source, its whole text, and no warnings.
export function drawingOf({ part, key, source }) {
  return userFlow({ stage: STAGE, part, key, kind: 'user_flow', source: key, text: source.text, read: () => null, warnings: [] });
}

if (process.argv.includes('--write')) {
  const drawings = Object.fromEntries(storedPictures().pictures.map(({ picture }) => [picture.key, drawingOf(picture)]));
  writeFileSync(EXPECTED, `${JSON.stringify(drawings, null, 1)}\n`);
  console.log('Wrote the expected drawings of test/user-flow-pictures.json');
}
