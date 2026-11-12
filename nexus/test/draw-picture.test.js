// TASK-275: the picture stage (SCR-112; SPEC-147, SPEC-156, SPEC-119, SPEC-141, SPEC-209), drawn
// from API-154's data by the functions that the server and the view share, and the board's
// arithmetic that the view's code runs (../ui/board.js). These tests read the drawing as text;
// the browser suite picture-regression.mjs runs the code at the three widths.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {esc,count} from "../src/draw/html.js";
import {label,labels,codeMessage,notCurrentWhy} from "../src/draw/words.js";
import {words} from "../ui/messages.js";
import {STAGE_KEYS} from "../src/draw/stages.js";
import {drawParts,PAGE_SCHEMAS} from "../src/draw/page.js";
import {drawPictureStage,pictureScene,frameState,boardSVG,gotoTargets,union,PAD,LARGE,MARK_SHAPES} from "../src/draw/picture.js";
import {onScreen,openingCamera,sightCamera,needsMap,nodeAt,itemBox,markLayout,markSVG,mapBoxes,mapView} from "../ui/board.js";
import {STEPS} from "../src/layout.js";
import {pictureLimitMessage} from "../src/preview.js";
import {createViews} from "../src/views.js";
import {viewSnapshot} from "./view-fixtures.js";

const AT="2026-11-08T07:00:00.000Z",COMMIT="b".repeat(40);
const metadata=JSON.parse(readFileSync(new URL("../src/view-code/sizes.json",import.meta.url))),folder=new URL("../src/view-code/",import.meta.url);
const code=Object.fromEntries(metadata.files.map(f=>[f.name,{type:f.type,body:readFileSync(new URL(f.path,folder))}])),views=createViews(code,metadata.entries);
const SOURCES=Object.fromEntries(viewSnapshot().pictures.map(picture=>[picture.stage,picture.source]));
const where={path:"docs/qa-sample.md",line:1};
function stageData(stage){
  return{project:{name:"qa-shop",title:`<b>QA</b> "picture" & '__CORTHEX_VIEW_DATA__'`,repository:null,commit:null,generated_at:AT,pushed_at:"2026-11-08T08:00:00.000Z",parts:["sample"]},part:"sample",stage,
    head:{key:stage,state:"in_progress",checkpoint:null,commit:"0123456789abcdef0123456789abcdef01234567",time:AT,reads:true,source_state:"found",counts:{items:2,kinds:[{kind:"table",count:2}],priorities:[],hotspots:null},picture:true},
    record:{project:"qa-shop",part:"sample",stage,record:{state:"in_progress",checkpoints:[],next:null,from:"snapshot"},source_state:"found",read:true,checks:[],pictures:[],discrepancies:{total:0,entries:[]},comments:{total:0,entries:[]},reflections:{total:0,entries:[]},checkpoints:[],warnings:[],not_opened:0},
    stages:STAGE_KEYS.map(key=>({key,state:"done",items:1,picture:["01-domain","05-erd","07-sitemap"].includes(key),not_current:null,mine:0})),
    items:{group:"context",filter:"all",q:null,total:2,after:0,counts:{all:2,talk:1,mine:0,left:1},groups:[{context:"CTX-001",title:"Ordering",count:2}],entries:[
      {id:"TBL-001",kind:"table",title:"orders",context:"CTX-001",comments:2,mine:false,discrepancies:1,reflections:0},
      {id:"TBL-002",kind:"table",title:"payments",context:"CTX-001",comments:0,mine:false,discrepancies:0,reflections:0}]}};
}
// API-111's answer for a pictured stage, with the talk that its marks count.
const answer=(source,{not_current=null,talk={}}={})=>({project:"qa-shop",part:"sample",stage:"",picture:{commit:COMMIT,committed_at:AT,drawn_at:AT,not_current,source},comments:{total:0,entries:[]},closed_comments:{total:0,entries:[]},proposals:[],reflections:[],discrepancies:[],...talk});
const page=(stage,{lang="en",picture=answer(SOURCES[stage]),problem=null}={})=>({schema:PAGE_SCHEMAS.stage,generated_at:AT,lang,data:stageData(stage),talk:{mine:{total:0},agent:{total:0},apart:{total:0}},picture,problem});
const between=(html,from,to)=>html.slice(html.indexOf(from),to?html.indexOf(to,html.indexOf(from)):undefined);
const waits=html=>[...html.matchAll(/<(?:button|select)\b[^>]*>/g)].map(([tag])=>/ disabled data-nx-wait="(\w+)"/.exec(tag)?.[1]??null);
const stageTitle=(stage,lang)=>`${stage.slice(0,2)} ${label("Stage names",Number(stage.slice(0,2))-1,lang)}`;

