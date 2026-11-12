// TASK-274: the workspace's stage, its middle and its record (SCR-111, SCR-113, SCR-112's list
// and record), drawn from API-158's answer by the functions that the server and the view share.
// These tests read the drawing as text; the browser suite stage-regression.mjs runs the code.
import test from "node:test";
import assert from "node:assert/strict";
import {esc,count} from "../src/draw/html.js";
import {label,labels,codeMessage,STATES} from "../src/draw/words.js";
import {STAGE_KEYS,stageRail} from "../src/draw/stages.js";
import {drawStage,drawRecord,drawSide,stageBars,headCounts,itemHash,waiting} from "../src/draw/stage.js";
import {drawParts,PAGE_SCHEMAS} from "../src/draw/page.js";

const AT="2026-11-08T07:00:00.000Z",PASSED="2026-11-06T05:00:00.000Z",WITHDRAWN="2026-11-07T01:00:00.000Z";
const TITLE=`<b>QA</b> "stage" & '__CORTHEX_VIEW_DATA__'`;
const entries=()=>[
  {id:"TBL-001",kind:"table",title:"orders <b>&</b>",priority:"Must",status:"built",parent:"CTX-001",context:"CTX-001",comments:2,mine:true,discrepancies:1,reflections:0},
  {id:"TBL-002",kind:"table",title:"order_lines",type:"table",context:"CTX-001",comments:0,mine:false,discrepancies:0,reflections:1},
  {id:"TBL-003",kind:"table",title:"notes",context:null,comments:1000,mine:false,discrepancies:0,reflections:0},
];
function stageData({stage="05-erd",head={},items={},record={},rows}={}){
  return{project:{name:"qa-shop",title:TITLE,repository:null,commit:null,generated_at:AT,pushed_at:"2026-11-08T08:00:00.000Z",parts:["sample"]},part:"sample",stage,
    head:{key:stage,state:"in_progress",checkpoint:null,commit:"0123456789abcdef0123456789abcdef01234567",time:AT,reads:true,source_state:"found",counts:{items:3,kinds:[{kind:"table",count:3}],priorities:[],hotspots:null},picture:false,...head},
    record:{project:"qa-shop",part:"sample",stage,record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],discrepancies:{total:0,entries:[]},comments:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[],warnings:[],not_opened:0,...record},
    stages:rows??STAGE_KEYS.map(key=>({key,state:"done",items:1,picture:false,not_current:null,mine:0})),
    items:{group:"context",filter:"all",q:null,total:3,after:0,counts:{all:3,talk:2,mine:1,left:2},groups:[{context:"CTX-001",title:"Ordering <i>",count:2},{context:null,title:null,count:1}],entries:entries(),...items}};
}
const waits=html=>[...html.matchAll(/data-nx-wait="(\w+)"/g)].map(m=>m[1]);
const between=(html,from,to)=>html.slice(html.indexOf(from),to?html.indexOf(to,html.indexOf(from)):undefined);

// Every element that the code compares when it draws again has a key, unique among its
// siblings: the drawing's top elements and the children of each data-nx-sub element
// (../ui/reconcile.js). An element without one would take another's place.
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

