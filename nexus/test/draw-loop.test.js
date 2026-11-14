// TASK-298: the loop's two times and the mark of a long wait (stage 08's rules 19 and 20,
// SPEC-188, SPEC-189) as the server draws them and the view's code works them out again: on the
// first page's cards and agent to-do (SCR-110), in the workspace's head and the folded list of
// stages (SCR-111), and "Not read by the agent yet" in the talk (SCR-114). These tests read the
// drawing as text and run the code's step on stand-in elements; api-unread.test.js holds the
// answers behind them, and the browser suite loop-regression.mjs runs them on a page.
import test from "node:test";
import assert from "node:assert/strict";
import {esc,clock} from "../src/draw/html.js";
import {label,labels} from "../src/draw/words.js";
import {agoWords,waitedLong,loopTime,lastPush,lastRead,longWait,longWaitShape,localizeLoop} from "../src/draw/loop.js";
import {drawHome} from "../src/draw/home.js";
import {stageRail} from "../src/draw/stages.js";
import {drawTalk} from "../src/draw/talk.js";
import {drawParts,PAGE_SCHEMAS} from "../src/draw/page.js";
import {homeData} from "./home-fixtures.js";

const MINUTE=60000,HOUR=60*MINUTE,DAY=24*HOUR;
const at=text=>Date.parse(text);
const iso=ms=>new Date(ms).toISOString();
const WARN='<svg class="i" aria-hidden="true" focusable="false"><use href="#i-warn"/></svg>';
const between=(html,from,to)=>{const start=html.indexOf(from);assert.ok(start>=0,from);return html.slice(start,html.indexOf(to,start)+to.length);};
const timeOf=(value,ago)=>`<time datetime="${value}">${clock(value)}</time> (<span data-nx-ago="${value}">${esc(ago)}</span>)`;

test("how long ago, rounded down: just now, minutes, hours and days, in both languages (rule 19)",()=>{
  const base=at("2026-11-20T09:00:00.000Z"),ago=(ms,lang="en")=>agoWords(iso(base-ms),base,lang);
  assert.deepEqual([0,59999,MINUTE,59*MINUTE+59999,HOUR,23*HOUR+59*MINUTE,DAY,2*DAY-1,2*DAY,400*DAY].map(ms=>ago(ms)),
    ["just now","just now","1 min ago","59 min ago","1 h ago","23 h ago","1 d ago","1 d ago","2 d ago","400 d ago"]);
  assert.deepEqual([0,MINUTE,HOUR,DAY].map(ms=>ago(ms,"ko")),["방금","1분 전","1시간 전","1일 전"]);
  assert.equal(agoWords(iso(base+5*MINUTE),base,"en"),"just now","a time after now, as from a clock behind the server's");
  assert.equal(agoWords("not a time",base,"en"),"");assert.equal(agoWords(iso(base),"not a time","en"),"");assert.equal(agoWords(null,base,"en"),"");
  assert.equal(agoWords("2026-11-20T08:00:00.000Z","2026-11-20T09:00:00.000Z","en"),"1 h ago","the base as the page's data names it");
});

