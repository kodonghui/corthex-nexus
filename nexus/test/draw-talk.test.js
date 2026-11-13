// TASK-276: the talk in the workspace's side (SCR-114), drawn from API-152's answer by the
// functions that the server and the view share (../src/draw/talk.js). These tests read the
// drawing as text; the browser suite talk-regression.mjs runs the view's code.
import test from "node:test";
import assert from "node:assert/strict";
import {esc,count} from "../src/draw/html.js";
import {label,labels,codeMessage,capital} from "../src/draw/words.js";
import {words} from "../ui/messages.js";
import {drawTalk,drawEntry,entryOf,talkGroups,agentCount,kindOf,itemsOf,narrowTalk,leftOf,TALK_LIMIT} from "../src/draw/talk.js";
import {drawSide} from "../src/draw/stage.js";
import {drawParts,openTalk,PAGE_SCHEMAS} from "../src/draw/page.js";

const AT="2026-11-08T07:00:00.000Z",LATER="2026-11-08T09:30:00.000Z";
const id=(prefix,letter)=>prefix+"_"+letter.repeat(12);
const comment=(letter,extra={})=>({id:id("nc",letter),part:"sample",stage:"05-erd",item:"TBL-001",quote:null,discrepancy:null,author:"agent",text:`Text <b>${letter}</b>`,state:"open",closed_as:null,waits:"user",asks:"question",made_at:AT,last_at:AT,commit:"0123456789abcdef",settled:false,dismissed:false,replies:0,last_reply:null,proposals:[],claim:null,...extra});
const proposal=(letter,extra={})=>({id:id("np",letter),part:"sample",stage:"05-erd",reason:"Why <i>",change:"Add an index",comment:null,discrepancy:null,state:"open",made_at:AT,closed_at:null,edit:null,commit:"abcdef0123456789",items:["TBL-001"],source_text_chars:20,...extra});
const reflection=(letter,extra={})=>({id:id("ne",letter),part:"sample",stage:"05-erd",proposal:proposal("r",{state:"accepted",items:["TBL-002"]}),state:"pending",pull_request:null,closed_commit:null,made_at:AT,changed_at:AT,commit:"abcdef0",claim:null,...extra});
// A stage's talk: my turn holds a proposal, a question, a recommendation on the stage as a
// whole and a checkpoint; the agent's turn a comment that a session took, one that waits and
// is settled, and a pending reflection; apart, a comment whose item is gone.
function talk(over={}){
  const mine=[{kind:"proposal",comment:null,proposal:proposal("a")},{kind:"comment",comment:comment("b",{last_reply:{seq:1,author:"agent",text:"Which one?",made_at:AT,settles:false}}),proposal:null},{kind:"comment",comment:comment("c",{item:"",asks:"recommended"}),proposal:null},{kind:"comment",comment:comment("d",{item:"",asks:"checkpoint"}),proposal:null}];
  const agent=[comment("e",{author:"user",waits:"agent",asks:null,claim:{claimed_at:LATER,ends_at:LATER,mine:false}}),comment("f",{author:"user",waits:"agent",asks:null,settled:true,last_at:LATER})];
  return{project:"qa-shop",part:"sample",stage:"05-erd",item:null,mine:{total:4,entries:mine},agent:{total:2,entries:agent},apart:{total:1,entries:[comment("g",{item:"TBL-999",author:"user",waits:"agent",asks:null})]},closed:{total:3,entries:[]},reflections:[reflection("h")],...over};
}
const DATA={stage:"05-erd"};
const between=(html,from,to)=>html.slice(html.indexOf(from),to?html.indexOf(to,html.indexOf(from)):undefined);
const entryHtml=(html,entry)=>{const start=html.indexOf(`<li class="te`,html.indexOf(`data-nx-entry="${esc(entry)}"`)-80),end=html.indexOf("</li>",start);return html.slice(start,end+5);};
const waits=html=>[...html.matchAll(/data-nx-wait="(\w+)"/g)].map(m=>m[1]);

// Every element that the code compares when it draws again has a key, unique among its
// siblings (../ui/reconcile.js), as draw-stage.test.js checks for the middle.
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