test("the head: number and name, state as a shape and a word, checkpoint, commit, counts and Stage record (SCR-113#normal)",()=>{
  for(const lang of["en","ko"]){
    const head=labels("The head",lang),html=drawStage(stageData(),lang,{talk:7});
    assert.ok(html.includes(`<h1 data-nx-key="h"><span class="num">05</span> ${esc(label("Stage names",4,lang))}</h1>`));
    assert.ok(html.includes(`<span class="stw"><svg class="st" aria-hidden="true" focusable="false"><use href="#s-prog"/></svg><span>${esc(lang==="en"?"In progress":"진행 중")}</span></span>`),"the state is a shape and a word");
    assert.ok(html.includes(`<span>${esc(head[1])}</span>`),"no checkpoint yet");
    assert.ok(html.includes(`<span>${esc(label("The head",2,lang,{commit:"0123456"}))} · <time datetime="${AT}">2026-11-08 07:00</time></span>`),"the commit and its time");
    assert.ok(html.includes(`<span class="cn" data-nx-key="cn"><span class="c">${esc(label("The head's counts",3,lang,{n:"3"}))}</span></span>`),"stage 05 counts its tables");
    const prdHead=drawStage(stageData({stage:"02-prd",head:{key:"02-prd",counts:{items:3,kinds:[{kind:"requirement",count:3}],priorities:[{priority:"Must",count:2},{priority:"Won't",count:1}],hotspots:null}}}),lang);
    assert.ok(prdHead.includes(`<span class="cn" data-nx-key="cn"><span class="c">${esc(label("The head's counts",5,lang,{n:"3"}))} ·</span> <span class="c">Must 2 ·</span> <span class="c">Won&#39;t 1</span></span>`),"each count whole, so that a line that breaks ends with the dot");
    assert.match(html,/<button class="btn sm" type="button" data-nx-key="rec" data-nx-act="record" data-nx-focus="record" aria-expanded="false" disabled data-nx-wait="record">/,"Stage record waits for the code");
    assert.ok(html.includes(`<a class="btn sm only-mid" href="#talk" data-nx-key="talk" data-nx-act="talk" data-nx-focus="talk">`)&&html.includes(`>${esc(label("Tabs",4,lang,{n:"7"}))}</span></a>`),"the talk folds into Talk ({n}) from 1,024 to 1,279 pixels");
    const coded=drawStage(stageData(),lang,{code:true,record:true});
    assert.deepEqual(waits(coded),[],"the code's drawing waits for nothing");assert.ok(coded.includes('aria-expanded="true">'));
    const picture=drawStage(stageData({head:{picture:true,checkpoint:{approved:"As drafted",date:"2026-11-05"}}}),lang);
    assert.ok(picture.includes(`<span>${esc(head[0].replace("{date}","2026-11-05"))}</span>`),"the last checkpoint's day");
    assert.ok(picture.includes(` · ${esc(head[3]).replace("{time}",`<time datetime="${AT}">2026-11-08 07:00</time>`)}</span>`),"a picture's commit is when it was drawn");
  }
  const prd={key:"02-prd",counts:{items:145,kinds:[{kind:"requirement",count:145}],priorities:[{priority:"Could",count:17},{priority:"Must",count:82},{priority:"P0",count:1},{priority:"Should",count:46}],hotspots:null}};
  assert.equal(headCounts(prd,"en"),"145 requirements · Must 82 · Should 46 · Could 17 · P0 1","MoSCoW's order first, then the others as found");
  assert.equal(headCounts({key:"01-domain",counts:{items:40,kinds:[{kind:"context",count:6},{kind:"term",count:30}],priorities:[],hotspots:4}},"ko"),"컨텍스트 6 · 용어 30 · 열린 핫스팟 4");
  assert.equal(headCounts({key:"03-user-flow",counts:{items:1500,kinds:[{kind:"flow",count:1500}],priorities:[],hotspots:null}},"en"),"999+ items","a stage that defines no named kind counts its items");
  assert.equal(headCounts({key:"12-qa",counts:{items:0,kinds:[],priorities:[],hotspots:null}},"en"),"0 cases");
});

