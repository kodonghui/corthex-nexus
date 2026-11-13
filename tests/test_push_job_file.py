"""TASK-293: the push job's file that the server's guide gives (SPEC-193, REQ-277).

`nexus/README.md` and its Korean copy give the same workflow file for a project's repository. The test reads the
file's YAML block with a small reader of the subset that the file uses, since the repository adds no YAML library,
and holds it to what the contract fixes of it (docs/06-api/nexus.md, "The push job's file"): it runs on a push to the
default branch only, never for a pull request, with permission to read the contents and no other, one job at a time
with a newer one waiting; it checks out the default branch with its full history and records the remote's head; it
runs the hub at the commit that `hub-ref.json` pins, checked out beside the repository and never from it, and runs
nothing from the repository; and it gives the hub the three secrets and runs `hub.py push --job --json`. The pin is
`hub-ref.json`'s, so a change of the pin changes the guide in the same commit. `PushJobRunTest` runs the file's lines
as the job runs them, with the pinned hub, against the local stand-in server (TASK-294)."""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import git_program, locate_hub  # noqa: E402
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


SKILL = "plugins/corthex-nexus/skills/corthex-hub"
SECRETS = ("CORTHEX_NEXUS_URL", "CORTHEX_NEXUS_CLIENT_ID", "CORTHEX_NEXUS_CLIENT_SECRET")
DUMMY = {"CORTHEX_NEXUS_CLIENT_ID": "dummy-id.access", "CORTHEX_NEXUS_CLIENT_SECRET": "dummy-secret-value"}


def program(name):
    """An installed program from an absolute folder on PATH, or None."""
    found = shutil.which(name)
    return found if found and Path(found).is_absolute() else None


