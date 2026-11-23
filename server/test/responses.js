// Shared by the tests: the responses the contract lists for each operation, and a record of the answers a test file
// got, each checked against the contract, for the WBS's done condition "every response API-… lists has a passing
// test". node --test also runs this file, which holds no test.

import assert from 'node:assert/strict';
import { contract, operations, validate } from './contract.js';

const TYPES = Object.freeze({
  'application/json': 'application/json; charset=utf-8',
  'application/problem+json': 'application/problem+json',
  'text/html': 'text/html; charset=utf-8',
});
// The types whose body is JSON; a body of any other is checked as its text.
const JSON_TYPES = new Set(['application/json', 'application/problem+json']);

// Each response the operation action lists: { status, type, schema, codes, headers }. status is the contract's key,
// such as '201' or 'default'; codes are the Problem codes its examples give, none for a success; headers are the
// headers it declares, each by its name in lowercase with its schema.
export function listedResponses(action) {
  const found = operations().find(({ operation }) => operation.operationId === action);
  assert.ok(found, `${action} is no operation of the contract`);
  return Object.entries(found.operation.responses).map(([status, response]) => {
    const entries = Object.entries(response.content ?? {});
    assert.equal(entries.length, 1, `${action} ${status} has one type`);
    const [[type, content]] = entries;
    const codes = Object.values(content.examples ?? {}).map((example) => example.value.code).filter(Boolean);
    const headers = Object.fromEntries(Object.entries(response.headers ?? {}).map(([name, header]) => [name.toLowerCase(), header.schema]));
    return { status, type, schema: content.schema, codes: [...new Set(codes)], headers };
  });
}

// Records answers by operation: note(action, answer) checks an answer of the test client (support.js) against the
// response the operation lists for its status, or its default, its type, its body and each header it declares
// included, and keeps it; assertEvery(action) checks that every listed response came, each Problem code its examples
// give included.
export function responseRecord() {
  const seen = new Map();
  return {
    note(action, answer) {
      const listed = listedResponses(action);
      const response = listed.find((each) => each.status === String(answer.status))
        ?? listed.find((each) => each.status === 'default');
      assert.ok(response, `${action} lists no ${answer.status}`);
      assert.equal(answer.headers['content-type'], TYPES[response.type], `${action} ${answer.status}`);
      const body = JSON_TYPES.has(response.type) ? answer.json : answer.text;
      assert.deepEqual(validate(contract, body, response.schema), [], `${action} ${answer.status}: ${answer.text.slice(0, 500)}`);
      for (const [name, schema] of Object.entries(response.headers)) {
        assert.deepEqual(validate(contract, answer.headers[name], schema), [], `${action} ${answer.status}: the header ${name}`);
      }
      if (response.type === 'application/problem+json') {
        assert.equal(answer.json.status, answer.status);
        assert.ok(response.codes.includes(answer.json.code), `${action} ${response.status} lists no ${answer.json.code}`);
      }
      if (!seen.has(action)) seen.set(action, new Set());
      seen.get(action).add(responseKey(response.status, answer.json?.code));
      return answer;
    },
    assertEvery(action) {
      const got = seen.get(action) ?? new Set();
      for (const { status, codes } of listedResponses(action)) {
        if (codes.length === 0) assert.ok(got.has(responseKey(status)), `${action} ${status} was not answered`);
        for (const code of codes) assert.ok(got.has(responseKey(status, code)), `${action} ${status} ${code} was not answered`);
      }
    },
  };
}

function responseKey(status, code) {
  return code === undefined || /^2/.test(status) ? status : `${status} ${code}`;
}
