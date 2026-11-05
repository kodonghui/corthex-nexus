// Synthetic regression for nested DDD expansion. Real handler/Store/SQLite and
// signature verification, local certificate stub only; no real network/browser.
import test,{after} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
import {runInNewContext} from "node:vm";
import {handle,VIEW_POLICY} from "../src/app.js";
import {createViews} from "../src/views.js";
import {readSnapshot02} from "../src/snapshot02.js";
import {pictureLayout,sceneItems,MAX_PICTURE_NODES,MAX_SOURCE_ITEMS,MAX_PICTURE_WORK,MAX_PICTURE_TEXT_WORK} from "../src/layout.js";
import {INPUT_SCHEMAS} from "../src/input-schemas.js";
import * as browserLayout from "../ui/layout.js";
import {picturePreview} from "../src/preview.js";
import {words} from "../ui/messages.js";
import {NexusProblem,Drafts,PendingWrites,LatestReads,characters} from "../ui/state.js";
import {fakeD1} from "./fake-d1.js";
import {testAccess} from "./access-fixture.js";
import {viewSnapshot} from "./view-fixtures.js";

const metadata=JSON.parse(readFileSync(new URL("../src/view-code/sizes.json",import.meta.url))),css=metadata.files.find(f=>"/code/"+f.name===metadata.entries["view-css"]);
// These tests serve HTML only; native code bodies are not loaded or executed.
const views=createViews(css?{[css.name]:{type:css.type,body:readFileSync(new URL("../src/view-code/"+css.path,import.meta.url))}}:{},metadata.entries);
const hub=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8");
const originalFetch=globalThis.fetch,access=await testAccess();
after(()=>{globalThis.fetch=originalFetch;});
const domainOf=s=>s.pictures.find(p=>p.stage==="01-domain").source;
const staticHTML=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"");
const listItems=html=>{const list=html.match(/<details\b[^>]*\bid="items"[^>]*>([\s\S]*?)<\/details>/)?.[1];assert.ok(list,"the fallback keeps a real source-item list");return(list.match(/<li\b/g)||[]).length;};
function limitedHTML(html,{allowEmpty=false}={}){const body=staticHTML(html);assert.match(body,/data-preview-limited\b/);assert.doesNotMatch(body,/data-preview-complete\b|data-nexus-node=|<svg\b[^>]*data-nexus-preview/);assert.doesNotMatch(body,/data-(?:preview-ready|editor-ready|ready)="true"/,"a source list is never advertised as a complete picture");assert.ok(listItems(body)>=(allowEmpty?0:1));assert.ok(listItems(body)<=3000);return body;}

