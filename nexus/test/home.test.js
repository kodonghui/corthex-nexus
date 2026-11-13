// TASK-273: the first page (SCR-110) as the server draws it from API-151's answer and the
// view's code draws it again with what it adds: answers in place, their messages, the
// notices of reading again, the cards' order and 0.2's fragments on `/` (SPEC-143 to
// SPEC-145, SPEC-154). The browser suite home-regression.mjs runs the code on a page.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {drawHome,talkPath,countPath,entryKind,drawingSVG,wholeRequest,passScope,PASS_WORDS,PICTURED,AGENT_LISTS} from "../src/draw/home.js";
import {esc,count,clock,time,timed} from "../src/draw/html.js";
import {label,labels,oldLabels,legendWord,codeMessage,notCurrentWhy} from "../src/draw/words.js";
import {stageName} from "../src/draw/stages.js";
import {PALETTE,DARK_FILTER} from "../src/draw/palette.js";
import {picturePreview} from "../src/preview.js";
import {followFragment} from "../ui/home.js";
import {homeData,turnEntries,REQUEST,AT,NOW,SHOP_READ,HOME_TITLE} from "./home-fixtures.js";
import {viewSnapshot} from "./view-fixtures.js";

const tags=(html,pattern)=>html.match(pattern)||[];
const SITEMAP=viewSnapshot("qa-home").pictures.find(picture=>picture.stage==="07-sitemap").source;
const section=(html,key)=>{const start=html.indexOf(`data-nx-key="${key}"`);assert.ok(start>=0,key);return html.slice(start,html.indexOf("</section>",start));};
const entry=(html,id)=>{const start=html.indexOf(`data-nx-entry="${esc(id)}"`);assert.ok(start>=0,id);return html.slice(start,html.indexOf("</li>",start));};
const card=(html,index)=>{const start=html.indexOf(`<article class="pcard" aria-labelledby="pc-${index}">`);assert.ok(start>=0,"card "+index);return html.slice(start,html.indexOf("</article>",start));};
// A time of the loop as the server draws it (rule 19): the time in UTC and how long ago as of
// the answer, each in the element that the code writes again; words holds its place.
const loopTime=(value,ago)=>`<time datetime="${value}">${clock(value)}</time> (<span data-nx-ago="${value}">${esc(ago)}</span>)`;
const placed=(words,value,ago)=>esc(words).replace(/\{time\}/,loopTime(value,ago));
const longWait=(since,lang,hidden=false)=>{const [mark,meaning]=labels("The mark of a long wait",lang);return`<div class="m24w" data-nx-since="${since}"${hidden?" hidden":""}><span class="m24"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-warn"/></svg><span>${esc(mark)}</span></span><span class="m24l">${esc(meaning)}</span></div>`;};

