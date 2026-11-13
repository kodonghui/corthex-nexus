// Offline actual-handler responses for the external OpenAPI schema check.
// No network or real credentials. stdout is synthetic JSON only.
import { readFileSync } from "node:fs";
import { handle } from "../src/app.js";
import { fakeD1 } from "./fake-d1.js";
import { testAccess } from "./access-fixture.js";

const access=await testAccess(),env={...access.env,DB:fakeD1(),NEXUS_LANGUAGE:"en"};
const template=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8");
let serial=0;
async function call(method,path,body,kind="agent",extra={}) {
  const headers={...extra,...access.headers(kind),"Nexus-Session":"qa-offline-contract"};
  if(method==="POST")headers["Idempotency-Key"]='"nw_'+(++serial).toString().padStart(12,"0")+'"';
  if(body!==undefined)headers["Content-Type"]="application/json";
  const response=await handle(new Request("https://nexus.example.com"+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})}),env,access.ctx,template);
  const text=await response.text();
  if(response.status>=400)throw new Error("offline corpus request failed: "+response.status+" "+path);
  return response.headers.get("Content-Type").includes("json")?JSON.parse(text):text;
}
const cases=[];
// The data that a page holds in its script block view-data.
const pageData=(page)=>JSON.parse(page.match(/<script id="view-data" type="application\/json">(.*?)<\/script>/s)[1]);
// The first page of a server that holds no snapshot yet, as its data and as the page.
cases.push({name:"empty server home",schema:"Home",value:await call("GET","/api/home")});
cases.push({name:"empty server first page",schema:"HomePageData",value:pageData(await call("GET","/"))});
const snapshot=JSON.parse(readFileSync(new URL("./snapshot-02-example.json",import.meta.url),"utf8"));
snapshot.project.parts.push("constructor");
// The context and the items that TBL-111 comes from and leads to, for its trace.
snapshot.ids={...snapshot.ids,CTX:"context",SPEC:"spec",API:"api"};
snapshot.items.push({id:"CTX-007",kind:"context",stage:"01-domain",where:"docs/01-domain/nexus.md:40",title:"Stage progress"},
  {id:"SPEC-136",kind:"spec",stage:"04-functional-spec",where:"docs/04-functional-spec/nexus.md:90",title:"Claim what the agent takes",links:["CTX-007"]},
  {id:"API-131",kind:"api",stage:"06-api",where:"docs/06-api/nexus.openapi.yaml:900",title:"claimEntry",links:["TBL-111","SPEC-136"]});
snapshot.summary={...snapshot.summary,items:snapshot.items.length};
await call("POST","/api/snapshots",snapshot);
// A stage's page with its picture, a pictured stage whose part has no picture,
// and a stage without pictures, for the project as a whole.
for(const [path,check] of [["/p/corthex/nexus/05-erd",(value)=>value.picture&&!value.problem],["/p/corthex/constructor/05-erd",(value)=>!value.picture&&value.problem?.code==="picture_not_found"],
  ["/p/corthex/_/02-prd",(value)=>!value.picture&&!value.problem&&value.talk]]){
  const value=pageData(await call("GET",path));
  if(!check(value))throw new Error("the stage page lacks what its case needs: "+path);
  cases.push({name:path,schema:"StagePageData",value});
}
cases.push({name:"constructor part overview",schema:"Overview",value:await call("GET","/api/spaces/corthex/overview/constructor/05-erd")});
for(const path of ["/api/spaces/corthex/stages/nexus/05-erd","/api/spaces/corthex/stages/_/02-prd?group=source&filter=left&q=claims","/api/spaces/corthex/stages/constructor/01-domain"])
  cases.push({name:path,schema:"StageData",value:await call("GET",path)});
for(const path of ["/api/spaces/corthex/talk/nexus/05-erd","/api/spaces/corthex/talk/_/02-prd?closed=1"])
  cases.push({name:path,schema:"StageTalk",value:await call("GET",path)});
