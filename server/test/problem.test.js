// The server's Problem answers against the approved contract, api/openapi.yaml, and SPEC-014's commands.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { randomTraceId, rayOf } from '../src/log.js';
import { AGENT_COMMANDS, internal, methodNotAllowed, notFound, Problem, PROBLEM_CODES } from '../src/problem.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const contract = read('api/openapi.yaml');
const spec = read('docs/04-functional-spec/spec.md');

// The lines of a block that starts with a line of its own and ends before the next line indented as little.
function block(text, heading) {
  const lines = text.split('\n');
  const start = lines.indexOf(heading);
  assert.notEqual(start, -1, `${heading.trim()} is in the contract`);
  const indent = heading.length - heading.trimStart().length;
  const end = lines.findIndex((line, index) => index > start && line.trim() !== '' && line.length - line.trimStart().length <= indent);
  return lines.slice(start + 1, end === -1 ? undefined : end);
}

function registry() {
  const lines = block(block(contract, 'components:').join('\n'), '  x-corthex:');
  const errors = {};
  let code = null;
  for (const line of block(lines.join('\n'), '    errors:')) {
    const name = /^ {6}([a-z_]+):$/.exec(line);
    if (name) code = name[1];
    const status = /^ {8}status: (\d+)$/.exec(line);
    if (status) errors[code] = Number(status[1]);
  }
  return errors;
}

function problemSchema() {
  const lines = block(contract, '    Problem:');
  const properties = block(lines.join('\n'), '      properties:');
  const property = (name) => block(properties.join('\n'), `        ${name}:`).join('\n');
  return {
    required: /^ {6}required: \[(.*)\]$/m.exec(lines.join('\n'))[1].split(', '),
    properties: properties.map((line) => /^ {8}([A-Za-z_]+):$/.exec(line)?.[1]).filter(Boolean),
    codes: /enum: \[(.*)\]/.exec(property('code'))[1].split(', '),
    titleLength: Number(/maxLength: (\d+)/.exec(property('title'))[1]),
    detailLength: Number(/maxLength: (\d+)/.exec(property('detail'))[1]),
    traceId: new RegExp(JSON.parse(/pattern: (".*")/.exec(property('traceId'))[1])),
  };
}

const schema = problemSchema();
const errors = registry();
const answers = [notFound('/no/such/path'), notFound('/api/spaces/demo/todo'), methodNotAllowed(['DELETE', 'GET', 'PATCH', 'POST']), internal()];

test('each code the server gives is in the registry with its status', () => {
  assert.ok(Object.keys(errors).length > 50, 'the registry was read');
  for (const code of PROBLEM_CODES) {
    assert.ok(code in errors, code);
    assert.ok(schema.codes.includes(code), code);
  }
  for (const problem of answers) assert.equal(problem.status, errors[problem.code], problem.code);
});

test('each answer has the Problem schema\'s members and limits', () => {
  for (const problem of answers) {
    const body = problem.body(randomTraceId());
    for (const member of schema.required) assert.ok(member in body, member);
    for (const member of Object.keys(body)) assert.ok(schema.properties.includes(member), member);
    assert.ok(body.title.length <= schema.titleLength, body.title);
    assert.ok(body.detail.length <= schema.detailLength, body.detail);
    assert.match(body.traceId, schema.traceId);
  }
  assert.match(rayOf({ 'cf-ray': '0123456789abcdef-ICN' }), schema.traceId);
  assert.throws(() => new Problem('no_such_code', 'x'), TypeError);
});

test('the agent commands are SPEC-014\'s', () => {
  const row = /^\| SPEC-014 \|.*?\| Accepts ([a-z, ]+?) in the snapshot format/m.exec(spec);
  assert.ok(row, 'SPEC-014 names its commands');
  assert.deepEqual(row[1].split(/, | and /), [...AGENT_COMMANDS]);
});
