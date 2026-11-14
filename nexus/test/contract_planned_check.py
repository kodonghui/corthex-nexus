"""Pinned external QA: the contract's planned forms, read as the release that builds them will read them.

Requires the pinned contract-tool environment (PyYAML, jsonschema and openapi-spec-validator), never the
server's or the hub's runtime. TASK-279 of stage 10: the design revision of 2026-11-11 holds its changes to
the contract as planned forms that the other checks leave out (docs/06-api/nexus.md, "How the contract holds
the planned forms"). This check puts each path item under components.pathItems in place of the built operation
that it replaces and makes each planned property required, validates the result as OpenAPI 3.1, and holds each
planned response example and each planned body to its schema and to the rules that no schema states. It names
the examples of built operations that gain members then, and says how many planned forms remain: a form that a
task moves into paths leaves the planned list by itself. Since TASK-320 of 2026-11-14 it reads phase ②'s forms in
the same way, and puts each built value that phase ② widens, marked x-corthex.becomes, in place of the built one.
"""
import collections
import copy
import json
import re
import sys
from pathlib import Path

import jsonschema
import yaml
from openapi_spec_validator import validate

from contract_example_check import check_response_example_applicability

METHODS = ("get", "post", "put", "patch", "delete", "head")
# The planned bodies of built requests. TASK-297 built those of leaveComment and replyToComment into NewComment and
# NewReply on 2026-11-13, and TASK-301 that of passCheckpoint into NewCheckpoint the same day; the server checks the
# rules that their schemas do not state in code (nexus/src/entry-plan.js), which its tests hold. TASK-320 planned
# phase ②'s four on 2026-11-14. The bodies of phase ②'s new requests are schemas of their own already.
PLANNED_BODIES = {"PlannedNewComment", "PlannedEditReport", "PlannedNewCheckpoint", "PlannedCheckpointReport"}
# The examples of built operations whose schemas gain the planned properties as required members, so that they
# stop fitting until the release that builds those properties adds them. A change that alters this list changes
# it here in the same commit, with the examples that it adds the members to. TASK-301 added the checkpoint's
# revision and entry, and comment with them, to the five that it held. Since TASK-320 phase ②'s members of Checkpoint
# (API-117), of Edit and EditWithProposal (API-124, API-127) and of StageHead and StageTalk (API-112, API-157) are
# planned, and the planned forms of the requests that phase ② changes hold them; these examples gain them.
GAINING = {("API-112", "200", "erd-of-nexus"), ("API-117", "200", "passed"), ("API-124", "200", "accepted"),
           ("API-127", "200", "already-dismissed"), ("API-127", "200", "dismissed"), ("API-157", "200", "table")}
# Phase ②'s steps of stage 01's workshop, in their order, and those after which a checkpoint passes (SPEC-176).
STEPS = ["0", "1-a", "1-b", "2", "3", "4", "5", "6", "7", "8-a", "8-b", "9"]
CHECKPOINT_STEPS = ("1-b", "7", "9")
# The members that phase ②'s planned codes name (Error codes of phase ② in nexus.md).
MEMBERS = {
    "draft_revision": ("draft", "revision", "saved_at"), "draft_closed": ("state",), "picture_changed": ("latest",),
    "draft_not_applying": ("changes",), "draft_too_large": ("field", "limit"), "unknown_name": ("names",),
    "workshop_open": ("workshop",), "frame_not_next": ("next",), "checkpoint_waits": ("step",), "frame_closed": ("frame",),
    "element_changed": ("at", "element"), "not_placed_by_agent": ("element",), "board_limit": ("field", "limit"),
    "board_changed": ("version",), "not_checkpoint_step": ("step",),
}


def resolver(api):
    def resolve(value):
        while isinstance(value, dict) and "$ref" in value:
            pointer = value["$ref"]
            if not pointer.startswith("#/"):
                raise ValueError("only local contract references are allowed")
            value = api
            for key in pointer[2:].split("/"):
                value = value[key.replace("~1", "/").replace("~0", "~")]
        return value
    return resolve


def planned_properties(node, where="#/components/schemas"):
    """Yield (pointer of the object schema, the schema, the property's name) for each planned property."""
    if isinstance(node, dict):
        for name, member in node.get("properties", {}).items():
            if isinstance(member, dict) and member.get("x-corthex", {}).get("status") == "planned":
                yield where, node, name
        for key, value in node.items():
            yield from planned_properties(value, where + "/" + str(key))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from planned_properties(value, where + "/" + str(index))