test("the talk by turn: my turn, the agent's turn with its wait, apart and closed, and the box (SCR-114#normal)",()=>{
  for(const lang of["en","ko"]){
    const html=drawTalk(talk(),DATA,lang),said=labels("The talk",lang),answers=labels("Answers",lang),kinds=labels("An entry's kind",lang);
    assert.ok(html.startsWith('<section class="talk" aria-labelledby="talk-h" data-nx-key="talk" data-nx-sub>'));
    assert.ok(html.includes(`<h2 id="talk-h" tabindex="-1" data-nx-focus="talk-h">${esc(said[0])}</h2><span class="mu sm">05 ${esc(label("Stage names",4,lang))}</span>`),"the heading with the stage");
    assert.ok(html.includes(`href="#t-mine" data-nx-act="turn" data-nx-turn="mine" data-nx-focus="turn:mine">${esc(label("The talk",1,lang,{n:"4"}))}</a>`),"my turn's count leads to its group");
    assert.ok(html.includes(`href="#t-agent" data-nx-act="turn" data-nx-turn="agent" data-nx-focus="turn:agent">${esc(label("The talk",2,lang,{n:"3"}))}</a>`),"the agent's count holds the pending reflection");
    assert.ok(html.includes(`<h3 class="tg" id="t-mine" data-nx-key="h-mine">${esc(label("My turn",0,lang,{n:"4"}))}</h3>`));
    assert.ok(html.includes(`<h3 class="tg" id="t-agent" data-nx-key="h-agent">${esc(label("The talk",3,lang,{n:"3"}))}</h3>`));
    assert.ok(html.includes(`<h3 class="tg" id="t-apart" data-nx-key="h-apart">${esc(label("The talk",4,lang,{n:"1"}))}</h3>`));
    // My turn: each kind with its answers as on SCR-110, and Reply or Open.
    const a=entryHtml(html,id("np","a")),b=entryHtml(html,id("nc","b")),c=entryHtml(html,id("nc","c")),d=entryHtml(html,id("nc","d"));
    assert.ok(a.startsWith('<li class="te my" data-nx-key="e:np&#95;aaaaaaaaaaaa"')&&a.includes(`<span class="kind acc">${esc(kinds[0])}</span>`)&&a.includes(`>${esc(answers[0])}</button>`)&&a.includes(`>${esc(answers[1])}</button>`));
    assert.ok(a.includes('<span class="clip"><span class="mono">TBL-001</span></span>'),"the item's ID opens the entry");
    assert.ok(a.includes(`<p class="tx" id="tx-np&#95;aaaaaaaaaaaa" data-nx-key="tx">Add an index</p>`),"a proposal's change is its text");
    assert.ok(b.includes(`<span class="kind acc">${esc(kinds[1])}</span>`)&&b.includes(`data-nx-act="reply-open"`)&&b.includes(`>${esc(answers[4])}</button>`)&&!b.includes('data-nx-act="accept"'));
    assert.ok(b.includes(`<div class="reps" data-nx-key="last"><div class="rep"><span class="who">${esc(labels("Author and time",lang)[0])} · <time datetime="${AT}">2026-11-08 07:00</time></span><p>Which one?</p></div></div>`),"a folded comment shows its last reply");
    assert.ok(b.includes("Text &lt;b&gt;b&lt;/b&gt;"),"the text is escaped");
    assert.ok(c.includes(`<span class="clip"><span class="mu">${esc(label("An entry's place",0,lang))}</span></span>`)&&c.includes(`data-nx-act="recommended"`)&&c.includes(`>${esc(answers[2])}</button>`)&&c.includes(`>${esc(answers[4])}</button>`));
    assert.ok(d.includes(`<span class="kind acc">${esc(kinds[3])}</span>`)&&d.includes(`>${esc(answers[3])}</button>`)&&d.includes(`data-nx-act="entry" data-nx-focus="np&#95;dddddddddddd:entry"`.replace("np","nc"))&&d.includes(`>${esc(answers[5])}</button>`),"a checkpoint's Pass as recommended, then Open");
    // The agent's turn: taken, waiting and settled; the reflection with its state.
    const e=entryHtml(html,id("nc","e")),f=entryHtml(html,id("nc","f")),h=entryHtml(html,id("ne","h"));
    assert.ok(e.startsWith('<li class="te" ')&&e.includes(`<use href="#i-lock"/>`)&&e.includes(esc(label("Waiting",1,lang,{time:"\u0000"})).split("\u0000")[0]),"taken by the agent, with the time");
    assert.ok(!e.includes('class="acts"'),"the agent's turn has no answers, and the user can still reply when it opens");
    assert.ok(f.includes(`<use href="#i-dot"/>`)&&f.includes(`<time datetime="${LATER}">`)&&f.includes(`data-nx-key="settled"`)&&f.includes(esc(label("The talk's entries",1,lang))),"waiting since its last activity, and settled");
    assert.ok(h.includes(`<span class="clip"><span class="mono">TBL-002</span></span>`)&&h.includes(esc(words("Reflection pending",lang)))&&!h.includes('class="acts"')&&!h.includes('data-nx-key="wt"'),"a pending reflection, on its proposal's items, says how it stands instead of since when");
    // Apart and closed, and the box.
    assert.ok(entryHtml(html,id("nc","g")).startsWith('<li class="te apart"'));
    assert.ok(html.includes(`<button class="tg fold" type="button" data-nx-key="h-closed" data-nx-act="closed" data-nx-focus="closed" aria-expanded="false" disabled data-nx-wait="talk"><span>${esc(label("The talk",5,lang,{n:"3"}))}</span>`),"the closed talk, folded with its count");
    assert.ok(html.includes(`<label class="lab" for="talk-text" data-nx-key="lab">${esc(labels("The box",lang)[0])}</label>`)&&html.includes(`<span class="mu" id="talk-hint">${esc(labels("The box",lang)[2])}</span>`)&&html.includes(`>${esc(labels("The box",lang)[1])}</button>`));
    assert.ok(html.includes('<a class="ib only-mid" href="#stage" data-nx-act="talk-close" data-nx-focus="talk-close">'),"the panel's Close, a link before the code runs");
    assertKeyed(html,"normal "+lang);
  }
});

