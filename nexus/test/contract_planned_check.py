"""Pinned external QA: the contract's planned forms, read as the release that builds them will read them.

Requires the pinned contract-tool environment (PyYAML, jsonschema and openapi-spec-validator), never the
server's or the hub's runtime. TASK-279 of stage 10: the design revision of 2026-11-11 holds its changes to
the contract as planned forms that the other checks leave out (docs/06-api/nexus.md, "How the contract holds
the planned forms"). This check puts each path item under components.pathItems in place of the built operation
that it replaces and makes each planned property required, validates the result as OpenAPI 3.1, and holds each
planned response example and each planned body to its schema and to the rules that no schema states. It names
the examples of built operations that gain members then, and says how many planned forms remain: a form that a
task moves into paths leaves the planned list by itself.
"""
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
PLANNED_BODIES = {"PlannedNewComment", "PlannedNewReply", "PlannedNewCheckpoint"}
# The examples of built operations whose schemas gain the planned properties as required members, so that they
# stop fitting until the release that builds those properties adds them. A change that alters this list changes
# it here in the same commit, with the examples that it adds the members to.
GAINING = {
    ("API-111", "200", "erd-with-a-comment"),
    ("API-112", "200", "erd-of-nexus"),
    ("API-114", "200", "settled"),
    ("API-117", "200", "passed"),
    ("API-129", "200", "withdrawn"),
    ("API-129", "200", "already-withdrawn"),
    ("API-130", "200", "opened"),
    ("API-157", "200", "table"),
}
TRACE_ID = re.compile(r"^[A-Z]{2,5}-[0-9]{3,4}$")


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


def planned_forms(api):
    """What the contract plans: the path items, the new operations, the properties, the bodies and the codes."""
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
    return {"pathItems": items, "operations": operations, "properties": properties, "bodies": bodies, "codes": codes,
            "meanings": meanings}


def planned_view(api):
    """The contract as the release that builds every planned form will hold it."""
    view = copy.deepcopy(api)
    forms = planned_forms(view)
    for item in forms["pathItems"]:
        operation = copy.deepcopy(view["components"]["pathItems"][item["name"]][item["method"]])
        operation["operationId"] = operation["x-corthex"]["replaces"]
        view["paths"][item["path"]][item["method"]] = operation
    for _, schema, name in list(planned_properties(view["components"]["schemas"])):
        required = schema.setdefault("required", [])
        if name not in required:
            required.append(name)
    return view, forms


def lines(text):
    return text.count("\n") + 1


def body_rules(schema_name, value):
    """The rules of a planned body that its schema does not state, as the planned forms' descriptions give them."""
    found = []
    if schema_name in ("PlannedNewComment", "PlannedNewReply"):
        if value.get("asks") == "checkpoint":
            if schema_name == "PlannedNewComment" and value.get("item") != "":
                found.append("a checkpoint request is on the stage as a whole, with an empty item")
            if len(value.get("text", "")) > 1200 or lines(value.get("text", "")) > 10:
                found.append("a checkpoint request holds at most 1,200 characters and 10 lines")
            if "look_first" not in value:
                found.append("a checkpoint request names the thing to look at first")
        elif "look_first" in value:
            found.append("only a checkpoint request sends look_first")
        look = value.get("look_first")
        if look is not None and not (TRACE_ID.match(look) or look.startswith("https://")):
            found.append("look_first is a trace ID or an https address")
    if schema_name == "PlannedNewCheckpoint":
        if ("commit" in value) == ("revision" in value):
            found.append("a pass names commit or revision, one of the two")
        if ("comment" in value) != ("entry" in value):
            found.append("a pass names a request's comment and entry together")
    return found


def answer_rules(api, value, where=()):
    """The rules of an answer that no schema states, for every object of a planned example."""
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
    validators, examples, bodies, gaining = {}, 0, 0, set()

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
                        if not is_planned:
                            if errors:
                                gaining.add((api_id, str(status), name))
                            continue
                        examples += 1
                        for error in errors[:5]:
                            findings.append({"api": api_id, "status": str(status), "example": name,
                                             "path": list(error.absolute_path), "rule": error.validator})
                        for where, rule in answer_rules(view, value):
                            findings.append({"api": api_id, "status": str(status), "example": name,
                                             "path": list(where), "rule": rule})
    if gaining != GAINING:
        findings.append({"rule": "the examples of built operations that gain members are the known list",
                         "unexpected": sorted(gaining - GAINING), "missing": sorted(GAINING - gaining)})
    planned_view_only = {"paths": {path: {method: operation for method, operation in item.items()
                                          if method not in METHODS or (path, method) in planned}
                                   for path, item in view["paths"].items()}}
    for finding in check_response_example_applicability({**view, **planned_view_only})["findings"]:
        findings.append({**finding, "rule": "a planned example names the planned form's inputs"})
    return {"forms": forms, "examples": examples, "bodies": bodies, "gaining": sorted(gaining), "findings": findings}


def self_test(api):
    """A planned example or body that stops fitting fails the check."""
    broken = copy.deepcopy(api)
    form = next(iter(broken["components"]["pathItems"].values()))
    operation = next(operation for method, operation in form.items() if method in METHODS)
    resolve = resolver(broken)
    example = next(resolve(example) for response in operation["responses"].values()
                   for content in resolve(response).get("content", {}).values()
                   for example in content.get("examples", {}).values()
                   if isinstance(resolve(example).get("value"), dict))
    example["value"] = {**example["value"], "unknown_member": True}
    comment = broken["components"]["pathItems"]["leaveComment"]["post"]["requestBody"]["content"]["application/json"]
    comment["examples"]["a-checkpoint-request"]["value"].pop("look_first")
    found = check(broken)["findings"]
    rules = {finding["rule"] for finding in found}
    if "a checkpoint request names the thing to look at first" not in rules or not any("example" in finding for finding in found):
        raise SystemExit("the planned check let a broken example or body pass")


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
          f"{len(forms['properties'])} properties, {len(forms['bodies'])} bodies, {len(forms['codes'])} codes and "
          f"{len(forms['meanings'])} changed meanings of codes remain planned; "
          f"the planned view is valid OpenAPI 3.1; {result['examples']} planned response examples and {result['bodies']} planned "
          f"bodies fit their schemas and rules; {len(result['gaining'])} examples of "
          f"{len({api_id for api_id, _, _ in result['gaining']})} built operations gain members; a broken example and body fail")
