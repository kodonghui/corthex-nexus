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
function client({values=new Map(),post=async()=>({}),get,comments=[],closed=[],proposals=[],reflections=[],anonymous=true,lang="en",hash=""}={}){
 const root=new Element("div"),body=new Element("body"),html=new Element("html"),location=new URL("https://nexus.example.com/pictures/"+place+hash);root.id="view";body.append(root);
 const document={documentElement:html,body,activeElement:body,createElement:tag=>new Element(tag),getElementById(id){if(id==="view")return root;if(id==="view-data")return null;const visit=n=>n.id===id?n:n.children.filter(c=>typeof c!=="string").map(visit).find(Boolean);return visit(root)||null;},addEventListener(){}};
 const picture={commit:"a".repeat(40),committed_at:new Date().toISOString(),source:source(anonymous)},data={picture,comments:{entries:comments},closed_comments:{entries:closed},proposals,reflections,discrepancies:[]};
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},calls=[];let number=0,select;
 class TestDrafts extends Drafts{constructor(){super({storage:()=>storage,makeId:()=>"nw_"+String(++number).padStart(12,"0")});}}
 const sandbox={document,location,URL,URLSearchParams,AbortController,queueMicrotask,getComputedStyle:()=>({getPropertyValue:()=>"44px"}),matchMedia:()=>({matches:false,addEventListener(){}}),history:{pushState(value,_,href){this.state=value;location.href=new URL(href,location).href;},replaceState(value,_,href){this.state=value;location.href=new URL(href,location).href;},back(){}},ApiClient:class{async call(method,path,options){calls.push({method,path,...options});return method==="POST"?post(options):get?get(path,data):data;}},NexusProblem,Drafts:TestDrafts,PendingWrites,LatestReads,characters,...layout,words,pictureLimitMessage:()=>"Limit notice",mountPreview:(_target,_scene,options)=>{select=options.onSelect;return{view(){return{};},destroy(){}};},drawPicture:async()=>({destroy(){},update(){}}),stylesheetReady:async()=>true};const events={};sandbox.window={addEventListener(name,handler){events[name]=handler;}};
 const core=readFileSync(new URL("../ui/core.js",import.meta.url),"utf8").replace(/^import[^\n]*\r?\n/gm,"").replace("export function startView","function startView");
 runInNewContext(core+"\nglobalThis.checkedStartView=startView;",sandbox,{timeout:2000});
 const controller=sandbox.checkedStartView({schema:"corthex-view-page/0.2",view:"picture",lang,data}),scene=layout.domainLayout(picture.source);
 return{root,values,calls,controller,location,panel:()=>root.querySelector(".panel"),navigate(hash){location.hash=hash;events.hashchange();},chooseMissing(id){select("item",id);},choose(owner){const item=scene.nodes.find(n=>n.kind==="event"&&n.owner===owner);assert.ok(item);select("item",item.id,item);},chooseID(id){const item=scene.nodes.find(n=>n.id===id);assert.ok(item);select("item",id,item);}};
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

for(const lang of["en","ko"])test(`SCR106 ${lang} heading, reply metadata, closed reasons and named input preserve API fields`,()=>{
 for(const replies of[0,1,2]){
  const last="<script>Synthetic last reply stays text</script>",comments=[{id:"latest",item:"CTX-012",text:"Synthetic comment",author:"user",state:"open",waits:"agent",replies,last_reply:replies?{text:last}:null}],closed=[{id:"answered",item:"CTX-012",closed_as:"answered"},{id:"decided",item:"CTX-012",closed_as:"decided"}],before=JSON.stringify({comments,closed});
  const d=client({comments,closed,lang});d.chooseID("CTX-012");const p=d.panel();
  assert.equal(p.querySelector("h2").textContent,"CTX-012 Drawing");
  assert.ok(p.querySelectorAll("small").some(n=>n.textContent===(lang==="ko"?`답글 ${replies}개`:replies===1?"1 reply":`${replies} replies`)));
  if(replies)assert.ok(p.textContent.includes(last));else assert.ok(!p.textContent.includes(last));
  assert.ok(p.textContent.includes(lang==="ko"?"답이 나서 닫힘.":"Closed as answered."));
  assert.ok(p.textContent.includes(lang==="ko"?"결정으로 닫힘.":"Closed with a decision."));
  assert.ok(p.querySelectorAll("label").some(n=>n.textContent===(lang==="ko"?"CTX-012에 의견 남기기":"Comment on CTX-012")));
  assert.ok(p.querySelectorAll("button").some(n=>n.textContent===(lang==="ko"?"보내기":"Send")));
  assert.equal(p.querySelectorAll("script").length,0);assert.equal(d.calls.length,0);assert.equal(JSON.stringify({comments,closed}),before);d.controller.close();
 }
});

