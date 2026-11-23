// The snapshot formats NEXUS takes, corthex-hub/0.2 and corthex-hub/0.3 (API-242, SPEC-014), their rules, and the
// documents NEXUS keeps of a snapshot (TBL-149, TBL-150; TASK-418).
//
// readSnapshot(body) checks a snapshot against components.schemas.Snapshot of api/openapi.yaml, the rules of its
// format included, and against the few rules NEXUS adds to keep it: a format NEXUS does not know gets
// unsupported_format, naming the formats it takes, and a broken rule gets invalid_snapshot, whose field names where.
// No refusal repeats a value of the snapshot (rule 5). test/snapshots.test.js checks each rule against the contract's
// schema.
//
// The documents of a snapshot are what NEXUS keeps of it, each once by its SHA-256 (TBL-149) under a name in the
// snapshot (TBL-150's path):
// - a picture source of stage 03, 08 or 09 (corthex-hub/0.3): the whole text of its file, named by its key, the file's
//   path in the repository;
// - a picture source of stage 01, 05 or 07: the hub's parsed picture as JSON, named /pictures/<stage> or, for a part,
//   /pictures/<stage>/<part>;
// - each stage's items: the snapshot's items of that stage as a JSON array, named /items/<stage>, kept for each stage
//   with items and each stage whose record says the hub read it, an empty list for one with none, which draws an empty
//   item table (SPEC-005; see drawing.js);
// - the rest of the snapshot as JSON, named /snapshot, with no stage: every other field as it came, less what the
//   documents above hold: its pictures without their sources, a file's picture keeping the other members of its
//   source, and its items without those of a stage. The Snapshot schema lists only the fields NEXUS reads and says
//   NEXUS keeps the others as they come; the project's title and parts are among them.
// A key is a path in the repository, which never starts with /, so the names NEXUS gives never meet a key.
//
// REQ-077: a document whose text looks like a secret or an email address (see sensitive.js) is left out and named in
// the answer's refused, with where it is from: its key, or the stage's source as the snapshot's stage record names it.
// Every text of the hub's snapshot passed the hub's own redaction of the same patterns, so the rest of a snapshot holds
// none; a rest that holds one did not come from the hub's format and is refused as invalid_snapshot, since it cannot be
// named by a stage in refused and keeping it would keep the text.

import { invalidRequest, Problem } from './problem.js';
import { sensitiveText, sensitiveValue } from './sensitive.js';

// The formats, oldest first, with the picture stages each carries.
const CARRIED = Object.freeze({
  'corthex-hub/0.2': Object.freeze(['01-domain', '05-erd', '07-sitemap']),
  'corthex-hub/0.3': Object.freeze(['01-domain', '03-user-flow', '05-erd', '07-sitemap', '08-screen-states', '09-mockup']),
});
export const FORMATS = Object.freeze(Object.keys(CARRIED));

export const STAGES = Object.freeze([
  '01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states',
  '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation',
]);
const STAGE_SET = new Set(STAGES);
// The contract's PictureStage, and the stages whose pictures are one per file, each with its key and its file's text.
const PICTURE_STAGES = new Set(CARRIED['corthex-hub/0.3']);
const KEYED_STAGES = new Set(['03-user-flow', '08-screen-states', '09-mockup']);

// The Snapshot schema's required fields, and its other fields, in its order.
const REQUIRED = ['schema', 'generator', 'generated_at', 'project', 'repos', 'stages', 'items', 'checks', 'pictures'];
const LISTED = new Set([...REQUIRED, 'ids', 'summary', 'truncated', 'records', 'ask_before', 'left_out', 'replaces']);

// The contract's forms: ProjectName, Part, Commit and Link, and the Snapshot's generator.
const PROJECT_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PART = /^(?:[a-z0-9]+(?:-[a-z0-9]+)*)?$/;
const COMMIT = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;
const LINK = /^https:\/\/\S+$/;
const GENERATOR = /^corthex-nexus [0-9]+\.[0-9]+\.[0-9]+$/;
const CONTROL = /[\u0000-\u001f\u007f]/;

// How deep a snapshot's JSON may nest. The hub's nests about 8 levels; JSON.stringify, which writes the kept documents,
// runs out of stack on a value thousands of levels deep.
const MAX_DEPTH = 100;

// Where the snapshot's commit is, as the pinned hub sends it.
const COMMIT_FIELD = 'repos["."].default.commit';

const invalid = (field, detail) => invalidRequest(field, detail, 'invalid_snapshot');
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// The number of characters (Unicode code points) of a text, as JSON Schema's maxLength counts them.
function characters(text) {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length) {
      const next = text.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) index += 1;
    }
    count += 1;
  }
  return count;
}