test("the mark of a long wait holds after more than 24 hours, and the server draws it as of the page's data (rule 20)",()=>{
  const since="2026-11-19T08:00:00.000Z",s=at(since);
  assert.equal(waitedLong(since,s+DAY),false,"24 hours exactly is not more");
  assert.equal(waitedLong(since,s+DAY+1),true);
  assert.equal(waitedLong(null,s+2*DAY),false);assert.equal(waitedLong("soon",s+2*DAY),false);
  for(const lang of["en","ko"]){
    const [mark,meaning]=labels("The mark of a long wait",lang);
    const shown=`<div class="m24w" data-nx-since="${since}"><span class="m24">${WARN}<span>${esc(mark)}</span></span><span class="m24l">${esc(meaning)}</span></div>`;
    assert.equal(longWait(since,iso(s+25*HOUR),lang),shown,"words and a shape, with the line on what it means");
    assert.equal(longWait(since,iso(s+23*HOUR),lang),shown.replace(`data-nx-since="${since}">`,`data-nx-since="${since}" hidden>`),"drawn hidden, for the code to show once 24 hours have passed");
    assert.equal(longWait(null,iso(s+25*HOUR),lang),"","nothing waits unread: no mark");
    // The folded list's mark opens the project's data (SCR-111#folded, SCR-130): a button with the
    // shape, whose name says the mark and where it leads, and which waits for the code (rule 15).
    const shape=`<button class="fmk" type="button" data-nx-act="data" data-nx-focus="fmk" aria-haspopup="dialog" data-nx-since="${since}">${WARN}<span class="sr">${esc(mark)}, ${esc(label("The workspace's head",0,lang))}</span></button>`;
    assert.equal(longWaitShape(since,iso(s+25*HOUR),lang,true),shape,"the folded list's mark: a button to the project's data, as the code draws it");
    assert.equal(longWaitShape(since,iso(s+25*HOUR),lang),shape.replace('">'+WARN,'" disabled data-nx-wait="data">'+WARN),"the server draws it waiting for the code");
    assert.equal(longWaitShape(since,iso(s+23*HOUR),lang,true),shape.replace(`data-nx-since="${since}">`,`data-nx-since="${since}" hidden>`),"drawn hidden, for the code to show once 24 hours have passed");
    assert.ok(!/<a |<button/.test(longWait(since,iso(s+25*HOUR),lang)),"the head's mark is words, not a control");
  }
});

test("a time of the loop, the last push and the agent's last read, with each place filled (rule 19)",()=>{
  const base="2026-11-20T09:30:00.000Z";
  assert.equal(loopTime("2026-11-20T09:00:00.000Z",base,"en"),timeOf("2026-11-20T09:00:00.000Z","30 min ago"));
  assert.equal(loopTime("2026-11-20T09:00:00.000Z",base,"ko"),timeOf("2026-11-20T09:00:00.000Z","30분 전"));
  assert.equal(loopTime("2026-11-20T09:00:00.000Z","no base","en"),'<time datetime="2026-11-20T09:00:00.000Z">2026-11-20 09:00</time>',"without a base, the time alone");
  assert.equal(loopTime('"><b>',base,"en"),'<time datetime="&quot;&gt;&lt;b&gt;">&quot;&gt;&lt;b&gt;</time>',"an unreadable time stays text");
  assert.equal(lastPush("abc1234"+"0".repeat(33),"2026-11-20T09:00:00.000Z",base,"en"),`<span class="mono">abc1234</span> · Pushed ${timeOf("2026-11-20T09:00:00.000Z","30 min ago")}`);
  assert.equal(lastPush(null,"2026-11-20T09:00:00.000Z",base,"ko"),`커밋 없음 · 올림: ${timeOf("2026-11-20T09:00:00.000Z","30분 전")}`);
  assert.ok(lastPush("<b>_x","2026-11-20T09:00:00.000Z",base,"en").startsWith('<span class="mono">&lt;b&gt;&#95;x</span> · '),"a commit is text");
  for(const lang of["en","ko"]){
    const words=labels("The agent's last read",lang);
    assert.equal(lastRead(true,"2026-11-20T09:05:00.000Z",base,lang),esc(words[0]).replace("{time}",timeOf("2026-11-20T09:05:00.000Z",label("How long ago",1,lang,{n:25}))));
    assert.equal(lastRead(true,null,base,lang),esc(words[1]),"before the first read");
    assert.equal(lastRead(false,null,base,lang),esc(words[2]),"a project without a space");
    assert.equal(lastRead(false,"2026-11-20T09:05:00.000Z",base,lang),esc(words[2]),"no space, whatever else");
  }
});

