// TASK-277: the item's panel in the workspace's side (SCR-115) and the top bar's search
// (SCR-116), drawn by the functions that the view's code uses (../src/draw/item.js,
// ../src/draw/search.js). These tests read the drawing as text; the browser suite
// item-regression.mjs runs the view's code.
import test from "node:test";
import assert from "node:assert/strict";
import {esc,count} from "../src/draw/html.js";
import {icon} from "../src/draw/icons.js";
import {label,labels,codeMessage,oldLabels} from "../src/draw/words.js";
import {words} from "../ui/messages.js";
import {drawItem,itemFieldList,kindWord,KINDS,TRACE_FIRST} from "../src/draw/item.js";
import {drawSearch,matchPath,matchWhere,SEARCH_MIN,SEARCH_MAX} from "../src/draw/search.js";
import {narrowTalk} from "../src/draw/talk.js";
import {drawSide} from "../src/draw/stage.js";
import {drawParts,PAGE_SCHEMAS} from "../src/draw/page.js";
import {itemFields} from "../ui/fields.js";

const AT="2026-11-08T07:00:00.000Z";
const id=(prefix,letter)=>prefix+"_"+letter.repeat(12);
const comment=(letter,extra={})=>({id:id("nc",letter),part:"sample",stage:"02-prd",item:"REQ-001",quote:null,discrepancy:null,author:"user",text:`Text ${letter}`,state:"open",closed_as:null,waits:"agent",asks:null,made_at:AT,last_at:AT,commit:null,settled:false,dismissed:false,replies:0,last_reply:null,proposals:[],claim:null,...extra});
// The stage's talk, narrowed to the item as the side shows it.
const stageTalk=(item="REQ-001")=>narrowTalk({project:"qa-shop",part:"sample",stage:"02-prd",item:null,mine:{total:0,entries:[]},agent:{total:2,entries:[comment("a"),comment("b",{item:"REQ-002"})]},apart:{total:0,entries:[]},closed:{total:0,entries:[]},reflections:[]},item);
const DATA={project:{name:"qa-shop"},part:"sample",stage:"02-prd"};
// API-157's answer for REQ-001: its fields, context, source and trace (SPEC-122).
function answer(over={}){
  const flows=Array.from({length:9},(_,index)=>({id:`FL-${String(index+1).padStart(3,"0")}`,kind:"flow",title:`Flow <${index+1}>`}));
  return{project:"qa-shop",part:"sample",language:"ko",
    item:{id:"REQ-001",kind:"requirement",stage:"02-prd",where:"docs/prd.md:12",title:"The shop <shall> retry a payment.",status:"",priority:"Must",type:"functional",link:"https://example.com/a",parent:undefined},
    context:{id:"CTX-001",title:"Payments"},
    source:{path:"docs/prd.md",line:12,link:"https://github.com/example/qa-shop/blob/"+"a".repeat(40)+"/docs/prd.md#L12",commit:"a".repeat(40)},
    trace:{from:[{stage:"01-domain",total:1,items:[{id:"CTX-001",kind:"context",title:"Payments"}]}],to:[{stage:"03-user-flow",total:120,items:flows},{stage:"04-functional-spec",total:2,items:[{id:"SPEC-001",kind:"spec",title:null},{id:"SPEC-002",kind:"spec",title:"Retry"}]}]},
    comments:stageTalk(),...over};
}
const item=(over={})=>({id:"REQ-001",state:"ready",data:answer(),seed:{kind:"requirement",title:"The shop <shall> retry a payment."},raw:null,discrepancies:[],error:null,why:null,open:{},...over});
const between=(html,from,to)=>{const start=html.indexOf(from);return start<0?"":html.slice(start,to?html.indexOf(to,start+from.length):undefined);};

// Every element that the code compares when it draws again has a key, unique among its
// siblings (../ui/reconcile.js), as draw-talk.test.js checks.
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

