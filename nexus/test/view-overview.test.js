// Actual overview core with DOM and transport doubles. This regression does
// not claim browser paint, real Access or persistence effects.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {Drafts,NexusProblem,PendingWrites,LatestReads,characters} from "../ui/state.js";
import {words} from "../ui/messages.js";

class Element{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.listeners={};this.hidden=false;this.isConnected=true;this._text="";this.classList={add(){},remove(){}};}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>typeof n==="string"?n:n.textContent).join("");}
 append(...values){for(const n of values){this.children.push(n);if(typeof n!=="string")n.parentElement=this;}}
 prepend(...values){for(const n of values)if(typeof n!=="string")n.parentElement=this;this.children.unshift(...values);}
 replaceChildren(...values){this.children=[];this._text="";this.append(...values);}setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,v){this.listeners[k]=v;}get lastChild(){return this.children.at(-1);}focus(){}
 contains(node){return this===node||this.children.some(n=>typeof n!=="string"&&n.contains(node));}
 querySelectorAll(selector){const matches=n=>selector[0]==="."?(n.className||"").split(" ").includes(selector.slice(1)):n.tagName===selector.toUpperCase();return this.children.flatMap(n=>typeof n==="string"?[]:[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}after(...nodes){this.parentElement?.append(...nodes);}
}
function overview(){
 return{project:"qa-overview",part:"sample",stage:"05-erd",record:{state:"in_progress",checkpoints:[],next:"Review the stored record",updated:"2026-11-03T00:00:00.000Z",from:"repository"},read:true,source_state:"found",pictures:[],warnings:[],not_opened:0,checks:[{rule:"synthetic-check",message:"The stored check remains visible"}],comments:{total:0,entries:[]},discrepancies:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[]};
}
function client(data,lang="en",{post=async()=>({changed:true})}={}){
 const root=new Element("div"),body=new Element("body"),html=new Element("html"),location=new URL("https://nexus.example.com/overview/qa-overview/sample/05-erd");root.id="view";body.append(root);
 const document={documentElement:html,body,activeElement:body,createElement:tag=>new Element(tag),getElementById(id){if(id==="view")return root;if(id==="view-data")return null;return root.querySelectorAll("textarea").find(n=>n.id===id)||null;},addEventListener(){}};
 const values=new Map(),calls=[],storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};let serial=0;
 class TestDrafts extends Drafts{constructor(){super({storage:()=>storage,makeId:()=>"nw_"+String(++serial).padStart(12,"0")});}}
 const sandbox={document,location,URL,URLSearchParams,AbortController,queueMicrotask,getComputedStyle:()=>({getPropertyValue:()=>"44px"}),matchMedia:()=>({matches:false,addEventListener(){}}),history:{state:null,replaceState(){},pushState(){},back(){}},ApiClient:class{async call(method,path,options){calls.push({method,path,...options});return method==="GET"?data:post(options);}},NexusProblem,Drafts:TestDrafts,PendingWrites,LatestReads,characters,words,stylesheetReady:async()=>true};sandbox.window={addEventListener(){}};
 const source=readFileSync(new URL("../ui/core.js",import.meta.url),"utf8").replace(/^import[^\n]*\r?\n/gm,"").replace("export function startView","function startView");
 runInNewContext(source+"\nglobalThis.checkedStartView=startView;",sandbox,{timeout:2000});
 const controller=sandbox.checkedStartView({schema:"corthex-view-page/0.2",view:"overview",lang,generated_at:"2026-11-03T00:00:00.000Z",data});
 return{root,calls,values,controller,cards:()=>root.querySelectorAll("section").filter(n=>n.querySelector("h2")),form:()=>root.querySelector("form")};
}
const headings=lang=>lang==="ko"?["어긋남","의견","반영 대기"]:["Discrepancies","Comments","Pending reflections"];
const lists=(d,lang)=>d.cards().filter(n=>headings(lang).some(h=>n.querySelector("h2").textContent.startsWith(h+" (")));
const remaining=(d,lang)=>assert.ok(d.root.textContent.includes(lang==="ko"?"이 단계에 남은 것이 없습니다.":"Nothing is left in this stage."));
function assertPersistentRegions(d,lang,passAgain=false){
 const titles=d.cards().map(n=>n.querySelector("h2").textContent);
 assert.ok(titles.includes(lang==="ko"?"기록된 상태":"Recorded state"));assert.ok(titles.includes(lang==="ko"?"점검":"Checks"));assert.ok(titles.includes(lang==="ko"?"확인 지점":"Checkpoints"));
 assert.ok(d.root.textContent.includes("Review the stored record"));assert.ok(d.root.textContent.includes("The stored check remains visible"));assert.ok(d.form()?.querySelector("textarea"));
 assert.equal(d.form().querySelector("button").textContent,passAgain?words("Pass again",lang):lang==="ko"?"통과":"Pass");
}

