"""Validate offline handler JSON/bootstrap against OpenAPI, in external QA.

Requires the pinned contract-tool environment (PyYAML/jsonschema), never the
plugin's standard-library runtime. Node 22.13 or later supplies its own SQLite.
"""
import json
import os
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
for case in cases:
    validator = jsonschema.Draft202012Validator(api["components"]["schemas"][case["schema"]],
        resolver=jsonschema.RefResolver.from_schema(api), format_checker=jsonschema.Draft202012Validator.FORMAT_CHECKER)
    errors = list(validator.iter_errors(case["value"]))
    if errors:
        print(json.dumps({"case":case["name"],"schema":case["schema"],
            "errors":[{"path":list(error.absolute_path),"rule":error.validator} for error in errors[:10]]}))
        raise SystemExit(1)
print("offline response contracts: " + str(fitted["namedJsonExamples"]) + " named JSON examples fit their schemas; "
      "normal/empty bootstraps, constructor overview, four stage answers, four talk answers and 501-proposal history passed")