test("a successful comment stays on the item, rereads its list, clears only the sent draft and posts once",async()=>{
 const comments=[{id:"old",item:"CTX-012",text:"Earlier synthetic comment",state:"open",waits:"agent"}],d=client({comments,post:async options=>{comments.unshift({id:"created",item:options.body.item,text:options.body.text,state:"open",waits:"agent",replies:0});return{id:"created"};}});
 d.chooseID("CTX-012");const before=d.location.href,input=d.panel().querySelector("textarea");input.value="A fresh synthetic comment";input.listeners.input();await submit(d);await flush();
 assert.equal(d.location.href,before);assert.equal(d.location.hash,"#item=CTX-012");assert.equal(d.panel().querySelector("textarea").value,"");
 assert.ok(d.panel().textContent.indexOf("A fresh synthetic comment")<d.panel().textContent.indexOf("Earlier synthetic comment"));
 assert.equal(d.calls.filter(c=>c.method==="POST").length,1);assert.equal(d.calls.filter(c=>c.method==="GET").length,1);assert.ok(d.calls.find(c=>c.method==="GET").path.includes("/pictures/"));d.controller.close();
});

for(const code of["picture_not_found","discrepancy_not_found","project_not_found","space_not_found"])test(`${code} rereads the picture while retaining the draft, write ID and item location`,async()=>{
 const d=client({post:async()=>{throw new NexusProblem(code,404,{traceId:"synthetic-trace"});}});d.chooseID("CTX-012");const before=d.location.href,input=d.panel().querySelector("textarea");input.value="Kept synthetic draft";input.listeners.input();await submit(d);await flush();
 assert.equal(d.location.href,before);assert.equal(d.panel().querySelector("textarea").value,"Kept synthetic draft");const sent=d.calls.find(c=>c.method==="POST");assert.equal(JSON.parse(d.values.get(storageKey(project+":comment:"+place+":CTX-012"))).write,sent.write);
 assert.equal(d.calls.filter(c=>c.method==="POST").length,1);assert.equal(d.calls.filter(c=>c.method==="GET").length,1);assert.ok(d.calls.find(c=>c.method==="GET").path.includes("/pictures/"));assert.ok(d.panel().textContent.includes("synthetic-trace"));d.controller.close();
});

for(const lang of["en","ko"])for(const closed_as of["answered","decided"])test(`closed ${closed_as} ${lang} summary stays visible and its reply waits for the held full read`,async()=>{
 const id="nc_aaaaaaaaaaaa",summary={id,item:"CTX-012",closed_as,last_at:"2026-11-05T00:00:00Z"},before=JSON.stringify(summary);let finish;
 const gate=new Promise(resolve=>{finish=resolve;}),d=client({closed:[summary],lang,hash:"#comment="+id,get:()=>gate});
 const expected=lang==="ko"?(closed_as==="answered"?"답이 나서 닫힘.":"결정으로 닫힘."):(closed_as==="answered"?"Closed as answered.":"Closed with a decision.");
 assert.ok(d.panel().querySelector("h2").textContent.includes("CTX-012"));assert.ok(d.panel().textContent.includes(expected));
 assert.equal(d.panel().querySelectorAll(".skeleton").length,1);assert.equal(d.panel().querySelectorAll("small").length,1,"only the reply counter, no invented comment author/time");
 const input=d.panel().querySelector("textarea"),send=d.panel().querySelector("form").querySelector("button");assert.equal(input.readOnly,false);assert.equal(send.disabled,true);
 input.value="Ready while loading";input.listeners.input();await submit(d);assert.equal(d.calls.filter(c=>c.method==="POST").length,0);
 const write=JSON.parse(d.values.get(storageKey(project+":reply:"+id))).write;
 finish({...summary,part:"sample",stage:"01-domain",commit:"a".repeat(40),state:"closed",text:"The full original comment",author:"agent",made_at:summary.last_at,replies:[],decisions:[],proposals:[]});await flush();
 assert.equal(d.panel().querySelector("textarea").value,"Ready while loading");assert.equal(d.panel().querySelector("form").querySelector("button").disabled,false);assert.equal(JSON.parse(d.values.get(storageKey(project+":reply:"+id))).write,write);assert.equal(JSON.stringify(summary),before);d.controller.close();
});

