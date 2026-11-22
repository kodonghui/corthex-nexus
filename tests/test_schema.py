"""The stage-05 schema in `db/nexus.sql` and the migrations in `db/migrations/`.

The tests use only Python's own `sqlite3`, the SQLite that D1 also runs; nothing is installed or fetched.

- The schema loads into an empty database with foreign keys on, and passes SQLite's integrity and foreign-key checks.
- The migrations, applied in order to an empty database, build the same tables, indexes and columns as the schema.
- Every table has a `-- TBL-…` comment right above it, the IDs run in order without a gap or a repeat, and each
  comment names a context or `operations` and its glossary terms or `terms: none`.
- Every foreign key points at a table and columns the schema has.
- Rules the database holds refuse what they should: a project name outside the allowed form, a row that points at
  another project's or another diagram's rows, a second live confirmation of one diagram, an agent's sticky note
  without a confidence label, a sticky line across two workshops, a second live claim of one to-do, a document hash
  that is not lowercase hex, a drawing whose status and failure place disagree, and the same backup attempt twice.
- Deleting a project space deletes every row of it in every table, and nothing of another project.
- Every foreign key has an index whose first columns are its columns, except the keys to agent credentials, which
  are never deleted.
- Each table's terms name only aggregates of the domain design in the table's own context, every aggregate has a
  table, and the terms listed as without a table are exactly the read models no table names, so NEXUS finds no
  difference between the tables and the DDD board.
"""