def widened_values(node, where="#/components/schemas"):
    """Yield the pointer of each built value that a planned form widens, marked x-corthex.becomes."""
    if isinstance(node, dict):
        if isinstance(node.get("x-corthex"), dict) and "becomes" in node["x-corthex"]:
            yield where
            return
        for key, value in node.items():
            yield from widened_values(value, where + "/" + str(key))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from widened_values(value, where + "/" + str(index))


def widen(node):
    """node with each value that it widens replaced by x-corthex.becomes, which keeps the value's description."""
    if isinstance(node, list):
        return [widen(value) for value in node]
    if not isinstance(node, dict):
        return node
    if isinstance(node.get("x-corthex"), dict) and "becomes" in node["x-corthex"]:
        found = {"description": node["description"]} if "description" in node else {}
        found.update(copy.deepcopy(node["x-corthex"]["becomes"]))
        return found
    return {key: widen(value) for key, value in node.items()}


def planned_forms(api):
    """What the contract plans: the path items, the new operations, the properties, the widened values, the bodies and
    the codes."""
    built = {}
    for path, item in api["paths"].items():
        for method, operation in item.items():
            if method in METHODS:
                built[operation["operationId"]] = (path, method, operation)
    items = []
    for name, item in api["components"].get("pathItems", {}).items():
        for method, operation in item.items():
            if method not in METHODS:
                continue
            meta = operation.get("x-corthex", {})
            replaces = meta.get("replaces")
            if replaces not in built:
                raise SystemExit(f"the planned path item {name} replaces no built operation: {replaces}")
            path, built_method, _ = built[replaces]
            if built_method != method or meta.get("status") != "planned" or "operationId" in operation:
                raise SystemExit(f"the planned path item {name} is not in the form that stage 06 gives it")
            items.append({"name": name, "path": path, "method": method, "id": meta["id"]})
    operations = [{"name": operation_id, "path": path, "method": method, "id": operation["x-corthex"]["id"]}
                  for operation_id, (path, method, operation) in built.items()
                  if operation.get("x-corthex", {}).get("status") == "planned"]
    properties = [(where, name) for where, _, name in planned_properties(api["components"]["schemas"])]
    bodies = sorted(name for name in api["components"]["schemas"] if name in PLANNED_BODIES)
    meta = api["components"].get("x-corthex", {})
    codes = sorted(code for code in meta.get("planned_errors", {}) if code not in meta.get("errors", {}))
    meanings = sorted(code for code in meta.get("planned_errors", {}) if code in meta.get("errors", {}))
    widened = list(widened_values(api["components"]["schemas"]))
    return {"pathItems": items, "operations": operations, "properties": properties, "widened": widened,
            "bodies": bodies, "codes": codes, "meanings": meanings}


def planned_view(api):
    """The contract as the release that builds every planned form will hold it."""
    view = copy.deepcopy(api)
    forms = planned_forms(view)
    for item in forms["pathItems"]:
        operation = copy.deepcopy(view["components"]["pathItems"][item["name"]][item["method"]])
        operation["operationId"] = operation["x-corthex"]["replaces"]
        view["paths"][item["path"]][item["method"]] = operation
    view["components"]["schemas"] = widen(view["components"]["schemas"])
    for _, schema, name in list(planned_properties(view["components"]["schemas"])):
        required = schema.setdefault("required", [])
        if name not in required:
            required.append(name)
    return view, forms


def change_rules(changes, waiting):
    """The rules of a list of changes (Change): waiting is whether the list may name the temporary names of the waiting
    edits that its draft starts on, or of a draft that the list does not show."""
    found = []
    added = collections.Counter(change["item"] for change in changes if change["kind"] == "added")
    for change in changes:
        kind = change["kind"]
        if kind == "added" and change["before"] or kind == "removed" and change["after"]:
            found.append("an added change has no before, and a removed one no after")
        if ("to" in change) != (kind in ("connected", "disconnected")):
            found.append("a connection and a disconnection name the other item, and no other change does")
        if "at" in change and kind != "added":
            found.append("only an added change names where the user placed the item")
        if kind == "added" and not str(change["item"]).startswith("new-"):
            found.append("an added item goes by its temporary name")
        if not waiting and any(isinstance(name, str) and name.startswith("new-") and name not in added
                               for name in (change["item"], change.get("to"))):
            found.append("a list names only the temporary names that it adds")
    if any(count > 1 for count in added.values()):
        found.append("a list adds each temporary name once")
    return found


