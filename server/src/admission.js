// Admission: who may send each operation's requests, by the operation's family in the contract (rule 1, SPEC-048,
// SPEC-049).
//
// An owner operation admits only the gate's sign-in of the one owner, and a write of the owner's only from NEXUS's own
// pages. An agent operation admits only a live agent credential, sent as one complete NEXUS or legacy header pair (see
// credentials.js). Each check records on the request's log entry what rule 8 asks of a refusal: the sender, "unknown"
// until a check names it, never a name the request gives, and the check that failed.

import { checkCredential, isLive, markUsed } from './credentials.js';
import { GateKeysError, SignInError } from './gate.js';
import { rayOf } from './log.js';
import { Problem } from './problem.js';

// The operations of api/openapi.yaml by their x-corthex family. test/admission.test.js checks both lists against the
// contract.
export const OWNER_ACTIONS = Object.freeze([
  'acceptProposal', 'addNote', 'addToolLink', 'cancelConfirmation', 'cancelDirectEdit', 'changeNote', 'closeThread',
  'confirmDiagram', 'confirmStep', 'connectNotes', 'deleteProject', 'getDiagram', 'getMockupPage', 'getOwnerTodo',
  'getProject', 'getRemovalPreview', 'getThread', 'getWorkshop', 'importMiroBoard', 'issueCredential',
  'listCredentials', 'listProjects', 'makeDirectEdit', 'moveElement', 'openWorkshop', 'rejectProposal', 'removeNote',
  'removeNoteLink', 'removeToolLink', 'replyInThread', 'revokeCredential', 'startThread',
]);
export const AGENT_ACTIONS = Object.freeze([
  'claimEntry', 'draftWorkshopStep', 'getAgentTodo', 'getCheckpoint', 'getComment', 'getEdit', 'getHeldCommit',
  'getProjectData', 'getProposal', 'leaveComment', 'makeProposal', 'markAnswered', 'pushSnapshot', 'recordDecision',
  'releaseEntry', 'replyToComment', 'reportCheckpoint', 'reportEdit', 'reportStepWritten', 'withdrawProposal',
]);

const FAMILIES = new Map([
  ...OWNER_ACTIONS.map((action) => [action, 'owner']),
  ...AGENT_ACTIONS.map((action) => [action, 'agent']),
]);
const WRITES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// The family of a route: the contract's for its action. A route whose action the contract does not name, which only
// a test makes, says family: 'none' to be admitted without a check; any other route is refused when the server is
// made, so no operation goes unchecked because its family was left out.
export function familyOf(route) {
  const family = FAMILIES.get(route.action);
  if (family !== undefined) {
    if (route.family !== undefined && route.family !== family) throw new Error(`${route.action} is an ${family} operation`);
    return family;
  }
  if (route.family === 'none') return 'none';
  throw new Error(`${route.action} is no operation of the contract`);
}

// What admission found: the caller a request key belongs to (TBL-169's actor), 'owner' or the credential's ID; the
// agent credential { id, key, name }, or null; and recheck(), or null, which a write calls in its transaction to
// refuse itself when its credential was revoked while it waited (rule 4).
const NONE = Object.freeze({ caller: null, credential: null, recheck: null });
const OWNER = Object.freeze({ caller: 'owner', credential: null, recheck: null });

// admit(family, request, entry) resolves to what admission found when the request may reach its handler, and otherwise
// throws the Problem that refuses it, or the error that kept it from being checked. gate is gate.js's, which owner
// operations need; store is the store that holds the agent credentials, which agent operations need. queue runs a
// store write after the writes before it (see writes.js), and now() is the time in milliseconds.
export function createAdmission({ gate = null, store = null, queue = runSoon, now = Date.now } = {}) {
  return async function admit(family, request, entry) {
    if (family === 'owner') return admitOwner({ gate, store }, request, entry);
    if (family === 'agent') return admitAgent({ gate, store, queue, now }, request, entry);
    if (family !== 'none') throw new TypeError(`no admission for ${family}`);
    return NONE;
  };
}

