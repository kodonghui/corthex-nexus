// The talk's code (SCR-114), in a stage page's side: reading the talk again after each write and
// when the page comes back into view (API-152, SPEC-150); the talk narrowed to the selected item
// (REQ-230); an entry opened with its replies or its change (API-114, API-115, API-116), from a
// press or from the address's talk=, or 0.2's comment= and proposal= (SPEC-154); an entry on an
// item selecting the item, talk= and item= one step of the browser's history (SPEC-209); the
// closed talk, 50 at a time; and the writes, a comment, a reply, settling, Mark answered, Accept,
// Dismiss, As recommended and dismissing a reflection (API-118 to API-120, API-124, API-125,
// API-127, API-159), each with its words and write ID kept in the browser until the server
// takes it (rules 4 and 5); in the selected item's panel (SCR-115) its talk, whose box may name
// one of the item's discrepancies. The stage page (./stage.js) draws, follows the address and
// calls in.
import {TALK_LIMIT,leftOf,entryOf,talkGroups,itemsOf,narrowTalk} from "../src/draw/talk.js";
import {stagePath} from "../src/draw/stages.js";
import {label,labels,codeMessage} from "../src/draw/words.js";
import {words} from "./messages.js";
import {LatestReads,PendingWrites,characters} from "./state.js";
import {fragment} from "./data.js";

const PERMISSION=Object.freeze(["user_only","access_missing","access_other_app","no_kind"]);
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
// After these the entry is gone, or its place, and the talk reads again (SCR-114#gone).
const GONE=Object.freeze(["comment_not_found","proposal_not_found","edit_not_found","project_not_found","space_not_found","part_not_found","discrepancy_not_found"]);
const STATES=Object.freeze(["open","accepted","dismissed","withdrawn"]);
const ENTRY=/^n[cpe]_[0-9a-hjkmnp-tv-z]{12}$/,TRACE=/^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;
const TARGETS=Object.freeze(["talk","comment","proposal"]);
const MAX_PAGES=25;
const readable=answer=>Boolean(answer&&answer.mine&&Array.isArray(answer.mine.entries)&&answer.agent&&Array.isArray(answer.agent.entries)&&answer.apart&&Array.isArray(answer.apart.entries)&&answer.closed);

