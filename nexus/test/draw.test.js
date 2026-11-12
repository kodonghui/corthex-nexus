// TASK-272: one set of drawing functions for the redesign's pages, on the server and in
// the view (stage 08's rules 13 to 17). These tests read the server's page as text; the
// browser suite page-regression.mjs compares it with the view's before and after the code.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createViews} from "../src/views.js";
import {renderView} from "../src/app.js";
import {redesign} from "../ui/messages.js";
import {checkLabels} from "../tools/messages.mjs";
import {esc,path,count} from "../src/draw/html.js";
import {icon,shapeIcon,SPRITE,SYMBOLS} from "../src/draw/icons.js";
import {labels,label,legendWord,STATES} from "../src/draw/words.js";
import {STAGE_KEYS,stageName,stageRail} from "../src/draw/stages.js";
import {topBar,codeBar,tabs} from "../src/draw/frame.js";
import {drawParts,drawBody,pageKind,pageTitle,openTalk,PAGE_SCHEMAS} from "../src/draw/page.js";
import {homeData} from "./home-fixtures.js";

const metadata=JSON.parse(readFileSync(new URL("../src/view-code/sizes.json",import.meta.url))),folder=new URL("../src/view-code/",import.meta.url);
const code=Object.fromEntries(metadata.files.map(f=>[f.name,{type:f.type,body:readFileSync(new URL(f.path,folder))}])),views=createViews(code,metadata.entries);
const MARKER="__CORTHEX_VIEW_DATA__",TITLE=`<b>QA</b> "pages" & '${MARKER}' 합성 가게`;
const SHAPES={done:"s-done",in_progress:"s-prog",not_started:"s-todo",skipped:"s-skip",unknown:"s-unk"};
// A stage's data as API-158 answers it, with only the members that the drawing reads: three
// tables, two of them in a context, with marks, a title that tries markup and no checkpoint.
const AT="2026-11-08T07:00:00.000Z";
const ENTRIES=()=>[
  {id:"TBL-001",kind:"table",title:"orders <b>&</b>",priority:"Must",status:"built",parent:"CTX-001",context:"CTX-001",comments:2,mine:true,discrepancies:1,reflections:0},
  {id:"TBL-002",kind:"table",title:"order_lines",type:"table",context:"CTX-001",comments:0,mine:false,discrepancies:0,reflections:1},
  {id:"TBL-003",kind:"table",title:"notes",context:null,comments:1000,mine:false,discrepancies:0,reflections:0},
];
function stageData({stage="05-erd",part="sample",parts=["sample"],rows,head={},items={},record={}}={}){
  return{project:{name:"qa/shop #1",title:TITLE,repository:"https://github.com/example/qa-shop",commit:"0123456789abcdef0123456789abcdef01234567",generated_at:AT,pushed_at:"2026-11-08T08:00:00.000Z",parts},part,stage,
    head:{key:stage,state:"in_progress",checkpoint:null,commit:"0123456789abcdef0123456789abcdef01234567",time:AT,reads:true,source_state:"found",counts:{items:3,kinds:[{kind:"table",count:3}],priorities:[],hotspots:null},picture:false,...head},
    record:{project:"qa/shop #1",part,stage,record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],discrepancies:{total:0,entries:[]},comments:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[],warnings:[],not_opened:0,...record},
    stages:rows??STAGE_KEYS.map((key,i)=>({key,state:STATES[i%STATES.length],items:[0,3,1500][i%3],picture:["01-domain","05-erd","07-sitemap"].includes(key),not_current:null,mine:[0,2,1000][i%3]})),
    items:{group:"context",filter:"all",q:null,total:3,after:0,counts:{all:3,talk:2,mine:1,left:2},groups:[{context:"CTX-001",title:"Ordering <i>",count:2},{context:null,title:null,count:1}],entries:ENTRIES(),...items}};
}
const stagePage=(lang="en",over={})=>({schema:PAGE_SCHEMAS.stage,generated_at:"2026-11-08T08:30:00.000Z",lang,data:stageData(over),talk:{mine:{total:2},agent:{total:1},apart:{total:4}},picture:null,problem:null});
const homePage=(lang="en",over={})=>({schema:PAGE_SCHEMAS.home,generated_at:"2026-11-08T08:30:00.000Z",lang,data:homeData(over)});
const tags=(html,pattern)=>html.match(pattern)||[];