const comment=await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"TBL-111",text:"Synthetic history"});
for(let index=0;index<501;index++){
  const proposal=await call("POST","/api/spaces/corthex/proposals",{part:"nexus",stage:"05-erd",items:["TBL-111"],reason:"Synthetic",change:"Synthetic",comment:comment.id});
  await call("POST","/api/spaces/corthex/proposals/"+proposal.id+"/withdraw",{});
}
const history=await call("GET","/api/spaces/corthex/comments/"+comment.id);
if(history.proposals.length!==501)throw new Error("history was truncated");
cases.push({name:"501 historical proposals",schema:"CommentThread",value:history});
cases.push({name:"stage with talk",schema:"StageData",value:await call("GET","/api/spaces/corthex/stages/nexus/05-erd?filter=talk")});
// The talk by turn: the agent's turn with a claim, my turn, a comment apart, a
// claimed reflection and the closed talk, whole and narrowed to the item.
const question=await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"TBL-111",text:"Synthetic question"},"user");
await call("POST","/api/spaces/corthex/claims/"+question.id,{});
const asking=await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"",text:"Synthetic checkpoint",asks:"checkpoint",look_first:"TBL-111"});
await call("POST","/api/spaces/corthex/proposals",{part:"nexus",stage:"05-erd",items:["TBL-111"],reason:"Synthetic",change:"Synthetic"});
await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"TBL-109",text:"Synthetic gone item"},"user");
const answered=await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"TBL-111",text:"Synthetic answered"},"user");
await call("POST","/api/spaces/corthex/comments/"+answered.id+"/answered",{});
const accepted=await call("POST","/api/spaces/corthex/proposals",{part:"nexus",stage:"05-erd",items:["TBL-111"],reason:"Synthetic",change:"Synthetic"});
const reflection=(await call("POST","/api/spaces/corthex/proposals/"+accepted.id+"/accept",{},"user")).edit;
await call("POST","/api/spaces/corthex/claims/"+reflection.id,{});
for(const path of ["/api/spaces/corthex/talk/nexus/05-erd?closed=1","/api/spaces/corthex/talk/nexus/05-erd?item=TBL-111&closed=1&after=500"]){
  const value=await call("GET",path);
  if(!value.agent.entries[0]?.claim?.claimed_at||!value.mine.total||!value.closed.entries.length||!value.reflections[0]?.claim)throw new Error("the talk lacks an entry that its case needs: "+path);
  cases.push({name:path,schema:"StageTalk",value});
}
// One item with its links and its talk, in the project's first part and in
// the part that holds the talk; the search by ID, by words and with no match.
for(const path of ["/api/spaces/corthex/items/TBL-111","/api/spaces/corthex/items/TBL-111?part=nexus"]){
  const value=await call("GET",path);
  if(!value.context||!value.source?.link||!value.trace.from.length||!value.trace.to.length)throw new Error("the item lacks a part that its case needs: "+path);
  if(path.endsWith("nexus")&&(!value.comments.agent.entries.length||!value.comments.mine.total||!value.comments.reflections.length))throw new Error("the item's talk lacks an entry that its case needs");
  cases.push({name:path,schema:"ItemData",value});
}
for(const path of ["/api/search?q=TBL-111","/api/search?q=claim","/api/search?q=settles%20twice"])
  cases.push({name:path,schema:"SearchAnswer",value:await call("GET",path)});
// The first page with my turn, the agent's to-do with a claim and the card's
// picture with its drawing.
const home=await call("GET","/api/home");
if(!home.my_turn.entries.some((entry)=>entry.kind==="proposal")||!home.my_turn.entries.some((entry)=>entry.asks==="checkpoint")||!home.agent[0]?.comments.oldest
  ||!home.agent[0].taken||!home.projects[0]?.pictures[0]?.drawing?.boxes.length)throw new Error("the first page lacks an entry that its case needs");
cases.push({name:"/api/home",schema:"Home",value:home});
cases.push({name:"first page",schema:"HomePageData",value:pageData(await call("GET","/"))});
// Taking the agent's recommendation: a checkpoint passed with the reply, the
// same taken again, a recommendation without a checkpoint, and the checkpoint
// that names its comment.
const taken=await call("POST","/api/spaces/corthex/comments/"+asking.id+"/recommended",{},"user");
const again=await call("POST","/api/spaces/corthex/comments/"+asking.id+"/recommended",{},"user");
const offered=await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"TBL-111",text:"Synthetic recommendation",asks:"recommended"});
const replied=await call("POST","/api/spaces/corthex/comments/"+offered.id+"/recommended",{},"user");
if(!taken.checkpoint?.comment||again.changed||replied.checkpoint)throw new Error("an answer to API-159 lacks what its case needs");
for(const [name,value] of [["checkpoint taken as recommended",taken],["recommendation taken already",again],["recommendation taken",replied]])
  cases.push({name,schema:"RecommendationAnswer",value});
