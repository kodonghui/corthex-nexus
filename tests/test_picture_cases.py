"""NEXUS's own SQL and YAML readers read the cases below as the pinned hub reads them (TASK-466).

A proposal's source_text on stage 05 or 07 is SQL or YAML, which NEXUS reads itself with `server/src/sql-picture.js`
and `server/src/sitemap-picture.js`, ports of the pinned hub's erd.py and sitemap.py with their helpers in hub.py.
`server/test/picture-readers.test.js` checks that those readers make, of db/nexus.sql and docs/07-sitemap/nexus.yaml,
the pictures `tests/test_erd_picture.py` and `tests/test_sitemap_picture.py` keep, and, of each case below, the
picture and checks that `server/test/picture-cases.json` stores. The cases are what this repository's two files do
not show: other SQL dialects, comments and markers, the YAML template's errors, line breaks and limits.

This test makes the stored file again with the pinned hub, the clean checkout at the commit of `hub-ref.json` that
`CORTHEX_HUB_CHECKOUT` names (prepare it with `python tools/fetch_hub_ref.py`), and fails when it differs: when a case
here changed, or when a new hub pin reads one otherwise. Nothing is fetched and no server is contacted.

A case's `ids` are the project's trace ID settings, `{kind: prefix}`, which the hub reads in place of its defaults and
NEXUS adds to them. A case with `shape` set stores the picture's shape: each list longer than three as its count, first
and last, so that the limits' cases stay small.

To make the file again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_picture_cases.py --write
"""

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import locate_hub  # noqa: E402

SCRIPTS = "plugins/corthex-nexus/skills/corthex-hub/scripts"
FIXTURE = ROOT / "server" / "test" / "picture-cases.json"
ABOUT = ("The pinned hub's pictures and checks of SQL and YAML texts this repository's own files do not show, which "
         "NEXUS's readers must make alike. tests/test_picture_cases.py checks them against the pinned hub and says how "
         "to make them again.")


def text(*lines, end="\n"):
    return end.join(lines) + end


def case(name, stage, documents, ids=None, part="nexus", shape=False):
    return {"name": name, "stage": stage, "ids": ids, "part": part, "shape": shape,
            "documents": [[file, body] for file, body in documents]}


SQL = "05-erd"
YAML = "07-sitemap"

