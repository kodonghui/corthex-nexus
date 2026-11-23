// The server's Problem answers and error registry against the approved contract, api/openapi.yaml, and SPEC-014's
// commands (TASK-415).

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomTraceId, rayOf } from '../src/log.js';
import {
  AGENT_COMMANDS, ERRORS, internal, invalidRequest, methodNotAllowed, notFound, Problem, PROBLEM_CODES, tooLarge,
} from '../src/problem.js';
import { contract, operations, read, validate } from './contract.js';

const registry = contract.components['x-corthex'].errors;
const PROBLEM = contract.components.schemas.Problem;
const BASE = ['title', 'status', 'detail', 'code', 'traceId'];

// Each Problem example of the contract, by its code.
const examples = {};
for (const { operation } of operations()) {
  for (const response of Object.values(operation.responses)) {
    for (const body of Object.values(response.content ?? {})) {
      for (const { value } of Object.values(body.examples ?? {})) {
        if (value?.code !== undefined && value.traceId !== undefined) (examples[value.code] ??= []).push(value);
      }
    }
  }
}

// One Problem of each code, with the members of the contract's first example of it, or the router's own.
function build(code) {
  if (code === 'not_found') return notFound('/no/such/path');
  if (code === 'method_not_allowed') return methodNotAllowed(['DELETE', 'GET']);
  const [example] = examples[code];
  const members = Object.fromEntries(Object.entries(example).filter(([name]) => !BASE.includes(name)));
  return new Problem(code, example.detail, {}, members);
}

test('the registry is the contract\'s: every code, its status and both messages', () => {
  assert.ok(PROBLEM_CODES.length > 50, 'the registry was read');
  assert.deepEqual([...PROBLEM_CODES].sort(), Object.keys(registry).sort());
  assert.deepEqual([...PROBLEM_CODES].sort(), [...PROBLEM.properties.code.enum].sort());
  for (const code of PROBLEM_CODES) {
    const { status, message, message_ko: messageKo } = registry[code];
    assert.deepEqual(
      { status: ERRORS[code].status, message: ERRORS[code].message, messageKo: ERRORS[code].message_ko },
      { status, message, messageKo },
      code,
    );
    assert.ok(Object.isFrozen(ERRORS[code]), code);
  }
});

test('each code has a title and the members of the contract\'s examples', () => {
  for (const code of PROBLEM_CODES) {
    const seen = examples[code] ?? [];
    if (seen.length > 0) {
      assert.ok(seen.some((example) => example.title === ERRORS[code].title), `${code}: ${ERRORS[code].title}`);
      for (const example of seen) {
        assert.deepEqual(Object.keys(example).filter((name) => !BASE.includes(name)), [...ERRORS[code].members], code);
      }
    } else {
      // Only the router's own codes have no example in an operation.
      assert.ok(['not_found', 'method_not_allowed'].includes(code), code);
      assert.deepEqual(ERRORS[code].members, [], code);
    }
  }
});

test('builds every registry code in the Problem shape', () => {
  for (const code of PROBLEM_CODES) {
    const problem = build(code);
    const body = problem.body(randomTraceId());
    assert.deepEqual(validate(contract, body, PROBLEM), [], code);
    assert.deepEqual(Object.keys(body).slice(0, BASE.length), BASE, code);
    assert.equal(body.code, code);
    assert.equal(body.status, registry[code].status, code);
    // The messages go with the Problem for the pages (rule 7), not in its answer, which the schema closes.
    assert.equal(problem.message, registry[code].message, code);
    assert.equal(problem.messageKo, registry[code].message_ko, code);
    assert.equal('message' in body || 'message_ko' in body, false, code);
  }
  assert.match(rayOf({ 'cf-ray': '0123456789abcdef-ICN' }), new RegExp(PROBLEM.properties.traceId.pattern));
});

test('the helpers build the contract\'s answers', () => {
  const traceId = randomTraceId();
  const answers = [
    [notFound('/api/spaces/demo/todo'), 'not_found', {}],
    [internal(), 'internal', {}],
    [invalidRequest('Idempotency-Key', 'Idempotency-Key is missing'), 'invalid_request', { field: 'Idempotency-Key' }],
    [invalidRequest('body', 'the body is not JSON', 'invalid_snapshot'), 'invalid_snapshot', { field: 'body' }],
    [tooLarge('body_too_large', 2_097_152), 'body_too_large', { limit: 2_097_152 }],
    [tooLarge('snapshot_too_large', 8_388_608), 'snapshot_too_large', { limit: 8_388_608 }],
  ];
  for (const [problem, code, members] of answers) {
    const body = problem.body(traceId);
    assert.deepEqual(validate(contract, body, PROBLEM), [], code);
    assert.equal(body.code, code);
    for (const [name, value] of Object.entries(members)) assert.equal(body[name], value, `${code} ${name}`);
  }
  assert.equal(tooLarge('body_too_large', 2_097_152).detail, examples.body_too_large[0].detail);
  assert.equal(tooLarge('snapshot_too_large', 8_388_608).detail, examples.snapshot_too_large[0].detail);
  // A code without a fixed detail takes the one its refusal gives.
  assert.equal(new Problem('project_not_found').detail, examples.project_not_found[0].detail);
});

test('a Problem takes only a code of the registry and exactly its members', () => {
  assert.throws(() => new Problem('no_such_code', 'x'), TypeError);
  assert.throws(() => new Problem('constructor'), TypeError);
  assert.throws(() => new Problem('invalid_request', 'x'), /needs field/);
  assert.throws(() => new Problem('body_too_large', 'x', {}, { limit: 1, field: 'body' }), /has no field/);
  assert.throws(() => new Problem('not_found', 'x', {}, { limit: 1 }), /has no limit/);
  assert.throws(() => new Problem('invalid_request', undefined, {}, { field: 'body' }), /needs its detail/);
  assert.equal(new Problem('claimed', undefined, {}, { session: 's', last_write_at: 't', ends_at: null }).members.ends_at, null);
});

test('the agent commands are SPEC-014\'s', () => {
  const spec = read('docs/04-functional-spec/spec.md');
  const row = /^\| SPEC-014 \|.*?\| Accepts ([a-z, ]+?) in the snapshot format/m.exec(spec);
  assert.ok(row, 'SPEC-014 names its commands');
  assert.deepEqual(row[1].split(/, | and /), [...AGENT_COMMANDS]);
});
