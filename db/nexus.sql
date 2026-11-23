-- NEXUS v3 schema: the database of an empty install, stage 05 of the project.
-- Written in SQL that SQLite 3 runs, as D1 does. docs/05-erd/README.md explains the tables,
-- the rules they hold and the choices made here; db/migrations/ rebuilds this schema from an
-- empty database.
--
-- Conventions:
-- - Every table whose rows have their own ID uses an INTEGER key with AUTOINCREMENT, so an ID
--   is never given out twice, even after a project space is deleted.
-- - Times are UTC text in ISO 8601 with milliseconds, such as 2026-11-23T01:30:00.000Z.
-- - The limits of the functional spec (sizes, lengths, the 24 hours of a request key and the
--   60 minutes of a claim) are checked by the code, not by constraints here, so that changing
--   a limit needs no migration. Rules of the domain design that the database can hold are
--   constraints, each named in a comment.
-- - Deleting a project space deletes everything in it and nothing else (SPEC-013): every table
--   of a project reaches project_spaces through ON DELETE CASCADE, and a row that points at
--   another row of the same project or diagram does so through a key that includes the
--   project or the diagram, so it can never point across projects. Agent credentials are never
--   deleted, only revoked, so the rows that name one use ON DELETE RESTRICT.
-- - Each foreign key has an index on its columns, so a delete never reads a whole table.
-- - Each table's terms name the aggregate of the domain design it belongs to, as the stage contract
--   asks, so that NEXUS can compare the tables with the DDD board; a table that belongs to no
--   aggregate says terms: none. Every aggregate has a table; the read models, the screens that
--   read the tables, have none and are listed below.
-- - No table holds an agent credential's secret, a sign-in token or a server path (rule 5).
--   Refused requests are logged in the server's log, not here (rule 8).
--
-- without a table: TERM-222, TERM-223, TERM-224, TERM-225, TERM-226

-- TBL-146 agent_credentials (CTX-043) ← SPEC-049, SPEC-050, SPEC-014 | terms: TERM-221
-- A credential an agent uses to reach NEXUS. Only its digest is kept (REQ-078). Rule: an agent
-- credential can never confirm, so no confirmation row names one.
CREATE TABLE agent_credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE,
  secret_digest TEXT    NOT NULL UNIQUE,
  issued_at     TEXT    NOT NULL,
  revoked_at    TEXT,
  last_used_at  TEXT
);

-- TBL-147 project_spaces (CTX-037) ← SPEC-001, SPEC-002, SPEC-013, SPEC-015, SPEC-024 | terms: TERM-189
-- Everything one project has in NEXUS. Rule: a new snapshot must descend from held_commit
-- (checked by the code against the commits the agent sends); the name is one to 64
-- lowercase letters, digits and hyphens.
CREATE TABLE project_spaces (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  name                   TEXT    NOT NULL UNIQUE
    CHECK (length(name) BETWEEN 1 AND 64 AND name NOT GLOB '*[^a-z0-9-]*'),
  repository             TEXT,
  held_commit            TEXT,
  created_at             TEXT    NOT NULL,
  created_by_credential  INTEGER NOT NULL REFERENCES agent_credentials (id) ON DELETE RESTRICT
);

-- TBL-148 snapshots (CTX-037) ← SPEC-001, SPEC-002, SPEC-014, SPEC-025, SPEC-033 | terms: TERM-189
-- The stage documents of one default-branch commit that an agent sent. Rule: the same commit
-- again is the same revision, so a project holds each commit once.
CREATE TABLE snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id       INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  revision         INTEGER NOT NULL CHECK (revision >= 1),
  commit_sha       TEXT    NOT NULL,
  replaced_commit  TEXT,
  format_version   TEXT    NOT NULL,
  bytes            INTEGER NOT NULL CHECK (bytes >= 0),
  received_at      TEXT    NOT NULL,
  credential_id    INTEGER NOT NULL REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  UNIQUE (project_id, revision),
  UNIQUE (project_id, commit_sha),
  UNIQUE (id, project_id)
);