def body_rules(schema_name, value):
    """The rules of a planned body that its schema does not state, as the planned forms' descriptions give them.

    The pass's rules, one of commit and revision and a request's comment with its entry, left with its planned
    body when TASK-301 built it: the server answers them 400 by the field, and its tests hold each one. Phase ②'s
    bodies and the planned bodies of the requests that it changes have theirs here (TASK-320)."""
    found = []
    if schema_name == "DraftSave":
        first = value["draft"] is None
        if first != (value["revision"] == 0):
            found.append("a first save sends draft null with revision 0, and a later save neither")
        if first and "commit" not in value:
            found.append("a first save names the document version that the editor opened")
        if not first and ("commit" in value or "starts_on" in value):
            found.append("a later save names no document version and no edits to start on")
        found.extend(change_rules(value["changes"], waiting=not first or "starts_on" in value))
    elif schema_name == "BoardChange":
        operations = value["operations"]
        if not operations and "frame" not in value:
            found.append("a board's change without operations adds a frame")
        keys = [operation["key"] for operation in operations if "key" in operation]
        if len(keys) != len(set(keys)):
            found.append("a board's change uses each key once")
        placed = {operation["key"] for operation in operations if operation["op"] == "place"}
        for operation in operations:
            named = [operation["from"], operation["to"]] if operation["op"] == "arrow" else operation.get("members", [])
            if any(not name.startswith("ns_") and name not in placed for name in named):
                found.append("an arrow or a group names stickies by ID or by the key of a sticky that its change places")
    elif schema_name == "NewWorkshop":
        if any(not item.startswith("CTX-") for item in value.get("scope", {}).get("change", [])):
            found.append("a workshop's scope names the contexts to change by their CTX IDs")
    elif schema_name == "PlannedNewComment":
        if re.match(r"n[sf]_", value["item"]) and value["stage"] != "01-domain":
            found.append("a comment names a sticky or a frame only on stage 01-domain")
        if ("look_first" in value) != (value.get("asks") == "checkpoint"):
            found.append("a checkpoint request names the thing to look at first, and no other comment does")
    elif schema_name == "PlannedEditReport":
        if "ids" in value and value["event"] != "merged":
            found.append("a report names ids only with merged")
        if "comment" in value and value["event"] not in ("needs-user", "merged"):
            found.append("a report names a comment only with needs-user or merged")
    elif schema_name == "PlannedNewCheckpoint":
        if ("frame" in value) != ("board_version" in value):
            found.append("a workshop's pass names its frame and its board version together")
        if "frame" in value and value["stage"] != "01-domain":
            found.append("only a pass on stage 01-domain names a frame")
    elif schema_name == "PlannedCheckpointReport":
        if (value["event"] == "differs") == ("pull_request" in value):
            found.append("differs names no pull request, and each other event names one")
    return found


