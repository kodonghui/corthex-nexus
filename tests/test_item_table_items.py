"""The stage-02 items that the item-table drawer's test draws are the pinned hub's own items of this repository.

The item-table drawer (TASK-423) draws a stage's items as the hub's snapshot sends them, which the hub's build_items
makes from the project's documents, so NEXUS reads no requirement table. `server/test/item-table.test.js` draws
`server/test/item-table-items.json`, the items the pinned hub makes of this repository's stage 02, and checks one row
per requirement. The server's tests run with Node alone, so this test makes the items again with the pinned hub, the
clean checkout at the commit of `hub-ref.json` that `CORTHEX_HUB_CHECKOUT` names (prepare it with
`python tools/fetch_hub_ref.py`), as the hub's snapshot reads this repository's stages. It fails when the stored items
differ: when docs/02-prd/requirements.md changed, or another document that defines or links them, or when a new hub pin
reads them otherwise. It also checks that the drawer's removed words are the pinned hub's. Nothing is fetched and no
server is contacted.

To make the file again, from the repository's root:

    CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_item_table_items.py --write
"""

import hashlib
import importlib.util
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import locate_hub  # noqa: E402

SCRIPTS = "plugins/corthex-nexus/skills/corthex-hub/scripts"
STAGE = "02-prd"
FIXTURE = ROOT / "server" / "test" / "item-table-items.json"
DRAWER = ROOT / "server" / "src" / "item-table.js"
ABOUT = ("The pinned hub's items of this repository's stage 02, as its build_items makes them and its snapshot orders "
         "them, and the SHA-256 of the stage's source. tests/test_item_table_items.py checks them against the pinned "
         "hub and says how to make them again.")


def pinned_hub():
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned_items", locate_hub() / SCRIPTS / "hub.py")
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    return hub


def hub_items(hub):
    """What the fixture holds, as the pinned hub makes it now."""
    project, why = hub.open_project(ROOT)
    if project is None:
        raise AssertionError(why)
    source = project.settings["stages"][STAGE]["source"]
    # As the hub's make_snapshot reads a project: every stage, with the project's trace ID formats, then the items in
    # the snapshot's order.
    scan = hub.Scan(hub.IdFormat(project.settings.get("ids")))
    hub.read_stages(project, scan, [])
    items = [item for item in sorted(hub.build_items(scan).values(), key=hub.stage_order) if item["stage"] == STAGE]
    data = (ROOT / source).read_bytes()
    return {"about": ABOUT, "stage": STAGE, "source": source, "sha256": hashlib.sha256(data).hexdigest(), "items": items}


class ItemTableItemsTest(unittest.TestCase):
    def test_the_stored_items_are_the_pinned_hubs(self):
        stored = json.loads(FIXTURE.read_text(encoding="utf-8"))
        made = hub_items(pinned_hub())
        again = "make it again as this file's docstring says"
        self.assertEqual(stored["sha256"], made["sha256"], f"{made['source']} changed since the stored items: {again}")
        self.assertEqual(stored, made, f"the pinned hub's stage-02 items differ from the stored ones: {again}")
        self.assertEqual(len(made["items"]), 83)

    def test_the_drawers_removed_words_are_the_pinned_hubs(self):
        text = DRAWER.read_text(encoding="utf-8")
        listed = re.search(r"const REMOVED = new Set\(\[(.*?)\]\);", text, re.S)
        self.assertIsNotNone(listed, "item-table.js lists its removed words in const REMOVED")
        words = set(re.findall(r"'([^']*)'", listed.group(1)))
        self.assertEqual(words, set(pinned_hub().REMOVED))


if __name__ == "__main__":
    if sys.argv[1:] == ["--write"]:
        text = json.dumps(hub_items(pinned_hub()), indent=1, ensure_ascii=False) + "\n"
        FIXTURE.write_text(text, encoding="utf-8", newline="\n")
        print("Wrote the pinned hub's stage-02 items")
    else:
        unittest.main()