function repeatedSnapshot(name="qa-preview-limit",counts=Array(20).fill(2000)){
 const snapshot=viewSnapshot(name),source=domainOf(snapshot),context=source.contexts[0],where=context.where;
 context.external="";context.rows=[{given_by:"A",policy:false,read_model:"",command:"C",aggregate:"G",events:["E"],where}];
 source.contexts=[context];source.aggregates=[{name:"G",context:context.id,term:"TERM-001",removed:false,where}];source.read_models=[];source.dependencies=[];source.hotspots=[];
 source.timeline=counts.map((count,i)=>({lane:"lane-"+i,where,places:Array.from({length:Math.ceil(count/10)},(_,j)=>Array(Math.min(10,count-j*10)).fill("E"))}));
 return snapshot;
}
function sourceListSnapshot(){
 const snapshot=viewSnapshot("qa-preview-source-cap"),source=domainOf(snapshot),template=source.contexts[0];
 source.contexts=Array.from({length:34},(_,ci)=>({...template,id:"CTX-"+String(ci+1).padStart(3,"0"),name:"Context "+ci,purpose:"",external:"",where:"x:1",rows:Array.from({length:200},(_,ri)=>({given_by:"A",policy:false,read_model:"",command:"C",aggregate:"",events:["e"+ci+"-"+ri],where:"x:1"}))}));
 source.aggregates=[];source.read_models=[];source.dependencies=[];source.hotspots=[];delete source.timeline;
 return snapshot;
}
function normalSnapshot(){
 const snapshot=viewSnapshot("qa-preview-normal"),domain=domainOf(snapshot),context=domain.contexts[0];
 context.external="";context.rows=Array.from({length:99},(_,i)=>({given_by:"Actor "+i,policy:false,read_model:"Orders",command:"Command "+i,aggregate:"Order",events:["Event "+i],where:context.where}));
 domain.contexts=[context];domain.dependencies=[];domain.hotspots=[];delete domain.timeline;
 const erd=snapshot.pictures.find(p=>p.stage==="05-erd").source,table=erd.tables[0];
 erd.tables=Array.from({length:300},(_,i)=>({...table,id:"TBL-"+String(i+1).padStart(3,"0"),name:"table_"+i,terms:[],columns:[{name:"id",type:"INTEGER",null:false,where:table.where}],primary_key:["id"],unique:[],foreign_keys:[]}));erd.without_table=[];
 const sitemap=snapshot.pictures.find(p=>p.stage==="07-sitemap").source,screen=sitemap.screens[0];
 sitemap.screens=Array.from({length:300},(_,i)=>({...screen,id:"SCR-"+String(i+1).padStart(3,"0"),name:"Screen "+i,path:"/screen/"+i,flows:[],terms:[],...(i?{parent:0}:{})}));sitemap.without_screen=[];
 return snapshot;
}
function pageData(source,lang="en"){return{schema:"corthex-view-page/0.2",view:"picture",lang,data:{project:"qa-preview-limit",part:"sample",stage:"01-domain",picture:{source,commit:"a".repeat(40),committed_at:new Date().toISOString(),drawn_at:new Date().toISOString(),not_current:null},comments:{total:0,entries:[]},closed_comments:{total:0,entries:[]},proposals:[],reflections:[],discrepancies:[]},problem:null};}
async function server(t,snapshot){
 const db=new DatabaseSync(":memory:"),env={...access.env,DB:fakeD1(db),NEXUS_LANGUAGE:"en"};t.after(()=>db.close());
 readSnapshot02(snapshot,Date.now());assert.ok(Buffer.byteLength(JSON.stringify(snapshot))<1000000,"this is a schema-valid sub-1MiB input, not a body-limit test");
 async function call(method,path,{body,lang="en"}={}){return handle(new Request("https://nexus.example.com"+path,{method,headers:{...access.headers(method==="POST"?"agent":"user"),...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{})}),{...env,NEXUS_LANGUAGE:lang},access.ctx,hub,views);}
 const pushed=await call("POST","/api/snapshots",{body:snapshot});assert.equal(pushed.status,200,await pushed.text());
 return{db,call,name:snapshot.project.name};
}

test("schema-valid repeated timeline remains available through real GET/HEAD and retains the exact source",async t=>{
 const snapshot=repeatedSnapshot(),source=domainOf(snapshot),events=source.timeline.reduce((sum,lane)=>sum+lane.places.reduce((n,p)=>n+p.length,0),0);
 assert.equal(events,40000);assert.equal(events*4+source.timeline.length+source.contexts.length,160021,"historical unbounded expansion size, calculated without constructing it");
 const f=await server(t,snapshot),path="/pictures/"+f.name+"/sample/01-domain",api="/api/spaces/"+f.name+"/pictures/sample/01-domain";
 const stored=()=>f.db.prepare("SELECT source,digest FROM pictures WHERE project=? AND part='sample' AND stage='01-domain'").get(f.name),before=stored();
 assert.deepEqual(JSON.parse(before.source),source);
 for(const lang of["en","ko"]){const response=await f.call("GET",path,{lang}),html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get("Cache-Control"),"no-store");assert.equal(response.headers.get("Content-Security-Policy"),VIEW_POLICY);const body=limitedHTML(html);assert.match(body,lang==="en"?/Repeated layout is too complex[\s\S]*original source is unchanged/:/반복 배치가 너무 복잡해[\s\S]*원본은 그대로 보관/);}
 const head=await f.call("HEAD",path);assert.equal(head.status,200);assert.equal(head.body,null);assert.equal(await head.text(),"");assert.equal(head.headers.get("Cache-Control"),"no-store");assert.equal(head.headers.get("Content-Security-Policy"),VIEW_POLICY);
 const raw=await f.call("GET",api);assert.equal(raw.status,200);assert.equal(raw.headers.get("Cache-Control"),"no-store");assert.deepEqual((await raw.json()).picture.source,source,"fallback rendering never truncates the stored/API source");
 assert.deepEqual(stored(),before,"GET and HEAD preserve the complete source and digest");assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM writes").get().n,0,"reads create no write receipt");
});