// The key check of draw-stage.test.js: every element that the code compares has a key, unique
// among its siblings, at the drawing's top and in each data-nx-sub element (../ui/reconcile.js).
const VOID=new Set(["input","br","img","hr","meta","link","source","wbr"]);
function assertKeyed(html,at){
  const pattern=/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>/=]+(?:="[^"]*")?)*)\s*(\/?)>/g,stack=[{sub:true,keys:new Set()}];
  for(const [,close,tag,attributes,self]of html.matchAll(pattern)){
    if(close){stack.pop();continue;}
    const parent=stack.at(-1);
    if(parent.sub){
      const key=/\sdata-nx-key="([^"]*)"/.exec(attributes)?.[1];
      assert.notEqual(key,undefined,`${at}: <${tag}${attributes}> has no key`);
      assert.ok(!parent.keys.has(key),`${at}: the key ${key} twice`);parent.keys.add(key);
    }
    if(!self&&!VOID.has(tag))stack.push({sub:/\sdata-nx-sub(?=\s|=|$)/.test(attributes),keys:new Set()});
  }
  assert.equal(stack.length,1,at+": balanced");
}

test("the five places of the sheet: the head, the tools' line, a DDD board's steps, the bars and the frame, and nothing where editing will stand (SCR-112)",()=>{
  for(const lang of["en","ko"])for(const stage of["01-domain","05-erd","07-sitemap"]){
    const html=drawPictureStage(page(stage,{lang}),lang),tools=labels("The picture's tools",lang),tabs=labels("Tabs",lang),at=`${stage} ${lang}`;
    const order=['class="shd"','class="ptools"',...(stage==="01-domain"?['class="steps"']:[]),'class="notes"','class="pbars"','class="pf"'].map(part=>html.indexOf(part));
    assert.ok(order.every((index,i)=>index>=0&&(i===0||index>order[i-1])),at+": the places in the sheet's order");
    // Picture and List, and no third place: editing waits for a release that includes it.
    const seg=between(html,'<span class="seg"','</span><span class="zoom');
    assert.equal((seg.match(/data-nx-act="view"/g)||[]).length,2,at);
    assert.ok(seg.includes(`aria-pressed="true" disabled data-nx-wait="picture"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-picture"/></svg><span>${esc(tabs[0])}</span>`),at+": Picture is pressed");
    assert.doesNotMatch(html,/data-nx-act="edit"|i-edit|Phase/,at+": no Edit and no phase 2 control");
    // BUG-596: the symbols that the new fonts lack are icons, never text, here too.
    assert.doesNotMatch(html.replace(/<svg class="board"[\s\S]*?<\/svg>/g,""),/[✓›◐⌕▾▸✕☰]/,at+": no symbol as text");
    // The tools of the picture, each named; Stage record at the line's end from 1,024 pixels and
    // in the head under them.
    for(const [act,name]of[["zoom-out",tools[0]],["zoom-in",tools[1]],["fit",tools[2]]])assert.ok(html.includes(`data-nx-act="${act}" data-nx-focus="${act}" aria-label="${esc(name)}" disabled data-nx-wait="picture">`),at+": "+act);
    assert.ok(html.includes('<span class="pct" data-nx-pct>100%</span>'),at+": 100 per cent");
    assert.ok(html.includes(`<details class="menu goto" data-nx-key="goto"><summary class="btn sm" data-nx-focus="goto" aria-label="${esc(tools[3])}">`),at+": Go to");
    assert.match(between(html,'class="ptools"','class="pf"'),/<button class="btn sm only-pc" type="button" data-nx-key="rec" data-nx-act="record" data-nx-focus="record-t"[^>]*disabled data-nx-wait="record">/);
    assert.match(between(html,'class="shd"','class="ptools"'),/<button class="btn sm only-ph" type="button" data-nx-key="rec" data-nx-act="record" data-nx-focus="record"/);
    // Every control waits for the code (rule 15).
    assert.ok(waits(html).every(kind=>kind==="picture"||kind==="record"),at+": the controls wait");
    // The frame: the picture at 100 per cent, named for screen readers, and its layers.
    const scene=pictureScene(page(stage).picture,stage),frame=between(html,'<div class="pf"');
    assert.ok(frame.startsWith(`<div class="pf" data-nx-key="pf" data-nx-sub><div class="cv" data-nx-key="cv ${COMMIT} ${AT} ${scene.step??""} ${lang}" tabindex="0" role="group" aria-label="${esc(label("The picture's tools",5,lang,{stage:stageTitle(stage,lang)}))}">${boardSVG(scene)}</div>`),at);
    assert.ok(frame.includes(`<svg class="mks" data-nx-key="mks" aria-hidden="true" focusable="false"></svg><div class="map" data-nx-key="map" role="img" aria-label="${esc(tools[4])}" hidden></div>`),at+": the marks and the map, which the code draws");
    assert.ok(!frame.includes('class="lgd'),at+": the legend comes with the marks");
    assert.ok(frame.includes('<div class="zpad only-ph" data-nx-key="zpad">')&&frame.endsWith('<div class="pcn" data-nx-key="pcn" data-nx-sub><div class="fnote" data-nx-key="fnote" role="status" data-nx-live></div></div></div>'),at);
    assertKeyed(html,at);
  }
});