for(const lang of["en","ko"])test(`accepted ${lang} proposal held read uses the reflection's supplied summary without inventing its source text`,async()=>{
 const id="np_aaaaaaaaaaaa",proposal={id,part:"sample",stage:"01-domain",commit:"a".repeat(40),items:["CTX-012"],reason:"The cached synthetic reason",change:"The cached synthetic change",source_text_chars:75,comment:null,discrepancy:null,state:"accepted",made_at:"2026-11-05T00:00:00Z",closed_at:"2026-11-05T00:01:00Z",edit:"ne_aaaaaaaaaaaa"};
 const edit={id:proposal.edit,state:"pending",proposal},before=JSON.stringify(edit);let finish;const gate=new Promise(resolve=>{finish=resolve;});
 const d=client({reflections:[edit],lang,hash:"#proposal="+id,get:()=>gate});
 assert.ok(d.panel().querySelector("h2").textContent.includes("CTX-012"));assert.ok(d.panel().textContent.includes(proposal.reason));assert.ok(d.panel().textContent.includes(proposal.change));assert.ok(d.panel().textContent.includes("75"));
 assert.ok(d.panel().textContent.includes(lang==="ko"?"받음, 아직 반영 전.":"Accepted, not yet reflected."));assert.equal(d.panel().querySelectorAll(".skeleton").length,1);assert.equal(d.panel().querySelectorAll("pre").length,0);assert.equal(d.calls.length,1);
 finish({...proposal,source_text:"The fetched stage source"});await flush();assert.ok(d.panel().textContent.includes("The fetched stage source"));assert.equal(d.panel().querySelectorAll(".skeleton").length,0);assert.equal(JSON.stringify(edit),before);d.controller.close();
});

const replyComment=extra=>({id:"nc_aaaaaaaaaaaa",part:"sample",stage:"01-domain",item:"CTX-012",quote:"Picture drawn",commit:"a".repeat(40),text:"The original comment",author:"user",state:"open",waits:"agent",made_at:"2026-11-05T00:00:00Z",replies:[],decisions:[],proposals:[],...extra});
const writeReply=async(d,text)=>{const input=d.panel().querySelector("textarea");input.value=text;input.listeners.input();await submit(d);};
const newCommentButton=d=>d.panel().querySelectorAll("button").find(b=>["Leave a new comment","새 의견 남기기"].includes(b.textContent));
const replyKey=c=>storageKey(project+":reply:"+c.id);
const transferKey=(c,write)=>storageKey(project+":comment-from-reply:"+c.id+":"+write);

for(const lang of["en","ko"])test(`reply_limit ${lang} explicit transfer is local, preserves normal drafts and sends the original named target with a new ID`,async()=>{
 const c=replyComment(),stableKey=storageKey(project+":comment:"+place+":CTX-012"),ownerKey=storageKey(ownedScope("CTX-012")),values=new Map([[stableKey,stored("Existing item draft","nw_vvvvvvvvvvvv")],[ownerKey,stored("Existing owner draft","nw_yyyyyyyyyyyy")]]),normalBefore=[values.get(stableKey),values.get(ownerKey)];
 const d=client({values,lang,hash:"#comment="+c.id,get:(path,data)=>path.includes("/comments/")?c:data,post:async options=>{if(!Object.hasOwn(options.body,"item"))throw new NexusProblem("reply_limit",409,{limit:200});return{id:"nc_bbbbbbbbbbbb"};}});await flush();
 await writeReply(d,"Keep the failed reply as a new comment");const failed=d.calls.find(v=>v.method==="POST"),source=values.get(replyKey(c)),before=d.calls.length;
 assert.ok(newCommentButton(d));newCommentButton(d).listeners.click();
 assert.equal(d.calls.length,before,"explicit local transfer must not send or read HTTP");assert.equal(d.location.hash,"#item=CTX-012");assert.ok(d.panel().textContent.includes("CTX-012"));assert.equal(d.panel().querySelector("textarea").value,"Keep the failed reply as a new comment");
 assert.equal(values.get(replyKey(c)),source);assert.deepEqual([values.get(stableKey),values.get(ownerKey)],normalBefore);
 const transferred=JSON.parse(values.get(transferKey(c,failed.write)));assert.notEqual(transferred.write,failed.write);assert.equal(transferred.settles,false);
 await submit(d);const sent=d.calls.filter(v=>v.method==="POST").at(-1);assert.deepEqual(JSON.parse(JSON.stringify(sent.body)),{part:c.part,stage:c.stage,item:c.item,quote:c.quote,commit:c.commit,text:"Keep the failed reply as a new comment"});assert.equal(sent.write,transferred.write);
 assert.equal(values.has(replyKey(c)),false);assert.equal(values.has(transferKey(c,failed.write)),false);assert.deepEqual([values.get(stableKey),values.get(ownerKey)],normalBefore);d.controller.close();
});