test("the redesign's words come from stage 08's table, with as many labels and the same values in both languages",()=>{
  for(const [key,[en,ko]]of Object.entries(redesign)){
    assert.equal(en.split(" · ").length,ko.split(" · ").length,key);
    assert.doesNotThrow(()=>checkLabels(key,en,ko),key);
  }
  for(const lang of["en","ko"]){
    assert.equal(labels("Stage names",lang).length,13);assert.equal(labels("Stage groups",lang).length,6);
    assert.equal(labels("Legend",lang).length,6);assert.equal(labels("Top bar",lang).length,6);assert.equal(labels("Tabs",lang).length,5);
  }
  assert.throws(()=>checkLabels("Row","a · b","가"),/2 English labels, 1 Korean/);
  assert.throws(()=>checkLabels("Row","{n} items","항목 {count}"),/label 1: the values in braces differ/);
  assert.throws(()=>labels("No such row","en"),/No redesign words/);
  assert.throws(()=>label("Top bar",6,"en"),/No label 6/);
  assert.equal(label("Tabs",2,"ko",{n:"7"}),"대화 7");
  assert.equal(label("Tabs",2,"en",{}),"Talk {n}","a value that is not given stays named");
  assert.deepEqual(STATES.map(state=>legendWord(state,"en")),["done","in progress","not started","skipped","not recorded"]);
  assert.deepEqual(STATES.map(state=>legendWord(state,"ko")),["완료","진행 중","시작 전","건너뜀","기록 없음"]);
  assert.equal(stageName("13-presentation","ko"),"발표");
});

test("drawing escapes every value, so that no project text becomes markup or the data's marker",()=>{
  assert.equal(esc(`<a href="x">'_'&</a>`),"&lt;a href=&quot;x&quot;&gt;&#39;&#95;&#39;&amp;&lt;/a&gt;");
  assert.equal(esc(null),"");assert.equal(path("p","a/b","#c","?d"),"/p/a%2Fb/%23c/%3Fd");
  assert.deepEqual([0,7,999,1000,-3,"x",12.9].map(count),["0","7","999","999+","0","0","12"]);
  for(const lang of["en","ko"]){
    const body=drawBody(stagePage(lang));
    assert.ok(!body.includes("<b>QA"),"the title is text");assert.ok(!body.includes(MARKER),"the marker cannot be drawn");
    assert.ok(body.includes("&lt;b&gt;QA&lt;/b&gt; &quot;pages&quot; &amp; &#39;&#95;&#95;CORTHEX&#95;VIEW&#95;DATA&#95;&#95;&#39; 합성 가게"));
    assert.ok(body.includes('href="/p/qa%2Fshop%20%231"'),"a project name is one encoded segment");
    assert.doesNotMatch(body,/\son[a-z]+=|javascript:|\sstyle=/i,"nothing in the page runs without the page's code, and no inline style");
  }
  assert.equal(pageTitle(stagePage("ko")),`05 ERD · ${TITLE} · NEXUS`);assert.equal(pageTitle(homePage()),"NEXUS");
  assert.throws(()=>icon("s-done"),/icon/i,"only icons go through icon()");
});

