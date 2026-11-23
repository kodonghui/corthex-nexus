// The contract's IDs for the store's rows (src/ids.js): a row's key in base 32, read back to the same key.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { idOf, keyOf } from '../src/ids.js';
import { FORMS } from '../src/params.js';
import { contract } from './contract.js';

test('an ID is its row key in 12 characters of the contract\'s alphabet, read back to the same key', () => {
  const pattern = new RegExp(contract.components.schemas.CredentialId.pattern);
  for (const key of [1, 2, 31, 32, 33, 1023, 1024, 4_294_967_296, Number.MAX_SAFE_INTEGER]) {
    const id = idOf('ac', key);
    assert.match(id, pattern);
    assert.ok(FORMS.credential_not_found(id), id);
    assert.equal(keyOf('ac', id), key);
  }
  assert.equal(idOf('ac', 1), `ac_${'0'.repeat(11)}1`);
  assert.equal(idOf('ac', 32), `ac_${'0'.repeat(10)}10`);
  assert.equal(idOf('dg', 31), `dg_${'0'.repeat(11)}z`);
  // Every ID is distinct, and in order of its key.
  const ids = Array.from({ length: 2000 }, (_, index) => idOf('ac', index + 1));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), ids);
});

test('a text that is no ID of the prefix, or names no key the store can hold, reads as no key', () => {
  for (const text of [
    undefined, null, 1, '', 'ac_', `ac_${'0'.repeat(12)}`, `ac_${'0'.repeat(11)}`, `ac_${'0'.repeat(13)}`,
    `dg_${'0'.repeat(11)}1`, `AC_${'0'.repeat(11)}1`, `ac_${'0'.repeat(11)}i`, `ac_${'0'.repeat(11)}l`,
    `ac_${'0'.repeat(11)}o`, `ac_${'0'.repeat(11)}u`, `ac_${'0'.repeat(11)}A`, `ac-${'0'.repeat(11)}1`,
    `ac_${'z'.repeat(12)}`, idOf('ac', Number.MAX_SAFE_INTEGER).replace(/^ac_./, 'ac_1'),
  ]) {
    assert.equal(keyOf('ac', text), null, String(text));
  }
  assert.throws(() => idOf('ac', 0), /positive integer/);
  assert.throws(() => idOf('ac', 1.5), /positive integer/);
  assert.throws(() => idOf('ac', Number.MAX_SAFE_INTEGER + 1), /positive integer/);
  assert.throws(() => idOf('a', 1), /two lowercase letters/);
  assert.throws(() => keyOf('AC', 'AC_1'), /two lowercase letters/);
});