test("reply transfer edits survive failure, refresh and navigation; a newer source reply is never consumed",async()=>{
 const c=replyComment();let fail=true;const d=client({hash:"#comment="+c.id,get:(path,data)=>path.includes("/comments/")?c:data,post:async options=>{if(!Object.hasOwn(options.body,"item"))throw new NexusProblem("reply_limit",409,{limit:200});if(fail)throw new NexusProblem("network");return{};}});await flush();
 await writeReply(d,"Original reply text");const failed=d.calls.find(v=>v.method==="POST"),source=d.values.get(replyKey(c));newCommentButton(d).listeners.click();await writeReply(d,"Edited only in the transfer box");
 const key=transferKey(c,failed.write),transferred=d.values.get(key);assert.equal(typeof transferred,"string");assert.equal(d.values.get(replyKey(c)),source);await d.controller.refresh();assert.equal(d.panel().querySelector("textarea").value,"Edited only in the transfer box");assert.equal(d.values.get(key),transferred);
 d.chooseID("CTX-014");assert.equal(d.values.get(key),transferred);d.navigate("#comment="+c.id);await flush();await submit(d);const before=d.calls.length;newCommentButton(d).listeners.click();assert.equal(d.calls.length,before);assert.equal(d.panel().querySelector("textarea").value,"Edited only in the transfer box");assert.equal(d.values.get(key),transferred);
 d.values.set(replyKey(c),stored("A newer reply kept elsewhere","nw_xxxxxxxxxxxx"));fail=false;await submit(d);assert.equal(JSON.parse(d.values.get(replyKey(c))).text,"A newer reply kept elsewhere");assert.equal(d.values.has(key),false);d.controller.close();
});

test("a preserved transfer draft is recovered after reload only through the same explicit reply_limit action",async()=>{
 const c=replyComment(),values=new Map([[replyKey(c),stored("The original persisted reply","nw_zzzzzzzzzzzz")],[transferKey(c,"nw_zzzzzzzzzzzz"),stored("An independently edited transfer","nw_yyyyyyyyyyyy")]]),before=JSON.stringify([...values]);
 const d=client({values,hash:"#comment="+c.id,get:()=>c,post:async()=>{throw new NexusProblem("reply_limit",409,{limit:200});}});await flush();assert.equal(JSON.stringify([...values]),before);assert.equal(d.calls.filter(v=>v.method==="POST").length,0);
 await submit(d);const count=d.calls.length;newCommentButton(d).listeners.click();assert.equal(d.calls.length,count);assert.equal(d.panel().querySelector("textarea").value,"An independently edited transfer");assert.equal(JSON.parse(values.get(replyKey(c))).text,"The original persisted reply");assert.equal(JSON.parse(values.get(transferKey(c,"nw_zzzzzzzzzzzz"))).write,"nw_yyyyyyyyyyyy");d.controller.close();
});

test("a reply transfer keeps an off-picture part, stage, quote and displayed commit instead of substituting current picture fields",async()=>{
 const c=replyComment({part:"other-part",stage:"05-erd",item:"TBL-099",quote:"An old table field",commit:"b".repeat(40)}),d=client({hash:"#comment="+c.id,get:(path,data)=>path.includes("/comments/")?c:data,post:async options=>{if(!Object.hasOwn(options.body,"item"))throw new NexusProblem("reply_limit",409,{limit:200});return{};}});await flush();
 await writeReply(d,"Keep this target");const count=d.calls.length;newCommentButton(d).listeners.click();assert.equal(d.calls.length,count);assert.ok(d.panel().textContent.includes("TBL-099"));assert.ok(d.panel().querySelectorAll("a").some(a=>a.href?.includes("/other-part/05-erd")));
 await submit(d);const sent=d.calls.filter(v=>v.method==="POST").at(-1);assert.deepEqual(JSON.parse(JSON.stringify(sent.body)),{part:c.part,stage:c.stage,item:c.item,quote:c.quote,commit:c.commit,text:"Keep this target"});d.controller.close();
});

