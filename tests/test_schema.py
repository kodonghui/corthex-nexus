"""The stage-05 schema in `db/nexus.sql` and the migrations in `db/migrations/`.

The tests use only Python's own `sqlite3`, the SQLite that D1 also runs; nothing is installed or fetched.

- The schema loads into an empty database with foreign keys on, and passes SQLite's integrity and foreign-key checks.
- The migrations, applied in order to an empty database, build the same tables, indexes and columns as the schema.
- Every table has a `-- TBL-…` comment right above it, the IDs run in order without a gap or a repeat, and each
  comment names a context or `operations` and its glossary terms or `terms: none`.
- Every foreign key points at a table and columns the schema has.
- Rules the database holds refuse what they should: a project name outside the allowed form, a second live
  confirmation of one diagram, an agent's sticky note without a confidence label, a second live claim of one to-do.
"""

import re
import sqlite3
import unittest
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "db" / "nexus.sql"
MIGRATIONS = ROOT / "db" / "migrations"
HEAD = re.compile(r"^-- (TBL-\d{3}) (\w+) \((CTX-\d{3}|operations)\) ← .+ \| terms: (none|TERM-\d{3}(, TERM-\d{3})*)$")


def load(*scripts):
    db = sqlite3.connect(":memory:")
    db.execute("PRAGMA foreign_keys = ON")
    for script in scripts:
        db.executescript(script.read_text(encoding="utf-8"))
    return db


def shape(*scripts):
    """Tables and indexes with their SQL, and each table's columns and foreign keys."""
    with closing(load(*scripts)) as db:
        return read_shape(db)


def read_shape(db):
    objects = {}
    for kind, name, table, sql in db.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name"):
        objects[name] = (kind, table, " ".join((sql or "").split()))
    columns = {name: db.execute("PRAGMA table_xinfo(%s)" % name).fetchall()
               for name, (kind, _, _) in objects.items() if kind == "table"}
    keys = {name: db.execute("PRAGMA foreign_key_list(%s)" % name).fetchall() for name in columns}
    return objects, columns, keys


class SchemaTest(unittest.TestCase):
    def test_schema_loads_and_checks_clean(self):
        with closing(load(SCHEMA)) as db:
            self.assertEqual(db.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_migrations_rebuild_the_schema(self):
        migrations = sorted(MIGRATIONS.glob("[0-9][0-9][0-9][0-9]_*.sql"))
        self.assertTrue(migrations, "no migration in db/migrations")
        numbers = [int(path.name[:4]) for path in migrations]
        self.assertEqual(numbers, list(range(1, len(numbers) + 1)), "migrations are numbered 0001 up without a gap")
        self.assertEqual(shape(*migrations), shape(SCHEMA))

    def test_every_table_has_a_trace_id(self):
        lines = SCHEMA.read_text(encoding="utf-8").splitlines()
        heads, tables = [], []
        for number, line in enumerate(lines):
            match = re.match(r"CREATE TABLE (\w+) \(", line)
            if not match:
                continue
            tables.append(match.group(1))
            above = number - 1
            while above >= 0 and lines[above].startswith("-- ") and not lines[above].startswith("-- TBL-"):
                above -= 1
            head = HEAD.match(lines[above]) if above >= 0 else None
            self.assertIsNotNone(head, "%s has no TBL comment above it" % match.group(1))
            self.assertEqual(head.group(2), match.group(1), "the TBL comment names another table")
            heads.append(int(head.group(1)[4:]))
        self.assertEqual(heads, list(range(heads[0], heads[0] + len(heads))), "TBL IDs run in order")
        objects, _, _ = shape(SCHEMA)
        self.assertEqual(sorted(tables), sorted(name for name, (kind, _, _) in objects.items() if kind == "table"))

    def test_foreign_keys_point_at_real_columns(self):
        _, columns, keys = shape(SCHEMA)
        for table, rows in keys.items():
            for row in rows:
                target, source, to = row[2], row[3], row[4]
                self.assertIn(target, columns, "%s refers to a missing table %s" % (table, target))
                names = {column[1] for column in columns[target]}
                self.assertIn(to, names, "%s.%s refers to a missing column %s.%s" % (table, source, target, to))

    def test_rules_refuse_what_they_should(self):
        t = "2026-11-23T00:00:00.000Z"
        with closing(load(SCHEMA)) as db:
            db.execute("INSERT INTO agent_credentials (id, name, secret_digest, issued_at) VALUES (1, 'laptop', ?, ?)",
                       ("0" * 64, t))
            add = "INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES (?, ?, 1)"
            db.execute(add, ("corthex-nexus", t))
            for bad in ("", "Upper", "under_score", "x" * 65):
                with self.subTest(name=bad), self.assertRaises(sqlite3.IntegrityError):
                    db.execute(add, (bad, t))
            db.execute("INSERT INTO snapshots (id, project_id, revision, commit_sha, format_version, bytes, received_at, "
                       "credential_id) VALUES (1, 1, 1, 'a', '1', 0, ?, 1)", (t,))
            db.execute("INSERT INTO diagrams (id, project_id, stage, source_key, kind, name, created_at) "
                       "VALUES (1, 1, '05-erd', '05-erd', 'erd', 'ERD', ?)", (t,))
            db.execute("INSERT INTO drawings (id, diagram_id, snapshot_id, document_version, status, source_digest, "
                       "drawn_at) VALUES (1, 1, 1, 'a', 'drawn', 'd', ?)", (t,))
            confirm = "INSERT INTO confirmations (diagram_id, drawing_id, state, confirmed_at) VALUES (1, 1, 'confirmed', ?)"
            db.execute(confirm, (t,))
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(confirm, (t,))
            db.execute("INSERT INTO workshops (id, project_id, state, opened_at) VALUES (1, 1, 'open', ?)", (t,))
            db.execute("INSERT INTO workshop_steps (workshop_id, step) VALUES (1, '2')")
            note = ("INSERT INTO sticky_notes (workshop_id, step, kind, body, x, y, made_by, credential_id, confidence, "
                    "created_at) VALUES (1, '2', 'event', 'Snapshot received', 0, 0, 'agent', 1, ?, ?)")
            db.execute(note, ("guess", t))
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(note, (None, t))
            db.execute("INSERT INTO todos (id, project_id, side, kind, diagram_id, created_at) "
                       "VALUES (1, 1, 'agent', 'reflect', 1, ?)", (t,))
            claim = ("INSERT INTO claims (todo_id, session, credential_id, claimed_at, last_write_at) "
                     "VALUES (1, ?, 1, ?, ?)")
            db.execute(claim, ("S1", t, t))
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(claim, ("S2", t, t))


if __name__ == "__main__":
    unittest.main()
