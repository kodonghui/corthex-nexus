// TASK-300: the stage's open checkpoint request shown whole in the stage's record (SCR-112,
// SCR-113, SPEC-139), and the thing to look at first in the record and on the request's entry
// in the talk (SCR-114#normal, rule 22), drawn by the functions that the server and the view
// share. TASK-301: the pass named for the stage while a request is open, the pass off after a
// refusal because the project shows another commit, with its own Load again (SCR-112#stale),
// and what a passed checkpoint's line names (SPEC-194). These tests read the drawing as text;
// the browser suites stage-regression.mjs and talk-regression.mjs run the view's code.
import test from "node:test";
import assert from "node:assert/strict";
import {esc} from "../src/draw/html.js";
import {codeMessage,label,labels} from "../src/draw/words.js";
import {drawEntry,drawTalk,entryOf,requestOf,stageRequest,lookFirst} from "../src/draw/talk.js";
import {drawPassed,drawRecord,drawSide} from "../src/draw/stage.js";

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

test("the pass names the stage while its request is open, and after a refusal because the project shows another commit it stays off with a Load again of its own (SCR-112#stale, SPEC-196)",()=>{
  const pass=html=>/<button class="btn pri" type="button" data-nx-act="pass" data-nx-focus="pass"([^>]*)>([^<]*)<\/button>/.exec(html)?.slice(1);
  for(const lang of["en","ko"]){
    const named=esc(label("The pass",0,lang,{n:"04"}));
    assert.deepEqual(pass(drawRecord(data(),lang,{},talk(request()))),["",named],"Pass the stage 04 checkpoint");
    assert.deepEqual(pass(drawRecord(data(),lang,{},talk(question()))),["",esc(labels("The stage record",lang)[4])],"without a request, as before");
    assert.deepEqual(pass(drawRecord(data(),lang,{sending:"pass"},talk(request()))),[' aria-disabled="true"',esc(codeMessage("Sending",lang))],"while it sends");
    const note={tone:"warn",text:codeMessage("snapshot_changed",lang,{commit:"bbbbbbb"}),trace:"0123456789abcdef-ICN",load:true};
    const stale=drawRecord(data(),lang,{stale:true,passNote:note},talk(request()));
    assert.deepEqual(pass(stale),[' aria-disabled="true"',named],"off until the page is loaded again, still named, never removed");
    const message=between(stale,'<div class="pnote"','<label');
    assert.ok(message.startsWith('<div class="pnote" data-nx-key="pnote"><div class="msg warn" role="status">'),"a warning above the words box");
    assert.ok(message.includes(esc(note.text))&&note.text.includes("bbbbbbb"),"the commit that the project now shows, its first 7 characters");
    assert.ok(message.includes(`<button class="btn sm" type="button" data-nx-act="load" data-nx-focus="pass:load">`)&&message.includes(`${esc(labels("Page buttons",lang)[1])}</button>`),"Load again of its own, since under 1,024 pixels the sheet covers the bar");
    assert.ok(!message.includes('data-nx-act="pass"')&&!message.includes(":retry"),"no Try again: the same pass would be refused again");
    assert.ok(message.includes(esc(codeMessage("Trace ID",lang,{traceId:note.trace}))),"its trace ID");
    assert.equal(pass(drawRecord(data(),lang,{stale:true,over:true},talk(request())))[0],' disabled',"past the limit, disabled as before");
    assertKeyed(stale,"stale "+lang);
  }
});

test("a passed checkpoint's line: the commit that it passed or the snapshot's revision, the request that it answered as a link into the talk, then its kind (SCR-112, SCR-113, SPEC-194)",()=>{
  const sep='<span class="sep" aria-hidden="true">·</span>',comment="nc_"+"r".repeat(12);
  const cp=(extra={})=>({id:"nk_"+"a".repeat(12),part:"sample",stage:"04-functional-spec",commit:COMMIT,revision:null,comment:null,entry:null,words:null,state:"passed",
    passed_at:AT,withdrawn_at:null,pull_request:null,pr_state:null,recorded_commit:null,browser:"safari",device:"phone",driven:false,...extra});
  for(const lang of["en","ko"]){
    const words=labels("The kind of browser and device",lang),kind=`<span>${esc(words[1]+", "+words[6])}</span>`;
    const seen=`<span class="cpc">${esc(label("The head",2,lang,{commit:"5b7c2e9"}))}</span>`;
    const asked=`<span class="cpq"><a class="lnk" href="#talk=${comment}" data-nx-act="answers" data-nx-comment="${comment}" data-nx-focus="answers:${esc("nk_"+"a".repeat(12))}">${esc(label("A passed checkpoint's record",0,lang))}</a></span>`;
    assert.equal(drawPassed(cp(),lang),`<p class="cpk">${seen}${sep}${kind}</p>`,"a pass from the record without a request: the commit, then the kind");
    assert.equal(drawPassed(cp({comment,entry:2}),lang),`<p class="cpk">${seen}${sep}${asked}${sep}${kind}</p>`,"one that answered a request links to it, in the order of stage 08's layouts");
    assert.equal(drawPassed(cp({commit:null,revision:3}),lang),`<p class="cpk"><span class="cpc">${esc(label("A passed checkpoint's record",1,lang,{n:"3"}))}</span>${sep}${kind}</p>`,"Snapshot {n} where the snapshot named no commit");
    // Values out of their form show nothing, and nothing of the text that was sent.
    for(const bad of[{commit:"5B7C2E9"+"0".repeat(33)},{commit:"<b>x</b>"},{commit:null,revision:0},{commit:null,revision:"3"},{commit:null,revision:-1}])
      assert.equal(drawPassed(cp(bad),lang),`<p class="cpk">${kind}</p>`,"no commit line for "+JSON.stringify(bad));
    for(const bad of["nc_RRRRRRRRRRRR","nc_rrrr",'nc_"onclick','<a href="x">',42])
      assert.ok(!drawPassed(cp({comment:bad}),lang).includes("cpq"),"no link for "+JSON.stringify(bad));
    assert.equal(drawPassed(cp({browser:null,device:null,driven:null,comment}),lang),"","a checkpoint passed before the revision shows none of these");
    // In the record, the line follows the date of one that waits for its record and of a withdrawn one.
    const shown={...data(),record:{...data().record,checkpoints:[cp({comment,entry:0}),cp({id:"nk_"+"b".repeat(12),state:"withdrawn",withdrawn_at:LATER})]}};
    const record=drawRecord(shown,lang,{},talk());
    assert.ok(record.includes(`</b><p class="cpk">${seen}${sep}${asked}${sep}${kind}</p>`),"under the date of the one that waits");
    assert.ok(record.includes(`</b><p class="cpk">${seen}${sep}${kind}</p>`),"and of the withdrawn one");
    assertKeyed(record,"record lines "+lang);
  }
});
