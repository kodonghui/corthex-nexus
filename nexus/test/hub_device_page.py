"""TC-1766 (TASK-281): the file that the hub builds on a device, built by the pinned hub from a synthetic snapshot.

Reads one snapshot as JSON on standard input and writes the hub page where --out says, with the pinned hub's own
page_data and render_page. The profile that sets the page's language lives in a temporary folder that is removed
afterwards. Synthetic data only; nothing is fetched or sent."""
import argparse
import importlib.util
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools"))
from hub_ref import locate_hub  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--language", choices=("en", "ko"), required=True)
    parser.add_argument("--now", required=True, help="the time the page says it was built")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    script = locate_hub() / "plugins/corthex-nexus/skills/corthex-hub/scripts/hub.py"
    spec = importlib.util.spec_from_file_location("corthex_hub_pinned", script)
    hub = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(hub)
    snapshot = json.loads(sys.stdin.buffer.read().decode("utf8"))
    with tempfile.TemporaryDirectory() as folder:
        home = Path(folder)
        (home / ".corthex").mkdir()
        (home / ".corthex" / "profile.json").write_text(json.dumps({"language": args.language}), encoding="utf8")
        page = hub.render_page(hub.page_data(home, [snapshot], [], args.now))
    Path(args.out).write_text(page, encoding="utf8")


if __name__ == "__main__":
    main()