test("a checkpoint passed in NEXUS that waits for its record shows in the head and the record, with Withdraw (SCR-113#stale)",()=>{
  const checkpoints=[
    {id:"nk_7f3k2m9q4x1v",state:"passed",passed_at:PASSED,recorded_commit:null,withdrawn_at:null,words:"As <recommended>"},
    {id:"nk_8f3k2m9q4x1v",state:"passed",passed_at:"2026-11-04T05:00:00.000Z",recorded_commit:null,withdrawn_at:null,words:null},
    {id:"nk_9f3k2m9q4x1v",state:"withdrawn",passed_at:"2026-11-03T05:00:00.000Z",recorded_commit:null,withdrawn_at:WITHDRAWN,words:"Old"},
  ];
  const data=stageData({record:{checkpoints,warnings:[{rule:"checkpoint-withdrawn",checkpoint:"nk_9f3k2m9q4x1v"}]}});
  assert.equal(waiting(data.record).id,"nk_7f3k2m9q4x1v","the newest that waits");
  for(const lang of["en","ko"]){
    const day=`<time datetime="${PASSED}" data-nx-day>2026-11-06</time>`,head=drawStage(data,lang);
    assert.ok(head.includes(`<span class="wait"><svg class="i"`)&&head.includes(esc(codeMessage("Waiting for its record",lang)).replace("{date}",day)),"beside the state in the head");
    const record=drawRecord(data,lang);
    assert.equal((record.match(/data-nx-act="withdraw"/g)||[]).length,2,"Withdraw on each that waits");
    assert.ok(record.includes(`data-nx-checkpoint="${esc("nk_7f3k2m9q4x1v")}" data-nx-focus="withdraw:${esc("nk_7f3k2m9q4x1v")}">`),"each Withdraw names its checkpoint");
    assert.ok(record.includes(`<span class="mu">“As &lt;recommended&gt;”</span>`),"its words, as text");
    assert.ok(record.includes(`<div class="wbox warn" data-nx-key="cp:${esc("nk_9f3k2m9q4x1v")}"><b>${esc(codeMessage("Withdrawn",lang)).replace("{date}",`<time datetime="${WITHDRAWN}" data-nx-day>2026-11-07</time>`)}</b>`),"a withdrawn one that a record names");
    assert.ok(record.includes(esc(codeMessage("Withdrawn, recorded",lang))));
    assert.ok(record.includes(`>${esc(codeMessage("Pass again",lang))}</button>`),"Pass then says Pass again");
    const sending=drawRecord(data,lang,{sending:"withdraw:nk_7f3k2m9q4x1v"});
    assert.ok(sending.includes(`aria-disabled="true">${esc(codeMessage("Sending",lang))}</button>`),"Withdraw says Sending… while it runs");
  }
});

test("the filters, the search in the stage and the grouping, each with its count (SCR-113#normal and #empty)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("The list",lang),html=drawStage(stageData(),lang);
    const chips=[...html.matchAll(/<button class="chip"[^>]*>.*?<\/button>/g)].map(m=>m[0]);
    assert.equal(chips.length,4);
    ["all","talk","mine","left"].forEach((name,i)=>{
      assert.ok(chips[i].includes(`data-nx-filter="${name}"`)&&chips[i].includes(`aria-pressed="${name==="all"}"`)&&chips[i].includes(`<span>${esc(words[i])}</span><span class="n">${[3,2,1,2][i]}</span>`),name);
      assert.ok(chips[i].endsWith(`disabled data-nx-wait="list"><span>${esc(words[i])}</span><span class="n">${[3,2,1,2][i]}</span></button>`),name+" waits for the code");
    });
    assert.ok(html.includes(`<input type="search" name="q" maxlength="200" autocomplete="off" placeholder="${esc(words[4])}" aria-label="${esc(words[4])}" data-nx-focus="find" disabled data-nx-wait="list">`),"the search, up to 200 characters");
    assert.ok(html.includes(`<details class="menu gm" data-nx-key="group"><summary class="btn sm" data-nx-focus="group">`)&&html.includes(`<span>${esc(words[5])}</span>`),"grouped by context");
    const picked=drawStage(stageData({items:{filter:"left",group:"source",entries:entries().slice(1)}}),lang,{code:true});
    assert.ok(picked.includes('data-nx-filter="left" data-nx-focus="filter:left" aria-pressed="true">')&&picked.includes(`<summary class="btn sm" data-nx-focus="group">`)&&picked.includes(`<span>${esc(words[6])}</span>`));
    const asked=drawStage(stageData(),lang,{code:true,query:{filter:"mine",group:"context",q:"or"}});
    assert.ok(asked.includes('data-nx-filter="mine" data-nx-focus="filter:mine" aria-pressed="true">'),"the user's pick while it reads");
    const empty=drawStage(stageData({head:{counts:{items:0,kinds:[],priorities:[],hotspots:null}},items:{total:0,counts:{all:0,talk:0,mine:0,left:0},groups:[],entries:[]}}),lang);
    assert.equal((empty.match(/<button class="chip"[^>]*aria-pressed="(?:true|false)" disabled>/g)||[]).length,4,"an empty stage has nothing to narrow");
    assert.deepEqual(waits(empty),["record"]);
    assert.ok(empty.includes(`<div class="nolist" data-nx-key="empty"><div><svg class="i big"`)&&empty.includes(`<p>${esc(label("No items",0,lang))}</p>`));
  }
});