-- TBL-149 document_blobs (CTX-037) ← SPEC-001 | terms: TERM-189
-- The text of a stage document, kept once by its SHA-256 in lowercase hex however many
-- snapshots hold it. A blob that no snapshot file names any more, such as after a project
-- space is deleted, is removed by the code in the same transaction.
CREATE TABLE document_blobs (
  sha256  TEXT    PRIMARY KEY CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  body    TEXT    NOT NULL,
  bytes   INTEGER NOT NULL CHECK (bytes >= 0)
);

-- TBL-150 snapshot_files (CTX-037) ← SPEC-001, SPEC-033 | terms: TERM-189
-- The stage documents of a snapshot, by path in the repository.
CREATE TABLE snapshot_files (
  snapshot_id  INTEGER NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
  path         TEXT    NOT NULL,
  stage        TEXT    NOT NULL,
  blob_sha256  TEXT    NOT NULL REFERENCES document_blobs (sha256) ON DELETE RESTRICT,
  PRIMARY KEY (snapshot_id, path)
);
CREATE INDEX snapshot_files_by_blob ON snapshot_files (blob_sha256);

-- TBL-151 diagrams (CTX-037) ← SPEC-003, SPEC-004, SPEC-005, SPEC-006, SPEC-007, SPEC-008, SPEC-009, SPEC-013 | terms: TERM-194
-- A picture or an item table of one stage, such as the DDD board, the ERD, one user flow or
-- the table of requirements. source_key names what it is drawn from: the stage, or a flow,
-- screen or mockup file. removed_at is set when a snapshot no longer holds it, except that a
-- picture of a stage whose pictures the snapshot's format does not carry stays as last drawn
-- (SPEC-005).
CREATE TABLE diagrams (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  stage       TEXT    NOT NULL,
  source_key  TEXT    NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('ddd_board', 'erd', 'user_flow', 'sitemap', 'screen_states', 'mockup', 'item_table')),
  name        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL,
  removed_at  TEXT,
  UNIQUE (project_id, stage, source_key),
  UNIQUE (id, project_id)
);

-- TBL-152 drawings (CTX-037) ← SPEC-001, SPEC-003, SPEC-004, SPEC-006, SPEC-025, SPEC-033, SPEC-034 | terms: TERM-194
-- One drawing of a diagram from one snapshot of the same project: the diagram at a document
-- version. Rule: a diagram is drawn from the stage documents of one snapshot only. A failed
-- drawing keeps where it failed, and the diagram shows its last drawn one. source_digest
-- covers the files the drawing read, so a change in another file leaves a confirmation as it
-- is (SPEC-033).
CREATE TABLE drawings (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id        INTEGER NOT NULL,
  diagram_id        INTEGER NOT NULL,
  snapshot_id       INTEGER NOT NULL,
  document_version  TEXT    NOT NULL,
  status            TEXT    NOT NULL CHECK (status IN ('drawn', 'failed')),
  source_digest     TEXT    NOT NULL,
  failed_path       TEXT,
  failed_line       INTEGER,
  drawn_at          TEXT    NOT NULL,
  CHECK ((status = 'failed') = (failed_path IS NOT NULL)),
  CHECK (failed_line IS NULL OR failed_path IS NOT NULL),
  UNIQUE (diagram_id, snapshot_id),
  UNIQUE (id, diagram_id),
  FOREIGN KEY (diagram_id, project_id) REFERENCES diagrams (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (snapshot_id, project_id) REFERENCES snapshots (id, project_id) ON DELETE CASCADE
);
CREATE INDEX drawings_by_diagram ON drawings (diagram_id, project_id);
CREATE INDEX drawings_by_snapshot ON drawings (snapshot_id, project_id);

-- TBL-153 elements (CTX-037) ← SPEC-003, SPEC-004, SPEC-005, SPEC-010, SPEC-011, SPEC-027, SPEC-034 | terms: TERM-194
-- One thing in a drawing: a sticky note, a table, a screen, a line or a table row. element_key
-- stays the same across drawings (the trace ID when there is one), so comments, positions and
-- the diff follow it. The screen shows the name; the trace ID only when copied.
CREATE TABLE elements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  drawing_id   INTEGER NOT NULL REFERENCES drawings (id) ON DELETE CASCADE,
  element_key  TEXT    NOT NULL,
  trace_id     TEXT,
  kind         TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  parent_key   TEXT,
  status       TEXT,
  detail       TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(detail)),
  UNIQUE (drawing_id, element_key)
);