// A first page with the cases of SPEC-188 (TC-1413 to TC-1415), as API-151 answers at 09:00:
// acme, stored at 08:30 from abc1234 and read at 08:35; beta, never read; legacy, pushed by a hub
// of 0.1 and so without a space; and late, whose comment has waited since 08:00 yesterday after
// a read at 07:00 yesterday.
function firstPage(){
  const data=homeData({entries:[]}),card=data.projects[1],none={total:0,oldest:null};
  const project=(name,commit,pushed)=>({...structuredClone(card),name,title:name,repository:null,commit,pushed_at:pushed});
  const counts=(name,comments,read)=>({project:name,comments:{total:comments,oldest:comments?{part:"sample",stage:"05-erd",entry:"nc_aaaaaaaaaaaa"}:null},discrepancies:none,reflections:none,checkpoints:none,taken:0,...read});
  return{...data,generated_at:"2026-11-20T09:00:00.000Z",
    projects:[project("acme","abc1234"+"0".repeat(33),"2026-11-20T08:30:00.000Z"),project("beta",null,"2026-11-19T09:00:00.000Z"),project("late","fedcba9"+"0".repeat(33),"2026-11-18T09:00:00.000Z"),project("legacy","1234567"+"0".repeat(33),"2026-11-01T09:00:00.000Z")],
    agent:[counts("acme",0,{read_at:"2026-11-20T08:35:00.000Z",unread:0,unread_since:null}),counts("beta",2,{read_at:null,unread:2,unread_since:"2026-11-19T20:00:00.000Z"}),counts("late",1,{read_at:"2026-11-19T07:00:00.000Z",unread:1,unread_since:"2026-11-19T08:00:00.000Z"})]};
}
const cardOf=(html,name)=>between(html,`<h3 id="pc-${["acme","beta","late","legacy"].indexOf(name)}">`,"</article>");
const todoOf=(html,name)=>between(html,`<div class="pj"><h3><span>${name}</span>`,"<ul>");

test("TC-1413 to TC-1415 on the first page: both times with how long ago, not read yet, no agent to-do yet and the mark",()=>{
  for(const lang of["en","ko"]){
    const html=drawHome(firstPage(),lang),push=labels("The last push",lang),read=labels("The agent's last read",lang),minutes=n=>label("How long ago",1,lang,{n}),days=n=>label("How long ago",3,lang,{n});
    const pushed=(value,ago)=>esc(push[0]).replace("{time}",timeOf(value,ago)),readAt=(value,ago)=>esc(read[0]).replace("{time}",timeOf(value,ago));
    // TC-1413: acme's card shows abc1234, the push and the read, each with how long ago.
    assert.ok(cardOf(html,"acme").includes(`<div class="ptimes"><div class="loop"><span><span class="mono">abc1234</span> · ${pushed("2026-11-20T08:30:00.000Z",minutes(30))}</span><span>${readAt("2026-11-20T08:35:00.000Z",minutes(25))}</span></div></div>`),"TC-1413 on the card");
    // TC-1414: beta was never read; it waits less than 24 hours, so the mark is drawn hidden.
    const beta=cardOf(html,"beta");
    assert.ok(beta.includes(`<span>${esc(push[1])} · ${pushed("2026-11-19T09:00:00.000Z",days(1))}</span><span>${esc(read[1])}</span></div><div class="m24w" data-nx-since="2026-11-19T20:00:00.000Z" hidden>`),"TC-1414 on the card");
    assert.ok(todoOf(html,"beta").includes(`<span class="nr">${esc(label("Not read, in the agent to-do",0,lang,{n:"2"}))}</span></h3><div class="loop"><span>${pushed("2026-11-19T09:00:00.000Z",days(1))}</span><span>${esc(read[1])}</span></div><div class="m24w" data-nx-since="2026-11-19T20:00:00.000Z" hidden>`),"TC-1414 in the agent to-do");
    // TC-1415: late's comment has waited 25 hours unread, so its last read carries the mark.
    const [mark]=labels("The mark of a long wait",lang),shown=`<div class="m24w" data-nx-since="2026-11-19T08:00:00.000Z"><span class="m24">${WARN}<span>${esc(mark)}</span></span>`;
    assert.ok(cardOf(html,"late").includes(`<span>${readAt("2026-11-19T07:00:00.000Z",days(1))}</span></div>${shown}`),"TC-1415 on the card");
    assert.ok(todoOf(html,"late").includes(`<span>${readAt("2026-11-19T07:00:00.000Z",days(1))}</span></div>${shown}`),"TC-1415 in the agent to-do");
    // A project without a space has no agent to-do: its card says so and no line lists it.
    assert.ok(cardOf(html,"legacy").includes(`<span>${esc(read[2])}</span></div></div>`)&&!html.includes('<div class="pj"><h3><span>legacy</span>'),"no agent to-do yet");
    // A project whose agent read everything is not in the agent to-do, as before.
    assert.ok(!html.includes('<div class="pj"><h3><span>acme</span>'));
    // Nothing is marked about the push, and every time keeps its place for the code (rule 15).
    assert.equal((html.match(/class="m24w"/g)||[]).length,4,"the mark is the last read's: beta's and late's card and lines");
    assert.equal((html.match(/data-nx-ago=/g)||[]).length,4+2+3,"4 pushes and 2 reads on the cards, 2 pushes and 1 read in the agent to-do");
  }
});

