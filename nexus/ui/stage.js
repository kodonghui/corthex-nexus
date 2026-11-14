// A stage page's code (SCR-111, SCR-112 and SCR-113): the filters, the search in the stage, the
// grouping and the next 200 items (API-158); on a pictured stage the picture or the list, the
// picture's tools and a DDD board's steps (./board.js), and a newer picture (API-111); an
// address's #view=, #step=, #filter=left and #item=; the stage record, where the user passes
// the checkpoint or withdraws one passed in NEXUS (API-128, API-129); the talk in the side
// (./talk.js), with the address's talk=, the phone's tabs and the panel from 1,024 to 1,279
// pixels; the selected item's panel there (./item.js, SCR-115), with the switch back to the
// talk and the phone's Item tab; the top bar's search (./search.js, SCR-116), whose words
// the address holds as q=; the folds of the list of stages and of the talk (./folds.js,
// SPEC-210); and the project's data over the stage (./data.js, SCR-130), with the address's
// data. It draws with the server's own functions (../src/draw/page.js): the stage's middle
// and the side are compared element by element (./reconcile.js), so that the focus, the words and
// the messages stay where they are, and the list of stages, the bars and the tabs are replaced
// when their drawing changes.
import {drawParts} from "../src/draw/page.js";
import {stageRail} from "../src/draw/stages.js";
import {FILTERS,GROUPS,WORDS_LIMIT,PICTURE_STAGES} from "../src/draw/stage.js";
import {STEPS} from "../src/layout.js";
import {createBoard} from "./board.js";
import {createTalk} from "./talk.js";
import {createItem} from "./item.js";
import {createSearch} from "./search.js";
import {day} from "../src/draw/html.js";
import {codeMessage,labels,oldLabels} from "../src/draw/words.js";
import {stageRequest} from "../src/draw/talk.js";
import {createFolds} from "./folds.js";
import {createData,fragment} from "./data.js";
import {ApiClient,Drafts,LatestReads,PendingWrites,characters} from "./state.js";
import {reconcile} from "./reconcile.js";

