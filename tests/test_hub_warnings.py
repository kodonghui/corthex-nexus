"""TASK-284: the pinned hub's snapshot of this checkout has no error, and its warnings, by rule and ID, are those of
tests/hub_warnings.json, which says why each kind of warning stands.

The test copies the project file, the stage records and each stage's source, as the working tree has them (the files
that Git tracks or would track), into a repository in a temporary folder whose default branch holds them, as a clone's
would, and takes that repository's snapshot with the pinned hub (CORTHEX_HUB_CHECKOUT at the commit of hub-ref.json),
as the product checks run it. A warning that the list does not hold fails, and so does a listed warning that no longer
stands, so a change that removes warnings shortens the list in the same commit. `python tests/test_hub_warnings.py
--list` prints the warnings that stand now in the list's form, keeping the reasons of the listed ones."""

import collections
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from test_nexus import ROOT, hub

sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import git_program  # noqa: E402

KNOWN = Path(__file__).with_name("hub_warnings.json")
NOW = "2026-11-12T09:00:00+09:00"
ORIGIN = "https://github.com/kodonghui/corthex-nexus.git"


def checkout_files(settings):
    """The files of .corthex/ and of each stage's source in this checkout, as Git lists them."""
    sources = {stage["source"] for stage in settings["stages"].values()
               if isinstance(stage, dict) and isinstance(stage.get("source"), str) and stage["source"].strip()}
    listed = subprocess.run([git_program(), "-C", str(ROOT), "ls-files", "-z", "--cached", "--others", "--exclude-standard",
                             "--", ".corthex"] + sorted(sources), capture_output=True, check=True, timeout=60).stdout
    return sorted({name for name in listed.decode("utf8").split("\0") if name and (ROOT / name).is_file()})


def snapshot_of_checkout():
    """The pinned hub's snapshot of this checkout, taken in a temporary home from a repository that holds its files."""
    settings = json.loads((ROOT / ".corthex/project.json").read_text(encoding="utf8"))
    with tempfile.TemporaryDirectory() as folder:
        base = Path(folder)
        home, repo, hooks = base / "home", base / "work" / settings["name"], base / "no-hooks"
        for path in (home / ".corthex", repo, hooks):
            path.mkdir(parents=True)
        for name in checkout_files(settings):
            (repo / name).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(str(ROOT / name), str(repo / name))
        # The user's own Git settings stay out: no global or system file, no hooks, no signing, no line-end changes.
        env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
        env.update(HOME=str(base), XDG_CONFIG_HOME=str(base), GIT_CONFIG_NOSYSTEM="1",
                   GIT_AUTHOR_DATE=NOW, GIT_COMMITTER_DATE=NOW)

        def git(*args):
            command = [git_program(), "-C", str(repo), "-c", "core.hooksPath=" + str(hooks), "-c", "core.autocrlf=false",
                       "-c", "commit.gpgsign=false", "-c", "user.name=Checkout", "-c", "user.email=checkout@example.com"]
            run = subprocess.run(command + list(args), capture_output=True, env=env, timeout=120)
            if run.returncode:
                raise AssertionError("git %s: %s" % (args[0], run.stderr.decode("utf8", "replace")[-500:]))
            return run.stdout.decode("utf8").strip()

        git("init", "-q")
        git("symbolic-ref", "HEAD", "refs/heads/main")
        git("add", "-A")
        git("commit", "-q", "--no-verify", "-m", "The checkout's sources")
        git("update-ref", "refs/remotes/origin/main", git("rev-parse", "HEAD"))
        git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main")
        git("config", "remote.origin.url", ORIGIN)
        (home / ".corthex/projects.json").write_text(json.dumps({"projects": [{"name": settings["name"], "path": str(repo)}]}),
                                                     encoding="utf8")
        ((_, project, reason),) = hub.select_projects(home, [settings["name"]])
        if project is None:
            raise AssertionError("the hub does not read the project: %s" % reason)
        return hub.make_snapshot(project, hub.load_status(home, project.name), NOW, home=home)