test("the item: its head, text, fields, context, source and trace, then its talk and box (SCR-115#normal)",()=>{
  for(const lang of["en","ko"]){
    const html=drawItem(item(),stageTalk(),DATA,lang),tabs=labels("Tabs",lang),fields=labels("List fields",lang);
    assert.ok(html.startsWith('<section class="item" aria-labelledby="item-h" data-nx-key="item:REQ-001" data-nx-sub>'));
    assert.ok(html.includes(`<h2 id="item-h" tabindex="-1" data-nx-focus="item-h"><span class="sr">${esc(tabs[3])} </span><span class="id">REQ-001</span></h2><span class="kind">${esc(kindWord("requirement",lang))}</span>`),"the ID and its kind in words");
    assert.ok(html.includes(`data-nx-act="side" data-nx-side="item" data-nx-focus="side:item" aria-pressed="true">`)&&html.includes(`data-nx-act="side" data-nx-side="talk" data-nx-focus="side:talk" aria-pressed="false">`),"the switch, on the item");
    assert.ok(html.includes(`<span class="seg sw only-pc" data-nx-key="sw">`),"the switch from 1,024 pixels; under it the tabs");
    assert.ok(html.includes(`data-nx-act="item-close" data-nx-focus="item-close">${icon("i-close")}<span class="sr">${esc(labels("Top bar",lang)[5])}</span></button>`));
    assert.ok(html.includes(`<p class="tx" data-nx-key="tx" lang="ko">The shop &lt;shall&gt; retry a payment.</p>`),"its text as the source has it, in the source's language");
    assert.ok(html.includes(`<dl class="fields" data-nx-key="fields"><dt>${esc(fields[0])}</dt><dd>Must</dd><dt>${esc(fields[1])}</dt><dd>${esc(oldLabels("Item values",lang)[0])}</dd><dt>${esc(fields[2])}</dt><dd>functional</dd></dl>`),"the list's main fields in words, None for an empty one, none for a field that the item lacks");
    const details=between(html,'<details class="det"','</details>');
    assert.ok(details.includes(`<span>${esc(oldLabels("Item values",lang)[2])}</span>`)&&details.includes("&quot;link&quot;: &quot;https://example.com/a&quot;"),"the other fields under Details");
    assert.ok(!details.includes("where")&&!details.includes("priority"),"neither the shown fields nor the source's place");
    assert.ok(html.includes(`<p class="ctx" data-nx-key="ctx">${esc(label("The item",0,lang,{id:"CTX-001",name:"Payments"}))}</p>`));
    assert.ok(html.includes(`<a class="lnk" href="https://github.com/example/qa-shop/blob/${"a".repeat(40)}/docs/prd.md#L12" target="_blank" rel="noreferrer" data-nx-focus="item-source">${icon("i-ext")}<span>${esc(label("The item",1,lang,{path:"docs/prd.md",n:12}))}</span></a> <span class="mu cap mono">aaaaaaa</span>`),"the source's place, a link to the file at the commit in a new tab");
    // The trace by stage, with counts; the first six of a stage until the user unfolds it.
    const from=between(html,'<h3 data-nx-key="h-from">','<h3 data-nx-key="h-to">'),to=between(html,'<h3 data-nx-key="h-to">','<section class="itk"');
    assert.ok(from.includes(`${esc(label("The item",2,lang))} <span class="mu">(1)</span></h3>`)&&from.includes(`<p class="sgh"><span>01 ${esc(label("Stage names",0,lang))}</span> <span>(1)</span></p>`));
    assert.ok(from.includes(`<a class="a" href="/p/qa-shop/sample/01-domain#item=CTX-001" data-nx-focus="t:from:01-domain:0"><span class="mono">CTX-001</span><span class="clip">Payments</span></a>`),"a link to the item at its place");
    assert.ok(to.includes(`${esc(label("The item",3,lang))} <span class="mu">(122)</span></h3>`),"the count of every linked item");
    assert.equal((to.match(/data-nx-focus="t:to:03-user-flow:\d"/g)||[]).length,TRACE_FIRST,"six until unfolded");
    assert.ok(to.includes(`data-nx-act="trace-more" data-nx-trace="to" data-nx-stage="03-user-flow" data-nx-focus="t:to:03-user-flow:more">${esc(label("More",0,lang,{n:"114"}))}</button>`),"and the rest, which unfolds");
    assert.ok(to.includes("Flow &lt;1&gt;")&&to.includes('<span class="mono">SPEC-001</span><span class="clip"></span>'),"titles escaped; none for an item without one");
    // Last, its talk narrowed to it, with the way to the stage's whole talk, and the box on it.
    const own=between(html,'<section class="itk"','<div class="box"');
    assert.ok(own.includes(`<h3 id="itk-h" tabindex="-1" data-nx-focus="itk-h">${esc(label("Narrowed",0,lang,{id:"REQ-001"}))}</h3>`)&&own.includes(`data-nx-act="whole" data-nx-focus="whole">${icon("i-back")}<span>${esc(label("Narrowed",1,lang))}</span></button>`));
    assert.ok(own.includes(`<h4 class="tg" id="t-agent" data-nx-key="h-agent">`)&&own.includes(esc(id("nc","a")))&&!own.includes(esc(id("nc","b"))),"its entries, the groups one level under its heading");
    assert.ok(html.includes(`<label class="lab" for="talk-text" data-nx-key="lab">${esc(words("Comment on",lang,{id:"REQ-001"}))}</label>`)&&html.endsWith("</div></section>"),"the box at the panel's foot");
    assert.ok(!html.includes('data-nx-wait="talk"'),"only the code draws the panel, so nothing waits");
    assertKeyed(html,"item "+lang);
    const open=drawItem(item({open:{to:["03-user-flow"]}}),stageTalk(),DATA,lang);
    assert.equal((open.match(/data-nx-focus="t:to:03-user-flow:\d+"/g)||[]).length,9,"unfolded, every link that API-157 gave");
    assert.ok(open.includes(`<span class="mu cap">${esc(label("More",0,lang,{n:"111"}))}</span>`),"and the count of those it did not give");
  }
});