test("the list: groups by context with their counts, rows with their fields, comments and marks, and the next 200 (REQ-227)",()=>{
  for(const lang of["en","ko"]){
    const fields=labels("List fields",lang),marks=labels("List marks",lang),html=drawStage(stageData(),lang);
    assert.ok(html.includes(`<section class="grp-l" data-nx-key="g:CTX-001" data-nx-sub aria-labelledby="gh-CTX-001"><h2 class="gh" id="gh-CTX-001" data-nx-key="h"><span class="mono">CTX-001</span> Ordering &lt;i&gt; <span class="mono n">2</span></h2>`));
    assert.ok(html.indexOf('data-nx-key="g:&#95;"')>html.indexOf('data-nx-key="g:CTX-001"')&&html.includes(`>${esc(labels("The list",lang)[8])} <span class="mono n">1</span></h2>`),"the items without a context last");
    const row=between(html,'<li data-nx-key="i:TBL-001">',"</li>");
    assert.ok(row.includes(`<a class="li" href="#view=list&amp;item=TBL-001" data-nx-item="TBL-001" data-nx-focus="item:TBL-001">`),"a pictured stage's row keeps the list's tab in the address");
    assert.ok(row.includes(`<span class="tt">orders &lt;b&gt;&amp;&lt;/b&gt;</span>`),"the text as the source has it, as text");
    assert.ok(row.includes(`<span><span class="sr">${esc(fields[0])}</span> Must</span> <span><span class="sr">${esc(fields[1])}</span> built</span> <span class="mono"><span class="sr">${esc(fields[3])}</span> CTX-001</span>`),"the main fields with their names for screen readers");
    assert.ok(row.includes(`<span aria-hidden="true">2</span><span class="sr">${esc(label("List marks",2,lang,{n:"2"}))}</span>`),"comments say what they count");
    assert.ok(row.includes(`<span class="tagm my">${esc(label("The list",2,lang))}</span> <span class="tagm disc">${esc(marks[0])}</span>`)&&!row.includes("tagm refl"),"marks as words (rule 13)");
    assert.ok(between(html,'<li data-nx-key="i:TBL-002">',"</li>").includes(`<span class="tagm refl">${esc(marks[1])}</span>`));
    assert.ok(between(html,'<li data-nx-key="i:TBL-003">',"</li>").includes('<span aria-hidden="true">999+</span>'),"counts over 999 show as 999+");
    assert.ok(!html.includes('class="more"'),"no last row when the list holds everything");
    const document=drawStage(stageData({stage:"02-prd",items:{group:"source",total:450}}),lang,{code:true,selected:"TBL-002"});
    assert.ok(document.includes('<a class="li" href="#item=TBL-001"')&&document.includes('<a class="li on" href="#item=TBL-002" data-nx-item="TBL-002" data-nx-focus="item:TBL-002" aria-current="true">'),"the selected row");
    assert.ok(!document.includes("grp-l")&&document.includes('<section class="list" data-nx-key="list" data-nx-sub><ul data-nx-key="u" data-nx-sub><li'),"in the source's order");
    assert.ok(document.includes(`<p class="more" data-nx-key="more" data-nx-live>${esc(label("The list",9,lang,{n:"3",total:"450"}))}</p>`),"{n} of {total} while more remain");
    assert.ok(drawStage(stageData({items:{total:450}}),lang,{more:"loading"}).includes(`data-nx-live>${esc(labels("The list",lang)[10])}</p>`));
    const failed=drawStage(stageData({items:{total:450}}),lang,{code:true,more:"failed"});
    assert.ok(failed.includes(`<p class="more" data-nx-key="more" data-nx-live role="alert">${esc(labels("The list",lang)[11])} <button class="btn sm" type="button" data-nx-act="more" data-nx-focus="more">`),"Could not load more, with Try again");
    const more=drawStage(stageData({items:{total:450}}),lang,{entries:[...entries(),{id:"TBL-004",title:"late",context:"CTX-001"}]});
    assert.ok(more.indexOf("i:TBL-004")<more.indexOf('data-nx-key="g:&#95;"'),"a later page's row joins its group");
  }
  assert.equal(itemHash("12-qa","TC-1 #2"),"#item=TC-1%20%232");assert.equal(itemHash("07-sitemap","SCR-1"),"#view=list&item=SCR-1");
  const twice=drawStage(stageData({items:{entries:[...entries(),{id:"TBL-001",title:"again",context:"CTX-001"}]}}),"en");
  assert.ok(twice.includes('data-nx-key="i:TBL-001"')&&twice.includes('data-nx-key="i:TBL-001#1"'),"a second item with the same ID has its own key");
});

