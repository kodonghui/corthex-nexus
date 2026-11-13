// TASK-300: the stage's open checkpoint request shown whole in the stage's record (SCR-112,
// SCR-113, SPEC-139), and the thing to look at first in the record and on the request's entry
// in the talk (SCR-114#normal, rule 22), drawn by the functions that the server and the view
// share. These tests read the drawing as text; the browser suites stage-regression.mjs and
// talk-regression.mjs run the view's code.
import test from "node:test";
import assert from "node:assert/strict";
import {esc} from "../src/draw/html.js";
import {label,labels} from "../src/draw/words.js";
import {drawEntry,drawTalk,entryOf,requestOf,stageRequest,lookFirst} from "../src/draw/talk.js";
import {drawRecord,drawSide} from "../src/draw/stage.js";

const AT="2026-11-11T13:40:00.000Z",LATER="2026-11-12T09:05:00.000Z",COMMIT="5b7c2e90123456789abcdef0123456789abcdef0";
const ADDRESS="https://preview.example.com/qa/screens/orders?state=empty&width=390";
const request=(extra={})=>({id:"nc_"+"r".repeat(12),part:"sample",stage:"04-functional-spec",item:"",quote:null,discrepancy:null,author:"agent",
  text:"Stage 04 is ready for its checkpoint.\nWhat changes for you: <b>three</b> specs.\n\nLook at SPEC-194 first.",state:"open",closed_as:null,waits:"user",asks:"checkpoint",
  made_at:AT,last_at:AT,commit:COMMIT,settled:false,dismissed:false,replies:0,last_reply:null,look_first:"SPEC-194",claim:null,...extra});
const question=(extra={})=>request({id:"nc_"+"q".repeat(12),item:"SPEC-101",asks:"answer",look_first:null,text:"A question",...extra});
const talk=(...mine)=>({project:"qa-shop",part:"sample",stage:"04-functional-spec",item:null,mine:{total:mine.length,entries:mine.map(comment=>({kind:"comment",comment,proposal:null}))},
  agent:{total:0,entries:[]},apart:{total:0,entries:[]},closed:{total:0,entries:[]},reflections:[]});
// The stage's data as API-158 answers it, with the record's counts of what is left.
const data=({commit=COMMIT,comments=4,discrepancies=2,reflections=1}={})=>({project:{name:"qa-shop",title:null,repository:null,commit,generated_at:AT,pushed_at:AT,space:true,read_at:null,unread_since:null,parts:["sample"]},
  part:"sample",stage:"04-functional-spec",head:{key:"04-functional-spec",state:"in_progress",checkpoint:null,commit,time:AT,reads:true,source_state:"found",counts:{items:0,kinds:[],priorities:[],hotspots:null},picture:false},
  record:{project:"qa-shop",part:"sample",stage:"04-functional-spec",record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],
    discrepancies:{total:discrepancies,entries:[]},comments:{total:comments,entries:[]},reflections:{total:reflections,entries:[]},checkpoints:[],warnings:[],not_opened:0},
  stages:[],items:{group:"context",filter:"all",q:null,total:0,after:0,counts:{all:0,talk:0,mine:0,left:0},groups:[],entries:[]}});
const between=(html,from,to)=>html.slice(html.indexOf(from),to?html.indexOf(to,html.indexOf(from)):undefined);

// Every element that the code compares when it draws again has a key, unique among its
// siblings (../ui/reconcile.js), as draw-stage.test.js checks.
const VOID=new Set(["input","br","img","hr","meta","link","source","wbr"]);
function assertKeyed(html,where){
  const pattern=/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:="[^"]*")?)*)\s*(\/?)>/g,stack=[{sub:true,keys:new Set()}];
  for(const [,close,tag,attributes,self]of html.matchAll(pattern)){
    if(close){stack.pop();continue;}
    const parent=stack.at(-1);
    if(parent.sub){
      const key=/\sdata-nx-key="([^"]*)"/.exec(attributes)?.[1];
      assert.notEqual(key,undefined,`${where}: <${tag}${attributes}> has no key`);
      assert.ok(!parent.keys.has(key),`${where}: the key ${key} twice`);parent.keys.add(key);
    }
    if(!self&&!VOID.has(tag))stack.push({sub:/\sdata-nx-sub(?=\s|=|$)/.test(attributes),keys:new Set()});
  }
  assert.equal(stack.length,1,where+": balanced");
}