// Checks a text field: its type, its length in characters and its form. what says what it must be, for the detail.
function checkText(value, field, { min = 0, max, form, what }) {
  if (typeof value !== 'string') throw invalid(field, `${field} must be text`);
  // A text no longer than max in UTF-16 units is no longer in characters either.
  const length = value.length <= max && value.length >= min ? value.length : characters(value);
  if (length < min || length > max) {
    throw invalid(field, min > 0 ? `${field} must be ${min} to ${max} characters` : `${field} must be at most ${max} characters`);
  }
  if (form !== undefined && !form.test(value)) throw invalid(field, `${field} must be ${what}`);
}

function checkObject(value, field) {
  if (!isObject(value)) throw invalid(field, `${field} must be an object`);
}

function checkArray(value, field, max, { min = 0, objects = false } = {}) {
  if (!Array.isArray(value)) throw invalid(field, `${field} must be a list`);
  if (value.length < min || value.length > max) {
    throw invalid(field, min > 0 ? `${field} must hold ${min} to ${max} entries` : `${field} must hold at most ${max} entries`);
  }
  if (objects) value.forEach((item, index) => checkObject(item, `${field}[${index}]`));
}

// A text the store keeps as it came: Unicode text, with no lone surrogate, which UTF-8 cannot hold.
function checkUnicode(value, field) {
  if (!value.isWellFormed()) throw invalid(field, `${field} must be Unicode text`);
}

// A path in the repository as Git lists it: names joined by /, none of them empty, . or .., with no backslash and no
// control character. So it never starts with /, as the names NEXUS gives its own documents do.
function checkRepositoryPath(value, field) {
  if (CONTROL.test(value) || value.includes('\\') || value.split('/').some((name) => name === '' || name === '.' || name === '..')) {
    throw invalid(field, `${field} must be a path in the repository`);
  }
}

// The member of the snapshot nested deeper than MAX_DEPTH, or null.
function tooDeep(body) {
  for (const [name, value] of Object.entries(body)) {
    const waiting = [[value, 2]];
    while (waiting.length > 0) {
      const [next, depth] = waiting.pop();
      if (typeof next !== 'object' || next === null) continue;
      if (depth > MAX_DEPTH) return name;
      for (const item of Array.isArray(next) ? next : Object.values(next)) waiting.push([item, depth + 1]);
    }
  }
  return null;
}

// The field a refusal names for a member of the snapshot: its name when the schema lists it, otherwise the body, so
// that a name the request gives is never repeated.
const memberField = (name) => (LISTED.has(name) ? name : 'body');

// Checks the Snapshot schema's rules, its format's included, in the schema's order.
function checkSchema(body, format) {
  for (const name of REQUIRED) if (!Object.hasOwn(body, name)) throw invalid(name, `${name} is required`);
  checkText(body.generator, 'generator', { max: 40, form: GENERATOR, what: 'corthex-nexus and a version, such as corthex-nexus 0.5.0' });
  checkText(body.generated_at, 'generated_at', { max: 40 });

  const { project } = body;
  checkObject(project, 'project');
  if (!Object.hasOwn(project, 'name')) throw invalid('project.name', 'project.name is required');
  checkText(project.name, 'project.name', { min: 1, max: 64, form: PROJECT_NAME, what: '1 to 64 lowercase letters, digits and hyphens' });
  if (Object.hasOwn(project, 'title')) checkText(project.title, 'project.title', { max: 120 });
  if (Object.hasOwn(project, 'parts')) {
    checkArray(project.parts, 'project.parts', 50, { min: 1 });
    project.parts.forEach((part, index) => {
      checkText(part, `project.parts[${index}]`, { max: 100, form: PART, what: 'lowercase letters, digits and hyphens' });
    });
    if (new Set(project.parts).size !== project.parts.length) throw invalid('project.parts', 'project.parts must not name a part twice');
  }

  for (const name of ['ids', 'repos', 'stages']) if (Object.hasOwn(body, name)) checkObject(body[name], name);
  checkArray(body.items, 'items', 3000, { objects: true });
  checkArray(body.checks, 'checks', 2001, { objects: true });
  if (Object.hasOwn(body, 'summary')) checkObject(body.summary, 'summary');
  if (Object.hasOwn(body, 'truncated') && typeof body.truncated !== 'boolean') throw invalid('truncated', 'truncated must be true or false');
  for (const name of ['records', 'ask_before']) if (Object.hasOwn(body, name)) checkObject(body[name], name);

  checkArray(body.pictures, 'pictures', 1000);
  body.pictures.forEach((picture, index) => checkPicture(picture, `pictures[${index}]`, format));

  if (Object.hasOwn(body, 'left_out')) checkArray(body.left_out, 'left_out', 1000, { objects: true });
  if (Object.hasOwn(body, 'replaces')) checkText(body.replaces, 'replaces', { max: 64, form: COMMIT, what: 'a commit in lowercase hex' });
}