def phase_two_rules(value):
    """The rules of phase ②'s objects in an answer that no schema states, as the descriptions give them (TASK-320)."""
    found = []
    if {"made_version", "change", "removed", "removed_at"} <= set(value):
        if value["removed"] != (value["removed_at"] is not None) or value["removed"] != (value["change"] == "removed"):
            found.append("a board element is removed exactly when it names removed_at and its last change removed it")
        if "removed_by" in value and value["removed"] != (value["removed_by"] is not None):
            found.append("a sticky names who removed it exactly when it is removed")
        if value["change"] == "copied" and value.get("copies") is None:
            found.append("a copied board element names what it copies")
        if value["made_version"] > value["version"]:
            found.append("a board element's last change is not older than its placing")
    if {"source_id", "source_name", "label", "author"} <= set(value):
        if (value["author"] == "source") != (value["source_id"] is not None):
            found.append("a sticky from the source names its source_id, and no other sticky does")
        if value["source_name"] is not None and value["source_id"] is None:
            found.append("a sticky names source_name only with source_id")
        if value["label"] is not None and (value["author"] != "agent" or value["changed_by"] == "user"
                                           and value["change"] == "changed"):
            found.append("only the agent's sticky that the user did not change holds a label")
    if {"way", "read_version", "ended_at"} <= set(value):
        if (value["state"] == "ended") != (value["ended_at"] is not None):
            found.append("a workshop has ended exactly when it names ended_at")
        if (value["read_version"] is None) != (value["read_at"] is None):
            found.append("a workshop names the agent's read with its version and its time")
        if value["read_version"] is not None and value["read_version"] > value["version"]:
            found.append("the agent's read of a board is not newer than the board")
    if {"workshop", "step", "checkpoint", "changed_by"} <= set(value):
        if value["checkpoint"] is not None and value["step"] not in CHECKPOINT_STEPS:
            found.append("only a frame of the steps 1-b, 7 and 9 holds a checkpoint")
    if {"marks", "since", "upto", "frames"} <= set(value):
        if value["since"] is not None and value["upto"] is not None:
            found.append("a board is read since a version or up to a checkpoint, not both")
        if value["since"] is not None and (value["since"] > value["version"] or any(
                element["version"] <= value["since"] for kind in ("stickies", "arrows", "groups") for element in value[kind])):
            found.append("a board read since a version holds only what changed after it")
        if value["upto"] is None and value["version"] != value["workshop"]["version"] or value["version"] > value["workshop"]["version"]:
            found.append("a board shows its own version, or with upto the version that the checkpoint passed")
        if [STEPS.index(frame["step"]) for frame in value["frames"]] != sorted({STEPS.index(frame["step"]) for frame in value["frames"]}):
            found.append("a board's frames are in step order, one for each step")
    if {"unchanged", "keys", "changed"} <= set(value) and not value["changed"]:
        if value["frame"] is not None or value["keys"] or value["stickies"] or value["arrows"] or value["groups"]:
            found.append("a change that changed nothing writes nothing")
    if {"board_version", "differs", "pull_request", "pr_state"} <= set(value):
        if (value["pull_request"] is None) != (value["pr_state"] is None):
            found.append("a checkpoint names its pull request with its state")
        if value["differs"] and value["pull_request"] is not None:
            found.append("a checkpoint differs only until its pull request is reported")
    if "recorded_commit" in value and "frame" in value:
        if (value["frame"] is None) != (value["board_version"] is None):
            found.append("a workshop's checkpoint names its frame and its board version together")
        if value["differs"] and value["frame"] is None:
            found.append("only a workshop's checkpoint differs")
    if {"applies", "binds", "latest", "commit"} <= set(value):
        older = value["commit"] != value["latest"]
        if (value["applies"] is not None) != older or (value["binds"] is not None) != older:
            found.append("a draft says whether its changes apply and whether it binds exactly when it is on an older version")
        if value["applies"] is not None and len(value["applies"]) != len(value["changes"]):
            found.append("a draft says for each of its changes whether it applies")
    if "dropped_at" in value and "state" in value:
        if (value["state"] == "dropped") != (value["dropped_at"] is not None):
            found.append("an edit names when it was dropped exactly when it is dropped")
        if "changes" in value and (value["changes"] is None) != (value["note"] is None):
            found.append("an edit sent from the editor names its list and its note, and an edit that a proposal made neither")
        if "changes" in value and value["changes"] is None and (value["notes"] or value["starts_on"]):
            found.append("only an edit sent from the editor holds notes and edits that it starts on")
        if value.get("ids") and not set(value["ids"]) <= {change["item"] for change in value["changes"] or []
                                                           if change["kind"] == "added"}:
            found.append("an edit's ids name only the temporary names that it added")
    for key in ("changes", "earlier"):
        changes = value.get(key)
        if isinstance(changes, list) and changes and all(isinstance(change, dict) and {"kind", "item", "before", "after"}
                                                          <= set(change) for change in changes):
            found.extend(change_rules(changes, waiting=key == "earlier" or bool(value.get("starts_on"))))
    return found