test("normal300-node DDD, ERD and sitemap still receive complete initial SVGs from the real handler",async t=>{
 const snapshot=normalSnapshot(),f=await server(t,snapshot);
 for(const picture of snapshot.pictures){const scene=pictureLayout(picture.source,picture.stage);assert.equal(scene.nodes.length,300);assert.notEqual(scene.limited,true);const response=await f.call("GET","/pictures/"+f.name+"/sample/"+picture.stage),html=staticHTML(await response.text());assert.equal(response.status,200);assert.match(html,/data-preview-complete\b/);assert.match(html,/data-preview-ready="true"/);assert.doesNotMatch(html,/data-preview-limited\b/);assert.equal((html.match(/data-nexus-node=/g)||[]).length,300,picture.stage+" retains every initial node");}
});

test("node budget includes context frames and permits exactly20000 without silently weakening normal layouts",()=>{
 assert.equal(MAX_PICTURE_NODES,20000);assert.equal(MAX_SOURCE_ITEMS,3000);
 const exact=repeatedSnapshot("qa-budget-exact",[2000,2000,999]),source=domainOf(exact);readSnapshot02(exact,Date.now());const before=JSON.stringify(source),scene=pictureLayout(source,"01-domain");assert.equal(scene.nodes.length,20000);assert.notEqual(scene.limited,true);assert.equal(JSON.stringify(source),before,"geometry must not mutate original source");assert.ok(Object.values(scene.bounds).every(Number.isFinite));
 const overflow=repeatedSnapshot("qa-budget-frame",[2000,2000,998,1]);readSnapshot02(overflow,Date.now());const limited=pictureLayout(domainOf(overflow),"01-domain");assert.equal(limited.limited,true,"the20001st context frame must trigger fallback");assert.equal(limited.limit,20000);assert.ok(limited.nodes.length<=3000);assert.equal(limited.edges.length,0);
 assert.equal(browserLayout.pictureLayout,pictureLayout,"browser and server use the same bounded function");
 assert.throws(()=>pictureLayout({contexts:[{rows:null}]},"01-domain"),TypeError,"programmer/input errors are not mislabeled as a safe budget fallback");
});

test("source-item fallback is capped at3000, remains a list and leaves its valid source unchanged",()=>{
 const snapshot=sourceListSnapshot(),source=domainOf(snapshot);readSnapshot02(snapshot,Date.now());assert.ok(Buffer.byteLength(JSON.stringify(snapshot))<1000000);const before=JSON.stringify(source),scene=pictureLayout(source,"01-domain");
 assert.equal(scene.limited,true);assert.equal(scene.listLimited,true);assert.equal(scene.nodes.length,3000);assert.equal(sceneItems(scene).length,3000);assert.equal(new Set(scene.nodes.map(n=>n.key)).size,3000);assert.equal(scene.edges.length,0);assert.equal(JSON.stringify(source),before);
 const body=limitedHTML(picturePreview(pageData(source).data,"en"));assert.equal(listItems(body),3000);assert.match(body,/up to 3000 source items/);
});

