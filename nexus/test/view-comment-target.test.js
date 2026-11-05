// Actual core control flow with DOM/render/transport doubles. These checks make
// no browser, visual, real Access or backend-effect claim.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import * as layout from "../ui/layout.js";
import {Drafts,NexusProblem,PendingWrites,LatestReads,characters} from "../ui/state.js";
import {words} from "../ui/messages.js";

const project="qa-comment-target",place=project+"/sample/01-domain",legacyScope=project+":comment:"+place+":Picture drawn";
const storageKey=scope=>"nexus0.2:"+scope;
const ownedScope=id=>project+":comment-part:"+place+':owner:'+JSON.stringify([id,"Picture drawn"]);
const stored=(text,write="nw_zzzzzzzzzzzz")=>JSON.stringify({text,write,settles:false});
function source(anonymous=true){
 const row={given_by:"",policy:false,read_model:"",command:"Draw",aggregate:"",events:["Picture drawn"],where:"docs/sample.md:1"};
 return {format:1,contexts:[{id:"CTX-012",name:"Drawing",rows:[row]},{id:"CTX-014",name:"Another drawing",rows:[row]},...(anonymous?[{name:"CTX-015",rows:[row]}]:[])],aggregates:[],read_models:[],dependencies:[],hotspots:[]};
}
class Element{
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.parentElement=null;this.dataset={};this.attributes={};this.listeners={};this.hidden=false;this._text="";this.isConnected=true;this.classList={add(){},remove(){}};}
 set textContent(value){this._text=String(value);this.children=[];}get textContent(){return this._text+this.children.map(n=>typeof n==="string"?n:n.textContent).join("");}
 append(...values){for(const n of values){this.children.push(n);if(typeof n!=="string")n.parentElement=this;}}
 replaceChildren(...values){this.children=[];this._text="";this.append(...values);}setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,v){this.listeners[k]=v;}get lastChild(){return this.children.at(-1);}focus(){}setSelectionRange(){}
 contains(node){return this===node||this.children.some(n=>typeof n!=="string"&&n.contains(node));}
 querySelectorAll(selector){const matches=n=>selector[0]==="."?(n.className||"").split(" ").includes(selector.slice(1)):n.tagName===selector.toUpperCase();return this.children.flatMap(n=>typeof n==="string"?[]:[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}after(...nodes){this.parentElement?.append(...nodes);}
}
function client({values=new Map(),post=async()=>({}),comments=[],closed=[],anonymous=true}={}){
 const root=new Element("div"),body=new Element("body"),html=new Element("html"),location=new URL("https://nexus.example.com/pictures/"+place);root.id="view";body.append(root);
 const document={documentElement:html,body,activeElement:body,createElement:tag=>new Element(tag),getElementById(id){if(id==="view")return root;if(id==="view-data")return null;const visit=n=>n.id===id?n:n.children.filter(c=>typeof c!=="string").map(visit).find(Boolean);return visit(root)||null;},addEventListener(){}};
 const picture={commit:"a".repeat(40),committed_at:new Date().toISOString(),source:source(anonymous)},data={picture,comments:{entries:comments},closed_comments:{entries:closed},proposals:[],reflections:[],discrepancies:[]};
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},calls=[];let number=0,select;
 class TestDrafts extends Drafts{constructor(){super({storage:()=>storage,makeId:()=>"nw_"+String(++number).padStart(12,"0")});}}
 const sandbox={document,location,URL,URLSearchParams,AbortController,queueMicrotask,getComputedStyle:()=>({getPropertyValue:()=>"44px"}),matchMedia:()=>({matches:false,addEventListener(){}}),history:{pushState(value,_,href){this.state=value;location.href=new URL(href,location).href;},replaceState(value,_,href){this.state=value;location.href=new URL(href,location).href;},back(){}},ApiClient:class{async call(method,path,options){calls.push({method,path,...options});return method==="POST"?post(options):data;}},NexusProblem,Drafts:TestDrafts,PendingWrites,LatestReads,characters,...layout,words,pictureLimitMessage:()=>"Limit notice",mountPreview:(_target,_scene,options)=>{select=options.onSelect;return{view(){return{};},destroy(){}};},drawPicture:async()=>({destroy(){},update(){}}),stylesheetReady:async()=>true};sandbox.window={addEventListener(){}};
 const core=readFileSync(new URL("../ui/core.js",import.meta.url),"utf8").replace(/^import[^\n]*\r?\n/gm,"").replace("export function startView","function startView");
 runInNewContext(core+"\nglobalThis.checkedStartView=startView;",sandbox,{timeout:2000});
 const controller=sandbox.checkedStartView({schema:"corthex-view-page/0.2",view:"picture",lang:"en",data}),scene=layout.domainLayout(picture.source);
 return{root,values,calls,controller,panel:()=>root.querySelector(".panel"),chooseMissing(id){select("item",id);},choose(owner){const item=scene.nodes.find(n=>n.kind==="event"&&n.owner===owner);assert.ok(item);select("item",item.id,item);},chooseID(id){const item=scene.nodes.find(n=>n.id===id);assert.ok(item);select("item",id,item);}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const submit=d=>d.panel().querySelector("form").listeners.submit({preventDefault(){}});
test("selected CTX-012 event sends its owner and quote, with matching open/closed lists and source marks",async()=>{
 const d=client({anonymous:false,comments:[{id:"first",item:"CTX-012",quote:"Picture drawn",text:"only twelve"},{id:"second",item:"CTX-014",quote:"Picture drawn",text:"only fourteen"},{id:"legacy",item:"",quote:"Picture drawn",text:"legacy picture"}],closed:[{id:"closed12",item:"CTX-012"},{id:"closed14",item:"CTX-014"}]});
 const apart=d.root.querySelectorAll("section").find(n=>n.querySelector("h2")?.textContent.startsWith("Apart:"));assert.ok(apart);assert.match(apart.textContent,/legacy picture/);assert.doesNotMatch(apart.textContent,/only twelve|only fourteen/);
 for(const id of["CTX-012","CTX-014"])assert.ok(d.root.querySelectorAll("button").some(b=>b.textContent.startsWith(id+" · Picture drawn")),"the item list identifies the holding context for equal labels");
 d.choose("CTX-012");const p=d.panel();assert.match(p.textContent,/comments are kept on CTX-012/);assert.match(p.textContent,/only twelve/);assert.doesNotMatch(p.textContent,/only fourteen|legacy picture|closed14/);assert.match(p.textContent,/Closed on CTX-012/);assert.match(p.textContent,/closed12/);
 const input=p.querySelector("textarea");input.value="Comment on the drawn event";input.listeners.input();await submit(d);
 const sent=d.calls.find(c=>c.method==="POST");assert.equal(sent.body.item,"CTX-012");assert.equal(sent.body.quote,"Picture drawn");assert.equal(sent.body.text,"Comment on the drawn event");
 assert.equal(d.calls.filter(c=>c.method==="POST").length,1);d.controller.close();
});
test("legacy draft recovery stays local, changes owner and write ID only for explicit Send, and preserves the old draft until success",async()=>{
 let finish;const values=new Map([[storageKey(legacyScope),stored("Old unsent text")]]),old=values.get(storageKey(legacyScope));
 const d=client({values,post:()=>new Promise(resolve=>{finish=resolve;})});
 d.choose("CTX-012");assert.equal(d.panel().querySelector("textarea").value,"Old unsent text");assert.match(d.panel().textContent,/previous send may already be on the picture/);assert.match(d.panel().textContent,/new comment on CTX-012/);
 assert.equal(d.calls.length,0,"opening and recovering never sends HTTP");assert.equal(values.get(storageKey(legacyScope)),old);
 const twelve=JSON.parse(values.get(storageKey(ownedScope("CTX-012"))));assert.notEqual(twelve.write,"nw_zzzzzzzzzzzz");
 d.choose("CTX-014");assert.equal(d.panel().querySelector("textarea").value,"Old unsent text");const fourteen=JSON.parse(values.get(storageKey(ownedScope("CTX-014"))));assert.notEqual(fourteen.write,twelve.write);assert.equal(values.get(storageKey(legacyScope)),old);assert.equal(d.calls.length,0);
 const sending=submit(d);await flush();assert.equal(d.calls[0].body.item,"CTX-014");assert.equal(d.calls[0].body.quote,"Picture drawn");assert.equal(d.calls[0].write,fourteen.write);assert.equal(values.get(storageKey(legacyScope)),old,"unknown old send stays until this explicit new send succeeds");
 finish({});await sending;assert.equal(values.has(storageKey(legacyScope)),false);assert.equal(values.get(storageKey(ownedScope("CTX-012"))),JSON.stringify(twelve),"another context's local draft is not consumed");d.controller.close();
});
test("existing owned drafts, including an explicitly empty one, are never overwritten by a legacy draft",()=>{
 for(const text of["Existing scoped draft",""]){const values=new Map([[storageKey(legacyScope),stored("Legacy text")],[storageKey(ownedScope("CTX-012")),stored(text,"nw_yyyyyyyyyyyy")]]),before=values.get(storageKey(ownedScope("CTX-012"))),d=client({values});d.choose("CTX-012");assert.equal(d.panel().querySelector("textarea").value,text);assert.equal(values.get(storageKey(ownedScope("CTX-012"))),before);assert.doesNotMatch(d.panel().textContent,/draft was recovered/);assert.equal(d.calls.length,0);d.controller.close();}
});
test("a legacy draft with changed text or write ID survives recovery send; failed sends keep both drafts",async()=>{
 for(const mode of["text","write","failure"]){let finish;const values=new Map([[storageKey(legacyScope),stored("Original text")]]),d=client({values,post:()=>new Promise((resolve,reject)=>{finish=()=>mode==="failure"?reject(new NexusProblem("network")):resolve({});})});d.choose("CTX-012");const sending=submit(d);await flush();if(mode==="text")values.set(storageKey(legacyScope),stored("Newer private text"));if(mode==="write")values.set(storageKey(legacyScope),stored("Original text","nw_xxxxxxxxxxxx"));finish();await sending;const legacy=JSON.parse(values.get(storageKey(legacyScope)));assert.equal(legacy.text,mode==="text"?"Newer private text":"Original text");assert.equal(legacy.write,mode==="write"?"nw_xxxxxxxxxxxx":"nw_zzzzzzzzzzzz");assert.equal(values.has(storageKey(ownedScope("CTX-012"))),mode==="failure");d.controller.close();}
});
test("stable-ID and anonymous-picture drafts keep their existing keys and body meanings",async()=>{
 const stable=project+":comment:"+place+":CTX-012",values=new Map([[storageKey(stable),stored("Stable draft","nw_vvvvvvvvvvvv")],[storageKey(legacyScope),stored("Picture draft")]]),d=client({values});
 d.chooseID("CTX-012");assert.equal(d.panel().querySelector("textarea").value,"Stable draft");await submit(d);assert.equal(d.calls[0].body.item,"CTX-012");assert.equal(Object.hasOwn(d.calls[0].body,"quote"),false);assert.equal(d.calls[0].write,"nw_vvvvvvvvvvvv");assert.equal(values.has(storageKey(stable)),false);
 d.choose("");assert.equal(d.panel().querySelector("textarea").value,"Picture draft");assert.match(d.panel().textContent,/kept on the picture/);await submit(d);const sent=d.calls.filter(c=>c.method==="POST").at(-1);assert.equal(sent.body.item,"");assert.equal(sent.body.quote,"Picture drawn");assert.equal(sent.write,"nw_zzzzzzzzzzzz");d.controller.close();
});

test("a gone stable ID retains its open comment and editable form without fabricating source fields",async()=>{
 const d=client({comments:[{id:"retained",item:"CTX-099",text:"Retained open comment"}]}),before=d.calls.length;
 d.chooseMissing("CTX-099");const panel=d.panel();assert.match(panel.textContent,/CTX-099 is not in this picture/);assert.match(panel.textContent,/Retained open comment/);assert.ok(panel.querySelector("textarea"));assert.equal(d.calls.length,before,"opening a gone item makes no request");
 panel.querySelector("textarea").value="Follow-up on the removed item";panel.querySelector("textarea").listeners.input();await submit(d);
 const sent=d.calls.find(c=>c.method==="POST");assert.equal(sent.body.item,"CTX-099");assert.equal(Object.hasOwn(sent.body,"quote"),false);assert.equal(sent.body.commit,"a".repeat(40));d.controller.close();
});

test("a gone item's unsent draft keeps its original text and write ID, with no send on opening",async()=>{
 const scope=project+":comment:"+place+":CTX-099",values=new Map([[storageKey(scope),stored("Old removed-item draft","nw_vvvvvvvvvvvv")]]),before=values.get(storageKey(scope)),d=client({values});
 d.chooseMissing("CTX-099");assert.equal(d.panel().querySelector("textarea").value,"Old removed-item draft");assert.equal(values.get(storageKey(scope)),before);assert.equal(d.calls.length,0);
 await submit(d);assert.equal(d.calls[0].write,"nw_vvvvvvvvvvvv");assert.equal(d.calls[0].body.item,"CTX-099");assert.equal(values.has(storageKey(scope)),false);d.controller.close();
});

test("a gone item with no open comments or nonempty draft shows only the notice and way back",()=>{
 for(const text of[undefined,""]){const values=new Map(text===undefined?[]:[[storageKey(project+":comment:"+place+":CTX-099"),stored(text)]]),d=client({values,closed:[{id:"old-closed",item:"CTX-099"}]});d.chooseMissing("CTX-099");assert.match(d.panel().textContent,/CTX-099 is not in this picture/);assert.equal(d.panel().querySelector("textarea"),null);assert.doesNotMatch(d.panel().textContent,/old-closed/);assert.equal(d.calls.length,0);d.controller.close();}
});

test("an overlong gone-item address stays an inert notice and cannot throw through draft scope validation",()=>{
 const d=client(),id="X".repeat(2100);assert.doesNotThrow(()=>d.chooseMissing(id));assert.ok(d.panel().textContent.includes(id+" is not in this picture"));assert.equal(d.panel().querySelector("textarea"),null);assert.equal(d.calls.length,0);assert.equal(d.values.size,0);d.controller.close();
});

test("Apart exposes the retained table ID before opening the comment thread",()=>{
 const d=client({comments:[{id:"retained-table",item:"TBL-099",text:"Keep this comment after redraw",author:"user",state:"open",waits:"agent"}]}),apart=d.root.querySelectorAll("section").find(n=>n.querySelector("h2")?.textContent.startsWith("Apart:"));
 assert.ok(apart);assert.match(apart.textContent,/Keep this comment after redraw/);assert.match(apart.querySelector("small").textContent,/TBL-099/);assert.equal(d.calls.length,0);d.controller.close();
});
