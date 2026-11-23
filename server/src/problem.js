// Problem answers (RFC 9457) in the shape of components.schemas.Problem of api/openapi.yaml, and the error registry
// of components.x-corthex.errors.
//
// Each code has its status, the title the contract's examples give it, the members its answer carries beside the
// five every Problem has, the detail it has when the refusal gives none, and the registry's message and message_ko.
// The answer is the contract's Problem and nothing more: its schema allows no other member, so the two messages are
// not sent with it. They stay here, on each Problem and in ERRORS, for the pages to show a refusal in Korean with
// what to do next by its code (rule 7); TASK-454, the app shell, serves them. test/problem.test.js checks every entry
// against the contract.

// The commands of the pinned hub that NEXUS takes (SPEC-014), which a missing path under /api/spaces names.
export const AGENT_COMMANDS = Object.freeze(['push', 'todo', 'claim', 'comment', 'decide', 'reflect', 'status', 'record']);

const ENTRIES = {
  access_missing: {
    status: 401,
    title: 'No valid agent credential',
    detail: 'this request carries no valid agent credential',
    message: 'Set a valid agent credential and send again.',
    message_ko: '유효한 에이전트 자격 증명을 설정하고 다시 보내세요.',
  },
  agent_only: {
    status: 403,
    title: 'This is an agent command',
    detail: 'this path takes an agent credential; the owner uses the page',
    message: 'This is an agent command. Do it on the page instead.',
    message_ko: '에이전트 명령이에요. 화면에서 직접 하세요.',
  },
  body_too_large: {
    status: 413,
    title: 'The request is too large',
    members: ['limit'],
    message: 'Send less at once.',
    message_ko: '한 번에 보내는 양을 줄이세요.',
  },
  change_set_not_found: {
    status: 404,
    title: 'No such change set',
    detail: 'no change set has this ID in the project',
    message: 'This change is no longer in NEXUS.',
    message_ko: 'NEXUS에 더 이상 없는 변경이에요.',
  },
  change_set_state: {
    status: 409,
    title: 'The change cannot do that now',
    members: ['state'],
    message: 'This change has already been decided.',
    message_ko: '이미 결정된 변경이에요.',
  },
  checkpoint_not_found: {
    status: 404,
    title: 'No such checkpoint',
    detail: 'no confirmation has this ID in the project',
    message: 'This confirmation is not in NEXUS.',
    message_ko: 'NEXUS에 없는 확정이에요.',
  },
  claimed: {
    status: 409,
    title: 'Another session holds this',
    members: ['session', 'last_write_at', 'ends_at'],
    detail: 'another session claims this entry',
    message: 'Another session is working on this.',
    message_ko: '다른 세션이 작업 중이에요.',
  },
  comment_not_found: {
    status: 404,
    title: 'No such comment',
    detail: 'no comment has this ID in the project',
    message: 'This comment is not in NEXUS.',
    message_ko: 'NEXUS에 없는 댓글이에요.',
  },
  commit_not_replaced: {
    status: 409,
    title: 'The commit does not follow the held one',
    members: ['held_commit'],
    detail: 'the snapshot does not replace the held commit',
    message: 'Push a commit that follows the held one.',
    message_ko: '보관된 커밋 뒤의 커밋을 보내세요.',
  },
  confirmation_cancelled: {
    status: 409,
    title: 'The confirmation was cancelled',
    detail: 'the owner cancelled the confirmation; record the cancel',
    message: 'The owner cancelled this confirmation.',
    message_ko: '소유자가 이 확정을 취소했어요.',
  },
  confirmation_not_found: {
    status: 404,
    title: 'No such confirmation',
    detail: 'no confirmation has this ID in the project',
    message: 'This confirmation is no longer in NEXUS.',
    message_ko: 'NEXUS에 더 이상 없는 확정이에요.',
  },
  credential_not_found: {
    status: 404,
    title: 'No such credential',
    detail: 'no credential has this ID',
    message: 'This credential is not in NEXUS.',
    message_ko: 'NEXUS에 없는 자격 증명이에요.',
  },
  cross_site: {
    status: 403,
    title: 'A request from another site',
    detail: 'a request from another site cannot change NEXUS',
    message: 'This change has to come from NEXUS itself.',
    message_ko: '이 변경은 NEXUS 화면에서만 할 수 있어요.',
  },
  diagram_ambiguous: {
    status: 409,
    title: 'Name the diagram',
    members: ['diagrams'],
    detail: 'more than one diagram of the stage holds the item; name the diagram',
    message: 'Name the diagram.',
    message_ko: '그림을 하나 골라 주세요.',
  },
  diagram_not_found: {
    status: 404,
    title: 'No such diagram',
    detail: 'no diagram has this ID in the project',
    message: 'This diagram is not in NEXUS.',
    message_ko: 'NEXUS에 없는 다이어그램이에요.',
  },
  discrepancy_not_found: {
    status: 404,
    title: 'No such discrepancy',
    detail: 'NEXUS v3 has no discrepancies',
    message: 'NEXUS opens no discrepancies.',
    message_ko: 'NEXUS는 차이를 열지 않아요.',
  },
  document_changed: {
    status: 409,
    title: 'The document changed',
    members: ['drawing', 'version'],
    detail: 'the document changed since that version',
    message: 'The document changed. Look at the new version.',
    message_ko: '문서가 바뀌었어요. 새 버전을 보세요.',
  },
  drawing_not_found: {
    status: 404,
    title: 'No such drawing',
    detail: "the drawing is not one of this diagram's",
    message: 'Reload the page.',
    message_ko: '페이지를 다시 여세요.',
  },
  edit_not_found: {
    status: 404,
    title: 'No such reflection',
    detail: 'no reflection has this ID in the project',
    message: 'This reflection is not in NEXUS.',
    message_ko: 'NEXUS에 없는 반영 항목이에요.',
  },
  element_not_found: {
    status: 404,
    title: 'No such element',
    members: ['element'],
    detail: 'the element is not in the diagram',
    message: 'This element is no longer in the diagram.',
    message_ko: '다이어그램에 더 이상 없는 요소예요.',
  },
  entry_closed: {
    status: 409,
    title: 'Nothing to claim',
    detail: 'the entry is not open in the agent to-do',
    message: 'This to-do is no longer open.',
    message_ko: '더 이상 열려 있지 않은 할 일이에요.',
  },
  entry_not_found: {
    status: 404,
    title: 'No such entry',
    detail: 'no to-do entry has this ID in the project',
    message: 'This to-do entry is not in NEXUS.',
    message_ko: 'NEXUS에 없는 할 일이에요.',
  },
  internal: {
    status: 500,
    title: 'Something went wrong',
    detail: 'an unexpected error; the trace ID names it',
    message: 'Something went wrong. Try again.',
    message_ko: '문제가 생겼어요. 다시 해 보세요.',
  },
  invalid_request: {
    status: 400,
    title: 'The request is not valid',
    members: ['field'],
    message: 'Check the marked field.',
    message_ko: '표시한 입력을 확인하세요.',
  },
  invalid_snapshot: {
    status: 400,
    title: 'The snapshot is not valid',
    members: ['field'],
    message: 'Fix the snapshot and push again.',
    message_ko: '스냅숏을 고친 뒤 다시 보내세요.',
  },
  item_not_found: {
    status: 404,
    title: 'No such item',
    members: ['items'],
    detail: "the stage's drawing does not hold these items",
    message: 'These items are not in the stage.',
    message_ko: '단계에 없는 항목이에요.',
  },
  json_required: {
    status: 415,
    title: 'Send JSON',
    detail: 'send the body as application/json',
    message: 'Send the body as JSON.',
    message_ko: '본문을 JSON으로 보내세요.',
  },
  method_not_allowed: {
    status: 405,
    title: 'This address does not take that method',
    message: 'This address does not take that request.',
    message_ko: '이 주소는 그 요청을 받지 않아요.',
  },
  name_taken: {
    status: 409,
    title: 'The name is in use',
    detail: 'another credential has this name',
    message: 'Choose another name.',
    message_ko: '다른 이름을 고르세요.',
  },
  not_drawn: {
    status: 409,
    title: 'Nothing drawn yet',
    detail: 'the stage has no drawn picture; comment instead',
    message: 'Fix the document so that it draws, then confirm.',
    message_ko: '문서를 고쳐 그려지게 한 뒤 확정하세요.',
  },
  not_found: {
    status: 404,
    title: 'No such address',
    message: 'This address does not exist.',
    message_ko: '없는 주소예요.',
  },
  not_owner: {
    status: 403,
    title: 'Only the owner can open NEXUS',
    detail: "this sign-in is not the owner's",
    message: 'Only the owner of this NEXUS can open it.',
    message_ko: '이 NEXUS의 소유자만 열 수 있어요.',
  },
  note_link_not_found: {
    status: 404,
    title: 'No such link',
    detail: 'no link has this ID on the board',
    message: 'This link is no longer on the board.',
    message_ko: '보드에 더 이상 없는 연결이에요.',
  },
  note_made_by_owner: {
    status: 409,
    title: 'A person made this note',
    detail: 'a person made this note',
    message: 'The agent cannot remove a note a person made.',
    message_ko: '사람이 만든 스티커는 에이전트가 지울 수 없어요.',
  },
  note_not_found: {
    status: 404,
    title: 'No such sticky note',
    detail: 'no sticky note has this ID on the board',
    message: 'This sticky note is no longer on the board.',
    message_ko: '보드에 더 이상 없는 스티커예요.',
  },
  older_snapshot: {
    status: 409,
    title: 'NEXUS held this commit before',
    members: ['revision'],
    detail: 'NEXUS held this commit at an earlier revision',
    message: 'Push the current commit.',
    message_ko: '현재 커밋을 보내세요.',
  },
  owner_only: {
    status: 403,
    title: 'Only the owner can do this',
    detail: 'an agent credential cannot do this; the owner does it in NEXUS',
    message: 'Only the owner can do this, in NEXUS.',
    message_ko: '소유자만 NEXUS에서 할 수 있는 일이에요.',
  },
  part_not_found: {
    status: 404,
    title: 'No such part',
    detail: 'the project has no such part',
    message: 'This part is not in the project.',
    message_ko: '프로젝트에 없는 부분이에요.',
  },
  project_not_found: {
    status: 404,
    title: 'No such project',
    detail: 'no project space has this name',
    message: 'This project is not in NEXUS.',
    message_ko: 'NEXUS에 없는 프로젝트예요.',
  },
  proposal_not_found: {
    status: 404,
    title: 'No such proposal',
    detail: 'no proposal has this ID in the project',
    message: 'This proposal is not in NEXUS.',
    message_ko: 'NEXUS에 없는 제안이에요.',
  },
  pull_request_mismatch: {
    status: 409,
    title: 'Another pull request',
    members: ['pull_request'],
    detail: 'the entry is linked to another pull request',
    message: 'This work is in another pull request.',
    message_ko: '다른 풀 리퀘스트에 들어간 작업이에요.',
  },
  pull_request_needed: {
    status: 409,
    title: 'No pull request',
    detail: 'report the pull request before reflected',
    message: 'Report the pull request first.',
    message_ko: '풀 리퀘스트를 먼저 보고하세요.',
  },
  repository_mismatch: {
    status: 409,
    title: 'Another repository',
    detail: "this is another repository than the project's",
    message: "Use the project's own repository.",
    message_ko: '프로젝트의 저장소를 쓰세요.',
  },
  request_key_reused: {
    status: 409,
    title: 'The request key was used for another action',
    detail: 'this request key was used for another action',
    message: 'Send it again as a new request.',
    message_ko: '새 요청으로 다시 보내세요.',
  },
  snapshot_too_large: {
    status: 413,
    title: 'The snapshot is too large',
    members: ['limit'],
    message: 'Send a smaller snapshot.',
    message_ko: '더 작은 스냅숏을 보내세요.',
  },
  space_not_found: {
    status: 404,
    title: 'No such project space',
    detail: 'no project space has this name',
    message: 'This project is not in NEXUS yet.',
    message_ko: '아직 NEXUS에 없는 프로젝트예요.',
  },
  step_confirmed: {
    status: 409,
    title: 'The step is confirmed',
    detail: 'the step is confirmed',
    message: 'This step is already confirmed.',
    message_ko: '이미 확정된 단계예요.',
  },
  step_empty: {
    status: 409,
    title: 'The step is empty',
    detail: 'the step has no notes',
    message: 'Add notes before confirming.',
    message_ko: '확정하기 전에 스티커를 붙이세요.',
  },
  step_not_found: {
    status: 404,
    title: 'No such step',
    detail: 'no such step',
    message: 'This step does not exist.',
    message_ko: '없는 단계예요.',
  },
  steps_open: {
    status: 409,
    title: 'Steps are not confirmed',
    members: ['steps'],
    detail: 'these steps are not confirmed',
    message: 'Confirm these steps first.',
    message_ko: '이 단계들을 먼저 확정하세요.',
  },
  text_too_long: {
    status: 400,
    title: 'The text is too long',
    members: ['field', 'limit'],
    message: 'Shorten the text to the limit.',
    message_ko: '글자 수 제한까지 줄여 주세요.',
  },
  thread_closed: {
    status: 409,
    title: 'The thread is closed',
    detail: 'the thread is closed; start a new comment',
    message: 'This thread is closed. Start a new comment.',
    message_ko: '닫힌 스레드예요. 새 댓글을 쓰세요.',
  },
  thread_not_found: {
    status: 404,
    title: 'No such thread',
    detail: 'no thread has this ID in the project',
    message: 'This thread is no longer in NEXUS.',
    message_ko: 'NEXUS에 더 이상 없는 댓글 스레드예요.',
  },
  tool_link_not_found: {
    status: 404,
    title: 'No such tool link',
    detail: 'no tool link has this ID in the project',
    message: 'This link is not in NEXUS.',
    message_ko: 'NEXUS에 없는 링크예요.',
  },
  unauthenticated: {
    status: 401,
    title: 'Sign in to NEXUS',
    detail: 'this request carries no valid sign-in',
    message: 'Sign in again.',
    message_ko: '다시 로그인하세요.',
  },
  unsupported_format: {
    status: 400,
    title: 'This snapshot format is not known',
    members: ['versions'],
    message: 'Use a hub that sends a format NEXUS knows.',
    message_ko: 'NEXUS가 아는 형식을 보내는 hub를 쓰세요.',
  },
  waiting_reflection: {
    status: 409,
    title: 'Changes wait for reflection',
    members: ['change_sets'],
    detail: 'accepted change sets wait for reflection',
    message: 'Reflect or cancel the waiting changes first.',
    message_ko: '반영을 기다리는 변경을 먼저 반영하거나 취소하세요.',
  },
  workshop_closed: {
    status: 409,
    title: 'No open workshop',
    detail: 'the project has no open workshop',
    message: 'The workshop is closed.',
    message_ko: '워크숍이 닫혀 있어요.',
  },
  workshop_not_found: {
    status: 404,
    title: 'No workshop',
    detail: 'the project has no workshop',
    message: 'This project has no workshop.',
    message_ko: '이 프로젝트에는 워크숍이 없어요.',
  },
  workshop_open: {
    status: 409,
    title: 'A workshop is open',
    members: ['workshop'],
    detail: 'the project has an open workshop',
    message: 'A workshop is already open.',
    message_ko: '이미 열린 워크숍이 있어요.',
  },
};