// Minimal DOM test double: executes actual core control flow with renderer
// spies, not a browser. It makes no CSS, paint, mobile or performance claim.
function clientDouble(source,{hash=""}={}){
 class Element{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.listeners={};this.hidden=false;this._text="";this.isConnected=true;this.classList={add(){},remove(){}};}
  set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>typeof n==="string"?n:n.textContent).join("");}
  append(...values){for(const n of values){this.children.push(n);if(typeof n!=="string")n.parentElement=this;}}
  replaceChildren(...values){this.children=[];this._text="";this.append(...values);}setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,v){this.listeners[k]=v;}get lastChild(){return this.children.at(-1);}focus(){}
  contains(node){return this===node||this.children.some(n=>typeof n!=="string"&&n.contains(node));}
  querySelectorAll(selector){const matches=node=>selector[0]==="."?(node.className||"").split(" ").includes(selector.slice(1)):node.tagName===selector.toUpperCase();return this.children.flatMap(n=>typeof n==="string"?[]:[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}after(...nodes){this.parentElement?.append(...nodes);}
 }
 const root=new Element("div"),body=new Element("body"),html=new Element("html");root.id="view";body.append(root);const location=new URL("https://nexus.example.com/pictures/qa-preview-limit/sample/01-domain"+hash);
 const document={documentElement:html,body,activeElement:body,createElement:tag=>new Element(tag),getElementById(id){if(id==="view")return root;if(id==="view-data")return null;const visit=n=>n.id===id?n:n.children.filter(c=>typeof c!=="string").map(visit).find(Boolean);return visit(root)||null;},addEventListener(){}};
 let nativeCalls=0,svgCalls=0,apiCalls=0;const sandbox={document,location,URL,URLSearchParams,AbortController,queueMicrotask,getComputedStyle:()=>({getPropertyValue:()=>"44px"}),matchMedia:()=>({matches:false,addEventListener(){}}),history:{pushState(value,_,href){this.state=value;location.href=new URL(href,location).href;},replaceState(value,_,href){this.state=value;location.href=new URL(href,location).href;},back(){}},ApiClient:class{async call(){apiCalls++;throw Error("unexpected mocked client request");}},NexusProblem,Drafts,PendingWrites,LatestReads,characters,pictureLayout,sceneItems,itemMarks:browserLayout.itemMarks,itemIdentity:browserLayout.itemIdentity,commentTarget:browserLayout.commentTarget,commentMatchesItem:browserLayout.commentMatchesItem,STEPS:browserLayout.STEPS,stepIndex:browserLayout.stepIndex,words,pictureLimitMessage:(scene,lang)=>lang==="ko"?"한계 안내":"Limit notice",drawPicture:async()=>{nativeCalls++;return{destroy(){},update(){}};},mountPreview:()=>{svgCalls++;return{view(){return{};},destroy(){}};},stylesheetReady:async()=>true};sandbox.window={addEventListener(){}};
 const core=readFileSync(new URL("../ui/core.js",import.meta.url),"utf8").replace(/^import[^\n]*\r?\n/gm,"").replace("export function startView", "function startView");
 runInNewContext(core+"\nglobalThis.checkedStartView=startView;",sandbox,{timeout:2000});const controller=sandbox.checkedStartView(pageData(source));
 return{root,document,controller,counts:()=>({nativeCalls,svgCalls,apiCalls})};
}
test("mocked client keeps limited source list and item panel without starting SVG/native or claiming readiness",async()=>{
 const source=domainOf(repeatedSnapshot()),d=clientDouble(source),warning=d.root.querySelectorAll("div").find(n=>n.dataset.previewLimited==="true");assert.ok(warning);assert.deepEqual(d.counts(),{nativeCalls:0,svgCalls:0,apiCalls:0});
 const items=d.document.getElementById("items");assert.ok(items);const button=items.querySelectorAll("button").find(b=>b.textContent.includes("CTX-001"));assert.ok(button,"limited source items keep item actions");button.listeners.click();await new Promise(resolve=>queueMicrotask(resolve));const panel=d.root.querySelectorAll("section").find(n=>(n.className||"").split(" ").includes("panel"));assert.equal(panel.hidden,false);assert.match(panel.textContent,/CTX-001|Ordering/);assert.ok(panel.querySelector("form"),"the item panel retains a comment draft, without submitting it");assert.deepEqual(d.counts(),{nativeCalls:0,svgCalls:0,apiCalls:0});
 const nodes=[d.root,...d.root.querySelectorAll("div")];assert.ok(nodes.every(n=>n.dataset.ready!=="true"&&n.dataset.editorReady!=="true"&&n.dataset.previewReady!=="true"));d.controller.close();
});

