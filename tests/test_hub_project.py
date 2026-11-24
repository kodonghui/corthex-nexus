"""The pinned hub reads this repository's project file, its stage records and its push job.

Each test builds a repository in a temporary folder whose default branch holds the files of this checkout, as Git
lists them, so the hub reads them as it reads a clone: the project file, the stage records under `.corthex/stages/`
and every stage source. The hub is the clean checkout at the commit of `hub-ref.json` that `CORTHEX_HUB_CHECKOUT`
names (prepare it with `python tools/fetch_hub_ref.py`); nothing is fetched and no server is contacted.

- `snapshot --print` reads the settings with no error and no finding about invalid settings or records.
- The push step of `.github/workflows/corthex-nexus-push.yml` runs its own lines with the pinned hub beside the
  checkout, as the job lays them out: without its secrets, as in a fork or a pull request, it passes and names
  them; with a loopback address and `--dry-run` it builds the snapshot that it would send, from the default commit.
- The push workflow runs the hub at the commit of `hub-ref.json`, and every workflow pins each action to a full
  commit SHA with its version in a comment.
"""

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import git_program, locate_hub, reference  # noqa: E402

SKILL = "plugins/corthex-nexus/skills/corthex-hub"
WORKFLOWS = ROOT / ".github" / "workflows"
PUSH_WORKFLOW = WORKFLOWS / "corthex-nexus-push.yml"
ORIGIN = "https://github.com/kodonghui/corthex-nexus.git"
SECRETS = ("CORTHEX_NEXUS_URL", "CORTHEX_NEXUS_CLIENT_ID", "CORTHEX_NEXUS_CLIENT_SECRET")
# Findings that mean the hub could not take a setting or a record as written.
SETTINGS_RULES = {"parts-invalid", "records-invalid", "on-nexus-invalid", "ask-before-invalid", "source-invalid",
                  "unknown-alias", "source-outside", "id-config"}


