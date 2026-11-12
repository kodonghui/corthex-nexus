"""TASK-283: each document against its Korean copy, line for line, and every inner and relative link.

English is the source, and each document has a Korean copy, `<name>.ko.md`. At each place the two copies have the
same kind of line: a heading of the same level, a table row with the same number of cells, a bullet at the same
depth, a numbered item with the same number, a fence, a line of code, a paragraph or a blank line. On each line that
is not code they have the same trace IDs, the same code spans and the same link targets. A difference that stands is
in tests/paired_documents.json with its reason, and the test holds the documents to that list exactly: a difference
that the list does not hold fails, and so does an entry that no longer matches, so a change that removes a
difference shortens the list in the same commit. `python tests/test_paired_documents.py --list` prints the
differences that stand now in the list's form, for a person to review.

Every inner and relative link of every document resolves: its file exists and, in a Markdown file, its heading or
anchor exists. Whether the Mermaid diagrams draw stays a check that the builder runs by hand with a pinned Mermaid
outside the repository's dependencies, since a new development dependency needs the maintainer's approval."""

import collections
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import git_program  # noqa: E402

KNOWN = Path(__file__).with_name("paired_documents.json")
ID = re.compile(r"(?<![A-Za-z0-9])(?:TBL|SPEC|REQ|TERM|CTX|FL|SCR|API|TASK|TC|BUG|SCENE|DEC)-\d{3,4}(?!\d)"
                r"|(?<![A-Za-z0-9])D\d\d(?!\d)")
CODE = re.compile(r"`[^`]+`")
LINK = re.compile(r"\]\(([^)\s]+)\)")
ANCHOR = re.compile(r'<a id="([^"]+)"></a>')


def documents():
    """The checkout's Markdown files that Git tracks or would track, as they are in the working tree."""
    listed = subprocess.run([git_program(), "-C", str(ROOT), "ls-files", "-z", "--cached", "--others", "--exclude-standard",
                             "--", "*.md"], capture_output=True, check=True, timeout=30).stdout.decode("utf8")
    return sorted({name for name in listed.split("\0") if name and (ROOT / name).is_file()})


def kinds(lines):
    """The kind of each line, as the paired copies must share it."""
    found, fence = [], False
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith("```"):
            found.append("fence " + stripped[3:].strip())
            fence = not fence
        elif fence:
            found.append("code")
        elif line == "":
            found.append("blank")
        elif re.match(r"#{1,6} ", line):
            found.append("heading %d" % len(line.split(" ", 1)[0]))
        elif line.startswith("| "):
            found.append("row of %d cells" % (line.count(" | ") + 1))
        elif re.match(r"\s*- ", line):
            found.append("bullet at %d" % (len(line) - len(stripped)))
        elif re.match(r"\d+\. ", line):
            found.append("item " + line.split(".", 1)[0])
        else:
            found.append("paragraph")
    return found


def targets(line):
    """The files that a line's links lead to, with each Korean copy read as its English one."""
    plain = CODE.sub("", line)
    return [re.sub(r"\.ko\.md$", ".md", link.split("#")[0]) for link in LINK.findall(plain) if not link.startswith("#")]


READ = {"ids": ID.findall, "code": CODE.findall, "links": targets}


def compare(english, korean):
    """The differences between two copies: (check, English side, Korean side, line number)."""
    found = []
    first, second = english.split("\n"), korean.split("\n")
    if len(first) != len(second):
        return [("lines", [len(first)], [len(second)], 0)]
    kind_a, kind_b = kinds(first), kinds(second)
    for number, (a, b, kind, other) in enumerate(zip(first, second, kind_a, kind_b), 1):
        if kind != other:
            found.append(("kind", [kind], [other], number))
            continue
        if kind == "code" or kind.startswith("fence"):
            continue
        for check, read in READ.items():
            left, right = collections.Counter(read(a)), collections.Counter(read(b))
            if left != right:
                found.append((check, sorted((left - right).elements()), sorted((right - left).elements()), number))
    return found


def slug(heading):
    return re.sub(r"[^\w\- ]", "", heading.strip().lower()).replace(" ", "-")


_anchors = {}


def anchors(path):
    """The places that a link can name in a Markdown file: its headings, as GitHub names them, and its anchors."""
    if path not in _anchors:
        found, seen, fence = set(), collections.Counter(), False
        for line in path.read_text(encoding="utf8").split("\n"):
            if line.lstrip().startswith("```"):
                fence = not fence
                continue
            if fence:
                continue
            found.update(ANCHOR.findall(line))
            if re.match(r"#{1,6} ", line):
                name = slug(line.split(" ", 1)[1])
                found.add(name if not seen[name] else "%s-%d" % (name, seen[name]))
                seen[name] += 1
        _anchors[path] = found
    return _anchors[path]


def broken_links(relative):
    """Each inner or relative link of a document that leads nowhere: (line number, link)."""
    path, found, fence = ROOT / relative, [], False
    for number, line in enumerate(path.read_text(encoding="utf8").split("\n"), 1):
        if line.lstrip().startswith("```"):
            fence = not fence
            continue
        if fence:
            continue
        for link in LINK.findall(CODE.sub("", line)):
            if link.startswith(("http://", "https://", "mailto:")):
                continue
            target, _, place = link.partition("#")
            file = (path.parent / target).resolve() if target else path
            if not file.exists() or (place and file.suffix == ".md" and place not in anchors(file)):
                found.append((number, link))
    return found


