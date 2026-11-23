"""The stage-10 WBS in `docs/10-wbs/wbs.md` and its Korean copy.

- Task IDs run from TASK-413 without a gap, each with the eight columns of the stage contract.
- Every spec row of `docs/04-functional-spec/spec.md` has a task, and every task's spec rows exist.
- Every operation of `api/openapi.yaml`, every table of `db/nexus.sql` and every screen of the sitemap has a task, and
  every ID a task touches exists.
- Every task has one owner, a size and a done condition; a task that touches an operation is done only when every
  response of each operation it touches has a passing test.
- Dependencies name earlier tasks only, so they have no cycle.
- The Korean copy has the same tasks with the same spec rows, touches, dependencies and sizes.
"""
import os
import re
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRST = 413
OWNERS = {"Claude worker", "maintainer", "관리자"}
SIZES = {"S", "M", "L"}


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return fh.read()


def split_row(line):
    cells = re.split(r"(?<!\\)\|", line.strip())[1:-1]
    return [c.strip().replace("\\|", "|") for c in cells]


def tasks(name):
    rows = []
    for line in read("docs", "10-wbs", name).splitlines():
        if line.startswith("| TASK-"):
            rows.append(split_row(line))
    return rows


def ids(text, prefix):
    return re.findall(r"(?<![\w-])%s-\d{3}(?!\d)" % prefix, text)


def expand(cell):
    """Return the IDs a Touches cell names, with "TBL-146 to TBL-171" expanded."""
    out = []
    for m in re.finditer(r"\b(API|TBL|SCR)-(\d{3})(?: to \1-(\d{3}))?\b", cell):
        lo = int(m.group(2))
        hi = int(m.group(3) or lo)
        out += ["%s-%d" % (m.group(1), n) for n in range(lo, hi + 1)]
    return out


class WbsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.en = tasks("wbs.md")
        cls.ko = tasks("wbs.ko.md")
        spec = read("docs", "04-functional-spec", "spec.md")
        cls.spec = {m.group(1): m.group(2) for m in re.finditer(r"^\| (SPEC-\d{3}) \| [^|]+ \| (\w+) \|", spec, re.M)}
        cls.api = set(re.findall(r"^\s+id: (API-\d{3})$", read("api", "openapi.yaml"), re.M))
        cls.tbl = set(re.findall(r"^-- (TBL-\d{3}) ", read("db", "nexus.sql"), re.M))
        cls.scr = set(re.findall(r"id: (SCR-\d{3})", read("docs", "07-sitemap", "nexus.yaml")))

    def test_ids_and_columns(self):
        self.assertTrue(self.en)
        for n, row in enumerate(self.en):
            self.assertEqual(len(row), 8, row[0])
            self.assertEqual(row[0], "TASK-%d" % (FIRST + n))

    def test_every_spec_row_has_a_task(self):
        used = set()
        for row in self.en:
            frm = ids(row[2], "SPEC")
            self.assertTrue(frm, row[0])
            self.assertTrue(set(frm) <= set(self.spec), row[0])
            used |= set(frm)
        self.assertEqual(sorted(set(self.spec) - used), [])

    def test_every_operation_table_and_screen_has_a_task(self):
        self.assertEqual(len(self.api), 52)
        touched = set()
        for row in self.en:
            got = set(expand(row[3]))
            self.assertTrue(got <= self.api | self.tbl | self.scr, (row[0], sorted(got - self.api - self.tbl - self.scr)))
            touched |= got
        self.assertEqual(sorted(self.api - touched), [])
        self.assertEqual(sorted(self.tbl - touched), [])
        self.assertEqual(sorted(self.scr - touched), [])

    def test_owner_size_and_done(self):
        for row in self.en:
            self.assertIn(row[5], OWNERS, row[0])
            self.assertIn(row[6], SIZES, row[0])
            self.assertGreater(len(row[7]), 20, row[0])

    def test_an_operation_task_tests_every_response(self):
        for row in self.en:
            ops = [x for x in expand(row[3]) if x.startswith("API-")]
            if not ops:
                continue
            m = re.search(r"[Ee]very response ((?:API-\d{3}(?:, )?)+) lists has a passing test", row[7])
            self.assertIsNotNone(m, row[0])
            self.assertEqual(sorted(ids(m.group(1), "API")), sorted(ops), row[0])

    def test_dependencies_name_earlier_tasks(self):
        seen = set()
        for row in self.en:
            deps = re.findall(r"TASK-\d{3}", row[4])
            self.assertTrue(set(deps) <= seen, (row[0], deps))
            seen.add(row[0])

    def test_korean_copy_matches(self):
        self.assertEqual(len(self.ko), len(self.en))
        for en, ko in zip(self.en, self.ko):
            self.assertEqual(ko[0], en[0])
            self.assertEqual(ko[2], en[2], en[0])
            self.assertEqual(expand(ko[3]), expand(en[3]), en[0])
            self.assertEqual(re.findall(r"TASK-\d{3}", ko[4]), re.findall(r"TASK-\d{3}", en[4]), en[0])
            self.assertEqual(ko[6], en[6], en[0])
            self.assertIn(ko[5], OWNERS, en[0])
            self.assertEqual(ids(ko[7], "API"), ids(en[7], "API"), en[0])


if __name__ == "__main__":
    unittest.main()