def answer_rules(api, value, where=()):
    """The rules of an answer that no schema states, for every object of a response example.

    They held the planned examples only, until TASK-301 built the pass and its two codes: since then they hold the
    built examples too, so that the examples that moved into paths keep their rules."""
    found = []
    errors = api["components"].get("x-corthex", {}).get("errors", {})
    planned = api["components"].get("x-corthex", {}).get("planned_errors", {})
    if isinstance(value, dict):
        if "traceId" in value and "code" in value and "status" in value:
            known = errors.get(value["code"]) or planned.get(value["code"])
            if known is None:
                found.append((where, "a refusal names a code of errors or planned_errors"))
            elif known["status"] != value["status"]:
                found.append((where, "a refusal's status is its code's"))
            if value["code"] == "checkpoint_requested" and "comment" not in value:
                found.append((where, "checkpoint_requested names the open request"))
            if value["code"] == "snapshot_changed" and ("held_commit" in value) == ("revision" in value):
                found.append((where, "snapshot_changed names the held commit or the revision"))
            if value["code"] == "request_changed" and ("comment" in value) != ("entry" in value):
                found.append((where, "request_changed names the open request with its last entry"))
            if any(member not in value for member in MEMBERS.get(value["code"], ())):
                found.append((where, "a phase ② code names its members"))
            if value["code"] == "draft_closed" and (value.get("state") not in ("sent", "dropped")
                                                    or ("edit" in value) != (value.get("state") == "sent")):
                found.append((where, "draft_closed names how the draft closed, and the edit when it was sent"))
            if value["code"] in ("element_changed", "not_placed_by_agent") and (
                    isinstance(value.get("element"), dict) != (value["code"] == "element_changed")):
                found.append((where, "element_changed names the element as it is now, and not_placed_by_agent its ID"))
        if "look_first" in value and "asks" in value:
            if value["asks"] == "checkpoint" and value["look_first"] is None:
                found.append((where, "an entry that asks for the checkpoint names the thing to look at first"))
            if value["asks"] in ("answer", "recommended") and value["look_first"] is not None:
                found.append((where, "only a checkpoint request holds look_first"))
        if "revision" in value and "recorded_commit" in value:
            if value.get("commit") is not None and value.get("revision") is not None:
                found.append((where, "a checkpoint names the commit or the revision that the pass named, not both"))
            if value.get("entry") is not None and value.get("comment") is None:
                found.append((where, "a checkpoint names a request's entry with its comment"))
        found.extend((where, rule) for rule in phase_two_rules(value))
        for key, member in value.items():
            found.extend(answer_rules(api, member, where + (key,)))
    elif isinstance(value, list):
        for index, member in enumerate(value):
            found.extend(answer_rules(api, member, where + (index,)))
    return found


def check(api):
    view, forms = planned_view(api)
    resolve = resolver(view)
    findings = []
    try:
        validate(view)
    except Exception as error:  # the validator's own error types differ between its versions
        findings.append({"rule": "the planned view is valid OpenAPI 3.1", "error": str(error)[:300]})
    planned = {(item["path"], item["method"]) for item in forms["pathItems"] + forms["operations"]}
    validators, examples, built, bodies, gaining = {}, 0, 0, 0, set()

    def validator(schema):
        key = json.dumps(schema, sort_keys=True)
        if key not in validators:
            validators[key] = jsonschema.Draft202012Validator(schema, resolver=jsonschema.RefResolver.from_schema(view),
                format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER)
        return validators[key]

    for path, item in view["paths"].items():
        for method, operation in item.items():
            if method not in METHODS:
                continue
            api_id = operation["x-corthex"]["id"]
            is_planned = (path, method) in planned
            if is_planned and "requestBody" in operation:
                content = resolve(operation["requestBody"])["content"]["application/json"]
                schema_name = content["schema"].get("$ref", "").rsplit("/", 1)[-1]
                for name, reference in content.get("examples", {}).items():
                    bodies += 1
                    value = resolve(reference)["value"]
                    for error in list(validator(content["schema"]).iter_errors(value))[:5]:
                        findings.append({"api": api_id, "body": name, "path": list(error.absolute_path), "rule": error.validator})
                    for rule in body_rules(schema_name, value):
                        findings.append({"api": api_id, "body": name, "rule": rule})
            for status, response in operation["responses"].items():
                for media, content in resolve(response).get("content", {}).items():
                    if "json" not in media:
                        continue
                    for name, reference in content.get("examples", {}).items():
                        value = resolve(reference)["value"]
                        errors = list(validator(content["schema"]).iter_errors(value))
                        for where, rule in answer_rules(view, value):
                            findings.append({"api": api_id, "status": str(status), "example": name,
                                             "path": list(where), "rule": rule})
                        if not is_planned:
                            built += 1
                            if errors:
                                gaining.add((api_id, str(status), name))
                            continue
                        examples += 1
                        for error in errors[:5]:
                            findings.append({"api": api_id, "status": str(status), "example": name,
                                             "path": list(error.absolute_path), "rule": error.validator})
    if gaining != GAINING:
        findings.append({"rule": "the examples of built operations that gain members are the known list",
                         "unexpected": sorted(gaining - GAINING), "missing": sorted(GAINING - gaining)})
    planned_view_only = {"paths": {path: {method: operation for method, operation in item.items()
                                          if method not in METHODS or (path, method) in planned}
                                   for path, item in view["paths"].items()}}
    for finding in check_response_example_applicability({**view, **planned_view_only})["findings"]:
        findings.append({**finding, "rule": "a planned example names the planned form's inputs"})
    return {"forms": forms, "examples": examples, "built": built, "bodies": bodies, "gaining": sorted(gaining),
            "findings": findings}


