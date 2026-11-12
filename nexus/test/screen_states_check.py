"""Pinned external QA: stage 08's states against the contract's responses and codes, built and planned (TASK-282).

Requires the pinned contract-tool environment (PyYAML), never the server's or the hub's runtime. Each state of a
definition names the responses that lead to it, with the error codes that decide it in brackets (stage 08's README,
"How to read a definition"). The requests that a screen calls are those that its actions and its states name. For
each page, every response that the contract lists for the requests that its screens call, in the built form and, on
a page of the screens that the design revision of 2026-11-11 touches, in the planned form under
components.pathItems, leads to a state of one of the page's screens, and each code that the contract's examples give
for that response is named with it there, apart from the codes that the README says no screen shows. A code named with
a response whose examples, built or planned, do not give it is one of the known places that stage 08 recorded on
2026-11-12. The definitions are read with tests/test_screen_states.py's reader, and each run also breaks a state's row
and sees the check fail.
"""
import collections
import copy
import json
import re
import sys
from pathlib import Path

import yaml

from contract_planned_check import METHODS, resolver

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tests"))
from test_screen_states import NEW_IN_THE_REVISION, REVISION, SCREENS, definitions, table_rows  # noqa: E402

# The screens that share a page, so that a response of one of them may lead to a state of another, from stage 07's
# paths and the definitions' own words: the workspace holds its stage, its talk, the item and the project's data; the
# hub page its three views. SCR-116, the search, is a layer of any page with states of its own. A new screen joins a
# page here.
PAGES = (
    ("SCR-110",),
    ("SCR-111", "SCR-112", "SCR-113", "SCR-114", "SCR-115", "SCR-130"),
    ("SCR-116",),
    ("SCR-117", "SCR-102", "SCR-103", "SCR-104"),
    ("SCR-101",),
)
# The definitions that stay as the record of a removed screen that no address serves: 0.2's picture view with its
# three panels and its stage overview, since TASK-278 leads their addresses to the workspace (SPEC-154), whose states
# name the responses of API-102 and API-103. Their states are not read against the contract. SCR-101 is removed too,
# but stays on a page, since its states are the text of the hub page's, which /hub still serves.
RECORDS = ("SCR-105", "SCR-106", "SCR-107", "SCR-108", "SCR-109")
# The codes named with a response whose examples do not give them, as stage 08 recorded them on 2026-11-12, in rows
# that the redesign wrote and that stay as they are: the server answers `not_found` to a path in no form, and API-158
# does not answer `space_not_found`. A change that alters these places changes this list in the same commit.
KNOWN = {
    ("SCR-111", "API-153#404", "not_found"),
    ("SCR-115", "API-157#404", "not_found"),
    ("SCR-112", "API-158#404", "space_not_found"),
    ("SCR-113", "API-158#404", "space_not_found"),
}
RESPONSE = re.compile(r"(API-\d{3})#(\d{3}|default)")
# A cell's words: a response, codes in brackets, a separator between responses, or any other word.
TOKEN = re.compile(r"API-\d{3}#(?:\d{3}|default)|\((`[^`]+`(?:, `[^`]+`)*)\)|, and |, | and | |[^ ,(`A]+|.")
ELSEWHERE = re.compile(r"API-\d{3}#(?:\d{3}|default) on SCR-\d{3}")
AS_ON = re.compile(r"the responses of (API-\d{3}(?: and API-\d{3})*) as on (SCR-\d{3}#[a-z]+(?:-[a-z]+)*)")


def contract_forms(api):
    """{API ID: {"built": {status: codes}, "planned": {status: codes}}}, the codes that each response's examples give."""
    resolve = resolver(api)

    def responses(operation):
        found = {}
        for status, response in operation["responses"].items():
            codes = set()
            for media in (resolve(response).get("content") or {}).values():
                for example in (media.get("examples") or {}).values():
                    value = resolve(example).get("value")
                    if isinstance(value, dict) and isinstance(value.get("code"), str) and "status" in value:
                        codes.add(value["code"])
            found[str(status)] = codes
        return found

    forms = collections.defaultdict(dict)
    for item in api["paths"].values():
        for method, operation in item.items():
            if method in METHODS:
                forms[operation["x-corthex"]["id"]]["built"] = responses(operation)
    for item in api["components"].get("pathItems", {}).values():
        for method, operation in item.items():
            if method in METHODS:
                forms[operation["x-corthex"]["id"]]["planned"] = responses(operation)
    return forms


def unshown_codes(readme):
    """The codes that the README says no screen shows."""
    sentence = re.search(r"\nNo screen shows the other codes\.([^\n]*)", readme)
    if not sentence:
        raise SystemExit("stage 08's README no longer says which codes no screen shows")
    return set(re.findall(r"`([a-z_]+)`", sentence.group(1)))


def named(cell):
    """[(response, codes)] that a cell of From responses names. Codes in brackets after a run of responses go with the
    responses of the run that share the last one's status, as "API-112#200, API-129#409 (`checkpoint_recorded`)"
    names the code with the 409 alone; any other word ends a run."""
    found, run = [], []
    for match in TOKEN.finditer(cell):
        word = match.group(0)
        if RESPONSE.fullmatch(word):
            run.append((word, set()))
            found.append(run[-1])
        elif match.group(1):
            codes = set(re.findall(r"`([^`]+)`", match.group(1)))
            status = run[-1][0].split("#")[1] if run else None
            for response, held in reversed(run):
                if response.split("#")[1] != status:
                    break
                held |= codes
            run = []
        elif word not in (", ", " and ", ", and ", " "):
            run = []
    return found


