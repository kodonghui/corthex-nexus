-- Schema 4: the database that migrations 1 to 4 of nexus/src/store.js make, as a server of
-- before the design revision of 2026-11-11 holds it, without its comments. A released
-- migration never changes, so neither does this file: nexus/test/migrations.test.js holds it
-- equal to migrations 1 to 4, and the tests of migration 5 (TASK-295) start from it. The
-- schema of today is docs/05-erd/nexus.sql.

CREATE TABLE snapshots (
  name           TEXT    PRIMARY KEY,
  revision       INTEGER NOT NULL,
  generated_ms   INTEGER NOT NULL,
  generated_at   TEXT    NOT NULL,
  received_at    TEXT    NOT NULL,
  bytes          INTEGER NOT NULL,
  body           TEXT    NOT NULL,
  default_commit TEXT,
  push_id        TEXT
);

CREATE TABLE project_spaces (
  project     TEXT    PRIMARY KEY REFERENCES snapshots (name) ON DELETE CASCADE,
  repo_url    TEXT,
  created_at  TEXT    NOT NULL,
  text_bytes  INTEGER NOT NULL DEFAULT 0 CHECK (text_bytes >= 0),
  unopened    TEXT    NOT NULL DEFAULT '{}'
);

CREATE TABLE pictures (
  project      TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,
  part         TEXT NOT NULL,
  stage        TEXT NOT NULL CHECK (stage IN ('01-domain', '05-erd', '07-sitemap')),
  commit_id    TEXT NOT NULL,
  committed_at TEXT NOT NULL,
  source       TEXT NOT NULL,
  digest       TEXT NOT NULL,
  drawn_at     TEXT NOT NULL,
  not_current  TEXT CHECK (not_current IN ('size', 'source-gone', 'other-repository')),
  PRIMARY KEY (project, part, stage)
);

CREATE TABLE discrepancies (
  id              TEXT    PRIMARY KEY,
  project         TEXT    NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,
  part            TEXT    NOT NULL,
  compares        TEXT    NOT NULL CHECK (compares IN ('aggregate-table', 'read-model-screen')),
  term            TEXT    NOT NULL,
  item            TEXT    NOT NULL,
  reasons         TEXT    NOT NULL,
  level           TEXT    NOT NULL CHECK (level IN ('warn', 'info')),
  state           TEXT    NOT NULL CHECK (state IN ('open', 'resolved')),
  waiting         INTEGER NOT NULL DEFAULT 0 CHECK (waiting IN (0, 1)),
  opened_commit   TEXT    NOT NULL,
  opened_at       TEXT    NOT NULL,
  resolved_commit TEXT,
  resolved_at     TEXT,
  earlier         TEXT    REFERENCES discrepancies (id) ON DELETE SET NULL,
  CHECK ((state = 'open' AND resolved_commit IS NULL AND resolved_at IS NULL)
      OR (state = 'resolved' AND resolved_commit IS NOT NULL AND resolved_at IS NOT NULL)),
  CHECK (waiting = 0 OR state = 'open')
);
CREATE UNIQUE INDEX discrepancies_pair ON discrepancies (project, part, compares, term, item) WHERE state = 'open';
CREATE INDEX discrepancies_state ON discrepancies (project, state, level);

CREATE TABLE comments (
  id           TEXT    PRIMARY KEY,
  project      TEXT    NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,
  part         TEXT    NOT NULL,
  stage        TEXT    NOT NULL CHECK (stage IN ('01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation')),
  item         TEXT    NOT NULL,
  quote        TEXT,
  discrepancy  TEXT    REFERENCES discrepancies (id) ON DELETE SET NULL,
  commit_id    TEXT    NOT NULL,
  author       TEXT    NOT NULL CHECK (author IN ('user', 'agent')),
  text         TEXT    NOT NULL,
  state        TEXT    NOT NULL CHECK (state IN ('open', 'closed')),
  closed_as    TEXT    CHECK (closed_as IN ('answered', 'decided')),
  waits        TEXT    CHECK (waits IN ('user', 'agent')),
  asks         TEXT    CHECK (asks IN ('answer', 'recommended', 'checkpoint')),
  settled      INTEGER NOT NULL DEFAULT 0 CHECK (settled IN (0, 1)),
  dismissed    INTEGER NOT NULL DEFAULT 0 CHECK (dismissed IN (0, 1)),
  made_at      TEXT    NOT NULL,
  last_at      TEXT    NOT NULL,
  CHECK ((state = 'open' AND closed_as IS NULL AND waits IS NOT NULL)
      OR (state = 'closed' AND closed_as IS NOT NULL AND waits IS NULL)),
  CHECK ((settled = 0 AND dismissed = 0) OR state = 'open'),
  CHECK (asks IS NULL OR (state = 'open' AND waits = 'user'))
);
CREATE INDEX comments_waiting ON comments (project, state, waits, last_at);
CREATE INDEX comments_stage ON comments (project, part, stage, state);

