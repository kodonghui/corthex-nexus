"""TC-1787: the script that lists every case of a release with its last result, `tools/release_cases.py`.

It follows the work breakdown's `Depends on` from the release task to the end, lists the cases of stage 12 whose
`Task` names one of those tasks, and counts them by the first words of their results. The tests run it on a small
work breakdown and plan of their own, and on this repository's, where TASK-314 is the release."""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import release_cases  # noqa: E402

HEADER = "| ID | Task | From | Touches | Depends on | Owner | Estimate | Done when | Status |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n"
WBS = (
    "# Work breakdown\n\n" + HEADER
    + "| TASK-001 | One | SPEC-001 | a | none | agent | S | Done. | done |\n"
    + "| TASK-002 | Two | SPEC-002 | b | TASK-001 | agent | S | Done. | done |\n"
    + "| TASK-003 | Three, beside the release | SPEC-003 | c | TASK-001 | agent | S | Done. | done |\n"
    + "\nAnother table of the same form.\n\n" + HEADER
    + "| TASK-008 | Eight | SPEC-008 | d | TASK-002 to TASK-002 | agent | S | Done. | done |\n"
    + "| TASK-009 | Nine | SPEC-009 | e | TASK-001, TASK-002 | agent | S | Done. | done |\n"
    + "| TASK-010 | The release | SPEC-010 | f | TASK-008–TASK-009 | agent | M | Done. | in progress |\n"
    + "| TASK-011 | After the release | SPEC-011 | g | TASK-010 | maintainer | S | Done. | todo |\n"
)


def case(number, task, result):
    return f"| TC-{number} | Case {number} | SPEC-001 | {task} | unittest | Run it. | It works. | {result} |\n"


QA = (
    "# QA\n\n| ID | Title | Covers | Task | Kind | Steps | Expected | Result |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n"
    + case(1, "TASK-001", "pass (local, 2026-11-14)")
    + case(2, "TASK-002", "partial (local), which the maintainer confirmed")
    + case(3, "TASK-008", "in part (the same run): the rest by hand")
    + case(4, "TASK-009", "fail: BUG-001")
    + case(5, "TASK-010", "not run")
    + case(6, "TASK-010", "not applicable (no body): the operation takes none")
    + case(7, "TASK-009", "not applicable")
    + case(8, "TASK-002, TASK-099", "blocked: the server is not reachable")
    + case(9, "TASK-001", "looked at once")
    + case(10, "TASK-003", "pass")
    + case(11, "TASK-011", "not run")
    + case(12, "none yet (phase ②)", "not run")
)


class ReleaseCasesTest(unittest.TestCase):
    def test_the_release_is_its_task_and_what_it_depends_on_to_the_end(self):
        depends = release_cases.dependencies(WBS)
        self.assertEqual(depends[10], {8, 9})
        self.assertEqual(depends[9], {1, 2})
        self.assertEqual(depends[1], set())
        self.assertEqual(release_cases.release_tasks(10, depends), {1, 2, 8, 9, 10})
        with self.assertRaises(ValueError):
            release_cases.release_tasks(12, depends)

    def test_each_case_of_the_release_with_the_kind_of_its_result(self):
        found = release_cases.cases(QA, {1, 2, 8, 9, 10})
        self.assertEqual([c["case"] for c in found], [f"TC-{n}" for n in range(1, 10)])
        self.assertEqual([c["result"] for c in found], ["pass", "partial", "in part", "fail", "not run",
                                                        "not applicable", "not applicable", "blocked", "other"])
        self.assertEqual([c["case"] for c in found if not c["reason_given"]], ["TC-7"])

    def test_the_output_counts_what_it_lists(self):
        with tempfile.TemporaryDirectory() as folder:
            wbs, qa = Path(folder, "wbs.md"), Path(folder, "qa.md")
            wbs.write_text(WBS, encoding="utf-8")
            qa.write_text(QA, encoding="utf-8")
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                self.assertEqual(release_cases.main(["TASK-010", "--wbs", str(wbs), "--qa", str(qa)]), 0)
            lines = out.getvalue().splitlines()
            self.assertEqual(lines[0], "The release of TASK-010: 5 tasks, TASK-001 to TASK-002, TASK-008 to TASK-010")
            self.assertEqual(len(lines), 10, lines)
            self.assertIn("TC-7  TASK-009  not applicable  (no reason given)  Case 7", lines)
            self.assertEqual(lines[-1], "9 cases: pass 1, partial 1, in part 1, fail 1, blocked 1, not run 1, "
                                        "not applicable 2, other 1")
            out = io.StringIO()
            with contextlib.redirect_stdout(out):
                release_cases.main(["TASK-010", "--wbs", str(wbs), "--qa", str(qa), "--json", "--all"])
            answer = json.loads(out.getvalue())
            self.assertEqual((answer["cases"], len(answer["listed"]), answer["counts"]["not applicable"]), (9, 9, 2))
            self.assertEqual(answer["tasks"], ["TASK-001", "TASK-002", "TASK-008", "TASK-009", "TASK-010"])

    def test_this_repository_s_release(self):
        """TASK-314's release holds the hub's and the server's tasks and not the core plugin's skills, and the
        script knows the result of every one of its cases."""
        tasks = release_cases.release_tasks(314, release_cases.dependencies(release_cases.WBS.read_text(encoding="utf-8")))
        self.assertTrue({265, 278, 288, 294, 295, 302, 310, 312, 314} <= tasks, sorted(tasks))
        self.assertFalse({303, 304, 305, 306, 315, 320} & tasks, sorted(tasks))
        found = release_cases.cases(release_cases.QA.read_text(encoding="utf-8"), tasks)
        self.assertIn("TC-1787", [c["case"] for c in found])
        self.assertEqual([c["case"] for c in found if c["result"] == "other"], [])
        self.assertEqual([c["case"] for c in found if not c["reason_given"]], [])


if __name__ == "__main__":
    unittest.main()