test("the picture as one SVG: at 100 per cent with its corner in view, each item a link to its address, every word escaped (SPEC-156, rule 15)",()=>{
  const scene=pictureScene(page("05-erd").picture,"05-erd"),svg=boardSVG(scene),b=scene.bounds;
  assert.ok(svg.startsWith(`<svg class="board" width="${b.width+2*PAD}" height="${b.height+2*PAD}" focusable="false">`));
  assert.ok(svg.includes(`<g class="world" transform="translate(${PAD-b.x} ${PAD-b.y}) scale(1)">`));
  assert.ok(svg.includes('<a href="#item=TBL-001" tabindex="-1" data-nx-node="table-0" aria-label="TBL-001 orders"><title>orders · PK id INTEGER NOT NULL · reference TEXT NOT NULL</title>'),"a table links to its address; the keyboard reaches it in the list");
  assert.equal(boardSVG(scene),svg,"once for each layout");
  assert.equal(pictureScene(page("05-erd").picture,"05-erd").nodes.length,scene.nodes.length);
  const tricky={...SOURCES["07-sitemap"],screens:[{id:"SCR-009",name:`<img src=x onerror=alert(1)> & "q"`,path:"/x",access:"user",flows:[],context:"CTX-001",terms:[],removed:false,where},{id:"",name:"No ID",path:"/n",access:"user",flows:[],terms:[],removed:true,where}]};
  const board=boardSVG(pictureScene(answer(tricky),"07-sitemap"));
  assert.ok(!board.includes("<img")&&board.includes("&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;"),"labels are text");
  assert.ok(board.includes('<g data-nx-node="screen-1"><title>No ID · /n · user</title>')&&board.includes('stroke-dasharray="6 4"'),"an item without an ID is no link; a removed one is dashed");
  assert.ok(board.includes('<a href="#item=SCR-009" tabindex="-1" data-nx-node="screen-0" aria-label="SCR-009 &lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;">'),"a link says its item's ID and name");
  assert.equal(pictureScene(null,"05-erd"),null);assert.equal(pictureScene(page("05-erd").picture,"02-prd"),null);
});

