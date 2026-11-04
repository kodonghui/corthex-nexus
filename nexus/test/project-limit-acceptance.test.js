// TC-639: actual handler + real in-memory SQLite, never a live server/account.
// Fixed thirty-project criterion; do not import the implementation's limit.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {handle} from '../src/app.js';
import {readSnapshot02} from '../src/snapshot02.js';
import {fakeD1} from './fake-d1.js';
import {testAccess} from './access-fixture.js';
import {viewSnapshot} from './view-fixtures.js';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const quoted=name=>'"'+name.replaceAll('"','""')+'"';
function databaseState(db){
 const schema=db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name').all();
 const tables=schema.filter(row=>row.type==='table').map(row=>({
  name:row.name,
  columns:db.prepare('PRAGMA table_info('+quoted(row.name)+')').all(),
  foreignKeys:db.prepare('PRAGMA foreign_key_list('+quoted(row.name)+')').all(),
  rows:db.prepare('SELECT * FROM '+quoted(row.name)).all().map(row=>JSON.stringify(row)).sort(),
 }));
 return {schema,tables};
}
function integrity(db){
 assert.deepEqual(db.prepare('PRAGMA integrity_check').all().map(row=>row.integrity_check),['ok']);
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
}

test('TC-639: thirty API-created projects reject the31st without changing schema, rows or receipts',
 {timeout:30_000},async()=>{
 const db=new DatabaseSync(':memory:'),previousFetch=globalThis.fetch;
 const evidence={schema:'original-project-limit-acceptance/1',case:'TC-639',
  runtime:process.version,scope:'synthetic-actual-handler-in-memory-sqlite',
  projectPushesAccepted:0,setupCommentCreated:false,passed:false,
  realCredentials:false,
  networkScope:'direct handler and in-memory certificate fixture; no external-request counter'};
 try{
  const access=await testAccess(); // Synthetic RSA/JWT; only an in-memory cert fetch.
  const env={...access.env,DB:fakeD1(db),NEXUS_LANGUAGE:'en'};
  const template=readFileSync(new URL('../src/hub.html',import.meta.url),'utf8');
  const ray='0123456789abcdef-ICN';
  async function call(method,path,{body,kind='agent',headers={}}={}){
   const response=await handle(new Request('https://nexus.example.com'+path,{
    method,headers:{...access.headers(kind),'Cf-Ray':ray,
     ...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
   }),env,access.ctx,template);
   return {response,data:JSON.parse(await response.text())};
  }
  const names=Array.from({length:30},(_,index)=>'qa-r3-'+String(index+1).padStart(2,'0'));
  for(const name of names){
   const snapshot=viewSnapshot(name);
   readSnapshot02(snapshot,Date.now()); // Separate fixture-shape check, not a response claim.
   const result=await call('POST','/api/snapshots',{body:snapshot});
   assert.equal(result.response.status,200);
   evidence.projectPushesAccepted++;
   assert.equal(result.data.name,name);
   assert.equal(result.data.revision,1);
  }
  const existing=names[0];
  const comment=await call('POST','/api/spaces/'+existing+'/comments',{
   kind:'user',headers:{'Idempotency-Key':'"nw_111111111111"'},
   body:{part:'sample',stage:'05-erd',item:'TBL-001',text:'Synthetic preserved quota comment'},
  });
  assert.equal(comment.response.status,201);
  assert.match(comment.data.id,/^nc_[a-z0-9]{12}$/);
  evidence.setupCommentCreated=true;
  const listed=await call('GET','/api/snapshots');
  assert.equal(listed.response.status,200);
  assert.deepEqual(listed.data.projects.map(project=>project.name).sort(),[...names].sort());
  integrity(db);
  const before=databaseState(db);
  const receiptsBefore=db.prepare('SELECT * FROM writes').all().map(row=>JSON.stringify(row)).sort();
  assert.equal(receiptsBefore.length,1,'a nonempty API-created receipt must be protected');
  const refusedName='qa-r3-31',snapshot=viewSnapshot(refusedName);
  readSnapshot02(snapshot,Date.now());
  const logs=[],originalError=console.error;
  let refused;
  try{
   console.error=(...args)=>logs.push(args);
   refused=await call('POST','/api/snapshots',{body:snapshot});
  }finally{console.error=originalError;}
  const after=databaseState(db);
  const receiptsAfter=db.prepare('SELECT * FROM writes').all().map(row=>JSON.stringify(row)).sort();
  assert.equal(refused.response.status,409);
  assert.equal(refused.data.status,409);
  assert.equal(refused.data.code,'too_many_projects');
  assert.equal(refused.data.limit,30);
  assert.equal(refused.data.traceId,ray);
  assert.equal(refused.data.error,refused.data.detail);
  for(const field of ['title','detail','error'])assert.ok(typeof refused.data[field]==='string'&&refused.data[field].length>0);
  assert.equal(refused.response.headers.get('Content-Type').split(';')[0],'application/problem+json');
  const common={'Cache-Control':'no-store','Referrer-Policy':'no-referrer',
   'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
   'X-Robots-Tag':'noindex, nofollow','Cross-Origin-Resource-Policy':'same-origin'};
  for(const [name,value]of Object.entries(common))assert.equal(refused.response.headers.get(name),value);
  assert.equal(refused.response.headers.get('Content-Security-Policy'),"default-src 'none'; frame-ancestors 'none'");
  assert.equal(logs.length,1);
  assert.equal(logs[0][1].kind,'too_many_projects');
  assert.equal(logs[0][1].traceId,ray);
  assert.deepEqual(after,before,'the exact refusal must preserve every schema object/table/column/FK/row');
  assert.deepEqual(receiptsAfter,receiptsBefore,'the same refusal preserves every nonempty write receipt');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM snapshots').get().n,30);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM snapshots WHERE name=?').get(refusedName).n,0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM project_spaces WHERE project=?').get(refusedName).n,0);
  integrity(db);
  const listedAfter=await call('GET','/api/snapshots');
  assert.equal(listedAfter.response.status,200);
  assert.deepEqual(listedAfter.data.projects.map(project=>project.name).sort(),[...names].sort());
  const missing=await call('GET','/api/snapshots/'+refusedName);
  assert.equal(missing.response.status,404);
  assert.equal(missing.data.code,'project_not_found');
  assert.deepEqual(databaseState(db),after,'the confirming reads must preserve the refusal state too');
  Object.assign(evidence,{passed:true,refusalStatus:409,refusalCode:'too_many_projects',
   tablesProtected:before.tables.length,schemaObjectsProtected:before.schema.length,
   databaseBeforeSha256:hash(before),databaseAfterSha256:hash(after),
   receiptsBefore:receiptsBefore.length,receiptsAfter:receiptsAfter.length,
   receiptBeforeSha256:hash(receiptsBefore),receiptAfterSha256:hash(receiptsAfter),
   projectsBefore:30,projectsAfter:30,refusedSnapshotAbsent:true,refusedSpaceAbsent:true,
   integrityVerified:true,commonHeadersVerified:true,traceAndLogVerified:true,
   contractResponses:[{schema:'Problem',value:refused.data}],
  });
 }finally{
  db.close();globalThis.fetch=previousFetch;
  evidence.databaseClosed=true;
  if(process.env.NEXUS_R3_EVIDENCE_FILE)writeFileSync(process.env.NEXUS_R3_EVIDENCE_FILE,
   JSON.stringify(evidence,null,2)+'\n',{encoding:'utf8',flag:'wx'});
 }
});
