"""TASK-282: stage 08's checks, kept as the repository's test.

At each of its checkpoints stage 08 checked its definitions with a script kept outside the repository (its README,
"Checks run"). This test keeps the checks that need only the standard library, and nexus/test/screen_states_check.py,
in the pinned contract-tool environment, keeps the ones that read the contract with this file's reader:

- each document of stage 08 holds, line for line, the same named states (`SCR-112#stale`), the same responses
  (`API-128#409`) and the same statuses as its Korean copy, which the IDs of tests/test_paired_documents.py do not
  tell apart;
- each state row of a definition names a state of its own screen, and every state that a file of the repository
  names is defined;
- the states that stage 08's README lists for each screen, in either language, are those of its definition;
- each label that a line of the design revision quotes, on SCR-110 to SCR-115 and on SCR-130, is in a words table,
  as stage 08's check of 2026-11-12 held them: a label joined by " · " may be a run of a table's labels, and the
  example "Safari, phone" stands apart; and
- each state row of the revision has its frames in the grey wireframes, as many at 390 pixels as at 1,440 and at
  least one, and the page has no frame for another state.

The labels' check covers the revision's lines, as stage 08's did: the rows of 0.2 and of the redesign quote labels
that the views' own words hold (nexus/ui/messages.js, nexus/ui/core.js and the hub page) and no words table of stage
08 does, and examples of data, so a word of those rows is checked where the views take it. `python
tests/test_screen_states.py --count` prints what the checks read."""

import collections
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import git_program  # noqa: E402

SCREENS = ROOT / "docs/08-screens/nexus"
WIREFRAMES = SCREENS / "revision-wireframes.html"
WORDS = ("README.md", "redesign-words.md", "revision-words.md")
REVISION = "The design revision of 2026-11-11"
# A screen that the revision adds: its definition holds the revision's rows alone (README, "How to read a definition").
NEW_IN_THE_REVISION = {"SCR-130"}
# A quoted text of the revision's lines that is an example of data, not a label, with why it stands apart.
EXAMPLES = {"Safari, phone": "SCR-112's example of the record's browser family and device class, joined by a comma, "
                             "as revision-words.md gives them"}
NAMED = re.compile(r"(?<![A-Za-z0-9-])SCR-\d{3}#[a-z]+(?:-[a-z]+)*")
RESPONSE = re.compile(r"(?<![A-Za-z0-9-])API-\d{3}#(?:\d{3}|default)(?![A-Za-z0-9])")
QUOTE = re.compile(r'"([^"\n]+)"|“([^”\n]+)”')
CODE = re.compile(r"`[^`]+`")
STATE_WORD = re.compile(r"(?<![\w-])[a-z]+(?:-[a-z]+)*(?![\w-])")
LINKING_WORDS = {"and", "from", "the", "design", "revision"}
TEXT = (".md", ".html", ".yaml", ".json", ".js", ".mjs", ".py", ".sql", ".css")

Row = collections.namedtuple("Row", "line section revision header cells")


def definitions():
    """Stage 08's definitions in English, {screen: path}."""
    return {re.match(r"SCR-\d{3}", path.name).group(0): path for path in sorted(SCREENS.glob("SCR-*.md"))
            if not path.name.endswith(".ko.md")}


def cells(line):
    return [cell.strip() for cell in line.strip()[1:-1].split(" | ")]


def table_rows(path):
    """Each row of each table of a document of stage 08: its line, its section, whether the revision tells it, its
    table's header and its cells."""
    screen = re.match(r"SCR-\d{3}", path.name)
    new = bool(screen) and screen.group(0) in NEW_IN_THE_REVISION
    found, section, revision, header = [], "", new, None
    for number, line in enumerate(path.read_text(encoding="utf8").split("\n"), 1):
        if line.startswith("#"):
            section, header = line.lstrip("#").strip(), None
            if line.startswith("## "):
                revision = new or section == REVISION
        elif not line.startswith("| "):
            header = None
        elif header is None:
            header = cells(line)
        elif not set(line) <= set("|- "):
            found.append(Row(number, section, revision, header, cells(line)))
    return found


def state_rows():
    """[(screen, row)] for the rows of every definition's states, the revision's among them."""
    return [(screen, row) for screen, path in definitions().items() for row in table_rows(path)
            if row.header[0] == "State" and "From responses" in row.header]


