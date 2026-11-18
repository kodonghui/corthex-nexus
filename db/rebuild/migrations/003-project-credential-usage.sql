-- Keep operational timestamps beside the version-1 acknowledged credential table.
CREATE TABLE IF NOT EXISTS project_credential_usage (
  credential_id TEXT PRIMARY KEY REFERENCES project_credentials(id) ON DELETE RESTRICT,
  last_used_at TEXT NOT NULL
) WITHOUT ROWID;