test("a DDD board's steps: a line of their own with the picture only, the ends off, and the notice where the source has no timeline (SPEC-141)",()=>{
  for(const lang of["en","ko"]){
    const steps=words("Steps",lang).split(" · "),view={code:true,step:"3"};
    const html=drawPictureStage(page("01-domain",{lang}),lang,view),line=between(html,'<div class="steps"','<div class="notes"');
    assert.ok(line.startsWith(`<div class="steps" data-nx-key="steps" data-nx-sub><span class="mu stl1" id="steps-l" data-nx-key="stl">${esc(steps[2])}</span>`));
    assert.ok(line.includes(`data-nx-step="2" data-nx-focus="step:back" aria-label="${esc(steps[0])}">`)&&line.includes(`data-nx-step="4" data-nx-focus="step:next" aria-label="${esc(steps[1])}">`),"the steps before and after");
    assert.ok(line.includes(`<option value="3" selected>${esc(steps[5])}</option>`)&&(line.match(/<option /g)||[]).length===STEPS.length,"the nine steps, the third chosen");
    assert.match(drawPictureStage(page("01-domain",{lang}),lang,{code:true,step:"1-b"}),/data-nx-focus="step:back" aria-label="[^"]+" disabled>/,"no step before the first");
    assert.match(drawPictureStage(page("01-domain",{lang}),lang,{code:true}),/data-nx-focus="step:next" aria-label="[^"]+" disabled>/,"the whole board is the last step");
    assert.ok(!drawPictureStage(page("01-domain",{lang}),lang,{code:true,mode:"list"}).includes('class="steps"'),"none with the list");
    const flat=drawPictureStage(page("01-domain",{lang,picture:answer({...SOURCES["01-domain"],timeline:undefined})}),lang,{code:true});
    assert.ok(flat.includes(`<div class="pnote" data-nx-key="steps"><div class="bar info" role="status">`)&&flat.includes(esc(words("No timeline",lang))),"without a timeline, the whole board and why");
    assert.ok(!drawPictureStage(page("05-erd",{lang}),lang,{code:true}).includes('data-nx-key="steps"'),"an ERD has no steps");
  }
});

test("the list with #view=list: the tools' line keeps Picture and List, then the filters and the list of SCR-113 (SCR-112's list)",()=>{
  for(const lang of["en","ko"]){
    const html=drawPictureStage(page("05-erd",{lang}),lang,{code:true,mode:"list"});
    assert.match(html,/data-nx-view="list" data-nx-focus="view:list" aria-pressed="true">/);
    assert.ok(html.includes('class="filters"')&&html.includes('<div class="lw" data-nx-key="lw" data-nx-sub>')&&html.includes('data-nx-item="TBL-001"'));
    assert.ok(!/class="pf"|data-nx-act="(?:zoom-in|zoom-out|fit|goto)"/.test(html),"no picture and none of its tools");
    assertKeyed(html,"list "+lang);
  }
});

test("an empty frame says why, with List; a picture that is not current, a newer one and a large one have their bars (SCR-112#empty, #stale, #large)",()=>{
  for(const lang of["en","ko"]){
    const cases=[
      [page("05-erd",{lang,picture:null,problem:{code:"picture_not_found",why:"size"}}),words("picture_not_found:size",lang)],
      [page("05-erd",{lang,picture:null,problem:{code:"picture_not_found",why:"something else"}}),words("picture_not_found:not-drawn",lang)],
      [page("07-sitemap",{lang,picture:null,problem:{code:"space_not_found"}}),codeMessage("space_not_found",lang)],
      [page("07-sitemap",{lang,picture:answer({...SOURCES["07-sitemap"],screens:[]})}),label("No items",0,lang)],
    ];
    for(const [payload,text]of cases){
      const html=drawPictureStage(payload,lang,{code:true}),frame=between(html,'<div class="pf"');
      assert.ok(frame.includes(`<div class="empty-p" data-nx-key="empty"><div><svg class="i big" aria-hidden="true" focusable="false"><use href="#i-picture"/></svg><p>${esc(text)}</p><button class="btn" type="button" data-nx-act="view" data-nx-view="list" data-nx-focus="view:list-2">`),text);
      assert.ok(!/data-nx-act="(?:zoom-in|fit|goto)"|class="steps"/.test(html),"no picture tools over an empty frame");
      assertKeyed(html,"empty "+lang);
    }
    const scene={nodes:[{kind:"screen"},{kind:"screen"}],limited:true,listLimited:false,bounds:{x:0,y:0,width:0,height:0}};
    assert.deepEqual(frameState(page("07-sitemap"),scene,lang),{empty:true,text:pictureLimitMessage(scene,lang),limited:true});
    // Not current: the picture with the warning of its reason.
    const stale=drawPictureStage(page("05-erd",{lang,picture:answer(SOURCES["05-erd"],{not_current:"source-gone"})}),lang,{code:true});
    assert.ok(between(stale,'<div class="pbars"','<div class="pf"').includes(`<div class="bar warn" role="status"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-warn"/></svg><span class="t">${esc(notCurrentWhy("source-gone","bbbbbbb",lang))}</span></div>`));
    // A newer picture waits for Show it, while the drawn one stays.
    const newer=drawPictureStage(page("05-erd",{lang}),lang,{code:true,newer:answer(SOURCES["05-erd"])}),said=labels("A newer picture",lang);
    assert.ok(newer.includes(`<span class="t">${esc(said[0])}</span><button class="btn sm" type="button" data-nx-act="newer" data-nx-focus="newer">`)&&newer.includes(`<span>${esc(said[1])}</span>`)&&newer.includes('class="cv"'));
    assert.ok(drawPictureStage(page("05-erd",{lang,picture:null,problem:{code:"picture_not_found",why:"not-drawn"}}),lang,{code:true,newer:answer(SOURCES["05-erd"])}).includes('data-nx-act="newer"'),"over an empty frame too");
    // A large picture: more than 300 elements.
    const screens=Array.from({length:LARGE+1},(_,i)=>({id:`SCR-${100+i}`,name:"Screen "+i,path:"/"+i,access:"user",flows:[],context:"CTX-001",terms:[],removed:false,where}));
    const large=drawPictureStage(page("07-sitemap",{lang,picture:answer({format:1,screens})}),lang,{code:true});
    assert.ok(large.includes(esc(words("Large",lang,{n:LARGE+1}))));
    assert.ok(!drawPictureStage(page("07-sitemap",{lang}),lang,{code:true}).includes('class="bar'),"none for a picture that is current and small");
  }
});