test("before the code runs the talk's controls wait, disabled; after, none does (SCR-114#loading, rule 15)",()=>{
  const before=drawTalk(talk(),DATA,"en"),after=drawTalk(talk(),DATA,"en",{},true);
  const controls=[...before.matchAll(/<(?:button|textarea|input)\b[^>]*>/g)].map(m=>m[0]);
  assert.ok(controls.length>=14);
  for(const control of controls)assert.match(control,/ disabled data-nx-wait="talk"/);
  assert.deepEqual(waits(after),[]);
  assert.ok(!/<(?:button|textarea)\b[^>]*\sdisabled/.test(after),"no control stays disabled");
  assert.match(after,/data-nx-act="leave" data-nx-focus="leave" aria-disabled="true">/,"Leave is unavailable while its box is empty, and the focus can still reach it");
});

test("narrowed to an item: its talk, the box on it and the way back (SCR-114#narrowed)",()=>{
  for(const lang of["en","ko"]){
    const narrowed=narrowTalk(talk(),"TBL-001"),html=drawTalk(narrowed,DATA,lang,{},true);
    assert.equal(narrowed.mine.total,2);assert.equal(narrowed.agent.total,2);assert.equal(narrowed.apart.total,0);
    assert.equal(narrowed.closed.total,null,"the closed count waits for the server's answer");
    assert.ok(html.includes(`>${esc(label("Narrowed",0,lang,{id:"TBL-001"}))}</h2>`)&&html.includes(`data-nx-act="whole" data-nx-focus="whole"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-back"/></svg><span>${esc(label("Narrowed",1,lang))}</span></button>`));
    assert.ok(html.includes(`>${esc(words("Comment on",lang,{id:"TBL-001"}))}</label>`)&&html.includes('data-nx-key="ta:TBL-001"'),"the box comments on the item, its words kept apart from the stage's");
    assert.ok(!html.includes(id("nc","c"))&&!html.includes(id("ne","h")),"entries on the stage as a whole or other items leave");
    const none=drawTalk(narrowTalk(talk(),"TBL-404"),DATA,lang,{},true);
    assert.ok(none.includes(`<div class="empty-t" data-nx-key="empty"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-talk"/></svg><p>${esc(label("No talk",1,lang,{id:"TBL-404"}))}</p></div>`));
    assert.ok(!none.includes('href="#t-mine"')&&none.includes(`<span class="mine">${esc(label("The talk",1,lang,{n:"0"}))}</span>`),"a turn without entries leads nowhere");
    assertKeyed(html,"narrowed "+lang);
  }
  assert.deepEqual(narrowTalk(talk(),"TBL-002").reflections.map(row=>row.id),[id("ne","h")],"a reflection follows its proposal's items");
});