cases.push({name:"checkpoint that names its comment",schema:"Checkpoint",value:await call("GET","/api/spaces/corthex/checkpoints/"+taken.checkpoint.id)});
// The agent to-do read with the service token, which records the read and names
// its time, and under the user's own sign-in, which records nothing and names
// null (API-113, SPEC-187): comments, a reflection and two checkpoints wait.
// A pass names the commit that the page showed (TASK-301, SPEC-194).
const heldCommit=snapshot.repos["."].default.commit;
await call("POST","/api/spaces/corthex/checkpoints",{part:"nexus",stage:"02-prd",commit:heldCommit},"user");
const agentRead=await call("GET","/api/spaces/corthex/todo"),userRead=await call("GET","/api/spaces/corthex/todo",undefined,"user");
if(!agentRead.read_at||userRead.read_at!==null||!agentRead.comments.total||!agentRead.reflections.total||agentRead.checkpoints.total<2)throw new Error("an answer to API-113 lacks what its case needs");
cases.push({name:"agent to-do read by the agent",schema:"Todo",value:agentRead},{name:"agent to-do read by the user",schema:"Todo",value:userRead});
// The agent's last read and what it has not read since (TASK-298, SPEC-188,
// SPEC-189): the user's comment after the read waits for the agent, not read
// yet, in the first page's counts, the stage's head and the talk, where the
// claimed question shows as taken without the mark.
const unreadComment=await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"TBL-111",text:"Synthetic: written after the read"},"user");
const homeRead=await call("GET","/api/home"),stageRead=await call("GET","/api/spaces/corthex/stages/nexus/05-erd"),talkRead=await call("GET","/api/spaces/corthex/talk/nexus/05-erd");
if(homeRead.agent[0].read_at!==agentRead.read_at||!homeRead.agent[0].unread||!(homeRead.agent[0].unread_since>=agentRead.read_at)
  ||stageRead.project.read_at!==agentRead.read_at||stageRead.project.unread_since!==homeRead.agent[0].unread_since
  ||!talkRead.agent.entries.some((entry)=>entry.id===unreadComment.id&&entry.unread)||!talkRead.agent.entries.some((entry)=>entry.claim&&!entry.unread))
  throw new Error("the agent's last read lacks what its case needs");
cases.push({name:"/api/home after the agent's read",schema:"Home",value:homeRead},{name:"stage after the agent's read",schema:"StageData",value:stageRead},
  {name:"talk with an entry that the agent has not read",schema:"StageTalk",value:talkRead});
// Checkpoint requests in their form (TASK-297, SPEC-197): the request that
// names an item of the stored snapshot, one that names an https address on
// another part's stage, and the agent's reply that asks again on the first
// once the user took it, which names what to look at first. The user's
// comment and the user's reply name nothing to look at first.
const linked=await call("POST","/api/spaces/corthex/comments",{part:"memory",stage:"09-mockup",item:"",text:"Synthetic request\nOpen the address first.",asks:"checkpoint",look_first:"https://mockups.example.com/memory"});
const askedAgain=await call("POST","/api/spaces/corthex/comments/"+asking.id+"/replies",{text:"Synthetic: the rows changed since; pass again?",asks:"checkpoint",look_first:"SPEC-136"});
const userReply=await call("POST","/api/spaces/corthex/comments/"+linked.id+"/replies",{text:"Synthetic: not yet."},"user");
if(asking.look_first!=="TBL-111"||linked.look_first!=="https://mockups.example.com/memory"||askedAgain.reply.look_first!=="SPEC-136"||askedAgain.comment.asks!=="checkpoint"
  ||question.author!=="user"||question.look_first!==null||userReply.reply.author!=="user"||userReply.reply.look_first!==null||userReply.comment.asks!==null)
  throw new Error("a checkpoint request lacks what its case needs");
cases.push({name:"the user's comment",schema:"Comment",value:question},{name:"checkpoint request that names an item",schema:"Comment",value:asking},
  {name:"checkpoint request that names an address",schema:"Comment",value:linked},{name:"the user's reply",schema:"ReplyAnswer",value:userReply},
  {name:"reply that asks for the checkpoint again",schema:"ReplyAnswer",value:askedAgain});
// The kind of browser and device of a pass (TASK-299, SPEC-195): a pass from Safari on a phone
// whose page says that no software drives the browser, the stage whose record holds it, and its
// withdrawal, each with the three. The pass answers the stage's open request, which the agent
// asked again, with the commit, the request and the place of its last entry (TASK-301,
// SPEC-194), and settles it.
const kindPass=await call("POST","/api/spaces/corthex/checkpoints",{part:"nexus",stage:"05-erd",commit:heldCommit,comment:asking.id,entry:askedAgain.reply.seq,driven:false},"user",
  {"User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"});
const kindStage=await call("GET","/api/spaces/corthex/stages/nexus/05-erd");
const settled=await call("GET","/api/spaces/corthex/comments/"+asking.id);
const kindWithdrawn=await call("POST","/api/spaces/corthex/checkpoints/"+kindPass.id+"/withdraw",{},"user");
if(kindPass.browser!=="safari"||kindPass.device!=="phone"||kindPass.driven!==false||!kindStage.record.checkpoints.some((entry)=>entry.id===kindPass.id&&entry.browser==="safari")
  ||kindWithdrawn.checkpoint.device!=="phone")throw new Error("a pass's kind of browser and device lacks what its case needs");