// whole() says that the side shows the stage's whole talk although an item is selected (SCR-115's
// switch); selected() is the selected item; onDiscrepancyGone() reads the item again after a
// comment on one of its discrepancies found it resolved.
export function createTalk({payload,view,api,drafts,lang,base,project,part,stage,place,ws,side,render,hash,applyAddress,refresh,whole:wholeShown=()=>false,selected=()=>null,onDiscrepancyGone=()=>{}}){
  const reads=new LatestReads(),writes=new PendingWrites();
  // shown is what the side draws: the talk as read, narrowed or not, with the answered entries
  // kept in their places (choice 19); the rest is each part's state.
  const newBox=()=>({sending:false,note:null,left:null,over:false,empty:true,discrepancy:null});
  const st=view.talkState={shown:null,narrow:null,item:null,open:null,threads:{},entries:{},replies:{},box:newBox(),closed:{open:false,entries:null,total:null,more:null},notes:[],updating:false};
  // The box's state of each target, the selected item or the stage as a whole, so that a comment
  // on its way stays with the target that it was left on (BUG-623).
  const kept=new Map(),filled=new WeakSet(),boxes=new Map();
  // back is the entry picked in the stage's whole talk, to return to; shownBy says that an
  // entry opened the folded talk, which folds again when the entry closes; reply is an entry
  // whose reply box takes the focus once it opens.
  let back=null,shownBy=null,reply=null;

  const whole=()=>payload.talk;
  const current=()=>st.item?st.narrow||narrowTalk(whole()||{},st.item):whole();
  const boxScope=()=>`${project}:comment:${place}:${st.item||""}`;
  boxes.set(boxScope(),st.box);
  const boxOf=scope=>{if(!boxes.has(scope))boxes.set(scope,newBox());return boxes.get(scope);};
  const replyScope=id=>`${project}:reply:${id}`;
  const actScope=(act,id)=>`${project}:${act==="dismiss"?"dismiss-proposal":act}:${id}`;
  function talkUrl({item=st.item,closed=false,after=0}={}){
    const query=new URLSearchParams();
    if(item)query.set("item",item);
    if(closed)query.set("closed","1");
    if(after)query.set("after",String(after));
    const rest=query.toString();
    return `${base}/talk/${encodeURIComponent(part||"_")}/${encodeURIComponent(stage)}${rest?"?"+rest:""}`;
  }
  const element=id=>side.querySelector(`li[data-nx-entry="${CSS.escape(id)}"]`);
  const draw=(names=["side"])=>render(names);
  // A new address that the page then follows: a step of the browser's history with push, else
  // in the place of this one.
  function go(params,push=false){
    const rest=fragment(params);
    history[push?"pushState":"replaceState"](history.state,"",location.pathname+location.search+(rest?"#"+rest:""));
    return applyAddress();
  }

  // What the side draws (./stage.js calls it before it draws the side).
  function sync(){
    const talk=current();
    if(!talk){st.shown=null;return;}
    const mine=[...(talk.mine?.entries||[])],ids=new Set(mine.map(row=>entryOf(row).id));
    for(const [id,{index,row}] of kept)if(!ids.has(id))mine.splice(Math.min(index,mine.length),0,row);
    st.shown={...talk,mine:{...talk.mine,entries:mine}};
  }
  // The characters of a box: how many are left from 90 per cent, over the limit, or nothing.
  function measure(text,into){
    const n=characters(text),next={left:leftOf(n),over:n>TALK_LIMIT,empty:!String(text).trim()};
    const changed=next.left!==into.left||next.over!==into.over||next.empty!==into.empty;
    Object.assign(into,next);return changed;
  }
  // The words that the browser keeps, in each box that the drawing made new (rule 5); true when
  // a box's state changed, so that the side draws again.
  function fill(){
    let changed=false;
    const box=side.querySelector("#talk-text");
    if(box&&!filled.has(box)){filled.add(box);const draft=drafts.read(boxScope());if(draft.text&&!box.value)box.value=draft.text;box.readOnly=Boolean(st.box.sending);changed=measure(box.value,st.box)||changed;}
    for(const li of side.querySelectorAll("li[data-nx-entry]")){
      const id=li.dataset.nxEntry,area=li.querySelector(':scope > .rbox textarea[name="reply"]'),check=li.querySelector(':scope > .rbox input[name="settles"]');
      if(area&&!filled.has(area)){filled.add(area);const draft=drafts.read(replyScope(id));if(draft.text&&!area.value)area.value=draft.text;changed=measure(area.value,st.replies[id]||(st.replies[id]={}))||changed;}
      if(check&&!filled.has(check)){filled.add(check);check.checked=drafts.read(replyScope(id)).settles;}
    }
    if(reply){const area=element(reply)?.querySelector('textarea[name="reply"]');if(area){reply=null;area.focus({preventScroll:true});}}
    return changed;
  }

  // An entry in what the talk shows, with its group.
  function locate(id){
    const talk=st.shown||current();
    if(!talk||!id)return null;
    const groups=talkGroups(talk);
    for(const key of["mine","agent","apart"]){const entry=groups[key].find(e=>e.id===id);if(entry)return{entry,group:key};}
    const closed=(st.closed.entries||[]).map(row=>entryOf(row)).find(e=>e.id===id);
    return closed?{entry:closed,group:"closed"}:null;
  }
  const rowOf=entry=>entry.type==="proposal"?{kind:"proposal",comment:null,proposal:entry.proposal}:{kind:"comment",comment:entry.comment,proposal:null};
  function keep({entry,group}){
    if(group!=="mine"||kept.has(entry.id))return;
    const index=(st.shown?.mine?.entries||[]).findIndex(row=>entryOf(row).id===entry.id);
    kept.set(entry.id,{index:index<0?Infinity:index,row:rowOf(entry)});
  }

  // A reading that failed: rule 7's sign-in, a refusal with its trace ID, or "Could not update"
  // with Try again (SCR-114#error, #permission).
  function readFailed(error){
    const code=error?.code||"internal";
    const note=code==="sign_in_expired"?{tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true}
      :PERMISSION.includes(code)?{tone:"warn",text:codeMessage(code,lang),trace:error?.traceId}
      :{tone:"err",text:codeMessage("Could not update",lang),trace:error?.traceId,retry:"read-talk"};
    st.notes=[...st.notes.filter(n=>n.kind!=="read"),{kind:"read",...note}];
  }
  // Reading again (rule 6): the talk as the user sees it, narrowed or not, with as much of the
  // closed talk as is open; narrowed, the stage's whole talk too, whose counts the head and the
  // tabs show; then the opened entry, whose new replies say "New".
  async function readAgain(){
    const item=st.item,want=st.closed.open?Math.max(st.closed.entries?.length||0,1):0;
    st.updating=true;draw();
    try{
      const tasks=[reads.run("talk",async()=>{
        const answer=await api.call("GET",talkUrl({item,closed:Boolean(want)}));
        if(!readable(answer))throw new Error("Unreadable answer");
        const closed=[...(answer.closed.entries||[])];
        for(let page=1;want&&closed.length<want&&closed.length<answer.closed.total&&page<MAX_PAGES;page++){
          const next=await api.call("GET",talkUrl({item,closed:true,after:closed.length}));
          if(!readable(next)||!next.closed.entries?.length)break;
          closed.push(...next.closed.entries);
        }
        return{answer,closed};
      },({answer,closed})=>{
        if(item!==st.item)return;
        if(item)st.narrow=answer;else payload.talk=answer;
        st.closed={...st.closed,total:answer.closed.total,...(want?{entries:closed,more:null}:{})};
      })];
      if(item)tasks.push(reads.run("whole",()=>api.call("GET",talkUrl({item:null})),answer=>{if(readable(answer))payload.talk=answer;}));
      // Both readings end before the talk says how it went, so that one's success does not
      // clear the other's failure.
      const failure=(await Promise.allSettled(tasks)).find(result=>result.status==="rejected");
      if(failure)readFailed(failure.reason);else st.notes=st.notes.filter(n=>n.kind!=="read");
    }catch(error){readFailed(error);}
    finally{st.updating=false;draw(["stage","side","tabs"]);}
    // An entry that the server answered gone is not read again by itself (BUG-619): only a
    // press opens it again, so that a removed project's page does not ask without end.
    if(st.open&&locate(st.open)&&!st.threads[st.open]?.gone)await openThread(st.open,true);
  }
  // The talk of the selected item (SCR-114#narrowed): at once from the page's talk, then as the
  // server reads it; no item, the stage's whole talk.
  async function narrow(item){
    if(item===st.item)return;
    st.item=item;st.narrow=null;kept.clear();
    // A page of the closed talk still on its way is the item's before: it is dropped (BUG-620).
    reads.invalidate("closed");
    st.closed={open:false,entries:null,total:null,more:null};
    // The target's own box: one whose comment is still on its way keeps it (BUG-623).
    st.box=boxOf(boxScope());if(!st.box.sending){st.box.note=null;st.box.discrepancy=null;}
    if(!item){draw();return;}
    st.updating=true;draw();
    try{
      await reads.run("talk",()=>api.call("GET",talkUrl({item})),answer=>{
        if(!readable(answer))throw new Error("Unreadable answer");
        if(st.item===item){st.narrow=answer;st.closed.total=answer.closed.total;}
      });
      st.notes=st.notes.filter(n=>n.kind!=="read");
    }catch(error){if(st.item===item)readFailed(error);}
    finally{st.updating=false;draw();}
  }
  // The closed talk, 50 at a time from after (SCR-114's actions); true when a page came.
  async function readClosed(after){
    st.closed.more="loading";draw();
    let done=false;
    try{
      await reads.run("closed",()=>api.call("GET",talkUrl({closed:true,after})),answer=>{
        if(!readable(answer))throw new Error("Unreadable answer");
        const list=after?[...(st.closed.entries||[]),...(answer.closed.entries||[])]:[...(answer.closed.entries||[])];
        st.closed={...st.closed,entries:list,total:answer.closed.total,more:null};done=true;
      });
    }catch{st.closed.more="failed";}
    finally{if(st.closed.more==="loading")st.closed.more=null;draw();}
    return done;
  }
  function toggleClosed(){
    st.closed.open=!st.closed.open;
    if(st.closed.open&&!st.closed.entries)readClosed(0);else draw();
  }

  // An opened entry's thread (API-114) or proposal (API-115, and API-116 for a reflection that
  // the talk no longer lists). Read again quietly, its last state stays while the read runs.
  async function openThread(id,quiet=false){
    const found=locate(id);if(!found)return;
    const {entry}=found,was=st.threads[id];
    if(!quiet||!was||was.state!=="ready"){st.threads[id]={state:"loading",seen:was?.seen};draw();}
    try{
      await reads.run("thread",async()=>{
        if(entry.type==="comment")return{data:await api.call("GET",`${base}/comments/${encodeURIComponent(id)}`),edit:null};
        const proposal=entry.proposal?.id;
        const data=await api.call("GET",`${base}/proposals/${encodeURIComponent(proposal)}`);
        let edit=entry.edit||(whole()?.reflections||[]).find(row=>row.id===data.edit)||null;
        if(!edit&&data.edit){try{edit=await api.call("GET",`${base}/edits/${encodeURIComponent(data.edit)}`);}catch{edit=null;}}
        return{data,edit};
      },({data,edit})=>{
        const seen=was?.seen||(Array.isArray(data.replies)?data.replies.map(row=>row.seq):[]);
        st.threads[id]={state:"ready",data,edit,seen};
      });
    }catch(error){
      const code=error?.code||"internal";
      // An entry removed while open: the same words in its place, and the talk reads again.
      if(GONE.includes(code)){st.threads[id]={state:"ready",data:{},seen:was?.seen,gone:true};st.entries[id]={...st.entries[id],note:{tone:"warn",text:codeMessage(code,lang),trace:error?.traceId}};keep(found);draw();readAgain();return;}
      st.threads[id]={state:"failed",trace:error?.traceId,seen:was?.seen};
    }
    draw();
  }
  // The folded talk shows for as long as an entry is open: the Talk tab under 1,024 pixels and
  // the panel from 1,024 to 1,279 (SPEC-210).
  // An entry opened in the item's panel on the Item tab keeps that tab in front.
  function showTalk(on){
    if(!ws)return;
    if(on){if(ws.dataset.nxTab!=="item")ws.dataset.nxTab="talk";if(!ws.dataset.nxOpen){ws.dataset.nxOpen="talk";shownBy="entry";}}
    else if(shownBy==="entry"){if(ws.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;shownBy=null;}
  }
  // The user's own Talk ({n}), Close or press in the talk: the panel stays as the user leaves it.
  const own=()=>{shownBy=null;};
  // An entry in sight, and the focus on the press that opens it.
  function reveal(id,focus=true){
    requestAnimationFrame(()=>{const li=element(id);if(!li||!li.getClientRects().length)return;li.scrollIntoView({block:"nearest"});if(focus)li.querySelector(":scope > .hd .ref")?.focus({preventScroll:true});});
  }
  // A message at the top of the talk: an address that names an entry not on the server.
  function gone(code,trace){st.notes=[...st.notes.filter(n=>n.kind!=="gone"),{kind:"gone",tone:"warn",text:codeMessage(code,lang),trace}];}
  // The entry that an address names when the talk does not show it: not on the server, gone; on
  // another stage, that stage's talk; closed, unfolded in the closed talk (SPEC-154); open on
  // another item than the selected one, with its own item.
  async function find(id){
    const kind=id.startsWith("nc_")?"comments":id.startsWith("np_")?"proposals":null;
    if(!kind){gone("edit_not_found");return;}
    let data;
    try{data=await api.call("GET",`${base}/${kind}/${encodeURIComponent(id)}`);}
    catch(error){
      const code=error?.code||"internal";
      if(GONE.includes(code))gone(code,error?.traceId);else st.notes=[...st.notes.filter(n=>n.kind!=="gone"),{kind:"gone",tone:"err",text:words("Could not load",lang).split(lang==="ko"?" 또는: ":" Or: ")[kind==="comments"?0:1],trace:error?.traceId}];
      return;
    }
    if((data.part??"")!==(part??"")||data.stage!==stage){location.replace(stagePath(project,data.part,data.stage)+"#talk="+encodeURIComponent(id));return;}
    if(data.state!=="open"){
      st.closed.open=true;
      if(!st.closed.entries)await readClosed(0);
      for(let page=0;!locate(id)&&(st.closed.entries?.length||0)<(st.closed.total||0)&&page<MAX_PAGES;page++)if(!await readClosed(st.closed.entries.length))break;
      if(!locate(id)){st.closed.entries=[kind==="comments"?{kind:"comment",comment:data,proposal:null}:{kind:"proposal",comment:null,proposal:data},...(st.closed.entries||[])];draw();}
      return;
    }
    const items=kind==="comments"?(data.item?[data.item]:[]):(data.items||[]);
    if(st.item&&!items.includes(st.item)){
      const params=hash();if(items.length)params.set("item",items[0]);else params.delete("item");
      await go(params);return "moved";
    }
    // Not in the talk as the page read it, such as one left since: the talk reads again, and an
    // entry that it still does not list shows on its own.
    await readAgain();
    if(locate(id))return;
    kept.set(id,{index:Infinity,row:kind==="comments"?{kind:"comment",comment:{...data,replies:(data.replies||[]).length,last_reply:null,proposals:[],claim:null},proposal:null}:{kind:"proposal",comment:null,proposal:data}});
    draw();
  }

  // The address's item, unless the side shows the stage's whole talk beside it.
  const narrowedTo=params=>{const raw=params.get("item");return raw&&raw.length<=30&&TRACE.test(raw)&&!wholeShown()?raw:null;};
  // The address, after the stage followed its view, filter and item (./stage.js): the talk of
  // the address's item, and the entry that talk=, comment= or proposal= names, open and in sight.
  async function follow(params){
    const item=narrowedTo(params);
    const target=TARGETS.map(key=>params.get(key)).find(Boolean)||null;
    st.notes=st.notes.filter(n=>n.kind!=="gone"&&n.kind!=="write");
    await narrow(item);
    if(target&&ENTRY.test(target)){
      // Reply opens the entry with the focus in its reply box, which fill() gives it.
      const answering=reply===target;
      showTalk(true);
      if(!locate(target)&&await find(target)==="moved")return;
      if(!locate(target)){st.open=null;draw();return;}
      const was=st.open;st.open=target;
      if(was!==target||!st.threads[target]||st.threads[target].state==="failed")await openThread(target);else draw();
      reveal(target,!answering);
      return;
    }
    if(target)gone(target.startsWith("np_")?"proposal_not_found":"comment_not_found");
    const was=st.open;st.open=null;showTalk(false);draw();
    // Back in the stage's whole talk, the entry picked there in sight with the focus on it.
    if(back&&!st.item){const id=back;back=null;reveal(id);}
    else if(was&&!target)reveal(was);
  }
  // Opening or folding an entry (SCR-114's actions): open, its address holds talk=, and item=
  // too for an entry on an item, one step of the browser's history (SPEC-209); an entry apart
  // or on the stage as a whole selects nothing. Folding, the address leaves talk=.
  function toggle(id,{answer=false}={}){
    const found=locate(id);if(!found)return;
    const params=hash();own();
    if(st.open===id){
      if(answer){reply=id;fill();return;}
      for(const key of TARGETS)params.delete(key);
      go(params).catch(()=>{});return;
    }
    for(const key of TARGETS)params.delete(key);
    params.set("talk",id);
    // An entry on several items selects the selected one when it is among them, else its first.
    const items=itemsOf(found.entry),chosen=st.item||selected();
    if(found.group!=="apart"&&items.length){if(!st.item)back=id;params.set("item",items.includes(chosen)?chosen:items[0]);}
    if(answer)reply=id;
    const rest=fragment(params);
    history.pushState(history.state,"",location.pathname+location.search+"#"+rest);
    history.replaceState({...(history.state||{}),nexusTalk:location.hash},"",location.href);
    applyAddress().catch(()=>{});
  }
  // All talk of the stage: as the back button, after an entry picked in the whole talk; else
  // the address without its item, a step of its own.
  function showWhole(){
    if(history.state?.nexusTalk&&history.state.nexusTalk===location.hash&&back){history.back();return null;}
    const params=hash();params.delete("item");
    if(st.open)back=st.open;
    for(const key of TARGETS)params.delete(key);
    return go(params,true).catch(()=>{});
  }

  // A write that failed, by its code (SCR-114#stale, #error, #permission and #gone): its message
  // where it was sent, the words kept, and Try again where trying again can help, with the same
  // write ID; true when the talk reads again.
  function failed(error,scope,act,into,found){
    const code=error?.code||"internal",trace=error?.traceId;
    if(code==="sign_in_expired"){into.note={tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true};return false;}
    if(code==="proposal_not_open"&&found){const at=STATES.indexOf(error.state);into.done=true;into.mark=at===1?0:at===2?1:undefined;keep(found);into.note={tone:"info",text:codeMessage(code,lang,{state:at<0?String(error.state||""):labels("Proposal states",lang)[at]})};return true;}
    if(code==="edit_state"){into.note={tone:"info",text:codeMessage(code,lang,{state:String(error.state||"")}),trace};return true;}
    if(code==="not_recommended"&&found){into.done=true;keep(found);into.note={tone:"info",text:codeMessage(code,lang)};return true;}
    if(GONE.includes(code)){if(found&&found.group==="mine"){into.done=true;keep(found);}into.note={tone:"err",text:codeMessage(code,lang),trace};return true;}
    if(PERMISSION.includes(code)){into.note={tone:"warn",text:codeMessage(code,lang),trace};return false;}
    if(code==="cross_site"){into.note={tone:"err",text:codeMessage(code,lang),trace,here:location.origin+location.pathname+location.search+location.hash};return false;}
    if(code==="write_id_reused")drafts.renew(scope);
    if(code==="reply_limit"){into.note={tone:"err",text:codeMessage(code,lang,{limit:Number(error?.limit??"")||""}),trace,newComment:true};return false;}
    into.note={tone:"err",text:codeMessage(CONNECTION[code]||code,lang,{limit:Number(error?.limit??TALK_LIMIT).toLocaleString("en-US")}),trace,...(code==="text_too_long"?{}:{retry:act})};
    return false;
  }
  // A write's follow-up: the talk reads again, and the stage, whose items and marks show the talk.
  const after=()=>Promise.all([readAgain(),refresh()]);

  // Accept, Dismiss or As recommended, and dismissing a reflection: the answer in place, kept
  // among the talk's entries (choice 19). A checkpoint request passes in the stage record.
  async function answer(id,act){
    const found=locate(id);if(!found)return;
    const es=st.entries[id]||(st.entries[id]={}),scope=actScope(act,id);
    if(es.sending||es.done||writes.has(scope))return;
    const url=act==="accept"||act==="dismiss"?`${base}/proposals/${encodeURIComponent(id)}/${act}`:act==="recommended"?`${base}/comments/${encodeURIComponent(id)}/recommended`:act==="dismiss-edit"?`${base}/edits/${encodeURIComponent(id)}/dismiss`:null;
    if(!url)return;
    const draft=drafts.ensure(scope);
    es.sending=act;es.note=null;draw();
    let again=false;
    try{
      const result=await writes.run(scope,()=>api.call("POST",url,{body:{},write:draft.write}));
      drafts.clear(scope,draft.write);again=true;
      // A dismissed reflection leaves the agent's turn when the talk reads again; the note above
      // the talk says what became of it.
      if(act==="dismiss-edit")st.notes=[...st.notes.filter(n=>n.kind!=="write"),{kind:"write",tone:"info",text:words(result?.changed===false?"Already dismissed":"Reflection dismissed",lang)}];
      else{
        es.done=true;es.mark=act==="accept"?0:act==="dismiss"?1:2;keep(found);
        if(result?.changed===false)es.note={tone:"info",text:label("Done already",0,lang)};
      }
    }catch(error){
      again=failed(error,scope,act,es,found);
      // A reflection that changed or left meanwhile may leave the agent's turn once the talk
      // reads again, so its message goes above the talk, as the dismissal's does.
      if(act==="dismiss-edit"&&again&&es.note){st.notes=[...st.notes.filter(n=>n.kind!=="write"),{kind:"write",...es.note}];es.note=null;}
    }
    finally{es.sending=null;draw();}
    if(again)await after();
  }
  // Leave (API-118): on the selected item, or on the stage as a whole.
  async function leave(){
    const box=side.querySelector("#talk-text"),state=st.box,scope=boxScope();
    if(!box)return;
    measure(box.value,state);
    if(state.sending||state.over||state.empty||writes.has(scope)){draw();return;}
    const draft=drafts.update(scope,{text:box.value}),item=st.item||"",discrepancy=item&&state.discrepancy;
    state.sending=true;state.note=null;box.readOnly=true;draw();
    // The box of this target as the side shows it now: a new one once the user went to another
    // target and back while the comment was on its way (BUG-623), else the box that sent it.
    const shown=()=>boxScope()===scope&&side.querySelector("#talk-text")||box;
    let again=false;
    try{
      await writes.run(scope,()=>api.call("POST",`${base}/comments`,{body:{part,stage,item,...(discrepancy?{discrepancy}:{}),text:draft.text},write:draft.write}));
      drafts.clear(scope,draft.write);
      const now=shown();
      if(now.value===draft.text)now.value="";
      now.removeAttribute("aria-invalid");measure(now.value,state);state.discrepancy=null;again=true;
    }catch(error){
      if(error?.code==="text_too_long"||error?.code==="invalid_request"&&error?.field==="text")shown().setAttribute("aria-invalid","true");
      again=failed(error,scope,"leave",state,null);
      // A discrepancy resolved meanwhile (SCR-115's state changes): the box names the item again,
      // with a new write ID for the comment without it, and the item reads again.
      if(error?.code==="discrepancy_not_found"){state.discrepancy=null;drafts.renew(scope);onDiscrepancyGone();}
    }
    finally{state.sending=false;box.readOnly=false;shown().readOnly=false;draw();}
    if(again)await after();
  }
  // Reply (API-119), with or without "This settles it", which on a closed comment opens it again.
  async function sendReply(id){
    const found=locate(id),li=element(id),box=li?.querySelector('textarea[name="reply"]'),check=li?.querySelector('input[name="settles"]');
    if(!found||found.entry.type!=="comment"||!box)return;
    const state=st.replies[id]||(st.replies[id]={}),scope=replyScope(id);
    measure(box.value,state);
    if(state.sending||state.over||state.empty||writes.has(scope)){draw();return;}
    const draft=drafts.update(scope,{text:box.value,settles:Boolean(check?.checked)});
    state.sending="reply";state.note=null;box.readOnly=true;draw();
    let again=false;
    try{
      await writes.run(scope,()=>api.call("POST",`${base}/comments/${encodeURIComponent(id)}/replies`,{body:{text:draft.text,...(draft.settles?{settles:true}:{})},write:draft.write}));
      drafts.clear(scope,draft.write);
      if(box.value===draft.text){box.value="";if(check)check.checked=false;}
      box.removeAttribute("aria-invalid");measure(box.value,state);again=true;
    }catch(error){
      if(error?.code==="text_too_long"||error?.code==="invalid_request"&&error?.field==="text")box.setAttribute("aria-invalid","true");
      again=failed(error,scope,"reply",state,null);
    }
    finally{state.sending=null;box.readOnly=false;draw();}
    if(again)await after();
  }
  // Mark answered (API-120): the comment closes as answered and folds into the closed talk. One
  // closed meanwhile in another tab folds too, with "This comment was already closed." above
  // the talk, since its entry leaves the open talk (SCR-114#stale).
  async function markAnswered(id){
    const found=locate(id);if(!found||found.entry.type!=="comment")return;
    const state=st.replies[id]||(st.replies[id]={}),scope=actScope("answered",id);
    if(state.sending||writes.has(scope))return;
    const draft=drafts.ensure(scope);
    state.sending="answered";state.note=null;draw();
    let again=false,fold=false,already=false;
    try{
      const result=await writes.run(scope,()=>api.call("POST",`${base}/comments/${encodeURIComponent(id)}/answered`,{body:{},write:draft.write}));
      drafts.clear(scope,draft.write);again=true;fold=true;already=result?.changed===false;
    }catch(error){again=failed(error,scope,"answered",state,null);}
    finally{state.sending=null;draw();}
    if(fold&&st.open===id){const params=hash();for(const key of TARGETS)params.delete(key);await go(params);}
    if(already){st.notes=[...st.notes.filter(n=>n.kind!=="write"),{kind:"write",tone:"info",text:words("Already closed",lang)}];draw();}
    if(again)await after();
  }
  // "Leave a new comment" after reply_limit: the reply's words in the stage's box.
  function newComment(id){
    const li=element(id),text=li?.querySelector('textarea[name="reply"]')?.value||drafts.read(replyScope(id)).text,box=side.querySelector("#talk-text");
    drafts.update(boxScope(),{text});
    if(box){box.value=text;measure(text,st.box);draw();side.querySelector("#talk-text")?.focus();}
  }

  return{
    sync,fill,follow,readAgain,showWhole,
    // The entry that is open, if any.
    opened:()=>st.open,
    // The switch between the item and the whole talk (SCR-115): the talk as the side shows it now.
    async renarrow(){await narrow(narrowedTo(hash()));},
    // "Comment on this discrepancy" (SCR-115, SPEC-126): the box names it, or the item again when
    // pressed twice, with a new write ID, since the comment changes; the focus in the box.
    target(id){
      if(!st.item||typeof id!=="string")return;
      st.box.discrepancy=st.box.discrepancy===id?null:id;st.box.note=null;
      drafts.renew(boxScope());draw();
      side.querySelector("#talk-text")?.focus();
    },
    // The talk's presses, from ./stage.js's one listener: true when the talk took it.
    click(act,control,event){
      const id=control.closest("[data-nx-entry]")?.dataset.nxEntry;
      switch(act){
        case "entry":toggle(id);return true;
        case "reply-open":toggle(id,{answer:true});return true;
        case "accept":case "dismiss":case "recommended":case "dismiss-edit":answer(id,act);return true;
        case "reply":sendReply(id);return true;
        case "answered":markAnswered(id);return true;
        case "reload-entry":openThread(id);return true;
        case "new-comment":newComment(id);return true;
        case "leave":leave();return true;
        case "whole":showWhole();return true;
        case "turn":event.preventDefault();side.querySelector("#t-"+CSS.escape(control.dataset.nxTurn||""))?.scrollIntoView({block:"start"});return true;
        case "closed":toggleClosed();return true;
        case "closed-more":readClosed(st.closed.entries?.length||0);return true;
        case "read-talk":readAgain();return true;
        // Talk ({n}) in the stage's head, and the control that folds the talk from 1,280 pixels
        // (SPEC-210), which ./stage.js runs.
        case "talk":case "fold-talk":own();return false;
        case "talk-close":
          event.preventDefault();own();
          if(ws&&ws.dataset.nxOpen==="talk")delete ws.dataset.nxOpen;
          document.querySelector('[data-nx-focus="talk"]')?.focus();
          return true;
      }
      return false;
    },
    // What the user types: the words and "This settles it" into the browser's storage at once.
    input(event){
      const target=event.target;
      if(target?.id==="talk-text"){drafts.update(boxScope(),{text:target.value});target.removeAttribute("aria-invalid");if(measure(target.value,st.box))draw();return true;}
      if(target?.name!=="reply"&&target?.name!=="settles")return false;
      const li=target.closest("li[data-nx-entry]"),id=li?.dataset.nxEntry;
      if(!id)return false;
      const area=li.querySelector('textarea[name="reply"]'),check=li.querySelector('input[name="settles"]');
      drafts.update(replyScope(id),{text:area?.value||"",settles:Boolean(check?.checked)});
      if(target.name==="reply")target.removeAttribute("aria-invalid");
      if(measure(area?.value||"",st.replies[id]||(st.replies[id]={})))draw();
      return true;
    },
    // Escape folds the opened entry and keeps the focus on it.
    escape(){if(!st.open)return false;toggle(st.open);return true;},
  };
}
