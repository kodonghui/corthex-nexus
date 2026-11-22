-- Migration 0001: the first schema of NEXUS v3, from an empty database.
-- Never edit a migration once it has been applied anywhere; add the next one instead.
-- db/nexus.sql holds the whole schema with each table's TBL ID and rules.

CREATE TABLE agent_credentials (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL UNIQUE,
  secret_digest TEXT    NOT NULL UNIQUE,
  issued_at     TEXT    NOT NULL,
  revoked_at    TEXT,
  last_used_at  TEXT
);

CREATE TABLE project_spaces (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  name                   TEXT    NOT NULL UNIQUE
    CHECK (length(name) BETWEEN 1 AND 64 AND name NOT GLOB '*[^a-z0-9-]*'),
  repository             TEXT,
  held_commit            TEXT,
  created_at             TEXT    NOT NULL,
  created_by_credential  INTEGER NOT NULL REFERENCES agent_credentials (id) ON DELETE RESTRICT
);

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

CREATE TABLE document_blobs (
  sha256  TEXT    PRIMARY KEY CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  body    TEXT    NOT NULL,
  bytes   INTEGER NOT NULL CHECK (bytes >= 0)
);

CREATE TABLE snapshot_files (
  snapshot_id  INTEGER NOT NULL REFERENCES snapshots (id) ON DELETE CASCADE,
  path         TEXT    NOT NULL,
  stage        TEXT    NOT NULL,
  blob_sha256  TEXT    NOT NULL REFERENCES document_blobs (sha256) ON DELETE RESTRICT,
  PRIMARY KEY (snapshot_id, path)
);
CREATE INDEX snapshot_files_by_blob ON snapshot_files (blob_sha256);

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

CREATE TABLE element_positions (
  diagram_id   INTEGER NOT NULL REFERENCES diagrams (id) ON DELETE CASCADE,
  element_key  TEXT    NOT NULL,
  x            REAL    NOT NULL,
  y            REAL    NOT NULL,
  moved_at     TEXT    NOT NULL,
  PRIMARY KEY (diagram_id, element_key)
);

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

CREATE TABLE comments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id      INTEGER NOT NULL REFERENCES comment_threads (id) ON DELETE CASCADE,
  seq            INTEGER NOT NULL CHECK (seq >= 1),
  author         TEXT    NOT NULL CHECK (author IN ('owner', 'agent')),
  credential_id  INTEGER REFERENCES agent_credentials (id) ON DELETE RESTRICT,
  body           TEXT    NOT NULL CHECK (length(body) >= 1),
  created_at     TEXT    NOT NULL,
  CHECK ((author = 'agent') = (credential_id IS NOT NULL)),
  UNIQUE (thread_id, seq)
);

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
  CHECK (state <> 'merged' OR merge_commit IS NOT NULL),
  CHECK ((state = 'open') = (closed_at IS NULL)),
  UNIQUE (project_id, number),
  UNIQUE (id, project_id)
);

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

CREATE TABLE stage_passes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id  INTEGER NOT NULL REFERENCES project_spaces (id) ON DELETE CASCADE,
  stage       TEXT    NOT NULL,
  passed_at   TEXT    NOT NULL,
  changed_at  TEXT
);
CREATE INDEX stage_passes_by_stage ON stage_passes (project_id, stage);

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

CREATE TABLE restore_rehearsals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  release       TEXT    NOT NULL,
  backup_id     INTEGER NOT NULL REFERENCES backups (id) ON DELETE RESTRICT,
  result        TEXT    NOT NULL CHECK (result IN ('succeeded', 'failed')),
  rehearsed_at  TEXT    NOT NULL,
  note          TEXT
);
CREATE INDEX restore_rehearsals_by_backup ON restore_rehearsals (backup_id);