const PERMISSION=Object.freeze(["user_only","access_missing","access_other_app"]);
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
// After these the record reads again (SCR-112#error and #stale).
const GONE=Object.freeze(["part_not_found","space_not_found","checkpoint_not_found","project_not_found"]);
// A pass refused for the request that it named or did not name reads the talk again too (SPEC-194).
const ASKED=Object.freeze(["request_changed","comment_not_found"]);
// The fields of a pass that names what the page showed: a refusal by one of them is a page of
// before the release, which Load again answers (SCR-112#error).
const SHOWN=Object.freeze(["commit","revision","comment","entry"]);
const SEARCH_WAIT=250,MAX_PAGES=25;
const TRACE=/^[A-Z][A-Z0-9]*-[0-9]{1,6}$/,TALK_KEYS=Object.freeze(["talk","comment","proposal"]);
// The parts that the code replaces when their drawing changes; it compares the others.
const REPLACED=Object.freeze(["rail","bars","tabs"]);
// A fragment without a value, such as the phone's #stages and #stage or the panel's #talk, which
// the stylesheet follows before the code runs (rule 15), names no state of the page; #data, the
// project's data alone, does (stage 07).
const plain=value=>/^#[^=&]+$/.test(value)&&value!=="#data";
const keysOf=value=>new URLSearchParams(String(value||"").replace(/^#/,""));
const hasData=value=>!plain(value)&&keysOf(value).has("data");
const withoutData=value=>{const params=keysOf(value);params.delete("data");const rest=fragment(params);return rest?"#"+rest:"";};
const readable=answer=>Boolean(answer?.project&&answer.head&&answer.record&&Array.isArray(answer.stages)&&answer.items&&Array.isArray(answer.items.entries));

export function startStage(payload,{api=new ApiClient(location.origin),drafts=new Drafts(),localize=()=>{}}={}){
  const lang=payload.lang,reads=new LatestReads(),writes=new PendingWrites();
  const part=name=>document.querySelector(`[data-nx-part="${name}"]`);
  const parts={stage:part("stage"),side:part("side"),rail:part("rail"),bars:part("bars"),tabs:part("tabs"),data:part("data")},ws=document.querySelector(".ws");
  const first=payload.data,project=first.project.name,stage=first.stage,partName=first.part,place=[project,partName||"_",stage].map(encodeURIComponent).join("/");
  const base=`/api/spaces/${encodeURIComponent(project)}`;
  // The drafts of 0.2's stage overview, so that its words and write IDs carry over (rule 5).
  const passScope=`${project}:checkpoint:${place}`,withdrawScope=id=>`${project}:withdraw-checkpoint:${id}`;
  const pictured=PICTURE_STAGES.includes(stage);
  // mode, step, newer and editor are a pictured stage's: the picture or the list, a DDD board's
  // step, a newer picture on the server, and whether the editor loads or failed.
  // item is the selected item's panel (./item.js); side is what the side shows of it from 1,024
  // pixels, the item or, by its switch, the stage's whole talk; shownSide is what the side shows
  // when it draws, under 1,024 pixels by the tab in front.
  // data is the project's data (./data.js), which the address's data opens.
  const view={code:true,data:{},query:{filter:first.items.filter,group:first.items.group,q:first.items.q??""},entries:null,selected:null,more:null,updating:false,notice:null,pushed:null,signIn:false,record:false,recordState:{sending:null,reading:false,note:null,passNote:null,left:null,over:false,stale:false},mode:"picture",step:undefined,newer:null,editor:null,item:null,side:"item",shownSide:"item"};
  // What the list of stages, the bars and the tabs show, which the code replaces when it changes:
  // the list of stages as the code draws it, with "Project data" and the mark working, since the
  // step that wakes the controls that wait for the code (rule 15) makes it so in place.
  const shown=new Map(Object.entries(drawParts(payload)).filter(([name])=>REPLACED.includes(name)));
  shown.set("rail",stageRail(first,lang,payload.generated_at,true));
  // tabBefore is the phone's tab in front before the item's took its place, panelBy says that
  // the item opened the panel from 1,024 to 1,279 pixels, and pictureWhy why the list, not the
  // picture, shows the selected item.
  let reading=0,searchTimer=0,opener="record",before=null,picked=null,applied=null,talk=null,runs=0,itemPanel=null,search=null,tabBefore=null,panelBy=null,pictureWhy=null,sideWas=null,focusInSide=false,dataPanel=null;
  // Under 1,024 pixels the phone's tabs, and from 1,024 to 1,279 the side's panel (rule 16);
  // from 1,280 the talk's column, which a first visit folds under 1,440 (SPEC-210).
  const small=matchMedia("(max-width:1023.98px)"),mid=matchMedia("(min-width:1024px) and (max-width:1279.98px)"),wide=matchMedia("(min-width:1280px)"),narrowWide=matchMedia("(min-width:1280px) and (max-width:1439.98px)");
  // The folds (SPEC-210), applied in one step as soon as the code runs, before its first drawing.
  const folds=createFolds(ws);folds.apply();
  // The picture's board (SCR-112), which follows the frame of each drawing.
  const board=pictured?createBoard(parts.stage,{state:()=>({payload,view}),lang,pick,editor:(state,quiet)=>{if(view.editor===state)return;view.editor=state;if(!quiet)render(["stage"]);}}):null;

  const data=()=>payload.data;
  const entries=()=>view.entries||data().items.entries;
  const asked=()=>({filter:data().items.filter,group:data().items.group,q:data().items.q??""});
  const same=(a,b)=>a.filter===b.filter&&a.group===b.group&&a.q===b.q;
  const textarea=()=>parts.side.querySelector("#cp-words");
  function stageUrl(query,after=0){
    const params=new URLSearchParams({filter:query.filter,group:query.group});
    if(query.q)params.set("q",query.q);
    if(after)params.set("after",String(after));
    return `${base}/stages/${encodeURIComponent(partName||"_")}/${encodeURIComponent(stage)}?${params}`;
  }

  function render(names=["stage","side","rail","bars","tabs","data"]){
    const active=document.activeElement,focus=active?.closest?.("[data-nx-focus]")?.dataset.nxFocus??null,inSide=Boolean(parts.side?.contains(active));
    view.shownSide=small.matches?(ws?.dataset.nxTab==="item"?"item":"talk"):view.side;
    talk?.sync();itemPanel?.sync();
    const drawn=drawParts(payload,view);
    for(const name of names){
      const element=parts[name];if(!element)continue;
      if(REPLACED.includes(name)){if(shown.get(name)!==drawn[name]){element.innerHTML=drawn[name];shown.set(name,drawn[name]);}}
      else{const template=document.createElement("template");template.innerHTML=drawn[name];reconcile(element,template.content);}
      localize(element);
    }
    if(names.includes("stage"))board?.sync();
    // A control that the drawing replaced: the same one again (stage 08's rule 3); a talk's
    // answer that left with its entry's answers, the answer in place, else the entry's press;
    // an entry that left the talk, such as one marked answered, from its answers or its press,
    // the heading of the talk that held it, "Talk on {id}" in the item's panel; any other control
    // of the side, the item's or the talk's heading.
    if(focus&&!document.body.contains(active)){
      const find=key=>document.querySelector(`[data-nx-focus="${CSS.escape(key)}"]`),entry=/^(?:talk:)?(n[cpe]_[0-9a-z]{12})(?::|$)/.exec(focus)?.[1];
      const usable=element=>element&&!element.disabled&&element.getClientRects().length>0;
      const heads=!inSide?[]:entry?["itk-h","talk-h","item-h"]:["item-h","talk-h"];
      [find(focus),entry&&find(entry+":after"),entry&&find("talk:"+entry),...heads.map(find)].find(usable)?.focus({preventScroll:true});
    }
    // The words that the browser keeps, in the talk's boxes that the drawing made new.
    if(names.includes("side")&&talk?.fill())render(["side"]);
    // A "Talk ({n})" that the drawing made new says the talk's state again (SPEC-210).
    if(names.includes("stage"))syncFolds();
  }

  // A read's answer from a newer push leaves the page as it is, with the bar of SCR-111#stale.
  function newer(answer){
    if(answer.project.pushed_at===data().project.pushed_at)return false;
    view.pushed=answer.project.pushed_at;return true;
  }
  function failed(error){
    const code=error?.code||"internal";
    if(code==="sign_in_expired"){view.signIn=true;return;}
    view.notice=PERMISSION.includes(code)?{kind:"refused",code,trace:error?.traceId}:{kind:"unread"};
  }
  function settled(){view.notice=null;view.signIn=false;}
  const listElement=()=>parts.stage.querySelector(".lw > .list");

  // A new filter, search or grouping: the first 200 of what the user picked.
  async function readQuery(){
    const query={...view.query};
    view.more=null;reading++;view.updating=true;render(["stage"]);
    try{
      await reads.run("list",()=>api.call("GET",stageUrl(query)),answer=>{
        if(!readable(answer))throw new Error("Unreadable answer");
        // The list keeps what it drew, and the filters say so, until Load again (SCR-113#stale).
        if(newer(answer)){view.query=asked();return;}
        payload.data=answer;view.entries=null;settled();
        const list=listElement();if(list)list.scrollTop=0;
      });
    }catch(error){failed(error);}
    finally{reading--;view.updating=reading>0;render();}
  }
  // Reading again (rule 6), after a write and on Try again: as many items as the list holds.
  async function readAgain(){
    const query=asked(),want=Math.max(entries().length,1);
    reading++;view.updating=true;render(["stage"]);
    try{
      await reads.run("list",async()=>{
        const answer=await api.call("GET",stageUrl(query));
        if(!readable(answer))throw new Error("Unreadable answer");
        const all=[...answer.items.entries];
        for(let page=1;all.length<want&&all.length<answer.items.total&&page<MAX_PAGES;page++){
          const next=await api.call("GET",stageUrl(query,all.length));
          if(!readable(next)||next.project.pushed_at!==answer.project.pushed_at||!next.items.entries.length)break;
          all.push(...next.items.entries);
        }
        return{answer,all};
      },({answer,all})=>{
        if(newer(answer))return;
        payload.data=answer;view.entries=all.length>answer.items.entries.length?all:null;settled();
      });
    }catch(error){failed(error);}
    finally{reading--;view.updating=reading>0;render();}
  }
  // A pictured stage reads its picture again too (API-111): the marks of the same picture, or a
  // newer picture, which waits for Show it while the drawn one stays (SCR-112#stale). It gives
  // back its failure, which the bar shows after the list's reading, whose success would
  // otherwise clear it (SCR-112#error and #permission).
  async function readPicture(){
    if(!pictured)return null;
    try{
      await reads.run("picture",()=>api.call("GET",`${base}/pictures/${encodeURIComponent(partName||"_")}/${encodeURIComponent(stage)}`),answer=>{
        const drawn=payload.picture?.picture,fresh=answer?.picture;
        if(!fresh||!fresh.source||typeof fresh.source!=="object")throw new Error("Unreadable answer");
        if(drawn&&fresh.commit===drawn.commit&&fresh.drawn_at===drawn.drawn_at){payload.picture={...answer,picture:{...fresh,source:drawn.source}};view.newer=null;}
        else view.newer=answer;
      });
      return null;
    }catch(error){return error?.code==="picture_not_found"?null:error;}
  }
  async function refresh(){
    const [,problem]=await Promise.all([same(view.query,asked())?readAgain():readQuery(),readPicture()]);
    if(problem)failed(problem);
    render();
  }
  // The next 200, when the list's end comes into view (SCR-113's actions).
  async function loadMore(){
    const list=entries(),total=Number(data().items.total)||0;
    // A newer push keeps the list as it is drawn until Load again (SCR-113#stale).
    if(reading||view.pushed||view.more==="loading"||list.length>=total)return false;
    const query=asked();
    view.more="loading";render(["stage"]);
    let done=false;
    try{
      const ran=await reads.run("list",()=>api.call("GET",stageUrl(query,list.length)),answer=>{
        if(!readable(answer))throw new Error("Unreadable answer");
        view.more=null;
        if(newer(answer))return;
        done=true;
        view.entries=[...list,...answer.items.entries];
        payload.data={...data(),items:{...data().items,total:answer.items.total,counts:answer.items.counts,groups:answer.items.groups}};
      });
      if(!ran&&view.more==="loading")view.more=null;
    }catch(error){done=false;view.more="failed";if(error?.code==="sign_in_expired")view.signIn=true;}
    finally{render(["stage","bars"]);}
    return done;
  }
  function nearEnd(){
    const list=listElement();
    if(!list||view.more||view.pushed||reading)return;
    if(list.scrollTop+list.clientHeight>=list.scrollHeight-list.clientHeight/2)loadMore();
  }

  // An item named by the address (#item=, or #view=list&item= on a pictured stage): its row
  // selected, after as many pages as it takes to reach it, with SCR-115 beside it. "narrowed"
  // where the list as the user narrowed it does not hold the row (SCR-115's revision).
  const rowOf=id=>parts.stage.querySelector(`[data-nx-item="${CSS.escape(id)}"]`);
  async function select(id){
    if(typeof id!=="string"||!id||id.length>200)return null;
    view.selected=id;render(["stage"]);
    for(let page=0;!rowOf(id)&&page<MAX_PAGES;page++)if(!await loadMore())break;
    const row=rowOf(id);
    if(row){row.scrollIntoView({block:"nearest"});return null;}
    const query=asked();
    return query.filter!=="all"||query.q?"narrowed":null;
  }
  // The address after #; a plain fragment leaves the one that the page last followed.
  const hash=()=>new URLSearchParams((plain(location.hash)?applied||"":location.hash).replace(/^#/,""));
  // A new address: a new entry for the back button with push, else in the place of this one,
  // which the page has already followed.
  function setHash(params,push=false){
    const rest=fragment(params);
    history[push?"pushState":"replaceState"](history.state,"",location.pathname+location.search+(rest?"#"+rest:""));
    if(!push)applied=location.hash;
  }
  // An item on a pictured stage (SPEC-209, SCR-112's actions): in the picture, in sight and
  // outlined; on a DDD board's step that does not hold it, on the whole board. Where the picture
  // is not current or not drawn, or does not hold the item, its row in the list instead, at
  // #view=list&item=. An item that the user picked in the picture stays there. It gives back
  // why the stage does not show the item where the user looks, for its panel (rule 24): a
  // picture not current or not drawn, or a list narrowed past its row.
  async function selectItem(id,stay=false){
    if(typeof id!=="string"||!id||id.length>200)return null;
    if(pictured&&view.mode==="picture"){
      const drawn=payload.picture?.picture,mine=picked===id;picked=null;pictureWhy=null;
      if(drawn&&(mine||stay||!drawn.not_current)&&board.shown()){
        let found=board.select(id);
        if(found==="elsewhere"){const params=hash();params.delete("step");setHash(params);view.step=undefined;render(["stage"]);found=board.select(id);}
        if(found==="found"||stay){view.selected=id;render(["stage"]);return null;}
      }
      // Picture, which the user pressed, stays the view, with the item selected and no outline.
      if(stay){view.selected=id;board?.select(null);render(["stage"]);return null;}
      pictureWhy=!drawn?"none":drawn.not_current?"stale":null;
      const params=hash();params.set("view","list");params.delete("step");setHash(params);
      view.mode="list";board.select(null);render(["stage"]);
    }else if(!pictured||view.mode!=="list")pictureWhy=null;
    return await select(id)||pictureWhy;
  }
  // The item's panel (SCR-115): beside the stage from 1,024 pixels, from 1,024 to 1,279 as the
  // side's panel; under 1,024 the Item tab in front, unless an entry of the talk selected it,
  // whose Talk tab stays in front (SCR-114's layout). The same item again keeps its panel. From
  // 1,280 pixels a folded talk's column shows for as long as the item is open (SPEC-210).
  function showItem(id,fromTalk){
    if(!itemPanel.open(id))return;
    view.side="item";
    if(!ws)return;
    if(small.matches){if(!fromTalk&&ws.dataset.nxTab!=="item"){tabBefore=ws.dataset.nxTab||"stage";ws.dataset.nxTab="item";}}
    else if(!ws.dataset.nxOpen&&(mid.matches||!sideShown())){ws.dataset.nxOpen="talk";panelBy="item";}
  }
  // The address without an item: the panel closes, the phone's tab in front before it returns,
  // the panel or the folded talk's column that the item opened folds again, and the side shows
  // the stage's talk.
  function closeItemView(){
    if(!view.item)return;
    itemPanel.close();view.side="item";pictureWhy=null;
    if(ws?.dataset.nxTab==="item")ws.dataset.nxTab=tabBefore||"stage";
    if(ws&&panelBy==="item"&&ws.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;
    tabBefore=null;panelBy=null;
  }
  // Close or Escape on the item (SCR-115's actions): the address leaves item= and talk=, as "All
  // talk of the stage" does; the panel that the item opened from 1,024 to 1,279 pixels folds, and
  // without an entry to return to, the focus goes back to the item's row or the picture.
  function closeItem(){
    const id=view.item?.id,entry=talk?.opened();
    if(!id)return;
    if(ws&&panelBy==="item"&&ws.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;
    panelBy=null;
    Promise.resolve(talk?.showWhole()).then(()=>{if(!entry)(rowOf(id)||parts.stage.querySelector(".cv"))?.focus({preventScroll:true});}).catch(()=>{});
  }
  // A pressed item that no stage holds now (SCR-115#gone): nothing stays selected.
  function itemGone(id){
    if(view.selected!==id)return;
    view.selected=null;board?.select(null);render(["stage"]);
  }
  // A pick in the picture: its item's address, as a row's link gives it.
  function pick(id){
    picked=id;const params=hash();params.set("item",id);setHash(params,true);applyAddress().catch(()=>{});
  }
  // Picture or List (SCR-112's actions), each an address that the back button returns to; the
  // picture leaves the address's filter to the list.
  function showView(name){
    if(!pictured||!["picture","list"].includes(name)||name===view.mode)return;
    const params=hash();
    if(name==="list")params.set("view","list");else{params.delete("view");params.delete("filter");}
    setHash(params,true);applyAddress(name==="picture").catch(()=>{});
  }
  // A DDD board's step (SPEC-141), in the place of the address; the whole board has none.
  function setStep(key){
    if(stage!=="01-domain"||!STEPS.includes(key))return;
    const params=hash();
    if(key===STEPS.at(-1))params.delete("step");else params.set("step",key);
    const rest=fragment(params);
    history.replaceState(history.state,"",location.pathname+location.search+(rest?"#"+rest:""));
    applyAddress().catch(()=>{});
  }
  // Show it: the newer picture that waited (SCR-112#stale).
  function showNewer(){
    if(!view.newer)return;
    payload.picture=view.newer;payload.problem=null;view.newer=null;render(["stage"]);
    const id=hash().get("item");if(id&&view.mode==="picture")selectItem(id,true);
  }
  // The address after # (SCR-111's data): on a pictured stage #view=list for the list, else the
  // picture, also for #view=edit and #view=board until a release includes editing (SPEC-147);
  // #filter= alone opens the list too, as the first page's links expect; a DDD board's #step=,
  // a key that it does not have giving the whole board; then #filter= and #item=.
  // The project's data follows the address's data first: a plain fragment, such as the phone's
  // #stages, closes it, and the address that the page follows loses it too; an address that
  // differs only by data changes nothing else.
  async function applyAddress(stay=false){
    const now=location.hash;
    dataPanel?.follow(hasData(now));
    if(plain(now)){if(applied&&keysOf(applied).has("data"))applied=withoutData(applied);return;}
    if(now===applied)return;
    const was=applied;applied=now;
    if(was!==null&&withoutData(was)===withoutData(now))return;
    const run=++runs;
    const params=hash(),shown=params.get("view"),filter=params.get("filter"),id=params.get("item"),key=params.get("step");
    const valid=Boolean(id)&&id.length<=30&&TRACE.test(id),fromTalk=TALK_KEYS.some(name=>params.get(name));
    if(pictured){
      const mode=shown==="list"||!shown&&params.has("filter")?"list":"picture",step=stage==="01-domain"&&STEPS.includes(key)?key:undefined;
      if(mode!==view.mode||step!==view.step){view.mode=mode;view.step=step;render(["stage"]);}
    }
    if(FILTERS.includes(filter)&&filter!==view.query.filter&&(!pictured||view.mode==="list")){view.query={...view.query,filter};await readQuery();}
    // The item: its panel at once (SCR-115#loading), then its place in the stage and why the stage
    // does not show it there; an ID that no stage can hold is gone at once.
    if(id&&id.length<=200){
      showItem(id,fromTalk);render(["side","tabs"]);
      if(valid){
        const why=await selectItem(id,stay);
        if(view.item?.state==="gone")itemGone(id);
        else if(run===runs)itemPanel.setWhy(id,why);
      }else itemGone(view.selected);
    }else{
      closeItemView();
      if(view.selected){view.selected=null;board?.select(null);}
      render(["stage","side","tabs"]);
    }
    // Then the talk: narrowed to the item, with the entry that talk= names open (SCR-114),
    // unless a newer address came meanwhile; the words of q= in the top bar's search.
    if(run===runs)await talk?.follow(params);
    if(run===runs&&params.get("q")&&search&&search.state().q!==params.get("q").trim())search.openWith(params.get("q"));
  }
  // A filter that the user picks takes the place of the address's (SCR-113's data).
  function dropHashFilter(){
    const params=hash();if(!params.has("filter"))return;
    params.delete("filter");const rest=fragment(params);
    history.replaceState(history.state,"",location.pathname+location.search+(rest?"#"+rest:""));
  }

  // Whether the side shows now: the talk's column, or the panel that it opens.
  function sideShown(){return Boolean(parts.side?.getClientRects().length);}
  // The folds' states, which a screen reader says (SPEC-210): the list's control says whether the
  // list shows and names what a press does; "Talk ({n})" says whether the talk shows while it is
  // in sight, and says nothing while the talk's column or the phone's tabs take its place. A side
  // that folds with the focus in it, as the back button folds what an entry or an item showed,
  // leaves the focus on "Talk ({n})", where Close and Escape leave it (rule 16).
  function syncFolds(){
    const stagesShown=folds.value("stages")!=="folded",words=labels("The folds",lang);
    for(const control of document.querySelectorAll('[data-nx-act="fold-stages"]')){
      control.setAttribute("aria-expanded",String(stagesShown));
      const title=words[stagesShown?0:1];if(control.title!==title)control.title=title;
    }
    const shown=sideShown(),shows=String(shown),active=document.activeElement;
    if(sideWas&&!shown&&focusInSide&&(!active||active===document.body||parts.side.contains(active))){
      const button=parts.stage?.querySelector('[data-nx-fold="talk"]');
      if(button?.getClientRects().length)button.focus({preventScroll:true});
    }
    sideWas=shown;
    for(const control of parts.stage?.querySelectorAll('[data-nx-fold="talk"]')||[]){
      if(control.getClientRects().length){if(control.getAttribute("aria-expanded")!==shows)control.setAttribute("aria-expanded",shows);}
      else control.removeAttribute("aria-expanded");
    }
  }
  // Fold the list of stages, or show it again (SCR-111's actions of the revision): the focus stays
  // on the control, which the rail keeps at its top.
  function foldStages(){
    folds.keep("stages",folds.value("stages")==="folded"?"shown":"folded");
    syncFolds();
  }
  // Fold the talk from 1,280 pixels: kept folded, and a column that an entry or an item showed
  // folds too; the focus goes to "Talk ({n})", which takes its place.
  function foldTalk(){
    folds.keep("talk","folded");
    if(ws?.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;
    panelBy=null;syncFolds();
    document.querySelector('[data-nx-focus="talk"]')?.focus();
  }
  // "Talk ({n})" from 1,280 pixels: the talk kept shown, as a column again, with the focus on the
  // heading of what the side shows.
  function showTalkColumn(){
    folds.keep("talk","shown");syncFolds();
    (parts.side.querySelector("#talk-h")||parts.side.querySelector("#item-h"))?.focus();
  }

  // The stage record: in the side, in the talk's place; a panel from 1,024 to 1,279 pixels and a
  // sheet under 1,024, which the page behind waits for (rule 10's focus and Escape). The
  // project's data waits for nothing behind it either, the side included, behind the scrim.
  function holdPage(){
    const data=Boolean(view.data.open),hold=data||view.record&&small.matches;
    for(const element of [document.querySelector(".tb"),parts.bars,document.querySelector(".rail"),document.querySelector(".tabs"),parts.stage])element?.toggleAttribute("inert",hold);
    parts.side?.toggleAttribute("inert",data);
    if(ws){if(data)ws.dataset.nxData="open";else delete ws.dataset.nxData;}
  }
  // Crossing 1,024 pixels, the side shows what its new layout shows: the tab in front, or the
  // item and its switch.
  small.addEventListener?.("change",()=>{holdPage();if(view.item)talk?.renarrow();render(["side","tabs"]);});
  function counter(){
    const box=textarea(),n=characters(box?.value||"");
    view.recordState.left=n>=WORDS_LIMIT*.9?WORDS_LIMIT-n:null;view.recordState.over=n>WORDS_LIMIT;
    if(view.recordState.over)box?.setAttribute("aria-invalid","true");
  }
  function openRecord(button){
    if(view.record)return;
    opener=button?.dataset.nxFocus||"record";before=ws?.dataset.nxOpen??null;
    view.record=true;if(ws)ws.dataset.nxOpen="record";
    render(["stage","side"]);
    const box=textarea();if(box)box.value=drafts.read(passScope).text;
    counter();render(["side"]);holdPage();
    parts.side.querySelector("#rec-h")?.focus();
  }
  function closeRecord(to=before,focus=true){
    if(!view.record)return;
    // An address that opened the record (#record) loses it in its place, so that loading the
    // page again shows the stage (BUG-607).
    if(location.hash==="#record")history.replaceState(history.state,"",location.pathname+location.search);
    view.record=false;view.recordState={...view.recordState,note:null,passNote:null};
    if(ws){if(to)ws.dataset.nxOpen=to;else delete ws.dataset.nxOpen;}
    before=null;holdPage();render(["stage","side"]);
    if(focus)document.querySelector(`[data-nx-focus="${CSS.escape(opener)}"]`)?.focus();
  }
  // An item to look at first (rule 22), in the record or on a request's entry in the talk: the
  // record gives way to the item's panel, which its address opens as a step of the browser's
  // history, whichever stage holds the item (SCR-115), with the focus on the panel's heading. An
  // address to look at first is the browser's own link, which opens in a new tab.
  function lookAt(id){
    if(!TRACE.test(id||""))return;
    if(view.record)closeRecord(undefined,false);
    // A pictured stage keeps the view that it shows, the picture or its list.
    const hash=(pictured&&view.mode==="list"?"#view=list&item=":"#item=")+encodeURIComponent(id);
    if(location.hash!==hash)history.pushState(history.state,"",location.pathname+location.search+hash);
    applyAddress().then(()=>{if(view.item?.id===id)parts.side.querySelector("#item-h")?.focus({preventScroll:true});}).catch(()=>{});
  }

  // "Answers the request" of a checkpoint in the record (SCR-112, SCR-113): the record gives way to
  // the talk with the request's entry open, its address a step of the browser's history (SCR-114).
  function answers(id){
    if(!/^nc_[0-9a-hjkmnp-tv-z]{12}$/.test(id||""))return;
    if(view.record)closeRecord(undefined,false);
    const params=hash();for(const key of TALK_KEYS)params.delete(key);params.set("talk",id);
    history.pushState(history.state,"",location.pathname+location.search+"#"+fragment(params));
    applyAddress().catch(()=>{});
  }

  // A write that failed (SCR-112#error, #permission and #stale): its message above the words box,
  // with the words kept, and Try again where trying again can help, with the same write ID.
  function writeFailed(act,error,scope,checkpoint,named=false){
    const code=error?.code||"internal",trace=error?.traceId,state=view.recordState,retry={retry:act,checkpoint};
    if(code==="sign_in_expired"){state.passNote={tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true};return false;}
    // What the page showed changed (SCR-112#stale, SPEC-194), and nothing was recorded. Another
    // commit or a newer snapshot: the page reads again, which shows SCR-111#stale's bar with Load
    // again, the refusal has a Load again of its own, since under 1,024 pixels the record's sheet
    // covers the bar, and the pass stays off until the page is loaded again; the words wait in
    // the browser's storage (rule 5). The request: the talk and the record read again and show it
    // as it is now, and the pass then names it.
    if(code==="snapshot_changed"){
      const held=typeof error?.held_commit==="string"&&error.held_commit?error.held_commit.slice(0,7):null;
      state.stale=true;state.passNote={tone:"warn",text:held?codeMessage(code,lang,{commit:held}):oldLabels(code,lang)[1],trace,load:true};
      return true;
    }
    if(code==="request_changed"){state.passNote={tone:"warn",text:named?codeMessage(code,lang):oldLabels(code,lang)[1],trace};return true;}
    if(code==="comment_not_found"){state.passNote={tone:"err",text:codeMessage(code,lang),trace};return true;}
    // A pass that does not name what the page showed comes from a page of before the release.
    if(act==="pass"&&code==="invalid_request"&&SHOWN.includes(error?.field)){state.passNote={tone:"err",text:codeMessage(code,lang),trace,load:true};return false;}
    if(code==="checkpoint_recorded"){state.note={tone:"warn",text:codeMessage(code,lang),trace};return true;}
    if(GONE.includes(code)){state.passNote={tone:"err",text:codeMessage(code,lang),trace};return true;}
    if(PERMISSION.includes(code)){state.passNote={tone:"warn",text:codeMessage(code,lang),trace};return false;}
    if(code==="cross_site"){state.passNote={tone:"err",text:codeMessage(code,lang),trace,here:location.origin+location.pathname+location.hash};return false;}
    if(code==="write_id_reused")drafts.renew(scope);
    if(act==="pass"&&(code==="text_too_long"||code==="invalid_request"&&error?.field==="words"))textarea()?.setAttribute("aria-invalid","true");
    // A full comment takes no reply until the request is marked answered in the talk, so trying
    // again cannot help (SCR-112#error).
    state.passNote={tone:"err",text:codeMessage(CONNECTION[code]||code,lang,{limit:Number(error?.limit??WORDS_LIMIT).toLocaleString("en-US")}),trace,...(code==="text_too_long"||code==="reply_limit"?{}:retry)};
    return false;
  }
  async function pass(){
    const state=view.recordState,box=textarea();
    if(!box||state.sending||state.reading||state.stale||writes.has(passScope)||characters(box.value)>WORDS_LIMIT)return;
    // The pass names what the page showed (SPEC-194): the commit of the project's snapshot as the
    // page's data gave it, or its revision where it names no commit, and the stage's open
    // checkpoint request that the record shows whole, with the place of its last entry.
    const shown=data().project,request=stageRequest(payload.talk);
    const seen=typeof shown.commit==="string"&&shown.commit?{commit:shown.commit}:{revision:shown.revision};
    const asked=request?{comment:request.comment.id,entry:request.place}:{};
    // driven is what navigator.webdriver says, left out where the browser does not say (SPEC-195).
    const draft=drafts.update(passScope,{text:box.value}),driven=typeof navigator.webdriver==="boolean"?{driven:navigator.webdriver}:{};
    const body={part:partName,stage,...seen,...asked,...(draft.text.trim()?{words:draft.text}:{}),...driven};
    state.sending="pass";state.passNote=null;state.note=null;box.readOnly=true;render(["side"]);
    let again=false,talkToo=Boolean(request);
    try{
      await writes.run(passScope,()=>api.call("POST",`${base}/checkpoints`,{body,write:draft.write}));
      drafts.clear(passScope,draft.write);
      if(box.value===draft.text)box.value="";
      box.removeAttribute("aria-invalid");counter();again=true;
    }catch(error){again=writeFailed("pass",error,passScope,undefined,Boolean(request));talkToo=ASKED.includes(error?.code);}
    finally{state.sending=null;state.reading=again;box.readOnly=false;render(["side"]);}
    // A pass with a request settled it, which the talk then shows waiting for the agent. Until
    // the page has read again, the pass and Withdraw stay off, so that a second press sends
    // nothing and the next pass names what the record then shows (SCR-112's repeats, rule 21,
    // BUG-608).
    if(again){try{await Promise.all([refresh(),talkToo?talk?.readAgain():null]);}finally{state.reading=false;render(["side"]);}}
  }
  async function withdraw(id){
    const state=view.recordState,scope=withdrawScope(id);
    if(!/^nk_[0-9a-hjkmnp-tv-z]{12}$/.test(id||"")||state.sending||state.reading||writes.has(scope))return;
    const draft=drafts.ensure(scope);
    state.sending="withdraw:"+id;state.passNote=null;state.note=null;render(["side"]);
    let again=false;
    try{
      const result=await writes.run(scope,()=>api.call("POST",`${base}/checkpoints/${encodeURIComponent(id)}/withdraw`,{body:{},write:draft.write}));
      drafts.clear(scope,draft.write);
      state.note={tone:"info",text:result?.changed===false?codeMessage("Already withdrawn",lang):codeMessage("Withdrawn",lang,{date:day(result?.checkpoint?.withdrawn_at,true)})};
      again=true;
    }catch(error){again=writeFailed("withdraw",error,scope,id);}
    finally{state.sending=null;state.reading=again;render(["side"]);}
    if(again){try{await refresh();}finally{state.reading=false;render(["side"]);}}
  }

  // The phone's sheet of stages (SCR-111, BUG-617): the stage's name in the top bar opens it at
  // #stages, which the stylesheet follows before the code runs, as a step of the history over the
  // address that it leaves; the page keeps that address, which hash() reads, and what it shows.
  // Close, the scrim and Escape (BUG-618) take the step back, so that the address comes back
  // whole, with the focus on the stage's name; a stage or a part chosen in the sheet takes the
  // sheet's place in the history, so that the back button comes back to the stage with the rest
  // of its address, not to the sheet, as from the project's data (BUG-611); the stage or the part
  // shown closes the sheet. An address that came with #stages has no step of this page to take
  // back: Close puts the address that the page shows in its place.
  const sheetOpen=()=>small.matches&&location.hash==="#stages";
  function closeSheet(){
    if(!sheetOpen())return false;
    if(typeof history.state?.nexusSheetOver==="string")history.back();
    else{const rest=fragment(hash());location.replace("#"+(rest||"stage"));}
    document.querySelector(".tb .ttl")?.focus({preventScroll:true});
    return true;
  }
  function sheetClick(event){
    if(!small.matches||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return false;
    const link=event.target.closest?.("a[href]");
    if(!link)return false;
    if(!sheetOpen()){
      if(!link.matches(".tb .ttl"))return false;
      event.preventDefault();
      const over=location.hash;location.hash="#stages";
      history.replaceState({nexusSheetOver:over},"",location.href);
      return true;
    }
    if(link.matches(".rail .close,.ws > .scrim,.rail [aria-current=\"page\"]")){event.preventDefault();closeSheet();return true;}
    if(link.closest(".rail")&&!link.getAttribute("href").startsWith("#")&&!link.target){event.preventDefault();location.replace(link.href);return true;}
    return false;
  }

  document.addEventListener("click",event=>{
    // The project's data: "Project data" and the mark of a long wait, and the panel's controls.
    if(dataPanel?.click(event))return;
    // The phone's sheet of stages: the stage's name, the sheet's Close and scrim, and its links.
    if(sheetClick(event))return;
    // The phone's tabs (SPEC-155): the stage or the talk, without a step of the history.
    const tab=event.target.closest?.(".tab[data-nx-tab]");
    if(tab&&ws&&parts.tabs?.contains(tab)){event.preventDefault();ws.dataset.nxTab=tab.dataset.nxTab;render(["side","tabs"]);return;}
    // The list's fold control, a part of the frame (SPEC-210).
    const foldList=event.target.closest?.('[data-nx-act="fold-stages"]');
    if(foldList){event.preventDefault();if(!foldList.disabled)foldStages();return;}
    const control=event.target.closest?.("[data-nx-act]"),inside=control&&[parts.stage,parts.side,parts.bars].some(element=>element?.contains(control));
    if(!control&&view.record&&event.target.closest?.(".scrim")){event.preventDefault();closeRecord(null);return;}
    if(!inside||control.disabled||control.getAttribute("aria-disabled")==="true")return;
    const act=control.dataset.nxAct;
    // A press with a key held, or with another button, opens the link where the browser opens it.
    if(act==="look"){if(!control.dataset.nxItem||event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();lookAt(control.dataset.nxItem);return;}
    if(act==="answers"){if(event.button||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;event.preventDefault();answers(control.dataset.nxComment);return;}
    // "All talk of the stage" from the item's panel on the phone: the talk's tab, in front.
    if(act==="whole"&&ws?.dataset.nxTab==="item"){ws.dataset.nxTab="talk";tabBefore=null;}
    if(act==="fold-talk"){talk?.click(act,control,event);foldTalk();return;}
    if(talk?.click(act,control,event))return;
    // The item's panel (SCR-115's actions).
    if(act==="item-close"){closeItem();return;}
    if(act==="side"){
      const side=control.dataset.nxSide;if(!["talk","item"].includes(side)||side===view.side)return;
      view.side=side;render(["side"]);talk?.renarrow();return;
    }
    if(act==="item-retry"){itemPanel.read();return;}
    if(act==="item-search"){search?.openWith(view.item?.id);return;}
    if(act==="discrepancy"){talk?.target(control.dataset.nxDiscrepancy);return;}
    if(act==="trace-more"){
      const key=control.dataset.nxTrace,at=control.dataset.nxStage;
      itemPanel.unfold(key,at);render(["side"]);
      parts.side.querySelector(`[data-nx-focus="${CSS.escape(`t:${key}:${at}:6`)}"]`)?.focus();
      return;
    }
    if(act==="item-show-all"){
      // Show all: the list's filter and search clear, and the row is selected (SCR-113).
      const find=parts.stage.querySelector('input[name="q"]'),id=view.item?.id;if(find)find.value="";
      view.query={...view.query,filter:"all",q:""};dropHashFilter();
      readQuery().then(async()=>{if(id&&view.item?.id===id)itemPanel.setWhy(id,await select(id)||pictureWhy);}).catch(()=>{});
      return;
    }
    // Talk ({n}) from 1,024 to 1,279 pixels: the panel, with the focus on its heading; from 1,280,
    // the folded talk shown again as a column, which the browser keeps (SPEC-210).
    if(act==="talk"){
      event.preventDefault();
      if(view.record)closeRecord("talk");
      else if(ws&&wide.matches)showTalkColumn();
      else if(ws){if(ws.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;else{ws.dataset.nxOpen="talk";parts.side.querySelector("#talk-h")?.focus();}}
      syncFolds();
      return;
    }
    if(act==="record")openRecord(control);
    else if(act==="close")closeRecord();
    else if(act==="filter"){
      const name=control.dataset.nxFilter;
      // A filter picked twice reads once (SCR-113's repeats).
      if(!FILTERS.includes(name)||name===view.query.filter)return;
      view.query={...view.query,filter:name};dropHashFilter();readQuery();
    }
    else if(act==="group"){
      const name=control.dataset.nxGroup,menu=control.closest("details");if(menu)menu.open=false;
      if(!GROUPS.includes(name)||name===view.query.group)return;
      view.query={...view.query,group:name};readQuery();
    }
    else if(act==="show-all"){
      const find=parts.stage.querySelector('input[name="q"]');if(find)find.value="";
      view.query={...view.query,filter:"all",q:""};dropHashFilter();readQuery();
    }
    else if(act==="more")loadMore();
    else if(act==="view")showView(control.dataset.nxView);
    else if(act==="zoom-in")board?.zoomIn();
    else if(act==="zoom-out")board?.zoomOut();
    else if(act==="fit")board?.fit();
    else if(act==="goto"){const menu=control.closest("details");if(menu)menu.open=false;board?.goTo(Number(control.dataset.nxGoto));}
    else if(act==="step")setStep(control.dataset.nxStep);
    else if(act==="newer")showNewer();
    else if(act==="read")refresh();
    else if(act==="pass")pass();
    else if(act==="withdraw")withdraw(control.dataset.nxCheckpoint);
    else if(act==="sign-in"||act==="load")location.reload();
  });
  // The search in the stage: from one character, up to 200, once the typing pauses.
  parts.stage.addEventListener("input",event=>{
    if(event.target?.name!=="q")return;
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{const q=event.target.value.trim().slice(0,200);if(q===view.query.q)return;view.query={...view.query,q};readQuery();},SEARCH_WAIT);
  });
  // A DDD board's list of steps.
  parts.stage.addEventListener("change",event=>{if(event.target?.name==="step")setStep(event.target.value);});
  parts.side.addEventListener("input",event=>{
    if(talk?.input(event))return;
    if(event.target?.id!=="cp-words")return;
    drafts.update(passScope,{text:event.target.value});event.target.removeAttribute("aria-invalid");
    counter();render(["side"]);
  });
  parts.stage.addEventListener("scroll",nearEnd,true);
  // Escape closes the project's data, else the phone's sheet of stages, which covers the stage and
  // its item (BUG-618), else the record, else folds the talk's opened entry where the focus is in the talk
  // (SCR-114's actions), else closes the selected item where the focus is not in a field
  // (SCR-115's actions), else folds the talk that Talk ({n}) opened (SCR-111's actions). The
  // search's Escape is its own.
  const typing=target=>Boolean(target?.closest?.("input,textarea,select,[contenteditable]"));
  // Whether the focus went into the side last, for a side that folds with it (syncFolds).
  document.addEventListener("focusin",event=>{focusInSide=Boolean(parts.side?.contains(event.target));});
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape"||event.defaultPrevented)return;
    if(dataPanel?.escape())event.preventDefault();
    else if(closeSheet())event.preventDefault();
    else if(view.record){event.preventDefault();closeRecord();}
    else if(parts.side.contains(document.activeElement)&&talk?.escape())event.preventDefault();
    else if(view.item&&!typing(event.target)){event.preventDefault();closeItem();}
    else if(ws?.dataset.nxOpen==="talk"){
      event.preventDefault();delete ws.dataset.nxOpen;panelBy=null;
      const button=document.querySelector('[data-nx-focus="talk"]');if(button?.getClientRects().length)button.focus();
    }
  });
  // "Talk ({n})" is a link that opens the talk before the code runs and a button to the keyboard
  // and to screen readers (SCR-111's actions): Space presses it on its release, as it presses a
  // button, and does not scroll the stage.
  const linkButton=target=>Boolean(target?.matches?.('a[role="button"]'));
  document.addEventListener("keydown",event=>{if(event.key===" "&&linkButton(event.target))event.preventDefault();});
  document.addEventListener("keyup",event=>{if(event.key===" "&&linkButton(event.target)){event.preventDefault();event.target.click();}});
  // The talk reads again when the page comes back into view (SPEC-150), and so does the stage,
  // whose answer holds the head's last read and the mark of a long wait, so that the head
  // follows an agent's read that the talk shows (SPEC-188, SPEC-189; SCR-111's state changes),
  // and the project's data while it is open (SCR-130).
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){talk?.readAgain();refresh();dataPanel?.visible();}});
  // The back button and a link's address (rule 9). Back from an item that no entry of the talk
  // selected (SCR-115's actions, BUG-616): the focus goes to the item's row or the picture, as
  // Close and Escape put it, not to the talk's heading that the side's drawing gives it, unless
  // something outside the side holds it; with neither in sight, as behind the phone's Talk tab, to
  // the talk's heading.
  window.addEventListener("hashchange",()=>applyAddress().catch(()=>{}));
  window.addEventListener("popstate",()=>{
    const was=view.item?.id;
    applyAddress().then(()=>{
      if(!was||view.item||TALK_KEYS.some(name=>hash().get(name)))return;
      const active=document.activeElement;
      if(active&&active!==document.body&&!parts.side.contains(active))return;
      const usable=element=>Boolean(element&&element.getClientRects().length);
      [rowOf(was),parts.stage.querySelector(".cv"),parts.side.querySelector("#talk-h")].find(usable)?.focus({preventScroll:true});
    }).catch(()=>{});
  });

  // The controls that wait for the code (rule 15) work from here on.
  for(const control of document.querySelectorAll('[data-nx-wait="list"],[data-nx-wait="record"],[data-nx-wait="picture"],[data-nx-wait="talk"],[data-nx-wait="folds"],[data-nx-wait="data"]')){control.disabled=false;control.removeAttribute("data-nx-wait");}
  // The address: the view and the step first, so that the first drawing of the code shows them,
  // then #filter=left from the first page's agent to-do (SCR-110) and #item=.
  if(pictured){
    const params=hash(),shown=params.get("view"),key=params.get("step");
    view.mode=shown==="list"||!shown&&params.has("filter")?"list":"picture";
    view.step=stage==="01-domain"&&STEPS.includes(key)?key:undefined;
  }
  // The talk (SCR-114), and the tab or the panel that shows it: the talk's, for an address that
  // names an entry or a fragment #talk, which the stylesheet followed until now; else the stage's.
  talk=createTalk({payload,view,api,drafts,lang,base,project,part:partName,stage,place,ws,side:parts.side,render,hash,applyAddress,refresh,
    // From 1,024 pixels the switch shows the stage's whole talk with the item still selected.
    whole:()=>!small.matches&&view.side==="talk"&&Boolean(view.item),selected:()=>view.item?.id??null,
    onDiscrepancyGone:()=>itemPanel.read()});
  itemPanel=createItem({payload,view,api,base,project,part:partName,stage,entries,render,refreshPage:()=>refresh().catch(()=>{}),onGone:itemGone});
  // The project's data (SCR-130): opening it is a step of the browser's history, which Close and
  // Escape take back; an address that came with data loses it in its place. location.hash, not
  // pushState, so that the phone's sheet of stages, which follows #stages, closes. Chosen in that
  // sheet, the panel closes the sheet as a stage chosen there does: its address takes the sheet's
  // place in the history, so that Close and the back button come back to the stage with the rest
  // of its address, not to the sheet (BUG-611), and Close takes data out in place, since the step
  // before the sheet may be another page's.
  dataPanel=parts.data?createData({api,lang,project,base,state:view.data,part:parts.data,render,hold:holdPage,
    pushed:at=>{if(typeof at==="string"&&at!==data().project.pushed_at&&view.pushed!==at){view.pushed=at;render(["bars"]);}},
    address:{
      open(){
        const params=hash();params.set("data","");
        const sheet=location.hash==="#stages",next="#"+fragment(params);
        if(sheet)location.replace(next);else location.hash=next;
        const {nexusSheetOver,...kept}=history.state&&typeof history.state==="object"?history.state:{};
        history.replaceState({...kept,nexusData:location.hash,...(sheet?{nexusSheet:true}:{})},"",location.href);
      },
      back(){if(history.state?.nexusData!==location.hash||history.state.nexusSheet)return false;history.back();return true;},
      drop(){
        const params=hash();params.delete("data");const rest=fragment(params);
        const {nexusData,nexusSheet,...kept}=history.state&&typeof history.state==="object"?history.state:{};
        history.replaceState(Object.keys(kept).length?kept:null,"",location.pathname+location.search+(rest?"#"+rest:""));
        applied=location.hash;
      },
    }}):null;
  // The top bar's search (SCR-116): its words in the address as q=, in the place of this one.
  search=createSearch({lang,api,address:q=>{const params=hash();if(q)params.set("q",q);else params.delete("q");setHash(params);}});
  if(ws){
    const params=hash(),toTalk=location.hash==="#talk"||["talk","comment","proposal"].some(key=>params.get(key));
    ws.dataset.nxTab=toTalk?"talk":"stage";
    if(location.hash==="#talk")ws.dataset.nxOpen="talk";
  }
  render();
  // The folds' states follow whatever shows or hides a column: the folds, the panel, the record,
  // the tabs and the window's width.
  if(ws)new MutationObserver(syncFolds).observe(ws,{attributes:true,attributeFilter:["data-nx-open","data-nx-tab","data-nx-stages","data-nx-talk"]});
  for(const query of [small,mid,wide,narrowWide])query.addEventListener?.("change",syncFolds);
  syncFolds();
  applyAddress().then(nearEnd).catch(()=>{});
  // An address with #record, as the first page's link after a pass gives it (SCR-110), opens the
  // stage record once the code runs, from the Stage record button that shows (BUG-607).
  const recordAsked=()=>{
    if(location.hash!=="#record"||view.record)return;
    openRecord([...document.querySelectorAll('[data-nx-act="record"]')].find(control=>control.getClientRects().length&&!control.disabled)||null);
  };
  recordAsked();
  window.addEventListener("hashchange",recordAsked);
  return{render,readQuery,readAgain,readPicture,loadMore,select,selectItem,openRecord,closeRecord,pass,withdraw,view,board,talk,item:itemPanel,search,data:dataPanel};
}