import re
import sqlite3
import unicodedata
import unittest
from contextlib import closing
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "db" / "nexus.sql"
MIGRATIONS = ROOT / "db" / "migrations"
DOMAIN = ROOT / "docs" / "01-domain" / "nexus.md"
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

    def test_table_terms_are_the_aggregates_of_the_domain_design(self):
        domain = DOMAIN.read_text(encoding="utf-8")
        glossary, read_models = {}, set()
        for row in domain.splitlines():
            cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
            if row.startswith("| TERM-") and len(cells) >= 4:
                # NEXUS matches names ignoring Unicode case and spacing and takes the first of duplicate rows.
                glossary.setdefault(word(cells[1]), (cells[0], cells[3]))
                if "(read model)" in cells[2]:
                    read_models.add(cells[0])
        contexts = domain.split("## 3.", 1)[1].split("\n## ", 1)[0]
        aggregates = {}
        rows = [row for row in contexts.splitlines() if row.startswith("| CTX-")]
        self.assertTrue(rows, "no context row read from section 3 of the domain design")
        for row in rows:
            cells = [cell.strip() for cell in row.strip().strip("|").split("|")]
            context = cells[0].split()[0]
            names = [name for name in cells[2].split(",") if name.strip()]
            self.assertTrue(names, "%s lists no aggregate" % context)
            for name in names:
                self.assertIn(word(name), glossary, "aggregate %s has no glossary row" % name.strip())
                term, term_context = glossary[word(name)]
                self.assertEqual(term_context, context, "%s sits in another context in the glossary" % name.strip())
                aggregates[term] = context
        sql = SCHEMA.read_text(encoding="utf-8")
        named = set()
        for line in sql.splitlines():
            head = HEAD.match(line)
            if not head or head.group(4) == "none":
                continue
            for term in head.group(4).split(", "):
                with self.subTest(table=head.group(2), term=term):
                    self.assertIn(term, aggregates, "not an aggregate of the domain design")
                    self.assertEqual(aggregates[term], head.group(3), "the aggregate sits in another context")
                named.add(term)
        self.assertEqual(set(aggregates) - named, set(), "aggregates without a table")
        without = re.search(r"^-- without a table: (TERM-\d{3}(?:, TERM-\d{3})*)$", sql, re.M)
        self.assertIsNotNone(without, "db/nexus.sql has no '-- without a table:' line")
        self.assertEqual(set(without.group(1).split(", ")), read_models - named,
                         "the terms without a table are the read models no table names")

    def test_foreign_keys_point_at_real_columns(self):
        _, columns, keys = shape(SCHEMA)
        for table, rows in keys.items():
            for row in rows:
                target, source, to = row[2], row[3], row[4]
                self.assertIn(target, columns, "%s refers to a missing table %s" % (table, target))
                names = {column[1] for column in columns[target]}
                self.assertIn(to, names, "%s.%s refers to a missing column %s.%s" % (table, source, target, to))

    def test_rules_refuse_what_they_should(self):
        with closing(load(SCHEMA)) as db:
            add_credential(db)
            add = "INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES (?, ?, 1)"
            for bad in ("", "Upper", "under_score", "x" * 65):
                with self.subTest(name=bad), self.assertRaises(sqlite3.IntegrityError):
                    db.execute(add, (bad, T))
            fill_project(db, 1, "corthex-nexus")
            fill_project(db, 2, "pillbadeum")
            for case, (sql, values) in REFUSED.items():
                with self.subTest(case=case), self.assertRaises(sqlite3.IntegrityError):
                    db.execute(sql, values)
            db.execute("INSERT INTO backups (name, attempt, state, started_at) VALUES (?, 2, 'running', ?)",
                       (backup_name(1), T))
            # The hub reports a merge without its commit (stage-06 API corrections).
            db.execute("INSERT INTO pull_requests (project_id, purpose, number, state, reported_at, closed_at, "
                       "credential_id) VALUES (1, 'record', 2, 'merged', ?, ?, 1)", (T, T))

    def test_deleting_a_project_keeps_only_the_other(self):
        with closing(load(SCHEMA)) as db:
            add_credential(db)
            fill_project(db, 1, "corthex-nexus")
            fill_project(db, 2, "pillbadeum")
            tables = [name for (name,) in db.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")]
            count = {name: "SELECT count(*) FROM %s" % name for name in tables}
            before = {name: db.execute(sql).fetchone()[0] for name, sql in count.items()}
            shared = {"agent_credentials", "document_blobs", "request_keys", "backups", "restore_rehearsals"}
            for name in set(tables) - shared:
                self.assertTrue(before[name] and before[name] % 2 == 0, "%s is filled alike for both projects" % name)
            db.execute("DELETE FROM project_spaces WHERE id = 1")
            self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])
            for name, sql in count.items():
                expected = before[name] if name in shared else before[name] // 2
                self.assertEqual(db.execute(sql).fetchone()[0], expected, "%s after deleting one project" % name)
            self.assertEqual(db.execute("SELECT name FROM project_spaces").fetchall(), [("pillbadeum",)])
            for table, column in (("snapshots", "project_id"), ("diagrams", "project_id"), ("todos", "project_id"),
                                  ("claims", "project_id"), ("workshop_steps", "project_id")):
                self.assertEqual(db.execute("SELECT DISTINCT %s FROM %s" % (column, table)).fetchall(), [(2,)], table)

    def test_every_foreign_key_has_an_index(self):
        with closing(load(SCHEMA)) as db:
            for (table,) in db.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").fetchall():
                keys = {}
                for row in db.execute("PRAGMA foreign_key_list(%s)" % table):
                    keys.setdefault(row[0], (row[2], []))[1].append(row[3])
                leading = [[column[2] for column in db.execute("PRAGMA index_info(%s)" % index[1])]
                           for index in db.execute("PRAGMA index_list(%s)" % table).fetchall()]
                key = sorted((row for row in db.execute("PRAGMA table_info(%s)" % table) if row[5]), key=lambda r: r[5])
                leading.append([row[1] for row in key])
                for target, columns in keys.values():
                    if target == "agent_credentials":
                        continue
                    with self.subTest(table=table, key=columns):
                        self.assertTrue(any(cols[:len(columns)] == columns for cols in leading),
                                        "%s (%s) has no index" % (table, ", ".join(columns)))