def self_test(api):
    """A planned example that stops fitting, and an example that breaks a rule that no schema states, fail the check."""
    broken = copy.deepcopy(api)
    items = broken["components"].setdefault("pathItems", {})
    if not items:
        # When nothing remains planned, as between TASK-311 and TASK-320 of 2026-11-14, the built removal, planned
        # again as the path item that it was, stands in for a form, so that the check still shows that it holds one.
        path, method, operation = next((path, method, operation) for path, item in broken["paths"].items()
                                       for method, operation in item.items()
                                       if method in METHODS and operation["operationId"] == "removeProject")
        form = copy.deepcopy(operation)
        replaces = form.pop("operationId")
        form["x-corthex"] = {**form["x-corthex"], "replaces": replaces, "status": "planned"}
        items[replaces] = {"parameters": copy.deepcopy(broken["paths"][path].get("parameters", [])), method: form}
    form = next(iter(items.values()))
    operation = next(operation for method, operation in form.items() if method in METHODS)
    resolve = resolver(broken)
    example = next(resolve(example) for response in operation["responses"].values()
                   for content in resolve(response).get("content", {}).values()
                   for example in content.get("examples", {}).values()
                   if isinstance(resolve(example).get("value"), dict))
    # The example keeps none of its members and holds one that no schema names, so that it fails whether or not its
    # schema takes other members, whichever path item is the first.
    example["value"] = {"unknown_member": True}
    # The pass's refusal after a push names the revision beside the held commit, which its schema takes and the
    # rule refuses. Since TASK-301 the pass is built, and no planned body remains to break.
    broken["components"]["examples"]["snapshot_changed"]["value"]["revision"] = 4
    # Phase ②'s rules: a later save of a draft that names a document version, and a board whose workshop has ended
    # without its time, which their schemas take and the rules refuse.
    save = next(operation for item in broken["paths"].values() for method, operation in item.items()
                if method in METHODS and operation.get("operationId") == "saveEditDraft")
    later = save["requestBody"]["content"]["application/json"]["examples"]["later-save"]["value"]
    later["commit"] = "3f1c9a7e5b2d4c6a8e0f1b3d5c7a9e1f2b4d6c8a"
    broken["components"]["examples"]["work_board"]["value"]["workshop"]["state"] = "ended"
    found = check(broken)["findings"]
    texts = {finding["rule"] for finding in found if "example" in finding or "body" in finding}
    planned = {finding["example"] for finding in found if finding.get("api") == operation["x-corthex"]["id"]}
    expected = {"snapshot_changed names the held commit or the revision",
                "a later save names no document version and no edits to start on",
                "a workshop has ended exactly when it names ended_at"}
    if not expected <= texts or not planned:
        raise SystemExit("the planned check let a broken example pass")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "docs/06-api/nexus.openapi.yaml"
    api = yaml.safe_load(source.read_text(encoding="utf8"))
    result = check(api)
    if result["findings"]:
        print(json.dumps(result["findings"][:20], indent=1))
        raise SystemExit(f"{len(result['findings'])} findings in the contract's planned forms")
    self_test(api)
    forms = result["forms"]
    print(f"planned forms: {len(forms['pathItems'])} path items, {len(forms['operations'])} new operations, "
          f"{len(forms['properties'])} properties, {len(forms['widened'])} widened values, {len(forms['bodies'])} bodies, "
          f"{len(forms['codes'])} codes and {len(forms['meanings'])} changed meanings of codes remain planned; "
          f"the planned view is valid OpenAPI 3.1; {result['examples']} planned response examples and {result['bodies']} planned "
          f"request examples fit their schemas and rules, and {result['built']} built response examples the rules; "
          f"{len(result['gaining'])} examples of {len({api_id for api_id, _, _ in result['gaining']})} built operations "
          f"gain members; a broken example, a broken body and broken rules fail")