test("no talk on the stage yet (SCR-114#empty)",()=>{
  for(const lang of["en","ko"]){
    const html=drawTalk({project:"qa-shop",part:"sample",stage:"05-erd",item:null,mine:{total:0,entries:[]},agent:{total:0,entries:[]},apart:{total:0,entries:[]},closed:{total:0,entries:[]},reflections:[]},DATA,lang,{},true);
    assert.ok(html.includes(`<p>${esc(label("No talk",0,lang))}</p>`)&&!html.includes('class="tg fold"')&&!html.includes('<ol'));
    assert.ok(html.includes('id="talk-text"'),"the box stays");
    assertKeyed(html,"empty "+lang);
    // An item whose only comment is closed has talk: the closed talk's fold, not "No comments".
    const closedOnly=drawTalk({project:"qa-shop",part:"sample",stage:"05-erd",item:"TBL-001",mine:{total:0,entries:[]},agent:{total:0,entries:[]},apart:{total:0,entries:[]},closed:{total:1,entries:[]},reflections:[]},DATA,lang,{},true);
    assert.ok(!closedOnly.includes('class="empty-t"')&&closedOnly.includes('class="tg fold"'),"closed talk alone is not empty");
  }
});

test("an opened comment: its replies loading, read or failed, and its reply box (SCR-114's actions, #loading, #stale)",()=>{
  const open=id("nc","b");
  for(const lang of["en","ko"]){
    const loading=entryHtml(drawTalk(talk(),DATA,lang,{open},true),open);
    assert.ok(loading.includes('<div class="reps" data-nx-key="reps"><div class="sk" aria-hidden="true">')&&loading.includes("<p>Which one?</p>")&&loading.includes(`<span class="sr">${esc(words("Loading the replies",lang))}</span>`),"the last reply stays while the others load");
    assert.ok(loading.includes(`aria-expanded="true"`));
    const replies=[{seq:1,author:"agent",text:"Which one?",made_at:AT,settles:false},{seq:2,author:"user",text:"The first",made_at:AT,settles:true},{seq:3,author:"agent",text:"Noted",made_at:LATER,settles:false}];
    const decisions=[{seq:1,link:"https://example.com/d/1",text:"Index added",made_at:LATER},{seq:2,link:"javascript:alert(1)",text:"Bad link",made_at:LATER}];
    const ready=entryHtml(drawTalk(talk(),DATA,lang,{open,threads:{[open]:{state:"ready",data:{replies,decisions},seen:[1,2]}},replies:{[open]:{left:12,empty:false}}},true),open);
    assert.ok(ready.includes(`<span class="kind">${esc(words("Settles it",lang))}</span>`),"the reply that settles it says so");
    assert.equal((ready.match(/class="newt"/g)||[]).length,1,"only the agent's reply after the entry opened is new");
    assert.ok(ready.includes('<a class="lnk clip" href="https://example.com/d/1" rel="noreferrer">')&&!ready.includes("javascript:"),"a decision links only to https");
    assert.ok(ready.includes(`<textarea class="ta" id="rp-nc&#95;bbbbbbbbbbbb" name="reply" rows="2" data-nx-key="rta" data-nx-focus="nc&#95;bbbbbbbbbbbb:text"`)&&ready.includes(`<input type="checkbox" name="settles"`));
    assert.ok(!ready.includes('data-nx-act="reply-open"'),"an opened entry needs no Reply to open it");
    assert.ok(ready.includes(`data-nx-act="answered" data-nx-focus="nc&#95;bbbbbbbbbbbb:answered">${esc(label("The talk's entries",0,lang))}</button>`),"Mark answered on an open comment");
    assert.ok(ready.includes(`data-nx-act="reply" data-nx-focus="nc&#95;bbbbbbbbbbbb:reply">${esc(answers(lang)[4])}</button>`)&&ready.includes(esc(codeMessage("Characters left",lang,{n:12}))));
    const failed=entryHtml(drawTalk(talk(),DATA,lang,{open,threads:{[open]:{state:"failed",trace:"7a1-ICN"}}},true),open);
    assert.ok(failed.includes(esc(words("Could not load",lang).split(lang==="ko"?" 또는: ":" Or: ")[0]))&&failed.includes("7a1-ICN")&&failed.includes('data-nx-act="reload-entry"'));
    const closed=drawEntry(entryOf({kind:"comment",comment:comment("z",{state:"closed",closed_as:"answered"}),proposal:null}),"closed",lang,{open:id("nc","z"),threads:{}},true);
    assert.ok(closed.includes(`<span class="kind">${esc(label("The talk's entries",2,lang))}</span>`)&&closed.includes(`>${esc(words("Open again",lang))}</button>`)&&!closed.includes('data-nx-act="answered"'),"a closed comment opens again with a reply");
    assertKeyed(drawTalk(talk(),DATA,lang,{open,threads:{[open]:{state:"ready",data:{replies,decisions},seen:[]}}},true),"open comment "+lang);
  }
});
const answers=lang=>labels("Answers",lang);