test("empty overview replaces all three lists, keeps record/checks/Pass, and sends only on explicit Pass",async()=>{
 for(const lang of["en","ko"]){const d=client(overview(),lang);remaining(d,lang);assert.equal(lists(d,lang).length,0,"SCR109 empty replaces the lists rather than placing a notice above zero cards");assertPersistentRegions(d,lang);assert.equal(d.calls.length,0);
  const input=d.form().querySelector("textarea");input.value="Reviewed this empty stage";input.listeners.input();await d.form().listeners.submit({preventDefault(){}});
  const sent=d.calls.filter(c=>c.method==="POST");assert.equal(sent.length,1);assert.equal(sent[0].path,"/api/spaces/qa-overview/checkpoints");assert.deepEqual(JSON.parse(JSON.stringify(sent[0].body)),{part:"sample",stage:"05-erd",words:"Reviewed this empty stage"});assert.match(sent[0].write,/^nw_[0-9a-hjkmnp-tv-z]{12}$/);assert.equal(d.calls.filter(c=>c.method==="GET").length,1);assert.equal(lists(d,lang).length,0);remaining(d,lang);d.controller.close();
 }
});

test("one nonzero total preserves every group and the existing checkpoint actions",()=>{
 for(const lang of["en","ko"])for(const group of["comments","discrepancies","reflections"]){const data=overview();data[group].total=1;data[group].entries=[group==="comments"?{id:"nc_000000000001",part:"sample",stage:"05-erd",text:"Retained comment"}:group==="discrepancies"?{id:"nd_000000000001",compares:"aggregate-table",item:"TBL-001",term:"TERM-001",reasons:[{kind:"no-table"}]}:{id:"ne_000000000001",part:"sample",stage:"05-erd",state:"pending",proposal:{id:"np_000000000001",reason:"Retained reflection"}}];
  data.checkpoints=[{id:"nk_000000000001",words:"Previously passed",state:"passed",recorded_commit:null,passed_at:"2026-11-03T00:00:00.000Z"}];const d=client(data,lang),cards=lists(d,lang);
  assert.equal(cards.length,3);assert.deepEqual(cards.map(n=>n.querySelector("h2").textContent.split(" (")[0]),headings(lang));assert.equal(d.root.textContent.includes(words("Nothing left",lang)),false);assertPersistentRegions(d,lang,true);assert.ok(d.root.querySelectorAll("button").some(b=>b.textContent===(lang==="ko"?"철회":"Withdraw")));assert.equal(d.calls.length,0);d.controller.close();
 }
});