test("a stage that the project does not read, and filters or a search that match nothing (SCR-113#not-read and #no-match)",()=>{
  for(const lang of["en","ko"]){
    const none={total:0,entries:[],groups:[]};
    for(const [state,why]of[["missing",1],["none",2],["skipped",3],["no-checkout",4],["invalid",5]]){
      const html=drawStage(stageData({head:{reads:false,source_state:state,counts:{items:0,kinds:[],priorities:[],hotspots:null}},items:none}),lang);
      const reason=label("Not read",why,lang);
      assert.ok(html.includes(`<span>${esc(label("Not read",0,lang,{why:reason}))}</span>`),"the head says why: "+state);
      assert.ok(!html.includes('class="filters"')&&html.includes('<span class="cn" data-nx-key="cn"></span>'),"no filters and no counts");
      assert.ok(html.includes(`<div class="nolist" data-nx-key="not-read">`)&&html.includes(`<p>${esc(codeMessage("Not read",lang,{why:reason}))}</p>`)&&html.includes('data-nx-focus="record-2" disabled data-nx-wait="record">'),"its message with Stage record");
    }
    const ask=(items,query)=>drawStage(stageData({items:{...none,...items}}),lang,{code:true,query});
    assert.ok(ask({filter:"mine"}).includes(`<p>${esc(label("No match",0,lang))}</p>`)&&ask({filter:"talk"}).includes(`<p>${esc(label("No match",1,lang))}</p>`));
    assert.ok(ask({filter:"left"}).includes(`<p>${esc(codeMessage("Nothing left",lang))}</p>`));
    const searched=ask({q:"zz <x>"});
    assert.ok(searched.includes(`<p>${esc(label("No match",2,lang,{q:"zz <x>"}))}</p>`)&&searched.includes(`data-nx-act="show-all" data-nx-focus="show-all">${esc(labels("The list",lang)[7])}</button>`),"Show all clears the filter and the search");
  }
});