test("a stage's state is a shape and a word, and every count says what it counts (rule 13)",()=>{
  assert.deepEqual(Object.keys(SHAPES),STATES);
  for(const lang of["en","ko"]){
    const rail=stageRail(stageData(),lang),rows=tags(rail,/<a class="row[^"]*"[^>]*>.*?<\/a>/g);
    assert.equal(rows.length,13);
    rows.forEach((row,i)=>{
      const state=STATES[i%STATES.length];
      assert.ok(row.includes(`<use href="#${SHAPES[state]}"/>`),STAGE_KEYS[i]+" shape");
      assert.ok(row.includes(`<span class="sr">${esc(legendWord(state,lang))}</span>`),STAGE_KEYS[i]+" word");
      const items=[0,3,1500][i%3],mine=[0,2,1000][i%3];
      if(items)assert.ok(row.includes(`<span class="n"><span aria-hidden="true">${count(items)}</span><span class="sr">${esc(label("Projects",8,lang,{n:count(items)}))}</span></span>`),"items named");
      if(mine)assert.ok(row.includes(`<span class="cnt"><span aria-hidden="true">${count(mine)}</span><span class="sr">${esc(label("The talk",1,lang,{n:count(mine)}))}</span></span>`),"my turn named");
      if(!items&&!mine)assert.ok(row.includes('<span class="end"></span>'),"no count, no space");
    });
    assert.ok(rail.includes(">999+</span>"),"a count over 999 shows as 999+");
    const legend=rail.slice(rail.indexOf('<ul class="key">'));
    for(const state of STATES)assert.ok(legend.includes(`${shapeIcon(state)}<span>${esc(legendWord(state,lang))}</span>`),"legend "+state);
  }
  const unknown=stageRail(stageData({rows:[{key:"02-prd",state:"weird",items:0,picture:false,mine:0}]}),"en");
  assert.equal(tags(unknown,/#s-unk"/g).length,13+1,"a missing stage and an unknown state are not recorded, with the legend's one");
  for(const symbol of[...Object.values(SHAPES),"i-pic","i-warn","i-search","i-back","i-down","i-close","i-menu","i-talk","i-list","i-picture"])assert.ok(SPRITE.includes(`<symbol id="${symbol}"`)&&Object.hasOwn(SYMBOLS,symbol),symbol);
  for(const lang of["en","ko"])assert.doesNotMatch(drawBody(stagePage(lang,{parts:["sample","second"]}))+drawBody(homePage(lang)),/[✓›◐⌕▾▸✕☰]/,"no symbol that the fonts lack is drawn as text (BUG-596)");
});

test("the list of stages keeps the six groups, marks the current stage and switches parts by links",()=>{
  const rail=stageRail(stageData({parts:["sample","second"]}),"en");
  assert.deepEqual(tags(rail,/<span class="gname" id="grp-\d">[^<]+<\/span>/g).map(g=>g.replace(/<[^>]+>/g,"")),labels("Stage groups","en"));
  assert.deepEqual(tags(rail,/<ul aria-labelledby="grp-(\d)">/g).map(g=>g.match(/\d/)[0]),["0","1","2","3","4","5"]);
  assert.deepEqual([...rail.matchAll(/<li class="grp">.*?<\/ul><\/li>/g)].map(g=>tags(g[0],/class="row/g).length),[1,3,2,3,3,1]);
  const current=tags(rail,/<a class="row on"[^>]*>/g);
  assert.deepEqual(current,['<a class="row on" href="/p/qa%2Fshop%20%231/sample/05-erd" aria-current="page">']);
  assert.ok(rail.includes('<b id="rail-name">'+esc(TITLE)+"</b>")&&rail.includes(">example/qa-shop<")&&rail.includes(">0123456<"));
  assert.ok(rail.includes('<details class="partsw">')&&rail.includes('href="/p/qa%2Fshop%20%231/second/05-erd"')&&rail.includes('href="/p/qa%2Fshop%20%231/sample/05-erd" aria-current="page">sample<'));
  assert.ok(!stageRail(stageData(),"en").includes("partsw"),"one part, no switch");
  assert.ok(stageRail(stageData({part:"",parts:[]}),"en").includes('href="/p/qa%2Fshop%20%231/&#95;/05-erd"'),"a project without parts is the part _, escaped as all text is");
});

test("one top bar: NEXUS, where the user is, the search and Full checks, with the phone's own controls (rule 17)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("Top bar",lang),home=topBar({kind:"home"},lang),stage=topBar({kind:"stage",project:"qa/shop #1",title:TITLE,part:"sample",stage:"05-erd"},lang);
    assert.ok(home.includes(`<a class="logo" href="/">NEXUS</a>`)&&home.includes(`<b aria-current="page">${esc(words[1])}</b>`));
    assert.ok(home.includes('<details class="menu only-ph">')&&!home.includes("i-back"),"the first page has the menu and no back link");
    assert.ok(stage.includes(`<a class="ib only-ph" href="/">`)&&stage.includes('<a class="logo only-pc" href="/">NEXUS</a>')&&!stage.includes("menu"));
    assert.ok(stage.includes(`<a class="lnk clip" href="/p/qa%2Fshop%20%231">${esc(TITLE)}</a>`)&&stage.includes(`<b class="clip" aria-current="page">05 ${esc(stageName("05-erd",lang))}</b>`));
    assert.ok(stage.includes('<a class="ttl only-ph" href="#stages">'),"the phone's title opens the list of stages without code");
    assert.equal(tags(stage,/<svg class="i sep" aria-hidden="true" focusable="false"><use href="#i-next"\/><\/svg>/g).length,2,"the separators are icons (BUG-596)");
    assert.doesNotMatch(home+stage,/[✓›◐⌕▾▸✕☰]/,"no symbol that the fonts lack is drawn as text");
    for(const bar of[home,stage]){
      assert.equal(tags(bar,/data-nx-wait="search"/g).length,3,"the search waits for its code: its field, its button and Close");
      assert.equal(tags(bar,/<input [^>]*disabled data-nx-wait="search">/g).length,1);assert.equal(tags(bar,/<button [^>]*disabled data-nx-wait="search">/g).length,2);
      assert.ok(bar.includes(`placeholder="${esc(labels("Search hint",lang).join(" · "))}"`)&&bar.includes('maxlength="200"'));
      assert.ok(bar.includes(`<a class="btn only-pc" href="/hub">${esc(words[3])}</a>`),"Full checks");
      assert.match(bar,/<div class="fw only-pc"><label class="field"><svg [^>]*><use href="#i-search"\/><\/svg><input [^>]*><\/label><div class="spanel" id="search-panel" hidden>.*?<\/div><\/div>/,"the field in its own place, with the panel of its matches under it, hidden until the code fills it (SCR-116)");
      assert.ok(bar.includes('role="combobox" aria-autocomplete="list" aria-controls="search-list" aria-expanded="false"')&&bar.includes(`<ul class="ms" id="search-list" role="listbox" aria-label="${esc(words[2])}"></ul>`),"the field controls the list of matches");
      assert.ok(bar.includes(`<button class="ib only-ph sclose" type="button" disabled data-nx-wait="search">${icon("i-close")}<span class="sr">${esc(words[5])}</span></button>`)&&bar.endsWith('<div class="sdim" hidden></div>'),"Close for the phone's field, and the page behind the matches");
    }
  }
});

test("the bar of rule 15 and the phone's tabs are drawn before the code",()=>{
  assert.equal(codeBar("ko"),`<div class="bar warn" data-nx-codebar role="status">${icon("i-warn")}<span class="t">${esc(label("Buttons not loaded",0,"ko"))}</span></div>`);
  assert.equal(openTalk({mine:{total:2},agent:{total:"1"},apart:{total:4},closed:{total:9}}),7);assert.equal(openTalk(null),0);
  const list=tabs({picture:false,talk:7},"en"),picture=tabs({picture:true,talk:1000},"ko");
  assert.ok(list.includes('href="#stage" data-nx-tab="stage"')&&list.includes(">List<")&&list.includes(">Talk 7<")&&list.includes('href="#talk" data-nx-tab="talk"'));
  assert.ok(picture.includes(">그림<")&&picture.includes(">대화 999+<"));
  assert.ok(!list.includes('data-nx-tab="item"'),"the item's tab only while an item is selected");
  const item=tabs({picture:false,talk:7,item:true},"ko");
  assert.ok(item.endsWith(`<a class="tab" href="#talk" data-nx-tab="item">${icon("i-record")}<span>항목</span></a>`),"then the Item tab, after the talk's (SCR-115's layout)");
  // While entries of the stage wait for the user, "My turn {n}" under "Talk {n}" (SCR-111#folded).
  for(const lang of["en","ko"]){
    const mine=tabs({picture:false,talk:7,mine:2},lang);
    assert.ok(mine.includes(`<a class="tab" href="#talk" data-nx-tab="talk"><span class="tl2"><span>${icon("i-talk")}<span>${esc(label("Tabs",2,lang,{n:"7"}))}</span></span><span class="mt">${esc(label("The talk",1,lang,{n:"2"}))}</span></span></a>`),"the Talk tab's two lines");
    assert.ok(!tabs({picture:false,talk:7,mine:0},lang).includes('class="mt"'),"nothing waits: one line");
    assert.ok(tabs({picture:false,talk:7,mine:1500},lang).includes(`>${esc(label("The talk",1,lang,{n:"999+"}))}<`),"a count over 999");
  }
});

test("the folds' controls: the list's in the frame, the talk's in its head, and Talk ({n}) with my turn (SPEC-210)",()=>{
  for(const lang of["en","ko"]){
    const words=labels("The folds",lang),payload=stagePage(lang),html=drawBody(payload),parts=drawParts(payload);
    // The list's control is part of the frame: in the list's column, outside its part, waiting for the code.
    const control=`<div class="ftop only-pc"><button class="btn sm icon fold-s" type="button" data-nx-act="fold-stages" aria-controls="stages" aria-expanded="true" title="${esc(words[0])}" disabled data-nx-wait="folds">${icon("i-back","f-on")}${icon("i-next","f-off")}<span class="sr f-on">${esc(words[0])}</span><span class="sr f-off">${esc(words[1])}</span></button></div>`;
    assert.ok(html.includes(`<span class="sr">${esc(labels("Top bar",lang)[5])}</span></a>${control}<div class="rail-in" data-nx-part="rail">`),"between the phone's Close and the list's part");
    for(const part of Object.values(parts))assert.ok(!part.includes("fold-stages"),"no part holds it");
    // The stage's count in my turn (API-158's stages) on Talk ({n}) and the Talk tab.
    const mine=payload.data.stages.find(stage=>stage.key===payload.data.stage).mine;
    assert.equal(mine,2);
    assert.ok(parts.stage.includes(`<a class="btn sm tbtn" href="#talk" data-nx-key="talk" data-nx-act="talk" data-nx-focus="talk" data-nx-fold="talk" aria-controls="talk" title="${esc(words[3])}">${icon("i-talk")}<span>${esc(label("Tabs",4,lang,{n:"7"}))}</span><span class="mt">${esc(label("The talk",1,lang,{n:"2"}))}</span></a>`),"Talk ({n}) says my turn");
    assert.ok(parts.tabs.includes(`<span class="mt">${esc(label("The talk",1,lang,{n:"2"}))}</span>`));
    const none=drawParts(stagePage(lang,{rows:STAGE_KEYS.map(key=>({key,state:"done",items:1,picture:false,not_current:null,mine:0}))}));
    assert.ok(!none.stage.includes('class="mt"')&&!none.tabs.includes('class="mt"'),"nothing waits: no my turn");
    // The talk's own control, in its head, from 1,280 pixels.
    assert.ok(parts.side.includes(`<button class="btn sm icon fold-t" type="button" data-nx-act="fold-talk" data-nx-focus="fold-talk" aria-controls="talk" aria-expanded="true" title="${esc(words[2])}" disabled data-nx-wait="talk">${icon("i-next")}<span class="sr">${esc(words[2])}</span></button>`),"the talk's control waits for the code");
  }
});

test("the server's page holds each part exactly as the view's code draws it (rule 15)",()=>{
  const css=code[metadata.entries["page-css"].slice(6)].body.toString();
  for(const payload of[homePage("en"),homePage("ko"),homePage("en",{entries:[]}),homePage("ko",{projects:[],entries:[],agent:[]}),stagePage("en"),stagePage("ko",{parts:["sample","second"]}),{...stagePage("en"),picture:{}}]){
    const html=views.page(payload),parts=drawParts(payload),names=Object.keys(parts);
    assert.deepEqual(names,pageKind(payload)==="home"?["top","bars","home"]:["top","bars","rail","tabs","stage","side"]);
    assert.equal(tags(html,/data-nx-part="/g).length,names.length);
    for(const name of names)assert.ok(html.includes(`data-nx-part="${name}">${parts[name]}</`),name+" is the view's drawing");
    assert.equal(html.split(MARKER).length,2,"one data marker, filled by the server");
    assert.ok(html.startsWith(`<!doctype html><html lang="${payload.lang}"><head>`)&&html.includes(`<title>${esc(pageTitle(payload))}</title>`));
    assert.ok(html.includes(`<body class="nx" data-nx-page="${pageKind(payload)}">`)&&html.includes(`<style data-nexus-css="page">${css}</style>`));
    assert.equal(tags(html,/<script\b/g).length,2,"the data block and the page's module, and no other script");
    assert.ok(html.includes(`<script type="module" src="${metadata.entries["page-js"]}"></script></body></html>`)&&html.includes(`<link rel="modulepreload" href="${metadata.entries["page-js"]}">`));
    assert.ok(html.includes(`<template id="nexus-font-assets"><link rel="stylesheet" href="${metadata.entries["fonts-css"]}" data-nexus-css="fonts"></template>`),"the fonts join after the first paint");
    assert.ok(!html.includes(metadata.entries["view-js"])&&!html.includes(metadata.entries["erd-js"]),"0.2's view code stays on 0.2's pages");
    const filled=renderView(html,payload);
    assert.ok(filled.includes(JSON.stringify(payload).replace(/[<>&]/g,ch=>({"<":"\\u003c",">":"\\u003e","&":"\\u0026"}[ch]))));
  }
  for(const bad of[{...homePage(),schema:"corthex-view-page/0.2"},{...homePage(),lang:"fr"},{...homePage(),data:{}},null])assert.throws(()=>views.page(bad),/Unreadable page data/);
});

test("a page whose code does not run stays readable, with the bar of rule 15, and the three widths need no code",()=>{
  const css=code[metadata.entries["page-css"].slice(6)].body.toString().replace(/\s+/g," ");
  assert.match(css,/\.nx \.bar\[data-nx-codebar\]\{[^}]*max-height:0[^}]*visibility:hidden[^}]*animation:nx-codebar 0s linear var\(--pg-codebar-wait\) forwards/);
  assert.match(css,/--pg-codebar-wait:6s/);
  assert.match(css,/:root\[data-nx-code\] \.nx \.bar\[data-nx-codebar\]\{animation:none\}/);
  assert.match(css,/:root\[data-nx-code=failed\] \.nx \.bar\[data-nx-codebar\]\{[^}]*visibility:visible/);
  assert.match(css,/@media ?\(scripting:none\) ?\{\.nx \.bar\[data-nx-codebar\]\{animation-delay:0s\}\}/);
  // The widths of rule 16 and the hit areas of rule 14 are the stylesheet's.
  assert.match(css,/@media ?\(min-width:1024px\) ?and \(max-width:1279\.98px\)/);assert.match(css,/@media ?\(max-width:1023\.98px\)/);assert.match(css,/@media ?\(min-width:1024px\) ?\{/);
  assert.match(css,/\.nx \.rail:target,\.nx \.ws\[data-nx-open=stages\] \.rail\{display:flex\}/);
  // The folds (SPEC-210): a first visit, which keeps nothing, folds the talk from 1,280 to 1,439
  // pixels and before the code too, unless a link to #talk targets it; a kept value holds from
  // 1,280; the list folds to its rail of 56 pixels from 1,024.
  assert.match(css,/--pg-frail:56px/);
  assert.match(css,/@media ?\(min-width:1280px\) ?and \(max-width:1439\.98px\) ?\{\.nx \.ws:not\(\[data-nx-talk\]\):not\(\[data-nx-open=talk\]\):not\(\[data-nx-open=record\]\):is\(\[data-nx-tab\],:not\(:has\(\.side:target\)\)\)\{grid-template-columns:var\(--pg-rail\) minmax\(0,1fr\)\}/);
  assert.match(css,/@media ?\(min-width:1280px\) ?\{\.nx \.fold-t\{display:inline-flex\}\.nx \.ws\[data-nx-talk=folded\]:not\(\[data-nx-open=talk\]\):not\(\[data-nx-open=record\]\)\{grid-template-columns:var\(--pg-rail\) minmax\(0,1fr\)\}/);
  assert.match(css,/\.nx \.ws\[data-nx-stages=folded\]\{--pg-rail:var\(--pg-frail\)\}/);
  assert.match(css,/\.nx \.btn:after\{content:"";position:absolute;inset:calc\(\(var\(--nx-size-button\) - var\(--nx-size-target\)\) \/ 2 - var\(--nx-border-thin\)\)/,"the hit area adds back the border that its padding box leaves out");
  assert.match(css,/\.nx \.field input::-webkit-search-cancel-button\{[^}]*display:none/,"a search field draws no clear button of the browser's, whose hit area falls short of rule 14");
  assert.doesNotMatch(readFileSync(new URL("../ui/page.css",import.meta.url),"utf8"),/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i,"colours come from the frozen tokens");
  // A pictured stage without a picture (05), a document stage (02) and the first page.
  for(const [payload,waits]of[[stagePage("en"),["folds","picture","record","search","talk"]],[stagePage("ko",{stage:"02-prd"}),["folds","list","record","search","talk"]],[homePage("ko"),["answer","order","search"]]]){
    const html=views.page(payload),controls=tags(html,/<(?:button|input|select|textarea)\b[^>]*>/g);
    for(const control of controls)assert.match(control,/ disabled data-nx-wait="(?:search|answer|order|list|record|picture|talk|folds)"/,"a control that needs the code waits for it");
    // The talk's turns lead to their groups, each a heading of the page (SCR-114).
    for(const link of tags(html,/<a\b[^>]*>/g))assert.match(link,/href="(?:\/|#stage|#stages|#talk|#t-mine|#t-agent|#item=|#view=list&amp;item=)[^"]*"/,"every link works without the code");
    for(const turn of html.matchAll(/href="#(t-mine|t-agent)"/g))assert.ok(html.includes(`id="${turn[1]}"`),"a turn's link leads to its group");
    assert.deepEqual([...new Set(controls.map(c=>c.match(/data-nx-wait="(\w+)"/)[1]))].sort(),waits);
  }
});
