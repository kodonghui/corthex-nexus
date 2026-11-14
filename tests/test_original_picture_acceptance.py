"""TC-612/613/615: exact template picture-source data, not browser drawing;
TC-1790: the board of this repository's own stage 01 document.

test_nexus verifies the separately prepared exact hub-ref checkout before any
hub import. These tests only call its real parsers with in-memory template text,
or with the text of the stage 01 document as this checkout holds it.
"""
from pathlib import Path
from types import SimpleNamespace
import unittest

from test_nexus import hub, hub_tests


class OriginalPictureAcceptanceTest(unittest.TestCase):
    def parse(self, reader, text):
        checks = []
        helper = SimpleNamespace(**vars(hub), picture_ids=hub.IdFormat({}))
        suffix = "sql" if reader == "erd" else "yaml"
        picture = hub.companion(reader).parse(
            [("synthetic-template." + suffix, text)], checks, helper, "sample")
        self.assertIsNotNone(picture)
        self.assertEqual(checks, [], "the complete template must not be a partial parse")
        return picture

    def erd_template(self):
        source = hub_tests.output_blocks("corthex-contract", "05-erd")[0]
        # TC-612 explicitly adds a TERM ID to the pinned template's comment.
        header = "-- TBL-001 orders (CTX-001) ← SPEC-001, SPEC-002"
        self.assertEqual(source.count(header), 1)
        return source.replace(header, header + " | terms: TERM-001")

    def assert_orders(self, picture, delete_action):
        self.assertEqual(len(picture["tables"]), 1)
        table = picture["tables"][0]
        self.assertEqual((table["id"], table["name"], table["context"]),
                         ("TBL-001", "orders", "CTX-001"))
        self.assertEqual(table["terms"], ["TERM-001"])
        self.assertIs(table["removed"], False)
        self.assertEqual([(column["name"], column["type"], column["null"])
                          for column in table["columns"]],
                         [("id", "BIGINT", False),
                          ("customer_id", "BIGINT", False),
                          ("status", "VARCHAR(20)", False),
                          ("created_at", "TIMESTAMP", False)])
        self.assertEqual(table["primary_key"], ["id"])
        self.assertEqual(len(table["foreign_keys"]), 1)
        relation = table["foreign_keys"][0]
        self.assertEqual((relation["columns"], relation["table"], relation["references"],
                          relation["on_delete"]),
                         (["customer_id"], "customers", ["id"], delete_action))
        # The selected part has only orders: the FK's customers target is outside
        # this part's source. This is data evidence, not an external-node render.
        local_tables = {entry["name"] for entry in picture["tables"]}
        self.assertNotIn("customers", local_tables)
        self.assertNotIn(relation["table"], local_tables)
        return table, relation

    @staticmethod
    def relation_identity(table, relation):
        return (table["name"], table["context"], relation["columns"],
                relation["table"], relation["references"])

    def test_TC_612_exact_erd_template_columns_key_term_context_and_outside_restrict(self):
        self.assert_orders(self.parse("erd", self.erd_template()), "restrict")

    def test_TC_613_literal_alter_keeps_relation_and_unspecified_delete_action(self):
        template = self.erd_template()
        inline_clause = "REFERENCES customers (id) ON DELETE RESTRICT"
        self.assertEqual(template.count(inline_clause), 1)
        baseline_table, baseline_relation = self.assert_orders(
            self.parse("erd", template), "restrict")
        columns_only = template.replace(inline_clause, "")
        # E7 uses a column-level REFERENCES clause. Moving it must leave a
        # complete column definition and no dangling table-level constraint.
        self.assertIn("customer_id BIGINT NOT NULL ,", columns_only)
        for clause in ("REFERENCES", "FOREIGN KEY", "ON DELETE"):
            self.assertNotIn(clause, columns_only.upper())
        self.assertEqual([table["foreign_keys"]
                          for table in self.parse("erd", columns_only)["tables"]], [[]])
        literal = ("ALTER TABLE orders ADD CONSTRAINT fk FOREIGN KEY (customer_id) "
                   "REFERENCES customers (id)")
        table, relation = self.assert_orders(
            self.parse("erd", columns_only + "\n" + literal + ";\n"), "")
        self.assertEqual(self.relation_identity(table, relation),
                         self.relation_identity(baseline_table, baseline_relation))
        # The original literal says nothing about ON DELETE. Do not fabricate a
        # restrict field. An explicit RESTRICT control does retain all FK data.
        controlled_table, controlled_relation = self.assert_orders(
            self.parse("erd", columns_only + "\n" + literal + " ON DELETE RESTRICT;\n"),
            "restrict")
        self.assertEqual(self.relation_identity(controlled_table, controlled_relation),
                         self.relation_identity(baseline_table, baseline_relation))
        self.assertEqual({key: value for key, value in controlled_relation.items() if key != "where"},
                         {key: value for key, value in baseline_relation.items() if key != "where"})

    def test_TC_615_exact_sitemap_template_paths_access_and_home_to_detail_edge(self):
        source = hub_tests.output_blocks("corthex-screen", "07-sitemap")[0]
        picture = self.parse("sitemap", source)
        screens = picture["screens"]
        self.assertEqual(len(screens), 2)
        self.assertEqual([(screen["id"], screen["name"], screen["path"], screen["access"])
                          for screen in screens],
                         [("SCR-001", "Home", "/", "everyone"),
                          ("SCR-002", "Order detail", "/orders/:id", "signed-in customer")])
        self.assertNotIn("parent", screens[0])
        self.assertEqual(screens[1]["parent"], 0)
        edges = [(screens[screen["parent"]]["id"], screen["id"])
                 for screen in screens if "parent" in screen]
        self.assertEqual(edges, [("SCR-001", "SCR-002")])
        self.assertTrue(all(screen["removed"] is False for screen in screens))

    def test_TC_1790_the_seven_lane_document(self):
        name = "docs/01-domain/nexus.md"
        text = (Path(__file__).resolve().parents[1] / name).read_text(encoding="utf8")
        # The document's own timeline, read here without the hub: a lane a row, its
        # events in places joined by "→", and the outcomes of one place by ", or".
        lines = text.splitlines()
        start = lines.index("| Lane | What happens | Events |") + 2
        expected = []
        for line in lines[start:]:
            if not line.startswith("| "):
                break
            lane, _, events = [cell.strip() for cell in line.strip().strip("|").split(" | ")]
            expected.append((lane, [place.split(", or ") for place in events.split(" → ")]))
        checks = []
        helper = SimpleNamespace(**vars(hub), picture_ids=hub.IdFormat({}))
        board = hub.companion("domain").parse([(name, text)], checks, helper, "nexus")
        self.assertEqual(checks, [])
        timeline = [(lane["lane"], lane["places"]) for lane in board["timeline"]]
        # Seven lanes since phase ②'s checkpoint 1, in the document's order.
        self.assertEqual(len(expected), 7)
        self.assertEqual(timeline, expected)
        editing = dict(timeline)["Editing directly"]
        self.assertIn(["Picture edited", "Edit conflict found"], editing)


if __name__ == "__main__":
    unittest.main()