CASES = [
    case("SQL, MySQL: backslash strings, a comment after the columns, keys and a foreign key added later", SQL, [("db/mysql.sql", text(
        "-- TBL-1 users of CTX-1, with TERM-1 and TERM-2",
        "CREATE TABLE IF NOT EXISTS `users` (",
        "  `id` INT NOT NULL AUTO_INCREMENT,",
        "  `name` VARCHAR(20) DEFAULT 'it\\'s',",
        "  `note` TEXT COMMENT 'can\\'t; stop',",
        "  `kind` ENUM('a', 'ops@example.com') NOT NULL,",
        "  `price` DECIMAL( 10 , 2 ) UNSIGNED,",
        "  PRIMARY KEY (`id`),",
        "  UNIQUE KEY `name_unique` (`name`),",
        "  KEY `kind_index` (`kind`)",
        ") ENGINE=InnoDB COMMENT='TBL-1 users of CTX-1, with TERM-1, TERM-2 and TERM-1';",
        "# a MySQL comment",
        "#not a comment",
        "CREATE TABLE `orders` (",
        "  `id` INT PRIMARY KEY,",
        "  `user_id` INT REFERENCES `users` (`id`) ON DELETE CASCADE,",
        "  `ref` CHAR(3) UNIQUE",
        ") COMMENT = 'TBL-2 orders | status: deleted';",
        "ALTER TABLE `orders` ADD CONSTRAINT `fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;",
    ))]),
    case("SQL, PostgreSQL: schemas, quoted names, COMMENT ON, unique indexes, dollar and E strings", SQL, [("db/postgres.sql", text(
        'CREATE TABLE IF NOT EXISTS public."Accounts" (',
        "  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,",
        '  "display ""name""" text NOT NULL,',
        '  code text COLLATE "C",',
        "  owner_id bigint,",
        "  CONSTRAINT accounts_owner_fk FOREIGN KEY (owner_id) REFERENCES app.users (id) ON DELETE RESTRICT,",
        "  CHECK (code <> ''),",
        "  EXCLUDE USING gist (code WITH =)",
        ");",
        "COMMENT ON TABLE public.\"Accounts\" IS 'TBL-3 accounts (CTX-2) terms: none';",
        'CREATE UNIQUE INDEX accounts_code ON ONLY public."Accounts" USING btree (code COLLATE "C" DESC NULLS LAST) WHERE code IS NOT NULL;',
        'CREATE UNIQUE INDEX accounts_lower ON public."Accounts" (lower(code));',
        'CREATE UNIQUE INDEX accounts_pair ON public."Accounts" (code ASC, owner_id);',
        'CREATE INDEX accounts_owner ON public."Accounts" (owner_id);',
        "CREATE TABLE app.users (id bigint PRIMARY KEY, email text);",
        "CREATE TABLE audit.users (id bigint PRIMARY KEY);",
        'ALTER TABLE ONLY users ADD FOREIGN KEY (id) REFERENCES public."Accounts" (id);',
        'ALTER TABLE IF EXISTS app.users ADD CONSTRAINT users_account FOREIGN KEY (id) REFERENCES public."Accounts" (id) ON DELETE NO ACTION, ADD COLUMN x int;',
        "CREATE FUNCTION touch() RETURNS trigger AS $body$ BEGIN NEW.at := now(); RETURN NEW; END; $body$ LANGUAGE plpgsql;",
        "CREATE TABLE notes (body text DEFAULT E'line\\nnext\\\\', tag text DEFAULT $$a;b$$, PRIMARY KEY (body, tag, body));",
        "COMMENT ON COLUMN notes.body IS 'TBL-99 not a table comment';",
        "CREATE TEMPORARY TABLE scratch (x int);",
        "CREATE TABLE no_columns;",
        "/* an unclosed comment",
        "CREATE TABLE hidden (x int);",
    ))]),
    case("SQL, a backslash before a quote that is a character, as in PostgreSQL", SQL, [("db/paths.sql", text(
        "INSERT INTO settings VALUES ('C:\\');",
        "-- TBL-4 settings",
        "CREATE TABLE settings (path text);",
    ))], part=""),
    case("SQL, SQL Server and Oracle: brackets, GO and / lines, MS_Description properties", SQL, [("db/server.sql", text(
        "CREATE TABLE [dbo].[Items] (",
        "  [Id] INT NOT NULL,",
        "  [Name] NVARCHAR(50) NULL,",
        "  [Owner Id] INT NULL,",
        "  CONSTRAINT [PK_Items] PRIMARY KEY CLUSTERED ([Id] ASC),",
        "  CONSTRAINT [FK_Items_Owner] FOREIGN KEY ([Owner Id]) REFERENCES [dbo].[Owners] ([Id])",
        ")",
        "GO",
        "EXEC sp_addextendedproperty @name = N'MS_Description', @value = N'TBL-5 items (Deprecated)', @level0type = N'SCHEMA', "
        "@level0name = N'dbo', @level1type = N'TABLE', @level1name = N'Items';",
        "GO 2",
        "EXEC sys.sp_addextendedproperty N'MS_Description', N'TBL-6 item names', N'SCHEMA', N'dbo', N'TABLE', N'Items', N'COLUMN', N'Name'",
        "GO",
        "EXECUTE sp_updateextendedproperty @name = N'MS_Description', @value = N'TBL-7 owners', @level1type = N'TABLE', @level1name = N'Owners', @ = N'x'",
        "go",
        "CREATE TABLE dbo.Owners (Id INT PRIMARY KEY) -- TBL-70 owners",
        "GO",
        "CREATE UNIQUE NONCLUSTERED INDEX [IX_Name] ON [dbo].[Items] ([Name]) WHERE [Name] IS NOT NULL",
        "GO",
        "SELECT [unclosed bracket name",
        "FROM x [a [b] y;",
        "CREATE TABLE ledger (",
        "  id NUMBER(10) NOT NULL,",
        "  amount NUMBER(12, 2) DEFAULT 0.5",
        ")",
        "/",
    ))]),
    case("SQL comments: table markers, removed words and the status field", SQL, [("db/marks.sql", text(
        "-- without a table: TERM-9, TERM-10 and CTX-3",
        "-- WITHOUT A TABLE: TERM-11",
        "-- w\u0130thout a table: TERM-12",
        "-- w\u0131thout a table: TERM-14",
        "-- without a table TERM-13",
        "-- TBL-8 ledger (Status: 'active', removed)",
        "CREATE TABLE ledger (x int);",
        "-- TBL-9 journal | obsolete",
        "CREATE TABLE journal (x int);",
        '-- TBL-10 drafts (status: "removed")',
        "CREATE TABLE drafts (x int);",
        "-- TBL-11 [archived (removed)] entries",
        "CREATE TABLE entries (x int);",
        "-- TBL-12 first",
        "-- TBL-13 second, the last one counts",
        "CREATE TABLE twice (x int); -- TBL-14 on the line where it ends",
        "CREATE TABLE trailing (x int); -- TBL-15 trailing",
        "CREATE TABLE plain (x int, y int REFERENCES trailing, CONSTRAINT u UNIQUE (x, y), UNIQUE (y));",
        "COMMENT ON TABLE plain IS 'TBL-16 plain (status:",
        "removed)';",
        "COMMENT ON TABLE entries IS 'TBL-17 entries (status: removed",
        "';",
    ))], part=""),
    case("SQL, line breaks other than a line feed, Unicode names and case folding", SQL, [("db/unicode.sql",
        "-- TBL-18 \ud68c\uc6d0\r\nCREATE TABLE \"\ud68c\uc6d0\" (\r\n  \"\uc774\ub984\" TEXT NOT NULL, -- \uc774\ub984\u2028  \ub098\uc774 INT\r\n"
        "  \"\uac00\uc785\" DATE\r\n);\r\nCREATE TABLE \"Stra\u00dfe\" (x INT);\x85"
        "ALTER TABLE STRASSE ADD FOREIGN KEY (x) REFERENCES \"\ud68c\uc6d0\" (\"\uc774\ub984\");\r"
        "CREATE TABLE \"\u039f\u0394\u039f\u03a3\" (x INT);\vALTER TABLE \"\u03bf\u03b4\u03bf\u03c2\" ADD FOREIGN KEY (x) REFERENCES \"\ud68c\uc6d0\";\f"
        "-- TBL-19 \u3000wide spaces\u3000\x1c\nCREATE TABLE wide (x INT);\u2029CREATE TABLE \ud68c\uc6d02 (x INT);")]),
    case("SQL, a project's own trace ID prefixes", SQL, [("db/own.sql", text(
        "-- T-1 users of C-2 with G-3",
        "CREATE TABLE users (id int);",
        "-- without a table: G-4",
    ))], ids={"table": "T", "context": "C", "term": "G"}),
    case("SQL, more than 500 tables", SQL, [("db/first.sql", "CREATE TABLE first (x INT);\n"),
                                       ("db/many.sql", "".join("CREATE TABLE t%d (x INT);\n" % n for n in range(501)))],
         shape=True),
    case("SQL, a table over its limits of columns, unique rules and foreign keys", SQL, [("db/wide.sql", text(
        "CREATE TABLE wide (",
        ",\n".join("  c%d INT%s%s" % (n, " UNIQUE" if n < 51 else "", " REFERENCES other (id)" if n < 101 else "") for n in range(302)),
        ");",
    ))], shape=True),
    case("YAML, the sitemap template: values, lists, children, removed screens and markers", YAML, [("docs/07-sitemap/case.yaml", text(
        "# The sitemap",
        "# without a screen: TERM-20 TERM-21",
        "#WITHOUT A SCREEN: TERM-22",
        "  #   w\u0130thout a screen  :  TERM-23",
        "---",
        "- id: SCR-1",
        "  name: Home # a comment",
        '  path: "/home?tab=#top"',
        "  access: 'owner''s'",
        "  flows: [FL-1, \"FL-2\", 'FL-3 FL-1', [FL-4], other, , ]",
        "  terms: [CTX-1, TERM-1, TERM-2, 5]",
        "  children:",
        "    - id: SCR-2",
        "      name: Settings",
        "      path: /settings",
        "      status: Removed",
        "      flows:",
        "        - FL-5",
        "        - not a flow",
        "      terms: none",
        "      children:",
        "        - id: SCR-3 and SCR-4",
        '          name: "Deep \\"quoted\\" name \\u00e9"',
        "          terms: NONE",
        "          status: deleted now",
        "    - id: not an id",
        "      name: ops@example.com",
        "      flows: FL-6",
        "      children: SCR-9",
        "      terms: [CTX-2]",
        "- just text",
        "- name: no id",
        "  terms:",
        "  flows:",
        "  children:",
        "- id: SCR-5",
        "  name: x",
        "  terms: maybe",
        "  children: []",
        "  other:",
        "    nested: value",
        "    list:",
        "      - a",
        "...",
    ))]),
    case("YAML the template does not take, one file each", YAML, [
        ("docs/07-sitemap/tab.yaml", "- id: SCR-1\n\tname: x\n"),
        ("docs/07-sitemap/colon.yaml", "- name: a : b\n"),
        ("docs/07-sitemap/duplicate.yaml", "- name: a\n  name: b\n"),
        ("docs/07-sitemap/anchor.yaml", "- name: &x a\n"),
        ("docs/07-sitemap/alias.yaml", "- name: *x\n"),
        ("docs/07-sitemap/tag.yaml", "- name: !str a\n"),
        ("docs/07-sitemap/mapping.yaml", "- name: {a: 1}\n"),
        ("docs/07-sitemap/block.yaml", "- name: |\n    text\n"),
        ("docs/07-sitemap/folded.yaml", "- name: >\n    text\n"),
        ("docs/07-sitemap/merge.yaml", "- <<: *base\n"),
        ("docs/07-sitemap/single.yaml", "- name: 'abc\n"),
        ("docs/07-sitemap/inline.yaml", "- flows: [a, b\n"),
        ("docs/07-sitemap/quoted.yaml", '- flows: ["a, b]\n'),
        ("docs/07-sitemap/escape.yaml", '- name: "a\\q"\n'),
        ("docs/07-sitemap/after.yaml", '- name: "a" b\n'),
        ("docs/07-sitemap/mixed.yaml", "- name: a\nkey: b\n"),
        ("docs/07-sitemap/indent.yaml", "- name: a\n    extra: b\n"),
        ("docs/07-sitemap/root.yaml", "name: a\n"),
        ("docs/07-sitemap/key.yaml", "- name: a\n  just text\n"),
        ("docs/07-sitemap/dash.yaml", "-\n"),
        ("docs/07-sitemap/dedent.yaml", "  - name: a\n- name: b\n"),
        ("docs/07-sitemap/proto.yaml", "- __proto__: a\n  __proto__: b\n"),
        ("docs/07-sitemap/line.yaml", "- __line__: 9\n"),
    ], part=""),
    case("YAML that reads as no screen, and a file after one that does not read", YAML, [
        ("docs/07-sitemap/empty.yaml", "# nothing\n---\n"),
        ("docs/07-sitemap/bad.yaml", "- name: a : b\n"),
        ("docs/07-sitemap/good.yaml", "- id: SCR-6\n  name: after\n  constructor: x\n  __proto__: y\n"),
    ]),
    case("YAML, line breaks other than a line feed, wide spaces and Unicode text", YAML, [("docs/07-sitemap/unicode.yaml",
        "- id: SCR-7\r\n  name: \ud68c\uc6d0 \ubaa9\ub85d\r\n  path: /\ud68c\uc6d0\u2028- id: SCR-8\x85  name: \u3000\uc804\uac01 \uacf5\ubc31\u3000\r"
        "- id: SCR-9\n\u3000\u3000name: wide\v- id: SCR-10\x1c  name: \"\\u2028\"\x1d")]),
    case("YAML, a project's own trace ID prefixes", YAML, [("docs/07-sitemap/own.yaml", text(
        "# without a screen: G-9",
        "- id: S-1",
        "  flows: [F-2, F-3]",
        "  terms: [C-4, G-5]",
    ))], ids={"screen": "S", "flow": "F", "term": "G", "context": "C"}),
    case("YAML, more than 500 screens", YAML, [("docs/07-sitemap/many.yaml",
        text(*("- id: SCR-%d\n  name: s%d" % (n, n) for n in range(1, 503))))], shape=True),
    case("YAML, screens nested more than 100 levels", YAML, [("docs/07-sitemap/deep.yaml",
        text(*("%s- name: d%d\n%s  children:" % ("    " * n, n, "    " * n) for n in range(103))))], shape=True),
    case("YAML, more than 50 flows and 20 terms", YAML, [("docs/07-sitemap/long.yaml", text(
        "- id: SCR-11",
        "  flows: [%s]" % ", ".join("FL-%d" % n for n in range(1, 61)),
        "  terms: [%s]" % ", ".join("TERM-%d" % n for n in range(1, 26)),
    ))], shape=True),
]