test("the editor's note in the frame, which says that it loads or failed, and the legend that comes with the marks (SCR-112#loading, #code-failed, rule 13)",()=>{
  for(const lang of["en","ko"]){
    for(const [state,tone,index]of[["loading","info",0],["failed","warn",1]]){
      const html=drawPictureStage(page("07-sitemap",{lang}),lang,{code:true,editor:state});
      assert.ok(html.includes(`<div class="fnote" data-nx-key="fnote" role="status" data-nx-live><div class="msg ${tone}"><svg class="i" aria-hidden="true" focusable="false"><use href="#i-${tone}"/></svg><div><span class="t">${esc(label("The editor",index,lang))}</span></div></div></div>`),state);
    }
    const legend=between(drawPictureStage(page("07-sitemap",{lang}),lang,{code:true}),'<ul class="lgd','</ul>'),marks=labels("The marks",lang);
    assert.ok(legend.startsWith(`<ul class="lgd only-pc" data-nx-key="lgd" aria-label="${esc(marks[4])}">`));
    Object.values(MARK_SHAPES).forEach((shape,index)=>assert.ok(legend.includes(`<li><svg class="lg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg>${esc(marks[index])}</li>`),marks[index]));
  }
});

test("Go to: a DDD board's contexts, an ERD's tables and a sitemap's screens, and off for a context that the step does not show (REQ-237)",()=>{
  assert.deepEqual(gotoTargets(pictureScene(page("05-erd").picture,"05-erd"),SOURCES["05-erd"],"05-erd").map(t=>[t.id,t.name,t.keys]),[["TBL-001","orders",["table-0"]],["TBL-002","payments",["table-1"]]]);
  assert.deepEqual(gotoTargets(pictureScene(page("07-sitemap").picture,"07-sitemap"),SOURCES["07-sitemap"],"07-sitemap").map(t=>t.id),["SCR-001","SCR-002",""]);
  const two={...SOURCES["01-domain"],contexts:[...SOURCES["01-domain"].contexts,{id:"CTX-002",name:"Billing",purpose:"Bill",rows:[],where}]},picture=answer(two);
  const early=gotoTargets(pictureScene(picture,"01-domain","3"),two,"01-domain"),whole=gotoTargets(pictureScene(picture,"01-domain"),two,"01-domain");
  assert.deepEqual(early.map(t=>[t.id,Boolean(t.rect)]),[["CTX-001",true],["CTX-002",false]],"a step shows a context by its items");
  assert.deepEqual(whole.map(t=>[t.id,Boolean(t.rect)]),[["CTX-001",true],["CTX-002",true]],"the whole board by its frames");
  assert.ok(drawPictureStage({...page("01-domain"),picture},"en",{code:true,step:"3"}).includes('data-nx-goto="1" data-nx-focus="goto:1" disabled>'),"its entry is off");
  assert.deepEqual(union([{x:10,y:20,width:5,height:5},{x:-5,y:30,width:40,height:10}]),{x:-5,y:20,width:40,height:20});
  assert.deepEqual(gotoTargets(null,two,"01-domain"),[]);
});

