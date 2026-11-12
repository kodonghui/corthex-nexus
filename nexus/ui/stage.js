// A stage page's code (SCR-111, SCR-112 and SCR-113): the filters, the search in the stage, the
// grouping and the next 200 items (API-158); on a pictured stage the picture or the list, the
// picture's tools and a DDD board's steps (./board.js), and a newer picture (API-111); an
// address's #view=, #step=, #filter=left and #item=; the stage record, where the user passes
// the checkpoint or withdraws one passed in NEXUS (API-128, API-129); and the talk in the side
// (./talk.js), with the address's talk=, the phone's tabs and the panel from 1,024 to 1,279
// pixels. It draws with the server's own functions (../src/draw/page.js): the stage's middle and
// the side are compared element by element (./reconcile.js), so that the focus, the words and
// the messages stay where they are, and the list of stages, the bars and the tabs are replaced
// when their drawing changes.
import {drawParts} from "../src/draw/page.js";
import {FILTERS,GROUPS,WORDS_LIMIT,PICTURE_STAGES} from "../src/draw/stage.js";
import {STEPS} from "../src/layout.js";
import {createBoard} from "./board.js";
import {createTalk} from "./talk.js";
import {day} from "../src/draw/html.js";
import {codeMessage} from "../src/draw/words.js";
import {ApiClient,Drafts,LatestReads,PendingWrites,characters} from "./state.js";
import {reconcile} from "./reconcile.js";

const PERMISSION=Object.freeze(["user_only","access_missing","access_other_app"]);
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
// After these the record reads again (SCR-112#error and #stale).
const GONE=Object.freeze(["part_not_found","space_not_found","checkpoint_not_found","project_not_found"]);
const SEARCH_WAIT=250,MAX_PAGES=25;
// The parts that the code replaces when their drawing changes; it compares the others.
const REPLACED=Object.freeze(["rail","bars","tabs"]);
// A fragment without a value, such as the phone's #stages and #stage or the panel's #talk, which
// the stylesheet follows before the code runs (rule 15), names no state of the page.
const plain=value=>/^#[^=&]+$/.test(value);
const readable=answer=>Boolean(answer?.project&&answer.head&&answer.record&&Array.isArray(answer.stages)&&answer.items&&Array.isArray(answer.items.entries));