for(const changed of["text","write"])test(`a concurrent source ${changed} change survives a successful transferred comment acknowledgement`,async()=>{
 const c=replyComment();let finish;const d=client({hash:"#comment="+c.id,get:(path,data)=>path.includes("/comments/")?c:data,post:async options=>{if(!Object.hasOwn(options.body,"item"))throw new NexusProblem("reply_limit",409,{limit:200});return new Promise(resolve=>{finish=resolve;});}});await flush();
 await writeReply(d,"The source reply");const source=JSON.parse(d.values.get(replyKey(c)));newCommentButton(d).listeners.click();const sending=submit(d);await flush();
 const newer={...source,[changed]:changed==="text"?"A source text edited while posting":"nw_xxxxxxxxxxxx"};d.values.set(replyKey(c),JSON.stringify(newer));finish({});await sending;
 assert.deepEqual(JSON.parse(d.values.get(replyKey(c))),newer);assert.equal(d.calls.filter(v=>v.method==="POST").length,2);d.controller.close();
});

test("an off-part transfer never borrows this picture's same-ID title or comments, including after success",async()=>{
 const c=replyComment({part:"other-part"}),d=client({comments:[{id:"nc_bbbbbbbbbbbb",item:c.item,text:"Only the current part's comment"}],hash:"#comment="+c.id,get:(path,data)=>path.includes("/comments/")?c:data,post:async options=>{if(!Object.hasOwn(options.body,"item"))throw new NexusProblem("reply_limit",409,{limit:200});return{};}});await flush();
 await writeReply(d,"The other part's new comment");newCommentButton(d).listeners.click();
 for(const unwanted of["Only the current part's comment","Drawing","No comments on"] )assert.equal(d.panel().textContent.includes(unwanted),false);
 assert.equal(d.panel().querySelectorAll("ul").length,0);assert.ok(d.panel().querySelectorAll("a").some(a=>a.href?.includes("/other-part/01-domain")));
 await submit(d);assert.equal(d.panel().querySelector("textarea").value,"");assert.equal(d.panel().querySelectorAll("ul").length,0);assert.ok(d.panel().querySelectorAll("a").some(a=>a.href?.includes("/other-part/01-domain")));d.controller.close();
});

const gonePicture=(data)=>({...data,comments:{entries:[]},closed_comments:{entries:[]},proposals:[],reflections:[]});
const pictureReads=d=>d.calls.filter(v=>v.method==="GET"&&v.path.includes("/pictures/"));
function assertGonePanel(d,kind,lang,trace){
 assert.equal(d.panel().querySelector("h2").textContent,words(kind+"_not_found",lang));assert.ok(d.panel().textContent.includes(trace));
 assert.ok(d.panel().querySelectorAll("button").some(b=>b.textContent===words("Back to the picture",lang)));
 const writes=["Reply","답글 남기기","Reply and open again","답글 달고 다시 열기","Answered","답이 나옴","Accept","받기","Dismiss","버리기","Dismiss the reflection","반영 버리기"];
 assert.ok(d.panel().querySelectorAll("button").filter(b=>writes.includes(b.textContent)).every(b=>b.disabled));assert.equal(pictureReads(d).length,1);
}
for(const lang of["en","ko"])for(const operation of["read","reply","answered"])for(const code of(operation==="read"?["comment_not_found","project_not_found"]:["comment_not_found","project_not_found","space_not_found"]))test(`SCR107 ${lang} ${operation}/${code} has one picture reread, typed gone state and copyable same-ID reply draft`,async()=>{
 const c=replyComment({quote:null}),trace=operation+"-"+code,key=replyKey(c),values=new Map([[key,stored("Keep this reply to copy","nw_zzzzzzzzzzzz")]]),before=values.get(key);
 const entry={...c,replies:0,last_reply:null};delete entry.decisions;
 const d=client({values,comments:[entry],lang,hash:"#comment="+c.id,get:(path,data)=>path.includes("/pictures/")?gonePicture(data):operation==="read"?Promise.reject(new NexusProblem(code,404,{traceId:trace})):c,post:async()=>{throw new NexusProblem(code,404,{traceId:trace});}});await flush();
 if(operation==="reply")await submit(d);
 if(operation==="answered")await d.panel().querySelectorAll("button").find(b=>b.textContent===(lang==="ko"?"답이 나옴":"Answered")).listeners.click();
 await flush();assertGonePanel(d,"comment",lang,trace);assert.deepEqual(JSON.parse(values.get(key)),JSON.parse(before));assert.equal(d.panel().querySelector("textarea").value,"Keep this reply to copy");assert.equal(d.panel().querySelector("textarea").readOnly,false);
 assert.equal(d.calls.filter(v=>v.method==="GET"&&v.path.includes("/comments/")).length,1);assert.equal(d.calls.filter(v=>v.method==="POST").length,operation==="read"?0:1);
 if(operation==="answered"){const sent=d.calls.find(v=>v.method==="POST");assert.equal(JSON.parse(values.get(storageKey(project+":answered:"+c.id))).write,sent.write);}
 await submit(d);assert.equal(d.calls.filter(v=>v.method==="POST").length,operation==="read"?0:1,"the copy form cannot post to the missing comment");d.controller.close();
});

