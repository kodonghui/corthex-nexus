// Synthetic, local-only browser fixtures. No repository is scanned or uploaded.
// Screen headings contain the declared ID and title, independently of the DOM.
export function viewItemHeading(id){
 const pictures=viewSnapshot().pictures;
 for(const {source}of pictures){
  const rows=[...(source.contexts||[]),...(source.aggregates||[]),...(source.read_models||[]),...(source.tables||[]),...(source.screens||[])];
  const row=rows.find(value=>(value.id||value.term)===id);
  if(row)return id+" "+row.name;
 }
 throw new Error("Unknown synthetic fixture item: "+id);
}
export function viewSnapshot(name="qa-views"){
 const commit="a".repeat(40),time=new Date().toISOString(),where="docs/qa-sample.md:1";
 const term=(name,context,term)=>({name,context,term,removed:false,where});
 const rows=[{given_by:"Buyer",policy:false,read_model:"Orders",command:"Place order",aggregate:"Order",events:["Order placed"],where},{given_by:"Policy: when Order placed",policy:true,read_model:"Orders",command:"Request payment",aggregate:"Order",events:["Payment requested"],where}];
 const domain={format:1,contexts:[{id:"CTX-001",name:"Ordering",type:"core",purpose:"Take an order",removed:false,external:"Payment provider",rows,where}],aggregates:[term("Order","CTX-001","TERM-001")],read_models:[term("Orders","CTX-001","TERM-002")],dependencies:[],hotspots:[{number:1,text:"Can a payment be retried?",contexts:["CTX-001"],state:"open",answer:"",where}],timeline:[{lane:"Buy an item",places:[["Order placed"],["Payment requested"]],where}]};
 const column=(name,type="INTEGER",nullable=false)=>({name,type,null:nullable,where});
 const erd={format:1,tables:[{id:"TBL-001",name:"orders",context:"CTX-001",terms:["TERM-001"],removed:false,columns:[column("id"),column("reference","TEXT")],primary_key:["id"],unique:[{columns:["reference"],partial:false}],foreign_keys:[],where},{id:"TBL-002",name:"payments",context:"CTX-002",terms:[],removed:false,columns:[column("id"),column("order_id"),column("amount","NUMERIC(12,2)")],primary_key:["id"],unique:[],foreign_keys:[{columns:["order_id"],table:"orders",references:["id"],on_delete:"cascade",where}],where}],without_table:["TERM-002"]};
 const sitemap={format:1,screens:[{id:"SCR-001",name:"Home",path:"/",access:"user",flows:["FL-001"],context:"CTX-001",terms:[],removed:false,where},{id:"SCR-002",name:"Orders",path:"/orders",access:"user",flows:["FL-001"],parent:0,context:"CTX-001",terms:["TERM-002"],removed:false,where},{id:"",name:"Help",path:"/help",access:"anyone",flows:[],parent:0,context:"",terms:[],removed:false,where}],without_screen:[]};
 const stages={};for(const [key,title]of[["01-domain","Domain"],["05-erd","ERD"],["07-sitemap","Sitemap"],["04-functional-spec","Specification"]])stages[key]={name:title,human:"notion",truth:"source",source:"docs/qa/",source_state:"found",read:true,files:1,items:1,parts:{sample:{state:"in_progress",checkpoints:[],next:"Review the synthetic sample",updated:time}}};
 return{schema:"corthex-hub/0.2",generator:"corthex-nexus 0.2.0",generated_at:time,project:{name,title:"QA synthetic shop",team:false,language:"en",records:{kind:"notion"},parts:["sample"]},ids:{CTX:"context",TERM:"term",TBL:"table",SCR:"screen",FL:"flow"},repos:{".":{commit,branch:"main",dirty:false,web:"https://github.com/example/qa-shop",url:"https://github.com/example/qa-shop",default:{branch:"main",commit,time}}},records:{from:"repository",commit,time},stages,items:[],checks:[],summary:{items:0,kinds:{},checks:{error:0,warn:0,info:0},states:{in_progress:4}},truncated:false,pictures:[["01-domain",domain],["05-erd",erd],["07-sitemap",sitemap]].map(([stage,source])=>({part:"sample",stage,commit,time,source})),left_out:[],ask_before:{entries:["external messages","deploys","payments","deletions","publishing"],source:"default",left_out:[]}};
}
// TC-1766 (TASK-281): the hub page's three views need items to find, trace and list. The same
// synthetic snapshot goes to the server and into the file that the pinned hub builds on a device.
export function hubSnapshot(name="qa-hub"){
 const snapshot=viewSnapshot(name),where="docs/qa-prd.md:1";
 snapshot.project.title="QA hub views";
 snapshot.ids.REQ="requirement";
 snapshot.stages["02-prd"]={name:"PRD",human:"notion",truth:"source",source:"docs/qa-prd.md",source_state:"found",read:true,files:1,items:2,parts:{sample:{state:"in_progress",checkpoints:[],next:"Review the synthetic requirements",updated:snapshot.generated_at}}};
 snapshot.items=[
  {id:"CTX-001",kind:"context",stage:"01-domain",where,title:"Ordering"},
  {id:"REQ-001",kind:"requirement",stage:"02-prd",where,title:"Record each synthetic order",links:["CTX-001"]},
  {id:"REQ-002",kind:"requirement",stage:"02-prd",where,title:"Retry the payment of a synthetic order",links:["CTX-001"]},
  {id:"TBL-001",kind:"table",stage:"05-erd",where,title:"orders",links:["REQ-001"]},
  {id:"SCR-001",kind:"screen",stage:"07-sitemap",where,title:"Orders",links:["REQ-001","TBL-001"]},
 ];
 snapshot.summary={...snapshot.summary,items:snapshot.items.length,kinds:{context:1,requirement:2,table:1,screen:1},states:{in_progress:5}};
 return snapshot;
}