test("SCR-110#normal: my turn with each kind's answers, the agent to-do and the cards, as the server draws them",()=>{
  for(const lang of["en","ko"]){
    const html=drawHome(homeData(),lang),answers=labels("Answers",lang),kinds=labels("An entry's kind",lang),mine=section(html,"mine");
    assert.ok(mine.includes(`<h2 id="mine-h" data-nx-key="mine-h">${esc(label("My turn",0,lang,{n:label("The list",9,lang,{n:"4",total:"73"})}))}</h2>`),"50 of 73 (rule 12)");
    assert.ok(mine.includes(esc(labels("My turn",lang)[1]))&&mine.includes(esc(label("The turn",0,lang))),"what my turn holds and when the agent reads it (rule 18)");
    assert.deepEqual(tags(mine,/<span class="kind acc"[^>]*>[^<]+<\/span>/g).map(k=>k.replace(/<[^>]+>/g,"")),[kinds[0],kinds[2],kinds[3],kinds[1]]);
    // The answers that each kind offers: the writes wait for the code (rule 15), the links do not.
    const proposal=entry(html,"np_1"),recommended=entry(html,"nc_2"),checkpoint=entry(html,"nc_3"),question=entry(html,"nc_4");
    assert.deepEqual(tags(proposal,/<button [^>]*>[^<]+<\/button>/g).map(b=>[b.match(/data-nx-act="(\w+)"/)[1],b.includes(" pri"),b.replace(/<[^>]+>/g,"")]),[["accept",true,answers[0]],["dismiss",false,answers[1]]]);
    assert.ok(!proposal.includes("<a class=\"btn"),"a proposal is answered in place only");
    assert.deepEqual(answers,lang==="en"?["Accept","Dismiss","As recommended","Reply"]:["받기","버리기","추천대로","답하기"],"no answer passes a checkpoint (TASK-302)");
    assert.ok(recommended.includes(`data-nx-act="recommended"`)&&recommended.includes(`>${esc(answers[2])}</button>`)&&recommended.includes(`<a class="btn sm answer" href="/p/qa-shop/sample/07-sitemap#talk=nc&#95;2" data-nx-focus="nc&#95;2:talk" aria-describedby="w-nc&#95;2">${esc(answers[3])}</a>`));
    // A checkpoint request whole (SCR-110's revision): "Open the request", the first and filled,
    // a link that works at once; then the pass and "Add your words", which wait for the code.
    const request=labels("A checkpoint request's buttons",lang);
    assert.deepEqual(tags(checkpoint,/<(?:a|button) class="btn[^"]*"[^>]*>[^<]+<\/(?:a|button)>/g).map(b=>[b.slice(1,b.indexOf(" ")),b.match(/class="([^"]+)"/)[1],b.replace(/<[^>]+>/g,"")]),
      [["a","btn sm pri answer",esc(request[0])],["button","btn sm answer",esc(label("The pass",0,lang,{n:"12"}))],["button","btn sm quiet answer",esc(request[1])]]);
    assert.ok(checkpoint.includes(`<a class="btn sm pri answer" href="/p/qa-shop/sample/12-qa#talk=nc&#95;3" data-nx-focus="nc&#95;3:talk" aria-describedby="w-nc&#95;3">`)&&!checkpoint.includes('data-nx-act="recommended"'),"no pass as recommended");
    assert.ok(!question.includes("<button")&&question.includes(`>${esc(answers[3])}</a>`),"a question is answered in words, in the talk");
    for(const button of tags(mine,/<button [^>]*>/g))assert.match(button,/ aria-describedby="w-[^"]+" disabled data-nx-wait="answer">$/,"the answers wait for the code and name their entry");
    assert.equal(tags(mine,/<button /g).length,5);
    // Each entry's place, its text as text, its author and time.
    assert.ok(proposal.includes(`<span>${esc(HOME_TITLE)}</span><span aria-hidden="true">·</span><span>sample</span><span aria-hidden="true">·</span><span>05 ${esc(stageName("05-erd",lang))}</span>`));
    assert.ok(proposal.includes(`<a class="lnk clip" href="/p/qa-shop/sample/05-erd#talk=np&#95;1" data-nx-focus="np&#95;1:place"><span class="mono">TBL-020</span> index&#95;items</a>`));
    assert.ok(checkpoint.includes(`>${esc(label("An entry's place",0,lang))}</a>`),"the stage as a whole");
    assert.ok(question.includes('href="/p/qa-second/&#95;/01-domain#talk=nc&#95;4"')&&question.includes("><q>Payment table</q></a>")&&!question.includes(esc(label("An entry's place",0,lang))),"a part without an ID shows its quote");
    assert.ok(proposal.includes("<p class=\"txt\">Add &lt;b&gt;embedded&#95;at&lt;/b&gt; to index&#95;items.</p>"),"the agent's text is text (rule 1)");
    assert.ok(proposal.includes(`<span class="when mu cap" data-nx-key="n">${esc(labels("Author and time",lang)[0])} · <time datetime="${AT}">2026-11-08 08:30</time></span>`),"the server writes the time in UTC");
    // The request whole: its last entry's whole text with its lines, as text; "Look at first", a
    // link to the item at its stage with its ID and title; the commit; and what is left.
    const whole=labels("A checkpoint request, whole",lang);
    assert.ok(html.includes(`<li class="ent req" data-nx-key="e:nc&#95;3" data-nx-entry="nc&#95;3" data-nx-sub><span class="kind acc" data-nx-key="k">`),"the request's parts keep their places when the code draws again");
    assert.ok(checkpoint.includes(`<p class="txt rq" data-nx-key="t">Stage 12 is ready for its checkpoint.\nThe &lt;b&gt;cases&lt;/b&gt; pass; look at TC-120 first.</p>`),"the whole text, not its first 300 characters");
    assert.ok(checkpoint.includes(`<div class="rqf" data-nx-key="f"><span class="lf"><span class="rk">${esc(whole[0])}</span><a class="lnk" href="/p/qa-shop/sample/12-qa#item=TC-120" data-nx-focus="nc&#95;3:look"><span class="mono">TC-120</span> Pay &lt;twice&gt;</a></span><span class="cm">${esc(label("The head",2,lang,{commit:"0123456"}))}</span><span class="lt"><span class="rk">${esc(whole[1])}</span><span class="c">${esc(label("A checkpoint request, whole",2,lang,{n:"0"}))} ·</span> <span class="c">${esc(label("A checkpoint request, whole",3,lang,{n:"3"}))} ·</span> <span class="c">${esc(label("A checkpoint request, whole",4,lang,{n:"999+"}))}</span></span></div>`),"Look at first, the commit and what is left");
    assert.ok(!checkpoint.includes('class="wb"'),"no words' box before the code");
    // The agent to-do: each count opens what it counts; a list without entries has no row.
    const todo=section(html,"todo"),words=labels("Agent to-do",lang);
    assert.ok(todo.includes(`<h2 id="todo-h">${esc(label("Agent to-do",0,lang,{n:"999+"}))}</h2>`),"3 + 1,500 + 1 shows as 999+");
    assert.deepEqual(tags(todo,/<a href="[^"]+"[^>]*><span>[^<]+<\/span><b>[^<]+<\/b><\/a>/g).map(a=>[a.match(/href="([^"]+)"/)[1],a.match(/<span>([^<]+)/)[1],a.match(/<b>([^<]+)/)[1]]),
      [["/p/qa-shop/sample/05-erd#talk=nc&#95;9",esc(words[1]),"3"],["/p/qa-shop/sample/07-sitemap#filter=left",esc(words[2]),"999+"],["/p/qa-shop/sample/12-qa",esc(words[4]),"1"]]);
    assert.equal(tags(todo,/<div class="pj">/g).length,1,"a project with nothing for the agent has no counts");
    assert.ok(todo.includes(`<span class="taken">${esc(label("Agent to-do",5,lang,{n:"2"}))}</span>`)&&todo.includes(esc(words[6])),"taken by a session; the server runs no AI (rule 18)");
    // Under the project's name its last push and the agent's last read, with how long ago, and
    // the mark of a long wait; beside it how many entries the agent has not read (TASK-298).
    const days=n=>label("How long ago",3,lang,{n});
    assert.ok(todo.includes(`<div class="pj"><h3><span>${esc(HOME_TITLE)}</span><span class="nr">${esc(label("Not read, in the agent to-do",0,lang,{n:"4"}))}</span></h3><div class="loop"><span>${placed(label("The last push",0,lang),"2026-11-08T09:00:00.000Z",days(1))}</span><span>${placed(label("The agent's last read",0,lang),SHOP_READ.read_at,days(1))}</span></div>${longWait(SHOP_READ.unread_since,lang)}<ul>`),"the loop's times and the mark in the agent to-do");
    // The cards in the server's order, by name, with the order that waits for the code.
    const projs=section(html,"projs"),order=labels("Projects",lang);
    assert.ok(projs.includes(`<h2 id="projs-h">${esc(label("Projects",0,lang,{n:"2"}))}</h2>`));
    assert.deepEqual(tags(projs,/<button [^>]*>[^<]+<\/button>/g).map(b=>[b.match(/data-nx-order="(\w+)"/)[1],b.match(/aria-pressed="(\w+)"/)[1],b.includes(' disabled data-nx-wait="order"'),b.replace(/<[^>]+>/g,"")]),[["name","true",true,esc(order[1])],["push","false",true,esc(order[2])]]);
    const second=card(html,0),shop=card(html,1);
    assert.ok(second.includes('<h3 id="pc-0">qa-second</h3>')&&!second.includes('class="now"')&&!second.includes('class="lbl"'),"one part without a name, all stages done: no current stage");
    assert.ok(second.includes(`</header><div class="ptimes"><div class="loop"><span>${esc(label("The last push",1,lang))} · ${placed(label("The last push",0,lang),"2026-11-07T09:00:00.000Z",days(2))}</span><span>${esc(label("The agent's last read",1,lang))}</span></div></div><div class="thumbs">`),"no commit, and not read by the agent yet: the card says both, and nothing waits unread");
    assert.deepEqual(tags(second,/<a class="thumb" href="[^"]+">/g).map(a=>a.match(/href="([^"]+)"/)[1]),PICTURED.map(stage=>"/p/qa-second/&#95;/"+stage));
    assert.equal(tags(second,/<span class="pic none"><span>[^<]+<\/span><\/span>/g).length,3,"No picture yet");
    assert.ok(shop.includes(`<h3 id="pc-1">${esc(HOME_TITLE)}</h3><span class="mu sm clip">example/qa-shop</span>`)&&shop.includes(`<div class="ptimes"><div class="loop"><span><span class="mono">0123456</span> · ${placed(label("The last push",0,lang),"2026-11-08T09:00:00.000Z",days(1))}</span><span>${placed(label("The agent's last read",0,lang),SHOP_READ.read_at,days(1))}</span></div>${longWait(SHOP_READ.unread_since,lang)}</div><div class="now">`),"the commit's first 7 characters, the last push and read, and the mark, in the place of the snapshot's commit and time");
    assert.ok(shop.includes(`<p class="np"><b>sample</b><span>${esc(label("Projects",3,lang,{stage:"02 "+stageName("02-prd",lang),state:legendWord("in_progress",lang)}))}</span><span class="mu">${esc(label("Projects",4,lang,{"next action":"Write the <PRD> again"}))}</span></p>`),"Now and Next");
    assert.ok(shop.includes(`<p class="np"><b>second</b><span class="mu">${esc(label("No progress",0,lang))}</span></p>`),"REQ-103's words for a part without records");
    const thumbs=tags(shop,/<a class="thumb" href="[^"]+">.*?<\/a>/g);
    assert.equal(thumbs.length,6,"three pictured stages for each part");
    assert.ok(thumbs[0].includes("<svg viewBox=\"0 0 200 100\"")&&thumbs[0].includes(`<span class="cnt"><span aria-hidden="true">2</span><span class="sr">${esc(label("Projects",11,lang,{n:"2"}))}</span></span>`)&&thumbs[0].endsWith(`<span class="cap">sample · 01 ${esc(stageName("01-domain",lang))}</span></a>`));
    assert.ok(thumbs[1].includes(`<span class="flag"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-warn"/></svg><span>${esc(order[6])}</span><span class="sr">${esc(notCurrentWhy("source-gone","abc1234",lang))}</span></span>`)&&thumbs[1].includes('<span aria-hidden="true">999+</span>'),"a picture that is not current says so and why");
    assert.deepEqual(tags(shop,/<div class="strip">/g).length,2);assert.equal(tags(shop,/<span class="mk" /g).length,26,"13 stages for each part");
    assert.ok(shop.includes(`<footer><span>${esc(label("Projects",8,lang,{n:"999+"}))} · ${esc(label("Projects",9,lang,{n:"3"}))}</span><a class="btn sm" id="pc-1-open" href="/p/qa-shop" aria-labelledby="pc-1-open pc-1" data-nx-focus="open:qa-shop">${esc(order[10])}</a></footer>`));
    assert.doesNotMatch(html,/<b>QA|__CORTHEX_VIEW_DATA__|\son[a-z]+=|javascript:|\sstyle=/i,"text stays text, and nothing runs without the code");
  }
});