const goneProposal=()=>({id:"np_aaaaaaaaaaaa",part:"sample",stage:"01-domain",commit:"a".repeat(40),items:["CTX-012"],reason:"The original reason",change:"The original change",source_text_chars:20,source_text:"The original source",comment:null,discrepancy:null,state:"open",made_at:"2026-11-05T00:00:00Z",closed_at:null,edit:null});
for(const lang of["en","ko"])for(const operation of["read-proposal","read-edit","accept","dismiss","dismiss-edit"])for(const code of[operation.includes("edit")?"edit_not_found":"proposal_not_found","project_not_found"])test(`SCR108 ${lang} ${operation}/${code} shows the typed gone panel, no active target action and one picture reread`,async()=>{
 const proposal=goneProposal(),edit={id:"ne_aaaaaaaaaaaa",proposal,state:"needs-user",pull_request:null,closed_commit:null};if(operation.includes("edit")){proposal.state="accepted";proposal.edit=edit.id;}
 const entry={...proposal};delete entry.source_text;const cached=operation==="read-edit"?[]:[entry],reflections=operation==="dismiss-edit"?[edit]:[],trace=operation+"-"+code;
 const d=client({proposals:cached,reflections,lang,hash:"#proposal="+proposal.id,get:(path,data)=>{if(path.includes("/pictures/"))return gonePicture(data);if(operation==="read-proposal"||path.includes("/edits/"))throw new NexusProblem(code,404,{traceId:trace});return proposal;},post:async()=>{throw new NexusProblem(code,404,{traceId:trace});}});await flush();
 if(!operation.startsWith("read-")){
  const label=operation==="accept"?(lang==="ko"?"받기":"Accept"):operation==="dismiss"?(lang==="ko"?"버리기":"Dismiss"):(lang==="ko"?"반영 버리기":"Dismiss the reflection");
  await d.panel().querySelectorAll("button").find(b=>b.textContent===label).listeners.click();await flush();
  const sent=d.calls.find(v=>v.method==="POST"),scope=operation==="accept"?"accept:"+proposal.id:operation==="dismiss"?"dismiss-proposal:"+proposal.id:"dismiss-edit:"+edit.id;
  assert.equal(JSON.parse(d.values.get(storageKey(project+":"+scope))).write,sent.write);assert.equal(d.calls.filter(v=>v.method==="POST").length,1);
 }else assert.equal(d.calls.filter(v=>v.method==="POST").length,0);
 assertGonePanel(d,operation.includes("edit")?"edit":"proposal",lang,trace);
 assert.equal(d.calls.filter(v=>v.method==="GET"&&v.path.includes("/proposals/")).length,1);
 assert.equal(d.calls.filter(v=>v.method==="GET"&&v.path.includes("/edits/")).length,operation==="read-edit"?1:0);d.controller.close();
});

