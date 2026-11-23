// Admission: who may send each operation's requests, by the operation's family in the contract (rule 1, SPEC-048).
//
// An owner operation admits only the gate's sign-in of the one owner, and a write of the owner's only from NEXUS's own
// pages. Each check records on the request's log entry what rule 8 asks of a refusal: the sender, "unknown" until a
// check names it, never a name the request gives, and for a sign-in that is not admitted the check it failed.

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

// admit(family, request, entry) resolves when the request may reach its handler, and otherwise throws the Problem
// that refuses it, or the error that kept it from being checked. gate is gate.js's, which owner operations need.
export function createAdmission(gate) {
  return async function admit(family, request, entry) {
    if (family === 'owner') return admitOwner(gate, request, entry);
    if (family === 'agent') return admitAgent();
    if (family !== 'none') throw new TypeError(`no admission for ${family}`);
  };
}

async function admitOwner(gate, request, entry) {
  let claims;
  try {
    claims = await gate.signIn(request.headers);
  } catch (error) {
    if (error instanceof SignInError) {
      entry.reason = error.reason;
      // TASK-417: an agent credential, the CF-Access-Client-Id and -Secret pair, on an owner operation gets
      // owner_only here once the pair checks, with the credential's name as the sender (rule 1). Until then it is a
      // request without the owner's sign-in.
      throw new Problem('unauthenticated', 'this request carries no valid sign-in');
    }
    // The keys could not be read: an internal fault, whose kind the log names.
    if (error instanceof GateKeysError) entry.reason = 'keys_unavailable';
    throw error;
  }
  // A sign-in of someone else keeps the sender "unknown": rule 8 names only the owner and credentials.
  if (!gate.isOwner(claims)) throw new Problem('not_owner', 'this sign-in is not the owner\'s');
  entry.sender = 'owner';
  // Only the gate signs the owner's sign-in, so the gate sent this request and its CF-Ray is the gate's.
  entry.traceId = rayOf(request.headers) ?? entry.traceId;
  // A browser says where a request comes from; a write of the owner's comes only from NEXUS's own pages.
  const site = request.headers['sec-fetch-site'];
  if (WRITES.has(request.method) && site !== undefined && site !== 'same-origin' && site !== 'none') {
    throw new Problem('cross_site', 'a request from another site cannot change NEXUS');
  }
}

// TASK-417 checks the agent credential here, the CF-Access-Client-Id and -Secret pair, against its digest, names the
// credential as the sender, and refuses the owner's sign-in on an agent operation with agent_only. Until then no agent
// request is admitted.
async function admitAgent() {
  throw new Problem('access_missing', 'this request carries no valid agent credential');
}