T = "2026-11-23T00:00:00.000Z"


def add_credential(db):
    db.execute("INSERT INTO agent_credentials (id, name, secret_digest, issued_at) VALUES (1, 'laptop', ?, ?)",
               ("0" * 64, T))


def backup_name(n):
    return "nexus-2026-11-%02d.sqlite" % (20 + n)


# Rows that point across projects or diagrams, or break a rule, once both projects are filled.
REFUSED = {
    "a drawing from another project's snapshot": (
        "INSERT INTO drawings (project_id, diagram_id, snapshot_id, document_version, status, source_digest, drawn_at) "
        "VALUES (1, 101, 201, 'b', 'drawn', 'd', ?)", (T,)),
    "a drawing of another project's diagram": (
        "INSERT INTO drawings (project_id, diagram_id, snapshot_id, document_version, status, source_digest, drawn_at) "
        "VALUES (1, 201, 102, 'b', 'drawn', 'd', ?)", (T,)),
    "a thread at another diagram's drawing": (
        "INSERT INTO comment_threads (diagram_id, drawing_id, target_kind, state, waits_on, opened_at) "
        "VALUES (101, 201, 'diagram', 'open', 'agent', ?)", (T,)),
    "a direct edit reflected by another diagram's drawing": (
        "INSERT INTO change_sets (project_id, diagram_id, drawing_id, origin, state, created_at, reflected_drawing_id) "
        "VALUES (1, 101, 101, 'direct_edit', 'reflected', ?, 201)", (T,)),
    "a change set in another project's pull request": (
        "INSERT INTO change_sets (project_id, diagram_id, drawing_id, origin, state, created_at, pull_request_id) "
        "VALUES (1, 101, 101, 'direct_edit', 'accepted', ?, 201)", (T,)),
    "a confirmation at another diagram's drawing": (
        "INSERT INTO confirmations (project_id, diagram_id, drawing_id, state, confirmed_at, ended_at) "
        "VALUES (1, 101, 201, 'cancelled', ?, ?)", (T, T)),
    "a second live confirmation of one diagram": (
        "INSERT INTO confirmations (project_id, diagram_id, drawing_id, state, confirmed_at) "
        "VALUES (1, 101, 101, 'confirmed', ?)", (T,)),
    "a to-do about another project's diagram": (
        "INSERT INTO todos (project_id, side, kind, diagram_id, created_at) VALUES (1, 'agent', 'reflect', 201, ?)", (T,)),
    "a to-do about another diagram's thread": (
        "INSERT INTO todos (project_id, side, kind, diagram_id, thread_id, created_at) "
        "VALUES (1, 'agent', 'comment', 101, 201, ?)", (T,)),
    "a to-do about a thread without its diagram": (
        "INSERT INTO todos (project_id, side, kind, thread_id, created_at) VALUES (1, 'agent', 'comment', 101, ?)", (T,)),
    "a to-do about another project's workshop": (
        "INSERT INTO todos (project_id, side, kind, workshop_id, step, created_at) "
        "VALUES (1, 'agent', 'write_step', 201, '2', ?)", (T,)),
    "a claim of another project's to-do": (
        "INSERT INTO claims (project_id, todo_id, session, credential_id, claimed_at, last_write_at, released_at, "
        "release_reason) VALUES (1, 201, 'S9', 1, ?, ?, ?, 'done')", (T, T, T)),
    "a claim with another project's pull request": (
        "INSERT INTO claims (project_id, todo_id, session, credential_id, claimed_at, last_write_at, pull_request_id, "
        "released_at, release_reason) VALUES (1, 101, 'S9', 1, ?, ?, 201, ?, 'done')", (T, T, T)),
    "a second live claim of one to-do": (
        "INSERT INTO claims (project_id, todo_id, session, credential_id, claimed_at, last_write_at) "
        "VALUES (1, 101, 'S2', 1, ?, ?)", (T, T)),
    "a workshop step written in another project's pull request": (
        "INSERT INTO workshop_steps (project_id, workshop_id, step, pull_request_id) VALUES (1, 101, '3', 201)", ()),
    "an agent's sticky note without a confidence label": (
        "INSERT INTO sticky_notes (workshop_id, step, kind, body, x, y, made_by, credential_id, created_at) "
        "VALUES (101, '2', 'event', 'Snapshot received', 0, 0, 'agent', 1, ?)", (T,)),
    "a sticky line across two workshops": (
        "INSERT INTO sticky_links (workshop_id, from_note, to_note, made_by, created_at) "
        "VALUES (101, 101, 201, 'owner', ?)", (T,)),
    "an agent's sticky line without its credential": (
        "INSERT INTO sticky_links (workshop_id, from_note, to_note, made_by, created_at) "
        "VALUES (101, 101, 102, 'agent', ?)", (T,)),
    "a document hash that is not lowercase hex": (
        "INSERT INTO document_blobs (sha256, body, bytes) VALUES (?, '', 0)", ("A" * 64,)),
    "a failed drawing without where it failed": (
        "INSERT INTO drawings (project_id, diagram_id, snapshot_id, document_version, status, source_digest, drawn_at) "
        "VALUES (1, 101, 102, 'b', 'failed', 'd', ?)", (T,)),
    "a drawn drawing that says where it failed": (
        "INSERT INTO drawings (project_id, diagram_id, snapshot_id, document_version, status, source_digest, "
        "failed_path, drawn_at) VALUES (1, 101, 102, 'b', 'drawn', 'd', 'db/nexus.sql', ?)", (T,)),
    "the same backup attempt twice": (
        "INSERT INTO backups (name, attempt, state, started_at) VALUES (?, 1, 'failed', ?)", (backup_name(1), T)),
    "a comment whose detail is not JSON": (
        "INSERT INTO comments (thread_id, seq, author, body, detail, created_at) VALUES (101, 2, 'owner', 'Why?', '{', ?)",
        (T,)),
    "a change set whose detail is not JSON": (
        "INSERT INTO change_sets (project_id, diagram_id, drawing_id, origin, state, created_at, detail) "
        "VALUES (1, 101, 101, 'direct_edit', 'accepted', ?, 'reason')", (T,)),
}