// The registry: code → { status, title, members, message, message_ko }, frozen. members lists the members a Problem
// of that code carries beside title, status, detail, code and traceId.
export const ERRORS = Object.freeze(Object.fromEntries(Object.entries(ENTRIES).map(([code, entry]) => [
  code,
  Object.freeze({
    status: entry.status,
    title: entry.title,
    members: Object.freeze([...(entry.members ?? [])]),
    message: entry.message,
    message_ko: entry.message_ko,
  }),
])));

export const PROBLEM_CODES = Object.freeze(Object.keys(ERRORS));

export class Problem extends Error {
  // detail is text the server writes, never a value of the request (rule 5); without it the code's own detail is
  // used. headers go out with the answer. members are exactly the members the code carries, such as { limit }.
  constructor(code, detail, headers = {}, members = {}) {
    const entry = Object.hasOwn(ENTRIES, code) ? ENTRIES[code] : undefined;
    if (entry === undefined) throw new TypeError(`no Problem entry for ${code}`);
    const text = detail ?? entry.detail;
    if (typeof text !== 'string' || text === '') throw new TypeError(`a ${code} Problem needs its detail`);
    const names = entry.members ?? [];
    for (const name of names) {
      if (members[name] === undefined) throw new TypeError(`a ${code} Problem needs ${name}`);
    }
    for (const name of Object.keys(members)) {
      if (!names.includes(name)) throw new TypeError(`a ${code} Problem has no ${name}`);
    }
    super(entry.message);
    this.name = 'Problem';
    this.code = code;
    this.status = entry.status;
    this.title = entry.title;
    this.detail = text;
    this.headers = headers;
    this.members = Object.freeze({ ...members });
    // The registry's messages for the pages (rule 7); message is Error's own.
    this.messageKo = entry.message_ko;
  }