def standing():
    """The differences that stand now, keyed as the list keys them, with the lines where each stands."""
    names = documents()
    present = set(names)
    unpaired, pairs = [], []
    for name in names:
        if name.endswith(".ko.md"):
            continue
        korean = name[:-3] + ".ko.md"
        (pairs if korean in present else unpaired).append(name)
    orphans = [name for name in names if name.endswith(".ko.md") and name[:-6] + ".md" not in present]
    differences = collections.defaultdict(list)
    for name in pairs:
        english = (ROOT / name).read_text(encoding="utf8")
        korean = (ROOT / (name[:-3] + ".ko.md")).read_text(encoding="utf8")
        for check, left, right, number in compare(english, korean):
            differences[(name, check, tuple(left), tuple(right))].append(number)
    return unpaired, orphans, differences


def known():
    value = json.loads(KNOWN.read_text(encoding="utf8"))
    reasons = set(value["why"])
    entries = {}
    for entry in value["differences"]:
        if entry["why"] not in reasons:
            raise AssertionError("%s: a difference's reason must be one of the list's reasons" % entry["file"])
        key = (entry["file"], entry["check"], tuple(entry["english"]), tuple(entry["korean"]))
        if key in entries:
            raise AssertionError("%s: the list holds one entry for each difference" % entry["file"])
        entries[key] = entry
    for name, why in value["unpaired"].items():
        if why not in reasons:
            raise AssertionError("%s: an unpaired file's reason must be one of the list's reasons" % name)
    return value, entries


class PairedDocumentsTest(unittest.TestCase):
    def test_the_checker_finds_each_kind_of_difference(self):
        english = "# Title\n\n| A | B |\n- See [REQ-101](../02-prd/nexus.md#a) and `x`.\n```sh\nrun TASK-101\n```\n"
        self.assertEqual(compare(english, english.replace("# Title", "# 제목")), [])
        self.assertEqual(compare(english, english.replace("](../02-prd/nexus.md#a)", "](../02-prd/nexus.ko.md#가)")), [])
        self.assertEqual(compare(english, english.replace("`x`", "`y`")), [("code", ["`x`"], ["`y`"], 4)])
        self.assertEqual(compare(english, english.replace("REQ-101", "REQ-102")), [("ids", ["REQ-101"], ["REQ-102"], 4)])
        self.assertEqual(compare(english, english.replace("../02-prd/", "../03-user-flow/")),
                         [("links", ["../02-prd/nexus.md"], ["../03-user-flow/nexus.md"], 4)])
        self.assertEqual(compare(english, english.replace("| A | B |", "| A | B | C |")),
                         [("kind", ["row of 2 cells"], ["row of 3 cells"], 3)])
        self.assertEqual(compare(english, english.replace("run TASK-101", "run TASK-102")), [], "code is not compared")
        self.assertEqual(compare(english, english + "\n"), [("lines", [8], [9], 0)])

    def test_each_document_has_its_korean_copy(self):
        value, _ = known()
        unpaired, orphans, _ = standing()
        self.assertEqual(orphans, [], "a Korean copy without its English source")
        self.assertEqual(sorted(unpaired), sorted(value["unpaired"]),
                         "a document without its Korean copy, apart from the list's unpaired files")

    def test_each_pair_matches_line_for_line_apart_from_the_known_list(self):
        _, entries = known()
        _, _, differences = standing()
        new = ["%s:%s %s: English %s, Korean %s" % (key[0], ",".join(map(str, lines)), key[1], list(key[2]), list(key[3]))
               for key, lines in sorted(differences.items()) if key not in entries]
        changed = ["%s %s: English %s, Korean %s on %d lines, not %d" % (key[0], key[1], list(key[2]), list(key[3]),
                                                                        len(differences.get(key, [])), entry["lines"])
                   for key, entry in sorted(entries.items()) if len(differences.get(key, [])) != entry["lines"]]
        self.assertEqual(new, [], "differences that tests/paired_documents.json does not hold")
        self.assertEqual(changed, [], "entries of tests/paired_documents.json that no longer match; update the list")

    def test_every_inner_and_relative_link_resolves(self):
        broken = ["%s:%d %s" % (name, number, link) for name in documents() for number, link in broken_links(name)]
        self.assertEqual(broken, [])


def listing():
    """The list's form for the differences that stand now, keeping the reasons of the entries that still match."""
    value, entries = known()
    unpaired, _, differences = standing()
    rows = []
    for key, lines in sorted(differences.items()):
        held = entries.get(key)
        rows.append({"file": key[0], "check": key[1], "english": list(key[2]), "korean": list(key[3]),
                     "lines": len(lines), "why": held["why"] if held else "?"})
    return {"why": value["why"], "unpaired": {name: value["unpaired"].get(name, "?") for name in sorted(unpaired)},
            "differences": rows}


if __name__ == "__main__":
    if sys.argv[1:] == ["--list"]:
        sys.stdout.write(json.dumps(listing(), ensure_ascii=False, indent=1) + "\n")
    else:
        unittest.main()