-- TBL-154 element_positions (CTX-037) ← SPEC-012 | terms: TERM-198
-- Where the owner put an element of a diagram. Kept in NEXUS and never in Git (stage-01
-- hotspot 7). Rule: a position never changes what the document means, so nothing else reads
-- it; the last move wins, and the code drops the positions of elements that left.
CREATE TABLE element_positions (
  diagram_id   INTEGER NOT NULL REFERENCES diagrams (id) ON DELETE CASCADE,
  element_key  TEXT    NOT NULL,
  x            REAL    NOT NULL,
  y            REAL    NOT NULL,
  moved_at     TEXT    NOT NULL,
  PRIMARY KEY (diagram_id, element_key)
);

-- TBL-155 comment_threads (CTX-038) ← SPEC-016, SPEC-017, SPEC-027, SPEC-028, SPEC-042, SPEC-043 | terms: TERM-200
-- A comment and its replies on a diagram, an element or a table row, at the drawing shown,
-- which is a drawing of the same diagram. An open thread waits on the side that did not write
-- last. removed_name marks a thread moved to the diagram because its element left, with the
-- element's last name; the key stays, so it links again if the element returns.
CREATE TABLE comment_threads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  diagram_id    INTEGER NOT NULL REFERENCES diagrams (id) ON DELETE CASCADE,
  drawing_id    INTEGER NOT NULL,
  target_kind   TEXT    NOT NULL CHECK (target_kind IN ('diagram', 'element', 'row')),
  element_key   TEXT,
  removed_name  TEXT,
  state         TEXT    NOT NULL CHECK (state IN ('open', 'closed')),
  waits_on      TEXT    CHECK (waits_on IN ('owner', 'agent')),
  opened_at     TEXT    NOT NULL,
  closed_at     TEXT,
  closed_by     TEXT    CHECK (closed_by IN ('owner', 'reflection')),
  CHECK (target_kind = 'diagram' OR element_key IS NOT NULL),
  CHECK ((state = 'open') = (waits_on IS NOT NULL)),
  CHECK ((state = 'closed') = (closed_at IS NOT NULL AND closed_by IS NOT NULL)),
  UNIQUE (id, diagram_id),
  FOREIGN KEY (drawing_id, diagram_id) REFERENCES drawings (id, diagram_id) ON DELETE CASCADE
);
CREATE INDEX comment_threads_by_diagram ON comment_threads (diagram_id, state);
CREATE INDEX comment_threads_by_drawing ON comment_threads (drawing_id, diagram_id);

-- TBL-156 comments (CTX-038) ← SPEC-016, SPEC-017, SPEC-025, SPEC-051 | terms: TERM-200
-- One comment or reply in a thread, in order. Rule: an agent's comment names its credential,
-- the owner's names none. detail keeps, as a JSON object, what the hub sends with an entry
-- that has no column of its own: its quote, asks, look_first and a decision's link.
CREATE TABLE comments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id      INTEGER NOT NULL REFERENCES comment_threads (id) ON DELETE CASCADE,
  seq            INTEGER NOT NULL CHECK (seq >= 1),
  author         TEXT    NOT NULL CHECK (author IN ('owner', 'agent')),
  credential_id  INTEGER REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  body           TEXT    NOT NULL CHECK (length(body) >= 1),
  detail         TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(detail) AND json_type(detail) = 'object'),
  created_at     TEXT    NOT NULL,
  CHECK ((author = 'agent') = (credential_id IS NOT NULL)),
  UNIQUE (thread_id, seq)
);

