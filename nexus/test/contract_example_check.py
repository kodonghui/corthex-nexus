"""External QA: named write examples must fit the operation's real inputs.

Uses the existing pinned PyYAML environment, never the server/plugin runtime.
This checks applicability separately from response-schema validity: a valid
Problem document can still name a field or agent header the operation ignores.
"""
import json
import sys
from pathlib import Path

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

    def properties(schema):
        schema = resolve(schema)
        found = dict(schema.get("properties", {}))
        for key in ("allOf", "oneOf", "anyOf"):
            for branch in schema.get(key, []):
                found.update(properties(branch))
        return found

    findings = []
    named = 0
    for path, item in api["paths"].items():
        for method, operation in item.items():
            if method not in ("get", "post", "delete", "put", "patch", "head"):
                continue
            body = resolve(operation["requestBody"]) if "requestBody" in operation else None
            fields = properties(body["content"]["application/json"]["schema"]) if body else {}
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
                        elif field not in fields:
                            reason = "example names no declared request field"
                        elif code == "text_too_long":
                            bound = resolve(fields[field]).get("maxLength")
                            if bound is None or value.get("limit") != bound:
                                reason = "example limit differs from the declared field bound"
                        if reason:
                            findings.append({"api": operation["x-corthex"]["id"], "method": method,
                                "path": path, "status": str(status), "media": media,
                                "example": name, "field": field, "reason": reason})
    return {"namedResponseExamples": named, "findings": findings}


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "docs/06-api/nexus.openapi.yaml"
    result = check_response_example_applicability(yaml.safe_load(source.read_text(encoding="utf8")))
    print(json.dumps(result))
    raise SystemExit(1 if result["findings"] else 0)
