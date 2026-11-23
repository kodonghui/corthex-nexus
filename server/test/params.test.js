// The forms of the path parameters against the contract (TASK-415, from the review of TASK-413): every parameter of
// every operation has a 404 code among the operation's own whose form is exactly the parameter's schema.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORMS, malformedParameter } from '../src/params.js';
import { contract, operations, resolve, validate } from './contract.js';

const PREFIXES = ['nc', 'np', 'ne', 'nk', 'nd', 'dg', 'dw', 'ac', 'tl', 'sn', 'sl', 'ws', 'nw', 'xx'];
// Values each form takes or refuses: IDs of every prefix in the right and wrong shapes, project names and steps.
const SAMPLES = [
  ...PREFIXES.flatMap((prefix) => [
    `${prefix}_0123456789ab`, `${prefix}_abcdefghjkmn`, `${prefix}_pqrstvwxyz01`, `${prefix}_0123456789a`,
    `${prefix}_0123456789abc`, `${prefix}_0123456789aB`, `${prefix}_0123456789ai`, `${prefix}_0123456789al`,
    `${prefix}_0123456789ao`, `${prefix}_0123456789au`, `${prefix}-0123456789ab`, `${prefix}_0123456789ab\n`,
    ` ${prefix}_0123456789ab`,
  ]),
  'demo', 'a', 'demo-2', 'a1-b2-c3', 'a'.repeat(64), 'a'.repeat(65), 'Demo', 'demo-', '-demo', 'de--mo', 'de_mo', 'de mo',
  '../etc', 'demo/x', '%E0%A4%A', '', 'é',
  '0', '1', '1-b', '2', '3', '4', '5', '6', '7', '8', '9', '10', '1-a', '1-B', '01', '-1',
];

test('every path parameter of the contract has a 404 code whose form is its schema', () => {
  let checked = 0;
  for (const { method, path, operation } of operations()) {
    const parameters = (operation.parameters ?? []).map((parameter) => resolve(contract, parameter))
      .filter((parameter) => parameter.in === 'path');
    if (parameters.length === 0) continue;
    const codes = Object.values(operation.responses['404']?.content['application/problem+json'].examples ?? {})
      .map(({ value }) => value.code);
    for (const parameter of parameters) {
      const where = `${method} ${path} {${parameter.name}}`;
      assert.ok(path.includes(`{${parameter.name}}`), where);
      const agreeing = codes.filter((code) => Object.hasOwn(FORMS, code)
        && SAMPLES.every((value) => FORMS[code](value) === (validate(contract, value, parameter.schema).length === 0)));
      assert.ok(agreeing.length > 0, `${where}: none of ${codes.join(', ')} has its form`);
      checked += 1;
    }
  }
  assert.ok(checked >= 60, `the contract's parameters were read (${checked})`);
});

test('every form is the schema of a parameter of the contract', () => {
  const schemas = Object.values(contract.components.parameters)
    .filter((parameter) => parameter.in === 'path')
    .map((parameter) => parameter.schema);
  for (const [code, form] of Object.entries(FORMS)) {
    assert.ok(
      schemas.some((schema) => SAMPLES.every((value) => form(value) === (validate(contract, value, schema).length === 0))),
      code,
    );
    // Each takes at least one sample and refuses others, so the comparison means something.
    assert.ok(SAMPLES.some(form) && !SAMPLES.every(form), code);
  }
});

test('the first parameter out of its form, in path order, gives the code', () => {
  const checks = [['project', 'project_not_found'], ['thread', 'thread_not_found']];
  assert.equal(malformedParameter(checks, { project: 'demo', thread: 'nc_0123456789ab' }), null);
  assert.equal(malformedParameter(checks, { project: 'demo', thread: 'np_0123456789ab' }), 'thread_not_found');
  assert.equal(malformedParameter(checks, { project: '../x', thread: 'np_0123456789ab' }), 'project_not_found');
});
