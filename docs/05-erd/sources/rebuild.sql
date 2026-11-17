-- Rebuild first-release schema; design only, never applied to production.
-- SQLite with foreign_keys=ON. Application transactions enforce current-version/human-session authority.
-- without a table: TERM-169, TERM-170, TERM-171, TERM-172, TERM-173, TERM-174, TERM-175, TERM-176, TERM-177, TERM-178, TERM-179, TERM-180, TERM-181, TERM-182, TERM-183, TERM-184, TERM-185, TERM-186, TERM-187, TERM-188

PRAGMA foreign_keys = ON;

-- TBL-126 owners (CTX-035) | terms: TERM-165 | SPEC-301, SPEC-332, SPEC-333
CREATE TABLE owners (
id TEXT PRIMARY KEY,
  issuer TEXT NOT NULL CHECK(length(issuer) BETWEEN 1 AND 2048),
  subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 255),
  created_at TEXT NOT NULL,
  UNIQUE(issuer, subject)
);

-- TBL-127 owner_sessions (CTX-035) | terms: TERM-162 | SPEC-301, SPEC-318, SPEC-319, SPEC-323, SPEC-333
CREATE TABLE owner_sessions (
id_hash TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  csrf_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  idle_expires_at TEXT NOT NULL,
  absolute_expires_at TEXT NOT NULL,
  revoked_at TEXT
);

-- TBL-128 projects (CTX-032) | terms: TERM-155 | SPEC-302, SPEC-303, SPEC-325, SPEC-326, SPEC-332, SPEC-341, SPEC-348, SPEC-350
CREATE TABLE projects (
id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  slug TEXT NOT NULL CHECK(length(slug) BETWEEN 3 AND 64),
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  repository_url TEXT CHECK(length(repository_url) <= 2048),
  default_branch TEXT CHECK(length(default_branch) BETWEEN 1 AND 255),
  held_publication_id TEXT,
  row_revision INTEGER NOT NULL DEFAULT 0 CHECK(row_revision >= 0),
  synthetic INTEGER NOT NULL DEFAULT 0 CHECK(synthetic IN (0,1)),
  created_at TEXT NOT NULL,
  archived_at TEXT,
  UNIQUE(owner_id, slug),
  UNIQUE(owner_id, id),
  FOREIGN KEY(id, held_publication_id) REFERENCES publications(project_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

-- TBL-129 project_credentials (CTX-035) | terms: TERM-166 | SPEC-313, SPEC-315, SPEC-319, SPEC-331, SPEC-332, SPEC-333
CREATE TABLE project_credentials (
id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('publisher','agent')),
  label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 80),
  secret_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY(owner_id, project_id) REFERENCES projects(owner_id,id) ON DELETE RESTRICT
);

-- TBL-130 publications (CTX-032) | terms: TERM-156 | SPEC-304, SPEC-305, SPEC-306, SPEC-308, SPEC-325, SPEC-327, SPEC-328, SPEC-329, SPEC-341
CREATE TABLE publications (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK(revision > 0),
  commit_sha TEXT NOT NULL CHECK(length(commit_sha) IN (40,64)),
  parent_publication_id TEXT,
  snapshot_digest TEXT NOT NULL CHECK(length(snapshot_digest)=64),
  format_version INTEGER NOT NULL CHECK(format_version > 0),
  snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)),
  received_at TEXT NOT NULL,
  UNIQUE(project_id,revision),
  UNIQUE(project_id,id),
  UNIQUE(project_id,commit_sha,snapshot_digest),
  FOREIGN KEY(project_id,parent_publication_id) REFERENCES publications(project_id,id) ON DELETE RESTRICT
);

