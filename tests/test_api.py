"""Check api/openapi.yaml against the stage-06 contract and the pinned hub's wire, with Python alone."""

import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import yaml_subset  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METHODS = ("get", "put", "post", "delete", "patch")

# The calls of the pinned corthex-hub (0.4.0 and 0.5.0), read from its transport, commands and outbox:
# (method, path): (Idempotency-Key, Nexus-Session) where the session is None, "optional" or "required".
HUB = {
    ("post", "/api/snapshots"): (False, None),
    ("get", "/api/snapshots/{project}/held"): (False, None),
    ("get", "/api/spaces/{project}/data"): (False, None),
    ("get", "/api/spaces/{project}/todo"): (False, "optional"),
    ("get", "/api/spaces/{project}/comments/{comment}"): (False, None),
    ("get", "/api/spaces/{project}/proposals/{proposal}"): (False, None),
    ("get", "/api/spaces/{project}/edits/{edit}"): (False, None),
    ("get", "/api/spaces/{project}/checkpoints/{checkpoint}"): (False, None),
    ("post", "/api/spaces/{project}/claims/{entry}"): (False, "required"),
    ("delete", "/api/spaces/{project}/claims/{entry}"): (False, "required"),
    ("post", "/api/spaces/{project}/comments"): (True, "required"),
    ("post", "/api/spaces/{project}/comments/{comment}/replies"): (True, "required"),
    ("post", "/api/spaces/{project}/comments/{comment}/answered"): (True, "required"),
    ("post", "/api/spaces/{project}/comments/{comment}/decisions"): (True, "required"),
    ("post", "/api/spaces/{project}/proposals"): (True, "required"),
    ("post", "/api/spaces/{project}/proposals/{proposal}/withdraw"): (True, "required"),
    ("post", "/api/spaces/{project}/edits/{edit}/report"): (True, "required"),
    ("post", "/api/spaces/{project}/checkpoints/{checkpoint}/report"): (True, "required"),
}
# Problem codes the hub handles by name, with the operations that must be able to send them.
HUB_CODES = {
    ("get", "/api/snapshots/{project}/held"): "project_not_found",
    ("get", "/api/spaces/{project}/data"): "project_not_found",
    ("get", "/api/spaces/{project}/todo"): "space_not_found",
}
ACCOUNTED = ("400", "401", "403", "404", "409", "default")


def load():
    with open(os.path.join(ROOT, "api", "openapi.yaml"), encoding="utf-8") as fh:
        return yaml_subset.load(fh.read())


def resolve(doc, schema):
    while "$ref" in schema:
        node = doc
        for part in schema["$ref"].lstrip("#/").split("/"):
            node = node[part]
        schema = node
    return schema


def kind_of(value):
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        return "array"
    return "object"


