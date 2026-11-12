// Local QA server with synthetic Access and in-memory SQLite. Never deploy.
import {readFileSync,statSync}from"node:fs";
import {createServer}from"node:http";
import {handle}from"../src/app.js";
import {createViews}from"../src/views.js";
import {fakeD1}from"./fake-d1.js";
import {testAccess}from"./access-fixture.js";
import {hubSnapshot,viewSnapshot}from"./view-fixtures.js";
const access=await testAccess(),env={...access.env,DB:fakeD1(),NEXUS_LANGUAGE:"en"},template=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8"),folder=new URL("../src/view-code/",import.meta.url),manifestFile=new URL("sizes.json",folder),code={};
let stamp=0,views;function reloadBuild(){const next=statSync(manifestFile).mtimeMs;if(next===stamp)return;const manifest=JSON.parse(readFileSync(manifestFile));for(const f of manifest.files)code[f.name]={type:f.type,body:readFileSync(new URL(f.path,folder))};views=createViews(code,manifest.entries);stamp=next;}reloadBuild();
let sequence=0;const writes=[];
async function callIn(target,method,path,body,kind="user"){
 const headers={...access.headers(kind),"Content-Type":"application/json","Nexus-Session":"qa-fixture","Idempotency-Key":JSON.stringify("nw_"+(++sequence).toString(16).padStart(12,"0"))};
 const response=await handle(new Request("http://127.0.0.1"+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),target,access.ctx,template,views);const data=await response.json();if(!response.ok)throw new Error(JSON.stringify(data));return data;
}
const call=(...args)=>callIn(env,...args);
for(const project of["qa-views","qa-views-reply","qa-views-overview"])await call("POST","/api/snapshots",viewSnapshot(project),"agent");
if(process.env.NEXUS_QA_TALL_SITEMAP==="1"){
 const project="qa-tall-sitemap",snapshot=viewSnapshot(project),sitemap=snapshot.pictures.find(p=>p.stage==="07-sitemap");
 const [root,child]=sitemap.source.screens;
 sitemap.source.screens=Array.from({length:300},(_,i)=>({
  ...(i===0?root:child),id:"SCR-"+String(i+1).padStart(3,"0"),context:"",
  name:"시험 화면 "+(i+1),path:i===0?"/":"/qa-"+i,
 }));
 await call("POST","/api/snapshots",snapshot,"agent");
 for(const item of ["SCR-001","SCR-300"]){
  await call("POST",`/api/spaces/${project}/comments`,{part:"sample",stage:"07-sitemap",item,text:"Whole-picture endpoint"});
 }
}
if(process.env.NEXUS_QA_HUB==="1"){
 const snapshot=viewSnapshot("qa-hub-complete");
 for(const stage of Object.values(snapshot.stages)){stage.parts.sample.state="done";stage.parts.sample.next="";stage.parts.sample.checkpoints=[{date:"2026-11-04",by:"user",approved:"Synthetic QA completion"}];}
 snapshot.pictures.push({...snapshot.pictures.find(p=>p.stage==="05-erd"),part:""});
 await call("POST","/api/snapshots",snapshot,"agent");
}
// The hub page's views (TASK-281, TC-1766): a project with items to find, trace and list.
// Only the hub suite opts in; it builds the device's file from the same synthetic snapshot.
const hubViews={};
if(process.env.NEXUS_QA_HUB_VIEWS==="1"){await call("POST","/api/snapshots",hubSnapshot("qa-hub"),"agent");hubViews.project="qa-hub";}
const comment=await call("POST","/api/spaces/qa-views/comments",{part:"sample",stage:"01-domain",item:"CTX-001",text:"Should retry be a separate action?"});
await call("POST",`/api/spaces/qa-views/comments/${comment.id}/replies`,{text:"The source can describe a retry command."},"agent");
const proposal=await call("POST","/api/spaces/qa-views/proposals",{part:"sample",stage:"01-domain",items:["CTX-001"],reason:"Make the retry explicit",change:"Add a retry command to Ordering.",source_text:"| Buyer | Orders | Retry payment | Order | Payment retried |",comment:comment.id},"agent");
const erdComment=await call("POST","/api/spaces/qa-views/comments",{part:"sample",stage:"05-erd",item:"TBL-001",text:"Should the reference be unique?"});
const erdProposal=await call("POST","/api/spaces/qa-views/proposals",{part:"sample",stage:"05-erd",items:["TBL-001"],reason:"Keep the unique reference",change:"Add a unique index.",source_text:"CREATE UNIQUE INDEX orders_reference ON orders(reference);",comment:erdComment.id},"agent");
const accepted=await call("POST",`/api/spaces/qa-views/proposals/${erdProposal.id}/accept`,{});
await call("POST",`/api/spaces/qa-views/edits/${accepted.edit.id}/report`,{event:"needs-user"},"agent");
// Opt-in cases keep each browser run's initial state independent.
const linked={};
if(process.env.NEXUS_QA_LINKS==="1"){
 const project="qa-views-links",base="/api/spaces/"+project;
 await call("POST","/api/snapshots",viewSnapshot(project),"agent");
 for(const [index,event]of["opened","reflected","merged"].entries()){
  const p=await call("POST",base+"/proposals",{part:"sample",stage:"05-erd",items:["TBL-001"],reason:"Synthetic reflection: "+event,change:"Describe the reference constraint.",source_text:"CREATE UNIQUE INDEX orders_reference ON orders(reference);"},"agent");
  const a=await call("POST",base+"/proposals/"+p.id+"/accept",{});
  const report=event==="reflected"?{event,commit:"b".repeat(40)}:{event,pull_request:"https://github.com/example/qa-shop/pull/"+(201+index)};
  await call("POST",base+"/edits/"+a.edit.id+"/report",report,"agent");
  linked[event]={proposal:p.id,edit:a.edit.id};
 }
 const cp=await call("POST",base+"/checkpoints",{part:"sample",stage:"05-erd",words:"Synthetic checkpoint waiting for its record"});
 await call("POST",base+"/checkpoints/"+cp.id+"/report",{event:"opened",pull_request:"https://github.com/example/qa-shop/pull/204"},"agent");
 linked.project=project;linked.checkpoint=cp.id;
}
// Only the eighth browser suite opts into these additional stored snapshots.
// All data is synthetic and enters SQLite through the normal application API.
const lateScreen={};
if(process.env.NEXUS_QA_LATE_SCREEN==="1"){
 const project="qa-late-screen",base="/api/spaces/"+project,snapshot=viewSnapshot(project);
 snapshot.project.parts=["sample","stale"];
 for(const stage of Object.values(snapshot.stages))stage.parts.stale=structuredClone(stage.parts.sample);
 const checkpoints=[{approved:"<b>Synthetic approval</b>",by:"Synthetic reviewer",date:"2026-11-03",where:"https://example.com/qa/synthetic-checkpoint"},{approved:"Second synthetic approval",by:"Another synthetic reviewer",date:"2026-11-04"}];
 snapshot.stages["05-erd"].parts.sample.checkpoints=checkpoints;
 const board=snapshot.pictures.find(p=>p.stage==="01-domain").source;
 board.aggregates.push({...board.aggregates[0],name:"Synthetic receipt",term:"TERM-003"});
 snapshot.pictures.push(...snapshot.pictures.map(p=>({...structuredClone(p),part:"stale"})));
 const initial=await call("POST","/api/snapshots",snapshot,"agent");
 const stale=structuredClone(snapshot);
 stale.generated_at=new Date(Math.max(Date.now(),Date.parse(snapshot.generated_at)+1)).toISOString();
 stale.pictures=stale.pictures.filter(p=>p.part!=="stale");
 stale.left_out=[{part:"stale",stage:"01-domain",why:"size"},{part:"stale",stage:"07-sitemap",why:"other-repository"}];
 const marked=await call("POST","/api/snapshots",stale,"agent");
 const c=await call("POST",base+"/comments",{part:"sample",stage:"05-erd",item:"TBL-001",text:"Synthetic late-screen comment"});
 const p=await call("POST",base+"/proposals",{part:"sample",stage:"05-erd",items:["TBL-001"],reason:"Synthetic late-screen reflection",change:"Describe the synthetic constraint.",source_text:"CREATE UNIQUE INDEX orders_reference ON orders(reference);",comment:c.id},"agent");
 const accepted=await call("POST",base+"/proposals/"+p.id+"/accept",{});
 Object.assign(lateScreen,{project,part:"sample",stalePart:"stale",checkpoints,comment:c.id,proposal:p.id,edit:accepted.edit.id,initial,marked});
}
// The redesign's pages (TASK-272) at their addresses (TASK-271): a synthetic project with
// two parts, the five states, my turn and a title that tries markup and the data's marker.
// Only the page suite opts in.
const pages={};
if(process.env.NEXUS_QA_PAGES==="1"){
 const project="qa-pages",base="/api/spaces/"+project,snapshot=viewSnapshot(project);
 snapshot.project.title='<b>QA</b> "pages" & __CORTHEX_VIEW_DATA__ 합성 가게의 아주 긴 이름이 줄을 넘는 경우';
 snapshot.project.parts=["sample","second"];
 for(const [key,state]of[["01-domain","done"],["04-functional-spec","in_progress"],["05-erd","not_started"],["07-sitemap","skipped"]]){
  const record=snapshot.stages[key].parts.sample;record.state=state;
  if(state==="done")record.checkpoints=[{date:"2026-11-08",by:"Synthetic reviewer",approved:"Synthetic checkpoint"}];
 }
 for(const stage of Object.values(snapshot.stages))stage.parts.second=structuredClone(stage.parts.sample);
 snapshot.pictures.push(...snapshot.pictures.map(p=>({...structuredClone(p),part:"second"})));
 await call("POST","/api/snapshots",snapshot,"agent");
 const mine=await call("POST",base+"/comments",{part:"sample",stage:"05-erd",item:"TBL-001",text:"Synthetic question for the page suite"},"agent");
 Object.assign(pages,{project,parts:snapshot.project.parts,title:snapshot.project.title,mine:mine.id});
}
// The first page (TASK-273): my turn with each kind of entry and those that its suite
// answers, the agent to-do, two cards in different orders by name and by push, and two
// more servers, chosen by a cookie, for SCR-110#nothing-waits and SCR-110#empty. Only the
// first page's suite opts in; its "other tab" writes go through /api like the page's.
const home={},spaces={};
if(process.env.NEXUS_QA_HOME==="1"){
 const project="qa-home",base="/api/spaces/"+project,snapshot=viewSnapshot(project),where="docs/qa-sample.md:1";
 snapshot.project.title='<b>QA</b> 첫 페이지 & __CORTHEX_VIEW_DATA__ 합성 가게의 아주 긴 이름이 줄을 넘는 경우';
 snapshot.project.parts=["sample","gone"];
 for(const stage of Object.values(snapshot.stages))stage.parts.gone=structuredClone(stage.parts.sample);
 snapshot.items=[{id:"TBL-001",kind:"table",stage:"05-erd",where,title:"orders"},{id:"SCR-001",kind:"screen",stage:"07-sitemap",where,title:"Home"},{id:"REQ-107",kind:"requirement",stage:"02-prd",where,title:"Lead 0.2's addresses to their new places"}];
 snapshot.summary={...snapshot.summary,items:snapshot.items.length};
 await call("POST","/api/snapshots",snapshot,"agent");
 const proposal=async n=>(await call("POST",base+"/proposals",{part:"sample",stage:"05-erd",items:["TBL-001"],reason:"Synthetic proposal "+n,change:"Describe the reference constraint "+n+".",source_text:"CREATE UNIQUE INDEX orders_reference ON orders(reference);"},"agent")).id;
 const asks=async(asks,{part="sample",stage="07-sitemap",item="SCR-001",quote}={})=>(await call("POST",base+"/comments",{part,stage,item,...(quote?{quote}:{}),text:`Synthetic ${asks}: keep SCR-105's address as a redirect, so that links from 0.2 keep working.`,asks},"agent")).id;
 for(const name of["accept","dismiss","stale","retry","reused","sending"])home[name]=await proposal(name);
 home.recommended=await asks("recommended");home.taken=await asks("recommended");home.closed=await asks("recommended");
 home.checkpoint=await asks("checkpoint",{stage:"05-erd",item:""});home.gonePart=await asks("checkpoint",{part:"gone",stage:"05-erd",item:""});
 home.question=await asks("answer",{stage:"01-domain",item:"",quote:"Ordering"});
 // The agent's to-do: a comment of the user's that waits for it.
 home.forAgent=(await call("POST",base+"/comments",{part:"sample",stage:"07-sitemap",item:"SCR-001",text:"Synthetic comment that waits for the agent"})).id;
 // The part "gone" leaves the snapshot, with a checkpoint still asked for on it, and the
 // sitemap's newest source is in another repository, so that its picture is not current.
 const again=structuredClone(snapshot);again.project.parts=["sample"];again.generated_at=new Date(Date.parse(snapshot.generated_at)+1000).toISOString();
 for(const stage of Object.values(again.stages))delete stage.parts.gone;
 again.pictures=again.pictures.filter(p=>p.stage!=="07-sitemap");again.left_out=[{part:"sample",stage:"07-sitemap",why:"other-repository"}];
 await call("POST","/api/snapshots",again,"agent");
 // A second project, pushed last: first by the last push, second by name. The suite asks
 // for it to be pushed again (/__qa/push-again), as the agent would, to see a card change.
 const two=viewSnapshot("qa-home-two");two.generated_at=new Date(Date.parse(again.generated_at)+1000).toISOString();
 await call("POST","/api/snapshots",two,"agent");
 home.pushAgain=async()=>{two.generated_at=new Date(Math.max(Date.now(),Date.parse(two.generated_at)+1000)).toISOString();return call("POST","/api/snapshots",two,"agent");};
 Object.assign(home,{project,second:"qa-home-two",title:snapshot.project.title});
 spaces.quiet={...env,DB:fakeD1()};spaces.empty={...env,DB:fakeD1()};
 await callIn(spaces.quiet,"POST","/api/snapshots",viewSnapshot("qa-home-quiet"),"agent");
 await callIn(spaces.quiet,"POST","/api/spaces/qa-home-quiet/comments",{part:"sample",stage:"05-erd",item:"TBL-001",text:"Synthetic comment that waits for the agent"});
}
// A stage in the workspace (TASK-274): 450 requirements on 02, in two contexts and without one,
// with priorities, statuses and Korean and English sentences, so that the list reads three
// times; talk and my turn on some of them; a checkpoint that waits for its record; a stage
// that the project does not read (03) and one without items (04); a pictured stage with talk,
// my turn and a pending reflection (05); and a second project without recorded progress. Only
// the stage suite opts in; it pushes the project again through /__qa/push-again.
const stageQa={};
if(process.env.NEXUS_QA_STAGE==="1"){
 const project="qa-stage",base="/api/spaces/"+project,snapshot=viewSnapshot(project),where="docs/qa-prd.md:1",time=snapshot.generated_at;
 snapshot.project.title='<b>QA</b> 단계 & __CORTHEX_VIEW_DATA__ 합성 가게';
 snapshot.stages["02-prd"]={name:"PRD",human:"notion",truth:"source",source:"docs/qa-prd.md",source_state:"found",read:true,files:1,items:450,parts:{sample:{state:"in_progress",checkpoints:[{date:"2026-11-07",by:"Synthetic reviewer",approved:"Synthetic first draft"}],next:"Review the synthetic requirements",updated:time}}};
 snapshot.stages["03-user-flow"]={name:"User flow",human:"notion",truth:"source",source:"docs/qa-flow/",source_state:"missing",read:false,files:0,items:0,parts:{sample:{state:"not_started",checkpoints:[],next:"",updated:time}}};
 const priorities=["Must","Should","Could","Won't"],statuses=["approved","draft","review"];
 const sentence=i=>i%5===4?`합성 구매자가 결제를 다시 시도하면 가게는 그 시도와 결과를 빠짐없이 기록해야 한다 (${i+1})`:`When a synthetic buyer places order ${i+1}, the shop shall record the order and tell the buyer what happens next.`;
 snapshot.items=[
  {id:"CTX-001",kind:"context",stage:"01-domain",where,title:"Ordering"},{id:"CTX-002",kind:"context",stage:"01-domain",where,title:"Payment"},
  ...Array.from({length:450},(_,i)=>({id:"REQ-"+String(i+1).padStart(3,"0"),kind:"requirement",stage:"02-prd",where,title:sentence(i),priority:priorities[i%4],status:statuses[i%3],links:i%10===9?[]:[i%2?"CTX-002":"CTX-001"]})),
  {id:"TBL-001",kind:"table",stage:"05-erd",where,title:"orders",links:["CTX-001"]},{id:"TBL-002",kind:"table",stage:"05-erd",where,title:"payments",links:["CTX-002"]},
 ];
 snapshot.summary={...snapshot.summary,items:snapshot.items.length};
 await call("POST","/api/snapshots",snapshot,"agent");
 const said=async(item,text,kind="user",extra={},stage="02-prd")=>(await call("POST",base+"/comments",{part:"sample",stage,item,text,...extra},kind)).id;
 stageQa.talk=await said("REQ-002","Synthetic question: should the record keep the buyer's note?");
 stageQa.asks=await said("REQ-003","Synthetic question for the user: is a retry its own requirement?","agent",{asks:"answer"});
 stageQa.last=await said("REQ-450","Synthetic comment on the last requirement");
 // Proposals and so reflections are only on pictured stages: an open one on TBL-001 and one
 // accepted on TBL-002, whose edit waits for the agent.
 stageQa.erd=await said("TBL-001","Synthetic comment on a pictured stage","user",{},"05-erd");
 const proposal=change=>call("POST",base+"/proposals",{part:"sample",stage:"05-erd",items:[change[0]],reason:"Synthetic "+change[1],change:"Describe the synthetic constraint.",source_text:"CREATE UNIQUE INDEX orders_reference ON orders(reference);"},"agent");
 stageQa.proposal=(await proposal(["TBL-001","proposal"])).id;
 const reflected=await proposal(["TBL-002","reflection"]);
 stageQa.edit=(await call("POST",base+"/proposals/"+reflected.id+"/accept",{})).edit.id;
 stageQa.checkpoint=(await call("POST",base+"/checkpoints",{part:"sample",stage:"02-prd",words:"Synthetic checkpoint that waits for its record"})).id;
 stageQa.pushAgain=async()=>{snapshot.generated_at=new Date(Math.max(Date.now(),Date.parse(snapshot.generated_at)+1000)).toISOString();return call("POST","/api/snapshots",snapshot,"agent");};
 const quiet=viewSnapshot("qa-stage-unrecorded");
 for(const stage of Object.values(quiet.stages))stage.parts.sample.state="unknown";
 await call("POST","/api/snapshots",quiet,"agent");
 Object.assign(stageQa,{project,part:"sample",unrecorded:quiet.project.name,title:snapshot.project.title});
}
// The picture stage (TASK-275): a project whose three pictures carry talk, a proposal and an
// accepted reflection, so that their marks show; and a second one whose ERD was left out for
// its size, whose DDD board is no longer current and whose sitemap holds 320 screens
// (SCR-112#empty, #stale and #large). Only the picture suite opts in.
const pictureQa={};
if(process.env.NEXUS_QA_PICTURE==="1"){
 const project="qa-picture",base="/api/spaces/"+project,snapshot=viewSnapshot(project),where="docs/qa-sample.md:1";
 snapshot.items=[
  {id:"CTX-001",kind:"context",stage:"01-domain",where,title:"Ordering"},
  {id:"TBL-001",kind:"table",stage:"05-erd",where,title:"orders",links:["CTX-001"]},{id:"TBL-002",kind:"table",stage:"05-erd",where,title:"payments",links:["CTX-001"]},
  {id:"SCR-001",kind:"screen",stage:"07-sitemap",where,title:"Home",links:["CTX-001"]},{id:"SCR-002",kind:"screen",stage:"07-sitemap",where,title:"Orders",links:["CTX-001"]},
 ];
 snapshot.summary={...snapshot.summary,items:snapshot.items.length};
 await call("POST","/api/snapshots",snapshot,"agent");
 const said=async(item,stage,text)=>(await call("POST",base+"/comments",{part:"sample",stage,item,text})).id;
 pictureQa.erd=await said("TBL-001","05-erd","Synthetic comment on a table");
 pictureQa.domain=await said("CTX-001","01-domain","Synthetic comment on a context");
 const proposal=(item,reason)=>call("POST",base+"/proposals",{part:"sample",stage:"05-erd",items:[item],reason:"Synthetic "+reason,change:"Describe the synthetic constraint.",source_text:"CREATE UNIQUE INDEX orders_reference ON orders(reference);"},"agent");
 pictureQa.proposal=(await proposal("TBL-001","proposal")).id;
 const reflected=await proposal("TBL-002","reflection");
 pictureQa.edit=(await call("POST",base+"/proposals/"+reflected.id+"/accept",{})).edit.id;
 const states=viewSnapshot("qa-picture-states"),sitemap=states.pictures.find(p=>p.stage==="07-sitemap"),[root,child]=sitemap.source.screens;
 sitemap.source.screens=Array.from({length:320},(_,i)=>({...(i===0?root:child),id:"SCR-"+String(i+1).padStart(3,"0"),context:"",name:"Synthetic screen "+(i+1),path:i===0?"/":"/qa-"+i}));
 states.pictures=states.pictures.filter(p=>p.stage!=="05-erd");states.left_out=[{part:"sample",stage:"05-erd",why:"size"}];
 await call("POST","/api/snapshots",states,"agent");
 // The second push leaves the DDD board out: the server keeps it, as not current.
 states.pictures=states.pictures.filter(p=>p.stage!=="01-domain");states.generated_at=new Date(Date.parse(states.generated_at)+1000).toISOString();
 await call("POST","/api/snapshots",states,"agent");
 Object.assign(pictureQa,{project,part:"sample",states:states.project.name});
}
const server=createServer(async(incoming,outgoing)=>{try{
 reloadBuild();
 const url=new URL(incoming.url,"http://127.0.0.1"),headers=new Headers(incoming.headers);headers.set("Cf-Access-Jwt-Assertion",access.headers()["Cf-Access-Jwt-Assertion"]);
 if(url.pathname==="/__qa/receipts"){outgoing.writeHead(200,{"Content-Type":"application/json"});outgoing.end(JSON.stringify({writes,comment:comment.id,proposal:proposal.id,erdComment:erdComment.id,erdProposal:erdProposal.id,edit:accepted.edit.id,linked,...(process.env.NEXUS_QA_LATE_SCREEN==="1"?{lateScreen}:{}),...(process.env.NEXUS_QA_PAGES==="1"?{pages}:{}),...(process.env.NEXUS_QA_HOME==="1"?{home}:{}),...(process.env.NEXUS_QA_STAGE==="1"?{stage:stageQa}:{}),...(process.env.NEXUS_QA_PICTURE==="1"?{picture:pictureQa}:{}),...(process.env.NEXUS_QA_HUB_VIEWS==="1"?{hubViews}:{})}));return;}
 const pushAgain=home.pushAgain||stageQa.pushAgain;
 if(url.pathname==="/__qa/push-again"&&incoming.method==="POST"&&pushAgain){const pushed=await pushAgain();outgoing.writeHead(200,{"Content-Type":"application/json"});outgoing.end(JSON.stringify({name:pushed.name,revision:pushed.revision}));return;}
 const chunks=[];for await(const chunk of incoming)chunks.push(chunk);const bytes=Buffer.concat(chunks);
 if(incoming.method==="POST")writes.push({path:url.pathname,id:incoming.headers["idempotency-key"],body:JSON.parse(bytes)});
 const space=/(?:^|;\s*)nexus-qa-space=(quiet|empty)(?:;|$)/.exec(incoming.headers.cookie||"")?.[1];
 const currentEnv={...(space&&spaces[space]?spaces[space]:env),NEXUS_LANGUAGE:url.searchParams.get("lang")==="ko"?"ko":"en"};
 const response=await handle(new Request("http://"+incoming.headers.host+incoming.url,{method:incoming.method,headers,...(["GET","HEAD"].includes(incoming.method)?{}:{body:bytes})}),currentEnv,access.ctx,template,views);
 outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
 }catch{outgoing.writeHead(500);outgoing.end("Synthetic fixture failed");}});
server.listen(0,"127.0.0.1",()=>process.stdout.write(JSON.stringify({origin:"http://127.0.0.1:"+server.address().port,project:"qa-views",comment:comment.id,proposal:proposal.id})+"\n"));
if(!process.argv.includes("--keep-open")){process.stdin.resume();process.stdin.on("end",()=>server.close(()=>process.exit(0)));}
