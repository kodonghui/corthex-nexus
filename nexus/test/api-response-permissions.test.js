// Review draft: place at nexus/test/api-response-permissions.test.js. No external packages or real accounts.
// Synthetic actual-handler permission matrix. No real Access edge or account.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {handle} from '../src/app.js';
import {fakeD1} from './fake-d1.js';
import {testAccess} from './access-fixture.js';
import {test} from 'node:test';

test("all contracted operations refuse unauthorized requests without changing SQLite",async()=>{
const access=await testAccess(),db=new DatabaseSync(':memory:'),env={...access.env,DB:fakeD1(db),NEXUS_LANGUAGE:'en'};
const base=new URL('../../',import.meta.url),template=readFileSync(new URL('nexus/src/hub.html',base),'utf8');
const snapshot=JSON.parse(readFileSync(new URL('nexus/test/snapshot-02-example.json',base),'utf8'));
const operations=[{"api_id":"API-155","operation_id":"getHomePage","method":"GET","path":"/"},{"api_id":"API-101","operation_id":"getHubPage","method":"GET","path":"/hub"},{"api_id":"API-102","operation_id":"getPictureViewPage","method":"GET","path":"/pictures/{project}/{part}/{stage}"},{"api_id":"API-103","operation_id":"getStageOverviewPage","method":"GET","path":"/overview/{project}/{part}/{stage}"},{"api_id":"API-104","operation_id":"getViewCode","method":"GET","path":"/code/{file}"},{"api_id":"API-105","operation_id":"pushSnapshot","method":"POST","path":"/api/snapshots"},{"api_id":"API-106","operation_id":"listSnapshots","method":"GET","path":"/api/snapshots"},{"api_id":"API-107","operation_id":"getSnapshot","method":"GET","path":"/api/snapshots/{project}"},{"api_id":"API-108","operation_id":"removeProject","method":"DELETE","path":"/api/snapshots/{project}"},{"api_id":"API-109","operation_id":"getHeldCommit","method":"GET","path":"/api/snapshots/{project}/held"},{"api_id":"API-110","operation_id":"getRemovalDryRun","method":"GET","path":"/api/snapshots/{project}/removal"},{"api_id":"API-111","operation_id":"getPicture","method":"GET","path":"/api/spaces/{project}/pictures/{part}/{stage}"},{"api_id":"API-112","operation_id":"getStageOverview","method":"GET","path":"/api/spaces/{project}/overview/{part}/{stage}"},{"api_id":"API-113","operation_id":"getAgentTodo","method":"GET","path":"/api/spaces/{project}/todo"},{"api_id":"API-177","operation_id":"getProjectData","method":"GET","path":"/api/spaces/{project}/data"},{"api_id":"API-178","operation_id":"exportProject","method":"GET","path":"/api/spaces/{project}/export"},{"api_id":"API-158","operation_id":"getStage","method":"GET","path":"/api/spaces/{project}/stages/{part}/{stage}"},{"api_id":"API-152","operation_id":"getStageTalk","method":"GET","path":"/api/spaces/{project}/talk/{part}/{stage}"},{"api_id":"API-157","operation_id":"getItem","method":"GET","path":"/api/spaces/{project}/items/{id}"},{"api_id":"API-151","operation_id":"getHome","method":"GET","path":"/api/home"},{"api_id":"API-153","operation_id":"getProjectPage","method":"GET","path":"/p/{project}"},{"api_id":"API-154","operation_id":"getStagePage","method":"GET","path":"/p/{project}/{part}/{stage}"},{"api_id":"API-156","operation_id":"searchItems","method":"GET","path":"/api/search"},{"api_id":"API-118","operation_id":"leaveComment","method":"POST","path":"/api/spaces/{project}/comments"},{"api_id":"API-114","operation_id":"getComment","method":"GET","path":"/api/spaces/{project}/comments/{comment}"},{"api_id":"API-119","operation_id":"replyToComment","method":"POST","path":"/api/spaces/{project}/comments/{comment}/replies"},{"api_id":"API-120","operation_id":"markAnswered","method":"POST","path":"/api/spaces/{project}/comments/{comment}/answered"},{"api_id":"API-121","operation_id":"recordDecision","method":"POST","path":"/api/spaces/{project}/comments/{comment}/decisions"},{"api_id":"API-159","operation_id":"takeRecommendation","method":"POST","path":"/api/spaces/{project}/comments/{comment}/recommended"},{"api_id":"API-122","operation_id":"makeProposal","method":"POST","path":"/api/spaces/{project}/proposals"},{"api_id":"API-115","operation_id":"getProposal","method":"GET","path":"/api/spaces/{project}/proposals/{proposal}"},{"api_id":"API-123","operation_id":"withdrawProposal","method":"POST","path":"/api/spaces/{project}/proposals/{proposal}/withdraw"},{"api_id":"API-124","operation_id":"acceptProposal","method":"POST","path":"/api/spaces/{project}/proposals/{proposal}/accept"},{"api_id":"API-125","operation_id":"dismissProposal","method":"POST","path":"/api/spaces/{project}/proposals/{proposal}/dismiss"},{"api_id":"API-116","operation_id":"getEdit","method":"GET","path":"/api/spaces/{project}/edits/{edit}"},{"api_id":"API-126","operation_id":"reportEdit","method":"POST","path":"/api/spaces/{project}/edits/{edit}/report"},{"api_id":"API-127","operation_id":"dismissEdit","method":"POST","path":"/api/spaces/{project}/edits/{edit}/dismiss"},{"api_id":"API-128","operation_id":"passCheckpoint","method":"POST","path":"/api/spaces/{project}/checkpoints"},{"api_id":"API-117","operation_id":"getCheckpoint","method":"GET","path":"/api/spaces/{project}/checkpoints/{checkpoint}"},{"api_id":"API-129","operation_id":"withdrawCheckpoint","method":"POST","path":"/api/spaces/{project}/checkpoints/{checkpoint}/withdraw"},{"api_id":"API-130","operation_id":"reportCheckpoint","method":"POST","path":"/api/spaces/{project}/checkpoints/{checkpoint}/report"},{"api_id":"API-131","operation_id":"claimEntry","method":"POST","path":"/api/spaces/{project}/claims/{entry}"},{"api_id":"API-132","operation_id":"releaseEntry","method":"DELETE","path":"/api/spaces/{project}/claims/{entry}"}];
const roles={leaveComment:'either',replyToComment:'either',markAnswered:'either',recordDecision:'agent',takeRecommendation:'user',makeProposal:'agent',withdrawProposal:'agent',acceptProposal:'user',dismissProposal:'user',reportEdit:'agent',dismissEdit:'user',passCheckpoint:'user',withdrawCheckpoint:'user',reportCheckpoint:'agent',claimEntry:'agent',releaseEntry:'agent'};
const writes=new Set(['leaveComment','replyToComment','markAnswered','recordDecision','takeRecommendation','makeProposal','withdrawProposal','acceptProposal','dismissProposal','reportEdit','dismissEdit','passCheckpoint','withdrawCheckpoint','reportCheckpoint']);
const values={project:'corthex',part:'nexus',stage:'05-erd',id:'TBL-111',file:'view.deadbeef.js',comment:'nc_aaaaaaaaaaaa',proposal:'np_bbbbbbbbbbbb',edit:'ne_cccccccccccc',checkpoint:'nk_dddddddddddd',entry:'nc_aaaaaaaaaaaa'};
const common={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow','Cross-Origin-Resource-Policy':'same-origin'};
const records=[];let serial=0;
function shape(){
 const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
 return createHash('sha256').update(JSON.stringify(tables.map(name=>[name,db.prepare('SELECT * FROM "'+name+'"').all().map(row=>JSON.stringify(row)).sort()]))).digest('hex');
}
const originalError=console.error;
try {
 const response=await handle(new Request('https://nexus.example.com/api/snapshots',{method:'POST',headers:{...access.headers('agent'),'Content-Type':'application/json'},body:JSON.stringify(snapshot)}),env,access.ctx,template);assert.equal(response.status,200);
 for(const op of operations){
  const path=op.path.replace(/\{(\w+)\}/g,(_,name)=>values[name]);
  const role=roles[op.operation_id],kind=role==='user'?'user':'agent';
  async function refused(label,code,{ctx=access.ctx,identity=kind,headers={},media='application/problem+json',field,query=''}={}){
   const before=shape(),logs=[];console.error=(...args)=>logs.push(args);
   const h={...access.headers(identity),'Nexus-Session':'qa-audit-agent','Idempotency-Key':'"nw_'+(++serial).toString().padStart(12,'0')+'"','Accept':media,'Cf-Ray':'0123456789abcdef-ICN',...headers};
   const result=await handle(new Request('https://nexus.example.com'+path+query,{method:op.method,headers:h}),env,ctx,template);
   const text=await result.text(),data=media.includes('json')?JSON.parse(text):null;
   assert.equal(result.status,code==='invalid_request'?400:403,label);
   assert.equal(result.headers.get('Content-Type').split(';')[0],media,label);
   for(const [name,value]of Object.entries(common))assert.equal(result.headers.get(name),value,label+' '+name);
   if(data){assert.equal(data.code,code,label);assert.equal(data.traceId,'0123456789abcdef-ICN');if(field)assert.equal(data.field,field,label);}
   else assert.ok(text.includes('0123456789abcdef-ICN'),label);
   assert.equal(logs.length,1,label);assert.equal(logs[0][1].kind,code,label);assert.equal(logs[0][1].traceId,'0123456789abcdef-ICN',label);
   assert.equal(shape(),before,label+' must preserve all database rows');
   records.push({operation_id:op.operation_id,api_id:op.api_id,label,method:op.method,path_template:op.path,status:result.status,code,media,field:field||null,common_headers:true,trace_and_log:true,database_unchanged:true});
  }
  await refused('Access context missing','access_missing',{ctx:{}});
  await refused('Access context for other audience','access_other_app',{ctx:{access:{aud:'unrelated-synthetic-audience'}}});
  if(op.path==='/'||op.path==='/hub'||/^\/(?:pictures|overview|p)\//.test(op.path)){
   await refused('browser Access context missing','access_missing',{ctx:{},media:'text/html'});
   await refused('browser Access other audience','access_other_app',{ctx:{access:{aud:'unrelated-synthetic-audience'}},media:'text/html'});
  }
  if(op.method!=='GET')await refused('cross-site write','cross_site',{headers:{'Sec-Fetch-Site':'cross-site'}});
  // The export is the one read that only the user makes and that another site cannot ask for (API-178).
  if(op.operation_id==='exportProject'){
   await refused('cross-site export','cross_site',{identity:'user',headers:{'Sec-Fetch-Site':'cross-site'}});
   await refused('export with the service token','user_only');
   await refused('export by neither author kind','user_only',{identity:'neither'});
  }
  if(role){
   await refused('neither author kind','no_kind',{identity:'neither'});
   if(role!=='either')await refused('wrong write role',role==='user'?'user_only':'agent_only',{identity:role==='user'?'agent':'user'});
   if(writes.has(op.operation_id))await refused('missing write id','invalid_request',{headers:{'Idempotency-Key':''},field:'Idempotency-Key'});
   if(role!=='user')await refused('missing agent session','invalid_request',{headers:{'Nexus-Session':''},field:'Nexus-Session'});
  }
  if(op.operation_id==='getAgentTodo')await refused('bad optional session','invalid_request',{headers:{'Nexus-Session':'bad session'},field:'Nexus-Session'});
  if(op.operation_id==='getStage')for(const [query,field] of [['?after=-1','after'],['?filter=open','filter'],['?group=kind','group'],['?q='+'x'.repeat(201),'q'],['?after=1&after=2','after']])await refused('query value in another form','invalid_request',{query,field});
  if(op.operation_id==='getStageTalk')for(const [query,field] of [['?item=tbl-111','item'],['?item=TBL-1234567','item'],['?closed=2','closed'],['?closed=0&closed=1','closed'],['?after=x','after']])await refused('query value in another form','invalid_request',{query,field});
  if(op.operation_id==='getItem')for(const [query,field] of [['?part=Nexus','part'],['?part=','part'],['?part=nexus&part=memory','part']])await refused('query value in another form','invalid_request',{query,field});
  if(op.operation_id==='searchItems')for(const [query,field] of [['','q'],['?q=a','q'],['?q=%20a%20','q'],['?q='+'x'.repeat(201),'q'],['?q=ab&q=cd','q']])await refused('query value in another form','invalid_request',{query,field});
 }
} finally {
 console.error=originalError;
 db.close();
}
assert.equal(records.length,191);
assert.equal(new Set(records.map(row=>row.operation_id)).size,43);

});