def revision_lines():
    """(screen, line number, line) for each line of the revision's sections and of the screens that it adds."""
    for screen, path in definitions().items():
        inside = screen in NEW_IN_THE_REVISION
        for number, line in enumerate(path.read_text(encoding="utf8").split("\n"), 1):
            if line.startswith("## "):
                inside = screen in NEW_IN_THE_REVISION or line[3:].strip() == REVISION
            if inside:
                yield screen, number, line


def words():
    """The English labels of stage 08's words tables, each cell as its labels joined by " · "."""
    return [row.cells[row.header.index("English")].split(" · ") for name in WORDS for row in table_rows(SCREENS / name)
            if "English" in row.header]


def in_words(label, tables):
    """Whether a label is a words table's label, or a run of a cell's labels joined by " · "."""
    parts = label.split(" · ")
    return any(items[start:start + len(parts)] == parts for items in tables for start in range(len(items) - len(parts) + 1))


def compare(english, korean):
    """What a document and its Korean copy do not share line for line: named states, responses and statuses."""
    first = english.read_text(encoding="utf8").split("\n")
    second = korean.read_text(encoding="utf8").split("\n") if korean.exists() else []
    if len(first) != len(second):
        return ["%d lines in English, %d in Korean" % (len(first), len(second))]
    found, header = [], None
    for number, (mine, theirs) in enumerate(zip(first, second), 1):
        for kind, pattern in (("states", NAMED), ("responses", RESPONSE)):
            left, right = collections.Counter(pattern.findall(mine)), collections.Counter(pattern.findall(theirs))
            if left != right:
                found.append("%d %s: English %s, Korean %s" % (number, kind, sorted((left - right).elements()),
                                                               sorted((right - left).elements())))
        if not mine.startswith("| "):
            header = None
        elif header is None:
            header = cells(mine)
        elif "Status" in header and not set(mine) <= set("|- "):
            column, own, other = header.index("Status"), cells(mine), cells(theirs)
            if column >= len(other) or own[column] != other[column]:
                found.append("%d status: English %s, Korean %s" % (number, own[column],
                                                                   other[column] if column < len(other) else None))
    return found