class SceneSomeTrap extends Error{}
async function sceneSomeCounter(run,limit=MAX_PICTURE_WORK+1024){
 const descriptor=Object.getOwnPropertyDescriptor(Array.prototype,"some"),original=descriptor.value,stats={calls:0,predicateVisits:0,trapped:false};
 Object.defineProperty(Array.prototype,"some",{...descriptor,value:function(callback,thisArg){const first=this[0],scene=first&&typeof first.key==="string"&&typeof first.kind==="string"&&Number.isFinite(first.x)&&Number.isFinite(first.y);if(!scene)return original.call(this,callback,thisArg);stats.calls++;return original.call(this,(value,index,array)=>{if(++stats.predicateVisits>limit){stats.trapped=true;throw new SceneSomeTrap("scene predicate safety limit");}return callback.call(thisArg,value,index,array);});}});
 try{return{value:await run(),stats};}finally{Object.defineProperty(Array.prototype,"some",descriptor);}
}
function limitedWork(scene,reason){assert.equal(scene.limited,true);assert.equal(scene.limit,20000);assert.equal(scene.workLimit,200000);assert.equal(scene.reason,reason);assert.ok(Number.isSafeInteger(scene.work)&&scene.work>=0&&scene.work<=MAX_PICTURE_WORK);assert.ok(scene.nodes.length<=MAX_SOURCE_ITEMS);assert.equal(scene.edges.length,0);}
function workSnapshot(){
 const snapshot=repeatedSnapshot("qa-preview-work",[2000,2000,2000,2000,1900]),source=domainOf(snapshot),context=source.contexts[0],row={given_by:"",policy:false,read_model:"",command:"C",aggregate:"",events:["E"],where:context.where};
 source.contexts=Array.from({length:200},(_,i)=>({...context,rows:i?[]:[row]}));source.aggregates=Array.from({length:500},()=>({name:"G",context:"CTX-001",term:"TERM-001",removed:false,where:context.where}));
 return snapshot;
}
function emptyDomain(source){source.contexts=[];source.aggregates=[];source.read_models=[];source.dependencies=[];source.hotspots=[];delete source.timeline;return source;}

test("scene-only predicate safety counter traps early and restores Array.some",async()=>{
 const original=Array.prototype.some,nodes=[{key:"a",kind:"event",x:0,y:0},{key:"b",kind:"event",x:1,y:1}];
 await assert.rejects(sceneSomeCounter(()=>nodes.some(()=>false),1),SceneSomeTrap);assert.equal(Array.prototype.some,original);
 const unrelated=await sceneSomeCounter(()=>[1,2,3].some(()=>false),1);assert.equal(unrelated.stats.predicateVisits,0);assert.equal(Array.prototype.some,original);
});

test("duplicate contexts and terms cannot bypass the work budget in actual GET/HEAD",async t=>{
 assert.equal(MAX_PICTURE_WORK,200000);const snapshot=workSnapshot(),source=domainOf(snapshot),beforeSource=JSON.stringify(source);readSnapshot02(snapshot,Date.now());
 const count=source.timeline.reduce((n,l)=>n+l.places.reduce((sum,p)=>sum+p.length,0),0),initial=count*2+source.timeline.length;
 assert.equal(count,9900);assert.equal(initial,19805);assert.equal(initial+(200*500-1)*(initial+1),1980599999,"historical bypass size is calculated, never executed");
 const direct=await sceneSomeCounter(()=>pictureLayout(source,"01-domain"));limitedWork(direct.value,"work");assert.equal(direct.value.nodes.length,4);assert.equal(direct.stats.trapped,false);assert.ok(direct.stats.predicateVisits<=MAX_PICTURE_WORK);
 const f=await server(t,snapshot),path="/pictures/"+f.name+"/sample/01-domain",stored=()=>f.db.prepare("SELECT source,digest FROM pictures WHERE project=? AND part='sample' AND stage='01-domain'").get(f.name),before=stored();
 for(const [method,lang]of[["GET","en"],["GET","ko"],["HEAD","en"]]){const measured=await sceneSomeCounter(()=>f.call(method,path,{lang})),response=measured.value;assert.equal(measured.stats.trapped,false);assert.ok(measured.stats.predicateVisits<=MAX_PICTURE_WORK);assert.equal(response.status,200);assert.equal(response.headers.get("Cache-Control"),"no-store");assert.equal(response.headers.get("Content-Security-Policy"),VIEW_POLICY);if(method==="HEAD"){assert.equal(response.body,null);assert.equal(await response.text(),"");}else assert.equal(listItems(limitedHTML(await response.text())),4);}
 const api=await f.call("GET","/api/spaces/"+f.name+"/pictures/sample/01-domain");assert.equal(api.status,200);assert.deepEqual((await api.json()).picture.source,source);assert.deepEqual(stored(),before);assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM writes").get().n,0);assert.equal(JSON.stringify(source),beforeSource);
});

