"""TASK-280 (TC-1781, TC-1782): the statements that stage 05 plans for the design revision of 2026-11-11, run on
Python's sqlite3 as the ERD guide gives them, on a database of schema 4, as nexus.sql was before migration 5 took them
(TASK-295). nexus/test/revision-statements.test.js runs the same on node:sqlite, and nexus/test/migrations.test.js holds
schema-4.sql equal to the server's migrations 1 to 4. TASK-295 (TC-1784): schema 4 and the statements make nexus.sql."""

import re
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "docs/05-erd/nexus.sql").read_text(encoding="utf8")
SCHEMA_4 = (ROOT / "nexus/test/schema-4.sql").read_text(encoding="utf8")
GUIDE = (ROOT / "docs/05-erd/nexus.md").read_text(encoding="utf8")
STAGE = "04-functional-spec"
COMMIT = "3f1c9a7e5b2d4c6a8e0f1b3d5c7a9e1f2b4d6c8a"
SNAPSHOT = ("INSERT INTO snapshots (name, revision, generated_ms, generated_at, received_at, bytes, body, default_commit) "
            "VALUES (?, 1, 1762135200000, '2026-11-11T10:00:00+09:00', '2026-11-11T01:00:00Z', 2, '{}', ?)")
COMMENT = ("INSERT INTO comments (id, project, part, stage, item, commit_id, author, text, state, closed_as, waits, asks, "
           "made_at, last_at) VALUES (?, ?, 'nexus', ?, '', ?, 'agent', ?, ?, ?, ?, ?, ?, ?)")
TABLES = ["snapshots", "project_spaces", "pictures", "discrepancies", "comments", "replies", "decisions", "proposals",
          "edits", "checkpoints", "claims", "writes"]


def planned_statements():
    """The SQL block of "The revision's migrations", split into its statements."""
    section = GUIDE.split("\n### The revision's migrations\n")[1].split("\n### ")[0]
    block = re.search(r"```sql\n(.*?)```", section, re.S).group(1)
    return [re.sub(r"\n\s*", " ", statement.strip()) for statement in re.split(r";\s*(?:\n|$)", block) if statement.strip()]


def seeded():
    """The database of nexus/test/revision-fixture.js, row for row."""
    db = sqlite3.connect(":memory:", isolation_level=None)
    db.execute("PRAGMA foreign_keys = ON")
    db.executescript(SCHEMA_4)
    for name in ("synthetic", "neighbour", "bare"):
        db.execute(SNAPSHOT, (name, COMMIT))
    for name in ("synthetic", "neighbour"):
        db.execute("INSERT INTO project_spaces (project, created_at) VALUES (?, '2026-11-11T01:00:00Z')", (name,))

    def comment(id_, project, stage, state, closed_as, waits, asks, at):
        db.execute(COMMENT, (id_, project, stage, COMMIT, "Comment " + id_, state, closed_as, waits, asks, at, at))

    comment("nc_request_old1", "synthetic", STAGE, "open", None, "user", "checkpoint", "2026-11-11T01:01:00Z")
    comment("nc_request_old2", "synthetic", STAGE, "open", None, "user", "checkpoint", "2026-11-11T01:02:00Z")
    comment("nc_request_new", "synthetic", STAGE, "open", None, "user", "checkpoint", "2026-11-11T01:03:00Z")
    comment("nc_asks_answer", "synthetic", STAGE, "open", None, "user", "answer", "2026-11-11T01:04:00Z")
    comment("nc_waits_agent", "synthetic", "05-erd", "open", None, "agent", None, "2026-11-11T01:05:00Z")
    comment("nc_closed", "synthetic", STAGE, "closed", "answered", None, None, "2026-11-11T01:06:00Z")
    comment("nc_neighbour", "neighbour", STAGE, "open", None, "user", "checkpoint", "2026-11-11T01:07:00Z")
    db.execute("INSERT INTO replies (comment, seq, author, text, made_at) VALUES ('nc_closed', 1, 'user', 'Answered.', '2026-11-11T01:06:30Z')")
    db.execute("INSERT INTO decisions (comment, seq, link, text, made_at) VALUES ('nc_closed', 1, 'https://example.com/decision', 'Kept.', '2026-11-11T01:06:40Z')")
    db.execute("INSERT INTO checkpoints (id, project, part, stage, commit_id, words, state, passed_at) VALUES ('ck_passed', 'synthetic', 'nexus', '03-user-flow', ?, 'The flows as drafted.', 'passed', '2026-11-11T01:08:00Z')", (COMMIT,))
    db.execute("INSERT INTO pictures (project, part, stage, commit_id, committed_at, source, digest, drawn_at) VALUES ('synthetic', 'nexus', '05-erd', ?, '2026-11-11T00:00:00Z', 'CREATE TABLE a (b TEXT);', 'digest', '2026-11-11T01:00:00Z')", (COMMIT,))
    db.execute("INSERT INTO discrepancies (id, project, part, compares, term, item, reasons, level, state, opened_commit, opened_at) VALUES ('nd_one', 'synthetic', 'nexus', 'aggregate-table', 'TERM-101', 'TBL-101', '[]', 'warn', 'open', ?, '2026-11-11T01:00:00Z')", (COMMIT,))
    db.execute("INSERT INTO proposals (id, project, part, stage, commit_id, items, reason, change, state, made_at, closed_at) VALUES ('np_one', 'synthetic', 'nexus', '05-erd', ?, '[\"TBL-101\"]', 'A reason', 'A change', 'accepted', '2026-11-11T01:00:00Z', '2026-11-11T01:09:00Z')", (COMMIT,))
    db.execute("INSERT INTO edits (id, project, part, stage, commit_id, proposal, state, made_at, changed_at) VALUES ('ne_one', 'synthetic', 'nexus', '05-erd', ?, 'np_one', 'pending', '2026-11-11T01:09:00Z', '2026-11-11T01:09:00Z')", (COMMIT,))
    db.execute("INSERT INTO claims (entry, project, session, claimed_at, ends_at) VALUES ('nc_waits_agent', 'synthetic', 'session-a', '2026-11-11T01:10:00Z', '2026-11-11T02:10:00Z')")
    db.execute("INSERT INTO writes (project, id, request, result, received_at) VALUES ('synthetic', 'w_one', 'POST /comments', '{}', '2026-11-11T01:10:00Z')")
    return db