-- TBL-131 stage_artifacts (CTX-033) | terms: TERM-157, TERM-161 | SPEC-303, SPEC-304, SPEC-305, SPEC-306, SPEC-307, SPEC-308, SPEC-321, SPEC-322, SPEC-324
CREATE TABLE stage_artifacts (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  publication_id TEXT NOT NULL,
  part TEXT NOT NULL CHECK(length(part) BETWEEN 1 AND 80),
  stage TEXT NOT NULL CHECK(length(stage) BETWEEN 1 AND 40),
  content_version TEXT NOT NULL CHECK(length(content_version)=64),
  parser_version TEXT NOT NULL CHECK(length(parser_version) BETWEEN 1 AND 80),
  representation TEXT NOT NULL CHECK(representation IN ('diagram','list','contract','screens','html','evidence','missing','unsupported')),
  source_path TEXT NOT NULL CHECK(length(source_path) BETWEEN 1 AND 1024),
  source_json TEXT NOT NULL CHECK(json_valid(source_json)),
  attachment_manifest_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(attachment_manifest_json)),
  created_at TEXT NOT NULL,
  UNIQUE(project_id,id),
  UNIQUE(publication_id,part,stage),
  FOREIGN KEY(project_id,publication_id) REFERENCES publications(project_id,id) ON DELETE RESTRICT
);

-- TBL-132 artifact_items (CTX-033) | terms: TERM-158 | SPEC-305, SPEC-306, SPEC-308, SPEC-309, SPEC-310, SPEC-311, SPEC-341
CREATE TABLE artifact_items (
project_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  trace_id TEXT NOT NULL CHECK(length(trace_id) BETWEEN 1 AND 80),
  item_json TEXT NOT NULL CHECK(json_valid(item_json)),
  source_line INTEGER CHECK(source_line > 0),
  removed INTEGER NOT NULL DEFAULT 0 CHECK(removed IN (0,1)),
  PRIMARY KEY(artifact_id,trace_id),
  UNIQUE(project_id,artifact_id,trace_id),
  FOREIGN KEY(project_id,artifact_id) REFERENCES stage_artifacts(project_id,id) ON DELETE RESTRICT
);

