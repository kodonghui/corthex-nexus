CREATE TABLE thread_resolution_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id   INTEGER NOT NULL REFERENCES comment_threads (id) ON DELETE CASCADE,
  event       TEXT NOT NULL CHECK (event IN ('resolved', 'reopened')),
  detail      TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(detail) AND json_type(detail) = 'object'),
  created_at  TEXT NOT NULL
);
CREATE INDEX thread_resolution_events_by_thread ON thread_resolution_events (thread_id, id);