async function admitOwner({ gate, store }, request, entry) {
  let claims;
  try {
    claims = await gate.signIn(request.headers);
  } catch (error) {
    if (error instanceof SignInError) {
      entry.reason = error.reason;
      // A live agent credential on an owner operation is not allowed (rule 1): owner_only, sent by the credential.
      const { credential } = store === null ? {} : checkCredential(store, request.headers);
      if (credential !== undefined) {
        entry.sender = credential.name;
        throw new Problem('owner_only', 'an agent credential cannot do this; the owner does it in NEXUS');
      }
      throw new Problem('unauthenticated', 'this request carries no valid sign-in');
    }
    // The keys could not be read: an internal fault, whose kind the log names.
    if (error instanceof GateKeysError) entry.reason = 'keys_unavailable';
    throw error;
  }
  // A sign-in of someone else keeps the sender "unknown": rule 8 names only the owner and credentials.
  if (!gate.isOwner(claims)) throw new Problem('not_owner', 'this sign-in is not the owner\'s');
  entry.sender = 'owner';
  // Only the gate signs the owner's sign-in, so the gate sent this request and its CF-Ray is the gate's. Another
  // person's sign-in is a bearer token the gate signed too, but its holder is not trusted to choose a trace ID.
  entry.traceId = rayOf(request.headers) ?? entry.traceId;
  // A browser says where a request comes from; a write of the owner's comes only from NEXUS's own pages.
  const site = request.headers['sec-fetch-site'];
  if (WRITES.has(request.method) && site !== undefined && site !== 'same-origin' && site !== 'none') {
    throw new Problem('cross_site', 'a request from another site cannot change NEXUS');
  }
  return OWNER;
}

// An agent operation admits a live credential, which then sends the request: the log names it, and a request key
// belongs to its ID. Without one, the owner's sign-in gets agent_only, since the owner does this on the page; anything
// else gets access_missing, whatever was wrong, and the log keeps the reason.
async function admitAgent({ gate, store, queue, now }, request, entry) {
  const { credential, reason } = store === null ? { reason: 'no_credential' } : checkCredential(store, request.headers);
  if (credential === undefined) {
    entry.reason = reason;
    if (await isOwnerSignIn(gate, request)) {
      entry.sender = 'owner';
      entry.traceId = rayOf(request.headers) ?? entry.traceId;
      throw new Problem('agent_only', 'this path takes an agent credential; the owner uses the page');
    }
    throw accessMissing();
  }
  entry.sender = credential.name;
  // A credential is a bearer secret, as the owner's sign-in is, so its holder's CF-Ray is taken as the owner's is.
  entry.traceId = rayOf(request.headers) ?? entry.traceId;
  // last_used_at is written after the writes already waiting, never inside one of their transactions. A write that
  // fails here, such as on a full disk, leaves the time as it was and refuses nothing.
  queue(() => markUsed(store, credential.key, now)).catch(() => {});
  return Object.freeze({
    caller: credential.id,
    credential,
    recheck() {
      if (isLive(store, credential.key)) return;
      entry.sender = 'unknown';
      entry.reason = 'revoked';
      throw accessMissing();
    },
  });
}

// Whether the request carries the owner's valid sign-in. A sign-in only chooses the refusal of an agent request, so one
// that cannot be checked, as when the gate's keys cannot be read, counts as none.
async function isOwnerSignIn(gate, request) {
  if (gate === null || request.headers['cf-access-jwt-assertion'] === undefined) return false;
  try {
    return gate.isOwner(await gate.signIn(request.headers));
  } catch (error) {
    if (error instanceof SignInError || error instanceof GateKeysError) return false;
    throw error;
  }
}

// Without the server's queue, a store write runs once the current work has ended.
function runSoon(task) {
  return Promise.resolve().then(task);
}

function accessMissing() {
  return new Problem('access_missing', 'this request carries no valid agent credential');
}