test("first matching event row remains authoritative across contexts and DDD steps",()=>{
 const snapshot=repeatedSnapshot("qa-first-row",[1]),source=domainOf(snapshot),template=source.contexts[0],where=template.where;
 const row=(command,actor)=>({given_by:actor,policy:false,read_model:"",command,aggregate:"",events:["E"],where});
 source.contexts=[{...template,rows:[row("First command","First actor")]},{...template,id:"CTX-002",name:"Second context",rows:[row("Second command","Second actor")]}];source.aggregates=[];readSnapshot02(snapshot,Date.now());const before=JSON.stringify(source);
 for(const step of["3","8-b–9"]){const scene=pictureLayout(source,"01-domain",step);assert.notEqual(scene.limited,true);assert.equal(scene.nodes.find(n=>n.key==="event-0-0-0").context,"CTX-001");assert.equal(scene.nodes.find(n=>n.key==="event-0-0-0-command").text,"First command");if(step==="8-b–9"){assert.equal(scene.nodes.find(n=>n.key==="event-0-0-0-actor").text,"First actor");assert.equal(scene.nodes.find(n=>n.key==="unplaced-command-1-0").text,"Second command");}}
 assert.equal(JSON.stringify(source),before);
});

test("positive term reuse preserves independent nonempty-ID and case-sensitive suffix matches",()=>{
 const snapshot=repeatedSnapshot("qa-term-matches",[1]),source=domainOf(snapshot),context=source.contexts[0],where=context.where;
 context.rows[0].aggregate="Order suffix";context.rows[0].command="";source.aggregates=[{name:"Order suffix",term:"TERM-001"},{name:"unrelated",term:"TERM-001"},{name:"unrelated",term:"TERM-002"},{name:"suffix",term:"TERM-003"},{name:"new label",term:"TERM-003"},{name:"Suffix",term:"TERM-004"}].map(t=>({...t,context:context.id,removed:false,where}));
 readSnapshot02(snapshot,Date.now());const scene=pictureLayout(source,"01-domain");assert.notEqual(scene.limited,true);const terms=scene.nodes.filter(n=>n.kind==="aggregate");
 assert.deepEqual(terms.map(n=>[n.id,n.text]),[["TERM-001","Order suffix"],["TERM-002","unrelated"],["TERM-003","new label"],["TERM-004","Suffix"]],"an ID-only hit must not cache an unmatched name; a suffix-only hit must not cache an absent ID");
});

test("term membership stays separate by kind/context and accepts omitted optional term IDs",()=>{
 const snapshot=viewSnapshot("qa-term-scopes"),source=emptyDomain(domainOf(snapshot)),template=viewSnapshot().pictures[0].source.contexts[0],where=template.where;
 source.contexts=[{...template,external:"",rows:[]},{...template,id:"CTX-002",name:"Other",external:"",rows:[]}];
 for(const field of["aggregates","read_models"])source[field]=source.contexts.map(c=>({name:"Shared label",context:c.id,term:"TERM-001",removed:false,where}));
 readSnapshot02(snapshot,Date.now());const scoped=pictureLayout(source,"01-domain");assert.notEqual(scoped.limited,true);for(const ctx of["CTX-001","CTX-002"])for(const kind of["aggregate","read-model"])assert.equal(scoped.nodes.filter(n=>n.context===ctx&&n.kind===kind).length,1);
 for(const field of["aggregates","read_models"])for(const term of source[field])delete term.term;
 readSnapshot02(snapshot,Date.now());const optional=pictureLayout(source,"01-domain");assert.notEqual(optional.limited,true);assert.equal(optional.nodes.filter(n=>["aggregate","read-model"].includes(n.kind)).length,4);assert.ok(optional.nodes.filter(n=>["aggregate","read-model"].includes(n.kind)).every(n=>n.id===""));
});

test("limited source list includes unique timeline-only events without expanding their layout",()=>{
 const snapshot=viewSnapshot("qa-timeline-only"),source=emptyDomain(domainOf(snapshot)),where="docs/synthetic.md:1";let serial=0;
 source.timeline=Array.from({length:11},(_,li)=>({lane:"Lane "+li,where,places:Array.from({length:200},()=>Array.from({length:10},()=>"Timeline only "+serial++))}));
 readSnapshot02(snapshot,Date.now());assert.ok(Buffer.byteLength(JSON.stringify(snapshot))<1000000);const before=JSON.stringify(source),scene=pictureLayout(source,"01-domain");limitedWork(scene,"nodes");assert.equal(scene.nodes.length,3000);assert.equal(scene.listLimited,true);assert.equal(scene.nodes[0].text,"Timeline only 0");assert.equal(scene.nodes[2999].text,"Timeline only 2999");assert.ok(scene.nodes.every(n=>n.kind==="event"));
 const body=limitedHTML(picturePreview(pageData(source).data,"en"));assert.equal(listItems(body),3000);assert.ok(body.includes("Timeline only 2999"));assert.equal(JSON.stringify(source),before);
});