test("an opened proposal: its change, reason and stage source text in its own box, and its reflection",()=>{
  const open=id("np","a");
  for(const lang of["en","ko"]){
    const heads=words("Proposal panel",lang).split(" · ");
    const loading=entryHtml(drawTalk(talk(),DATA,lang,{open},true),open);
    assert.ok(loading.includes(`<div class="chg" data-nx-key="chg"><b>${esc(heads[0])}</b><p>Add an index</p><b>${esc(heads[1])}</b><p>Why &lt;i&gt;</p><b>${esc(heads[2])}</b><div class="sk"`),"the source text loads");
    assert.ok(loading.includes(esc(heads[3].replace("{commit}","abcdef0"))));
    const edit=reflection("y",{id:id("ne","y"),state:"in-review",pull_request:"https://example.com/pr/9"});
    const ready=entryHtml(drawTalk(talk(),DATA,lang,{open,threads:{[open]:{state:"ready",data:{source_text:"CREATE <TABLE>"},edit}}},true),open);
    assert.ok(ready.includes('<pre class="stx">CREATE &lt;TABLE&gt;</pre>')&&ready.includes(`<p class="rst" data-nx-key="rst">`)&&ready.includes(esc(words("Reflection in review",lang,{"pull request":"https://example.com/pr/9"}))));
    assertKeyed(drawTalk(talk(),DATA,lang,{open,threads:{[open]:{state:"ready",data:{source_text:"x"},edit}}},true),"open proposal "+lang);
  }
  // A reflection that needs the user can be dismissed; the others cannot.
  const needs=drawEntry(entryOf(reflection("x",{state:"needs-user"}),"reflection"),"agent","en",{},true,false);
  assert.ok(needs.includes('data-nx-act="dismiss-edit"')&&needs.includes(esc(words("Reflection needs user","en"))));
});

test("an answer in place, its message, and the closed talk read 50 at a time (choice 19, SCR-114#error)",()=>{
  for(const lang of["en","ko"]){
    const a=id("np","a"),d=id("nc","d");
    const html=drawTalk(talk(),DATA,lang,{entries:{[a]:{done:true,mark:0,note:{tone:"info",text:label("Done already",0,lang)}},[d]:{done:true,mark:3}}},true);
    const accepted=entryHtml(html,a),passed=entryHtml(html,d);
    assert.ok(accepted.startsWith('<li class="te answered"')&&!accepted.includes('class="acts"')&&accepted.includes(`<div class="after" data-nx-key="after" tabindex="-1" data-nx-focus="np&#95;aaaaaaaaaaaa:after"><p class="res"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-check"/></svg><span>${esc(label("Answered",0,lang))}</span></p>`)&&accepted.includes(esc(label("Done already",0,lang))));
    assert.ok(passed.includes(esc(label("Answered",3,lang)))&&passed.includes(`data-nx-act="record" data-nx-focus="nc&#95;dddddddddddd:record">`)&&passed.includes(esc(labels("The head",lang)[4])),"a passed checkpoint leads to the stage record");
    const sending=entryHtml(drawTalk(talk(),DATA,lang,{entries:{[a]:{sending:"accept"}}},true),a);
    assert.ok(sending.includes(`data-nx-act="accept" data-nx-focus="np&#95;aaaaaaaaaaaa:accept" aria-describedby="tx-np&#95;aaaaaaaaaaaa" aria-disabled="true">${esc(codeMessage("Sending",lang))}</button>`),"a write's button says Sending… and does not send twice");
    const failed=entryHtml(drawTalk(talk(),DATA,lang,{entries:{[a]:{note:{tone:"err",text:codeMessage("No connection",lang),trace:"9-ICN",retry:"accept"}}}},true),a);
    assert.ok(failed.includes('role="alert"')&&failed.includes('data-nx-act="accept" data-nx-focus="np&#95;aaaaaaaaaaaa:retry"')&&failed.includes("9-ICN"),"Try again sends the same write");
    // The closed talk, open: newest first with Show more; loading; failed with Try again.
    const rows=[{kind:"comment",comment:comment("m",{state:"closed",closed_as:"decided"}),proposal:null},{kind:"proposal",comment:null,proposal:proposal("n",{state:"withdrawn"})},{kind:"proposal",comment:null,proposal:proposal("o",{state:"dismissed"})}];
    const open=drawTalk(talk({closed:{total:60,entries:[]}}),DATA,lang,{closed:{open:true,entries:rows,total:60}},true);
    assert.ok(open.includes('aria-expanded="true"')&&open.includes(`<ol class="tl" data-nx-key="l-closed" data-nx-sub>`)&&open.includes(`>${esc(label("The talk",6,lang))}</button></p>`));
    assert.ok(open.includes(`<span class="kind">${esc(label("The talk's entries",3,lang))}</span>`)&&open.includes(`<span class="kind">${esc(capital(labels("Proposal states",lang)[3],lang))}</span>`)&&open.includes(`<span class="kind">${esc(label("Answered",1,lang))}</span>`));
    assert.ok(drawTalk(talk(),DATA,lang,{closed:{open:true,entries:rows,total:60,more:"loading"}},true).includes(`<p class="more" data-nx-key="cmore" data-nx-live>${esc(labels("The list",lang)[10])}</p>`));
    assert.ok(drawTalk(talk(),DATA,lang,{closed:{open:true,entries:rows,total:60,more:"failed"}},true).includes(`${esc(labels("The list",lang)[11])} <button class="btn sm" type="button" data-nx-act="closed-more"`));
    assertKeyed(open,"closed "+lang);
  }
});