def base_environment(home):
    """An environment built from nothing: no profile, no list of projects and no variable of this machine."""
    env = {"HOME": str(home), "USERPROFILE": str(home), "PATH": str(Path(git_program()).parent),
           "GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull, "GIT_TERMINAL_PROMPT": "0"}
    for name in ("SYSTEMROOT", "WINDIR", "TEMP", "TMP"):
        if os.environ.get(name):
            env[name] = os.environ[name]
    return env


def remove_folder(folder, tries=6):
    """Removes a TemporaryDirectory, trying again a few times as the Node tests' rmSync with maxRetries does: on
    Windows a scanner or a child process that is still exiting can hold a file for a moment. The last error is raised."""
    for attempt in range(1, tries):
        try:
            return folder.cleanup()
        except OSError:
            time.sleep(0.1 * attempt)
    folder.cleanup()


def node_program(case, purpose):
    """Node from the PATH, version 24 or later, which the v3 server's code needs (AGENTS.md)."""
    node = shutil.which("node")
    case.assertTrue(node, "%s needs Node 24 (AGENTS.md)" % purpose)
    version = subprocess.run([node, "--version"], capture_output=True, text=True, timeout=30).stdout.strip()
    case.assertGreaterEqual(int(re.match(r"v(\d+)", version).group(1)), 24, "%s needs Node 24" % purpose)
    return node


def push_step():
    """The `run:` lines and the `env` names of the push workflow's step that runs the hub."""
    text = PUSH_WORKFLOW.read_text(encoding="utf8")
    block = re.search(r"^( +)run: \|\n((?:\1  .*\n)+)", text, re.M)
    if block is None:
        raise AssertionError("the push workflow has no multi-line run step")
    lines = [line[len(block.group(1)) + 2:] for line in block.group(2).splitlines()]
    return lines, re.findall(r"^ +([A-Z_]+): \$\{\{", text, re.M)


class HubCheckoutCase(unittest.TestCase):
    """A repository in a temporary folder with this checkout's files on its default branch, and the pinned hub beside
    it as the push job lays them out; tests/test_hub_compatibility.py builds on it too.

    The folder is removed when the test ends, pass or fail. A subclass that starts a process or opens a file under
    `self.base` stops it in a cleanup registered after `super().setUp()`, so that it ends before the folder goes."""

    @classmethod
    def setUpClass(cls):
        cls.hub_checkout = locate_hub()
        cls.git = git_program()

    def setUp(self):
        # TemporaryDirectory's cleanup, unlike shutil.rmtree, clears the read-only mark that Git puts on the files under
        # .git/objects on Windows when a removal is refused, and tries again.
        folder = tempfile.TemporaryDirectory(prefix="nexus-hub-project-")
        self.addCleanup(remove_folder, folder)
        self.base = Path(folder.name)
        self.work = self.base / "work"
        self.project = self.work / "project"
        self.project.mkdir(parents=True)
        shutil.copytree(str(self.hub_checkout / SKILL), str(self.work / "hub" / SKILL))
        listed = subprocess.run([self.git, "-C", str(ROOT), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                                capture_output=True, check=True, timeout=60).stdout.decode("utf8").split("\0")
        for name in listed:
            if name and (ROOT / name).is_file():
                (self.project / name).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(str(ROOT / name), str(self.project / name))
        self.git_home = self.base / "git-home"
        self.git_home.mkdir()
        self.run_git("init", "-q", "-b", "main")
        self.run_git("add", "-A")
        self.run_git("commit", "--no-verify", "-q", "-m", "The checkout's files")
        self.run_git("remote", "add", "origin", ORIGIN)
        self.commit = self.run_git("rev-parse", "HEAD")
        self.run_git("update-ref", "refs/remotes/origin/main", self.commit)

    def run_git(self, *words):
        env = dict(base_environment(self.git_home), GIT_AUTHOR_NAME="Fixture author", GIT_AUTHOR_EMAIL="fixture@example.com",
                   GIT_COMMITTER_NAME="Fixture author", GIT_COMMITTER_EMAIL="fixture@example.com")
        result = subprocess.run([self.git, "-C", str(self.project)] + list(words), env=env, capture_output=True,
                                text=True, timeout=60)
        self.assertEqual(result.returncode, 0, result.stderr)
        return result.stdout.strip()

    def hub(self, env, *words):
        script = self.work / "hub" / SKILL / "scripts" / "hub.py"
        return subprocess.run([sys.executable, str(script)] + list(words), cwd=str(self.project), env=env,
                              capture_output=True, text=True, encoding="utf8", timeout=120)

    def run_push_step(self, secrets, extra=""):
        """The push step's lines, with `python3` as this test's Python, in the step's folder, with the step's env.

        `extra` adds words to the step's last line, the hub's command. The step's whole output, standard output and
        error, is kept in `self.push_output`."""
        lines, names = push_step()
        self.assertEqual(names, ["DEFAULT_BRANCH"] + list(SECRETS))
        self.assertTrue(lines[-1].endswith(" push --job --json"), lines[-1])
        bash = shutil.which("bash")
        if not bash:
            raise unittest.SkipTest("needs bash")
        home = Path(tempfile.mkdtemp(prefix="runner-home-", dir=str(self.base)))
        env = dict(base_environment(home), DEFAULT_BRANCH="main", HUB_TEST_PYTHON=sys.executable, **secrets)
        script = "\n".join(['python3() { "$HUB_TEST_PYTHON" "$@"; }'] + lines[:-1] + [lines[-1] + extra]) + "\n"
        result = subprocess.run([bash, "-e", "-c", script], cwd=str(self.project), env=env, capture_output=True,
                                text=True, encoding="utf8", timeout=120)
        self.push_output = result.stdout + result.stderr
        rows = result.stdout.strip().splitlines()
        self.assertTrue(rows, "exit %d and no result line: %s" % (result.returncode, result.stderr[-600:]))
        return result.returncode, json.loads(rows[-1]), home


class HubProjectTest(HubCheckoutCase):
    def assert_settings_read(self, snapshot):
        self.assertEqual(snapshot["project"]["name"], "corthex-nexus")
        self.assertEqual(snapshot["project"].get("parts"), ["nexus"])
        self.assertEqual(snapshot["records"], {"from": "repository", "commit": self.commit,
                                               "time": snapshot["records"]["time"]})
        refused = [check["rule"] for check in snapshot["checks"]
                   if check["level"] == "error" or check["rule"] in SETTINGS_RULES]
        self.assertEqual(refused, [])
        self.assertEqual(list(snapshot["stages"]), ["01-domain", "02-prd", "03-user-flow", "04-functional-spec", "05-erd",
                                                    "06-api", "07-sitemap", "08-screen-states", "09-mockup", "10-wbs",
                                                    "11-development", "12-qa", "13-presentation"])
        for key, stage in snapshot["stages"].items():
            with self.subTest(stage=key):
                self.assertIn("nexus", stage["parts"], "every stage has a record of the nexus part")

    def test_the_hub_reads_the_settings_and_records_without_errors(self):
        self.run_git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")
        result = self.hub(base_environment(self.base / "device-home"), "--home", str(self.base / "device-home"),
                          "snapshot", "--path", str(self.project), "--print")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assert_settings_read(json.loads(result.stdout))

    def test_the_push_job_passes_without_its_secrets(self):
        code, row, _ = self.run_push_step({name: "" for name in SECRETS})
        self.assertEqual((code, row["project"], row["outcome"], row["answer"]),
                         (0, "corthex-nexus", "done", {"sent": False, "why": "not-set", "missing": list(SECRETS)}))

    def test_the_push_job_builds_the_snapshot_of_the_default_commit(self):
        # A loopback address needs no service token, and --dry-run builds the snapshot without contacting it.
        secrets = {"CORTHEX_NEXUS_URL": "http://127.0.0.1:9", "CORTHEX_NEXUS_CLIENT_ID": "", "CORTHEX_NEXUS_CLIENT_SECRET": ""}
        code, row, home = self.run_push_step(secrets, " --dry-run")
        self.assertEqual((code, row["outcome"], row["answer"]["held_commit"]), (0, "done", "checked when sent"), row)
        snapshot = json.loads((home / ".corthex" / "hub" / "snapshots" / "corthex-nexus.json").read_text(encoding="utf8"))
        self.assertEqual(snapshot["repos"]["."]["default"]["commit"], self.commit)
        self.assert_settings_read(snapshot)


class WorkflowPinTest(unittest.TestCase):
    def test_the_push_job_runs_the_hub_that_hub_ref_pins(self):
        text = PUSH_WORKFLOW.read_text(encoding="utf8")
        pin = reference()
        repository = re.fullmatch(r"https://github\.com/([^/]+/[^/]+)", pin["repository"]).group(1)
        self.assertEqual(re.findall(r"^ +repository: (\S+)$", text, re.M), [repository])
        self.assertEqual(re.findall(r"^ +ref: (\S+)$", text, re.M), [pin["commit"]])
        self.assertIn("python3 ../hub/" + SKILL + "/scripts/hub.py push --job --json", text)

    def test_every_action_is_pinned_to_a_full_commit(self):
        for path in sorted(WORKFLOWS.glob("*.yml")):
            for line in path.read_text(encoding="utf8").splitlines():
                if "uses:" in line:
                    with self.subTest(workflow=path.name, line=line.strip()):
                        self.assertRegex(line, r"uses: [\w.-]+/[\w./-]+@[0-9a-f]{40} # v\d")


if __name__ == "__main__":
    unittest.main()