function checkPicture(picture, at, format) {
  checkObject(picture, at);
  for (const name of ['part', 'stage', 'commit', 'source']) {
    if (!Object.hasOwn(picture, name)) throw invalid(`${at}.${name}`, `${at}.${name} is required`);
  }
  checkText(picture.part, `${at}.part`, { max: 100, form: PART, what: 'a part: lowercase letters, digits and hyphens, or empty' });
  const { stage } = picture;
  if (typeof stage !== 'string' || !PICTURE_STAGES.has(stage)) {
    throw invalid(`${at}.stage`, `${at}.stage must be a stage the hub sends a picture of`);
  }
  // corthex-hub/0.2 carries the pictures of stages 01, 05 and 07 only.
  if (!CARRIED[format].includes(stage)) throw invalid(`${at}.stage`, `${format} carries no picture of this stage`);
  if (Object.hasOwn(picture, 'key')) checkText(picture.key, `${at}.key`, { min: 1, max: 300 });
  checkText(picture.commit, `${at}.commit`, { max: 64, form: COMMIT, what: 'a commit in lowercase hex' });
  checkObject(picture.source, `${at}.source`);
  if (Object.hasOwn(picture.source, 'text')) checkText(picture.source.text, `${at}.source.text`, { max: 1_048_576 });
  // A picture of stage 03, 08 or 09 is one file: its key and its whole text.
  if (KEYED_STAGES.has(stage)) {
    if (!Object.hasOwn(picture, 'key')) throw invalid(`${at}.key`, `a picture of this stage needs key, its file's path`);
    if (!Object.hasOwn(picture.source, 'text')) throw invalid(`${at}.source.text`, `a picture of this stage needs source.text, its file's text`);
  }
}

// The rules NEXUS adds to keep a snapshot: its commit and repository where the pinned hub sends them, pictures of that
// commit and of the project's parts, one picture per part and stage (01, 05, 07) or per file (03, 08, 09), keys that
// are paths in the repository, and texts it keeps as they came. Returns { commit, repository }.
function checkKept(body) {
  const deep = tooDeep(body);
  if (deep !== null) throw invalid(memberField(deep), `the snapshot nests deeper than ${MAX_DEPTH} levels`);
  const own = body.repos['.'];
  checkObject(own, 'repos["."]');
  checkObject(own.default, 'repos["."].default');
  checkText(own.default.commit, COMMIT_FIELD, { max: 64, form: COMMIT, what: 'a commit in lowercase hex' });
  const commit = own.default.commit;
  let repository = null;
  if (Object.hasOwn(own, 'url')) {
    checkText(own.url, 'repos["."].url', { max: 2000, form: LINK, what: 'an https address' });
    checkUnicode(own.url, 'repos["."].url');
    repository = own.url;
  }

  const parts = new Set(['', ...(body.project.parts ?? [])]);
  const keys = new Set();
  const pictures = new Set();
  body.pictures.forEach((picture, index) => {
    const at = `pictures[${index}]`;
    if (!parts.has(picture.part)) throw invalid(`${at}.part`, `${at}.part must be one of project.parts, or empty`);
    if (picture.commit !== commit) throw invalid(`${at}.commit`, `${at}.commit must be the snapshot's commit, ${COMMIT_FIELD}`);
    if (Object.hasOwn(picture, 'key')) {
      checkUnicode(picture.key, `${at}.key`);
      checkRepositoryPath(picture.key, `${at}.key`);
    }
    if (Object.hasOwn(picture.source, 'text')) checkUnicode(picture.source.text, `${at}.source.text`);
    if (KEYED_STAGES.has(picture.stage)) {
      if (keys.has(picture.key)) throw invalid(`${at}.key`, `${at}.key names a file another picture names`);
      keys.add(picture.key);
    } else {
      const pair = `${picture.stage} ${picture.part}`;
      if (pictures.has(pair)) throw invalid(at, `${at} has the part and stage of another picture`);
      pictures.add(pair);
    }
  });
  return { commit, repository };
}