if(kindPass.commit!==heldCommit||kindPass.revision!==null||kindPass.comment!==asking.id||kindPass.entry!==askedAgain.reply.seq||settled.asks!==null||settled.waits!=="agent"||!settled.settled)
  throw new Error("a pass that answers a request lacks what its case needs");
cases.push({name:"pass from Safari on a phone that answers a request",schema:"Checkpoint",value:kindPass},{name:"stage whose record holds a pass's kind",schema:"StageData",value:kindStage},
  {name:"request settled by the pass",schema:"CommentThread",value:settled},{name:"withdrawal that names the pass's kind",schema:"CheckpointAnswer",value:kindWithdrawn});
// A project whose snapshot names no commit, as from a device without Git: its stage names the
// snapshot's revision, and a pass names that revision in the commit's place (SPEC-194).
await call("POST","/api/snapshots",{...snapshot,project:{...snapshot.project,name:"acme-shop",title:"Acme shop"},repos:{},replaces:undefined,
  records:{from:"status-file"},pictures:[],left_out:[]});
const noCommit=await call("GET","/api/spaces/acme-shop/stages/_/02-prd");
const revisionPass=await call("POST","/api/spaces/acme-shop/checkpoints",{part:"",stage:"02-prd",words:"Synthetic: the requirements as drafted.",revision:noCommit.project.revision},"user");
if(noCommit.project.commit!==null||noCommit.project.revision!==1||revisionPass.commit!==null||revisionPass.revision!==1||revisionPass.comment!==null||revisionPass.entry!==null)
  throw new Error("a pass on a snapshot that names no commit lacks what its case needs");
cases.push({name:"stage of a snapshot that names no commit",schema:"StageData",value:noCommit},{name:"pass that names the revision",schema:"Checkpoint",value:revisionPass});
// The pass's refusals that name what changed (SPEC-194), as Problem documents with their
// members: another commit, a newer snapshot of a project without one, and the stage's
// open checkpoint request with the place of its last entry.
async function refusal(path,body,status,code){
  const headers={...access.headers("user"),"Idempotency-Key":'"nw_'+(++serial).toString().padStart(12,"0")+'"',"Content-Type":"application/json"};
  const original=console.error;
  console.error=()=>{};
  try{
    const response=await handle(new Request("https://nexus.example.com"+path,{method:"POST",headers,body:JSON.stringify(body)}),env,access.ctx,template);
    const value=JSON.parse(await response.text());
    if(response.status!==status||value.code!==code)throw new Error("offline corpus refusal differs: "+response.status+" "+path);
    return value;
  }finally{console.error=original;}
}
const apiRequest=await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"06-api",item:"",text:"Synthetic: the contract is ready for its checkpoint.",asks:"checkpoint",look_first:"TBL-111"});
const afterPush=await refusal("/api/spaces/corthex/checkpoints",{part:"nexus",stage:"02-prd",commit:"b".repeat(40)},409,"snapshot_changed");
const afterRevision=await refusal("/api/spaces/acme-shop/checkpoints",{part:"",stage:"03-user-flow",revision:2},409,"snapshot_changed");
const unnamed=await refusal("/api/spaces/corthex/checkpoints",{part:"nexus",stage:"06-api",commit:heldCommit},409,"request_changed");
if(afterPush.held_commit!==heldCommit||afterRevision.revision!==1||unnamed.comment!==apiRequest.id||unnamed.entry!==0)
  throw new Error("a pass's refusal lacks what its case needs");
cases.push({name:"pass after a push",schema:"Problem",value:afterPush},{name:"pass after a newer snapshot without a commit",schema:"Problem",value:afterRevision},
  {name:"pass that names no request while one is open",schema:"Problem",value:unnamed});
// The stage page of a project that only a hub of 0.1 pushed, which has no space.
await call("POST","/api/snapshots",{schema:"corthex-hub/0.1",generated_at:"2026-01-12T10:00:00+09:00",project:{name:"legacy-shop",title:"Legacy shop"},
  stages:{"02-prd":{source_state:"found",read:true,state:"in_progress",next:"Write the PRD"}},summary:{items:1},
  items:[{id:"REQ-001",kind:"requirement",stage:"02-prd",title:"Send an order confirmation",priority:"Must"}],checks:[]});
const legacy=pageData(await call("GET","/p/legacy-shop/_/02-prd"));
if(legacy.talk||legacy.problem?.code!=="space_not_found")throw new Error("the page of a project without a space lacks what its case needs");
cases.push({name:"stage page without a space",schema:"StagePageData",value:legacy});
process.stdout.write(JSON.stringify(cases));