def named_states():
    """{state: [file]} for each state that a text file of the checkout names, this test apart."""
    listed = subprocess.run([git_program(), "-C", str(ROOT), "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                            capture_output=True, check=True, timeout=30).stdout.decode("utf8")
    found = collections.defaultdict(list)
    for name in sorted({name for name in listed.split("\0") if name.endswith(TEXT)}):
        path = ROOT / name
        if path.is_file() and path.resolve() != Path(__file__).resolve():
            for state in set(NAMED.findall(path.read_text(encoding="utf8", errors="replace"))):
                found[state].append(name)
    return found


def listed_states(readme):
    """{screen: states} that a README's list of the screens, its first section, gives."""
    found, section = {}, 0
    for line in readme.read_text(encoding="utf8").split("\n"):
        section += line.startswith("## ")
        match = re.match(r"- \[(SCR-\d{3}) [^\]]+\]\([^)]+\)", line)
        if section == 1 and match:
            tail = line.rsplit(": ", 1)[-1]
            found[match.group(1)] = sorted(word for word in STATE_WORD.findall(tail) if word not in LINKING_WORDS)
    return found


def frames():
    """{state: {width: count}} of the frames of the grey wireframes."""
    found = collections.defaultdict(collections.Counter)
    for tag in re.findall(r'<[a-z]+\b[^>]*\bdata-state="[^"]*"[^>]*>', WIREFRAMES.read_text(encoding="utf8")):
        width = re.search(r'\bdata-width="([^"]*)"', tag)
        found[re.search(r'\bdata-state="([^"]*)"', tag).group(1)][width.group(1) if width else None] += 1
    return found


class ScreenStatesTest(unittest.TestCase):
    def test_the_reader_finds_each_kind_of_difference(self):
        self.assertEqual(NAMED.findall("SCR-112#code-failed, SCR-105-picture-view.md#a and ASCR-101#normal"),
                         ["SCR-112#code-failed"])
        self.assertEqual(RESPONSE.findall("API-118#400(`invalid_request`), API-104#default and API-1040#200"),
                         ["API-118#400", "API-104#default"])
        self.assertTrue(in_words("Agent · {time}", [["Agent", "{time}", "User", "{time}"]]))
        self.assertFalse(in_words("Agent · User", [["Agent", "{time}", "User", "{time}"]]))
        self.assertTrue(in_words("Load again", [["Load again"]]))

    def test_each_state_row_names_a_state_of_its_screen(self):
        rows = state_rows()
        self.assertEqual(len(definitions()), len({screen for screen, _ in rows}), "each definition has its states")
        wrong = ["%s:%d %s" % (screen, row.line, row.cells[0]) for screen, row in rows
                 if not NAMED.fullmatch(row.cells[0]) or not row.cells[0].startswith(screen + "#")]
        self.assertEqual(wrong, [])

    def test_the_korean_copies_hold_the_same_states_responses_and_statuses(self):
        differences = []
        for english in sorted(SCREENS.glob("*.md")):
            if not english.name.endswith(".ko.md"):
                korean = english.with_name(english.name[:-3] + ".ko.md")
                differences += ["%s:%s" % (english.name, found) for found in compare(english, korean)]
        self.assertEqual(differences, [])

    def test_every_state_that_a_file_names_is_defined(self):
        defined = {row.cells[0] for _, row in state_rows()}
        undefined = ["%s in %s" % (state, ", ".join(files[:3])) for state, files in sorted(named_states().items())
                     if state not in defined]
        self.assertEqual(undefined, [])

    def test_the_readme_lists_the_states_of_each_definition(self):
        states = collections.defaultdict(set)
        for screen, row in state_rows():
            states[screen].add(row.cells[0].split("#", 1)[1])
        for readme in (SCREENS / "README.md", SCREENS / "README.ko.md"):
            listed = listed_states(readme)
            self.assertEqual(sorted(listed), sorted(states), "%s lists every definition once" % readme.name)
            wrong = ["%s: %s, not %s" % (screen, ", ".join(listed[screen]), ", ".join(sorted(states[screen])))
                     for screen in sorted(states) if set(listed.get(screen, ())) != states[screen]]
            self.assertEqual(wrong, [], "the states that %s lists" % readme.name)

    def test_each_label_of_the_revision_is_in_a_words_table(self):
        tables, quoted, missing, examples = words(), 0, [], set()
        for screen, number, line in revision_lines():
            for match in QUOTE.finditer(CODE.sub("", line)):
                label = match.group(1) or match.group(2)
                quoted += 1
                if label in EXAMPLES:
                    examples.add(label)
                elif not in_words(label, tables):
                    missing.append("%s:%d %s" % (screen, number, label))
        self.assertGreater(quoted, 0, "the revision's lines quote labels")
        self.assertEqual(missing, [], "labels of the revision's lines that no words table holds")
        self.assertEqual(sorted(set(EXAMPLES) - examples), [], "examples that no line of the revision quotes any more")

    def test_each_state_row_of_the_revision_has_its_frames_at_both_widths(self):
        rows = {row.cells[0] for _, row in state_rows() if row.revision}
        drawn = frames()
        self.assertGreater(len(rows), 0)
        unframed = ["%s: %s" % (state, dict(drawn.get(state, {}))) for state in sorted(rows)
                    if set(drawn.get(state, {})) != {"390", "1440"} or drawn[state]["390"] != drawn[state]["1440"]]
        self.assertEqual(unframed, [], "state rows of the revision without as many frames at 390 as at 1,440 pixels")
        self.assertEqual(sorted(set(drawn) - rows), [], "frames of the grey page for a state that no row of the revision tells")


def count():
    """What the checks read, as stage 08's README records it."""
    rows = state_rows()
    revision = {row.cells[0] for _, row in rows if row.revision}
    named = named_states()
    stage = {state for state, files in named.items() if any(name.startswith("docs/08-screens/") for name in files)}
    others = {state for state, files in named.items() if any(not name.startswith("docs/08-screens/") for name in files)}
    quoted = sum(1 for _, _, line in revision_lines() for _ in QUOTE.finditer(CODE.sub("", line)))
    drawn = frames()
    return ("%d definitions with %d states; %d named in stage 08's files and %d in the repository's other files; "
            "%d state rows of the revision with %d frames; %d quoted labels in the revision's lines; %d labels in "
            "the words tables" % (len(definitions()), len({row.cells[0] for _, row in rows}), len(stage), len(others),
                                  len(revision), sum(sum(widths.values()) for widths in drawn.values()), quoted,
                                  sum(len(cell) for cell in words())))


if __name__ == "__main__":
    if sys.argv[1:] == ["--count"]:
        print(count())
    else:
        unittest.main()