test("mocked zero-item limited scene retains the real SSR warning and no readiness claim",()=>{
 const scene={nodes:[],edges:[],bounds:{x:0,y:0,width:220,height:100},contexts:[],step:8,limited:true,limit:20000,workLimit:200000,reason:"work",work:200000,listLimited:false};
 const preview=readFileSync(new URL("../src/preview.js",import.meta.url),"utf8").replace(/^import[^\n]*\r?\n/gm,"").replace(/^export /gm,"");
 const sandbox={pictureLayout:()=>scene,itemMarks:browserLayout.itemMarks,sceneItems,STEPS:browserLayout.STEPS,words};runInNewContext(preview+"\nglobalThis.checkedPicturePreview=picturePreview;",sandbox,{timeout:1000});
 for(const lang of["en","ko"]){const body=limitedHTML(sandbox.checkedPicturePreview(pageData({}).data,lang),{allowEmpty:true});assert.equal(listItems(body),0);assert.match(body,lang==="en"?/Repeated layout is too complex/:/반복 배치가 너무 복잡해/);}
});

function textSnapshot(kind){
 const snapshot=viewSnapshot("qa-text-"+kind),template=domainOf(snapshot).contexts[0],source=emptyDomain(domainOf(snapshot)),text="\n".repeat(INPUT_SCHEMAS.Words.maxLength-1)+"X";
 source.contexts=Array.from({length:200},()=>({...template,external:"",rows:[],purpose:kind==="purpose"?text:""}));
 if(kind==="hotspot")source.hotspots=[{number:1,text,contexts:["CTX-001"],state:"open",answer:"",where:template.where}];
 return snapshot;
}
async function assertTextBudget(t,kind){
 assert.equal(MAX_PICTURE_TEXT_WORK,1000000);const snapshot=textSnapshot(kind),source=domainOf(snapshot),text=kind==="hotspot"?source.hotspots[0].text:source.contexts[0].purpose;
 assert.equal(Array.from(text).length,INPUT_SCHEMAS.Words.maxLength);assert.equal(text.split("\n").length,INPUT_SCHEMAS.Words.maxLength);readSnapshot02(snapshot,Date.now());const bytes=Buffer.byteLength(JSON.stringify(snapshot));assert.ok(bytes<1000000);
 const original=JSON.stringify(source),scene=pictureLayout(source,"01-domain");limitedWork(scene,"text");assert.equal(scene.textLimit,MAX_PICTURE_TEXT_WORK);assert.ok(Number.isSafeInteger(scene.textWork)&&scene.textWork>0&&scene.textWork<=MAX_PICTURE_TEXT_WORK);assert.ok(scene.work<MAX_PICTURE_WORK,"text amplification is stopped before the general work limit");assert.equal(scene.nodes.length,kind==="hotspot"?2:1);
 const f=await server(t,snapshot),path="/pictures/"+f.name+"/sample/01-domain",stored=()=>f.db.prepare("SELECT source,digest FROM pictures WHERE project=? AND part='sample' AND stage='01-domain'").get(f.name),before=stored();
 for(const [method,lang]of[["GET","en"],["GET","ko"],["HEAD","en"]]){const response=await f.call(method,path,{lang});assert.equal(response.status,200);assert.equal(response.headers.get("Cache-Control"),"no-store");assert.equal(response.headers.get("Content-Security-Policy"),VIEW_POLICY);if(method==="HEAD"){assert.equal(response.body,null);assert.equal(await response.text(),"");}else assert.equal(listItems(limitedHTML(await response.text())),scene.nodes.length);}
 const api=await f.call("GET","/api/spaces/"+f.name+"/pictures/sample/01-domain");assert.equal(api.status,200);assert.deepEqual((await api.json()).picture.source,source);assert.deepEqual(stored(),before);assert.equal(JSON.stringify(source),original);assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM writes").get().n,0);
 t.diagnostic(JSON.stringify({scope:"synthetic text amplification, not a timing assertion",kind,snapshotBytes:bytes,wordsLimit:INPUT_SCHEMAS.Words.maxLength,contexts:200,reason:scene.reason,textWork:scene.textWork,textLimit:scene.textLimit,work:scene.work,sourceItems:scene.nodes.length}));
}
test("schema-valid multiline hotspot replication stops at the text budget through actual GET/HEAD",async t=>{await assertTextBudget(t,"hotspot");});
test("schema-valid multiline context-purpose frames stop at the text budget through actual GET/HEAD",async t=>{await assertTextBudget(t,"purpose");});