test("the board's arithmetic: the opening view, an item brought into sight without a change of zoom unless it does not fit, and the map (SPEC-156, SPEC-209)",()=>{
  const cam={x:100,y:50,zoom:.5};
  assert.deepEqual(onScreen({x:200,y:100,width:40,height:20},cam),{x:200,y:100,width:20,height:10});
  assert.deepEqual(openingCamera({x:-30,y:10,width:500,height:400}),{x:PAD+30,y:PAD-10,zoom:1},"100 per cent, the corner PAD inside the frame");
  assert.deepEqual(openingCamera({x:0,y:0,width:500,height:400},.5,{x:40,y:12}),{x:PAD-40,y:PAD-12,zoom:.5},"where the user scrolled before the code ran, at the zoom last chosen");
  // In view: nothing moves. Out of view: the middle, at the same zoom. Too large: zoomed out.
  assert.equal(sightCamera(cam,{x:200,y:100,width:40,height:20},"07-sitemap",800,600),cam);
  assert.deepEqual(sightCamera(cam,{x:3000,y:2000,width:40,height:20},"07-sitemap",800,600),{x:400-3020*.5,y:300-2010*.5,zoom:.5});
  const far=sightCamera({x:0,y:0,zoom:1},{x:0,y:0,width:3000,height:200},"05-erd",800,600);
  assert.ok(far.zoom<1&&far.zoom>=.1&&Math.round(far.zoom*100)===far.zoom*100,"an ERD's zoom keeps two decimals");
  assert.equal(needsMap({x:0,y:0,width:900,height:100},{x:0,y:0,zoom:1},800,600),true);
  assert.equal(needsMap({x:0,y:0,width:900,height:100},{x:0,y:0,zoom:.5},800,600),false);
  // A point: the topmost item, never a lane, and an item before its context's frame.
  const scene=pictureScene(page("01-domain").picture,"01-domain"),event=scene.nodes.find(n=>n.kind==="event"),frame=scene.nodes.find(n=>n.kind==="context");
  assert.equal(nodeAt(scene,event.x+1,event.y+1),event);
  assert.equal(nodeAt(scene,frame.x+1,frame.y+1),frame);
  assert.equal(nodeAt(scene,-1e6,-1e6),null);
  assert.ok(!scene.nodes.filter(n=>n.kind==="lane").some(lane=>nodeAt(scene,lane.x+1,lane.y+1)?.kind==="lane"));
  // An item's box: its own, or a context's items on a step without frames; null where it is not.
  assert.deepEqual(itemBox(scene,"CTX-001"),{x:frame.x,y:frame.y,width:frame.width,height:frame.height});
  const step=pictureScene(page("01-domain").picture,"01-domain","3"),members=step.nodes.filter(n=>n.kind!=="lane"&&n.context==="CTX-001");
  assert.deepEqual(itemBox(step,"CTX-001"),union(members));
  assert.equal(itemBox(step,"TERM-001"),null,"the step does not hold the aggregate yet");
  assert.equal(itemBox(scene,"TBL-404"),null);
  // The map: the whole picture, a large picture's frames only, with room around.
  assert.equal((mapBoxes(scene).match(/<rect /g)||[]).length,scene.nodes.length);
  const lots={...scene,nodes:[...scene.nodes,...Array.from({length:LARGE},(_,i)=>({kind:"event",x:i,y:0,width:1,height:1}))]};
  assert.equal((mapBoxes(lots).match(/<rect /g)||[]).length,scene.nodes.filter(n=>n.kind==="context"||n.kind==="lane").length);
  assert.deepEqual(mapView({x:0,y:0,width:1000,height:500}),{x:-40,y:-40,width:1080,height:580});
});