def screens(definitions_by_screen):
    """{screen: (state rows, requests that it calls, whether the revision touches it)}."""
    read = {}
    for screen, path in definitions_by_screen.items():
        rows = table_rows(path)
        states = [row for row in rows if row.header[0] == "State" and "From responses" in row.header]
        calls = set()
        for row in rows:
            if row.header[0] in ("State", "Action"):
                calls.update(re.findall(r"API-\d{3}", ELSEWHERE.sub("", " | ".join(row.cells[1:]))))
        touched = screen in NEW_IN_THE_REVISION or any(row.section == REVISION or row.revision for row in rows)
        read[screen] = (states, calls, touched)
    return read


def check(forms, read, unshown):
    findings = []
    on_pages = [screen for page in PAGES for screen in page] + list(RECORDS)
    if sorted(on_pages) != sorted(read):
        findings.append({"rule": "each definition is on one page or a record",
                         "not on a page": sorted(set(read) - set(on_pages)), "no definition": sorted(set(on_pages) - set(read))})
    rows_by_state = {row.cells[0]: row for states, _, _ in read.values() for row in states}
    responses = codes = 0
    known = set()
    for page in PAGES:
        page = [screen for screen in page if screen in read]
        given = collections.defaultdict(set)   # response -> codes named with it on the page
        where = collections.defaultdict(set)   # (response, code) -> screens that name it
        calls = collections.defaultdict(set)   # request -> screens that call it
        for screen in page:
            states, requests, _ = read[screen]
            for request in requests:
                calls[request].add(screen)
            for row in states:
                cell = row.cells[row.header.index("From responses")]
                for match in AS_ON.finditer(cell):
                    other = rows_by_state.get(match.group(2))
                    if other is None:
                        findings.append({"rule": "a state that a cell names is defined", "state": match.group(2)})
                        continue
                    requests_named = set(re.findall(r"API-\d{3}", match.group(1)))
                    for response, held in named(other.cells[other.header.index("From responses")]):
                        if response.split("#")[0] in requests_named:
                            given[response] |= held
                            for code in held:
                                where[(response, code)].add(screen)
                for response, held in named(ELSEWHERE.sub("", AS_ON.sub("", cell))):
                    given[response] |= held
                    for code in held:
                        where[(response, code)].add(screen)
        planned_too = any(read[screen][2] for screen in page)
        for request in sorted(calls):
            if request not in forms:
                findings.append({"rule": "a request that a screen calls is in the contract", "request": request,
                                 "screens": sorted(calls[request])})
                continue
            for form in ("built", "planned") if planned_too else ("built",):
                for status, contract_codes in forms[request].get(form, {}).items():
                    response = "%s#%s" % (request, status)
                    responses += 1
                    codes += len(contract_codes - unshown)
                    if response not in given:
                        findings.append({"rule": "each response leads to a state", "response": response, "form": form,
                                         "screens": sorted(calls[request])})
                        continue
                    for code in sorted(contract_codes - given[response] - unshown):
                        findings.append({"rule": "each code is named with its response", "response": response,
                                         "code": code, "form": form, "screens": sorted(calls[request])})
        for response, held in sorted(given.items()):
            request, status = response.split("#")
            contract_codes = set().union(*(forms.get(request, {}).get(form, {}).get(status, set())
                                           for form in ("built", "planned")))
            for code in sorted(held - contract_codes):
                for screen in sorted(where[(response, code)]):
                    if (screen, response, code) in KNOWN:
                        known.add((screen, response, code))
                    else:
                        findings.append({"rule": "a code named with a response is one that its examples give",
                                         "response": response, "code": code, "screen": screen})
    if known != KNOWN:
        findings.append({"rule": "the codes that the contract's examples do not give are the known list",
                         "no longer named": sorted(KNOWN - known)})
    return {"responses": responses, "codes": codes, "findings": findings}


def self_test(forms, read, unshown):
    """A state that stops naming a response, or a code with it, fails the check."""
    broken = copy.deepcopy(read)
    states, _, _ = broken["SCR-110"]
    row = next(row for row in states if "API-155#403" in row.cells[row.header.index("From responses")])
    column = row.header.index("From responses")
    row.cells[column] = row.cells[column].replace("API-155#403", "API-155#418").replace("`access_other_app`", "`x`")
    rules = {finding["rule"] for finding in check(forms, broken, unshown)["findings"]}
    if not {"each response leads to a state", "a code named with a response is one that its examples give"} <= rules:
        raise SystemExit("the check of stage 08's states let a broken row pass")


if __name__ == "__main__":
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "docs/06-api/nexus.openapi.yaml"
    contract = contract_forms(yaml.safe_load(source.read_text(encoding="utf8")))
    unshown = unshown_codes((SCREENS / "README.md").read_text(encoding="utf8"))
    read = screens(definitions())
    result = check(contract, read, unshown)
    if result["findings"]:
        print(json.dumps(result["findings"][:40], indent=1))
        raise SystemExit(f"{len(result['findings'])} findings in stage 08's states against the contract")
    self_test(contract, read, unshown)
    print(f"{len(read) - len(RECORDS)} definitions on {len(PAGES)} pages and {len(RECORDS)} records of removed screens: "
          f"{result['responses']} responses of the requests that they call, "
          f"built and planned, each lead to a state, with {result['codes']} codes named with them ({len(unshown)} codes "
          f"that no screen shows apart); {len(KNOWN)} codes are named where the contract's examples do not give them, "
          f"the known list; a broken row fails")