test("the workspace's head and the folded list: the last push, the last read and the mark (SCR-111, TC-1413 to TC-1415)",()=>{
  const data=over=>({project:{name:"acme",title:"Acme",repository:"https://github.com/example/acme",commit:"abc1234"+"0".repeat(33),generated_at:"2026-11-20T08:00:00.000Z",pushed_at:"2026-11-20T08:30:00.000Z",space:true,read_at:"2026-11-20T08:35:00.000Z",unread_since:null,parts:["sample"],...over},
    part:"sample",stage:"05-erd",stages:[]});
  for(const lang of["en","ko"]){
    const read=labels("The agent's last read",lang),push=labels("The last push",lang),base="2026-11-20T09:00:00.000Z",[mark]=labels("The mark of a long wait",lang);
    const head=stageRail(data(),lang,base);
    assert.ok(head.startsWith(`<div class="proj"><b id="rail-name">Acme</b><span class="mu sm clip">example/acme</span><div class="loop"><span><span class="mono">abc1234</span> · ${esc(push[0]).replace("{time}",timeOf("2026-11-20T08:30:00.000Z",label("How long ago",1,lang,{n:30})))}</span><span>${esc(read[0]).replace("{time}",timeOf("2026-11-20T08:35:00.000Z",label("How long ago",1,lang,{n:25})))}</span></div><button class="pdl" type="button" data-nx-act="data" data-nx-focus="data" aria-haspopup="dialog" disabled data-nx-wait="data">${esc(label("The workspace's head",0,lang))}</button></div>`),"TC-1413 in the head, in the place of the snapshot's own time, then Project data (SCR-130)");
    assert.ok(stageRail(data(),lang,base,true).includes(`<button class="pdl" type="button" data-nx-act="data" data-nx-focus="data" aria-haspopup="dialog">`),"the code's drawing: Project data works");
    assert.ok(stageRail(data({read_at:null,commit:null}),lang,base).includes(`<span>${esc(push[1])} · `)&&stageRail(data({read_at:null}),lang,base).includes(`<span>${esc(read[1])}</span>`),"No commit; not read by the agent yet (TC-1414)");
    assert.ok(stageRail(data({space:false,read_at:null}),lang,base).includes(`<span>${esc(read[2])}</span>`),"no agent to-do yet, without a space (SCR-111's Target)");
    const late=stageRail(data({read_at:"2026-11-19T07:00:00.000Z",unread_since:"2026-11-19T08:00:00.000Z"}),lang,base);
    assert.ok(late.startsWith(`<button class="fmk" type="button" data-nx-act="data" data-nx-focus="fmk" aria-haspopup="dialog" data-nx-since="2026-11-19T08:00:00.000Z" disabled data-nx-wait="data">${WARN}<span class="sr">${esc(mark)}, ${esc(label("The workspace's head",0,lang))}</span></button><div class="proj">`),"the folded list keeps the mark at its top, which opens the project's data (SCR-111#folded)");
    assert.ok(late.includes(`</div><div class="m24w" data-nx-since="2026-11-19T08:00:00.000Z"><span class="m24">${WARN}<span>${esc(mark)}</span></span>`),"the head carries the mark (TC-1415)");
    assert.ok(stageRail(data({unread_since:"2026-11-20T08:00:00.000Z"}),lang,base).startsWith('<button class="fmk" type="button" data-nx-act="data" data-nx-focus="fmk" aria-haspopup="dialog" data-nx-since="2026-11-20T08:00:00.000Z" hidden disabled data-nx-wait="data">'),"an hour's wait: drawn hidden");
  }
  // The page draws the head as of the page's own time, so that the code draws it the same.
  const payload={schema:PAGE_SCHEMAS.stage,generated_at:"2026-11-20T09:00:00.000Z",lang:"en",data:{...data(),head:{key:"05-erd",state:"in_progress",checkpoint:null,commit:null,time:"2026-11-20T08:00:00.000Z",reads:true,source_state:"found",counts:{items:0,kinds:[],priorities:[],hotspots:null},picture:false},
    record:{project:"acme",part:"sample",stage:"05-erd",record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],discrepancies:{total:0,entries:[]},comments:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[],warnings:[],not_open:[]},
    items:{group:"none",filter:"all",q:null,total:0,after:0,counts:{all:0,talk:0,mine:0,left:0},groups:[],entries:[]}},talk:null,picture:null,problem:null};
  assert.equal(drawParts(payload).rail,stageRail(payload.data,"en","2026-11-20T09:00:00.000Z"));
  assert.ok(drawParts(payload).rail.includes(">30 min ago<"));
  assert.ok(drawParts({...payload,generated_at:"2026-11-20T10:30:00.000Z"}).rail.includes(">2 h ago<"),"a later page, a later how long ago");
});