-- TBL-133 discussions (CTX-033) | terms: TERM-159 | SPEC-311, SPEC-312, SPEC-313, SPEC-314, SPEC-316, SPEC-342
CREATE TABLE discussions (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  origin_artifact_id TEXT NOT NULL,
  item_trace_id TEXT,
  state TEXT NOT NULL CHECK(state IN ('open','resolved')),
  row_revision INTEGER NOT NULL DEFAULT 0 CHECK(row_revision >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(project_id,id),
  FOREIGN KEY(project_id,origin_artifact_id) REFERENCES stage_artifacts(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,origin_artifact_id,item_trace_id) REFERENCES artifact_items(project_id,artifact_id,trace_id) ON DELETE RESTRICT
);

-- TBL-134 messages (CTX-033) | terms: TERM-159 | SPEC-311, SPEC-312, SPEC-313, SPEC-314, SPEC-342
CREATE TABLE messages (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  discussion_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  parent_message_id TEXT,
  author_kind TEXT NOT NULL CHECK(author_kind IN ('owner','agent','legacy')),
  author_ref TEXT NOT NULL CHECK(length(author_ref) BETWEEN 1 AND 255),
  body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 8000 AND length(CAST(body AS BLOB)) <= 32768),
  created_at TEXT NOT NULL,
  UNIQUE(project_id,id),
  UNIQUE(discussion_id,sequence),
  UNIQUE(project_id,discussion_id,id),
  FOREIGN KEY(project_id,discussion_id) REFERENCES discussions(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,discussion_id,parent_message_id) REFERENCES messages(project_id,discussion_id,id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

-- TBL-135 agent_work (CTX-033) | terms: TERM-167 | SPEC-312, SPEC-313, SPEC-315
CREATE TABLE agent_work (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  question_message_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('queued','claimed','answered','cancelled')),
  claimed_by TEXT,
  lease_token_hash TEXT,
  lease_expires_at TEXT,
  reply_message_id TEXT,
  row_revision INTEGER NOT NULL DEFAULT 0 CHECK(row_revision >= 0),
  created_at TEXT NOT NULL,
  UNIQUE(project_id,question_message_id),
  FOREIGN KEY(project_id,question_message_id) REFERENCES messages(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,reply_message_id) REFERENCES messages(project_id,id) ON DELETE RESTRICT,
  CHECK(state <> 'claimed' OR (claimed_by IS NOT NULL AND lease_token_hash IS NOT NULL AND lease_expires_at IS NOT NULL)),
  CHECK(state <> 'answered' OR reply_message_id IS NOT NULL)
);

-- TBL-136 proposals (CTX-033) | terms: TERM-159 | SPEC-314, SPEC-316
CREATE TABLE proposals (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  discussion_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('proposed','accepted','rejected','in_review','reflected')),
  source_commit TEXT,
  pull_request_url TEXT CHECK(length(pull_request_url) <= 2048),
  reflected_publication_id TEXT,
  row_revision INTEGER NOT NULL DEFAULT 0 CHECK(row_revision >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY(project_id,discussion_id) REFERENCES discussions(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,reflected_publication_id) REFERENCES publications(project_id,id) ON DELETE RESTRICT,
  CHECK(state <> 'reflected' OR (source_commit IS NOT NULL AND reflected_publication_id IS NOT NULL))
);

-- TBL-137 checkpoint_requests (CTX-034) | terms: TERM-160 | SPEC-317, SPEC-318, SPEC-319, SPEC-320, SPEC-321, SPEC-322, SPEC-324, SPEC-343
CREATE TABLE checkpoint_requests (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  content_version TEXT NOT NULL CHECK(length(content_version)=64),
  state TEXT NOT NULL CHECK(state IN ('pending','passed','changes_requested','withdrawn','superseded')),
  row_revision INTEGER NOT NULL DEFAULT 0 CHECK(row_revision >= 0),
  requested_at TEXT NOT NULL,
  UNIQUE(project_id,id),
  UNIQUE(artifact_id,content_version),
  FOREIGN KEY(project_id,artifact_id) REFERENCES stage_artifacts(project_id,id) ON DELETE RESTRICT
);

-- TBL-138 checkpoint_decisions (CTX-034) | terms: TERM-160 | SPEC-318, SPEC-319, SPEC-321, SPEC-323, SPEC-343
CREATE TABLE checkpoint_decisions (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK(sequence > 0),
  actor_owner_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('pass','changes_requested','withdraw')),
  prior_decision_id TEXT,
  content_version TEXT NOT NULL CHECK(length(content_version)=64),
  reason TEXT CHECK(length(reason) <= 8000),
  decided_at TEXT NOT NULL,
  legacy_actor_json TEXT CHECK(legacy_actor_json IS NULL OR json_valid(legacy_actor_json)),
  UNIQUE(project_id,id),
  UNIQUE(request_id,sequence),
  FOREIGN KEY(actor_owner_id,project_id) REFERENCES projects(owner_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,request_id) REFERENCES checkpoint_requests(project_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(project_id,prior_decision_id) REFERENCES checkpoint_decisions(project_id,id) ON DELETE RESTRICT,
  CHECK(decision <> 'withdraw' OR prior_decision_id IS NOT NULL)
);

-- TBL-139 idempotency_receipts (CTX-032) | terms: TERM-163 | SPEC-311, SPEC-313, SPEC-318, SPEC-323, SPEC-327, SPEC-328, SPEC-329
CREATE TABLE idempotency_receipts (
id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE RESTRICT,
  project_id TEXT REFERENCES projects(id) ON DELETE RESTRICT,
  scope_key TEXT NOT NULL,
  operation TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  body_digest TEXT NOT NULL CHECK(length(body_digest)=64),
  http_status INTEGER NOT NULL CHECK(http_status BETWEEN 200 AND 599),
  safe_result_json TEXT NOT NULL CHECK(json_valid(safe_result_json)),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(owner_id,scope_key,operation,key_hash)
);

-- TBL-140 migration_runs (CTX-036) | terms: TERM-164, TERM-168 | SPEC-341, SPEC-342, SPEC-343, SPEC-344, SPEC-345
CREATE TABLE migration_runs (
id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK(state IN ('inventoried','backed_up','restored','validated','kept','switched','rolled_back','blocked')),
  protected_manifest_ref TEXT NOT NULL,
  baseline_digest TEXT NOT NULL CHECK(length(baseline_digest)=64),
  counts_json TEXT NOT NULL CHECK(json_valid(counts_json)),
  accepted_write_boundary INTEGER,
  reconciliation_json TEXT CHECK(reconciliation_json IS NULL OR json_valid(reconciliation_json)),
  release_decision TEXT CHECK(release_decision IN ('keep','switch','rollback')),
  created_at TEXT NOT NULL,
  completed_at TEXT
);

-- TBL-141 legacy_mappings (CTX-036) | terms: TERM-164 | SPEC-341, SPEC-342, SPEC-343
CREATE TABLE legacy_mappings (
migration_run_id TEXT NOT NULL REFERENCES migration_runs(id) ON DELETE RESTRICT,
  legacy_project TEXT NOT NULL,
  record_kind TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  target_project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  target_id TEXT NOT NULL,
  original_digest TEXT NOT NULL CHECK(length(original_digest)=64),
  PRIMARY KEY(migration_run_id,legacy_project,record_kind,legacy_id),
  UNIQUE(migration_run_id,target_project_id,record_kind,target_id)
);

-- TBL-142 write_journal (CTX-036) | terms: TERM-164 | SPEC-311, SPEC-313, SPEC-318, SPEC-323, SPEC-344
CREATE TABLE write_journal (
sequence INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  operation TEXT NOT NULL,
  receipt_id TEXT NOT NULL REFERENCES idempotency_receipts(id) ON DELETE RESTRICT,
  protected_payload_json TEXT NOT NULL CHECK(json_valid(protected_payload_json)),
  result_digest TEXT NOT NULL CHECK(length(result_digest)=64),
  acknowledged_at TEXT NOT NULL,
  UNIQUE(receipt_id)
);

-- TBL-143 publication_consents (CTX-032) | terms: TERM-155 | SPEC-326, SPEC-350
CREATE TABLE publication_consents (
id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  preview_digest TEXT NOT NULL CHECK(length(preview_digest)=64),
  consented_at TEXT NOT NULL,
  withdrawn_at TEXT,
  FOREIGN KEY(owner_id,project_id) REFERENCES projects(owner_id,id) ON DELETE RESTRICT
);

-- TBL-144 auth_attempts (CTX-035) | terms: TERM-162 | SPEC-333
CREATE TABLE auth_attempts (
state_hash TEXT PRIMARY KEY,
  nonce_hash TEXT NOT NULL,
  protected_pkce_verifier TEXT NOT NULL,
  safe_return_path TEXT NOT NULL CHECK(length(safe_return_path) <= 1024),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE INDEX owner_projects ON projects(owner_id,archived_at,created_at);
CREATE INDEX active_sessions ON owner_sessions(owner_id,revoked_at,absolute_expires_at);
CREATE INDEX project_credentials_scope ON project_credentials(owner_id,project_id,role,revoked_at);
CREATE INDEX stage_lookup ON stage_artifacts(project_id,part,stage,content_version);
CREATE INDEX discussion_lookup ON discussions(project_id,origin_artifact_id,item_trace_id,state);
CREATE INDEX message_order ON messages(project_id,discussion_id,sequence);
CREATE INDEX agent_queue ON agent_work(project_id,state,lease_expires_at);
CREATE INDEX checkpoint_lookup ON checkpoint_requests(project_id,artifact_id,state);
CREATE INDEX receipt_expiry ON idempotency_receipts(expires_at);
CREATE INDEX journal_recovery ON write_journal(project_id,sequence);