-- TBL-157 pull_requests (CTX-038) ← SPEC-024, SPEC-025, SPEC-032, SPEC-040, SPEC-045 | terms: none
-- A pull request an agent reported for its work: a reflection, a confirmation record or a
-- domain document written from a workshop step. Its state keeps a claim (SPEC-045).
-- merge_commit may stay empty when merged: the hub reports a commit only with a reflection,
-- and a record's merge needs none.
CREATE TABLE pull_requests (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id     INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  purpose        TEXT    NOT NULL CHECK (purpose IN ('reflection', 'record', 'domain_document')),
  number         INTEGER NOT NULL CHECK (number >= 1),
  state          TEXT    NOT NULL CHECK (state IN ('open', 'merged', 'closed')),
  merge_commit   TEXT,
  reported_at    TEXT    NOT NULL,
  closed_at      TEXT,
  credential_id  INTEGER NOT NULL REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  CHECK ((state = 'open') = (closed_at IS NULL)),
  UNIQUE (project_id, number),
  UNIQUE (id, project_id)
);

-- TBL-158 change_sets (CTX-038) ← SPEC-018, SPEC-019, SPEC-020, SPEC-021, SPEC-022, SPEC-023, SPEC-024, SPEC-025, SPEC-026 | terms: TERM-203
-- A change to put into a document: an AI proposal or the owner's direct edit, against a
-- drawing of its diagram. Rules: only the owner accepts or rejects a proposal; a direct edit
-- is accepted when it is made; a change set is reflected only when the drawing from the
-- snapshot of its merged pull request shows it (reflected_drawing_id). detail keeps, as a
-- JSON object, a proposal as the hub sends it: its reason, change text, items, added IDs and
-- proposed document.
CREATE TABLE change_sets (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id            INTEGER NOT NULL,
  diagram_id            INTEGER NOT NULL,
  drawing_id            INTEGER NOT NULL,
  origin                TEXT    NOT NULL CHECK (origin IN ('proposal', 'direct_edit')),
  thread_id             INTEGER,
  credential_id         INTEGER REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  state                 TEXT    NOT NULL CHECK (state IN ('proposed', 'accepted', 'rejected', 'cancelled', 'reflected')),
  created_at            TEXT    NOT NULL,
  decided_at            TEXT,
  pull_request_id       INTEGER,
  reflected_drawing_id  INTEGER,
  detail                TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(detail) AND json_type(detail) = 'object'),
  CHECK (origin = 'direct_edit' OR (thread_id IS NOT NULL AND credential_id IS NOT NULL)),
  CHECK (origin = 'proposal' OR (credential_id IS NULL AND state <> 'proposed')),
  CHECK ((state = 'reflected') = (reflected_drawing_id IS NOT NULL)),
  UNIQUE (id, diagram_id),
  FOREIGN KEY (diagram_id, project_id) REFERENCES diagrams (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (drawing_id, diagram_id) REFERENCES drawings (id, diagram_id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id, diagram_id) REFERENCES comment_threads (id, diagram_id) ON DELETE CASCADE,
  FOREIGN KEY (pull_request_id, project_id) REFERENCES pull_requests (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (reflected_drawing_id, diagram_id) REFERENCES drawings (id, diagram_id) ON DELETE CASCADE
);
CREATE INDEX change_sets_by_diagram ON change_sets (diagram_id, state);
CREATE INDEX change_sets_by_project ON change_sets (diagram_id, project_id);
CREATE INDEX change_sets_by_drawing ON change_sets (drawing_id, diagram_id);
CREATE INDEX change_sets_by_thread ON change_sets (thread_id, diagram_id);
CREATE INDEX change_sets_by_pull_request ON change_sets (pull_request_id, project_id);
CREATE INDEX change_sets_by_reflection ON change_sets (reflected_drawing_id, diagram_id);

-- TBL-159 changes (CTX-038) ← SPEC-018, SPEC-021, SPEC-022 | terms: TERM-203
-- The steps of a change set in order: rename, connect, add or remove an element.
CREATE TABLE changes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  change_set_id  INTEGER NOT NULL REFERENCES change_sets (id) ON DELETE CASCADE,
  seq            INTEGER NOT NULL CHECK (seq >= 1),
  op             TEXT    NOT NULL CHECK (op IN ('rename', 'connect', 'add', 'remove')),
  element_key    TEXT    NOT NULL,
  new_name       TEXT,
  target_key     TEXT,
  detail         TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(detail)),
  CHECK (op <> 'rename' OR new_name IS NOT NULL),
  CHECK (op <> 'connect' OR (target_key IS NOT NULL AND target_key <> element_key)),
  UNIQUE (change_set_id, seq)
);

