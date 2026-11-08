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
const snapshot=JSON.parse(readFileSync(new URL("./snapshot-02-example.json",import.meta.url),"utf8"));
snapshot.project.parts.push("constructor");
// The context and the items that TBL-111 comes from and leads to, for its trace.
snapshot.ids={...snapshot.ids,CTX:"context",SPEC:"spec",API:"api"};
snapshot.items.push({id:"CTX-007",kind:"context",stage:"01-domain",where:"docs/01-domain/nexus.md:40",title:"Stage progress"},
  {id:"SPEC-136",kind:"spec",stage:"04-functional-spec",where:"docs/04-functional-spec/nexus.md:90",title:"Claim what the agent takes",links:["CTX-007"]},
  {id:"API-131",kind:"api",stage:"06-api",where:"docs/06-api/nexus.openapi.yaml:900",title:"claimEntry",links:["TBL-111","SPEC-136"]});
snapshot.summary={...snapshot.summary,items:snapshot.items.length};
await call("POST","/api/snapshots",snapshot);
const cases=[];
for(const path of ["/pictures/corthex/nexus/05-erd","/overview/corthex/nexus/05-erd","/pictures/corthex/constructor/05-erd"]){
  const page=await call("GET",path);
  const value=JSON.parse(page.match(/<script id="view-data" type="application\/json">(.*?)<\/script>/s)[1]);
  cases.push({name:path,schema:"ViewPageData",value});
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
await call("POST","/api/spaces/corthex/comments",{part:"nexus",stage:"05-erd",item:"",text:"Synthetic checkpoint",asks:"checkpoint"});
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
process.stdout.write(JSON.stringify(cases));
