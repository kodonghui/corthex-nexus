// Review draft intended for nexus/test/. No added dependency or real account.
// SQL is used only to seed validated synthetic quota rows; every observed
// response and refusal is sent through the actual HTTP handler.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {handle} from '../src/app.js';
import {inputFailure} from '../src/input-check.js';
import {readSnapshot02} from '../src/snapshot02.js';
import {fakeD1} from './fake-d1.js';
import {testAccess} from './access-fixture.js';
import {viewSnapshot} from './view-fixtures.js';

test('actual handler boundaries preserve rows and receipts on quota, state, claim and target refusals',async()=>{
 const access=await testAccess(),root=new URL('../../',import.meta.url),template=readFileSync(new URL('nexus/src/hub.html',root),'utf8');
 const results=[],fixtures=[],checks=[],fixtureSchemaCorpus=[],fixtureSchemaSeen=new Set(),fixtureIds=[];let serial=0,fixtureSerial=0,cloneSerial=100000;
 const common={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','X-Robots-Tag':'noindex, nofollow','Cross-Origin-Resource-Policy':'same-origin'};
 const digest=value=>createHash('sha256').update(value).digest('hex');
 const projection={comment:['NewComment',['part','stage','item','text','quote','discrepancy']],proposal:['NewProposal',['part','stage','reason','change','source_text','comment','discrepancy']],reply:['NewReply',['text']]};
 const retainSchema=(schema,value)=>{const key=schema+':'+JSON.stringify(value);if(!fixtureSchemaSeen.has(key)){fixtureSchemaSeen.add(key);fixtureSchemaCorpus.push({schema,value});}};
 const validateRow=(type,row)=>{
  const [schema,keys]=projection[type],body=Object.fromEntries(keys.filter(key=>row[key]!==null&&row[key]!==undefined).map(key=>[key,row[key]]));
  if(type==='proposal')body.items=JSON.parse(row.items);if(type==='reply')body.settles=Boolean(row.settles);
  assert.equal(inputFailure(body,schema),null,'quota seed row satisfies '+schema);
  retainSchema(schema,body);
 };
 function clone(db,table,row,extra={}){
  const next={...row,...extra};if('id'in next)next.id=next.id.slice(0,3)+String(++cloneSerial).padStart(12,'0');
  if('id'in next){assert.match(next.id,/^n[cpe]_[0-9]{12}$/);fixtureIds.push({schema:{comments:'CommentId',proposals:'ProposalId',edits:'EditId'}[table],value:next.id});}
  const names=Object.keys(next);db.prepare('INSERT INTO '+table+'('+names.join(',')+') VALUES('+names.map(()=>'?').join(',')+')').run(...names.map(name=>next[name]));return next;
 }
 async function fixture({legacy=false,change}={}){
  const db=new DatabaseSync(':memory:'),name='qa-boundary-'+(++fixtureSerial),env={...access.env,DB:fakeD1(db),NEXUS_LANGUAGE:'en'},base='/api/spaces/'+name;
  let snapshot=viewSnapshot(name);if(change)change(snapshot);
  if(legacy){snapshot.schema='corthex-hub/0.1';snapshot.generator='corthex-nexus 0.1.0';delete snapshot.pictures;delete snapshot.left_out;delete snapshot.ask_before;delete snapshot.records;}
  else readSnapshot02(snapshot,Date.now());retainSchema(legacy?'Snapshot01':'Snapshot02',snapshot);
  function hash(){const names=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row=>row.name);return digest(JSON.stringify(names.map(table=>[table,db.prepare('SELECT * FROM '+table).all().map(row=>JSON.stringify(row)).sort()])));}
  function bytes(){return db.prepare(`SELECT
   COALESCE((SELECT SUM(length(CAST(text AS BLOB))+length(CAST(COALESCE(quote,'') AS BLOB))) FROM comments),0)+
   COALESCE((SELECT SUM(length(CAST(text AS BLOB))) FROM replies),0)+
   COALESCE((SELECT SUM(length(CAST(link AS BLOB))+length(CAST(COALESCE(text,'') AS BLOB))) FROM decisions),0)+
   COALESCE((SELECT SUM(length(CAST(reason AS BLOB))+length(CAST(change AS BLOB))+length(CAST(COALESCE(source_text,'') AS BLOB))) FROM proposals),0) AS total`).get().total;}
  function recount(){db.prepare('UPDATE project_spaces SET text_bytes=? WHERE project=?').run(bytes(),name);}
  function integrity(label){
   assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok',label);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0,label);
   const space=db.prepare('SELECT text_bytes FROM project_spaces WHERE project=?').get(name);if(space)assert.equal(space.text_bytes,bytes(),label+' exact UTF-8 accounting');
   checks.push({fixture:name,label,quickCheck:true,foreignKeys:true,exactTextAccounting:true,textBytes:space?.text_bytes??null});
  }
  async function call(label,method,path,{body,kind='agent',status=200,code,fields={},headers={},session='session-owner',writeId,inputSchema,allowInvalidInput=false}={}){
   const before=hash(),writesBefore=db.prepare("SELECT name FROM sqlite_master WHERE name='writes'").get()?db.prepare('SELECT COUNT(*) AS n FROM writes').get().n:0;
   const h={...access.headers(kind),'Cf-Ray':'0123456789abcdef-ICN',...(kind==='agent'?{'Nexus-Session':session}:{}),...(method==='POST'?{'Idempotency-Key':writeId||'"nw_'+(++serial).toString().padStart(12,'0')+'"'}:{}),...headers};
   if(body!==undefined&&!Object.hasOwn(h,'Content-Type'))h['Content-Type']='application/json';
   const shapeFailure=inputSchema&&body!==undefined?inputFailure(body,inputSchema):null;
   if(inputSchema&&!allowInvalidInput)assert.equal(shapeFailure,null,label+' request baseline shape');
   const logs=[],originalError=console.error;console.error=(...args)=>logs.push(args);let response;
   try{response=await handle(new Request('https://nexus.example.com'+path,{method,headers:h,...(body===undefined?{}:{body:JSON.stringify(body)})}),env,access.ctx,template);}finally{console.error=originalError;}
   const text=await response.text(),media=response.headers.get('Content-Type').split(';')[0],data=media.includes('json')?JSON.parse(text):null;
   const actualCode=data?.code||logs[0]?.[1]?.kind||null,unchanged=hash()===before,writesAfter=db.prepare('SELECT COUNT(*) AS n FROM writes').get().n;
   const row={label,fixture:name,method,path,status:response.status,media,code:actualCode,field:data?.field||null,why:data?.why||null,state:data?.state||null,expectedStatus:status,expectedCode:code||null,inputSchema:inputSchema||null,inputShapeValid:inputSchema?!shapeFailure:null,intentionallyInvalidInput:allowInvalidInput,databaseUnchanged:unchanged,writesBefore,writesAfter,fullCommonHeaderTraceAsserted:response.status>=400};results.push(row);
   assert.equal(response.status,status,label);if(code)assert.equal(actualCode,code,label);
   for(const [key,value]of Object.entries(fields))assert.equal(data?.[key],value,label+' '+key);
   if(response.status>=400){
    assert.equal(unchanged,true,label+' all SQLite rows unchanged');assert.equal(writesAfter,writesBefore,label+' no receipt saved');
    for(const [key,value]of Object.entries(common))assert.equal(response.headers.get(key),value,label+' '+key);
    assert.equal(logs.length,1,label+' one error log');assert.equal(logs[0][1].traceId,'0123456789abcdef-ICN');
    if(data)assert.equal(data.traceId,'0123456789abcdef-ICN');else assert.ok(text.includes('0123456789abcdef-ICN'));
   }
   if(method==='GET'||method==='HEAD')assert.equal(unchanged,true,label+' read-only');
   return data;
  }
  const commentBody={part:'sample',stage:'05-erd',item:'TBL-001',text:'Synthetic comment'};
  const proposalBody={part:'sample',stage:'05-erd',items:['TBL-001'],reason:'Reason',change:'Change'};
  const f={db,name,base,snapshot,call,hash,bytes,recount,integrity,commentBody,proposalBody,
   comment:()=>call('create comment','POST',base+'/comments',{body:commentBody,kind:'user',status:201,inputSchema:'NewComment'}),
   proposal:(extra={})=>call('create proposal','POST',base+'/proposals',{body:{...proposalBody,...extra},status:201,inputSchema:'NewProposal'}),
   checkpoint:()=>call('pass checkpoint','POST',base+'/checkpoints',{body:{part:'sample',stage:'05-erd'},kind:'user',status:201,inputSchema:'NewCheckpoint'})};
  fixtures.push(f);await call('initial synthetic snapshot','POST','/api/snapshots',{body:snapshot,status:200});integrity('initial fixture');return f;
 }
 try {
  // Read/target/media conditions, including a genuine phase-1 snapshot-only space.
  const f=await fixture(),legacy=await fixture({legacy:true});
  for(const prefix of ['/pictures/','/overview/'])for(const [suffix,expected]of [['missing/sample/05-erd','project_not_found'],[f.name+'/other/05-erd','part_not_found'],[f.name+'/sample/02-wrong','not_found']])for(const accept of ['text/html','application/problem+json'])await f.call('page target '+expected,'GET',prefix+suffix,{status:404,code:expected,headers:{Accept:accept}});
  for(const accept of ['text/html','application/problem+json'])await legacy.call('legacy page has no space','GET','/pictures/'+legacy.name+'/sample/05-erd',{status:404,code:'space_not_found',headers:{Accept:accept}});
  for(const path of ['/pictures/sample/05-erd','/todo'])await legacy.call('legacy API has no space','GET',legacy.base+path,{status:404,code:'space_not_found'});
  await legacy.call('legacy held has no default commit','GET','/api/snapshots/'+legacy.name+'/held');await legacy.call('legacy removal is snapshot-only','GET','/api/snapshots/'+legacy.name+'/removal');
  // One database with exactly two projects for the named two-project list.
  const second=viewSnapshot('qa-boundary-second');await f.call('second synthetic project','POST','/api/snapshots',{body:second});const list=await f.call('exactly two project rows','GET','/api/snapshots');assert.equal(list.projects.length,2);
  for(const stage of ['01-domain','05-erd','07-sitemap']){if(stage==='05-erd')await f.comment();await f.call('complete picture '+stage,'GET',f.base+'/pictures/sample/'+stage);}
  for(const [path,code]of [['/pictures/other/05-erd','part_not_found'],['/pictures/sample/02-wrong','not_found'],['/overview/other/05-erd','part_not_found'],['/overview/sample/02-wrong','not_found']])await f.call('API target '+code,'GET',f.base+path,{status:404,code});
  const omitted=await fixture({change:s=>{s.pictures=s.pictures.filter(p=>p.stage!=='05-erd');s.left_out=[{part:'sample',stage:'05-erd',why:'size'}];}});await omitted.call('picture omitted for size','GET',omitted.base+'/pictures/sample/05-erd',{status:404,code:'picture_not_found',fields:{why:'size'}});
  const absent=await fixture({change:s=>{s.pictures=s.pictures.filter(p=>p.stage!=='05-erd');}});
  await absent.call('proposal on undrawn picture','POST',absent.base+'/proposals',{body:absent.proposalBody,status:404,code:'picture_not_found',fields:{why:'not-drawn'},inputSchema:'NewProposal'});
  // The redesign (SPEC-151): a comment needs no picture and takes the held commit, but a held part and one of the 13 stages; only the agent sends asks (SPEC-143).
  const undrawn=await absent.call('comment on a stage without its picture','POST',absent.base+'/comments',{body:absent.commentBody,kind:'user',status:201,inputSchema:'NewComment'});
  assert.equal(undrawn.commit,absent.db.prepare('SELECT default_commit FROM snapshots').get().default_commit);
  await absent.call('comment on a part the snapshot does not hold','POST',absent.base+'/comments',{body:{...absent.commentBody,part:'other'},status:404,code:'part_not_found',inputSchema:'NewComment'});
  await absent.call('comment on a stage outside the 13','POST',absent.base+'/comments',{body:{...absent.commentBody,stage:'99-x'},status:400,code:'invalid_request',fields:{field:'stage'},inputSchema:'NewComment',allowInvalidInput:true});
  await absent.call('user comment with asks','POST',absent.base+'/comments',{body:{...absent.commentBody,asks:'answer'},kind:'user',status:400,code:'invalid_request',fields:{field:'asks'},inputSchema:'NewComment'});
  // Snapshot cross-field and held-commit/address refusals.
  const badCommit=structuredClone(f.snapshot);badCommit.pictures[0].commit='b'.repeat(40);await f.call('snapshot picture commit mismatch','POST','/api/snapshots',{body:badCommit,status:400,code:'invalid_snapshot',fields:{field:'pictures[0].commit'}});
  const replacement=structuredClone(f.snapshot);replacement.repos['.'].default.commit='b'.repeat(40);replacement.records.commit='b'.repeat(40);for(const p of replacement.pictures)p.commit='b'.repeat(40);delete replacement.replaces;readSnapshot02(replacement,Date.now());await f.call('held commit not replaced','POST','/api/snapshots',{body:replacement,status:409,code:'commit_not_replaced'});
  const mismatch=structuredClone(f.snapshot);mismatch.repos['.'].web='https://github.com/example/different-synthetic';mismatch.repos['.'].url=mismatch.repos['.'].web;await f.call('fixture repository mismatch','POST','/api/snapshots',{body:mismatch,status:409,code:'repository_mismatch'});

  // Each body-consuming operation gets its own actual invalid field, size and
  // media refusal. Long allowed fields stay distinct from the generic field=text example.
  const inputs=await fixture(),c=await inputs.comment(),p=await inputs.proposal(),accepted=await inputs.call('accept for input checks','POST',inputs.base+'/proposals/'+p.id+'/accept',{kind:'user'}),cp=await inputs.checkpoint();
  const routes=[
   ['comments',inputs.commentBody,'NewComment','text',4000,'user'],
   ['comments/'+c.id+'/replies',{text:'Reply'},'NewReply','text',4000,'agent'],
   ['comments/'+c.id+'/decisions',{link:'https://example.com/record',text:'Decision'},'NewDecision','text',4000,'agent'],
   ['proposals',inputs.proposalBody,'NewProposal','reason',2000,'agent'],
   ['edits/'+accepted.edit.id+'/report',{event:'opened',pull_request:'https://example.com/repo/pull/1'},'EditReport','pull_request',2000,'agent'],
   ['checkpoints',{part:'sample',stage:'05-erd'},'NewCheckpoint','words',2000,'user'],
   ['checkpoints/'+cp.id+'/report',{event:'opened',pull_request:'https://example.com/repo/pull/2'},'CheckpointReport','pull_request',2000,'agent']
  ];
  for(const [suffix,body,schema,longField,limit,kind]of routes){
   await inputs.call('wrong media '+schema,'POST',inputs.base+'/'+suffix,{body,kind,status:415,code:'json_required',headers:{'Content-Type':'text/plain'},inputSchema:schema});
   const invalid=schema==='NewProposal'?{...body,items:['TBL-999']}:{...body,text:''};
   await inputs.call('invalid named field '+schema,'POST',inputs.base+'/'+suffix,{body:invalid,kind,status:400,code:schema==='NewProposal'?'unknown_item':'invalid_request',fields:schema==='NewProposal'?{}:{field:['EditReport','NewCheckpoint','CheckpointReport'].includes(schema)?'body':'text'},inputSchema:schema,allowInvalidInput:true});
   const long={...body,[longField]:longField==='pull_request'?'https://example.com/'+('x'.repeat(limit)):('x'.repeat(limit+1))};
   await inputs.call('long declared field '+schema,'POST',inputs.base+'/'+suffix,{body:long,kind,status:413,code:'text_too_long',fields:{field:longField},inputSchema:schema,allowInvalidInput:true});
   await inputs.call('oversized JSON before shape '+schema,'POST',inputs.base+'/'+suffix,{body:{...body,padding:'x'.repeat(262144)},kind,status:413,code:'body_too_large',inputSchema:schema,allowInvalidInput:true});
  }
  // Actual nonexistent targets and genuine legacy no-space writes.
  const targets=[['comments/nc_000000000001','GET',undefined,'comment_not_found'],['comments/nc_000000000001/replies','POST',{text:'Reply'},'comment_not_found'],['comments/nc_000000000001/answered','POST',undefined,'comment_not_found'],['comments/nc_000000000001/decisions','POST',{link:'https://example.com/record'},'comment_not_found'],['proposals/np_000000000001','GET',undefined,'proposal_not_found'],['proposals/np_000000000001/withdraw','POST',undefined,'proposal_not_found'],['proposals/np_000000000001/accept','POST',undefined,'proposal_not_found','user'],['proposals/np_000000000001/dismiss','POST',undefined,'proposal_not_found','user'],['edits/ne_000000000001','GET',undefined,'edit_not_found'],['edits/ne_000000000001/report','POST',{event:'needs-user'},'edit_not_found'],['edits/ne_000000000001/dismiss','POST',undefined,'edit_not_found','user'],['checkpoints/nk_000000000001','GET',undefined,'checkpoint_not_found'],['checkpoints/nk_000000000001/withdraw','POST',undefined,'checkpoint_not_found','user'],['checkpoints/nk_000000000001/report','POST',{event:'opened',pull_request:'https://example.com/repo/pull/1'},'checkpoint_not_found'],['claims/nc_000000000001','POST',undefined,'entry_not_found'],['claims/nc_000000000001','DELETE',undefined,'entry_not_found']];
  for(const [suffix,method,body,code,kind='agent']of targets){await f.call('missing target '+suffix,method,f.base+'/'+suffix,{body,kind,status:404,code});if(['/accept','/dismiss','/withdraw'].some(x=>suffix.endsWith(x))&&kind==='user')await f.call('missing project '+suffix,method,'/api/spaces/missing/'+suffix,{body,kind,status:404,code:'project_not_found'});}
  for(const [suffix,body,schema]of [['comments',legacy.commentBody,'NewComment'],['comments/nc_000000000001/replies',{text:'Reply'},'NewReply'],['comments/nc_000000000001/answered',undefined,null],['comments/nc_000000000001/decisions',{link:'https://example.com/record'},'NewDecision'],['checkpoints',{part:'sample',stage:'05-erd'},'NewCheckpoint']])await legacy.call('legacy no-space '+suffix,'POST',legacy.base+'/'+suffix,{body,kind:suffix==='checkpoints'?'user':'agent',status:404,code:'space_not_found',inputSchema:schema});
  await f.call('checkpoint unknown part','POST',f.base+'/checkpoints',{body:{part:'other',stage:'05-erd'},kind:'user',status:404,code:'part_not_found',inputSchema:'NewCheckpoint'});
  for(const [suffix,body,schema]of [['comments',{...f.commentBody,discrepancy:'nd_000000000001'},'NewComment'],['proposals',{...f.proposalBody,discrepancy:'nd_000000000001'},'NewProposal'],['proposals',{...f.proposalBody,comment:'nc_000000000001'},'NewProposal']])await f.call('missing linked target '+suffix,'POST',f.base+'/'+suffix,{body,status:404,code:body.discrepancy?'discrepancy_not_found':'comment_not_found',inputSchema:schema});

  // Claims, closed state, proposal and report transitions through handle.
  const state=await fixture({change:s=>{s.pictures.find(p=>p.stage==='05-erd').source.tables[0].context='CTX-002';}}),sc=await state.comment();
  const picture=await state.call('read discrepancy fixture','GET',state.base+'/pictures/sample/05-erd');assert.ok(picture.discrepancies.length);const diff=picture.discrepancies[0].id;
  await state.call('claim comment','POST',state.base+'/claims/'+sc.id);await state.call('claim discrepancy','POST',state.base+'/claims/'+diff);
  for(const [suffix,body]of [['comments/'+sc.id+'/replies',{text:'Reply'}],['comments/'+sc.id+'/answered',undefined],['comments/'+sc.id+'/decisions',{link:'https://example.com/record'}],['proposals',{...state.proposalBody,comment:sc.id}],['comments',{...state.commentBody,discrepancy:diff}],['proposals',{...state.proposalBody,discrepancy:diff}]])await state.call('other agent claimed '+suffix,'POST',state.base+'/'+suffix,{body,session:'session-other',status:409,code:'claimed'});
  for(const method of ['POST','DELETE'])await state.call('other session claim/release',method,state.base+'/claims/'+sc.id,{session:'session-other',status:409,code:'claimed'});
  const linked=await state.proposal({comment:sc.id});await state.call('other agent withdrawal claimed','POST',state.base+'/proposals/'+linked.id+'/withdraw',{session:'session-other',status:409,code:'claimed'});
  await state.call('close comment as answered','POST',state.base+'/comments/'+sc.id+'/answered');
  await state.call('closed comment reply refused','POST',state.base+'/comments/'+sc.id+'/replies',{body:{text:'Agent reply'},status:409,code:'comment_closed'});
  await state.call('closed comment proposal refused','POST',state.base+'/proposals',{body:{...state.proposalBody,comment:sc.id},status:409,code:'comment_closed'});
  await state.call('closed entry claim refused','POST',state.base+'/claims/'+sc.id,{status:409,code:'entry_closed'});
  const dismissed=await state.proposal();await state.call('dismiss proposal','POST',state.base+'/proposals/'+dismissed.id+'/dismiss',{kind:'user'});
  for(const suffix of ['withdraw','accept','dismiss'])await state.call('dismissed proposal stays dismissed','POST',state.base+'/proposals/'+dismissed.id+'/'+suffix,{kind:suffix==='withdraw'?'agent':'user',status:409,code:'proposal_not_open',fields:{state:'dismissed'}});
  const ep=await state.proposal(),ea=await state.call('accept reflection','POST',state.base+'/proposals/'+ep.id+'/accept',{kind:'user'}),eid=ea.edit.id;
  await state.call('claim reflection','POST',state.base+'/claims/'+eid);await state.call('reflection claimed report refused','POST',state.base+'/edits/'+eid+'/report',{body:{event:'needs-user'},session:'session-other',status:409,code:'claimed'});
  await state.call('closed report before opened','POST',state.base+'/edits/'+eid+'/report',{body:{event:'closed',pull_request:'https://example.com/repo/pull/1'},status:409,code:'edit_state',fields:{state:'pending'}});
  await state.call('open reflection PR','POST',state.base+'/edits/'+eid+'/report',{body:{event:'opened',pull_request:'https://example.com/repo/pull/1'}});
  await state.call('second reflection PR','POST',state.base+'/edits/'+eid+'/report',{body:{event:'opened',pull_request:'https://example.com/repo/pull/2'},status:409,code:'pull_request_reported'});
  await state.call('wrong reflection PR','POST',state.base+'/edits/'+eid+'/report',{body:{event:'closed',pull_request:'https://example.com/repo/pull/2'},status:409,code:'pull_request_mismatch'});
  await state.call('PR holds reflection claim','POST',state.base+'/claims/'+eid,{status:409,code:'pull_request_reported'});
  const k=await state.checkpoint();await state.call('claim checkpoint','POST',state.base+'/claims/'+k.id);
  await state.call('checkpoint claimed report refused','POST',state.base+'/checkpoints/'+k.id+'/report',{body:{event:'opened',pull_request:'https://example.com/repo/pull/3'},session:'session-other',status:409,code:'claimed'});
  await state.call('checkpoint closed before opened','POST',state.base+'/checkpoints/'+k.id+'/report',{body:{event:'closed',pull_request:'https://example.com/repo/pull/3'},status:409,code:'checkpoint_state'});
  await state.call('open checkpoint PR','POST',state.base+'/checkpoints/'+k.id+'/report',{body:{event:'opened',pull_request:'https://example.com/repo/pull/3'}});
  await state.call('second checkpoint PR','POST',state.base+'/checkpoints/'+k.id+'/report',{body:{event:'opened',pull_request:'https://example.com/repo/pull/4'},status:409,code:'pull_request_reported'});
  await state.call('wrong checkpoint PR','POST',state.base+'/checkpoints/'+k.id+'/report',{body:{event:'closed',pull_request:'https://example.com/repo/pull/4'},status:409,code:'pull_request_mismatch'});
  await state.call('withdraw checkpoint','POST',state.base+'/checkpoints/'+k.id+'/withdraw',{kind:'user'});await state.call('withdrawn checkpoint cannot open PR','POST',state.base+'/checkpoints/'+k.id+'/report',{body:{event:'opened',pull_request:'https://example.com/repo/pull/4'},status:409,code:'checkpoint_withdrawn'});
  const recorded=await state.checkpoint();const recordSnap=structuredClone(state.snapshot);recordSnap.replaces=recordSnap.repos['.'].default.commit;recordSnap.stages['05-erd'].parts.sample.checkpoints=[{approved:'Synthetic checkpoint',by:'the maintainer',where:'https://example.com/record',date:new Date().toISOString().slice(0,10),nexus:recorded.id}];readSnapshot02(recordSnap,Date.now());await state.call('record checkpoint by snapshot','POST','/api/snapshots',{body:recordSnap});await state.call('recorded checkpoint cannot withdraw','POST',state.base+'/checkpoints/'+recorded.id+'/withdraw',{kind:'user',status:409,code:'checkpoint_recorded'});

  // A real stored receipt of another request name must reject every applicable
  // write operation before it touches the target or adds another receipt.
  const replay=await fixture(),writeId='"nw_aaaaaaaaaaaa"';await replay.call('original receipt','POST',replay.base+'/comments',{body:replay.commentBody,status:201,writeId});
  const reused=[['comments',replay.commentBody],['comments/nc_000000000001/replies',{text:'Reply'}],['comments/nc_000000000001/answered'],['comments/nc_000000000001/decisions',{link:'https://example.com/record'}],['proposals',replay.proposalBody],['proposals/np_000000000001/withdraw'],['proposals/np_000000000001/accept',undefined,'user'],['proposals/np_000000000001/dismiss',undefined,'user'],['edits/ne_000000000001/report',{event:'needs-user'}],['edits/ne_000000000001/dismiss',undefined,'user'],['checkpoints',{part:'sample',stage:'05-erd'},'user'],['checkpoints/nk_000000000001/withdraw',undefined,'user'],['checkpoints/nk_000000000001/report',{event:'opened',pull_request:'https://example.com/repo/pull/1'}]];
  for(const [suffix,body,kind='agent']of reused){
   // leaveComment needs a different-name receipt, not its own idempotent replay.
   if(suffix==='comments')continue;
   await replay.call('cross-request receipt '+suffix,'POST',replay.base+'/'+suffix,{body,kind,writeId,status:409,code:'write_id_reused'});
  }
  const differentId='"nw_bbbbbbbbbbbb"';await replay.call('proposal receipt for comment refusal','POST',replay.base+'/proposals',{body:replay.proposalBody,status:201,writeId:differentId});await replay.call('comment cannot reuse proposal receipt','POST',replay.base+'/comments',{body:replay.commentBody,writeId:differentId,status:409,code:'write_id_reused'});

  // Quota rows are cloned from valid handler-created rows. Recomputed byte
  // accounting, all FK/CHECK constraints and input projections are validated.
  const qc=await fixture(),qc1=await qc.comment(),qcRow=qc.db.prepare('SELECT * FROM comments WHERE id=?').get(qc1.id);validateRow('comment',qcRow);
  qc.db.exec('BEGIN');for(let i=1;i<2000;i++)clone(qc.db,'comments',qcRow);qc.recount();qc.db.exec('COMMIT');qc.integrity('2000 valid comments');await qc.call('comment quota','POST',qc.base+'/comments',{body:qc.commentBody,status:409,code:'comment_limit'});
  const qr=await fixture(),qr1=await qr.comment();await qr.call('seed valid reply','POST',qr.base+'/comments/'+qr1.id+'/replies',{body:{text:'Synthetic reply'},status:201});const rr=qr.db.prepare('SELECT * FROM replies WHERE comment=?').get(qr1.id);validateRow('reply',rr);qr.db.exec('BEGIN');for(let i=2;i<=200;i++)clone(qr.db,'replies',rr,{seq:i});qr.recount();qr.db.exec('COMMIT');qr.integrity('200 valid replies');await qr.call('reply quota','POST',qr.base+'/comments/'+qr1.id+'/replies',{body:{text:'Extra'},status:409,code:'reply_limit'});
  const qp=await fixture(),qp1=await qp.proposal(),qpRow=qp.db.prepare('SELECT * FROM proposals WHERE id=?').get(qp1.id);validateRow('proposal',qpRow);qp.db.exec('BEGIN');for(let i=1;i<500;i++)clone(qp.db,'proposals',qpRow);qp.recount();qp.db.exec('COMMIT');qp.integrity('500 valid open proposals');await qp.call('proposal quota','POST',qp.base+'/proposals',{body:qp.proposalBody,status:409,code:'proposal_limit'});
  const qe=await fixture(),qe1=await qe.proposal(),qeAccepted=await qe.call('seed accepted reflection','POST',qe.base+'/proposals/'+qe1.id+'/accept',{kind:'user'}),pRow=qe.db.prepare('SELECT * FROM proposals WHERE id=?').get(qe1.id),eRow=qe.db.prepare('SELECT * FROM edits WHERE id=?').get(qeAccepted.edit.id);validateRow('proposal',pRow);
  qe.db.exec('BEGIN');for(let i=1;i<500;i++){const pr=clone(qe.db,'proposals',pRow);clone(qe.db,'edits',eRow,{proposal:pr.id});}qe.recount();qe.db.exec('COMMIT');qe.integrity('500 valid pending reflections');const extra=await qe.proposal();await qe.call('reflection quota','POST',qe.base+'/proposals/'+extra.id+'/accept',{kind:'user',status:409,code:'reflection_limit'});
  const full=await fixture(),fc=await full.comment(),fp=await full.proposal(),fullRow=full.db.prepare('SELECT * FROM comments WHERE id=?').get(fc.id);let remaining=8*1024*1024-full.bytes();full.db.exec('BEGIN');
  while(remaining>0){const chars=Math.min(4000,Math.floor(remaining/3)),text=chars?'가'.repeat(chars):'x'.repeat(remaining);const row={...fullRow,text};validateRow('comment',row);clone(full.db,'comments',row);remaining-=Buffer.byteLength(text);}
  full.recount();full.db.exec('COMMIT');full.integrity('exactly 8MiB of valid stored text');assert.equal(full.bytes(),8*1024*1024);assert.ok(full.db.prepare('SELECT COUNT(*) AS n FROM comments').get().n<2000);
  for(const [suffix,body]of [['comments',full.commentBody],['comments/'+fc.id+'/replies',{text:'Extra'}],['comments/'+fc.id+'/decisions',{link:'https://example.com/extra'}],['proposals',full.proposalBody]])await full.call('exact text-byte quota '+suffix,'POST',full.base+'/'+suffix,{body,status:409,code:'space_full'});
  for(const fi of fixtures)fi.integrity('final fixture state');
 }finally{
  if(process.env.NEXUS_BOUNDARY_RESULTS)writeFileSync(process.env.NEXUS_BOUNDARY_RESULTS,JSON.stringify({requests:results,fixtureChecks:checks,fixtureSchemaCorpus,fixtureIds},null,2));
  for(const fixture of fixtures)fixture.db.close();
 }
 assert.ok(results.length>100);assert.ok(checks.length>10);
});