test("the notes of reading again, and the bars of a newer push and an expired sign-in (SCR-113#error, #permission and SCR-111#stale)",()=>{
  for(const lang of["en","ko"]){
    const unread=drawStage(stageData(),lang,{code:true,notice:{kind:"unread"}});
    assert.ok(unread.includes(`<div class="notes" data-nx-key="notes"><div class="bar err" role="alert">`)&&unread.includes(esc(codeMessage("Could not update",lang)))&&unread.includes('data-nx-act="read" data-nx-focus="read">'),"Could not update, with Try again");
    assert.ok(unread.indexOf('class="notes"')<unread.indexOf('class="filters"'),"between the head and the filters");
    const refused=drawStage(stageData(),lang,{code:true,notice:{kind:"refused",code:"access_missing",trace:"8f6c-ICN"}});
    assert.ok(refused.includes(`<div class="bar warn" role="status">`)&&refused.includes(esc(codeMessage("access_missing",lang)))&&refused.includes(`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:"8f6c-ICN"}))}</span>`));
    assert.ok(drawStage(stageData(),lang,{updating:true}).includes(`<p class="upd" role="status" data-nx-key="upd" data-nx-live>${esc(codeMessage("Updating",lang))}</p>`));
    const bars=stageBars({pushed:"2026-11-08T09:00:00.000Z",signIn:true},lang);
    assert.ok(bars.includes(esc(label("Pushed again",0,lang)).replace("{time}",'<time datetime="2026-11-08T09:00:00.000Z">2026-11-08 09:00</time>'))&&bars.includes('data-nx-act="load"'));
    assert.ok(bars.includes(esc(codeMessage("Sign-in expired",lang)))&&bars.includes(`data-nx-act="sign-in" data-nx-focus="sign-in">${esc(labels("Page buttons",lang)[2])}</button>`));
    assert.equal(stageBars({},lang),"");
  }
});

