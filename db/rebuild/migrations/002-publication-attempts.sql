-- Operational diagnostics for SCR-137. This additive table is outside the
-- version-1 write-journal protocol so the previous runtime can still open the database.
CREATE TABLE IF NOT EXISTS publication_attempts (
  sequence INTEGER PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  attempted_commit TEXT NOT NULL CHECK(length(attempted_commit) IN (40,64) AND attempted_commit NOT GLOB '*[^a-f0-9]*'),
  attempted_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('received','replayed','retryable_failure','refused')),
  why TEXT,
  trace_id TEXT CHECK(length(trace_id)=36),
  receipt_id TEXT,
  CHECK((outcome IN ('received','replayed') AND receipt_id IS NOT NULL AND why IS NULL AND trace_id IS NULL)
    OR (outcome IN ('retryable_failure','refused') AND receipt_id IS NULL AND why IS NOT NULL AND trace_id IS NOT NULL)),
  FOREIGN KEY(project_id,receipt_id,attempted_commit) REFERENCES publications(project_id,id,commit_sha) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS publication_attempts_project_recent ON publication_attempts(project_id,sequence DESC);
