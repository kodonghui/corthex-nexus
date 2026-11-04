"""Explicit public dependency setup. No account credentials are read or copied."""
import argparse,os,subprocess
from pathlib import Path
from hub_ref import ROOT,git_program,reference,locate_hub
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--destination',required=True,type=Path);args=parser.parse_args()
 target=args.destination.resolve();value=reference();git=git_program()
 if target==ROOT or ROOT in target.parents:raise SystemExit('Prepare the dependency outside the product checkout')
 if target.exists():
  os.environ['CORTHEX_HUB_CHECKOUT']=str(target);locate_hub();print('Existing exact hub reference verified');return
 target.parent.mkdir(parents=True,exist_ok=True)
 subprocess.run([git,'clone','--filter=blob:none','--no-checkout',value['repository'],str(target)],check=True)
 subprocess.run([git,'-C',str(target),'checkout','--detach',value['commit']],check=True)
 os.environ['CORTHEX_HUB_CHECKOUT']=str(target);locate_hub();print('Exact public hub reference prepared')
if __name__=='__main__':main()
