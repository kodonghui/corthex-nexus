// The operations the server takes: the routes of router.js that main.js serves. Each task that builds operations of
// api/openapi.yaml adds its routes here, and test/tables.test.js checks that each one's tests compare the tables it
// touches with the contract (note 23 of the WBS).

import { CLAIM_ROUTES } from './claims.js';
import { COMMENT_ROUTES } from './comments.js';
import { CONFIRMATION_ROUTES } from './confirmations.js';
import { CREDENTIAL_ROUTES } from './credentials.js';
import { DIAGRAM_ROUTES } from './diagram.js';
import { DIRECT_EDIT_ROUTES } from './direct-edits.js';
import { MOCKUP_PAGE_ROUTES } from './mockup-page.js';
import { OWNER_ROUTES } from './owner.js';
import { POSITION_ROUTES } from './positions.js';
import { PROJECT_ROUTES } from './project.js';
import { PROPOSAL_ANSWER_ROUTES } from './proposal-answers.js';
import { PROPOSAL_ROUTES } from './proposals.js';
import { READ_ROUTES } from './reads.js';
import { REMOVAL_ROUTES } from './removal.js';
import { SNAPSHOT_ROUTES } from './snapshots.js';
import { THREAD_ROUTES } from './threads.js';
import { TODO_ROUTES } from './todo.js';
import { TOOL_LINK_ROUTES } from './tool-links.js';

export const ROUTES = Object.freeze([
  // TASK-417: API-279, API-280 and API-281.
  ...CREDENTIAL_ROUTES,
  // TASK-418: API-242 and API-243.
  ...SNAPSHOT_ROUTES,
  // TASK-433: API-245.
  ...TODO_ROUTES,
  // TASK-440: API-264.
  ...PROJECT_ROUTES,
  // TASK-434: API-250 and API-251.
  ...CLAIM_ROUTES,
  // TASK-439: API-262 and API-263.
  ...OWNER_ROUTES,
  // TASK-437: API-252, API-253, API-254 and API-255.
  ...COMMENT_ROUTES,
  // TASK-448: API-277 and API-278.
  ...REMOVAL_ROUTES,
  // TASK-427: API-293.
  ...MOCKUP_PAGE_ROUTES,
  // TASK-436: API-244, API-246, API-247, API-248 and API-249.
  ...READ_ROUTES,
  // TASK-441: API-265.
  ...DIAGRAM_ROUTES,
  // TASK-438: API-256 and API-257.
  ...PROPOSAL_ROUTES,
  // TASK-443: API-266, API-267, API-268 and API-269.
  ...THREAD_ROUTES,
  // TASK-445: API-272 and API-273.
  ...DIRECT_EDIT_ROUTES,
  // TASK-451: API-282 and API-283.
  ...TOOL_LINK_ROUTES,
  // TASK-446: API-275 and API-276.
  ...CONFIRMATION_ROUTES,
  // TASK-444: API-270 and API-271.
  ...PROPOSAL_ANSWER_ROUTES,
  // TASK-442: API-274.
  ...POSITION_ROUTES,
]);