test("an item that the row or the picture showed, while it reads (SCR-115#loading)",()=>{
  for(const lang of["en","ko"]){
    const html=drawItem(item({state:"loading",data:null}),stageTalk(),DATA,lang);
    assert.ok(html.includes('<span class="id">REQ-001</span>')&&html.includes(`<span class="kind">${esc(kindWord("requirement",lang))}</span>`)&&html.includes('<p class="tx" data-nx-key="tx">The shop &lt;shall&gt; retry a payment.</p>'),"the ID, the kind and the text at once");
    assert.ok(html.includes('<div class="sk" data-nx-key="load" aria-hidden="true"><span class="skel"></span><span class="skel short"></span><span class="skel"></span><span class="skel short"></span></div>'),"grey lines in the places that wait");
    assert.ok(html.includes(`<p class="sr" role="status" data-nx-key="loading">${esc(label("The item",6,lang,{id:"REQ-001"}))}</p>`),"Loading {id}… for screen readers");
    assert.ok(!html.includes('class="fields"')&&!html.includes('h-from'),"no fields or trace until they arrive");
    assertKeyed(html,"loading "+lang);
    const bare=drawItem(item({state:"loading",data:null,seed:{}}),stageTalk(),DATA,lang);
    assert.ok(!bare.includes('<span class="kind">')&&!bare.includes('<p class="tx" data-nx-key="tx"'),"an item that nothing showed: its ID alone");
  }
});