def ident(check):
    """The ID that a check is about: its argument's ID, its references, or its stage when it names none."""
    args = check.get("args") if isinstance(check.get("args"), dict) else {}
    if isinstance(args.get("id"), str):
        return args["id"]
    return ",".join(check.get("refs") or ()) or check.get("stage") or ""


def warnings(snapshot):
    return collections.Counter((check["rule"], ident(check)) for check in snapshot["checks"] if check["level"] == "warn")


def known():
    """The list's warnings as {(rule, ID): reason}, after checking that each reason is said and each ID listed once."""
    value = json.loads(KNOWN.read_text(encoding="utf8"))
    held = {}
    for rule, reasons in value["warnings"].items():
        for reason, ids in reasons.items():
            if reason not in value["why"]:
                raise AssertionError("%s: the reason %s is not among the list's reasons" % (rule, reason))
            for item in ids:
                if (rule, item) in held:
                    raise AssertionError("%s %s: the list holds each warning once" % (rule, item))
                held[(rule, item)] = reason
    unused = set(value["why"]) - set(held.values())
    if unused:
        raise AssertionError("reasons that no warning has: %s" % ", ".join(sorted(unused)))
    return value, held


def order(item):
    match = re.match(r"(.*?)(\d+)$", item)
    return (match.group(1), int(match.group(2))) if match else (item, -1)


class HubWarningsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.snapshot = snapshot_of_checkout()

    def test_the_snapshot_is_whole_and_has_no_error(self):
        self.assertFalse(self.snapshot["truncated"], "the hub cut the snapshot, so its checks are not all there")
        self.assertEqual([check["message"] for check in self.snapshot["checks"] if check["level"] == "error"], [])
        self.assertGreater(self.snapshot["summary"]["items"], 0, "the hub read the stage sources")

    def test_the_warnings_are_those_of_the_list(self):
        _, held = known()
        standing = warnings(self.snapshot)
        new = ["%s %s" % key for key in sorted(standing, key=lambda key: (key[0], order(key[1]))) if key not in held]
        gone = ["%s %s (%s)" % (key[0], key[1], held[key]) for key in sorted(held, key=lambda key: (key[0], order(key[1])))
                if key not in standing]
        self.assertEqual(new, [], "warnings that tests/hub_warnings.json does not hold")
        self.assertEqual(gone, [], "listed warnings that no longer stand; shorten tests/hub_warnings.json")
        self.assertEqual([key for key, count in standing.items() if count > 1], [], "one warning for each rule and ID")


def listing(snapshot):
    """The list's form for the warnings that stand now: each under its listed reason, or under "?" when it is new."""
    value, held = known()
    grouped = collections.defaultdict(lambda: collections.defaultdict(list))
    for rule, item in sorted(warnings(snapshot), key=lambda key: (key[0], order(key[1]))):
        grouped[rule][held.get((rule, item), "?")].append(item)
    lines = ['{', ' "why": {']
    lines.append(",\n".join("  %s: %s" % (json.dumps(key), json.dumps(text, ensure_ascii=False))
                            for key, text in value["why"].items()))
    lines += [' },', ' "warnings": {']
    rules = []
    for rule in sorted(grouped):
        reasons = []
        for reason in [key for key in value["why"] if key in grouped[rule]] + (["?"] if "?" in grouped[rule] else []):
            ids = grouped[rule][reason]
            rows = [", ".join(json.dumps(item) for item in ids[start:start + 10]) for start in range(0, len(ids), 10)]
            reasons.append('   %s: [\n    %s\n   ]' % (json.dumps(reason), ",\n    ".join(rows)))
        rules.append('  %s: {\n%s\n  }' % (json.dumps(rule), ",\n".join(reasons)))
    lines += [",\n".join(rules), ' }', '}']
    return "\n".join(lines) + "\n"


if __name__ == "__main__":
    if sys.argv[1:] == ["--list"]:
        sys.stdout.write(listing(snapshot_of_checkout()))
    else:
        unittest.main()
