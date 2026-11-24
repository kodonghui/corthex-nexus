"""NEXUS's own Markdown, SQL and YAML readers read the cases below as the pinned hub reads them (TASK-466, TASK-470).

A proposal's source_text on stage 01, 05 or 07 is Markdown, SQL or YAML, which NEXUS reads itself with
`server/src/domain-picture.js`, `server/src/sql-picture.js` and `server/src/sitemap-picture.js`, ports of the pinned
hub's domain.py, erd.py and sitemap.py with their helpers in hub.py. `server/test/picture-readers.test.js` checks that
those readers make, of docs/01-domain/nexus.md, db/nexus.sql and docs/07-sitemap/nexus.yaml, the pictures
`tests/test_ddd_board_picture.py`, `tests/test_erd_picture.py` and `tests/test_sitemap_picture.py` keep, and, of each
case below, the picture and checks that `server/test/picture-cases.json` stores. The cases are what this repository's
three files do not show: the stage-01 tables in English and Korean, other SQL dialects, comments and markers, the YAML
template's errors, line breaks and limits.

A case with `replace` also stores, for each file and text it names, the hub's picture and checks of the case's files
with that one file's text in place of its own. NEXUS keeps only the hub's picture of a push, so a proposal that
changes one file of a drawing read from several puts what the text reads in place of what that file gave the picture
(`server/src/picture-merge.js`); the test checks that this makes the hub's picture of the changed files.

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
ABOUT = ("The pinned hub's pictures and checks of Markdown, SQL and YAML texts this repository's own files do not show, "
         "and of files with one file's text replaced, which NEXUS's readers must make alike. "
         "tests/test_picture_cases.py checks them against the pinned hub and says how to make them again.")


def text(*lines, end="\n"):
    return end.join(lines) + end


def case(name, stage, documents, ids=None, part="nexus", shape=False, replace=None):
    made = {"name": name, "stage": stage, "ids": ids, "part": part, "shape": shape,
            "documents": [[file, body] for file, body in documents]}
    if replace:
        made["replace"] = [[file, body] for file, body in replace]
    return made


MARKDOWN = "01-domain"
SQL = "05-erd"
YAML = "07-sitemap"
COMMANDS = "| Given by | Read model | Command | Aggregate | Events |"
DIVIDER5 = "| --- | --- | --- | --- | --- |"
DIVIDER4 = "| --- | --- | --- | --- |"

# Two stage-01 files, each of one context, and the texts that replace one of them: in a.md a context renamed, a
# command gone, a hotspot answered and its lane gone, the picture's only one, so that the picture has no timeline;
# in b.md a lane added and a read model and a dependency gone.
DOMAIN_A = text(
    "# Ordering",
    "",
    "| Lane | Events |",
    "| --- | --- |",
    "| Orders | Order placed or Order rejected → Order paid |",
    "",
    "### CTX-1 Ordering",
    "Purpose: take orders",
    "",
    COMMANDS, DIVIDER5,
    "| Customer | Basket | Place order | Order | Order placed, or Order rejected |",
    "| Policy: when paid | Order list | Ship order | Order, Parcel | Order shipped |",
    "",
    "| Read model | Shows |",
    "| --- | --- |",
    "| Basket | the basket |",
    "",
    "| From | To | Kind | Why | Data |",
    "| --- | --- | --- | --- | --- |",
    "| CTX-1 | CTX-2 | call | Bill the order | order total |",
    "",
    "| Hotspot | Context | State | Answer or next step |",
    "| --- | --- | --- | --- |",
    "| 1. Who pays the parcel? | CTX-1 | open | ask |",
    "",
    "| ID | Term | Status |",
    "| --- | --- | --- |",
    "| TERM-1 | Order | |",
    "| TERM-2 | Basket | |",
)
DOMAIN_B = text(
    "# Billing",
    "",
    "### CTX-2 Billing",
    "- External systems: the bank",
    "",
    COMMANDS, DIVIDER5,
    "| Bank | Ledger | Record payment | Invoice | Invoice paid |",
    "",
    "| From | To | Kind | Why | Data |",
    "| --- | --- | --- | --- | --- |",
    "| CTX-2 | CTX-1 | event | Paid | invoice id |",
    "",
    "| Hotspot | Context | State | Answer or next step |",
    "| --- | --- | --- | --- |",
    "| 2. Refunds? | CTX-2 | open | |",
    "",
    "| ID | Term | Status |",
    "| --- | --- | --- |",
    "| TERM-3 | Invoice | |",
    "| TERM-4 | Ledger | removed |",
)
DOMAIN_A_CHANGED = (DOMAIN_A.replace("### CTX-1 Ordering", "### CTX-1 Orders")
                    .replace("| Policy: when paid | Order list | Ship order | Order, Parcel | Order shipped |\n", "")
                    .replace("| Orders | Order placed or Order rejected → Order paid |\n", "")
                    .replace("| 1. Who pays the parcel? | CTX-1 | open | ask |", "| 1. Who pays the parcel? | CTX-1 | answered | the shop |"))
DOMAIN_B_CHANGED = (DOMAIN_B.replace("# Billing\n", "# Billing\n\n| Lane | Events |\n| --- | --- |\n| Bills | Invoice sent → Invoice paid |\n")
                    .replace("| Bank | Ledger | Record payment | Invoice | Invoice paid |", "| Bank | | Record payment | Invoice | Invoice paid |")
                    .replace("| CTX-2 | CTX-1 | event | Paid | invoice id |\n", ""))

# Two SQL files, each of whose ALTER TABLE gives a table of the other a foreign key, one through a schema's alias, and
# the texts that replace one of them.
SQL_A = text(
    "-- TBL-1 users",
    "CREATE TABLE app.users (id INTEGER PRIMARY KEY, email TEXT UNIQUE);",
    "-- TBL-2 orders",
    "CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, total NUMERIC(10, 2));",
    "ALTER TABLE items ADD CONSTRAINT items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE;",
)
SQL_B = text(
    "-- TBL-3 items",
    "CREATE TABLE items (id INTEGER PRIMARY KEY, order_id INTEGER, user_id INTEGER REFERENCES users (id));",
    "ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users (id);",
    "ALTER TABLE public.users ADD FOREIGN KEY (id) REFERENCES people (id);",
)
SQL_A_CHANGED = (SQL_A.replace("CREATE TABLE orders (", "CREATE TABLE purchases (")
                 .replace("REFERENCES orders (id)", "REFERENCES purchases (id)")
                 .replace("email TEXT UNIQUE", "email TEXT UNIQUE, name TEXT"))
SQL_B_CHANGED = (SQL_B.replace("CREATE TABLE items (", "CREATE TABLE line_items (")
                 .replace("ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users (id);",
                          "ALTER TABLE orders ADD FOREIGN KEY (id) REFERENCES line_items (id);"))

# Two YAML files of nested screens, and the texts that replace one of them, which moves the other's screens.
YAML_A = text(
    "- id: SCR-1",
    "  name: Home",
    "  path: /",
    "  children:",
    "    - id: SCR-2",
    "      name: Orders",
    "      children:",
    "        - id: SCR-3",
    "          name: Order",
)
YAML_B = text(
    "- id: SCR-4",
    "  name: Billing",
    "  children:",
    "    - id: SCR-5",
    "      name: Invoices",
    "    - id: SCR-6",
    "      name: Invoice",
)
YAML_A_CHANGED = text(
    "- id: SCR-1",
    "  name: Start",
    "  path: /",
    "  children:",
    "    - id: SCR-2",
    "      name: Orders",
    "    - id: SCR-7",
    "      name: Baskets",
    "      children:",
    "        - id: SCR-3",
    "          name: Order",
    "- id: SCR-8",
    "  name: Help",
)
YAML_B_CHANGED = text(
    "- id: SCR-4",
    "  name: Billing",
    "  children:",
    "    - id: SCR-6",
    "      name: Invoice",
)

CASES = [
    case("Markdown, English tables: contexts, commands, read models, the glossary, dependencies, hotspots, a timeline", MARKDOWN, [
        ("docs/01-domain/shop.md", text(
            "# Shop domain",
            "",
            "## 2. Event storming",
            "",
            "| Lane | Events |",
            "| --- | --- |",
            "| Orders | Order placed or Order rejected → Order paid, or Order cancelled → Order shipped |",
            "| Empty | |",
            "| Many | a → b or c or d |",
            "",
            "## 3. Contexts",
            "",
            "| Context | Type | Aggregates |",
            "| :--- | ---: | :---: |",
            "| CTX-1 | **core** | Order (TERM-1), Customer, Basket TERM-9 |",
            "| CTX-2 Billing | supporting | Invoice<br>Payment<br/>Refund |",
            "| CTX-9 | generic | — |",
            "",
            "## 4. Context tables",
            "",
            "### CTX-1 **Ordering** — the shop",
            "Purpose: take an order &amp; keep it",
            "- External systems: [Payment gateway](https://example.invalid/pay) <b>and</b> mail",
            "",
            COMMANDS, DIVIDER5,
            "| Customer | Basket view | Place order | Order | Order placed, or Order rejected |",
            "| Policy: when paid | Order list | Ship order | Order | Order shipped |",
            "| Customer | Order list | Cancel order | Order (TERM-1) | Order cancelled, |",
            "| ~~Old actor~~ | | Old command | none | |",
            "",
            "| Read model | Shows |",
            "| --- | --- |",
            "| Basket view | the basket |",
            "| Order list | orders |",
            "| Unused view | nothing |",
            "",
            "#### Notes under the context",
            "",
            "Purpose: still the context's",
            "",
            "### CTX-2 Billing",
            "",
            "Purpose: bill",
            "",
            COMMANDS, DIVIDER5,
            "| Bank | Ledger | Record payment | Invoice, Payment | Payment recorded |",
            "",
            "```",
            "### CTX-8 in a fence",
            COMMANDS, DIVIDER5,
            "| x | y | z | w | v |",
            "```",
            "",
            "~~### CTX-7 struck~~",
            "",
            "## 5. Dependencies",
            "",
            "| From | To | Kind | Why | Data |",
            "| --- | --- | --- | --- | --- |",
            "| CTX-1 | CTX-2 | call | Bill the order | order total |",
            "| CTX-2 | CTX-1 | Event | Paid | invoice id |",
            "| Mail | CTX-1 | other | x | y |",
            "",
            "## 6. Hotspots",
            "",
            "| Hotspot | Context | State | Answer or next step |",
            "| --- | --- | --- | --- |",
            "| 1. Who pays? | CTX-1, CTX-2 | open | ask |",
            "| 0 zero | CTX-1 | answered | |",
            "| 12) twelve | | open | |",
            "| no number | CTX-9 | open | |",
            "| 3.not spaced | CTX-1 | open | |",
            "",
            "## 7. Glossary",
            "",
            "| ID | Term | Status |",
            "| --- | --- | --- |",
            "| TERM-1 | Order | |",
            "| TERM-2 | Customer | |",
            "| TERM-3 | Customer | |",
            "| TERM-4 | Basket view | removed |",
            "| TERM-5 | Invoice | deleted, for now |",
            "| TERM-6 | [Ledger](https://example.invalid/l) | |",
            "| CTX-2 | Billing | removed |",
        ))]),
    case("Markdown, Korean tables and policy", MARKDOWN, [("docs/01-domain/shop.ko.md", text(
        "# 상점",
        "",
        "| 흐름 | 사건 |",
        "| --- | --- |",
        "| 주문 | 주문됨 또는 거절됨 → 배송됨 |",
        "",
        "| 컨텍스트 | 종류 | 애그리거트 |",
        "| --- | --- | --- |",
        "| CTX-5 | 핵심 | 주문, 고객 |",
        "",
        "### CTX-5 주문",
        "목적: 주문을 받아요",
        "- 바깥 시스템: 결제",
        "",
        "| 주는 쪽 | 읽기 모델 | 명령 | 애그리거트 | 사건 |",
        DIVIDER5,
        "| 고객 | 장바구니 | 주문하기 | 주문 | 주문됨, 또는 거절됨 |",
        "| 정책: 결제되면 | | 배송하기 | 주문 | 배송됨 |",
        "| 정책 : 띄어 쓴 정책 | | 알리기 | 알림 | 알림 감 |",
        "",
        "| 읽기 모델 | 보여 주는 것 |",
        "| --- | --- |",
        "| 장바구니 | 담은 것 |",
        "",
        "| 어디서 | 어디로 | 종류 | 까닭 | 오가는 것 |",
        DIVIDER5,
        "| CTX-5 | CTX-6 | 바로 묻기 | 결제 | 금액 |",
        "| CTX-6 | CTX-5 | 사건 알림 | 결제됨 | 영수증 |",
        "",
        "| 핫스팟 | 컨텍스트 | 상태 | 답이나 다음 할 일 |",
        DIVIDER4,
        "| 1. 환불은? | CTX-5 | 열림 | 묻기 |",
        "",
        "| ID | 용어 | 상태 |",
        "| --- | --- | --- |",
        "| TERM-7 | 주문 | |",
        "| TERM-8 | 장바구니 | 삭제됨 |",
    ))]),
    case("Markdown, command tables under no context heading, a heading that ends a context, and texts with none", MARKDOWN, [
        ("docs/01-domain/a.md", text(
            COMMANDS, DIVIDER5,
            "| A | B | C | D | E |",
            "",
            "## CTX-1 First",
            "### Under the context",
            COMMANDS, DIVIDER5,
            "| A1 | B1 | C1 | D1 | E1 |",
            "## Other section",
            COMMANDS, DIVIDER5,
            "| A2 | B2 | C2 | D2 | E2 |",
            "",
            "#### CTX-2#draft Second: a state and a trailing colon",
            "# [CTX-3]: linked & &lt;escaped&gt; &#65;&#x42; &notin; &amp;amp; <i>tagged</i> __bold__ ~x~ `code`",
        )),
        ("docs/01-domain/b.md", "# Just a title\n\nSome text\n"),
        ("docs/01-domain/c.md", "   \n\n"),
        ("docs/01-domain/d.md", "| Lane | Events |\n| --- | --- |\n| Lone lane | x |\n"),
    ]),
    case("Markdown, a project's own trace ID prefixes", MARKDOWN, [("docs/01-domain/own.md", text(
        "## C-1 Own",
        COMMANDS, DIVIDER5,
        "| Actor | View | Do | Thing G-2 | Done |",
        "",
        "| ID | Term | Status |",
        "| --- | --- | --- |",
        "| G-3 | View | |",
    ))], ids={"context": "C", "term": "G"}),
    case("Markdown, more than 200 contexts and 200 rows", MARKDOWN, [("docs/01-domain/many.md", text(
        *("### CTX-%d Context %d" % (n, n) for n in range(1, 203)),
        COMMANDS, DIVIDER5,
        *("| A | B | C%d | D | E |" % n for n in range(205)),
    ))], shape=True),
    case("Markdown, two files with one replaced", MARKDOWN, [("docs/01-domain/a.md", DOMAIN_A), ("docs/01-domain/b.md", DOMAIN_B)],
         replace=[("docs/01-domain/a.md", DOMAIN_A_CHANGED), ("docs/01-domain/b.md", DOMAIN_B_CHANGED)]),
    case("SQL, two files with one replaced", SQL, [("db/a.sql", SQL_A), ("db/b.sql", SQL_B)],
         replace=[("db/a.sql", SQL_A_CHANGED), ("db/b.sql", SQL_B_CHANGED)]),
    case("YAML, two files with one replaced", YAML, [("docs/07-sitemap/a.yaml", YAML_A), ("docs/07-sitemap/b.yaml", YAML_B)],
         replace=[("docs/07-sitemap/a.yaml", YAML_A_CHANGED), ("docs/07-sitemap/b.yaml", YAML_B_CHANGED)]),
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
        result = {**each, "checks": checks, "picture": shape(picture) if each["shape"] else picture}
        if "replace" in each:
            result["replaced"] = []
            for name, body in each["replace"]:
                changed = []
                again = hub.parse_picture(each["stage"], [(file, body if file == name else kept) for file, kept in documents],
                                          changed, hub, each["part"])
                result["replaced"].append({"file": name, "checks": changed, "picture": again})
        made.append(result)
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