test("an obsolete nested reflection refusal cannot replace the same proposal's newer successful render",async()=>{
 const p=goneProposal();p.state="accepted";p.edit="ne_aaaaaaaaaaaa";let rejectOld,edits=0;
 const gate=new Promise((_,reject)=>{rejectOld=reject;}),d=client({hash:"#proposal="+p.id,get:(path,data)=>{if(path.includes("/pictures/"))return data;if(path.includes("/edits/"))return ++edits===1?gate:{id:p.edit,state:"pending",pull_request:null,closed_commit:null};return p;}});await flush();
 await d.controller.refresh();await flush();assert.ok(d.panel().textContent.includes("Accepted, not yet reflected."));const before=pictureReads(d).length;
 rejectOld(new NexusProblem("edit_not_found",404,{traceId:"obsolete-reflection"}));await flush();assert.ok(d.panel().textContent.includes("Accepted, not yet reflected."));assert.equal(d.panel().textContent.includes("obsolete-reflection"),false);assert.equal(pictureReads(d).length,before);d.controller.close();
});

test("a late reply refusal preserves its source draft without replacing a different item opened meanwhile",async()=>{
 const c=replyComment();let reject;const d=client({hash:"#comment="+c.id,get:(path,data)=>path.includes("/comments/")?c:data,post:()=>new Promise((_,fail)=>{reject=fail;})});await flush();
 const sending=writeReply(d,"The pending reply to keep");await flush();const before=JSON.parse(d.values.get(replyKey(c)));d.chooseID("CTX-014");reject(new NexusProblem("comment_not_found",404,{traceId:"old-comment"}));await sending;
 assert.ok(d.panel().querySelector("h2").textContent.startsWith("CTX-014"));assert.deepEqual(JSON.parse(d.values.get(replyKey(c))),before);assert.equal(pictureReads(d).length,1);assert.equal(d.calls.filter(v=>v.method==="GET"&&v.path.includes("/comments/")).length,1);d.controller.close();
});

test("a pending proposal read cannot reactivate reflection actions after a typed write refusal",async()=>{
 const p=goneProposal();p.state="accepted";p.edit="ne_aaaaaaaaaaaa";const entry={...p};delete entry.source_text;let finish;
 const gate=new Promise(resolve=>{finish=resolve;}),d=client({reflections:[{id:p.edit,state:"needs-user",proposal:entry}],hash:"#proposal="+p.id,get:(path,data)=>path.includes("/pictures/")?gonePicture(data):gate,post:async()=>{throw new NexusProblem("edit_not_found",404,{traceId:"missing-reflection"});}});
 await d.panel().querySelectorAll("button").find(b=>b.textContent==="Dismiss the reflection").listeners.click();assertGonePanel(d,"edit","en","missing-reflection");finish(p);await flush();assertGonePanel(d,"edit","en","missing-reflection");assert.equal(pictureReads(d).length,1);d.controller.close();
});

test("a typed write refusal still closes the same target when its pending proposal read finished first",async()=>{
 const p=goneProposal();p.state="accepted";p.edit="ne_aaaaaaaaaaaa";const entry={...p};delete entry.source_text;let finish,reject;
 const gate=new Promise(resolve=>{finish=resolve;}),d=client({reflections:[{id:p.edit,state:"needs-user",proposal:entry}],hash:"#proposal="+p.id,get:(path,data)=>path.includes("/pictures/")?gonePicture(data):gate,post:()=>new Promise((_,fail)=>{reject=fail;})});
 const sending=d.panel().querySelectorAll("button").find(b=>b.textContent==="Dismiss the reflection").listeners.click();await flush();finish(p);await flush();reject(new NexusProblem("edit_not_found",404,{traceId:"gone-after-read"}));await sending;
 assertGonePanel(d,"edit","en","gone-after-read");assert.equal(d.calls.filter(v=>v.method==="POST").length,1);d.controller.close();
});

for(const kind of["comment","proposal"])test(`an undeclared ${kind} read space_not_found is not expanded into its typed gone contract`,async()=>{
 const id=kind==="comment"?"nc_aaaaaaaaaaaa":"np_aaaaaaaaaaaa",d=client({hash:"#"+kind+"="+id,get:async()=>{throw new NexusProblem("space_not_found",404,{traceId:"not-a-declared-read-code"});}});await flush();
 assert.equal(pictureReads(d).length,0);assert.ok(d.panel().textContent.includes("not-a-declared-read-code"));assert.equal(d.panel().querySelectorAll("button").some(b=>b.textContent===words("Back to the picture","en")),false);d.controller.close();
});
