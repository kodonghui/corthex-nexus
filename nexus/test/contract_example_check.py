"""External QA: named examples must fit the operation's real inputs.

Uses the existing pinned PyYAML environment, never the server/plugin runtime.
This checks applicability separately from response-schema validity: a valid
Problem document can still name a field, query value or agent header that the
operation ignores. A query value is refused only as invalid_request. A field may
name a member inside the body, as operations[0].text does, and a refusal may name
a stored field that x-corthex.stored_fields lists, as API-164 names its draft's
changes (TASK-320).
"""
import json
import re
import sys
from pathlib import Path

import jsonschema
import yaml


def check_response_example_applicability(api):
    def resolve(value):
        while isinstance(value, dict) and "$ref" in value:
            pointer = value["$ref"]
            if not pointer.startswith("#/"):
                raise ValueError("only local contract references are allowed")
            value = api
            for key in pointer[2:].split("/"):
                value = value[key.replace("~1", "/").replace("~0", "~")]
        return value

    def reach(schema, segments):
        """The schemas that a field's segments reach in schema, through every branch of allOf, oneOf and anyOf."""
        schema = resolve(schema)
        found = []
        for key in ("allOf", "oneOf", "anyOf"):
            for branch in schema.get(key, []):
                found.extend(reach(branch, segments))
        if not segments:
            return [schema] + found
        head, rest = segments[0], segments[1:]
        if isinstance(head, int):
            if isinstance(schema.get("items"), dict):
                found.extend(reach(schema["items"], rest))
        elif head in schema.get("properties", {}):
            found.extend(reach(schema["properties"][head], rest))
        return found

    def segments(field):
        """operations[0].text as ["operations", 0, "text"]."""
        return [int(index) if index else name for index, name in re.findall(r"\[(\d+)\]|([^.\[\]]+)", field)]

    findings = []
    named = 0
    for path, item in api["paths"].items():
        for method, operation in item.items():
            if method not in ("get", "post", "delete", "put", "patch", "head"):
                continue
            body = resolve(operation["requestBody"]) if "requestBody" in operation else None
            body_schema = body["content"]["application/json"]["schema"] if body else None
            stored = operation.get("x-corthex", {}).get("stored_fields", [])
            queries = {parameter["name"] for parameter in map(resolve, item.get("parameters", []) + operation.get("parameters", []))
                       if parameter.get("in") == "query"}
            security = operation.get("security", api.get("security", []))
            user_only = security == [{"accessUser": []}]
            for status, response in operation["responses"].items():
                for media, content in resolve(response).get("content", {}).items():
                    for name, reference in content.get("examples", {}).items():
                        named += 1
                        value = resolve(reference).get("value")
                        if not isinstance(value, dict):
                            continue
                        code, field = value.get("code"), value.get("field")
                        if code not in ("invalid_request", "text_too_long") or not field:
                            continue
                        reason = None
                        if field == "Nexus-Session":
                            if user_only and operation["operationId"] != "getAgentTodo":
                                reason = "user-only operation ignores the agent session header"
                        elif field == "Idempotency-Key":
                            pass
                        elif field == "body":
                            if not body:
                                reason = "operation has no request body to validate"
                        elif field in queries:
                            if code != "invalid_request":
                                reason = "a query value is refused only as invalid_request"
                        elif field in stored:
                            if code != "invalid_request":
                                reason = "a stored field is refused only as invalid_request"
                        else:
                            reached = reach(body_schema, segments(field)) if body else []
                            bounds = {schema.get("maxLength") for schema in reached} - {None}
                            if not reached:
                                reason = "example names no declared request field"
                            elif code == "text_too_long" and value.get("limit") not in bounds:
                                reason = "example limit differs from the declared field bound"
                        if reason:
                            findings.append({"api": operation["x-corthex"]["id"], "method": method,
                                "path": path, "status": str(status), "media": media,
                                "example": name, "field": field, "reason": reason})
    return {"namedResponseExamples": named, "findings": findings}


def check_named_examples_fit_schemas(api):
    """Every named JSON example must be valid against its response's own schema."""
    def resolve(value):
        while isinstance(value, dict) and "$ref" in value:
            pointer = value["$ref"]
            if not pointer.startswith("#/"):
                raise ValueError("only local contract references are allowed")
            value = api
            for key in pointer[2:].split("/"):
                value = value[key.replace("~1", "/").replace("~0", "~")]
        return value

    validators, findings, checked = {}, [], 0
    for path, item in api["paths"].items():
        for method, operation in item.items():
            if method not in ("get", "post", "delete", "put", "patch", "head"):
                continue
            if operation.get("x-corthex", {}).get("status") == "planned":
                continue  # its examples fit the planned view, which contract_planned_check.py holds them to
            for status, response in operation["responses"].items():
                for media, content in resolve(response).get("content", {}).items():
                    if "json" not in media:
                        continue
                    validator = validators.get(id(content))
                    if validator is None:
                        validator = validators[id(content)] = jsonschema.Draft202012Validator(content["schema"],
                            resolver=jsonschema.RefResolver.from_schema(api),
                            format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER)
                    for name, reference in content.get("examples", {}).items():
                        checked += 1
                        errors = list(validator.iter_errors(resolve(reference)["value"]))
                        if errors:
                            findings.append({"api": operation["x-corthex"]["id"], "status": str(status), "media": media,
                                "example": name, "errors": [{"path": list(error.absolute_path), "rule": error.validator}
                                                            for error in errors[:5]]})
    return {"namedJsonExamples": checked, "findings": findings}


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "docs/06-api/nexus.openapi.yaml"
    api = yaml.safe_load(source.read_text(encoding="utf8"))
    result = check_response_example_applicability(api)
    fitted = check_named_examples_fit_schemas(api)
    print(json.dumps({**result, "schemaFit": fitted}))
    raise SystemExit(1 if result["findings"] or fitted["findings"] else 0)