// The rest of the snapshot: every field as it came, its pictures without their sources and its items without those
// of a stage. A picture of stage 03, 08 or 09 keeps the members of its source other than text, which its document
// does not hold. Built as own members, so that a member named __proto__ stays a member.
function restOf(body) {
  return Object.fromEntries(Object.entries(body).map(([name, value]) => {
    if (name === 'items') return [name, value.filter((item) => !STAGE_SET.has(item.stage))];
    if (name === 'pictures') return [name, value.map(restOfPicture)];
    return [name, value];
  }));
}

function restOfPicture({ source, ...picture }) {
  if (!KEYED_STAGES.has(picture.stage)) return picture;
  const { text, ...others } = source;
  return Object.keys(others).length === 0 ? picture : { ...picture, source: others };
}

// Refuses a rest that holds text that looks like a secret or an email address, naming the member that holds it.
function checkRest(rest) {
  for (const [name, value] of Object.entries(rest)) {
    if (sensitiveText(name) !== null) throw invalid('body', 'the snapshot holds text that looks like a secret or an email address');
    if (sensitiveValue(value) !== null) {
      const field = memberField(name);
      throw invalid(field, `${field === 'body' ? 'the snapshot' : field} holds text that looks like a secret or an email address`);
    }
  }
}

// Whether the snapshot's record of a stage says the hub read its source (the hub's read: true).
function wasRead(body, stage) {
  const record = body.stages[stage];
  return isObject(record) && record.read === true;
}

// The stage's source as the snapshot's stage record names it, which a refusal gives as where it is from, or the stage
// itself.
function sourceOf(body, stage) {
  const record = body.stages[stage];
  const source = isObject(record) ? record.source : undefined;
  return typeof source === 'string' && source !== '' && characters(source) <= 300 ? source : stage;
}

// The documents of the snapshot (see the top of this file), each { path, stage, part, key, kind, text, where, why }:
// kind is picture, items or snapshot; text is what the store keeps; where is what a refusal names; why is null, or
// secret or email when it is left out (REQ-077).
function documentsOf(body, rest) {
  const documents = [];
  for (const picture of body.pictures) {
    const { stage, part } = picture;
    if (KEYED_STAGES.has(stage)) {
      const { text } = picture.source;
      documents.push({ path: picture.key, stage, part, key: picture.key, kind: 'picture', text, where: picture.key, why: sensitiveText(text) });
    } else {
      documents.push({
        path: part === '' ? `/pictures/${stage}` : `/pictures/${stage}/${part}`,
        stage,
        part,
        key: null,
        kind: 'picture',
        text: JSON.stringify(picture.source),
        where: sourceOf(body, stage),
        why: sensitiveValue(picture.source),
      });
    }
  }
  for (const stage of STAGES) {
    const items = body.items.filter((item) => item.stage === stage);
    if (items.length === 0 && !wasRead(body, stage)) continue;
    documents.push({
      path: `/items/${stage}`, stage, part: '', key: null, kind: 'items', text: JSON.stringify(items), where: sourceOf(body, stage), why: sensitiveValue(items),
    });
  }
  documents.push({ path: '/snapshot', stage: '', part: '', key: null, kind: 'snapshot', text: JSON.stringify(rest), where: '', why: null });
  return documents;
}

// Reads a snapshot, the parsed body of API-242. Returns { format, carries, project, commit, replaces, repository,
// documents }: its format and the picture stages it carries, the project's name, the commit it is of, the commit it
// replaces or null, the repository's address or null, and its documents. Throws unsupported_format or invalid_snapshot.
export function readSnapshot(body) {
  // The format first: the other rules are the format's.
  if (!Object.hasOwn(body, 'schema')) throw invalid('schema', 'schema is required');
  if (typeof body.schema !== 'string') throw invalid('schema', 'schema must be text');
  const format = body.schema;
  if (!Object.hasOwn(CARRIED, format)) {
    throw new Problem('unsupported_format', `NEXUS takes the snapshot formats ${FORMATS.join(' and ')}`, {}, { versions: [...FORMATS] });
  }
  checkSchema(body, format);
  const { commit, repository } = checkKept(body);
  const rest = restOf(body);
  checkRest(rest);
  return {
    format,
    carries: CARRIED[format],
    project: body.project.name,
    commit,
    replaces: Object.hasOwn(body, 'replaces') ? body.replaces : null,
    repository,
    documents: documentsOf(body, rest),
  };
}

// Whether format is newer than other, both formats NEXUS takes.
export function isNewer(format, other) {
  return FORMATS.indexOf(format) > FORMATS.indexOf(other);
}

// The picture stages a format carries.
export function carriedBy(format) {
  return CARRIED[format] ?? [];
}