test("a checkpoint request's last entry: the comment's own text, or the agent's last reply that asks again (SPEC-197)",()=>{
  assert.deepEqual(requestOf(request()),{place:0,text:request().text,made_at:AT,look_first:"SPEC-194"});
  const again=request({replies:2,last_at:LATER,last_reply:{seq:2,author:"agent",text:"Asked again after the fix.",made_at:LATER,settles:false,look_first:ADDRESS}});
  assert.deepEqual(requestOf(again),{place:2,text:"Asked again after the fix.",made_at:LATER,look_first:ADDRESS},"the agent's reply that asks again is the last entry, with its own thing to look at first");
  assert.deepEqual(requestOf(request({look_first:null})),{place:0,text:request().text,made_at:AT,look_first:null},"a request stored before the revision has nothing to look at first");
  for(const other of[question(),request({asks:"recommended"}),request({asks:null,waits:"agent"}),request({item:"SPEC-101"}),request({state:"closed"}),null,undefined])
    assert.equal(requestOf(other),null,"only an open comment on the stage as a whole that asks for the checkpoint: "+JSON.stringify(other?.asks));
  const both=talk(request(),question());
  assert.equal(stageRequest(both).comment.id,request().id);
  assert.equal(stageRequest(both).place,0);
  assert.equal(stageRequest(talk(question())),null);
  assert.equal(stageRequest(null),null);
  assert.equal(stageRequest({mine:{total:1,entries:[{kind:"proposal",comment:null,proposal:{id:"np_"+"a".repeat(12)}}]}}),null);
});

test("the thing to look at first: an item's ID to its panel, an address as text that opens only in a new tab without a referrer (rule 22)",()=>{
  for(const lang of["en","ko"]){
    const name=esc(label("A checkpoint request, whole",0,lang));
    assert.equal(lookFirst("SPEC-194",lang,"rec-look"),`<p class="look" data-nx-key="look"><span class="mu">${name}</span> <a class="lnk" href="#item=SPEC-194" data-nx-act="look" data-nx-item="SPEC-194" data-nx-focus="rec-look"><span class="mono">SPEC-194</span></a></p>`);
    const address=lookFirst(ADDRESS,lang,"x:look");
    assert.equal(address,`<p class="look" data-nx-key="look"><span class="mu">${name}</span> <a class="lnk" href="${esc(ADDRESS)}" target="_blank" rel="noopener noreferrer" data-nx-focus="x:look">${esc(ADDRESS.slice(8))}</a></p>`,"its host and what follows, never loaded: no image, frame or preview");
    assert.ok(!/<(?:img|iframe|link|object|embed)\b/.test(address)&&!address.includes("data-nx-act"),"the page's code leaves an address to the browser");
    const long="https://preview.example.com/"+"a".repeat(200),cut=lookFirst(long,lang,"x");
    assert.ok(cut.includes(`>${"preview.example.com/"+"a".repeat(100)}…</a>`)&&cut.includes(`href="${long}"`),"an address shows 120 characters and the whole address opens");
    const wide="https://例え.example/"+"한😀".repeat(70);
    assert.ok(lookFirst(wide,lang,"x").includes(`>${Array.from(wide.slice(8)).slice(0,120).join("")}…</a>`),"counted by characters, not by UTF-16 units");
  }
  for(const bad of["http://example.com/x","javascript:alert(1)","https://example.com/a b",'https://example.com/"x',"spec-194","SPEC-1234567","SPEC-",`${"A".repeat(30)}-1`,"",null,undefined,42,{id:"SPEC-1"}])
    assert.equal(lookFirst(bad,"en","x"),"","nothing for "+JSON.stringify(bad));
});

test("a checkpoint request's entry in my turn shows what to look at first after its text and last reply (SCR-114#normal)",()=>{
  for(const lang of["en","ko"]){
    const entry=entryOf({kind:"comment",comment:request(),proposal:null}),html=drawEntry(entry,"mine",lang,{},true);
    const look=lookFirst("SPEC-194",lang,`${request().id}:look`);
    assert.ok(html.includes(`</p>${look}<div class="acts" data-nx-key="acts">`),"after the text, before the answers");
    assert.ok(html.includes(`<p class="tx" id="tx-${esc(request().id)}" data-nx-key="tx">${esc(request().text)}</p>`),"its text whole");
    const again=request({replies:1,last_reply:{seq:1,author:"agent",text:"Asked again.",made_at:LATER,settles:false,look_first:ADDRESS}});
    const replied=drawEntry(entryOf({kind:"comment",comment:again,proposal:null}),"mine",lang,{},true);
    assert.ok(replied.includes(`Asked again.</p></div></div>${lookFirst(ADDRESS,lang,`${again.id}:look`)}`),"the last reply's thing to look at first, after the last reply");
    assert.ok(!replied.includes("#item=SPEC-194"),"not the comment's own any more");
    const plain=drawEntry(entryOf({kind:"comment",comment:request({look_first:null}),proposal:null}),"mine",lang,{},true);
    assert.ok(!plain.includes('class="look"'),"a request stored without the form shows as it is");
    assert.ok(!drawEntry(entryOf({kind:"comment",comment:question({look_first:"SPEC-101"}),proposal:null}),"mine",lang,{},true).includes('class="look"'),"only a checkpoint request");
    assert.ok(!drawEntry(entryOf(request({asks:null,waits:"agent"})),"agent",lang,{},true).includes('class="look"'),"nor an entry of the agent's turn");
    const copy=drawEntry(entry,"mine",lang,{},true,true);
    assert.ok(copy.includes(`data-nx-focus="${esc(request().id)}:look:2"`),"an entry drawn twice names its link apart");
    for(const shown of[talk(request(),question()),talk(again)])assertKeyed(drawTalk(shown,{stage:"04-functional-spec"},lang,{},true),"talk "+lang);
  }
});