export function startStage(payload,{api=new ApiClient(location.origin),drafts=new Drafts(),localize=()=>{}}={}){
  const lang=payload.lang,reads=new LatestReads(),writes=new PendingWrites();
  const part=name=>document.querySelector(`[data-nx-part="${name}"]`);
  const parts={stage:part("stage"),side:part("side"),rail:part("rail"),bars:part("bars"),tabs:part("tabs")},ws=document.querySelector(".ws");
  const first=payload.data,project=first.project.name,stage=first.stage,partName=first.part,place=[project,partName||"_",stage].map(encodeURIComponent).join("/");
  const base=`/api/spaces/${encodeURIComponent(project)}`;
  // The drafts of 0.2's stage overview, so that its words and write IDs carry over (rule 5).
  const passScope=`${project}:checkpoint:${place}`,withdrawScope=id=>`${project}:withdraw-checkpoint:${id}`;
  const pictured=PICTURE_STAGES.includes(stage);
  // mode, step, newer and editor are a pictured stage's: the picture or the list, a DDD board's
  // step, a newer picture on the server, and whether the editor loads or failed.
  const view={code:true,query:{filter:first.items.filter,group:first.items.group,q:first.items.q??""},entries:null,selected:null,more:null,updating:false,notice:null,pushed:null,signIn:false,record:false,recordState:{sending:null,note:null,passNote:null,left:null,over:false},mode:"picture",step:undefined,newer:null,editor:null};
  // What the list of stages, the bars and the tabs show, which the code replaces when it changes.
  const shown=new Map(Object.entries(drawParts(payload)).filter(([name])=>REPLACED.includes(name)));
  let reading=0,searchTimer=0,opener="record",before=null,picked=null,applied=null,talk=null,runs=0;
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

  function render(names=["stage","side","rail","bars","tabs"]){
    const active=document.activeElement,focus=active?.closest?.("[data-nx-focus]")?.dataset.nxFocus??null,inSide=Boolean(parts.side?.contains(active));
    talk?.sync();
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
    // an entry that left the talk, such as one marked answered, the talk's heading.
    if(focus&&!document.body.contains(active)){
      const find=key=>document.querySelector(`[data-nx-focus="${CSS.escape(key)}"]`),entry=/^(n[cpe]_[0-9a-z]{12}):/.exec(focus)?.[1];
      const usable=element=>element&&!element.disabled&&element.getClientRects().length>0;
      [find(focus),entry&&find(entry+":after"),entry&&find("talk:"+entry),inSide&&find("talk-h")].find(usable)?.focus({preventScroll:true});
    }
    // The words that the browser keeps, in the talk's boxes that the drawing made new.
    if(names.includes("side")&&talk?.fill())render(["side"]);
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
  // selected, after as many pages as it takes to reach it. SCR-115 opens beside it in TASK-277.
  const rowOf=id=>parts.stage.querySelector(`[data-nx-item="${CSS.escape(id)}"]`);
  async function select(id){
    if(typeof id!=="string"||!id||id.length>200)return;
    view.selected=id;render(["stage"]);
    for(let page=0;!rowOf(id)&&page<MAX_PAGES;page++)if(!await loadMore())break;
    rowOf(id)?.scrollIntoView({block:"nearest"});
  }
  // The address after #; a plain fragment leaves the one that the page last followed.
  const hash=()=>new URLSearchParams((plain(location.hash)?applied||"":location.hash).replace(/^#/,""));
  // A new address: a new entry for the back button with push, else in the place of this one,
  // which the page has already followed.
  function setHash(params,push=false){
    const rest=params.toString();
    history[push?"pushState":"replaceState"](history.state,"",location.pathname+location.search+(rest?"#"+rest:""));
    if(!push)applied=location.hash;
  }
  // An item on a pictured stage (SPEC-209, SCR-112's actions): in the picture, in sight and
  // outlined; on a DDD board's step that does not hold it, on the whole board. Where the picture
  // is not current or not drawn, or does not hold the item, its row in the list instead, at
  // #view=list&item=. An item that the user picked in the picture stays there.
  async function selectItem(id,stay=false){
    if(typeof id!=="string"||!id||id.length>200)return;
    if(pictured&&view.mode==="picture"){
      const drawn=payload.picture?.picture,mine=picked===id;picked=null;
      if(drawn&&(mine||stay||!drawn.not_current)&&board.shown()){
        let found=board.select(id);
        if(found==="elsewhere"){const params=hash();params.delete("step");setHash(params);view.step=undefined;render(["stage"]);found=board.select(id);}
        if(found==="found"||stay){view.selected=id;render(["stage"]);return;}
      }
      // Picture, which the user pressed, stays the view, with the item selected and no outline.
      if(stay){view.selected=id;board?.select(null);render(["stage"]);return;}
      const params=hash();params.set("view","list");params.delete("step");setHash(params);
      view.mode="list";board.select(null);render(["stage"]);
    }
    await select(id);
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
    const rest=params.toString();
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
  async function applyAddress(stay=false){
    const now=location.hash;if(plain(now)||now===applied)return;applied=now;
    const run=++runs;
    const params=hash(),shown=params.get("view"),filter=params.get("filter"),id=params.get("item"),key=params.get("step");
    if(pictured){
      const mode=shown==="list"||!shown&&params.has("filter")?"list":"picture",step=stage==="01-domain"&&STEPS.includes(key)?key:undefined;
      if(mode!==view.mode||step!==view.step){view.mode=mode;view.step=step;render(["stage"]);}
    }
    if(FILTERS.includes(filter)&&filter!==view.query.filter&&(!pictured||view.mode==="list")){view.query={...view.query,filter};await readQuery();}
    if(id)await selectItem(id,stay);
    else if(view.selected){view.selected=null;board?.select(null);render(["stage"]);}
    // Then the talk: narrowed to the item, with the entry that talk= names open (SCR-114),
    // unless a newer address came meanwhile.
    if(run===runs)await talk?.follow(params);
  }
  // A filter that the user picks takes the place of the address's (SCR-113's data).
  function dropHashFilter(){
    const params=hash();if(!params.has("filter"))return;
    params.delete("filter");const rest=params.toString();
    history.replaceState(history.state,"",location.pathname+location.search+(rest?"#"+rest:""));
  }

  // The stage record: in the side, in the talk's place; a panel from 1,024 to 1,279 pixels and a
  // sheet under 1,024, which the page behind waits for (rule 10's focus and Escape).
  const small=matchMedia("(max-width:1023.98px)");
  function holdPage(){
    const hold=view.record&&small.matches;
    for(const element of [document.querySelector(".tb"),parts.bars,document.querySelector(".rail"),document.querySelector(".tabs"),parts.stage])element?.toggleAttribute("inert",hold);
  }
  small.addEventListener?.("change",holdPage);
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
  function closeRecord(to=before){
    if(!view.record)return;
    view.record=false;view.recordState={...view.recordState,note:null,passNote:null};
    if(ws){if(to)ws.dataset.nxOpen=to;else delete ws.dataset.nxOpen;}
    before=null;holdPage();render(["stage","side"]);
    document.querySelector(`[data-nx-focus="${CSS.escape(opener)}"]`)?.focus();
  }

  // A write that failed (SCR-112#error, #permission and #stale): its message above the words box,
  // with the words kept, and Try again where trying again can help, with the same write ID.
  function writeFailed(act,error,scope,checkpoint){
    const code=error?.code||"internal",trace=error?.traceId,state=view.recordState,retry={retry:act,checkpoint};
    if(code==="sign_in_expired"){state.passNote={tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true};return false;}
    if(code==="checkpoint_recorded"){state.note={tone:"warn",text:codeMessage(code,lang),trace};return true;}
    if(GONE.includes(code)){state.passNote={tone:"err",text:codeMessage(code,lang),trace};return true;}
    if(PERMISSION.includes(code)){state.passNote={tone:"warn",text:codeMessage(code,lang),trace};return false;}
    if(code==="cross_site"){state.passNote={tone:"err",text:codeMessage(code,lang),trace,here:location.origin+location.pathname+location.hash};return false;}
    if(code==="write_id_reused")drafts.renew(scope);
    if(act==="pass"&&(code==="text_too_long"||code==="invalid_request"&&error?.field==="words"))textarea()?.setAttribute("aria-invalid","true");
    state.passNote={tone:"err",text:codeMessage(CONNECTION[code]||code,lang,{limit:Number(error?.limit??WORDS_LIMIT).toLocaleString("en-US")}),trace,...(code==="text_too_long"?{}:retry)};
    return false;
  }
  async function pass(){
    const state=view.recordState,box=textarea();
    if(!box||state.sending||writes.has(passScope)||characters(box.value)>WORDS_LIMIT)return;
    const draft=drafts.update(passScope,{text:box.value}),body={part:partName,stage,...(draft.text.trim()?{words:draft.text}:{})};
    state.sending="pass";state.passNote=null;state.note=null;box.readOnly=true;render(["side"]);
    let again=false;
    try{
      await writes.run(passScope,()=>api.call("POST",`${base}/checkpoints`,{body,write:draft.write}));
      drafts.clear(passScope,draft.write);
      if(box.value===draft.text)box.value="";
      box.removeAttribute("aria-invalid");counter();again=true;
    }catch(error){again=writeFailed("pass",error,passScope);}
    finally{state.sending=null;box.readOnly=false;render(["side"]);}
    if(again)await refresh();
  }
  async function withdraw(id){
    const state=view.recordState,scope=withdrawScope(id);
    if(!/^nk_[0-9a-hjkmnp-tv-z]{12}$/.test(id||"")||state.sending||writes.has(scope))return;
    const draft=drafts.ensure(scope);
    state.sending="withdraw:"+id;state.passNote=null;state.note=null;render(["side"]);
    let again=false;
    try{
      const result=await writes.run(scope,()=>api.call("POST",`${base}/checkpoints/${encodeURIComponent(id)}/withdraw`,{body:{},write:draft.write}));
      drafts.clear(scope,draft.write);
      state.note={tone:"info",text:result?.changed===false?codeMessage("Already withdrawn",lang):codeMessage("Withdrawn",lang,{date:day(result?.checkpoint?.withdrawn_at,true)})};
      again=true;
    }catch(error){again=writeFailed("withdraw",error,scope,id);}
    finally{state.sending=null;render(["side"]);}
    if(again)await refresh();
  }

  document.addEventListener("click",event=>{
    // The phone's tabs (SPEC-155): the stage or the talk, without a step of the history.
    const tab=event.target.closest?.(".tab[data-nx-tab]");
    if(tab&&ws&&parts.tabs?.contains(tab)){event.preventDefault();ws.dataset.nxTab=tab.dataset.nxTab;return;}
    const control=event.target.closest?.("[data-nx-act]"),inside=control&&[parts.stage,parts.side,parts.bars].some(element=>element?.contains(control));
    if(!control&&view.record&&event.target.closest?.(".scrim")){event.preventDefault();closeRecord(null);return;}
    if(!inside||control.disabled||control.getAttribute("aria-disabled")==="true")return;
    const act=control.dataset.nxAct;
    if(talk?.click(act,control,event))return;
    // Talk ({n}) from 1,024 to 1,279 pixels: the panel, with the focus on its heading.
    if(act==="talk"){
      event.preventDefault();
      if(view.record)closeRecord("talk");
      else if(ws){if(ws.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;else{ws.dataset.nxOpen="talk";parts.side.querySelector("#talk-h")?.focus();}}
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
  // Escape closes the record, else folds the talk's opened entry where the focus is in the talk
  // (SCR-114's actions), else folds the talk that Talk ({n}) opened (SCR-111's actions).
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    if(view.record){event.preventDefault();closeRecord();}
    else if(parts.side.contains(document.activeElement)&&talk?.escape())event.preventDefault();
    else if(ws?.dataset.nxOpen==="talk"){event.preventDefault();delete ws.dataset.nxOpen;document.querySelector('[data-nx-focus="talk"]')?.focus();}
  });
  // The talk reads again when the page comes back into view (SPEC-150).
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")talk?.readAgain();});
  // The back button and a link's address (rule 9).
  window.addEventListener("hashchange",()=>applyAddress().catch(()=>{}));
  window.addEventListener("popstate",()=>applyAddress().catch(()=>{}));

  // The controls that wait for the code (rule 15) work from here on.
  for(const control of document.querySelectorAll('[data-nx-wait="list"],[data-nx-wait="record"],[data-nx-wait="picture"],[data-nx-wait="talk"]')){control.disabled=false;control.removeAttribute("data-nx-wait");}
  // The address: the view and the step first, so that the first drawing of the code shows them,
  // then #filter=left from the first page's agent to-do (SCR-110) and #item=.
  if(pictured){
    const params=hash(),shown=params.get("view"),key=params.get("step");
    view.mode=shown==="list"||!shown&&params.has("filter")?"list":"picture";
    view.step=stage==="01-domain"&&STEPS.includes(key)?key:undefined;
  }
  // The talk (SCR-114), and the tab or the panel that shows it: the talk's, for an address that
  // names an entry or a fragment #talk, which the stylesheet followed until now; else the stage's.
  talk=createTalk({payload,view,api,drafts,lang,base,project,part:partName,stage,place,ws,side:parts.side,render,hash,applyAddress,refresh});
  if(ws){
    const params=hash(),toTalk=location.hash==="#talk"||["talk","comment","proposal"].some(key=>params.get(key));
    ws.dataset.nxTab=toTalk?"talk":"stage";
    if(location.hash==="#talk")ws.dataset.nxOpen="talk";
  }
  render();
  applyAddress().then(nearEnd).catch(()=>{});
  return{render,readQuery,readAgain,readPicture,loadMore,select,selectItem,openRecord,closeRecord,pass,withdraw,view,board,talk};
}