  // The answer's body: the five members every Problem has, then the code's own, in the contract's order.
  body(traceId) {
    return { title: this.title, status: this.status, detail: this.detail, code: this.code, traceId, ...this.members };
  }
}

// A path that is no operation. The detail never repeats the path the request gave.
export function notFound(pathname) {
  if (pathname === '/api/spaces' || pathname?.startsWith('/api/spaces/')) {
    return new Problem('not_found', `no agent command has this address; NEXUS takes ${listed(AGENT_COMMANDS)}`);
  }
  return new Problem('not_found', 'no operation has this address');
}

export function methodNotAllowed(allow) {
  return new Problem('method_not_allowed', `this address takes ${listed(allow)}`, { Allow: allow.join(', ') });
}

export function internal() {
  return new Problem('internal');
}

// A request that breaks the contract: field names the header, the body or the body's field, never its value.
export function invalidRequest(field, detail, code = 'invalid_request') {
  return new Problem(code, detail, {}, { field });
}

// A body over its limit in bytes: snapshot_too_large for a snapshot, body_too_large for any other.
export function tooLarge(code, limit) {
  const what = code === 'snapshot_too_large' ? 'snapshot' : 'body';
  return new Problem(code, `the ${what} is over ${limit} bytes`, {}, { limit });
}

function listed(words) {
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
