"""Apply the public content rules to every unique reachable text blob."""
import importlib.util,io,json,subprocess,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('public_content_rules',ROOT/'tests/test_public_safety.py')
rules=importlib.util.module_from_spec(spec);spec.loader.exec_module(rules)
refs=sys.argv[1:] or ['HEAD']
objects={}
for line in subprocess.check_output(['git','rev-list','--objects',*refs],cwd=ROOT).decode().splitlines():
 oid,_,path=line.partition(' ')
 if path and path!='tests/test_public_safety.py':objects[oid]=path
batch=subprocess.run(['git','cat-file','--batch'],cwd=ROOT,input=('\n'.join(objects)+'\n').encode(),stdout=subprocess.PIPE,check=True).stdout
stream=io.BytesIO(batch);findings=[];text_blobs=0
for expected,path in objects.items():
 oid,kind,size=stream.readline().decode().split();assert oid==expected
 data=stream.read(int(size));assert stream.read(1)==b'\n'
 if kind!='blob':continue
 try:text=data.decode('utf8')
 except UnicodeDecodeError:continue
 text_blobs+=1
 for label,pattern in rules.PATTERNS.items():
  if pattern.search(rules.checked_text(path,text,label)):findings.append({'file':path,'blob':oid,'rule':label,'value':'withheld'})
print(json.dumps({'text_blob_versions':text_blobs,'findings':findings}))
sys.exit(1 if findings else 0)