-- TBL-160 confirmations (CTX-039) ← SPEC-029, SPEC-030, SPEC-031, SPEC-032, SPEC-033, SPEC-034, SPEC-035 | terms: TERM-206
-- The owner passing one diagram or item table at a drawing of it. Rules: only the owner
-- confirms, so the row names no credential; bound to its drawing; at most one live
-- confirmation per diagram; invalidated by a later drawing of the same diagram whose
-- document changed (invalidated_by_drawing).
CREATE TABLE confirmations (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id              INTEGER NOT NULL,
  diagram_id              INTEGER NOT NULL,
  drawing_id              INTEGER NOT NULL,
  state                   TEXT    NOT NULL CHECK (state IN ('confirmed', 'cancelled', 'invalidated')),
  confirmed_at            TEXT    NOT NULL,
  ended_at                TEXT,
  invalidated_by_drawing  INTEGER,
  recorded_at             TEXT,
  record_pull_request_id  INTEGER,
  cancel_recorded_at      TEXT,
  CHECK ((state = 'confirmed') = (ended_at IS NULL)),
  CHECK ((state = 'invalidated') = (invalidated_by_drawing IS NOT NULL)),
  CHECK (cancel_recorded_at IS NULL OR state = 'cancelled'),
  UNIQUE (id, diagram_id),
  FOREIGN KEY (diagram_id, project_id) REFERENCES diagrams (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (drawing_id, diagram_id) REFERENCES drawings (id, diagram_id) ON DELETE CASCADE,
  FOREIGN KEY (invalidated_by_drawing, diagram_id) REFERENCES drawings (id, diagram_id) ON DELETE CASCADE,
  FOREIGN KEY (record_pull_request_id, project_id) REFERENCES pull_requests (id, project_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX confirmations_live ON confirmations (diagram_id) WHERE state = 'confirmed';
CREATE INDEX confirmations_by_project ON confirmations (diagram_id, project_id);
CREATE INDEX confirmations_by_drawing ON confirmations (drawing_id, diagram_id);
CREATE INDEX confirmations_by_invalidation ON confirmations (invalidated_by_drawing, diagram_id);
CREATE INDEX confirmations_by_record ON confirmations (record_pull_request_id, project_id);

-- TBL-161 stage_passes (CTX-039) ← SPEC-035, SPEC-039 | terms: TERM-206
-- A stage checkpoint passed: when every diagram and item table of the stage had a recorded
-- confirmation, or, during a workshop, at steps 1-b, 7 and 9. A pass stays in the record;
-- changed_at is set when a confirmation it rests on is invalidated later.
CREATE TABLE stage_passes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  stage       TEXT    NOT NULL,
  passed_at   TEXT    NOT NULL,
  changed_at  TEXT
);
CREATE INDEX stage_passes_by_stage ON stage_passes (project_id, stage);

-- TBL-162 workshops (CTX-040) ← SPEC-036, SPEC-040 | terms: TERM-211
-- Stage-01 event storming on a NEXUS board. Rule: the board is the source while the workshop
-- is open, and a project has at most one open workshop.
CREATE TABLE workshops (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  state       TEXT    NOT NULL CHECK (state IN ('open', 'closed')),
  opened_at   TEXT    NOT NULL,
  closed_at   TEXT,
  CHECK ((state = 'closed') = (closed_at IS NOT NULL)),
  UNIQUE (id, project_id)
);
CREATE UNIQUE INDEX workshops_open ON workshops (project_id) WHERE state = 'open';
CREATE INDEX workshops_by_project ON workshops (project_id);

-- TBL-163 workshop_steps (CTX-040) ← SPEC-037, SPEC-039, SPEC-040 | terms: TERM-211
-- One event storming step of a workshop, called a step to keep it apart from a CORTHEX stage.
-- written_at is set when the agent reports the step written into the domain document.
CREATE TABLE workshop_steps (
  project_id       INTEGER NOT NULL,
  workshop_id      INTEGER NOT NULL,
  step             TEXT    NOT NULL,
  confirmed_at     TEXT,
  written_at       TEXT,
  pull_request_id  INTEGER,
  CHECK (written_at IS NULL OR confirmed_at IS NOT NULL),
  PRIMARY KEY (workshop_id, step),
  FOREIGN KEY (workshop_id, project_id) REFERENCES workshops (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (pull_request_id, project_id) REFERENCES pull_requests (id, project_id) ON DELETE CASCADE
);
CREATE INDEX workshop_steps_by_project ON workshop_steps (workshop_id, project_id);
CREATE INDEX workshop_steps_by_pull_request ON workshop_steps (pull_request_id, project_id);

-- TBL-164 sticky_notes (CTX-040) ← SPEC-037, SPEC-038, SPEC-041 | terms: TERM-211
-- One note on a workshop board; its kind gives its colour, and a hotspot is a kind. Rules: an
-- agent's note carries a confidence label and names its credential; an agent never removes a
-- note a person made (the code refuses it, SPEC-038).
CREATE TABLE sticky_notes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  workshop_id    INTEGER NOT NULL,
  step           TEXT    NOT NULL,
  kind           TEXT    NOT NULL,
  body           TEXT    NOT NULL,
  x              REAL    NOT NULL,
  y              REAL    NOT NULL,
  made_by        TEXT    NOT NULL CHECK (made_by IN ('owner', 'agent')),
  credential_id  INTEGER REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  confidence     TEXT    CHECK (confidence IN ('certain', 'inferred', 'guess')),
  from_miro      INTEGER NOT NULL DEFAULT 0 CHECK (from_miro IN (0, 1)),
  created_at     TEXT    NOT NULL,
  removed_at     TEXT,
  CHECK ((made_by = 'agent') = (credential_id IS NOT NULL)),
  CHECK (made_by = 'owner' OR confidence IS NOT NULL),
  UNIQUE (id, workshop_id),
  FOREIGN KEY (workshop_id, step) REFERENCES workshop_steps (workshop_id, step) ON DELETE CASCADE
);
CREATE INDEX sticky_notes_by_step ON sticky_notes (workshop_id, step);

-- TBL-165 sticky_links (CTX-040) ← SPEC-038, SPEC-041 | terms: TERM-211
-- A line between two sticky notes of the same workshop board. Rule: an agent's line names its
-- credential.
CREATE TABLE sticky_links (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  workshop_id    INTEGER NOT NULL,
  from_note      INTEGER NOT NULL,
  to_note        INTEGER NOT NULL,
  made_by        TEXT    NOT NULL CHECK (made_by IN ('owner', 'agent')),
  credential_id  INTEGER REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  created_at     TEXT    NOT NULL,
  removed_at     TEXT,
  CHECK (from_note <> to_note),
  CHECK ((made_by = 'agent') = (credential_id IS NOT NULL)),
  FOREIGN KEY (from_note, workshop_id) REFERENCES sticky_notes (id, workshop_id) ON DELETE CASCADE,
  FOREIGN KEY (to_note, workshop_id) REFERENCES sticky_notes (id, workshop_id) ON DELETE CASCADE
);
CREATE INDEX sticky_links_by_from ON sticky_links (from_note, workshop_id);
CREATE INDEX sticky_links_by_to ON sticky_links (to_note, workshop_id);

-- TBL-166 todos (CTX-041) ← SPEC-016, SPEC-017, SPEC-019, SPEC-023, SPEC-026, SPEC-029, SPEC-030, SPEC-031, SPEC-032, SPEC-033, SPEC-039, SPEC-042, SPEC-043 | terms: none
-- One thing for the owner or an agent to answer or handle, made by the contexts that hand
-- work over; the owner's to-do and the agent to-do read it. Everything an entry is about
-- belongs to its project, and a thread, change set or confirmation also to its diagram. A
-- reflection entry holds every accepted change set of one diagram (SPEC-026).
CREATE TABLE todos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id       INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  side             TEXT    NOT NULL CHECK (side IN ('owner', 'agent')),
  kind             TEXT    NOT NULL CHECK (kind IN (
                     'confirm', 'proposal', 'question',
                     'comment', 'reflect', 'remove_from_pr', 'record_confirmation', 'record_cancel', 'write_step')),
  diagram_id       INTEGER,
  thread_id        INTEGER,
  change_set_id    INTEGER,
  confirmation_id  INTEGER,
  workshop_id      INTEGER,
  step             TEXT,
  created_at       TEXT    NOT NULL,
  closed_at        TEXT,
  close_reason     TEXT    CHECK (close_reason IN ('done', 'withdrawn')),
  CHECK ((side = 'owner') = (kind IN ('confirm', 'proposal', 'question'))),
  CHECK ((closed_at IS NULL) = (close_reason IS NULL)),
  CHECK (kind NOT IN ('question', 'comment') OR thread_id IS NOT NULL),
  CHECK (kind NOT IN ('confirm', 'reflect') OR diagram_id IS NOT NULL),
  CHECK (kind NOT IN ('proposal', 'remove_from_pr') OR change_set_id IS NOT NULL),
  CHECK (kind NOT IN ('record_confirmation', 'record_cancel') OR confirmation_id IS NOT NULL),
  CHECK (kind <> 'write_step' OR (workshop_id IS NOT NULL AND step IS NOT NULL)),
  CHECK ((thread_id IS NULL AND change_set_id IS NULL AND confirmation_id IS NULL) OR diagram_id IS NOT NULL),
  UNIQUE (id, project_id),
  FOREIGN KEY (diagram_id, project_id) REFERENCES diagrams (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id, diagram_id) REFERENCES comment_threads (id, diagram_id) ON DELETE CASCADE,
  FOREIGN KEY (change_set_id, diagram_id) REFERENCES change_sets (id, diagram_id) ON DELETE CASCADE,
  FOREIGN KEY (confirmation_id, diagram_id) REFERENCES confirmations (id, diagram_id) ON DELETE CASCADE,
  FOREIGN KEY (workshop_id, project_id) REFERENCES workshops (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (workshop_id, step) REFERENCES workshop_steps (workshop_id, step) ON DELETE CASCADE
);
CREATE INDEX todos_open ON todos (side, project_id, created_at) WHERE closed_at IS NULL;
CREATE INDEX todos_by_project ON todos (project_id);
CREATE INDEX todos_by_diagram ON todos (diagram_id, project_id);
CREATE INDEX todos_by_thread ON todos (thread_id, diagram_id);
CREATE INDEX todos_by_change_set ON todos (change_set_id, diagram_id);
CREATE INDEX todos_by_confirmation ON todos (confirmation_id, diagram_id);
CREATE INDEX todos_by_workshop ON todos (workshop_id, project_id);
CREATE INDEX todos_by_step ON todos (workshop_id, step);

-- TBL-167 claims (CTX-041) ← SPEC-044, SPEC-045, SPEC-050 | terms: TERM-217
-- One agent session holding one to-do alone. Rules: at most one live claim per to-do; a claim
-- names the credential that made it, so revoking the credential releases its claims; its
-- pull request belongs to the to-do's project.
CREATE TABLE claims (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id       INTEGER NOT NULL,
  todo_id          INTEGER NOT NULL,
  session          TEXT    NOT NULL CHECK (length(session) >= 1),
  credential_id    INTEGER NOT NULL REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  claimed_at       TEXT    NOT NULL,
  last_write_at    TEXT    NOT NULL,
  pull_request_id  INTEGER,
  released_at      TEXT,
  release_reason   TEXT    CHECK (release_reason IN ('released', 'idle', 'revoked', 'done')),
  CHECK ((released_at IS NULL) = (release_reason IS NULL)),
  FOREIGN KEY (todo_id, project_id) REFERENCES todos (id, project_id) ON DELETE CASCADE,
  FOREIGN KEY (pull_request_id, project_id) REFERENCES pull_requests (id, project_id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX claims_live ON claims (todo_id) WHERE released_at IS NULL;
CREATE INDEX claims_by_todo ON claims (todo_id, project_id);
CREATE INDEX claims_by_credential ON claims (credential_id) WHERE released_at IS NULL;
CREATE INDEX claims_by_pull_request ON claims (pull_request_id, project_id);

-- TBL-168 tool_links (CTX-042) ← SPEC-046, SPEC-047 | terms: TERM-218
-- A Notion page or Jira project linked to a project or one of its stages, with the status last
-- read from it. scope is 'project' or the stage key. Rule: it holds the link and the status,
-- never the linked content.
CREATE TABLE tool_links (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  scope           TEXT    NOT NULL,
  tool            TEXT    NOT NULL CHECK (tool IN ('notion', 'jira')),
  url             TEXT    NOT NULL,
  status          TEXT,
  status_read_at  TEXT,
  added_at        TEXT    NOT NULL,
  removed_at      TEXT
);
CREATE UNIQUE INDEX tool_links_live ON tool_links (project_id, scope, url) WHERE removed_at IS NULL;
CREATE INDEX tool_links_by_project ON tool_links (project_id);

-- TBL-169 request_keys (operations) ← SPEC-001, SPEC-014 | terms: none
-- The first answer to each write's request key (rule 3 of the spec), so the same key within
-- 24 hours returns it and writes nothing. actor is 'owner' or the credential's ID.
CREATE TABLE request_keys (
  actor        TEXT    NOT NULL,
  request_key  TEXT    NOT NULL,
  action       TEXT    NOT NULL,
  status_code  INTEGER NOT NULL,
  answer       TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  PRIMARY KEY (actor, request_key)
);
CREATE INDEX request_keys_by_time ON request_keys (created_at);

-- TBL-170 backups (operations) ← SPEC-052, SPEC-042 | terms: none
-- Each daily backup and its retry, which may write the same file name. name is the backup's
-- file name without a path.
CREATE TABLE backups (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  attempt      INTEGER NOT NULL CHECK (attempt IN (1, 2)),
  state        TEXT    NOT NULL CHECK (state IN ('running', 'succeeded', 'failed')),
  bytes        INTEGER,
  started_at   TEXT    NOT NULL,
  finished_at  TEXT,
  removed_at   TEXT,
  UNIQUE (name, attempt)
);
CREATE INDEX backups_by_time ON backups (started_at);

-- TBL-171 restore_rehearsals (operations) ← SPEC-052 | terms: none
-- The restore rehearsed from the latest backup before a release (REQ-080).
CREATE TABLE restore_rehearsals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  release       TEXT    NOT NULL,
  backup_id     INTEGER NOT NULL REFERENCES backups (id) ON DELETE RESTRICT,
  result        TEXT    NOT NULL CHECK (result IN ('succeeded', 'failed')),
  rehearsed_at  TEXT    NOT NULL,
  note          TEXT
);
CREATE INDEX restore_rehearsals_by_backup ON restore_rehearsals (backup_id);
