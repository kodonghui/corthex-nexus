"""List every case of a release with its last result (TC-1787, D19 of stage 02).

The release's tasks are the release task of stage 10, such as TASK-314, and every task that it depends on, through
the `Depends on` column of the work breakdown, followed to the end. Every case of stage 12 whose `Task` names one of
those tasks is listed with its result's first words, and the counts by result are printed after them, so that the
counts that the maintainer is shown before the go or no-go are copied from this output.

    python tools/release_cases.py TASK-314            the cases that have not passed, then the counts
    python tools/release_cases.py TASK-314 --all      every case of the release
    python tools/release_cases.py TASK-314 --json     the same as JSON

The script reads the two files and writes nothing. It judges nothing either: a case `in part` or `partial` is listed
as such, and whether the maintainer passed it by name is read in its row and its run record."""

import argparse
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WBS = ROOT / "docs" / "10-wbs" / "nexus.md"
QA = ROOT / "docs" / "12-qa" / "nexus.md"

# The results of stage 12, by the words that a result cell starts with; anything else is `other`.
RESULTS = ("pass", "partial", "in part", "fail", "blocked", "not run", "not applicable")
TASK = re.compile(r"TASK-(\d+)")
SPAN = re.compile(r"TASK-(\d+)(?:\s*(?:–|-|to)\s*TASK-(\d+))?")


def cells(line):
    """The cells of one row of a Markdown table, whose cells hold no ` | `."""
    return [cell.strip() for cell in line.rstrip("\n").strip().strip("|").split(" | ")]


def tasks_of(text):
    """The task numbers that a cell names, `TASK-296–TASK-302` and `TASK-288 to TASK-293` as spans."""
    found = set()
    for first, last in SPAN.findall(text):
        found.update(range(int(first), int(last) + 1) if last else [int(first)])
    return found


def dependencies(wbs_text):
    """Each task of the work breakdown and the tasks of its `Depends on` cell."""
    found, header = {}, None
    for line in wbs_text.splitlines():
        if line.startswith("| ID | Task |"):
            header = cells(line)
            continue
        match = re.match(r"\| TASK-(\d+) \|", line)
        if match and header and "Depends on" in header:
            row = cells(line)
            if len(row) != len(header):
                raise ValueError(f"TASK-{match.group(1)}: {len(row)} cells, the table has {len(header)}")
            found[int(match.group(1))] = tasks_of(row[header.index("Depends on")])
    return found


def release_tasks(release, depends):
    """The release task and every task that it depends on, followed to the end."""
    if release not in depends:
        raise ValueError(f"TASK-{release} is not in the work breakdown")
    seen, waiting = set(), [release]
    while waiting:
        task = waiting.pop()
        if task not in seen:
            seen.add(task)
            waiting.extend(depends.get(task, ()))
    return seen


def result_of(text):
    """The kind of a result cell, by its first words."""
    lowered = text.lower()
    for kind in sorted(RESULTS, key=len, reverse=True):
        if lowered.startswith(kind):
            return kind
    return "other"


def cases(qa_text, tasks):
    """The cases whose `Task` names a task of the release, in the file's order."""
    found = []
    for line in qa_text.splitlines():
        if not line.startswith("| TC-"):
            continue
        row = cells(line)
        if len(row) != 8:
            raise ValueError(f"{row[0]}: {len(row)} cells, a case has 8")
        named = {int(number) for number in TASK.findall(row[3])}
        if named & tasks:
            kind = result_of(row[7])
            found.append({"case": row[0], "title": row[1], "task": row[3], "kind": row[4], "result": kind,
                          "reason_given": kind != "not applicable" or len(row[7]) > len("not applicable") + 2})
    return found


def spans(numbers):
    """Task numbers as short spans: TASK-265 to TASK-280, TASK-286."""
    numbers, out = sorted(numbers), []
    for number in numbers:
        if out and number == out[-1][1] + 1:
            out[-1][1] = number
        else:
            out.append([number, number])
    return ", ".join(f"TASK-{a:03d}" if a == b else f"TASK-{a:03d} to TASK-{b:03d}" for a, b in out)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("release", help="the release task of stage 10, such as TASK-314")
    parser.add_argument("--all", action="store_true", help="list every case, not only those that have not passed")
    parser.add_argument("--json", action="store_true", help="print JSON")
    parser.add_argument("--wbs", type=Path, default=WBS)
    parser.add_argument("--qa", type=Path, default=QA)
    args = parser.parse_args(argv)
    match = re.fullmatch(r"TASK-(\d+)", args.release)
    if not match:
        parser.error("the release is a task ID such as TASK-314")
    tasks = release_tasks(int(match.group(1)), dependencies(args.wbs.read_text(encoding="utf-8")))
    found = cases(args.qa.read_text(encoding="utf-8"), tasks)
    counts = collections.Counter(case["result"] for case in found)
    listed = found if args.all else [case for case in found if case["result"] != "pass"]
    if args.json:
        print(json.dumps({"release": args.release, "tasks": [f"TASK-{n:03d}" for n in sorted(tasks)],
                          "cases": len(found), "counts": {kind: counts[kind] for kind in RESULTS + ("other",)},
                          "listed": listed}, ensure_ascii=False, indent=1))
        return 0
    print(f"The release of {args.release}: {len(tasks)} tasks, {spans(tasks)}")
    for case in listed:
        flag = "" if case["reason_given"] else "  (no reason given)"
        print(f"{case['case']}  {case['task']}  {case['result']}{flag}  {case['title']}")
    print(f"{len(found)} cases: " + ", ".join(f"{kind} {counts[kind]}" for kind in RESULTS + ("other",)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