test("gone, failed and refused: the message in the item's place (SCR-115#gone, #error, #permission)",()=>{
  for(const lang of["en","ko"]){
    const [text,search]=words("item_not_found",lang,{id:"REQ-404"}).split(" · ");
    const gone=drawItem(item({id:"REQ-404",state:"gone",data:null,seed:{},why:"narrowed"}),stageTalk("REQ-404"),DATA,lang);
    assert.ok(gone.includes(`<div class="msg warn" role="status">${icon("i-warn")}<div><span class="t">${esc(text)}</span><div class="row"><button class="btn sm" type="button" data-nx-act="item-search" data-nx-focus="item-search">${icon("i-search")}${esc(search)}</button></div></div></div>`),"the search of every project for the ID");
    assert.ok(!gone.includes('class="box"')&&!gone.includes('data-nx-key="why"'),"no box and no line on why, since no stage holds it");
    assert.ok(gone.includes(`>${esc(label("Narrowed",0,lang,{id:"REQ-404"}))}</h3>`),"its comments that still name it");
    const failed=drawItem(item({state:"failed",data:null,error:{code:"timeout",trace:"trace-1"}}),stageTalk(),DATA,lang);
    assert.ok(failed.includes(`<div class="msg err" role="alert">${icon("i-err")}<div><span class="t">${esc(codeMessage("No answer in time",lang))}</span><span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:"trace-1"}))}</span><div class="row"><button class="btn sm" type="button" data-nx-act="item-retry" data-nx-focus="item-retry">${icon("i-reload")}${esc(labels("Page buttons",lang)[0])}</button>`),"rule 8's words, the trace ID and Try again");
    assert.ok(failed.includes('class="box"'),"the talk and its box stay");
    const internal=drawItem(item({state:"failed",data:null,error:{code:"invalid_request"}}),stageTalk(),DATA,lang);
    assert.ok(internal.includes(`<span class="t">${esc(codeMessage("invalid_request",lang))}</span>`));
    const refused=drawItem(item({state:"refused",data:null,error:{code:"access_missing",trace:"trace-2"}}),stageTalk(),DATA,lang);
    assert.ok(refused.includes(`<span class="t">${esc(codeMessage("access_missing",lang))}</span><span class="tid">`)&&!refused.includes("item-retry"));
    const expired=drawItem(item({state:"refused",data:null,error:{code:"sign_in_expired"}}),stageTalk(),DATA,lang);
    assert.ok(expired.includes(`<span class="t">${esc(codeMessage("Sign-in expired",lang))}</span><div class="row"><button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="item-sign-in">${esc(labels("Page buttons",lang)[2])}</button>`),"rule 7: Sign in again");
    for(const [html,where]of[[gone,"gone"],[failed,"failed"],[expired,"expired"]])assertKeyed(html,where+" "+lang);
  }
});

test("why the stage does not show the item where the user looks (SCR-115's revision, rule 24)",()=>{
  for(const lang of["en","ko"]){
    for(const [why,index]of[["stale",1],["none",2],["narrowed",3]]){
      const html=drawItem(item({why}),stageTalk(),DATA,lang),line=between(html,'<div data-nx-key="why">','<p class="tx"');
      assert.ok(html.indexOf('data-nx-key="why"')<html.indexOf('data-nx-key="tx"'),"under the panel's head, first in its body");
      assert.ok(line.includes(`<div class="msg info" role="status">${icon("i-info")}<div><span class="t">${esc(label("An item that the talk selects",index,lang))}</span>`),why);
      assert.equal(line.includes(`data-nx-act="item-show-all" data-nx-focus="item-show-all">${esc(labels("The list",lang)[7])}</button>`),why==="narrowed","Show all where the narrowed list does not hold the row");
    }
    assert.ok(!drawItem(item({why:"other"}),stageTalk(),DATA,lang).includes('data-nx-key="why"'));
  }
});

test("on a pictured stage: the picture's fields of the item and its discrepancies (SCR-115#normal, SPEC-126)",()=>{
  const raw={name:"payments",context:"CTX-001",terms:["TERM-001"],primary_key:["id"],unique:[{columns:["code"],partial:true}],foreign_keys:[],columns:[{name:"id"}],where:"docs/erd.sql:3"};
  const discrepancy={id:"nd_aaaaaaaaaaaa",part:"sample",compares:"aggregate-table",term:"TERM-001",item:"TBL-001",reasons:[{kind:"no-term"},{kind:"other-context",contexts:["CTX-002","CTX-001"]}],level:"warn",state:"open",waiting:true};
  const data={project:{name:"qa-shop"},part:"sample",stage:"05-erd"},talk=narrowTalk({project:"qa-shop",part:"sample",stage:"05-erd",item:null,mine:{total:0,entries:[]},agent:{total:0,entries:[]},apart:{total:0,entries:[]},closed:{total:0,entries:[]},reflections:[]},"TBL-001");
  for(const lang of["en","ko"]){
    const shown=item({id:"TBL-001",raw,discrepancies:[discrepancy],data:answer({item:{id:"TBL-001",kind:"table",stage:"05-erd",title:"payments"}})});
    const {list,rest}=itemFieldList(shown,lang);
    assert.deepEqual(list,itemFields(raw,lang).filter(field=>field.field!=="context").map(field=>[field.name,field.text]),"the picture's fields in words, the context apart");
    assert.deepEqual(Object.keys(rest),["columns"],"the rest under Details, but the name and the source's place");
    const html=drawItem(shown,talk,data,lang),said=label("The item",5,lang);
    assert.ok(html.includes(`<h3 data-nx-key="h-dsc">${esc(label("The item",4,lang,{n:"1"}))}</h3>`));
    assert.ok(html.includes(`<div class="dsc" data-nx-key="d:nd&#95;aaaaaaaaaaaa"><p>`)&&html.includes(`<p class="mu cap">${esc(words("Waits",lang))}</p>`),"each reason a sentence, and whether it waits for a current picture");
    assert.ok(html.includes(`data-nx-act="discrepancy" data-nx-discrepancy="nd&#95;aaaaaaaaaaaa" data-nx-focus="dsc:nd&#95;aaaaaaaaaaaa" aria-pressed="false">${icon("i-talk")}<span>${esc(said)}</span></button>`));
    const aimed=drawItem(shown,talk,data,lang,{box:{discrepancy:"nd_aaaaaaaaaaaa"}});
    assert.ok(aimed.includes('aria-pressed="true"')&&aimed.includes(`<label class="lab" for="talk-text" data-nx-key="lab">${esc(said)}</label>`),"the box names the discrepancy");
    assertKeyed(aimed,"discrepancy "+lang);
  }
});

