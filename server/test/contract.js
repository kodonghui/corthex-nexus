// Shared by the tests: the approved contract, api/openapi.yaml, read with Node alone, and a check of a value against
// its schemas. node --test also runs this file, which holds no test.
//
// The reader takes the YAML subset the contract is written in, as tests/yaml_subset.py does: block mappings and
// block sequences indented by two spaces, flow sequences of scalars, {} and [], and scalars that are plain or
// double-quoted with JSON escapes. Anything else throws, so the tests never misread the contract.

import { readFileSync } from 'node:fs';

const KEY = /^("(?:[^"\\]|\\.)*"|[^\s"#:][^:#]*?):(?: (.*))?$/;
const PLAIN_NUMBER = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][-+]?[0-9]+)?$/;

export const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

// The contract, parsed once.
export const contract = load(read('api/openapi.yaml'));
export const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

// Each operation as { method, path, operation }.
export function operations(doc = contract) {
  return Object.entries(doc.paths).flatMap(([path, item]) => Object.entries(item)
    .filter(([method]) => METHODS.includes(method))
    .map(([method, operation]) => ({ method: method.toUpperCase(), path, operation })));
}

export function resolve(doc, schema) {
  let node = schema;
  while (node !== null && typeof node === 'object' && '$ref' in node) {
    node = node.$ref.replace(/^#\//, '').split('/').reduce((parent, part) => parent[part], doc);
  }
  return node;
}

function kindOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value;
}

// The errors of value against the JSON Schema subset the contract uses, as tests/test_api.py's validate gives them.
export function validate(doc, value, schemaOrRef, where = '$') {
  const schema = resolve(doc, schemaOrRef);
  const errors = [];
  if (schema.anyOf) {
    if (!schema.anyOf.some((branch) => validate(doc, value, branch, where).length === 0)) {
      errors.push(`${where} matches no branch of anyOf`);
    }
    return errors;
  }
  if ('const' in schema && value !== schema.const) errors.push(`${where} is not ${schema.const}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${where}: ${value} is not one of the enum`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = kindOf(value);
    if (!types.includes(actual) && !(actual === 'integer' && types.includes('number'))) {
      return [...errors, `${where} is ${actual}, not ${types.join('/')}`];
    }
  }
  if (typeof value === 'string') {
    const length = [...value].length;
    if (length < (schema.minLength ?? 0) || length > (schema.maxLength ?? length)) errors.push(`${where} has a length outside its limits`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${where} does not match ${schema.pattern}`);
  }
  if (typeof value === 'number' && (value < (schema.minimum ?? value) || value > (schema.maximum ?? value))) {
    errors.push(`${where}: ${value} is outside its range`);
  }
  if (Array.isArray(value)) {
    if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? value.length)) {
      errors.push(`${where} has a count outside its limits`);
    }
    value.forEach((item, index) => errors.push(...validate(doc, item, schema.items ?? {}, `${where}[${index}]`)));
  }
  if (kindOf(value) === 'object') {
    for (const name of schema.required ?? []) if (!(name in value)) errors.push(`${where} lacks ${name}`);
    const properties = schema.properties ?? {};
    for (const [name, item] of Object.entries(value)) {
      if (Object.hasOwn(properties, name)) errors.push(...validate(doc, item, properties[name], `${where}.${name}`));
      else if (schema.additionalProperties === false) errors.push(`${where} has ${name}, which the schema does not allow`);
    }
  }
  return errors;
}

function scalar(raw) {
  const text = raw.trim();
  if (text.startsWith('"')) return JSON.parse(text);
  if (text === 'null' || text === '~') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === '{}') return {};
  if (text === '[]') return [];
  if (text.startsWith('[')) {
    if (!text.endsWith(']')) throw new Error(`an unclosed flow sequence: ${text}`);
    const inner = text.slice(1, -1).trim();
    if (inner === '') return [];
    const items = [];
    let start = 0;
    let quoted = false;
    let escaped = false;
    for (let index = 0; index < inner.length; index += 1) {
      const char = inner[index];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') {
        quoted = true;
      } else if (char === '[' || char === '{') {
        throw new Error(`a nested flow collection: ${text}`);
      } else if (char === ',') {
        items.push(inner.slice(start, index));
        start = index + 1;
      }
    }
    items.push(inner.slice(start));
    return items.map(scalar);
  }
  if ('{&*!|>%@`\''.includes(text[0])) throw new Error(`a scalar outside the subset: ${text}`);
  if (PLAIN_NUMBER.test(text)) return Number(text);
  if (text.includes(' #')) throw new Error(`a comment after a value: ${text}`);
  if (text.includes(': ') || text.endsWith(':')) throw new Error(`a colon in a plain value: ${text}`);
  return text;
}

function keyOf(text) {
  return text.startsWith('"') ? scalar(text) : text.trim();
}

export function load(text) {
  const lines = [];
  text.split('\n').forEach((raw, index) => {
    if (raw.trim() === '' || raw.trimStart().startsWith('#')) return;
    const indent = raw.length - raw.trimStart().length;
    if (raw.slice(0, indent).includes('\t')) throw new Error(`line ${index + 1}: a tab in the indentation`);
    lines.push({ number: index + 1, indent: raw.length - raw.replace(/^ +/, '').length, text: raw.trim() });
  });
  const [value, end] = block(lines, 0, 0);
  if (end !== lines.length) throw new Error(`line ${lines[end].number}: unexpected indentation`);
  return value;
}

function isItem(text) {
  return text.startsWith('- ') || text === '-';
}

function block(lines, start, indent) {
  let index = start;
  if (lines[index].indent !== indent) throw new Error(`line ${lines[index].number}: expected indentation ${indent}`);
  if (isItem(lines[index].text)) {
    const result = [];
    while (index < lines.length && lines[index].indent === indent && isItem(lines[index].text)) {
      const rest = lines[index].text.slice(2).trim();
      let value;
      if (rest === '') {
        [value, index] = block(lines, index + 1, indent + 2);
      } else if (KEY.test(rest)) {
        // A mapping that starts on the dash line: read it as if the dash were two spaces.
        lines[index] = { ...lines[index], indent: indent + 2, text: rest };
        [value, index] = block(lines, index, indent + 2);
      } else {
        value = scalar(rest);
        index += 1;
      }
      result.push(value);
    }
    return [result, index];
  }
  const result = {};
  while (index < lines.length && lines[index].indent === indent && !lines[index].text.startsWith('- ')) {
    const { number, text } = lines[index];
    const match = KEY.exec(text);
    if (match === null) throw new Error(`line ${number}: not a key: ${text}`);
    const key = keyOf(match[1]);
    if (Object.hasOwn(result, key)) throw new Error(`line ${number}: the key ${key} again`);
    const rest = match[2];
    if (rest === undefined || rest.trim() === '') {
      const next = lines[index + 1];
      if (next !== undefined && next.indent > indent) {
        [result[key], index] = block(lines, index + 1, next.indent);
      } else if (next !== undefined && next.indent === indent && next.text.startsWith('- ')) {
        [result[key], index] = block(lines, index + 1, indent);
      } else {
        throw new Error(`line ${number}: a key without a value`);
      }
    } else {
      result[key] = scalar(rest);
      index += 1;
    }
  }
  return [result, index];
}