test("nonempty overview retains each fifty-entry DTO order, totals and links",()=>{
 const data=overview();for(const key of["comments","discrepancies","reflections"])data[key].total=51;
 for(let n=1;n<=50;n++){const suffix=String(n).padStart(3,"0");data.comments.entries.push({id:"nc_"+String(n).padStart(12,"0"),part:"sample",stage:"05-erd",text:"comment-"+suffix});data.discrepancies.entries.push({id:"nd_"+String(n).padStart(12,"0"),compares:"aggregate-table",term:"TERM-"+suffix,item:"TBL-"+suffix,reasons:[{kind:"no-table"}]});data.reflections.entries.push({id:"ne_"+String(n).padStart(12,"0"),part:"sample",stage:"05-erd",state:"pending",proposal:{id:"np_"+String(n).padStart(12,"0"),reason:"reflection-"+suffix}});}
 const d=client(data),cards=lists(d,"en");assert.equal(cards.length,3);
 for(const card of cards){assert.ok(card.querySelector("h2").textContent.endsWith("(51)"));assert.equal(card.querySelectorAll("li").length,50);assert.ok(card.textContent.includes("50 of 51"));}
 assert.deepEqual(cards[0].querySelectorAll("a").map(a=>a.textContent),data.discrepancies.entries.map(r=>r.term+" · "+r.item));assert.deepEqual(cards[1].querySelectorAll("a").map(a=>a.textContent),data.comments.entries.map(r=>r.text));assert.deepEqual(cards[2].querySelectorAll("a").map(a=>a.textContent),data.reflections.entries.map(r=>r.proposal.reason));
 assert.ok(cards[0].querySelector("a").href.endsWith("#item=TBL-001"));assert.ok(cards[1].querySelector("a").href.endsWith("#comment=nc_000000000001"));assert.ok(cards[2].querySelector("a").href.endsWith("#proposal=np_000000000001"));assertPersistentRegions(d,"en");assert.equal(d.calls.length,0);d.controller.close();
});

test("empty checks use the full screen-defined message in both empty and nonempty overviews",()=>{
 for(const lang of["en","ko"])for(const nonempty of[false,true]){const data=overview();data.checks=[];if(nonempty)data.comments={total:1,entries:[{id:"nc_000000000001",part:"sample",stage:"05-erd",text:"Retained comment"}]};
  const d=client(data,lang),checks=d.cards().find(n=>n.querySelector("h2").textContent===(lang==="ko"?"점검":"Checks"));
  assert.equal(checks.querySelector("li").textContent,lang==="ko"?"점검에서 찾은 것이 없습니다.":"No checks found anything.");assert.equal(lists(d,lang).length,nonempty?3:0);assert.ok(d.form().querySelector("button"));d.controller.close();
 }
});

for(const code of["checkpoint_not_found","project_not_found"])for(const lang of["en","ko"])test(`${code} ${lang} withdrawal rereads overview and preserves action ID, checkpoint words and original trace`,async()=>{
 const data=overview(),id="nk_aaaaaaaaaaaa";data.checkpoints=[{id,state:"passed",passed_at:"2026-11-05T00:00:00Z",words:"The synthetic checkpoint",recorded_commit:null}];
 const d=client(data,lang,{post:async()=>{throw new NexusProblem(code,404,{traceId:"withdraw-trace"});}}),input=d.form().querySelector("textarea");input.value="Keep these unsent checkpoint words";input.listeners.input();
 const passKey="nexus0.2:qa-overview:checkpoint:qa-overview/sample/05-erd",before=d.values.get(passKey),withdraw=d.root.querySelectorAll("button").find(b=>b.textContent===(lang==="ko"?"철회":"Withdraw"));
 await withdraw.listeners.click();
 assert.equal(d.calls.filter(c=>c.method==="POST").length,1);assert.equal(d.calls.filter(c=>c.method==="GET").length,1);assert.equal(d.calls.find(c=>c.method==="GET").path,"/api/spaces/qa-overview/overview/sample/05-erd");
 assert.equal(d.form().querySelector("textarea").value,"Keep these unsent checkpoint words");assert.equal(d.values.get(passKey),before);assert.ok(d.root.textContent.includes("withdraw-trace"));
 const sent=d.calls.find(c=>c.method==="POST");assert.equal(JSON.parse(d.values.get("nexus0.2:qa-overview:withdraw-checkpoint:"+id)).write,sent.write);d.controller.close();
});