def word(name):
    """A glossary name as NEXUS matches it: Unicode NFC, no spacing, lower case."""
    return re.sub(r"\s+", "", unicodedata.normalize("NFC", name)).lower()


def fill_project(db, n, name):
    """Fill every table of one project; its row IDs start at n * 100 + 1."""
    i, t = n * 100, T
    rows = [
        ("project_spaces (id, name, created_at, created_by_credential)", (n, name, t, 1)),
        ("snapshots (id, project_id, revision, commit_sha, format_version, bytes, received_at, credential_id)",
         (i + 1, n, 1, "a%d" % n, "1", 0, t, 1)),
        ("snapshots (id, project_id, revision, commit_sha, format_version, bytes, received_at, credential_id)",
         (i + 2, n, 2, "b%d" % n, "1", 0, t, 1)),
        ("document_blobs (sha256, body, bytes)", ("%064x" % n, "", 0)),
        ("snapshot_files (snapshot_id, path, stage, blob_sha256)", (i + 1, "db/nexus.sql", "05-erd", "%064x" % n)),
        ("diagrams (id, project_id, stage, source_key, kind, name, created_at)",
         (i + 1, n, "05-erd", "05-erd", "erd", "ERD", t)),
        ("drawings (id, project_id, diagram_id, snapshot_id, document_version, status, source_digest, drawn_at)",
         (i + 1, n, i + 1, i + 1, "a", "drawn", "d", t)),
        ("drawings (id, project_id, diagram_id, snapshot_id, document_version, status, source_digest, failed_path, "
         "failed_line, drawn_at)", (i + 2, n, i + 1, i + 2, "b", "failed", "d", "db/nexus.sql", 3, t)),
        ("elements (drawing_id, element_key, kind, name)", (i + 1, "TBL-146", "table", "agent_credentials")),
        ("element_positions (diagram_id, element_key, x, y, moved_at)", (i + 1, "TBL-146", 0, 0, t)),
        ("comment_threads (id, diagram_id, drawing_id, target_kind, element_key, state, waits_on, opened_at)",
         (i + 1, i + 1, i + 1, "element", "TBL-146", "open", "agent", t)),
        ("comments (thread_id, seq, author, body, created_at)", (i + 1, 1, "owner", "Why?", t)),
        ("pull_requests (id, project_id, purpose, number, state, reported_at, credential_id)",
         (i + 1, n, "reflection", 1, "open", t, 1)),
        ("change_sets (id, project_id, diagram_id, drawing_id, origin, thread_id, credential_id, state, created_at, "
         "pull_request_id)", (i + 1, n, i + 1, i + 1, "proposal", i + 1, 1, "accepted", t, i + 1)),
        ("changes (change_set_id, seq, op, element_key, new_name)", (i + 1, 1, "rename", "TBL-146", "keys")),
        ("confirmations (id, project_id, diagram_id, drawing_id, state, confirmed_at, record_pull_request_id)",
         (i + 1, n, i + 1, i + 1, "confirmed", t, i + 1)),
        ("stage_passes (project_id, stage, passed_at)", (n, "05-erd", t)),
        ("workshops (id, project_id, state, opened_at)", (i + 1, n, "open", t)),
        ("workshop_steps (project_id, workshop_id, step, pull_request_id)", (n, i + 1, "2", i + 1)),
        ("sticky_notes (id, workshop_id, step, kind, body, x, y, made_by, created_at)",
         (i + 1, i + 1, "2", "event", "Snapshot received", 0, 0, "owner", t)),
        ("sticky_notes (id, workshop_id, step, kind, body, x, y, made_by, created_at)",
         (i + 2, i + 1, "2", "event", "Diagram drawn", 0, 0, "owner", t)),
        ("sticky_links (workshop_id, from_note, to_note, made_by, credential_id, created_at)",
         (i + 1, i + 1, i + 2, "agent", 1, t)),
        ("todos (id, project_id, side, kind, diagram_id, thread_id, created_at)",
         (i + 1, n, "agent", "comment", i + 1, i + 1, t)),
        ("todos (project_id, side, kind, diagram_id, change_set_id, created_at)",
         (n, "agent", "remove_from_pr", i + 1, i + 1, t)),
        ("todos (project_id, side, kind, diagram_id, confirmation_id, created_at)",
         (n, "agent", "record_confirmation", i + 1, i + 1, t)),
        ("todos (project_id, side, kind, workshop_id, step, created_at)", (n, "agent", "write_step", i + 1, "2", t)),
        ("claims (project_id, todo_id, session, credential_id, claimed_at, last_write_at, pull_request_id)",
         (n, i + 1, "S1", 1, t, t, i + 1)),
        ("tool_links (project_id, scope, tool, url, added_at)",
         (n, "project", "notion", "https://www.notion.so/example-%d" % n, t)),
        ("request_keys (actor, request_key, action, status_code, answer, created_at)",
         ("owner", "k%d" % n, "push", 200, "{}", t)),
        ("backups (id, name, attempt, state, started_at)", (i + 1, backup_name(n), 1, "succeeded", t)),
        ("restore_rehearsals (release, backup_id, result, rehearsed_at)", ("v3.0.%d" % n, i + 1, "succeeded", t)),
    ]
    for into, values in rows:
        db.execute("INSERT INTO %s VALUES (%s)" % (into, ", ".join("?" * len(values))), values)


if __name__ == "__main__":
    unittest.main()