test("the stage record: the recorded state, next action, checkpoints and checks, and passing the checkpoint with its words (SPEC-138, SPEC-139)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("The stage record",lang),record=drawRecord(stageData(),lang);
    assert.ok(record.startsWith('<section class="rec" aria-labelledby="rec-h" data-nx-key="rec" data-nx-sub><span class="handle only-ph" data-nx-key="hd" aria-hidden="true"></span>'));
    assert.ok(record.includes(`<h2 id="rec-h" tabindex="-1" data-nx-focus="rec-h">${esc(labels("The head",lang)[4])}</h2><span class="mu sm">05 ${esc(label("Stage names",4,lang))}</span>`)&&record.includes(`data-nx-act="close" data-nx-focus="close">`),"its heading, which takes the focus, and Back to the talk");
    const none=esc(lang==="en"?"None":"없음");
    assert.ok(record.includes(`<dt>${esc(words[0])}</dt><dd class="mu">${none}</dd><dt>${esc(words[1])}</dt><dd class="mu">${none}</dd><dt>${esc(words[2])}</dt><dd>${esc(codeMessage("No checks",lang))}</dd>`));
    assert.ok(record.includes(`<h3 data-nx-key="ph">${esc(words[3])}</h3><div class="pnote" data-nx-key="pnote"></div><label class="lab" for="cp-words" data-nx-key="pl">`),"a pass's message goes above the words box");
    assert.ok(record.includes('<textarea class="ta" id="cp-words" name="words" rows="4" data-nx-key="ta" data-nx-focus="words" aria-describedby="cp-left"></textarea>'),"the words box is drawn empty; the code fills in the draft");
    assert.ok(record.includes(`data-nx-act="pass" data-nx-focus="pass">${esc(words[4])}</button>`));
    const full=drawRecord(stageData({record:{record:{state:"done",next:"Write <the> spec",from:"snapshot",checkpoints:[{approved:"As drafted",by:"user",date:"2026-11-05",where:"https://github.com/example/qa-shop/pull/7"},{approved:"Bad link",where:"javascript:alert(1)"}]},
      checks:[{level:"warn",rule:"unknown-ref",message:"TBL-009 is mentioned but not defined"},{level:"warn",rule:"x"},{level:"error",rule:"y",message:"z"}],not_opened:3}}),lang,
      {left:100,passNote:{tone:"err",text:codeMessage("internal",lang),trace:"8f6c-ICN",retry:"pass"},note:{tone:"warn",text:codeMessage("checkpoint_recorded",lang)}});
    assert.ok(full.includes(`<dd>Write &lt;the&gt; spec</dd>`)&&full.includes(`<ul class="cps"><li><span>As drafted</span> <span class="mu cap">user · 2026-11-05</span> <a class="lnk clip" href="https://github.com/example/qa-shop/pull/7" rel="noreferrer">`),"the record's checkpoints with where they were given");
    assert.ok(!full.includes("javascript:"),"only https links");
    assert.ok(full.includes(`<dd>${esc([label("Projects",9,lang,{n:"2"}),"TBL-009 is mentioned but not defined",label("More",0,lang,{n:"2"})].join(" · "))}</dd>`),"the checks: warnings, the first message and how many more");
    assert.ok(full.includes(esc(codeMessage("Not opened",lang,{n:"3"}))));
    assert.ok(full.indexOf(esc(codeMessage("checkpoint_recorded",lang)))<full.indexOf("<dl"),"the record's message at its top");
    const note=between(full,'<div class="pnote"','<label');
    assert.ok(note.includes('<div class="msg err" role="alert">')&&note.includes('data-nx-act="pass" data-nx-focus="pass:retry">')&&note.includes("8f6c-ICN"),"a failed pass: its message with Try again and the trace ID");
    assert.ok(full.includes(`<p class="left" id="cp-left" data-nx-key="left" data-nx-live>${esc(codeMessage("Characters left",lang,{n:100}))}</p>`),"the characters left from 90 per cent (rule 5)");
    const over=drawRecord(stageData(),lang,{over:true,left:-1});
    assert.ok(over.includes('data-nx-act="pass" data-nx-focus="pass" disabled>'),"no pass past the limit");
    assert.ok(over.includes(`<p class="left" id="cp-left" data-nx-key="left" data-nx-live>${esc(codeMessage("text_too_long",lang,{limit:"2,000"}))}</p>`),"past the limit, the limit itself");
    assert.ok(drawRecord(stageData(),lang,{sending:"pass"}).includes(`data-nx-act="pass" data-nx-focus="pass" aria-disabled="true">${esc(codeMessage("Sending",lang))}</button>`));
    const signIn=drawRecord(stageData(),lang,{passNote:{tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true}});
    assert.ok(signIn.includes('data-nx-act="sign-in" data-nx-focus="pass:sign-in">'),"rule 7 with the words kept");
    const cross=drawRecord(stageData(),lang,{passNote:{tone:"err",text:codeMessage("cross_site",lang),here:"https://nexus.example/p/qa-shop/sample/05-erd"}});
    assert.ok(cross.includes(`<a class="lnk" href="https://nexus.example/p/qa-shop/sample/05-erd">${esc(labels("Page buttons",lang)[3])}</a>`),"cross_site links the page at its own address");
  }
});

test("the side holds the record while it is open, else what the page could not hold",()=>{
  for(const lang of["en","ko"]){
    assert.equal(drawSide(stageData(),null,lang,{}),"","without the page's talk the side is empty; draw-talk.test.js draws the talk");
    assert.ok(drawSide(stageData(),null,lang,{record:true}).startsWith('<section class="rec"'));
    const problem=drawSide(stageData(),{code:"space_not_found",traceId:"8f6c-ICN"},lang,{});
    assert.ok(problem.startsWith('<div class="sidemsg" data-nx-key="problem"><div class="msg warn" role="status">')&&problem.includes(esc(codeMessage("space_not_found",lang)))&&problem.includes("8f6c-ICN"));
    assert.equal(drawSide(stageData(),{code:"picture_not_found",traceId:"x"},lang,{}),"","a pictured stage's missing picture is TASK-275's");
  }
  const payload={schema:PAGE_SCHEMAS.stage,generated_at:AT,lang:"en",data:stageData(),talk:{mine:{total:2},agent:{total:1},apart:{total:4}},picture:null,problem:null};
  const parts=drawParts(payload,{code:true,record:true,pushed:AT});
  assert.ok(parts.stage.includes('>Talk (7)</span></a>')&&parts.side.startsWith('<section class="rec"')&&parts.bars.includes('data-nx-codebar')&&parts.bars.includes('data-nx-act="load"'));
  assert.throws(()=>drawStage({head:{}},"en"),/Unreadable page data/);
});