test("the item's source and fields: a place without a line, without a link, and kinds in words",()=>{
  const plain=answer({source:{path:"docs/prd.md",line:null,link:"http://example.com/x",commit:null},context:null,trace:{from:[],to:[]},language:"<script>"});
  for(const lang of["en","ko"]){
    const html=drawItem(item({data:plain}),stageTalk(),DATA,lang);
    assert.ok(html.includes(`<p class="src" data-nx-key="src"><span>${esc(label("The item",7,lang,{path:"docs/prd.md"}))}</span></p>`),"text without the repository's address, the place without a line");
    assert.ok(!html.includes('class="ctx"')&&!html.includes("h-from")&&!html.includes("h-to"),"no context and no trace where the item has none");
    assert.ok(html.includes('<p class="tx" data-nx-key="tx">'),"a language that is not a tag is not written");
    assert.deepEqual(KINDS.map(kind=>kindWord(kind,lang)),labels("An item's kind",lang));
    assert.equal(kindWord("aggregate",lang),"aggregate");assert.equal(kindWord(undefined,lang),"");
  }
});

test("the side holds the item's panel, the switch shows the talk, and the phone's Item tab joins (SCR-111, SCR-115)",()=>{
  const data={project:{name:"qa-shop",title:"QA",repository:null,commit:null,generated_at:AT,pushed_at:AT,space:true,read_at:null,unread_since:null,parts:["sample"]},part:"sample",stage:"02-prd",head:{key:"02-prd",state:"in_progress",checkpoint:null,commit:null,time:AT,reads:true,source_state:"found",counts:{items:0,kinds:[],priorities:[],hotspots:null},picture:false},record:{project:"qa-shop",part:"sample",stage:"02-prd",record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],discrepancies:{total:0,entries:[]},comments:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[],warnings:[],not_opened:0},stages:[],items:{group:"context",filter:"all",q:null,total:0,after:0,counts:{all:0,talk:0,mine:0,left:0},groups:[],entries:[]}};
  const whole=stageTalk(null),view={code:true,item:item(),shownSide:"item",talkState:{shown:stageTalk()}};
  assert.ok(drawSide(data,null,"en",view,whole).startsWith('<section class="item"'));
  const talk=drawSide(data,null,"en",{...view,shownSide:"talk",talkState:{shown:whole}},whole);
  assert.ok(talk.startsWith('<section class="talk"')&&talk.includes('data-nx-side="talk" data-nx-focus="side:talk" aria-pressed="true"'),"the talk, with the switch back to the item");
  assert.ok(!drawSide(data,null,"en",{code:true},whole).includes('data-nx-act="side"'),"no switch without an item");
  assert.ok(drawSide(data,null,"en",{...view,record:true},whole).startsWith('<section class="rec"'),"the record still takes the side's place while it is open");
  const page={schema:PAGE_SCHEMAS.stage,generated_at:AT,lang:"en",data,talk:whole,picture:null,problem:null};
  assert.ok(!drawParts(page).tabs.includes('data-nx-tab="item"'),"the server selects no item");
  assert.ok(drawParts(page,view).tabs.includes('data-nx-tab="item"'),"the code's item adds its tab");
});