CREATE TABLE replies (
  comment  TEXT    NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  seq      INTEGER NOT NULL CHECK (seq > 0),
  author   TEXT    NOT NULL CHECK (author IN ('user', 'agent')),
  text     TEXT    NOT NULL,
  settles  INTEGER NOT NULL DEFAULT 0 CHECK (settles IN (0, 1)),
  made_at  TEXT    NOT NULL,
  PRIMARY KEY (comment, seq),
  CHECK (settles = 0 OR author = 'user')
);

CREATE TABLE decisions (
  comment  TEXT    NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  seq      INTEGER NOT NULL CHECK (seq > 0),
  link     TEXT    NOT NULL,
  text     TEXT,
  made_at  TEXT    NOT NULL,
  PRIMARY KEY (comment, seq)
);

CREATE TABLE proposals (
  id           TEXT PRIMARY KEY,
  project      TEXT NOT NULL,
  part         TEXT NOT NULL,
  stage        TEXT NOT NULL,
  commit_id    TEXT NOT NULL,
  items        TEXT NOT NULL,
  reason       TEXT NOT NULL,
  change       TEXT NOT NULL,
  source_text  TEXT,
  comment      TEXT REFERENCES comments (id) ON DELETE SET NULL,
  discrepancy  TEXT REFERENCES discrepancies (id) ON DELETE SET NULL,
  state        TEXT NOT NULL CHECK (state IN ('open', 'accepted', 'dismissed', 'withdrawn')),
  made_at      TEXT NOT NULL,
  closed_at    TEXT,
  FOREIGN KEY (project, part, stage) REFERENCES pictures (project, part, stage) ON DELETE CASCADE,
  CHECK ((state = 'open') = (closed_at IS NULL))
);
CREATE INDEX proposals_state ON proposals (project, state);
CREATE INDEX proposals_comment ON proposals (comment);

CREATE TABLE edits (
  id            TEXT PRIMARY KEY,
  project       TEXT NOT NULL,
  part          TEXT NOT NULL,
  stage         TEXT NOT NULL,
  commit_id     TEXT NOT NULL,
  proposal      TEXT UNIQUE REFERENCES proposals (id) ON DELETE CASCADE,
  content       TEXT,
  state         TEXT NOT NULL CHECK (state IN ('pending', 'in-review', 'needs-user', 'closed', 'dismissed')),
  pull_request  TEXT,
  closed_commit TEXT,
  made_at       TEXT NOT NULL,
  changed_at    TEXT NOT NULL,
  last_report   TEXT,
  FOREIGN KEY (project, part, stage) REFERENCES pictures (project, part, stage) ON DELETE CASCADE,
  CHECK (proposal IS NOT NULL OR content IS NOT NULL),
  CHECK (state <> 'in-review' OR pull_request IS NOT NULL)
);
CREATE INDEX edits_state ON edits (project, state, made_at);

CREATE TABLE checkpoints (
  id              TEXT PRIMARY KEY,
  project         TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,
  part            TEXT NOT NULL,
  stage           TEXT NOT NULL,
  commit_id       TEXT,
  words           TEXT,
  state           TEXT NOT NULL CHECK (state IN ('passed', 'withdrawn')),
  passed_at       TEXT NOT NULL,
  withdrawn_at    TEXT,
  pull_request    TEXT,
  pr_state        TEXT CHECK (pr_state IN ('open', 'merged', 'closed')),
  recorded_commit TEXT,
  comment         TEXT REFERENCES comments (id) ON DELETE SET NULL,
  CHECK ((state = 'withdrawn') = (withdrawn_at IS NOT NULL)),
  CHECK ((pull_request IS NULL) = (pr_state IS NULL))
);
CREATE INDEX checkpoints_state ON checkpoints (project, state);

CREATE TABLE claims (
  entry      TEXT PRIMARY KEY,
  project    TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,
  session    TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  ends_at    TEXT NOT NULL
);
CREATE INDEX claims_ends ON claims (project, ends_at);

CREATE TABLE writes (
  project     TEXT NOT NULL REFERENCES project_spaces (project) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  request     TEXT NOT NULL,
  result      TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (project, id)
);
CREATE INDEX writes_received ON writes (received_at);

CREATE TABLE IF NOT EXISTS migrations (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT    NOT NULL
);