test("the list of stages says how progress gets recorded, and which pictures are not current (SCR-111#unrecorded and #stale)",()=>{
  for(const lang of["en","ko"]){
    const unrecorded=stageRail(stageData({rows:STAGE_KEYS.map((key,i)=>({key,state:i%2?"unknown":"skipped",items:0,picture:false,not_current:null,mine:0}))}),lang);
    assert.ok(unrecorded.includes(`<p class="unrec">${esc(label("No progress",0,lang))}</p><ul class="stl">`));
    assert.ok(!stageRail(stageData(),lang).includes('class="unrec"'),"one recorded state is enough");
    const stale=stageRail(stageData({rows:STAGE_KEYS.map(key=>({key,state:"done",items:1,picture:key==="05-erd",not_current:key==="05-erd"?"size":null,mine:0}))}),lang);
    assert.ok(stale.includes(`<span class="sr">${esc(`${label("Legend",5,lang)}, ${label("Projects",6,lang).toLocaleLowerCase(lang)}`)}</span>`),"a picture that is not current says so");
  }
  for(const state of STATES)assert.ok(drawStage(stageData({head:{state}}),"en").includes(`<use href="#`),state);
});

test("every element that the code compares has a key of its own (ui/reconcile.js)",()=>{
  const checkpoints=[{id:"nk_7f3k2m9q4x1v",state:"passed",passed_at:PASSED,recorded_commit:null,withdrawn_at:null,words:"x"},{id:"nk_9f3k2m9q4x1v",state:"withdrawn",passed_at:PASSED,recorded_commit:null,withdrawn_at:WITHDRAWN,words:null}];
  const variants=[
    [stageData(),{}],[stageData(),{code:true,notice:{kind:"unread"},updating:true,selected:"TBL-001"}],
    [stageData({items:{group:"source",total:450}}),{code:true,more:"failed"}],
    [stageData({items:{total:0,entries:[],groups:[]},head:{counts:{items:0,kinds:[],priorities:[],hotspots:null}}}),{}],
    [stageData({items:{total:0,entries:[],groups:[]},head:{reads:false,source_state:"none"}}),{code:true}],
    [stageData({items:{total:0,entries:[],groups:[],filter:"mine"}}),{code:true,notice:{kind:"refused",code:"user_only"}}],
    [stageData({items:{entries:[...entries(),{id:"TBL-001",context:"CTX-001"}]},record:{checkpoints,not_opened:2}}),{code:true}],
  ];
  for(const [index,[data,view]]of variants.entries())for(const lang of["en","ko"]){
    assertKeyed(drawStage(data,lang,view),`stage ${index} ${lang}`);
    assertKeyed(drawSide(data,null,lang,{record:true,recordState:{left:5,note:{tone:"info",text:"x"},passNote:{tone:"err",text:"y",retry:"pass"}}}),`record ${index} ${lang}`);
  }
  assertKeyed(drawSide(stageData(),{code:"space_not_found"},"en",{}),"side message");
  assert.throws(()=>assertKeyed('<div data-nx-key="a" data-nx-sub><span></span></div>',"bad"),/has no key/);
  assert.throws(()=>assertKeyed('<i data-nx-key="a"></i><b data-nx-key="a"></b>',"bad"),/twice/);
});