class PushJobRunTest(unittest.TestCase):
    """The file's lines, run as the job runs them, with the pinned hub against `node nexus/test/serve.js`.

    Each job starts from what the file's two checkout steps leave: the project's checkout with its full history,
    whose remote has the repository's `https` address as `actions/checkout` leaves it, and the pinned hub's skill
    beside it. The push step's `run:` lines then run with bash in the step's working folder and with the step's
    `env`, its secrets given dummy values that the stand-in's synthetic Access takes, or empty as in a fork. Every
    environment is built from nothing, so no variable of the machine that runs the test reaches the hub, and the
    server is the stand-in on 127.0.0.1."""

    @classmethod
    def setUpClass(cls):
        cls.hub_checkout = locate_hub()
        cls.git, cls.bash, cls.python = git_program(), program("bash"), program("python3")
        node = program("node")
        if node and subprocess.run([node, "-e", "require('node:sqlite')"], capture_output=True, timeout=60).returncode:
            node = None
        if not (cls.bash and cls.python and node):
            raise unittest.SkipTest("needs bash, python3 and Node 22.13 or later")
        folders = []
        for found in (cls.python, cls.git, cls.bash, node):
            if str(Path(found).parent) not in folders:
                folders.append(str(Path(found).parent))
        cls.path = os.pathsep.join(folders)
        steps = parse(job_block(GUIDES[0]))["jobs"]["push"]["steps"]
        cls.fetch_depth, cls.step = steps[0]["with"]["fetch-depth"], steps[2]
        cls.server = subprocess.Popen([node, str(ROOT / "nexus/test/serve.js")], cwd=str(ROOT / "nexus"),
                                      env={"PATH": cls.path}, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=subprocess.DEVNULL)
        cls.address = cls.server.stdout.readline().decode("utf-8").strip()
        if not cls.address.startswith("http://127.0.0.1:"):
            cls.tearDownClass()
            raise AssertionError("the stand-in server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.server.stdin.close()
        try:
            cls.server.wait(timeout=30)
        except subprocess.TimeoutExpired:
            cls.server.kill()
            cls.server.wait()
        cls.server.stdout.close()

    def setUp(self):
        self.base = Path(tempfile.mkdtemp(prefix="nexus-push-job-"))
        self.addCleanup(shutil.rmtree, str(self.base), True)
        self.home = self.base / "git-home"
        self.home.mkdir()
        # The job's workspace: the hub beside the project, as the file's second checkout step puts it.
        self.work = self.base / "work"
        shutil.copytree(str(self.hub_checkout / SKILL), str(self.work / "hub" / SKILL))
        self.outputs = []

    def run_git(self, cwd, *words):
        env = {"HOME": str(self.home), "PATH": self.path, "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull,
               "GIT_TERMINAL_PROMPT": "0", "GIT_AUTHOR_NAME": "Fixture author", "GIT_AUTHOR_EMAIL": "fixture@example.com",
               "GIT_COMMITTER_NAME": "Fixture author", "GIT_COMMITTER_EMAIL": "fixture@example.com"}
        result = subprocess.run([self.git, "-C", str(cwd)] + list(words), env=env, capture_output=True, text=True,
                                timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def repository(self, name):
        """The project's repository, as a bare origin, and a working copy that commits to its default branch."""
        origin = self.base / (name + ".git")
        self.run_git(self.base, "init", "-q", "--bare", "-b", "main", str(origin))
        seed = self.base / ("seed-" + name)
        seed.mkdir()
        self.run_git(seed, "init", "-q", "-b", "main")
        (seed / ".corthex").mkdir()
        (seed / ".corthex/project.json").write_text(json.dumps({"name": name, "title": "Synthetic project"}),
                                                     encoding="utf8")
        self.run_git(seed, "remote", "add", "origin", str(origin))
        return origin, seed

    def commit(self, seed, message, force=False):
        (seed / "notes.md").write_text(message + "\n", encoding="utf8")
        self.run_git(seed, "add", ".")
        self.run_git(seed, "commit", "--no-verify", "-q", "-m", message)
        self.run_git(seed, "push", "-q", "--force" if force else "--no-force", "origin", "main")
        return self.run_git(seed, "rev-parse", "HEAD")

    def checkout(self, origin, fetched=None):
        """What the first checkout step leaves, with the history that its `fetch-depth` asks for. `fetched` is the
        default branch's commit when the job's fetch ran before a later commit reached the branch."""
        project = self.work / self.step["working-directory"]
        shutil.rmtree(str(project), ignore_errors=True)
        project.mkdir()
        self.run_git(project, "init", "-q")
        self.run_git(project, "remote", "add", "origin", origin.as_uri())
        depth = ["--depth=%d" % self.fetch_depth] if self.fetch_depth else []
        self.run_git(project, "fetch", "-q", "--prune", *depth, "origin", "+refs/heads/*:refs/remotes/origin/*",
                     "+refs/tags/*:refs/tags/*")
        if fetched:
            self.run_git(project, "update-ref", "refs/remotes/origin/main", fetched)
        self.run_git(project, "checkout", "-q", "--force", "-B", "main", "refs/remotes/origin/main")
        self.run_git(project, "remote", "set-url", "origin", "https://github.com/example/" + origin.stem)
        return project

    def finish(self, result):
        self.outputs.append(result.stdout + result.stderr)
        lines = result.stdout.strip().splitlines()
        self.assertTrue(lines, "exit %d and no result line: %s" % (result.returncode, result.stderr.strip()[-600:]))
        return result.returncode, json.loads(lines[-1]), result.stderr

    def job(self, origin, fetched=None, secrets=True):
        """The push step: its `run:` lines with its `env`, in its working folder."""
        project = self.checkout(origin, fetched)
        runner = Path(tempfile.mkdtemp(prefix="runner-home-", dir=str(self.base)))
        env = {"HOME": str(runner), "PATH": self.path, "GIT_CONFIG_NOSYSTEM": "1"}
        for key, value in self.step["env"].items():
            if value == "${{ github.event.repository.default_branch }}":
                env[key] = "main"
            else:
                self.assertEqual(value, "${{ secrets.%s }}" % key)
                env[key] = (self.address if key == "CORTHEX_NEXUS_URL" else DUMMY[key]) if secrets else ""
        result = subprocess.run([self.bash, "-e", "-c", self.step["run"]], cwd=str(project), env=env,
                                capture_output=True, text=True, timeout=120)
        return self.finish(result)

    def session_first(self, origin, name):
        """The user's yes in a session: `push NAME --first` from a session's environment."""
        project = self.checkout(origin)
        self.run_git(project, "symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")
        session = Path(tempfile.mkdtemp(prefix="session-home-", dir=str(self.base)))
        env = dict(DUMMY, HOME=str(session), PATH=self.path, CORTHEX_NEXUS_URL=self.address, CORTHEX_NEXUS_PUSH=name)
        script = self.work / "hub" / SKILL / "scripts" / "hub.py"
        result = subprocess.run([self.python, str(script), "push", name, "--first", "--json"], cwd=str(project),
                                env=env, capture_output=True, text=True, timeout=120)
        return self.finish(result)

    def no_secret_in_any_output(self):
        for output in self.outputs:
            for value in DUMMY.values():
                self.assertNotIn(value, output)

    def test_each_newer_commit_is_sent_once_after_the_first_push(self):
        origin, seed = self.repository("acme")
        first = self.commit(seed, "start")
        code, line, err = self.job(origin)
        self.assertEqual((code, line["project"], line["outcome"], line["answer"]),
                         (0, "acme", "done", {"sent": False, "why": "first-push-waits"}), err)
        code, line, err = self.session_first(origin, "acme")
        self.assertEqual((code, line["outcome"]), (0, "done"), err)
        code, line, err = self.job(origin)
        self.assertEqual((code, line["answer"]), (0, {"sent": False, "why": "already-held"}), err)
        second = self.commit(seed, "second")
        code, line, err = self.job(origin)
        self.assertEqual((code, line["outcome"]), (0, "done"), line["failure"] or err)
        pushed = line["answer"]["pushed"]
        self.assertEqual((line["answer"]["sent"], pushed["default_commit"], pushed["replaced"]), (True, second, first))
        code, line, err = self.job(origin)
        self.assertEqual((code, line["answer"]), (0, {"sent": False, "why": "already-held"}), err)
        # The job for the first commit, whose fetch ran before the second commit came, ends after it.
        code, line, err = self.job(origin, fetched=first)
        self.assertEqual((code, line["answer"]), (0, {"sent": False, "why": "already-held"}), err)
        self.run_git(seed, "reset", "-q", "--hard", first)
        rewritten = self.commit(seed, "rewritten", force=True)
        code, line, err = self.job(origin)
        self.assertEqual((code, line["outcome"]), (1, "refused"), err)
        self.assertIn(second, line["failure"])
        self.assertIn(rewritten, line["failure"])
        self.no_secret_in_any_output()

    def test_a_fork_without_the_secrets_passes_and_names_them(self):
        origin, seed = self.repository("acme-fork")
        self.commit(seed, "start")
        code, line, err = self.job(origin, secrets=False)
        self.assertEqual((code, line["outcome"], line["answer"]),
                         (0, "done", {"sent": False, "why": "not-set", "missing": list(SECRETS)}), err)
        self.assertEqual([key for key in self.step["env"] if key in SECRETS], list(SECRETS))


if __name__ == "__main__":
    unittest.main()