test("the stage's record shows the open checkpoint request whole above the words box (SCR-112, SCR-113, SPEC-139)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("A checkpoint request, whole",lang),record=drawRecord(data(),lang,{},talk(question(),request()));
    const box=between(record,'<div class="rq"','<div class="pnote"');
    assert.ok(record.includes(`<h3 data-nx-key="ph">${esc(labels("The stage record",lang)[3])}</h3><div class="rq" data-nx-key="rq" data-nx-sub>`),"under the pass's heading");
    assert.ok(record.indexOf('<div class="rq"')<record.indexOf('<div class="pnote"')&&record.indexOf('<div class="pnote"')<record.indexOf('id="cp-words"'),"above a pass's message and the words box");
    assert.ok(box.startsWith(`<div class="rq" data-nx-key="rq" data-nx-sub><div class="hd" data-nx-key="rqh"><span class="kind acc">${esc(labels("An entry's kind",lang)[3])}</span><span class="who">${esc(labels("Author and time",lang)[0])} · <time datetime="${AT}">2026-11-11 13:40</time></span></div>`),"Checkpoint, the agent and its time");
    assert.ok(box.includes(`<p class="tx" data-nx-key="rqt">${esc(request().text)}</p>`),"the last entry's whole text, its lines kept");
    assert.ok(box.includes(lookFirst("SPEC-194",lang,"rec-look")),"what to look at first");
    assert.ok(box.includes(`<p class="rqc" data-nx-key="commit">${esc(label("The head",2,lang,{commit:"5b7c2e9"}))}</p>`),"the project's commit, which a pass is to name");
    assert.ok(box.includes(`<p class="rql" data-nx-key="rql"><span class="mu">${esc(words[1])}</span> ${[label("A checkpoint request, whole",2,lang,{n:"2"}),label("A checkpoint request, whole",3,lang,{n:"3"}),label("A checkpoint request, whole",4,lang,{n:"1"})].map((part,index)=>`<span class="c">${esc(part)}${index<2?" ·":""}</span>`).join(" ")}</p></div>`),"what is left, the request left out of the open comments");
    assert.ok(box.indexOf('class="look"')<box.indexOf('class="rqc"')&&box.indexOf('class="rqc"')<box.indexOf('class="rql"'),"in the order of stage 08's layouts");
    assertKeyed(record,"record "+lang);
    // The agent's reply that asks again is the request's last entry.
    const again=request({replies:3,last_reply:{seq:3,author:"agent",text:"Asked again.\nNow with the empty state.",made_at:LATER,settles:false,look_first:ADDRESS}});
    const replied=drawRecord(data(),lang,{},talk(again));
    assert.ok(replied.includes(`<time datetime="${LATER}">2026-11-12 09:05</time>`)&&replied.includes(`<p class="tx" data-nx-key="rqt">Asked again.\nNow with the empty state.</p>`)&&replied.includes(lookFirst(ADDRESS,lang,"rec-look"))&&!replied.includes(esc("Stage 04 is ready")),"the reply's time, text and address");
    // As it is: without the form, without a commit, and with nothing left.
    const plain=drawRecord(data({commit:null,comments:1,discrepancies:0,reflections:0}),lang,{},talk(request({look_first:null})));
    assert.ok(plain.includes('<div class="rq"')&&!plain.includes('class="look"')&&!plain.includes('class="rqc"'),"a request stored without the form, of a snapshot without a commit");
    assert.ok(plain.includes([label("A checkpoint request, whole",2,lang,{n:"0"}),label("A checkpoint request, whole",3,lang,{n:"0"}),label("A checkpoint request, whole",4,lang,{n:"0"})].map((part,index)=>`<span class="c">${esc(part)}${index<2?" ·":""}</span>`).join(" ")),"nothing left, each count whole on its line");
    assert.ok(drawRecord(data({comments:0}),lang,{},talk(request())).includes(esc(label("A checkpoint request, whole",3,lang,{n:"0"}))),"a count read before the request came never goes below 0");
    // Without an open request the record is as before.
    for(const none of[talk(question()),talk(),null])assert.ok(!drawRecord(data(),lang,{},none).includes('class="rq"'),"no request");
    assert.equal(drawRecord(data(),lang,{},talk(question())),drawRecord(data(),lang),"the record without a request is the record of before");
    // The side passes the page's whole talk to the record.
    assert.equal(drawSide(data(),null,lang,{record:true,recordState:{}},talk(request())),drawRecord(data(),lang,{},talk(request())));
  }
});