test("the marks: each kind a shape with its words, from the item's top-right corner leftwards, and only near the view (rule 13)",()=>{
  const scene=pictureScene(page("05-erd").picture,"05-erd"),orders=scene.nodes.find(n=>n.id==="TBL-001");
  const talk={comments:{total:2,entries:[{id:"c1",item:"TBL-001"},{id:"c2",item:"TBL-001"}]},proposals:[{id:"p1",items:["TBL-001"]}],discrepancies:[{id:"d1",item:"TBL-001",waiting:true}],reflections:[{id:"e1",proposal:{items:["TBL-001","TBL-002"]}}]};
  const cam={x:0,y:0,zoom:1},marks=markLayout(scene,talk,cam,1200,800);
  assert.deepEqual(marks.filter(m=>m.node===orders).map(m=>[m.kind,m.n,m.cx,m.cy]),[["comment",2,300,0],["proposal",1,270,0],["waiting",1,240,0],["accepted",1,210,0]]);
  assert.deepEqual(marks.filter(m=>m.node.id==="TBL-002").map(m=>m.kind),["accepted"]);
  assert.deepEqual(markLayout(scene,talk,{x:-5000,y:0,zoom:1},1200,800),[],"none far from the view");
  assert.deepEqual(markLayout(scene,{discrepancies:[{item:"TBL-001",waiting:false},{item:"TBL-001",waiting:true}]},cam,1200,800).map(m=>m.kind),["discrepancy"],"an open discrepancy is not dashed");
  for(const lang of["en","ko"]){
    const [comment,proposal,waiting,accepted]=marks.map(m=>markSVG(m,lang)),said=labels("The marks",lang);
    assert.ok(comment.startsWith(`<g class="mk" data-nx-id="TBL-001"><title>${esc(label("The marks",5,lang,{label:said[0],n:"2"}))}</title><circle class="mk-pin" cx="300" cy="0" r="12"/>`));
    assert.ok(proposal.includes('<rect class="mk-prop"')&&proposal.includes(esc(label("The marks",5,lang,{label:said[1],n:"1"}))));
    assert.ok(waiting.includes('<path class="mk-wait"')&&waiting.includes(`<title>${esc(words("Waits",lang))}</title>`),"a discrepancy that waits for a current picture");
    assert.ok(accepted.includes('<rect class="mk-acc"')&&accepted.includes(esc(label("The marks",5,lang,{label:said[3],n:"1"}))));
  }
  assert.ok(markSVG({kind:"comment",n:1000,cx:1,cy:2,node:{id:`"><script>`}},"en").includes(`data-nx-id="&quot;&gt;&lt;script&gt;"`)&&markSVG({kind:"comment",n:1000,cx:1,cy:2,node:{}},"en").includes(">999+<"));
  assert.equal(count(1000),"999+");
});

test("the page: a pictured stage with a picture keeps its editor's code and style in a template until the picture has painted, and no other page has them (SCR-112#loading)",()=>{
  const entries=metadata.entries;
  for(const [stage,editor]of[["01-domain","excalidraw"],["05-erd","erd"],["07-sitemap","excalidraw"]]){
    const html=views.page(page(stage)),start=html.indexOf('<template id="nexus-editor-assets">'),end=html.indexOf("</template>",start);
    assert.ok(start>0&&end>start,stage);
    const template=html.slice(start,end),outside=html.slice(0,start)+html.slice(end);
    assert.ok(template.includes(`<link rel="modulepreload" href="${entries[editor+"-js"]}">`),stage+": the editor's code");
    if(entries[editor+"-css"])assert.ok(template.includes(`<link rel="stylesheet" href="${entries[editor+"-css"]}" data-nexus-css="editor">`),stage+": its style");
    for(const name of["erd-js","excalidraw-js","excalidraw-css","view-js"])assert.ok(!outside.includes(entries[name]),stage+": "+name+" only in the template");
    assert.ok(html.includes(`data-nx-part="stage">${drawParts(page(stage)).stage}</`),stage+": the server draws what the code draws");
  }
  for(const payload of[page("05-erd",{picture:null,problem:{code:"picture_not_found",why:"not-drawn"}}),{...page("02-prd"),picture:null}])assert.ok(!views.page(payload).includes("nexus-editor-assets"));
  // The stage page's code names the two editors and the Excalidraw style, as the view's does.
  const pageCode=(entries["page-preload"]||[]).map(url=>code[url.slice(6)].body.toString()).join("\n");
  for(const name of["erd-js","excalidraw-js","excalidraw-css"])assert.ok(pageCode.includes(JSON.stringify(entries[name]).slice(1,-1)),name);
});
