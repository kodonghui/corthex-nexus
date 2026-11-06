// Local QA server with synthetic Access and in-memory SQLite. Never deploy.
import {readFileSync,statSync}from"node:fs";
import {createServer}from"node:http";
import {handle}from"../src/app.js";
import {createViews}from"../src/views.js";
import {fakeD1}from"./fake-d1.js";
import {testAccess}from"./access-fixture.js";
import {viewSnapshot}from"./view-fixtures.js";
const access=await testAccess(),env={...access.env,DB:fakeD1(),NEXUS_LANGUAGE:"en"},template=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8"),folder=new URL("../src/view-code/",import.meta.url),manifestFile=new URL("sizes.json",folder),code={};
let stamp=0,views;function reloadBuild(){const next=statSync(manifestFile).mtimeMs;if(next===stamp)return;const manifest=JSON.parse(readFileSync(manifestFile));for(const f of manifest.files)code[f.name]={type:f.type,body:readFileSync(new URL(f.path,folder))};views=createViews(code,manifest.entries);stamp=next;}reloadBuild();
let sequence=0;const writes=[];
async function call(method,path,body,kind="user"){
 const headers={...access.headers(kind),"Content-Type":"application/json","Nexus-Session":"qa-fixture","Idempotency-Key":JSON.stringify("nw_"+(++sequence).toString(16).padStart(12,"0"))};
 const response=await handle(new Request("http://127.0.0.1"+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),env,access.ctx,template,views);const data=await response.json();if(!response.ok)throw new Error(JSON.stringify(data));return data;
}
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
const server=createServer(async(incoming,outgoing)=>{try{
 reloadBuild();
 const url=new URL(incoming.url,"http://127.0.0.1"),headers=new Headers(incoming.headers);headers.set("Cf-Access-Jwt-Assertion",access.headers()["Cf-Access-Jwt-Assertion"]);
 if(url.pathname==="/__qa/receipts"){outgoing.writeHead(200,{"Content-Type":"application/json"});outgoing.end(JSON.stringify({writes,comment:comment.id,proposal:proposal.id,erdComment:erdComment.id,erdProposal:erdProposal.id,edit:accepted.edit.id,linked,...(process.env.NEXUS_QA_LATE_SCREEN==="1"?{lateScreen}:{})}));return;}
 const chunks=[];for await(const chunk of incoming)chunks.push(chunk);const bytes=Buffer.concat(chunks);
 if(incoming.method==="POST")writes.push({path:url.pathname,id:incoming.headers["idempotency-key"],body:JSON.parse(bytes)});
 const currentEnv={...env,NEXUS_LANGUAGE:url.searchParams.get("lang")==="ko"?"ko":"en"};
 const response=await handle(new Request("http://"+incoming.headers.host+incoming.url,{method:incoming.method,headers,...(["GET","HEAD"].includes(incoming.method)?{}:{body:bytes})}),currentEnv,access.ctx,template,views);
 outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
 }catch{outgoing.writeHead(500);outgoing.end("Synthetic fixture failed");}});
server.listen(0,"127.0.0.1",()=>process.stdout.write(JSON.stringify({origin:"http://127.0.0.1:"+server.address().port,project:"qa-views",comment:comment.id,proposal:proposal.id})+"\n"));
if(!process.argv.includes("--keep-open")){process.stdin.resume();process.stdin.on("end",()=>server.close(()=>process.exit(0)));}