def shape(value):
    """The picture's shape: each list longer than three as its count, first and last."""
    if isinstance(value, list):
        if len(value) > 3:
            return {"count": len(value), "first": shape(value[0]), "last": shape(value[-1])}
        return [shape(item) for item in value]
    if isinstance(value, dict):
        return {key: shape(item) for key, item in value.items()}
    return value


def hub_cases():
    """What the fixture holds, as the pinned hub makes it now."""
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned_cases", locate_hub() / SCRIPTS / "hub.py")
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    made = []
    for each in CASES:
        hub.picture_ids = hub.IdFormat(each["ids"])
        checks = []
        documents = [(file, body) for file, body in each["documents"]]
        picture = hub.parse_picture(each["stage"], documents, checks, hub, each["part"])
        made.append({**each, "checks": checks, "picture": shape(picture) if each["shape"] else picture})
    return {"about": ABOUT, "cases": made}


class PictureCasesTest(unittest.TestCase):
    def test_the_stored_cases_are_the_pinned_hubs(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        made = hub_cases()
        again = "make it again as this file's docstring says"
        self.assertEqual([each["name"] for each in stored["cases"]], [each["name"] for each in made["cases"]], again)
        for kept, new in zip(stored["cases"], made["cases"]):
            self.assertEqual(kept, new, f"the pinned hub reads the case {new['name']!r} otherwise than stored: {again}")
        self.assertEqual(stored, made, again)


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        FIXTURE.write_text(json.dumps(hub_cases(), indent=1) + "\n", encoding="utf-8", newline="\n")
        print("Wrote the pinned hub's pictures of the reader cases")
    else:
        unittest.main()
