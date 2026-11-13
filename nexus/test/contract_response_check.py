"""Validate offline handler JSON/bootstrap against OpenAPI, in external QA.

Requires the pinned contract-tool environment (PyYAML/jsonschema), never the
plugin's standard-library runtime. Node 22.13 or later supplies its own SQLite.
"""
import json
import os
import re
import subprocess
from pathlib import Path

import jsonschema
import yaml

from contract_example_check import check_named_examples_fit_schemas, check_response_example_applicability

root = Path(__file__).resolve().parents[2]
program = None
for folder in os.environ.get("PATH", "").split(os.pathsep):
    folder = folder.strip('"')
    if not os.path.isabs(folder) or Path(folder).resolve() == Path.cwd().resolve():
        continue
    candidate = Path(folder) / ("node.exe" if os.name == "nt" else "node")
    if candidate.is_file() and os.access(candidate, os.X_OK):
        program = str(candidate)
        break
if program is None:
    raise SystemExit("Node 22.13 or later must be installed on an absolute PATH entry")
run = subprocess.run([program, str(Path(__file__).with_name("response-corpus.mjs"))],
                     cwd=str(root), capture_output=True, timeout=90)
if run.returncode:
    raise SystemExit("the offline actual-handler corpus failed; inspect its synthetic fixture locally")
cases = json.loads(run.stdout.decode("utf8"))
api = yaml.safe_load((root / "docs/06-api/nexus.openapi.yaml").read_text(encoding="utf8"))
applicability = check_response_example_applicability(api)
if applicability["findings"]:
    print(json.dumps(applicability))
    raise SystemExit("named response examples do not fit the operation's inputs")
fitted = check_named_examples_fit_schemas(api)
if fitted["findings"]:
    print(json.dumps(fitted["findings"][:10]))
    raise SystemExit("named response examples do not match their schemas")
# Who may send each operation: the kinds of sign-in that the server's preflight takes are those of the operation's
# security, a person's own sign-in (accessUser), the service token (accessClientId with accessClientSecret) or either,
# which is the contract's default. Since TASK-311 a removal takes only the first, as the export does since TASK-310.
schemes = {("user",): [{"accessUser": []}], ("agent",): [{"accessClientId": [], "accessClientSecret": []}],
           ("user", "agent"): api["security"]}
run = subprocess.run([program, str(Path(__file__).with_name("kinds-corpus.mjs"))], cwd=str(root), capture_output=True, timeout=90)
if run.returncode:
    raise SystemExit("the server's kinds of sign-in could not be read; run kinds-corpus.mjs locally")
kinds = json.loads(run.stdout.decode("utf8"))
template = lambda path: re.sub(r"\{\w+\}", "{}", path)
contracted = {operation["operationId"]: (method, path, operation.get("security", api["security"]))
              for path, item in api["paths"].items() for method, operation in item.items()
              if method in ("get", "post", "delete", "put", "patch")}
if set(contracted) != set(kinds):
    raise SystemExit("the server's operations and the contract's differ: " + ", ".join(sorted(set(contracted) ^ set(kinds))))
for name, (method, path, security) in sorted(contracted.items()):
    taken = kinds[name]
    if (taken["method"], template(taken["path"])) != (method, template(path)) or schemes.get(tuple(taken["kinds"])) != security:
        raise SystemExit(f"{name}: the server takes {taken['kinds']} at {taken['method']} {taken['path']}, "
                         f"where the contract's security is {security} at {method} {path}")
for case in cases:
    validator = jsonschema.Draft202012Validator(api["components"]["schemas"][case["schema"]],
        resolver=jsonschema.RefResolver.from_schema(api), format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER)
    errors = list(validator.iter_errors(case["value"]))
    if errors:
        print(json.dumps({"case":case["name"],"schema":case["schema"],
            "errors":[{"path":list(error.absolute_path),"rule":error.validator} for error in errors[:10]]}))
        raise SystemExit(1)
print("offline response contracts: " + str(fitted["namedJsonExamples"]) + " named JSON examples fit their schemas; "
      "constructor overview, seven stage answers, five talk answers, two item answers, "
      "three search answers, three first page answers, two first pages, four stage pages, two answers to API-159, "
      "which passes no checkpoint, the agent to-do read by the agent and by the user, "
      "the user's comment, two checkpoint requests, the user's reply and a reply that asks again, "
      "a pass that answers a request with its kind of browser and device, the request that it settled and its "
      "withdrawal, a pass that names a snapshot's revision, three refusals of a pass that name what changed, "
      "a checkpoint request refused as not_recommended, a project's data and its export with a space and without one, "
      "and 501-proposal history passed; the kinds of sign-in that the server takes for each of " + str(len(kinds)) +
      " operations are those of its security")
