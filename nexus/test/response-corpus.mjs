// Offline actual-handler responses for the external OpenAPI schema check.
// No network or real credentials. stdout is synthetic JSON only.
import { readFileSync } from "node:fs";
import { handle } from "../src/app.js";
import { fakeD1 } from "./fake-d1.js";
import { testAccess } from "./access-fixture.js";

const access=await testAccess(),env={...access.env,DB:fakeD1(),NEXUS_LANGUAGE:"en"};
const template=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8");
let serial=0;
async function call(method,path,body,kind="agent") {
  const headers={...access.headers(kind),"Nexus-Session":"qa-offline-contract"};
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
await call("POST","/api/spaces/corthex/checkpoints",{part:"nexus",stage:"02-prd"},"user");
const agentRead=await call("GET","/api/spaces/corthex/todo"),userRead=await call("GET","/api/spaces/corthex/todo",undefined,"user");
if(!agentRead.read_at||userRead.read_at!==null||!agentRead.comments.total||!agentRead.reflections.total||agentRead.checkpoints.total<2)throw new Error("an answer to API-113 lacks what its case needs");
cases.push({name:"agent to-do read by the agent",schema:"Todo",value:agentRead},{name:"agent to-do read by the user",schema:"Todo",value:userRead});
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
// The stage page of a project that only a hub of 0.1 pushed, which has no space.
await call("POST","/api/snapshots",{schema:"corthex-hub/0.1",generated_at:"2026-01-12T10:00:00+09:00",project:{name:"legacy-shop",title:"Legacy shop"},
  stages:{"02-prd":{source_state:"found",read:true,state:"in_progress",next:"Write the PRD"}},summary:{items:1},
  items:[{id:"REQ-001",kind:"requirement",stage:"02-prd",title:"Send an order confirmation",priority:"Must"}],checks:[]});
const legacy=pageData(await call("GET","/p/legacy-shop/_/02-prd"));
if(legacy.talk||legacy.problem?.code!=="space_not_found")throw new Error("the page of a project without a space lacks what its case needs");
cases.push({name:"stage page without a space",schema:"StagePageData",value:legacy});
process.stdout.write(JSON.stringify(cases));
