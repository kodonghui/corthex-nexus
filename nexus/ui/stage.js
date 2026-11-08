// A stage page's code (SCR-111 and SCR-113, and SCR-112's list until TASK-275 draws its
// picture): the filters, the search in the stage, the grouping and the next 200 items (API-158),
// an address's #filter=left and #item=, and the stage record, where the user passes the
// checkpoint or withdraws one passed in NEXUS (API-128, API-129). It draws with the server's
// own functions (../src/draw/page.js): the stage's middle and the side are compared element by
// element (./reconcile.js), so that the focus, the words and the messages stay where they are,
// and the list of stages and the bars are replaced when their drawing changes.
import {drawParts} from "../src/draw/page.js";
import {FILTERS,GROUPS,WORDS_LIMIT} from "../src/draw/stage.js";
import {day} from "../src/draw/html.js";
import {codeMessage} from "../src/draw/words.js";
import {ApiClient,Drafts,LatestReads,PendingWrites,characters} from "./state.js";
import {reconcile} from "./reconcile.js";

const PERMISSION=Object.freeze(["user_only","access_missing","access_other_app"]);
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
// After these the record reads again (SCR-112#error and #stale).
const GONE=Object.freeze(["part_not_found","space_not_found","checkpoint_not_found","project_not_found"]);
const SEARCH_WAIT=250,MAX_PAGES=25;
const readable=answer=>Boolean(answer?.project&&answer.head&&answer.record&&Array.isArray(answer.stages)&&answer.items&&Array.isArray(answer.items.entries));

export function startStage(payload,{api=new ApiClient(location.origin),drafts=new Drafts(),localize=()=>{}}={}){
  const lang=payload.lang,reads=new LatestReads(),writes=new PendingWrites();
  const part=name=>document.querySelector(`[data-nx-part="${name}"]`);
  const parts={stage:part("stage"),side:part("side"),rail:part("rail"),bars:part("bars")},ws=document.querySelector(".ws");
  const first=payload.data,project=first.project.name,stage=first.stage,partName=first.part,place=[project,partName||"_",stage].map(encodeURIComponent).join("/");
  const base=`/api/spaces/${encodeURIComponent(project)}`;
  // The drafts of 0.2's stage overview, so that its words and write IDs carry over (rule 5).
  const passScope=`${project}:checkpoint:${place}`,withdrawScope=id=>`${project}:withdraw-checkpoint:${id}`;
  const view={code:true,query:{filter:first.items.filter,group:first.items.group,q:first.items.q??""},entries:null,selected:null,more:null,updating:false,notice:null,pushed:null,signIn:false,record:false,recordState:{sending:null,note:null,passNote:null,left:null,over:false}};
  // What the list of stages and the bars show, which the code replaces when it changes.
  const shown=new Map(Object.entries(drawParts(payload)).filter(([name])=>name==="rail"||name==="bars"));
  let reading=0,searchTimer=0,opener="record",before=null;

  const data=()=>payload.data;
  const entries=()=>view.entries||data().items.entries;
  const applied=()=>({filter:data().items.filter,group:data().items.group,q:data().items.q??""});
  const same=(a,b)=>a.filter===b.filter&&a.group===b.group&&a.q===b.q;
  const textarea=()=>parts.side.querySelector("#cp-words");
  function stageUrl(query,after=0){
    const params=new URLSearchParams({filter:query.filter,group:query.group});
    if(query.q)params.set("q",query.q);
    if(after)params.set("after",String(after));
    return `${base}/stages/${encodeURIComponent(partName||"_")}/${encodeURIComponent(stage)}?${params}`;
  }

  function render(names=["stage","side","rail","bars"]){
    const active=document.activeElement,focus=active?.closest?.("[data-nx-focus]")?.dataset.nxFocus??null;
    const drawn=drawParts(payload,view);
    for(const name of names){
      const element=parts[name];if(!element)continue;
      if(name==="rail"||name==="bars"){if(shown.get(name)!==drawn[name]){element.innerHTML=drawn[name];shown.set(name,drawn[name]);}}
      else{const template=document.createElement("template");template.innerHTML=drawn[name];reconcile(element,template.content);}
      localize(element);
    }
    // A control that the drawing replaced: the same one again (stage 08's rule 3).
    if(focus&&!document.body.contains(active))document.querySelector(`[data-nx-focus="${CSS.escape(focus)}"]`)?.focus({preventScroll:true});
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
        if(newer(answer)){view.query=applied();return;}
        payload.data=answer;view.entries=null;settled();
        const list=listElement();if(list)list.scrollTop=0;
      });
    }catch(error){failed(error);}
    finally{reading--;view.updating=reading>0;render();}
  }
  // Reading again (rule 6), after a write and on Try again: as many items as the list holds.
  async function readAgain(){
    const query=applied(),want=Math.max(entries().length,1);
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
  const refresh=()=>same(view.query,applied())?readAgain():readQuery();
  // The next 200, when the list's end comes into view (SCR-113's actions).
  async function loadMore(){
    const list=entries(),total=Number(data().items.total)||0;
    // A newer push keeps the list as it is drawn until Load again (SCR-113#stale).
    if(reading||view.pushed||view.more==="loading"||list.length>=total)return false;
    const query=applied();
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
  const hash=()=>new URLSearchParams(location.hash.replace(/^#/,""));
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
    const control=event.target.closest?.("[data-nx-act]"),inside=control&&[parts.stage,parts.side,parts.bars].some(element=>element?.contains(control));
    if(!control&&view.record&&event.target.closest?.(".scrim")){event.preventDefault();closeRecord(null);return;}
    if(!inside||control.disabled||control.getAttribute("aria-disabled")==="true")return;
    const act=control.dataset.nxAct;
    if(act==="talk"){event.preventDefault();if(view.record)closeRecord("talk");else if(ws){if(ws.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;else ws.dataset.nxOpen="talk";}return;}
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
  parts.side.addEventListener("input",event=>{
    if(event.target?.id!=="cp-words")return;
    drafts.update(passScope,{text:event.target.value});event.target.removeAttribute("aria-invalid");
    counter();render(["side"]);
  });
  parts.stage.addEventListener("scroll",nearEnd,true);
  // Escape closes the record, else folds the talk that Talk ({n}) opened (SCR-111's actions).
  document.addEventListener("keydown",event=>{
    if(event.key!=="Escape")return;
    if(view.record){event.preventDefault();closeRecord();}
    else if(ws?.dataset.nxOpen==="talk"){event.preventDefault();delete ws.dataset.nxOpen;document.querySelector('[data-nx-focus="talk"]')?.focus();}
  });
  window.addEventListener("hashchange",()=>{const id=hash().get("item");if(id&&id!==view.selected)select(id);});

  // The controls that wait for the code (rule 15) work from here on.
  for(const control of document.querySelectorAll('[data-nx-wait="list"],[data-nx-wait="record"]')){control.disabled=false;control.removeAttribute("data-nx-wait");}
  render();
  // The address: #filter=left from the first page's agent to-do (SCR-110), then #item=.
  (async()=>{
    const params=hash(),filter=params.get("filter"),id=params.get("item");
    if(FILTERS.includes(filter)&&filter!==view.query.filter){view.query={...view.query,filter};await readQuery();}
    if(id)await select(id);
    nearEnd();
  })().catch(()=>{});
  return{render,readQuery,readAgain,loadMore,select,openRecord,closeRecord,pass,withdraw,view};
}