test("SCR-110#nothing-waits and SCR-110#empty: an empty my turn, an agent with nothing to do, a server without a snapshot",()=>{
  for(const lang of["en","ko"]){
    const none={total:0,oldest:null},quiet=drawHome(homeData({entries:[],agent:[{project:"qa-shop",comments:none,discrepancies:none,reflections:none,checkpoints:none,taken:0}]}),lang);
    const [lead,line]=labels("Nothing waits",lang);
    assert.ok(section(quiet,"mine").includes(`<h2 id="mine-h" data-nx-key="mine-h">${esc(label("My turn",0,lang,{n:"0"}))}</h2>`));
    assert.ok(quiet.includes(`<div class="empty-l" data-nx-key="mine-none"><b>${esc(lead)}</b><span class="mu sm">${esc(line)}</span></div>`)&&!quiet.includes("<ol"));
    assert.ok(section(quiet,"todo").includes(`<p class="none">${esc(labels("Agent to-do",lang)[7])}</p>`)&&section(quiet,"todo").includes(esc(label("Agent to-do",0,lang,{n:"0"}))));
    assert.equal(tags(quiet,/<article class="pcard"/g).length,2,"the cards show as in #normal");
    const empty=drawHome(homeData({projects:[],entries:[],agent:[]}),lang),[first,second,...steps]=labels("Nothing pushed",lang);
    assert.ok(!empty.includes('data-nx-key="mine"')&&!empty.includes('data-nx-key="todo"')&&!empty.includes('data-nx-key="projs"'),"in place of my turn, the agent to-do and the cards");
    assert.ok(empty.includes(`<p class="lead">${esc(first)}</p><p class="mu">${esc(second)}</p>`));
    assert.equal(steps.length,4);assert.equal(tags(empty,/<li><span>/g).length,4,"the four steps (REQ-223)");
    assert.ok(empty.includes("<code>nexus.push</code>")&&empty.includes("<code>CORTHEX&#95;NEXUS&#95;CLIENT&#95;SECRET</code>"),"names in backticks are code");
    assert.doesNotMatch(empty,/[A-Za-z]:\\|\/home\/|\/Users\//,"no path");
    if(lang==="ko")assert.ok(empty.includes("AI")&&!empty.includes("에이전트"),"the agent is called AI in Korean (choice 17)");
  }
  for(const bad of[null,{},{projects:[],agent:[]},{projects:[],agent:[],my_turn:{}}])assert.throws(()=>drawHome(bad,"en"),/Unreadable page data/);
});

test("what the view's code adds: answers in place, their messages, the notices, the order and a card pushed again",()=>{
  const data=homeData(),lang="en",buttons=labels("Page buttons",lang);
  const code=drawHome(data,lang,{code:true});
  assert.ok(!/disabled|data-nx-wait="(?:answer|order)"/.test(code),"the code's drawing has the answers and the order working");
  // While an answer is sent: its buttons say so and are disabled, yet keep the focus (rule 4).
  const sending=entry(drawHome(data,lang,{code:true,entries:{np_1:{sending:"accept"}}}),"np_1");
  assert.deepEqual(tags(sending,/<button [^>]*>[^<]+<\/button>/g).map(b=>[b.includes(' aria-disabled="true"'),b.replace(/<[^>]+>/g,"")]),[[true,codeMessage("Sending",lang)],[true,"Dismiss"]]);
  // Answered (choice 19): marked in place, without its buttons, until the page loads again.
  const answered=drawHome(data,lang,{code:true,entries:{np_1:{done:true,mark:0},nc_3:{done:true,mark:3}}});
  assert.ok(entry(answered,"np_1").startsWith('data-nx-entry="np&#95;1"')&&answered.includes('<li class="ent answered" data-nx-key="e:np&#95;1"'));
  assert.ok(!entry(answered,"np_1").includes('class="acts"')&&entry(answered,"np_1").includes(`<div class="after" tabindex="-1" data-nx-key="x" data-nx-focus="np&#95;1:after"><p class="res"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-check"/></svg><span>${label("Answered",0,lang)}</span></p></div>`));
  assert.ok(entry(answered,"nc_3").includes(`<span>${esc(label("Answered",3,lang))} <a class="lnk" href="/p/qa-shop/sample/12-qa">${esc(label("The head",4,lang))}</a></span>`),"a passed checkpoint links its stage's record");
  // Messages under an entry (rule 3), with Try again, Open, or the page at its own address.
  const failed=drawHome(data,lang,{code:true,entries:{
    np_1:{note:{tone:"err",text:codeMessage("internal",lang),trace:"tr_<1>",retry:"accept"}},
    nc_2:{done:true,note:{tone:"info",text:codeMessage("not_recommended",lang)}},
    nc_3:{note:{tone:"err",text:codeMessage("part_not_found",lang),open:talkPath("qa-shop","sample","12-qa","nc_3")}},
    nc_4:{note:{tone:"warn",text:codeMessage("user_only",lang),here:"https://nexus.example.com/"}}}});
  assert.ok(entry(failed,"np_1").includes(`<div class="msg err" role="alert"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-err"/></svg><div><span class="t">${esc(codeMessage("internal",lang))}</span><span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:"tr_<1>"}))}</span><div class="row"><button class="btn sm" type="button" data-nx-act="retry" data-nx-retry="accept" data-nx-focus="np&#95;1:retry">`));
  assert.ok(entry(failed,"np_1").includes('class="acts"'),"a failed answer keeps its entry and buttons");
  assert.ok(entry(failed,"nc_2").includes('<div class="msg info" role="status">')&&!entry(failed,"nc_2").includes("tid"));
  assert.ok(entry(failed,"nc_3").includes(`<a class="btn sm" href="/p/qa-shop/sample/12-qa#talk=nc&#95;3">${esc(label("A checkpoint request's buttons",0,lang))}</a>`),"part_not_found: Open the request");
  assert.ok(entry(failed,"nc_4").includes(`<div class="msg warn" role="status">`)&&entry(failed,"nc_4").includes(`<a class="lnk" href="https://nexus.example.com/">${esc(buttons[3])}</a>`));
  // The notices of reading again (rule 6) and of a sign-in that expired (rule 7).
  const signIn=drawHome(data,lang,{code:true,notice:"sign-in"}),unread=drawHome(data,lang,{code:true,notice:"unread",updating:true});
  assert.ok(signIn.startsWith(`<div class="full notes" data-nx-key="notes"><div class="bar warn" role="status">`)&&signIn.includes(`<span class="t">${esc(codeMessage("Sign-in expired",lang))}</span><button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="sign-in">${esc(buttons[2])}</button>`));
  assert.ok(unread.includes(`<div class="bar err" role="alert">`)&&unread.includes(`<span class="t">${esc(codeMessage("Could not update",lang))}</span><button class="btn sm" type="button" data-nx-act="read" data-nx-focus="read">`));
  assert.ok(unread.includes(`<span class="upd mu cap" role="status" data-nx-key="upd" data-nx-live>${esc(codeMessage("Updating",lang))}</span>`),"Updating… while reading again");
  assert.ok(drawHome(data,lang).startsWith('<div class="full notes" data-nx-key="notes"></div>'),"no notice, no bar");
  // The order by the last push, and a card that the reading found pushed again.
  const byPush=drawHome(data,lang,{code:true,order:"push",pushed:{"qa-shop":"2026-11-08T10:00:00.000Z"}});
  assert.ok(card(byPush,0).includes('<h3 id="pc-0">&lt;b&gt;')&&card(byPush,1).includes('<h3 id="pc-1">qa-second</h3>'),"the last push first");
  assert.ok(byPush.includes('data-nx-order="push" data-nx-focus="order:push" aria-pressed="true"'));
  assert.ok(card(byPush,0).includes(`<span class="kind acc">${timed(labels("Projects",lang)[7],"2026-11-08T10:00:00.000Z")}</span>`)&&!card(byPush,1).includes('class="kind'));
  assert.equal(timed("Pushed again at {time}","2026-11-08T10:00:00.000Z"),'Pushed again at <time datetime="2026-11-08T10:00:00.000Z">2026-11-08 10:00</time>');
  // The entries that the code keeps drawn after reading again stay in its list.
  const kept=drawHome(homeData({entries:turnEntries().slice(1),total:72}),lang,{code:true,list:turnEntries(),entries:{np_1:{done:true,mark:1}}});
  assert.ok(kept.includes(`>${esc(label("My turn",0,lang,{n:label("The list",9,lang,{n:"3",total:"72"})}))}</h2>`)&&entry(kept,"np_1").includes(`<span>${label("Answered",1,lang)}</span>`),"the count reads again; the answered entry stays");
});

test("SCR-110's revision: a checkpoint request's pass, its words and their messages as the code draws them (TASK-302)",()=>{
  for(const lang of["en","ko"]){
    const data=homeData(),buttons=labels("A checkpoint request's buttons",lang),pass=label("The pass",0,lang,{n:"12"});
    const acts=html=>tags(entry(html,"nc_3"),/<(?:a|button) class="btn[^"]*"[^>]*>[^<]+<\/(?:a|button)>/g);
    // The code's drawing: the pass and "Add your words" work; "Open the request" stays first.
    const code=drawHome(data,lang,{code:true});
    assert.deepEqual(acts(code).map(b=>b.replace(/<[^>]+>/g,"")),[esc(buttons[0]),esc(pass),esc(buttons[1])]);
    assert.ok(acts(code)[1].includes('data-nx-act="pass" data-nx-focus="nc&#95;3:pass" aria-describedby="w-nc&#95;3">')&&acts(code)[2].includes('data-nx-act="words" data-nx-focus="nc&#95;3:add" aria-describedby="w-nc&#95;3">'));
    // "Add your words": the box for the pass's words, labelled, with its counter, in the place of
    // the button; its words come from the browser's storage, so the drawing holds none.
    const box=entry(drawHome(data,lang,{code:true,entries:{nc_3:{words:true}}}),"nc_3");
    assert.ok(box.includes(`<div class="wb" data-nx-key="b" data-nx-sub><div class="bn" data-nx-key="bn"></div><label class="lab" for="pw-nc&#95;3" data-nx-key="bl">${esc(oldLabels("Overview's headings",lang)[5])}</label><textarea class="ta" id="pw-nc&#95;3" name="words" rows="3" data-nx-key="bt" data-nx-focus="nc&#95;3:words" aria-describedby="pw-left-nc&#95;3"></textarea><p class="left" id="pw-left-nc&#95;3" data-nx-key="bf" data-nx-live></p></div><span class="acts rqa" data-nx-key="a">`),"the box between the lines and the buttons");
    assert.ok(!box.includes('data-nx-act="words"')&&box.indexOf('class="rqf"')<box.indexOf('class="wb"'),"the box stays open, so no words that the pass sends are hidden");
    // The characters left from 90 per cent of the limit; over it, the limit, and the pass disabled.
    const near=entry(drawHome(data,lang,{code:true,entries:{nc_3:{words:true,left:150}}}),"nc_3"),over=entry(drawHome(data,lang,{code:true,entries:{nc_3:{words:true,over:true}}}),"nc_3");
    assert.ok(near.includes(`data-nx-live>${esc(codeMessage("Characters left",lang,{n:150}))}</p>`));
    assert.ok(over.includes(`data-nx-live>${esc(codeMessage("text_too_long",lang,{limit:"2,000"}))}</p>`)&&over.includes('data-nx-act="pass" data-nx-focus="nc&#95;3:pass" aria-describedby="w-nc&#95;3" disabled>'));
    // While the pass is sent, and while my turn reads again after a refusal, it stays off but
    // keeps the focus (rule 4).
    const sending=entry(drawHome(data,lang,{code:true,entries:{nc_3:{sending:"pass"}}}),"nc_3"),reread=entry(drawHome(data,lang,{code:true,entries:{nc_3:{reread:true}}}),"nc_3");
    assert.ok(sending.includes(`aria-describedby="w-nc&#95;3" aria-disabled="true">${esc(codeMessage("Sending",lang))}</button>`));
    assert.ok(reread.includes(`aria-describedby="w-nc&#95;3" aria-disabled="true">${esc(pass)}</button>`));
    // Passed (choice 19): marked in place with the stage's record, without its buttons or box.
    const passed=entry(drawHome(data,lang,{code:true,entries:{nc_3:{done:true,mark:3,words:true}}}),"nc_3");
    assert.ok(!passed.includes('class="acts')&&!passed.includes('class="wb"')&&passed.includes(`<span>${esc(label("Answered",3,lang))} <a class="lnk" href="/p/qa-shop/sample/12-qa">${esc(label("The head",4,lang))}</a></span>`));
    assert.ok(drawHome(data,lang,{code:true,entries:{nc_3:{done:true,mark:3}}}).includes('<li class="ent req answered" data-nx-key="e:nc&#95;3"'));
    // A refusal by the words shows by their box, with the words' Try again; any other under the
    // entry, such as Load again for a pass that names no commit (SCR-110#error).
    const words={tone:"err",box:true,text:codeMessage("invalid_request",lang),trace:"tr_1",retry:"pass"};
    const byBox=entry(drawHome(data,lang,{code:true,entries:{nc_3:{words:true,note:words}}}),"nc_3");
    assert.ok(byBox.includes(`<div class="bn" data-nx-key="bn"><div class="msg err" role="alert">`)&&byBox.includes('data-nx-act="retry" data-nx-retry="pass" data-nx-focus="nc&#95;3:retry-box"')&&!byBox.includes('class="after"'));
    const load=entry(drawHome(data,lang,{code:true,entries:{nc_3:{note:{tone:"err",text:codeMessage("invalid_request",lang),load:true}}}}),"nc_3");
    assert.ok(load.includes(`<button class="btn sm" type="button" data-nx-act="load" data-nx-focus="nc&#95;3:load"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-reload"/></svg>${esc(labels("Page buttons",lang)[1])}</button>`));
    // SCR-110#stale's words under the entry.
    const stale=entry(drawHome(data,lang,{code:true,entries:{nc_3:{reread:true,note:{tone:"warn",text:codeMessage("snapshot_changed",lang,{commit:"89abcde"})}}}}),"nc_3");
    assert.ok(stale.includes(`<div class="msg warn" role="status">`)&&stale.includes(esc(codeMessage("snapshot_changed",lang,{commit:"89abcde"}))));
  }
});

test("SCR-110's revision: a request that does not show whole offers only Open the request (SPEC-196, TASK-302)",()=>{
  const lang="en",[open,add]=labels("A checkpoint request's buttons",lang),whole=labels("A checkpoint request, whole",lang);
  const only=(entries,projects)=>{const html=drawHome(homeData({entries,projects}),lang,{code:true}),item=entry(html,entries[0].id);return[item,tags(item,/<(?:a|button) class="btn[^"]*"[^>]*>[^<]+<\/(?:a|button)>/g).map(b=>b.replace(/<[^>]+>/g,""))];};
  const request=(look,more={})=>[{...turnEntries()[2],request:{...structuredClone(REQUEST),look_first:{item:null,url:null,stage:null,held:false,title:null,...look}},...more}];
  // An item that no stage holds now: its ID as text, and no pass (rule 22).
  const [gone,goneActs]=only(request({item:"TC-999"}));
  assert.deepEqual(goneActs,[open]);
  assert.ok(gone.includes(`<span class="lf"><span class="rk">${whole[0]}</span><span><span class="mono">TC-999</span></span></span>`)&&!gone.includes("#item="));
  // An address: its host and what follows, cut after 120 characters, in a new tab without a
  // referrer, which the page never loads (REQ-147).
  const long="https://example.com/"+"a".repeat(200);
  const [address,addressActs]=only(request({url:long}));
  assert.deepEqual(addressActs,[open,label("The pass",0,lang,{n:"12"}),add]);
  assert.ok(address.includes(`<a class="lnk" href="${long}" target="_blank" rel="noopener noreferrer" data-nx-focus="nc&#95;3:look">example.com/${"a".repeat(108)}…</a>`));
  assert.ok(!/<(?:img|iframe|link|script)[^>]+example\.com/.test(address),"the page loads nothing from the address");
  // A request stored without the form, or a workshop's: its first 300 characters as now.
  const [old,oldActs]=only([{...turnEntries()[2],request:null}]);
  assert.deepEqual(oldActs,[open]);
  assert.ok(old.includes('<p class="txt" data-nx-key="t">Stage 12 is ready for its checkpoint.</p>')&&!old.includes('class="rqf"'));
  // A project without its card has nothing for a pass to name.
  const [,cardless]=only(request({item:"TC-120",stage:"12-qa",held:true}),[homeData().projects[0]]);
  assert.deepEqual(cardless,[open]);
  // A snapshot without a commit: no commit line, and the pass names the revision (SPEC-194).
  const second=homeData().projects[0];
  const [plain,plainActs]=only(request({item:"TC-120",stage:"12-qa",held:true},{project:"qa-second",part:""}),[second]);
  assert.deepEqual(plainActs,[open,label("The pass",0,lang,{n:"12"}),add]);
  assert.ok(!plain.includes('class="cm"')&&plain.includes('href="/p/qa-second/&#95;/12-qa#item=TC-120"'));
});

test("which requests show whole, and where the pass's words are kept (SPEC-194, SPEC-196, rule 5)",()=>{
  const [card]=homeData().projects.filter(item=>item.name==="qa-shop"),entry_=turnEntries()[2];
  assert.equal(wholeRequest(entry_,card),true);
  assert.equal(PASS_WORDS,2000);
  assert.equal(passScope(entry_),"qa-shop:pass:nc_3","the request's comment");
  for(const [why,changed]of[
    ["not a checkpoint",{asks:"recommended"}],["a proposal",{kind:"proposal"}],["stored without the form",{request:null}],
    ["no thing to look at first",{request:{...REQUEST,look_first:null}}],["an item that no stage holds",{request:{...REQUEST,look_first:{...REQUEST.look_first,held:false}}}],
    ["a stage outside the 13",{request:{...REQUEST,look_first:{...REQUEST.look_first,stage:"99-x"}}}],["an address that is not https",{request:{...REQUEST,look_first:{item:null,url:"http://example.com/",stage:null,held:false,title:null}}}]])
    assert.equal(wholeRequest({...entry_,...changed},card),false,why);
  assert.equal(wholeRequest(entry_,null),false,"no card");
  assert.equal(wholeRequest(entry_,{...card,commit:null,revision:null}),false,"neither a commit nor a revision to name");
  assert.equal(wholeRequest(entry_,{...card,commit:null}),true,"the revision where no commit");
});

test("where an entry and each count of the agent to-do open (SPEC-144, SCR-114)",()=>{
  assert.equal(talkPath("qa-shop","sample","05-erd","nc_1"),"/p/qa-shop/sample/05-erd#talk=nc_1");
  assert.equal(talkPath("qa-shop","","05-erd","nc 1/2"),"/p/qa-shop/_/05-erd#talk=nc%201%2F2");
  assert.deepEqual(AGENT_LISTS.map(([list])=>list),["comments","discrepancies","reflections","checkpoints"]);
  const oldest={part:"sample",stage:"07-sitemap",entry:"nx_1"};
  assert.deepEqual(AGENT_LISTS.map(([list])=>countPath("qa-shop",list,oldest)),["/p/qa-shop/sample/07-sitemap#talk=nx_1","/p/qa-shop/sample/07-sitemap#filter=left","/p/qa-shop/sample/07-sitemap#filter=left","/p/qa-shop/sample/07-sitemap"]);
  assert.equal(countPath("qa-shop","comments",null),"/p/qa-shop","without an oldest entry, the project");
  assert.deepEqual(turnEntries().map(entryKind),[0,2,3,1]);
  assert.equal(entryKind({kind:"comment",asks:null}),1,"a comment that asks nothing named is a question");
});

test("a picture's small view: the server's first layout without labels, in the editors' palette and its dark filter",()=>{
  const svg=drawingSVG({bounds:[-10,-20,0,50],boxes:[["context",0,0,10,10],["table",1,2,3,4],["unknown-kind",5,5,-1,"x"]],lines:[[1,2,3,4],["a",null,5,6]]});
  assert.ok(svg.startsWith('<svg viewBox="-10 -20 1 50" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">'),"no zero width");
  assert.ok(svg.includes(`<path d="M1 2L3 4M0 0L5 6" fill="none" stroke="${PALETTE.context[0]}"/>`),"lines in whole numbers");
  assert.ok(svg.includes(`<rect x="0" y="0" width="10" height="10" fill="none" stroke="${PALETTE.context[0]}" class="dash"/>`));
  assert.ok(svg.includes(`<rect x="1" y="2" width="3" height="4" fill="${PALETTE.table[1]}" stroke="${PALETTE.table[0]}"/>`));
  assert.ok(svg.includes(`<rect x="5" y="5" width="0" height="0" fill="${PALETTE.screen[1]}" stroke="${PALETTE.screen[0]}"/>`),"an unknown kind as a screen; no negative size");
  assert.equal(drawingSVG({}),'<svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"></svg>');
  // The picture view's first SVG draws with the same palette (one copy, palette.js).
  const preview=picturePreview({project:"qa",part:"sample",stage:"07-sitemap",picture:{commit:"abc1234",source:SITEMAP},items:[]},"en");
  assert.ok(preview.includes(`fill="${PALETTE.screen[1]}"`)&&preview.includes(`stroke="${PALETTE.screen[0]}"`),"0.2's picture view keeps its colours");
  // The dark filter, as the Filter Effects spec composes it, turns the light picture ground,
  // white, into the dark one, color.picture-ground #121212 (stage 09's tokens).
  const css=readFileSync(new URL("../ui/page.css",import.meta.url),"utf8"),tokens=readFileSync(new URL("../ui/tokens.css",import.meta.url),"utf8");
  assert.ok(css.includes(`filter:${DARK_FILTER}`),"page.css draws the small views through the editors' dark filter");
  const filtered=hex=>{const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c*(1-0.93)+(1-c)*0.93);
    const a=Math.PI,cos=Math.cos(a),sin=Math.sin(a),m=[[0.213+cos*0.787-sin*0.213,0.715-cos*0.715-sin*0.715,0.072-cos*0.072+sin*0.928],[0.213-cos*0.213+sin*0.143,0.715+cos*0.285+sin*0.140,0.072-cos*0.072-sin*0.283],[0.213-cos*0.213-sin*0.787,0.715-cos*0.715+sin*0.715,0.072+cos*0.928+sin*0.072]];
    return"#"+m.map(row=>Math.round(Math.min(1,Math.max(0,row[0]*rgb[0]+row[1]*rgb[1]+row[2]*rgb[2]))*255).toString(16).padStart(2,"0")).join("");};
  assert.equal(filtered("#ffffff"),"#121212");
  assert.match(tokens,/@media \(prefers-color-scheme: dark\) \{[^]*--nx-color-picture-ground: #121212;/);
  for(const [stroke,fill]of Object.values(PALETTE))for(const colour of[stroke,fill].filter(c=>c!=="none"))assert.match(filtered(colour),/^#[0-9a-f]{6}$/);
});

test("times: the server writes UTC, and the view writes the same element in the browser's time zone (rule 2)",()=>{
  assert.equal(clock("2026-11-08T23:05:00.000Z"),"2026-11-08 23:05");
  assert.equal(clock("not a time"),"not a time");assert.equal(clock(null),"");
  assert.equal(time("2026-11-08T23:05:00.000Z"),'<time datetime="2026-11-08T23:05:00.000Z">2026-11-08 23:05</time>');
  assert.equal(time('"><b>'),'<time datetime="&quot;&gt;&lt;b&gt;">&quot;&gt;&lt;b&gt;</time>',"an unreadable time stays text");
  const local=new Date("2026-11-08T23:05:00.000Z"),pad=n=>String(n).padStart(2,"0");
  assert.equal(clock("2026-11-08T23:05:00.000Z",true),`${local.getFullYear()}-${pad(local.getMonth()+1)}-${pad(local.getDate())} ${pad(local.getHours())}:${pad(local.getMinutes())}`);
  assert.equal(clock("2026-11-08T23:05:00.000Z",true).length,clock("2026-11-08T23:05:00.000Z").length,"the same digits, so that nothing moves");
});

test("why a picture is not current, in the words of 0.2's picture view",()=>{
  for(const lang of["en","ko"]){
    const sentence=reason=>picturePreview({project:"qa",part:"sample",stage:"07-sitemap",picture:{commit:"abc1234",not_current:reason,source:SITEMAP},items:[]},lang).match(/data-preview-stale>([^<]+)</)[1];
    for(const reason of["size","source-gone","other-repository"])assert.equal(esc(notCurrentWhy(reason,"abc1234",lang)),sentence(reason),lang+" "+reason);
    assert.equal(notCurrentWhy("weird","abc1234",lang),notCurrentWhy("size","abc1234",lang));
  }
});

test("0.2's fragments on / lead to their places (SPEC-154)",async()=>{
  const data=homeData(),asked=[];
  const api=answer=>({call:async(method,url)=>{asked.push([method,url]);if(answer instanceof Error)throw answer;return answer;}});
  // The top bar's search (SCR-116) takes the words; a page without it sends them to the hub page.
  const follow=async(hash,answer={part:"sample",item:{id:"REQ-107",stage:"02-prd"}})=>{const went=[];const handled=await followFragment(hash,data,api(answer),target=>went.push(target),words=>went.push("search:"+words));return[handled,went];};
  assert.deepEqual(await follow("#q=retry%20payment"),[true,["search:retry payment"]],"the search of SCR-116 with the words");
  const hub=[];assert.equal(await followFragment("#q=retry%20payment",data,api({}),target=>hub.push(target)),true);
  assert.deepEqual(hub,["/hub#q=retry%20payment"],"without the top bar's search, the hub page's");
  assert.deepEqual(await follow("#p=qa-shop&id=REQ-107"),[true,["/p/qa-shop/sample/02-prd#item=REQ-107"]],"the item in its stage");
  assert.deepEqual(asked.at(-1),["GET","/api/spaces/qa-shop/items/REQ-107"]);
  const gone=Object.assign(new Error("item_not_found"),{code:"item_not_found"});
  assert.deepEqual(await follow("#p=qa-shop&id=REQ-999",gone),[true,["search:REQ-999"]],"an item that the project no longer holds: the search with its ID");
  assert.deepEqual(await follow("#p=qa-shop&id=REQ-1",{part:"sample",item:{stage:"14-later"}}),[true,["search:REQ-1"]]);
  assert.deepEqual(await follow("#p=qa-shop&s=05-erd"),[true,["/p/qa-shop/sample/05-erd"]],"that stage of the project's first part");
  assert.deepEqual(await follow("#p=qa-second&s=12-qa"),[true,["/p/qa-second/_/12-qa"]]);
  assert.deepEqual(await follow("#p=qa-unknown&s=12-qa"),[true,["/p/qa-unknown/_/12-qa"]],"an unknown project: the new page's 404");
  assert.deepEqual(await follow("#p=qa-shop&s=99-weird"),[true,["/p/qa-shop"]]);
  assert.deepEqual(await follow("#p=qa-shop"),[true,["/p/qa-shop"]]);
  for(const hash of["","#","#talk=nc_1","#p=Not%20a%20name","#p="+"a".repeat(101),"#p=../hub"])assert.deepEqual(await follow(hash),[false,[]],hash);
  assert.equal(asked.length,3,"only an item asks the server");
});
