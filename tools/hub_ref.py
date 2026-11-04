"""Locate and verify the immutable public hub reference; never fetch in tests."""
import json,os,re,shutil,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def reference():
 value=json.loads((ROOT/'hub-ref.json').read_text(encoding='utf8'))
 if value.get('repository')!='https://github.com/kodonghui/corthex' or not re.fullmatch('[0-9a-f]{40}',value.get('commit','')):
  raise RuntimeError('hub-ref.json must name the public upstream and an exact commit')
 return value
def git_program():
 found=shutil.which('git')
 if not found or not Path(found).is_absolute() or Path(found).resolve().parent==Path.cwd().resolve():
  raise RuntimeError('Git must be installed in an absolute PATH folder')
 return found
def locate_hub():
 value=reference();raw=os.environ.get('CORTHEX_HUB_CHECKOUT')
 if not raw:raise RuntimeError('Set CORTHEX_HUB_CHECKOUT to a separately prepared checkout of hub-ref.json')
 path=Path(raw).resolve()
 result=subprocess.run([git_program(),'-C',str(path),'rev-parse','HEAD'],capture_output=True,text=True,timeout=15)
 if result.returncode or result.stdout.strip()!=value['commit']:raise RuntimeError('The hub checkout does not match hub-ref.json')
 clean=subprocess.run([git_program(),'-C',str(path),'status','--porcelain','--untracked-files=no'],capture_output=True,text=True,timeout=15)
 if clean.returncode or clean.stdout.strip():raise RuntimeError('The pinned hub checkout has tracked changes')
 for relative in ('tests/test_hub.py','tests/test_hub02.py','tests/_common.py','plugins/corthex-nexus/skills/corthex-hub/assets/hub.html'):
  if not (path/relative).is_file():raise RuntimeError('The pinned hub checkout is incomplete')
 return path