test("the search's panel: searching, matches, the limit, short, nothing, failed and refused (SCR-116)",()=>{
  const match=(n,extra={})=>({project:"qa-shop",part:"sample",stage:"02-prd",id:`REQ-${String(n).padStart(3,"0")}`,title:`Retry <${n}>`,...extra});
  const matches=Array.from({length:20},(_,index)=>match(index+1));
  assert.equal(SEARCH_MIN,2);assert.equal(SEARCH_MAX,200);
  for(const lang of["en","ko"]){
    const said=labels("The search",lang),buttons=labels("Page buttons",lang);
    assert.equal(matchWhere(match(1),lang),`qa-shop · sample · 02 ${label("Stage names",1,lang)}`);
    assert.equal(matchWhere(match(1,{part:""}),lang),`qa-shop · 02 ${label("Stage names",1,lang)}`,"a project of one part names no part");
    assert.equal(matchPath(match(1,{id:"REQ-1"})),"/p/qa-shop/sample/02-prd#item=REQ-1");
    assert.equal(matchPath(match(1,{part:""})),"/p/qa-shop/_/02-prd#item=REQ-001");
    const ready=drawSearch({state:"ready",q:"retry",matches,total:57,active:1},lang);
    assert.equal(ready.status,esc(label("The search",1,lang,{n:"57",q:"retry"})),"every match counted");
    assert.ok(ready.rows.startsWith(`<li class="m" id="sm-0" role="option" aria-selected="false" data-nx-match="0"><span class="mono">REQ-001</span><span class="clip">Retry &lt;1&gt;</span><span class="wh">${esc(matchWhere(match(1),lang))}</span></li><li class="m on" id="sm-1" role="option" aria-selected="true" data-nx-match="1">`),"the match under the arrow keys");
    assert.equal(ready.foot,esc(said[2]),"20 of more: the first 20");
    assert.equal(drawSearch({state:"ready",q:"retry",matches:matches.slice(0,3),total:3,active:-1},lang).foot,"","all of them: no line");
    const loading=drawSearch({state:"loading",q:"retr",matches:matches.slice(0,2),total:2,active:-1},lang);
    assert.equal(loading.status,esc(said[0]));assert.ok(loading.rows.includes("REQ-002"),"the earlier matches stay while it searches");
    assert.deepEqual(drawSearch({state:"short",q:"",matches:[],active:-1},lang),{status:"",rows:"",foot:"",pad:`<p>${esc(said[3])}</p>`});
    const empty=drawSearch({state:"empty",q:"a <b>",matches:[],total:0,active:-1},lang);
    assert.equal(empty.pad,`<p>${esc(label("The search",4,lang,{q:"a <b>"}))}</p><a class="btn sm" href="/hub#q=a%20%3Cb%3E">${esc(said[5])}</a>`,"Look in the full checks, with the words");
    const failed=drawSearch({state:"failed",q:"retry",matches,error:{code:"busy",trace:"t-1"}},lang);
    assert.ok(failed.pad.startsWith(`<div class="msg err" role="alert">${icon("i-err")}<div><span class="t">${esc(codeMessage("Busy",lang))}</span><span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:"t-1"}))}</span><div class="row"><button class="btn sm" type="button" data-nx-search-act="retry">`)&&failed.rows==="","rule 8 with Try again, the words kept in the field");
    assert.ok(drawSearch({state:"failed",q:"x",error:{code:"invalid_request"}},lang).pad.includes(esc(codeMessage("invalid_request",lang))));
    const expired=drawSearch({state:"refused",q:"retry",error:{code:"sign_in_expired"}},lang);
    assert.ok(expired.pad.includes(`<button class="btn sm pri" type="button" data-nx-search-act="sign-in">${esc(buttons[2])}</button>`)&&expired.pad.includes(esc(codeMessage("Sign-in expired",lang))));
    const refused=drawSearch({state:"refused",q:"retry",error:{code:"access_other_app",trace:"t-2"}},lang);
    assert.ok(refused.pad.includes(esc(codeMessage("access_other_app",lang)))&&refused.pad.includes("t-2")&&!refused.pad.includes("data-nx-search-act"));
    assert.deepEqual(drawSearch({state:"closed",q:"",matches:[]},lang),{status:"",rows:"",foot:"",pad:""});
  }
});