test("an entry drawn twice opens once, and an entry whose item is gone says so when it opens (SPEC-209)",()=>{
  const g=id("nc","g"),closedCopy={kind:"comment",comment:comment("g",{item:"TBL-999",state:"closed",closed_as:"answered"}),proposal:null};
  const html=drawTalk(talk(),DATA,"en",{open:g,threads:{[g]:{state:"ready",data:{replies:[]},seen:[]}},closed:{open:true,entries:[closedCopy],total:3}},true);
  assert.equal((html.match(/data-nx-entry="nc&#95;gggggggggggg"/g)||[]).length,2);
  assert.equal((html.match(/id="rp-nc&#95;gggggggggggg"/g)||[]).length,1,"one reply box");
  assert.equal((html.match(/aria-expanded="true"/g)||[]).length,3,"the entry, the unfolded closed talk and the control that folds the talk (SPEC-210)");
  assert.ok(html.includes('id="tx-nc&#95;gggggggggggg-2"')&&html.includes('data-nx-focus="talk:nc&#95;gggggggggggg:2"'),"the copy's IDs differ");
  assert.ok(html.includes(esc(label("An item that the talk selects",0,"en",{id:"TBL-999"}))),"the gone item, with its ID");
  assertKeyed(html,"copies");
});

test("the boxes count from 90 per cent and refuse more than 4,000 characters (rule 5)",()=>{
  assert.equal(TALK_LIMIT,4000);assert.equal(leftOf(3599),null);assert.equal(leftOf(3600),400);assert.equal(leftOf(4000),0);assert.equal(leftOf(4001),null);
  for(const lang of["en","ko"]){
    const left=drawTalk(talk(),DATA,lang,{box:{left:7,empty:false}},true),over=drawTalk(talk(),DATA,lang,{box:{over:true,empty:false}},true),sending=drawTalk(talk(),DATA,lang,{box:{sending:true,empty:false}},true);
    assert.ok(left.includes(`<p class="left" id="talk-left" data-nx-key="left" data-nx-live>${esc(codeMessage("Characters left",lang,{n:7}))}</p>`)&&left.includes('data-nx-act="leave" data-nx-focus="leave">'));
    assert.ok(over.includes(esc(codeMessage("text_too_long",lang,{limit:"4,000"})))&&over.includes('data-nx-act="leave" data-nx-focus="leave" disabled>'));
    assert.ok(sending.includes(`data-nx-act="leave" data-nx-focus="leave" aria-disabled="true">${esc(codeMessage("Sending",lang))}</button>`));
    const signIn=drawTalk(talk(),DATA,lang,{box:{empty:false,note:{tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true}}},true);
    assert.ok(signIn.includes('data-nx-act="sign-in" data-nx-focus="box:sign-in">'),"rule 7 above the box, the words kept");
    const limit=drawTalk(talk(),DATA,lang,{open:id("nc","b"),threads:{},replies:{[id("nc","b")]:{empty:false,note:{tone:"err",text:codeMessage("reply_limit",lang,{limit:200}),newComment:true}}}},true);
    assert.ok(limit.includes(`data-nx-act="new-comment" data-nx-focus="nc&#95;bbbbbbbbbbbb:reply:new">${esc(labels("The box",lang)[3])}</button>`),"reply_limit's Leave a new comment");
  }
});

