// Review draft: place at nexus/test/api-response-success.test.js. No external packages or real accounts.
// Synthetic read-only audit of repository code. Only in-memory SQLite is changed.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { handle } from '../src/app.js';
import { fakeD1 } from './fake-d1.js';
import { testAccess } from './access-fixture.js';
import {test} from 'node:test';

test("all contracted operations preserve their successful HTTP and SQLite behavior",async()=>{
const access=await testAccess(),db=new DatabaseSync(':memory:'),env={...access.env,DB:fakeD1(db),NEXUS_LANGUAGE:'en'};
const base=new URL('../../',import.meta.url);
const template=readFileSync(new URL('nexus/src/hub.html',base),'utf8');
const snapshot=JSON.parse(readFileSync(new URL('nexus/test/snapshot-02-example.json',base),'utf8'));
const metadata=JSON.parse(readFileSync(new URL('nexus/src/view-code/sizes.json',base),'utf8'));
const code=Object.fromEntries(metadata.files.map(f=>[f.name,{type:f.type,body:readFileSync(new URL('nexus/src/view-code/'+f.path,base))}]));
let serial=0;
const records=[];
const expectedOperations=[{"api_id":"API-155","operation_id":"getHomePage","method":"GET","path":"/"},{"api_id":"API-101","operation_id":"getHubPage","method":"GET","path":"/hub"},{"api_id":"API-102","operation_id":"getPictureViewPage","method":"GET","path":"/pictures/{project}/{part}/{stage}"},{"api_id":"API-103","operation_id":"getStageOverviewPage","method":"GET","path":"/overview/{project}/{part}/{stage}"},{"api_id":"API-104","operation_id":"getViewCode","method":"GET","path":"/code/{file}"},{"api_id":"API-105","operation_id":"pushSnapshot","method":"POST","path":"/api/snapshots"},{"api_id":"API-106","operation_id":"listSnapshots","method":"GET","path":"/api/snapshots"},{"api_id":"API-107","operation_id":"getSnapshot","method":"GET","path":"/api/snapshots/{project}"},{"api_id":"API-108","operation_id":"removeProject","method":"DELETE","path":"/api/snapshots/{project}"},{"api_id":"API-109","operation_id":"getHeldCommit","method":"GET","path":"/api/snapshots/{project}/held"},{"api_id":"API-110","operation_id":"getRemovalDryRun","method":"GET","path":"/api/snapshots/{project}/removal"},{"api_id":"API-111","operation_id":"getPicture","method":"GET","path":"/api/spaces/{project}/pictures/{part}/{stage}"},{"api_id":"API-112","operation_id":"getStageOverview","method":"GET","path":"/api/spaces/{project}/overview/{part}/{stage}"},{"api_id":"API-113","operation_id":"getAgentTodo","method":"GET","path":"/api/spaces/{project}/todo"},{"api_id":"API-158","operation_id":"getStage","method":"GET","path":"/api/spaces/{project}/stages/{part}/{stage}"},{"api_id":"API-152","operation_id":"getStageTalk","method":"GET","path":"/api/spaces/{project}/talk/{part}/{stage}"},{"api_id":"API-157","operation_id":"getItem","method":"GET","path":"/api/spaces/{project}/items/{id}"},{"api_id":"API-151","operation_id":"getHome","method":"GET","path":"/api/home"},{"api_id":"API-153","operation_id":"getProjectPage","method":"GET","path":"/p/{project}"},{"api_id":"API-154","operation_id":"getStagePage","method":"GET","path":"/p/{project}/{part}/{stage}"},{"api_id":"API-156","operation_id":"searchItems","method":"GET","path":"/api/search"},{"api_id":"API-118","operation_id":"leaveComment","method":"POST","path":"/api/spaces/{project}/comments"},{"api_id":"API-114","operation_id":"getComment","method":"GET","path":"/api/spaces/{project}/comments/{comment}"},{"api_id":"API-119","operation_id":"replyToComment","method":"POST","path":"/api/spaces/{project}/comments/{comment}/replies"},{"api_id":"API-120","operation_id":"markAnswered","method":"POST","path":"/api/spaces/{project}/comments/{comment}/answered"},{"api_id":"API-121","operation_id":"recordDecision","method":"POST","path":"/api/spaces/{project}/comments/{comment}/decisions"},{"api_id":"API-159","operation_id":"takeRecommendation","method":"POST","path":"/api/spaces/{project}/comments/{comment}/recommended"},{"api_id":"API-122","operation_id":"makeProposal","method":"POST","path":"/api/spaces/{project}/proposals"},{"api_id":"API-115","operation_id":"getProposal","method":"GET","path":"/api/spaces/{project}/proposals/{proposal}"},{"api_id":"API-123","operation_id":"withdrawProposal","method":"POST","path":"/api/spaces/{project}/proposals/{proposal}/withdraw"},{"api_id":"API-124","operation_id":"acceptProposal","method":"POST","path":"/api/spaces/{project}/proposals/{proposal}/accept"},{"api_id":"API-125","operation_id":"dismissProposal","method":"POST","path":"/api/spaces/{project}/proposals/{proposal}/dismiss"},{"api_id":"API-116","operation_id":"getEdit","method":"GET","path":"/api/spaces/{project}/edits/{edit}"},{"api_id":"API-126","operation_id":"reportEdit","method":"POST","path":"/api/spaces/{project}/edits/{edit}/report"},{"api_id":"API-127","operation_id":"dismissEdit","method":"POST","path":"/api/spaces/{project}/edits/{edit}/dismiss"},{"api_id":"API-128","operation_id":"passCheckpoint","method":"POST","path":"/api/spaces/{project}/checkpoints"},{"api_id":"API-117","operation_id":"getCheckpoint","method":"GET","path":"/api/spaces/{project}/checkpoints/{checkpoint}"},{"api_id":"API-129","operation_id":"withdrawCheckpoint","method":"POST","path":"/api/spaces/{project}/checkpoints/{checkpoint}/withdraw"},{"api_id":"API-130","operation_id":"reportCheckpoint","method":"POST","path":"/api/spaces/{project}/checkpoints/{checkpoint}/report"},{"api_id":"API-131","operation_id":"claimEntry","method":"POST","path":"/api/spaces/{project}/claims/{entry}"},{"api_id":"API-132","operation_id":"releaseEntry","method":"DELETE","path":"/api/spaces/{project}/claims/{entry}"}];
const exercised=new Set();
function databaseShape(){
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
 const values=tables.map(name=>[name,db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().map(row=>JSON.stringify(row)).sort()]);
 return {hash:createHash('sha256').update(JSON.stringify(values)).digest('hex'),counts:Object.fromEntries(values.map(([name,rows])=>[name,rows.length]))};
}
async function call(label,method,path,{body,kind='user',status=200,expectedCode,headers={}}={}){
 const matching=expectedOperations.find(op=>op.method===method && new RegExp('^'+op.path.replace(/\{\w+\}/g,'[^/?]+')+'(?:\\?.*)?$').test(path));
 assert.ok(matching,label+' is in the frozen contract');exercised.add(matching.operation_id);
 const before=databaseShape();
 const requestHeaders={...access.headers(kind),...(method==='POST'?{'Idempotency-Key':'"nw_'+(++serial).toString().padStart(12,'0')+'"'}:{}),...(kind==='agent'?{'Nexus-Session':'qa-audit-agent'}:{}),...headers};
 if(body!==undefined)requestHeaders['Content-Type']='application/json';
 const response=await handle(new Request('https://nexus.example.com'+path,{method,headers:requestHeaders,...(body===undefined?{}:{body:JSON.stringify(body)})}),env,access.ctx,template,{code});
 const codeBytes=path.startsWith('/code/')?Buffer.from(await response.clone().arrayBuffer()):null;
 const media=(response.headers.get('Content-Type')||'').split(';')[0],text=await response.text();
 const data=media.includes('json')&&text?JSON.parse(text):null;
 const after=databaseShape();
 const row={label,method,path,status:response.status,expected_status:status,media,code:data?.code||null,database_unchanged:before.hash===after.hash,before_counts:before.counts,after_counts:after.counts};
 if(codeBytes){
  const file=metadata.files.find(file=>path==='/code/'+file.name);
  assert.ok(file,label+' uses a known content-hashed asset');
  const policy=response.headers.get('Cache-Control')||'';
  row.codePolicy={setCookiePresent:response.headers.has('Set-Cookie'),varyStar:(response.headers.get('Vary')||'').split(',').some(value=>value.trim()==='*'),public:/(?:^|,)\s*public\s*(?:,|$)/i.test(policy),immutable:/(?:^|,)\s*immutable\s*(?:,|$)/i.test(policy),maxAgeSeconds:/(?:^|,)\s*max-age=31536000\s*(?:,|$)/i.test(policy)?31536000:null,forbiddenCacheDirective:/(?:^|,)\s*(?:private|no-store|no-cache)(?:\s*=|\s*(?:,|$))/i.test(policy),bytes:codeBytes.length,payloadSha256:createHash('sha256').update(codeBytes).digest('hex')};
  assert.equal(row.codePolicy.setCookiePresent,false,label+' code omits Set-Cookie (TC-770/771/772)');
  assert.equal(row.codePolicy.varyStar,false,label+' code omits Vary star');
  assert.equal(row.codePolicy.public,true,label+' code uses the approved shared cache');
  assert.equal(row.codePolicy.immutable,true,label+' content hash remains immutable');
  assert.equal(row.codePolicy.maxAgeSeconds,31536000,label+' code keeps its one-year lifetime');
  assert.equal(row.codePolicy.forbiddenCacheDirective,false,label+' code has no conflicting private/no-store/no-cache');
  assert.equal(codeBytes.length,file.raw,label+' bytes match approved metadata');
  assert.equal(row.codePolicy.payloadSha256,file.payloadSha256,label+' payload matches approved metadata');
 }
 records.push(row);
 assert.equal(response.status,status,label);
 if(expectedCode)assert.equal(data?.code,expectedCode,label);
 if(method==='GET'||method==='HEAD'||response.status>=400)assert.equal(after.hash,before.hash,label+' must preserve data');
 return data;
}
try {
 await call('push snapshot','POST','/api/snapshots',{body:snapshot,kind:'agent'});
 for(const path of ['/','/hub','/p/corthex/nexus/05-erd','/pictures/corthex/nexus/05-erd','/overview/corthex/nexus/05-erd','/api/snapshots','/api/snapshots/corthex','/api/snapshots/corthex/held','/api/snapshots/corthex/removal','/api/spaces/corthex/pictures/nexus/05-erd','/api/spaces/corthex/overview/nexus/05-erd','/api/spaces/corthex/todo','/api/spaces/corthex/stages/nexus/05-erd','/api/spaces/corthex/talk/nexus/05-erd?closed=1','/api/spaces/corthex/items/TBL-111?part=nexus','/api/home','/api/search?q=claims'])await call('read '+path,'GET',path);
 await call('read /p/corthex','GET','/p/corthex',{status:302});
 for(const type of ['javascript','text/css','font/woff2']){
   const file=metadata.files.find(f=>f.type.includes(type));assert.ok(file,type);
   await call('bundled '+type,'GET','/code/'+file.name);
   assert.equal(records.at(-1).media,type==='javascript'?'text/javascript':type,'bundled asset media matches the frozen API contract');
 }
 const space='/api/spaces/corthex';
 const commentBody={part:'nexus',stage:'05-erd',item:'TBL-111',text:'Synthetic audit question'};
 const comment=await call('leave comment','POST',space+'/comments',{body:commentBody,status:201});
 await call('settle comment','POST',space+'/comments/'+comment.id+'/replies',{body:{text:'Synthetic audit answer',settles:true},status:201});
 const settled=await call('get settled comment','GET',space+'/comments/'+comment.id);assert.equal(settled.settled,true);
 await call('mark answered','POST',space+'/comments/'+comment.id+'/answered',{kind:'agent'});
 const same=await call('mark already answered','POST',space+'/comments/'+comment.id+'/answered',{kind:'agent'});assert.equal(same.changed,false);
 const opened=await call('user reopens comment','POST',space+'/comments/'+comment.id+'/replies',{body:{text:'Synthetic reopening',settles:false},status:201});assert.equal(opened.comment.state,'open');
 await call('record decision','POST',space+'/comments/'+comment.id+'/decisions',{body:{link:'https://example.com/decision'},kind:'agent',status:201});
 const proposalBody={part:'nexus',stage:'05-erd',items:['TBL-111'],reason:'Synthetic audit',change:'Synthetic audit change'};
 const proposal=await call('make proposal for withdrawal','POST',space+'/proposals',{body:proposalBody,kind:'agent',status:201});
 await call('get open proposal','GET',space+'/proposals/'+proposal.id);
 await call('withdraw proposal','POST',space+'/proposals/'+proposal.id+'/withdraw',{kind:'agent'});
 const withdrawn=await call('already withdrawn proposal','POST',space+'/proposals/'+proposal.id+'/withdraw',{kind:'agent'});assert.equal(withdrawn.changed,false);
 const rejected=await call('make proposal for dismissal','POST',space+'/proposals',{body:proposalBody,kind:'agent',status:201});
 await call('dismiss proposal','POST',space+'/proposals/'+rejected.id+'/dismiss');
 const accepted=await call('make proposal for reflection','POST',space+'/proposals',{body:proposalBody,kind:'agent',status:201});
 const acceptance=await call('accept proposal without session','POST',space+'/proposals/'+accepted.id+'/accept');
 const edit=acceptance.edit;
 await call('report edit opened','POST',space+'/edits/'+edit.id+'/report',{kind:'agent',body:{event:'opened',pull_request:'https://example.com/repo/pull/1'}});
 const reviewing=await call('get edit in review','GET',space+'/edits/'+edit.id);assert.equal(reviewing.state,'in-review');
 await call('report edit closed','POST',space+'/edits/'+edit.id+'/report',{kind:'agent',body:{event:'closed',pull_request:'https://example.com/repo/pull/1'}});
 await call('pending edit cannot be dismissed','POST',space+'/edits/'+edit.id+'/dismiss',{status:409,expectedCode:'edit_state'});
 await call('report edit needs user','POST',space+'/edits/'+edit.id+'/report',{kind:'agent',body:{event:'needs-user'}});
 await call('dismiss edit','POST',space+'/edits/'+edit.id+'/dismiss');
 const dismissed=await call('already dismissed edit','POST',space+'/edits/'+edit.id+'/dismiss');assert.equal(dismissed.changed,false);
 const checkpoint=await call('pass checkpoint','POST',space+'/checkpoints',{body:{part:'nexus',stage:'05-erd'},status:201});
 await call('get passed checkpoint','GET',space+'/checkpoints/'+checkpoint.id);
 await call('report checkpoint opened','POST',space+'/checkpoints/'+checkpoint.id+'/report',{kind:'agent',body:{event:'opened',pull_request:'https://example.com/repo/pull/2'}});
 await call('report checkpoint closed','POST',space+'/checkpoints/'+checkpoint.id+'/report',{kind:'agent',body:{event:'closed',pull_request:'https://example.com/repo/pull/2'}});
 await call('withdraw checkpoint','POST',space+'/checkpoints/'+checkpoint.id+'/withdraw');
 const again=await call('already withdrawn checkpoint','POST',space+'/checkpoints/'+checkpoint.id+'/withdraw');assert.equal(again.changed,false);
 const asking=await call('agent comment asking for the checkpoint','POST',space+'/comments',{body:{part:'nexus',stage:'05-erd',item:'',text:'Synthetic checkpoint as recommended?',asks:'checkpoint'},kind:'agent',status:201});
 const taken=await call('take recommendation','POST',space+'/comments/'+asking.id+'/recommended');assert.equal(taken.checkpoint.comment,asking.id);
 const retaken=await call('recommendation already taken','POST',space+'/comments/'+asking.id+'/recommended');assert.equal(retaken.changed,false);
 const claimedComment=await call('comment for claim','POST',space+'/comments',{body:commentBody,status:201});
 await call('claim comment','POST',space+'/claims/'+claimedComment.id,{kind:'agent'});
 await call('release claim','DELETE',space+'/claims/'+claimedComment.id,{kind:'agent'});
 const absent=await call('release absent claim','DELETE',space+'/claims/'+claimedComment.id,{kind:'agent'});assert.equal(absent.released,false);
 await call('remove project','DELETE','/api/snapshots/corthex');
 assert.equal(databaseShape().counts.comments,0);assert.equal(databaseShape().counts.proposals,0);assert.equal(databaseShape().counts.edits,0);assert.equal(databaseShape().counts.checkpoints,0);
} finally {
 if(process.env.NEXUS_SUCCESS_RESULTS)writeFileSync(process.env.NEXUS_SUCCESS_RESULTS,JSON.stringify({requests:records},null,2)+'\n');
 db.close();
}
assert.equal(records.length,58);
assert.equal(exercised.size,41);
assert.equal(records.filter(row=>row.method==='GET').length,25);

});