def checks(sql):
    """The CHECK expressions of a table's statement, each on one line, sorted."""
    found, at = [], 0
    for match in re.finditer(r"\bCHECK\s*\(", sql, re.I):
        if match.start() < at:
            continue
        depth, end, quote = 1, match.end(), ""
        while end < len(sql) and depth:
            ch = sql[end]
            if quote:
                if ch == quote:
                    quote = ""
            elif ch in "'\"":
                quote = ch
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            end += 1
        found.append(re.sub(r"\s+", " ", sql[match.end():end - 1]).strip())
        at = end
    return sorted(found)


def describe(db):
    """Tables, columns, keys, indexes and CHECKs, as nexus/test/migrations.test.js compares them."""
    tables = []
    for name, sql in db.execute("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
        indexes = []
        for row in db.execute('PRAGMA index_list("%s")' % name):
            index_sql = (db.execute("SELECT sql FROM sqlite_master WHERE name = ?", (row[1],)).fetchone() or ("",))[0] or ""
            where = re.search(r"\bWHERE\s+(.+)$", index_sql, re.I | re.S)
            indexes.append((row[1], row[2], row[3], row[4], db.execute('PRAGMA index_info("%s")' % row[1]).fetchall(),
                            where.group(1) if where else ""))
        tables.append((name, db.execute('PRAGMA table_info("%s")' % name).fetchall(),
                       db.execute('PRAGMA foreign_key_list("%s")' % name).fetchall(), sorted(indexes), checks(sql)))
    return tables


def counts(db):
    return {table: db.execute("SELECT COUNT(*) FROM " + table).fetchone()[0] for table in TABLES}


class RevisionStatementsTest(unittest.TestCase):
    def test_TC_1781_statements_keep_every_row_and_the_index_alone_is_refused(self):
        statements = planned_statements()
        self.assertEqual(len(statements), 11)
        self.assertRegex(statements[-1], r"^CREATE UNIQUE INDEX comments_request ON comments \(project, part, stage\) WHERE state = 'open' AND asks = 'checkpoint'$")
        self.assertTrue(statements[-2].startswith("UPDATE comments SET asks = 'answer'"))

        alone = seeded()
        for statement in statements:
            if statement.startswith("UPDATE"):
                continue
            if statement.startswith("CREATE UNIQUE INDEX"):
                with self.assertRaisesRegex(sqlite3.IntegrityError, "UNIQUE constraint failed"):
                    alone.execute(statement)
            else:
                alone.execute(statement)
        alone.close()

        db = seeded()
        before = counts(db)
        for statement in statements:
            db.execute(statement)
        self.assertEqual(counts(db), before)
        self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])
        self.assertEqual(db.execute("SELECT id, state, waits, asks FROM comments WHERE project = 'synthetic' AND stage = ? "
                                    "AND id LIKE 'nc_request%' ORDER BY id", (STAGE,)).fetchall(), [
            ("nc_request_new", "open", "user", "checkpoint"),
            ("nc_request_old1", "open", "user", "answer"),
            ("nc_request_old2", "open", "user", "answer"),
        ])
        self.assertEqual(db.execute("SELECT asks FROM comments WHERE id = 'nc_neighbour'").fetchone()[0], "checkpoint")
        added = {"project_spaces": ["read_at", "read_session"], "comments": ["look_first"], "replies": ["look_first"],
                 "checkpoints": ["browser", "device", "driven", "snapshot_revision", "entry"]}
        for table, columns in added.items():
            names = [row[1] for row in db.execute("PRAGMA table_info(" + table + ")")]
            self.assertEqual(sorted(names[-len(columns):]), sorted(columns), table)
            for column in columns:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM " + table + " WHERE " + column + " IS NOT NULL").fetchone()[0], 0)
        db.close()

    def test_TC_1782_the_database_refuses_what_the_revision_forbids(self):
        db = seeded()
        for statement in planned_statements():
            db.execute(statement)
        with self.assertRaisesRegex(sqlite3.IntegrityError, "UNIQUE constraint failed"):
            db.execute(COMMENT, ("nc_request_second", "synthetic", STAGE, COMMIT, "Again", "open", None, "user", "checkpoint",
                                 "2026-11-11T02:00:00Z", "2026-11-11T02:00:00Z"))
        db.execute(COMMENT, ("nc_request_other_stage", "synthetic", "03-user-flow", COMMIT, "Another stage", "open", None, "user",
                             "checkpoint", "2026-11-11T02:00:00Z", "2026-11-11T02:00:00Z"))

        def checkpoint(column, value):
            db.execute("INSERT INTO checkpoints (id, project, part, stage, commit_id, state, passed_at, " + column + ") "
                       "VALUES (?, 'synthetic', 'nexus', '02-prd', ?, 'passed', '2026-11-11T02:00:00Z', ?)",
                       ("ck_%s_%s" % (column, value), COMMIT, value))

        for column, value in (("browser", "Mozilla/5.0"), ("browser", "CHROME"), ("device", "laptop"), ("driven", 2), ("entry", -1)):
            with self.assertRaisesRegex(sqlite3.IntegrityError, "CHECK constraint failed"):
                checkpoint(column, value)
        for column, value in (("browser", "chrome"), ("browser", "unknown"), ("device", "phone"), ("driven", 0), ("entry", 0)):
            checkpoint(column, value)
        read = "UPDATE project_spaces SET read_at = ?, read_session = ? WHERE project = ?"
        self.assertEqual(db.execute(read, ("2026-11-11T03:00:00.000Z", "session-a", "bare")).rowcount, 0)
        self.assertEqual(db.execute(read, ("2026-11-11T03:00:00.000Z", "session-a", "synthetic")).rowcount, 1)

        removed = [row[0] for row in db.execute("SELECT id FROM comments WHERE project = 'synthetic'")]
        neighbour = db.execute("SELECT COUNT(*) FROM comments WHERE project = 'neighbour'").fetchone()[0]
        self.assertEqual(db.execute("DELETE FROM snapshots WHERE name = ?", ("synthetic",)).rowcount, 1)
        for table in TABLES:
            if table in ("snapshots", "replies", "decisions"):
                continue
            self.assertEqual(db.execute("SELECT COUNT(*) FROM " + table + " WHERE project = 'synthetic'").fetchone()[0], 0, table)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM snapshots WHERE name = 'synthetic'").fetchone()[0], 0)
        for table in ("replies", "decisions"):
            left = [row[0] for row in db.execute("SELECT comment FROM " + table) if row[0] in removed]
            self.assertEqual(left, [], table)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM comments WHERE project = 'neighbour'").fetchone()[0], neighbour)
        self.assertEqual(db.execute("PRAGMA foreign_key_check").fetchall(), [])
        db.close()


    def test_TC_1784_schema_4_and_the_statements_make_nexus_sql(self):
        migrated = sqlite3.connect(":memory:", isolation_level=None)
        migrated.executescript(SCHEMA_4)
        for statement in planned_statements():
            migrated.execute(statement)
        expected = sqlite3.connect(":memory:", isolation_level=None)
        expected.executescript(SCHEMA)
        self.assertEqual(describe(migrated), describe(expected))
        migrated.close()
        expected.close()


if __name__ == "__main__":
    unittest.main()
