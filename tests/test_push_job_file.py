"""TASK-293: the push job's file that the server's guide gives (SPEC-193, REQ-277).

`nexus/README.md` and its Korean copy give the same workflow file for a project's repository. The test reads the
file's YAML block with a small reader of the subset that the file uses, since the repository adds no YAML library,
and holds it to what the contract fixes of it (docs/06-api/nexus.md, "The push job's file"): it runs on a push to the
default branch only, never for a pull request, with permission to read the contents and no other, one job at a time
with a newer one waiting; it checks out the default branch with its full history and records the remote's head; it
runs the hub at the commit that `hub-ref.json` pins, checked out beside the repository and never from it, and runs
nothing from the repository; and it gives the hub the three secrets and runs `hub.py push --job --json`. The pin is
`hub-ref.json`'s, so a change of the pin changes the guide in the same commit. The run of the file's lines against
the local stand-in server waits for a pinned hub that has `push --job` (TASK-294)."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GUIDES = (ROOT / "nexus/README.md", ROOT / "nexus/README.ko.md")
HUB_SCRIPT = "plugins/corthex-nexus/skills/corthex-hub/scripts/hub.py"


def job_block(path):
    """The one YAML block of a guide."""
    blocks = re.findall(r"^```yaml\n(.*?)^```\n", path.read_text(encoding="utf8"), re.S | re.M)
    if len(blocks) != 1:
        raise AssertionError("%s has %d YAML blocks, not one" % (path.name, len(blocks)))
    return blocks[0]


def value_of(text):
    """A plain scalar, a flow list of plain words, or a boolean or a number, without a trailing comment."""
    text = re.sub(r"\s+#.*$", "", text).strip()
    if text.startswith("[") and text.endswith("]"):
        return [part.strip() for part in text[1:-1].split(",") if part.strip()]
    if text in ("true", "false"):
        return text == "true"
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    return text


def read(rows, start, indent):
    """The mapping or the sequence whose lines start at `start` with `indent`: (value, next line)."""
    if rows[start][1].startswith("- "):
        items, i = [], start
        while i < len(rows) and rows[i][0] == indent and rows[i][1].startswith("- "):
            item = [(indent + 2, rows[i][1][2:])]
            i += 1
            while i < len(rows) and rows[i][0] > indent:
                item.append(rows[i])
                i += 1
            items.append(read(item, 0, indent + 2)[0])
        return items, i
    mapping, i = {}, start
    while i < len(rows) and rows[i][0] == indent:
        key, colon, rest = rows[i][1].partition(":")
        if not colon or key in mapping:
            raise AssertionError("not a new key: %r" % rows[i][1])
        rest = rest.strip()
        if rest == "|":
            i += 1
            lines = []
            while i < len(rows) and rows[i][0] > indent:
                lines.append(rows[i][1])
                i += 1
            mapping[key] = "\n".join(lines) + "\n"
        elif rest:
            mapping[key] = value_of(rest)
            i += 1
        else:
            mapping[key], i = read(rows, i + 1, rows[i + 1][0])
    return mapping, i


def parse(block):
    rows = [(len(line) - len(line.lstrip(" ")), line.strip()) for line in block.split("\n")
            if line.strip() and not line.lstrip().startswith("#")]
    value, end = read(rows, 0, 0)
    if end != len(rows):
        raise AssertionError("a line out of place: %r" % (rows[end][1],))
    return value


class PushJobFileTest(unittest.TestCase):
    def setUp(self):
        self.block = job_block(GUIDES[0])
        self.job = parse(self.block)
        self.pin = json.loads((ROOT / "hub-ref.json").read_text(encoding="utf8"))

    def test_both_guides_give_the_same_file(self):
        self.assertEqual(job_block(GUIDES[1]), self.block)

    def test_it_runs_on_a_push_to_the_default_branch_only(self):
        self.assertEqual(list(self.job), ["name", "on", "permissions", "concurrency", "jobs"])
        self.assertEqual(self.job["on"], {"push": {"branches": ["main"]}})
        self.assertNotRegex(self.block, r"pull_request|workflow_dispatch|workflow_run|schedule|repository_dispatch")
        self.assertEqual(list(self.job["jobs"]), ["push"])
        self.assertEqual(self.job["jobs"]["push"]["if"], "github.ref_name == github.event.repository.default_branch")

    def test_it_reads_the_contents_only_one_job_at_a_time(self):
        self.assertEqual(self.job["permissions"], {"contents": "read"})
        self.assertEqual(self.job["concurrency"], {"group": "corthex-nexus-push", "cancel-in-progress": False})

    def test_it_checks_out_the_history_and_the_pinned_hub_beside_it(self):
        steps = self.job["jobs"]["push"]["steps"]
        self.assertEqual(len(steps), 3)
        project, hub, push = steps
        checkout = [line for line in (ROOT / ".github/workflows/check.yml").read_text(encoding="utf8").split("\n")
                    if "uses: actions/checkout@" in line][0].split("uses: ", 1)[1].split()[0]
        for step in (project, hub):
            self.assertEqual(step["uses"], checkout, "the checkout action of this repository's own checks, pinned by its commit")
            self.assertRegex(step["uses"], r"^actions/checkout@[0-9a-f]{40}$")
        self.assertEqual(project["with"], {"path": "project", "fetch-depth": 0, "persist-credentials": False})
        repository = re.fullmatch(r"https://github\.com/([^/]+/[^/]+)", self.pin["repository"]).group(1)
        self.assertEqual(hub["with"], {"repository": repository, "ref": self.pin["commit"], "path": "hub", "persist-credentials": False})

    def test_it_runs_the_hub_with_the_secrets_and_nothing_from_the_repository(self):
        push = self.job["jobs"]["push"]["steps"][2]
        self.assertEqual(sorted(push), ["env", "name", "run", "working-directory"])
        self.assertEqual(push["working-directory"], "project")
        self.assertEqual(push["env"], {
            "DEFAULT_BRANCH": "${{ github.event.repository.default_branch }}",
            "CORTHEX_NEXUS_URL": "${{ secrets.CORTHEX_NEXUS_URL }}",
            "CORTHEX_NEXUS_CLIENT_ID": "${{ secrets.CORTHEX_NEXUS_CLIENT_ID }}",
            "CORTHEX_NEXUS_CLIENT_SECRET": "${{ secrets.CORTHEX_NEXUS_CLIENT_SECRET }}"})
        self.assertEqual(push["run"].splitlines(), [
            'git symbolic-ref refs/remotes/origin/HEAD "refs/remotes/origin/$DEFAULT_BRANCH"',
            "python3 ../hub/" + HUB_SCRIPT + " push --job --json"])

    def test_the_reader_refuses_what_it_does_not_read(self):
        for broken in ("on:\n  push: x\n  push: y\n", "a: 1\n  b: 2\n"):
            with self.subTest(broken=broken), self.assertRaises(AssertionError):
                parse(broken)


if __name__ == "__main__":
    unittest.main()