// Stand-ins for the page's elements, for the code's step (../src/draw/loop.js's localizeLoop).
function scopeOf(html){
  const elements=[...html.matchAll(/<(span|div)( class="[^"]*")? (data-nx-ago|data-nx-since)="([^"]+)"( hidden)?>([^<]*)/g)].map(([,,,name,value,hidden,text])=>({name,value,hidden:Boolean(hidden),textContent:text,getAttribute(attribute){return attribute===name?value:null;}}));
  return{elements,querySelectorAll(selector){return elements.filter(element=>selector===`[${element.name}]`);}};
}
test("TC-1416: the code works out how long ago and the mark again as of the browser's clock, as when the page shows again",()=>{
  const data=firstPage(),html=drawHome(data,"en"),scope=scopeOf(html),base=at(data.generated_at);
  const texts=()=>scope.elements.filter(e=>e.name==="data-nx-ago").map(e=>e.textContent),marks=()=>scope.elements.filter(e=>e.name==="data-nx-since").map(e=>e.hidden);
  // The agent to-do's beta and late, then the cards of acme, beta, late and legacy.
  const drawn=["1 d ago","2 d ago","1 d ago","30 min ago","25 min ago","1 d ago","2 d ago","1 d ago","19 d ago"];
  assert.deepEqual(texts(),drawn);
  localizeLoop(scope,"en",base);
  assert.deepEqual(texts(),drawn,"as of the page's own time the code changes nothing (rule 15)");
  assert.deepEqual(marks(),[true,false,true,false],"beta's hidden and late's shown, in the agent to-do and on the cards");
  // An hour later: acme's push and read are an hour older, and beta's wait is not yet 24 hours.
  localizeLoop(scope,"en",base+HOUR);
  assert.deepEqual(texts(),["1 d ago","2 d ago","1 d ago","1 h ago","1 h ago","1 d ago","2 d ago","1 d ago","19 d ago"],"30 and 25 minutes ago become 1 h ago");
  assert.deepEqual(marks(),[true,false,true,false]);
  // Beta's oldest entry has waited unread since 20:00 yesterday: past 20:00 today, its mark shows.
  localizeLoop(scope,"en",at("2026-11-20T20:00:00.001Z"));
  assert.deepEqual(marks(),[false,false,false,false],"the mark shows once 24 hours have passed");
  localizeLoop(scope,"ko",base);
  assert.ok(texts().includes("30분 전")&&texts().includes("1일 전"),"in the page's language");
  assert.deepEqual(marks(),[true,false,true,false],"and goes again as of an earlier clock");
  const odd=scopeOf('<span data-nx-ago="later">kept</span>');localizeLoop(odd,"en",base);
  assert.equal(odd.elements[0].textContent,"kept","a value that is not a time keeps its text");
});

// The talk of SPEC-189's cases (TC-1417 to TC-1420): in the agent's turn a comment that the
// agent has not read, one that it read, one that a session took and a pending reflection that
// it has not read; apart, a comment whose item is gone; in my turn, the agent's question.
const id=(prefix,letter)=>prefix+"_"+letter.repeat(12);
const comment=(letter,extra={})=>({id:id("nc",letter),part:"sample",stage:"05-erd",item:"TBL-001",quote:null,discrepancy:null,author:"user",text:`Text ${letter}`,state:"open",closed_as:null,waits:"agent",asks:null,made_at:"2026-11-20T10:00:00.000Z",last_at:"2026-11-20T10:05:00.000Z",commit:"0123456",settled:false,dismissed:false,replies:1,last_reply:null,proposals:[],claim:null,unread:false,look_first:null,...extra});
function talk(){
  const reflection={id:id("ne","r"),part:"sample",stage:"05-erd",proposal:{id:id("np","r"),part:"sample",stage:"05-erd",reason:"Why",change:"Add an index",comment:null,discrepancy:null,state:"accepted",made_at:"2026-11-20T09:00:00.000Z",closed_at:"2026-11-20T09:10:00.000Z",edit:null,commit:"abcdef0",items:["TBL-002"],source_text_chars:20},
    state:"pending",pull_request:null,closed_commit:null,made_at:"2026-11-20T09:10:00.000Z",changed_at:"2026-11-20T09:10:00.000Z",commit:"abcdef0",claim:null,unread:true};
  return{project:"acme",part:"sample",stage:"05-erd",item:null,
    mine:{total:1,entries:[{kind:"comment",comment:comment("q",{author:"agent",waits:"user",asks:"answer",unread:false}),proposal:null}]},
    agent:{total:3,entries:[comment("a",{unread:true}),comment("b",{last_at:"2026-11-20T09:00:00.000Z"}),comment("c",{unread:false,claim:{claimed_at:"2026-11-20T10:20:00.000Z",ends_at:"2026-11-20T11:20:00.000Z",mine:false}})]},
    apart:{total:1,entries:[comment("g",{item:"TBL-999",unread:true})]},closed:{total:0,entries:[]},reflections:[reflection]};
}
const entryOf=(html,entry)=>between(html,`data-nx-entry="${esc(entry)}"`,"</li>");
test("TC-1417 to TC-1420 in the talk: Not read by the agent yet, after the entry's wait, in the agent's turn only",()=>{
  for(const lang of["en","ko"]){
    const html=drawTalk(talk(),{stage:"05-erd"},lang),word=esc(label("Not read, on an entry",0,lang)),mark=`<span class="nrd">${word}</span>`;
    // TC-1417: the user's reply after the last read leaves the comment unread, after its wait.
    assert.ok(entryOf(html,id("nc","a")).includes(`<p class="wt" data-nx-key="wt"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-dot"/></svg><span>${esc(label("Waiting",0,lang)).replace("{time}",'<time datetime="2026-11-20T10:05:00.000Z">2026-11-20 10:05</time>')} ${mark}</span></p>`),"TC-1417");
    // TC-1418: read since, the mark is gone; the wait stays.
    assert.ok(!entryOf(html,id("nc","b")).includes("nrd")&&entryOf(html,id("nc","b")).includes('<p class="wt" data-nx-key="wt">'),"TC-1418");
    // TC-1419: taken by a session, without the mark, even where an answer said otherwise.
    const taken=drawTalk({...talk(),agent:{total:1,entries:[comment("c",{unread:true,claim:{claimed_at:"2026-11-20T10:20:00.000Z",ends_at:"2026-11-20T11:20:00.000Z",mine:false}})]}},{stage:"05-erd"},lang);
    assert.ok(entryOf(taken,id("nc","c")).includes(esc(label("Waiting",1,lang)).split("{time}")[0])&&!entryOf(taken,id("nc","c")).includes("nrd"),"TC-1419");
    // TC-1420: a pending reflection that the agent has not read says so beside how it stands.
    const reflected=entryOf(html,id("ne","r"));
    assert.ok(/<p class="rst" data-nx-key="rst"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-info"\/><\/svg><span>[^<]+ <span class="nrd">/.test(reflected)&&reflected.includes(mark),"TC-1420: the reflection");
    // Only the agent's turn: neither my turn nor the comments apart carry it.
    assert.equal((html.match(/class="nrd"/g)||[]).length,2,"the unread comment and the reflection");
    assert.ok(!entryOf(html,id("nc","q")).includes("nrd")&&!entryOf(html,id("nc","g")).includes("nrd"));
    // Opened, the reflection's change keeps the mark beside how it stands.
    const opened=drawTalk(talk(),{stage:"05-erd"},lang,{open:id("ne","r"),threads:{[id("ne","r")]:{state:"ready",data:{source_text:"CREATE INDEX"}}}},true);
    assert.ok(entryOf(opened,id("ne","r")).includes(mark),"opened");
  }
});