test("the talk's notes, counts and helpers (SCR-114#gone, #error)",()=>{
  const html=drawTalk(talk(),DATA,"en",{notes:[{kind:"gone",tone:"warn",text:codeMessage("comment_not_found","en")},{kind:"read",tone:"err",text:codeMessage("Could not update","en"),retry:"read-talk"}],updating:true},true);
  assert.ok(between(html,'<div class="tnotes"','</p>').includes("This comment is not on the server.")&&html.includes('data-nx-act="read-talk"')&&html.includes('<p class="tupd" role="status" data-nx-key="upd" data-nx-live>Updating…</p>'));
  const many=talk({mine:{total:1000,entries:talk().mine.entries}});
  assert.ok(drawTalk(many,DATA,"en").includes(">My turn 999+</a>"),"counts over 999 show as 999+");
  assert.equal(count(1000),"999+");
  const groups=talkGroups(talk());
  assert.deepEqual(groups.agent.map(e=>e.type),["comment","comment","reflection"]);
  assert.equal(agentCount(talk()),3);assert.equal(openTalk(talk()),8,"the tab counts my turn, the agent's turn with its reflections, and apart");
  assert.deepEqual(groups.mine.map(kindOf),[0,1,2,3]);
  assert.deepEqual(itemsOf(entryOf({kind:"proposal",comment:null,proposal:proposal("q",{items:["TBL-1","TBL-2"]})})),["TBL-1","TBL-2"]);
  assert.deepEqual(itemsOf(entryOf(comment("q",{item:""}))),[]);
  const fourItems=drawEntry(entryOf({kind:"proposal",comment:null,proposal:proposal("q",{items:["TBL-1","TBL-2","TBL-3","TBL-4"]})}),"mine","en");
  assert.ok(fourItems.includes(`<span class="mono">TBL-3</span> <span class="mu">${esc(label("More",0,"en",{n:"1"}))}</span>`),"three IDs, then how many more");
});

test("the side holds the talk, and the page's parts draw it from the page's talk (SCR-111)",()=>{
  const data={project:{name:"qa-shop",title:"QA",repository:null,commit:null,generated_at:AT,pushed_at:AT,space:true,read_at:null,unread_since:null,parts:["sample"]},part:"sample",stage:"05-erd",head:{key:"05-erd",state:"in_progress",checkpoint:null,commit:null,time:AT,reads:true,source_state:"found",counts:{items:0,kinds:[],priorities:[],hotspots:null},picture:false},record:{project:"qa-shop",part:"sample",stage:"05-erd",record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],discrepancies:{total:0,entries:[]},comments:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[],warnings:[],not_opened:0},stages:[],items:{group:"context",filter:"all",q:null,total:0,after:0,counts:{all:0,talk:0,mine:0,left:0},groups:[],entries:[]}};
  assert.ok(drawSide(data,null,"en",{},talk()).startsWith('<section class="talk"'));
  assert.ok(drawSide(data,null,"en",{record:true},talk()).startsWith('<section class="rec"'),"the record takes the talk's place while it is open");
  const shown=narrowTalk(talk(),"TBL-001");
  assert.ok(drawSide(data,null,"en",{code:true,talkState:{shown,item:"TBL-001"}},talk()).includes(">Talk on TBL-001</h2>"),"the view's code draws what it shows");
  const parts=drawParts({schema:PAGE_SCHEMAS.stage,generated_at:AT,lang:"en",data,talk:talk(),picture:null,problem:null});
  assert.ok(parts.side.startsWith('<section class="talk"')&&parts.tabs.includes(">Talk 8<"));
});