test("literal timeline text cannot hide an equal stable term ID in fallback, SSR or the mocked item panel",async t=>{
 const literal={key:"literal",kind:"event",id:"",text:"TERM-001"},stable={key:"stable",kind:"aggregate",id:"TERM-001",text:"G"};
 assert.notEqual(browserLayout.itemIdentity(literal),browserLayout.itemIdentity(stable));assert.deepEqual(sceneItems({nodes:[literal,stable,{...literal,key:"literal-again"},{...stable,key:"stable-again"}]}),[literal,stable],"ordinary item lists deduplicate within each identity namespace");
 const snapshot=workSnapshot(),source=domainOf(snapshot);source.timeline[0].places[0][0]="TERM-001";readSnapshot02(snapshot,Date.now());const original=JSON.stringify(source),direct=await sceneSomeCounter(()=>pictureLayout(source,"01-domain")),scene=direct.value;
 limitedWork(scene,"work");assert.equal(direct.stats.trapped,false);assert.equal(scene.listLimited,false);assert.equal(scene.nodes.length,5);
 for(const nodes of[scene.nodes,sceneItems(scene)]){assert.ok(nodes.some(n=>!n.id&&n.text==="TERM-001"),"unidentified literal event remains");assert.ok(nodes.some(n=>n.id==="TERM-001"&&n.kind==="aggregate"&&n.text==="G"),"stable-ID aggregate remains");}
 const f=await server(t,snapshot),stored=()=>f.db.prepare("SELECT source,digest FROM pictures WHERE project=? AND part='sample' AND stage='01-domain'").get(f.name),before=stored();
 const measured=await sceneSomeCounter(()=>f.call("GET","/pictures/"+f.name+"/sample/01-domain"));assert.equal(measured.stats.trapped,false);assert.equal(measured.value.status,200);const body=limitedHTML(await measured.value.text()),entries=[...body.matchAll(/<li>\s*<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>\s*<\/li>/g)].map(match=>({href:match[1],text:match[2]}));
 assert.equal(entries.length,5);assert.ok(entries.some(e=>e.href==="#items"&&e.text==="TERM-001"));assert.ok(entries.some(e=>e.href==="#item=TERM-001"&&e.text==="TERM-001 · G"));
 const api=await f.call("GET","/api/spaces/"+f.name+"/pictures/sample/01-domain");assert.equal(api.status,200);assert.deepEqual((await api.json()).picture.source,source);assert.deepEqual(stored(),before);assert.equal(JSON.stringify(source),original);assert.equal(f.db.prepare("SELECT COUNT(*) AS n FROM writes").get().n,0);
 const mocked=await sceneSomeCounter(async()=>{const d=clientDouble(source,{hash:"#item=TERM-001"});await new Promise(resolve=>queueMicrotask(resolve));return d;}),d=mocked.value;assert.equal(mocked.stats.trapped,false);
 const panel=d.root.querySelectorAll("section").find(n=>(n.className||"").split(" ").includes("panel"));assert.equal(panel.hidden,false);assert.equal(panel.querySelector("h2").textContent,"TERM-001 G");assert.equal(panel.querySelector("p").textContent,"G","deep link opens the aggregate, not the literal event or a missing-item warning");assert.ok(panel.querySelectorAll("pre").some(p=>p.textContent==="CTX-001"));assert.ok(panel.querySelector("form"));assert.deepEqual(d.counts(),{nativeCalls:0,svgCalls:0,apiCalls:0});d.controller.close();
 t.diagnostic(JSON.stringify({scope:"stable ID versus literal text; item panel is mocked",sourceItems:scene.nodes.length,listItems:sceneItems(scene).length,listLimited:scene.listLimited,linkId:"TERM-001",directPredicateVisits:direct.stats.predicateVisits,ssrPredicateVisits:measured.stats.predicateVisits,panelPredicateVisits:mocked.stats.predicateVisits}));
});