def validate(doc, value, schema, where="$"):
    """The errors of value against the JSON Schema subset the contract uses."""
    schema = resolve(doc, schema)
    errors = []
    if "anyOf" in schema:
        if not any(not validate(doc, value, branch, where) for branch in schema["anyOf"]):
            errors.append("%s matches no branch of anyOf" % where)
        return errors
    if "if" in schema and not validate(doc, value, schema["if"], where):
        errors += validate(doc, value, schema.get("then", {}), where)
    if "const" in schema and (value != schema["const"] or kind_of(value) != kind_of(schema["const"])):
        errors.append("%s is not %r" % (where, schema["const"]))
    if "enum" in schema and value not in schema["enum"]:
        errors.append("%s: %r is not one of the enum" % (where, value))
    if "type" in schema:
        types = schema["type"] if isinstance(schema["type"], list) else [schema["type"]]
        actual = kind_of(value)
        if actual not in types and not (actual == "integer" and "number" in types):
            return errors + ["%s is %s, not %s" % (where, actual, "/".join(types))]
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", len(value)):
            errors.append("%s has a length outside its limits" % where)
        if "pattern" in schema and not re.search(schema["pattern"], value):
            errors.append("%s: %r does not match %s" % (where, value, schema["pattern"]))
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value < schema.get("minimum", value) or value > schema.get("maximum", value):
            errors.append("%s: %r is outside its range" % (where, value))
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0) or len(value) > schema.get("maxItems", len(value)):
            errors.append("%s has a count outside its limits" % where)
        if schema.get("uniqueItems") and len({repr(v) for v in value}) != len(value):
            errors.append("%s repeats an item" % where)
        for index, item in enumerate(value):
            errors += validate(doc, item, schema.get("items", {}), "%s[%d]" % (where, index))
    if isinstance(value, dict):
        for name in schema.get("required", []):
            if name not in value:
                errors.append("%s lacks %s" % (where, name))
        props = schema.get("properties", {})
        extra = schema.get("additionalProperties", True)
        for name, item in value.items():
            if name in props:
                errors += validate(doc, item, props[name], "%s.%s" % (where, name))
            elif extra is False:
                errors.append("%s has %s, which the schema does not allow" % (where, name))
            elif isinstance(extra, dict):
                errors += validate(doc, item, extra, "%s.%s" % (where, name))
        if len(value) < schema.get("minProperties", 0) or len(value) > schema.get("maxProperties", len(value)):
            errors.append("%s has a property count outside its limits" % where)
    return errors


def operations(doc):
    for path, item in doc["paths"].items():
        for method, op in item.items():
            if method in METHODS:
                yield method, path, op


def params_of(doc, op):
    return [resolve(doc, p) for p in op.get("parameters", [])]


def spec_ids():
    with open(os.path.join(ROOT, "docs", "04-functional-spec", "spec.md"), encoding="utf-8") as fh:
        return re.findall(r"^\| (SPEC-\d+) \|", fh.read(), re.M)


class ApiContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = load()
        cls.ops = list(operations(cls.doc))
        cls.errors = cls.doc["components"]["x-corthex"]["errors"]

    def test_contract_is_openapi_3_1(self):
        self.assertEqual(self.doc["openapi"], "3.1.0")
        self.assertTrue(self.ops)

    def test_every_operation_has_an_api_id_and_spec_rows(self):
        known = set(spec_ids())
        with open(os.path.join(ROOT, "db", "nexus.sql"), encoding="utf-8") as fh:
            tables = set(re.findall(r"^-- (TBL-\d+) ", fh.read(), re.M))
        ids, names = [], []
        for method, path, op in self.ops:
            mark = op["x-corthex"]
            self.assertRegex(mark["id"], r"^API-\d{3}$", path)
            ids.append(mark["id"])
            names.append(op["operationId"])
            self.assertTrue(mark["spec"], "%s %s names no spec row" % (method, path))
            self.assertLessEqual(set(mark["spec"]), known, "%s names spec rows that do not exist" % mark["id"])
            self.assertLessEqual(set(mark.get("tables", [])), tables, "%s names tables that do not exist" % mark["id"])
            self.assertIn(mark["release"], ("Must", "Should", "Could"))
            self.assertIn(mark["family"], ("agent", "owner"))
        self.assertEqual(len(ids), len(set(ids)), "an API ID is used twice")
        self.assertEqual(len(names), len(set(names)), "an operationId is used twice")
        self.assertGreaterEqual(min(int(i[4:]) for i in ids), 242, "v3 API IDs start after v2's")

    def test_every_spec_row_has_an_operation_or_a_reason(self):
        named = {sp for _, _, op in self.ops for sp in op["x-corthex"]["spec"]}
        reasons = self.doc["components"]["x-corthex"]["no_operation"]
        for row in spec_ids():
            self.assertTrue(row in named or reasons.get(row), "%s has no operation and no reason" % row)
            self.assertFalse(row in named and row in reasons, "%s has an operation and a reason" % row)

    def test_every_operation_accounts_for_each_response(self):
        for method, path, op in self.ops:
            listed = set(op["responses"])
            omit = op["x-corthex"].get("omit", {})
            where = "%s %s" % (method, path)
            self.assertTrue(listed & {"200", "201", "204"}, where + " has no success")
            self.assertFalse("422" in listed, where + ": validation errors are 400 in every operation")
            for status in ACCOUNTED:
                self.assertTrue(status in listed or omit.get(status), "%s does not account for %s" % (where, status))
                self.assertFalse(status in listed and status in omit, "%s lists and omits %s" % (where, status))

    def test_every_response_has_examples_that_match_it(self):
        for method, path, op in self.ops:
            for status, response in op["responses"].items():
                for media, body in response["content"].items():
                    examples = body.get("examples", {})
                    self.assertTrue(examples, "%s %s %s has no example" % (method, path, status))
                    for name, example in examples.items():
                        problems = validate(self.doc, example["value"], body["schema"])
                        self.assertEqual(problems, [], "%s %s %s example %s" % (method, path, status, name))

    def test_every_error_uses_the_problem_shape_and_a_listed_code(self):
        problem = self.doc["components"]["schemas"]["Problem"]
        self.assertEqual(sorted(problem["properties"]["code"]["enum"]), sorted(self.errors))
        for code, entry in self.errors.items():
            for field in ("status", "meaning", "message", "message_ko", "client"):
                self.assertIn(field, entry, code)
        for method, path, op in self.ops:
            for status, response in op["responses"].items():
                if status[0] not in "45" and status != "default":
                    media = op["x-corthex"].get("media", "application/json")
                    self.assertEqual(list(response["content"]), [media], "%s %s" % (path, status))
                    continue
                self.assertEqual(list(response["content"]), ["application/problem+json"], "%s %s" % (path, status))
                body = response["content"]["application/problem+json"]
                self.assertEqual(body["schema"], {"$ref": "#/components/schemas/Problem"})
                for name, example in body["examples"].items():
                    value = example["value"]
                    self.assertIn(value["code"], self.errors, "%s %s %s" % (path, status, name))
                    self.assertEqual(value["status"], self.errors[value["code"]]["status"], "%s %s" % (path, name))
                    if status != "default":
                        self.assertEqual(str(value["status"]), status, "%s %s %s" % (method, path, name))

    def test_the_readme_error_tables_copy_the_contract(self):
        row = re.compile(r"^\| `([a-z_]+)` \| (\d{3}) \| (.*) \|$", re.M)
        for name, field in (("README.md", "meaning"), ("README.ko.md", "message_ko")):
            with open(os.path.join(ROOT, "docs", "06-api", name), encoding="utf-8") as f:
                rows = {m.group(1): (m.group(2), m.group(3)) for m in row.finditer(f.read())}
            self.assertEqual(sorted(rows), sorted(self.errors), name)
            for code, entry in self.errors.items():
                self.assertEqual(rows[code], (str(entry["status"]), entry[field]), "%s %s" % (name, code))

    def test_every_request_field_has_limits(self):
        def walk(schema, where, seen):
            if "$ref" in schema:
                name = schema["$ref"].rsplit("/", 1)[1]
                if name in seen:
                    return
                seen = seen | {name}
            schema = resolve(self.doc, schema)
            for branch in schema.get("anyOf", []):
                walk(branch, where, seen)
            kind = schema.get("type")
            if kind == "string":
                self.assertTrue(any(k in schema for k in ("maxLength", "enum", "const")), where + " has no length limit")
            elif kind in ("integer", "number"):
                self.assertTrue("minimum" in schema and "maximum" in schema, where + " has no range")
            elif kind == "array":
                self.assertIn("maxItems", schema, where + " has no count limit")
                walk(schema["items"], where + "[]", seen)
            elif kind == "object":
                for name, prop in schema.get("properties", {}).items():
                    walk(prop, where + "." + name, seen)

        for method, path, op in self.ops:
            for param in params_of(self.doc, op):
                walk(param["schema"], "%s %s %s" % (method, path, param["name"]), set())
            if "requestBody" in op:
                walk(op["requestBody"]["content"]["application/json"]["schema"], "%s %s body" % (method, path), set())

    def test_every_operation_has_security_and_a_401(self):
        schemes = self.doc["components"]["securitySchemes"]
        for method, path, op in self.ops:
            self.assertTrue(op.get("security"), "%s %s has no security" % (method, path))
            for requirement in op["security"]:
                self.assertLessEqual(set(requirement), set(schemes))
            self.assertIn("401", op["responses"], "%s %s" % (method, path))
            family = op["x-corthex"]["family"]
            code = "access_missing" if family == "agent" else "unauthenticated"
            codes = {e["value"]["code"] for e in op["responses"]["401"]["content"]["application/problem+json"]["examples"].values()}
            self.assertEqual(codes, {code}, "%s %s" % (method, path))
            forbidden = {e["value"]["code"] for e in op["responses"]["403"]["content"]["application/problem+json"]["examples"].values()}
            self.assertIn("agent_only" if family == "agent" else "owner_only", forbidden, "%s %s" % (method, path))

    def test_every_write_carries_a_request_key(self):
        for method, path, op in self.ops:
            names = {p["name"] for p in params_of(self.doc, op)}
            if (method, path) in HUB:
                continue
            if method != "get":
                self.assertIn("Idempotency-Key", names, "%s %s" % (method, path))
                self.assertIn("409", op["responses"], "%s %s lists no request_key_reused" % (method, path))

    def test_the_pinned_hub_runs_unchanged(self):
        found = {(m, p): op for m, p, op in self.ops}
        for (method, path), (key, session) in HUB.items():
            self.assertIn((method, path), found, "the hub calls %s %s" % (method.upper(), path))
            op = found[(method, path)]
            self.assertEqual(op["x-corthex"]["family"], "agent", path)
            params = {p["name"]: p for p in params_of(self.doc, op)}
            self.assertEqual("Idempotency-Key" in params, key, "%s %s request key" % (method, path))
            if session is None:
                self.assertNotIn("Nexus-Session", params, path)
            else:
                self.assertEqual(params["Nexus-Session"]["required"], session == "required", path)
            for status, response in op["responses"].items():
                if status in ("200", "201"):
                    schema = resolve(self.doc, response["content"]["application/json"]["schema"])
                    self.assertEqual(schema["type"], "object", "the hub reads a JSON object: %s %s" % (path, status))
            self.assertNotIn("204", op["responses"], "the hub reads an empty answer as a failure: " + path)
        for (method, path), code in HUB_CODES.items():
            codes = {e["value"]["code"] for e in found[(method, path)]["responses"]["404"]["content"]
                     ["application/problem+json"]["examples"].values()}
            self.assertIn(code, codes, "the hub reads %s on %s" % (code, path))
        key = self.doc["components"]["parameters"]["IdempotencyKey"]["schema"]
        self.assertRegex('"nw_6t9w2z5c8f1j"', key["pattern"], "the hub sends the write ID in double quotes")
        todo = resolve(self.doc, {"$ref": "#/components/schemas/AgentTodo"})
        for name in ("read_at", "comments", "discrepancies", "reflections", "checkpoints"):
            self.assertIn(name, todo["required"], "the hub reads %s of the to-do" % name)
        thread = resolve(self.doc, {"$ref": "#/components/schemas/Thread"})
        self.assertLessEqual({"part", "stage"}, set(thread["required"]), "the hub reads a comment's part and stage")
        held = resolve(self.doc, {"$ref": "#/components/schemas/HeldCommit"})
        self.assertIn("default_commit", held["required"], "the hub reads the held commit")


if __name__ == "__main__":
    unittest.main()
