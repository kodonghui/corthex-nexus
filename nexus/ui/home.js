// The first page's code (SCR-110): answers in place, a checkpoint request's pass with its words
// (SPEC-194, SPEC-196), reading again, the cards' order, 0.2's fragments on `/` (SPEC-143 to
// SPEC-145, SPEC-154) and the top bar's search (./search.js, SCR-116), whose words the address
// holds as q=. It draws with the server's own functions (../src/draw/home.js) and replaces only
// the elements whose drawing changed, so that the focus, the words and the messages stay where
// they are (stage 08's rules 3 to 8).
import {drawHome,talkPath,PASS_WORDS,passScope,wholeRequest,partGone} from "../src/draw/home.js";
import {path} from "../src/draw/html.js";
import {STAGE_KEYS,stagePath} from "../src/draw/stages.js";
import {label,labels,oldLabels,codeMessage} from "../src/draw/words.js";
import {ApiClient,Drafts,LatestReads,PendingWrites,characters,writeId} from "./state.js";
import {reconcile} from "./reconcile.js";
import {createSearch} from "./search.js";

const ORDER_KEY="nexus0.3:order";
const STATES=Object.freeze(["open","accepted","dismissed","withdrawn"]);
const GONE=Object.freeze(["proposal_not_found","comment_not_found","project_not_found","space_not_found"]);
// A refusal of who sent the request, which trying again cannot help (SCR-110#permission); no_kind
// comes only from Mark answered, which either side may write (API-120), as in the talk.
const PERMISSION=Object.freeze(["user_only","access_missing","access_other_app","no_kind"]);
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
// The fields of a pass that names what the entry showed: a refusal by one of them comes from a
// page of before the release, which Load again answers (SCR-110#error).
const SHOWN=Object.freeze(["commit","revision","comment","entry"]);
const PROJECT=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function storedOrder(){try{return globalThis.localStorage?.getItem(ORDER_KEY)==="push"?"push":"name";}catch{return"name";}}
function storeOrder(order){try{globalThis.localStorage?.setItem(ORDER_KEY,order);}catch{/* The order stays for this page only. */}}

// 0.2's fragments on `/` (SPEC-154): #q= opens the search (SCR-116), #p=&id= the item in its
// stage, or the search for the ID where no stage holds it, and #p=&s= that stage of the
// project's first part. search(words) opens the top bar's search; without it, the hub page's.
export async function followFragment(hash,data,api,go=target=>location.replace(target),search=words=>go("/hub#q="+encodeURIComponent(words))){
  const params=new URLSearchParams(String(hash||"").replace(/^#/,""));
  const project=params.get("p");
  if(project===null){if(params.has("q")){search(params.get("q"));return true;}return false;}
  if(!PROJECT.test(project)||project.length>100)return false;
  const id=params.get("id"),stage=params.get("s");
  if(id){
    try{
      const answer=await api.call("GET",path("api","spaces",project,"items",id));
      if(!STAGE_KEYS.includes(answer?.item?.stage))throw new Error("No stage");
      go(stagePath(project,answer.part,answer.item.stage)+"#item="+encodeURIComponent(id));
    }catch{search(id);}
    return true;
  }
  const card=data.projects.find(item=>item.name===project);
  go(stage&&STAGE_KEYS.includes(stage)?stagePath(project,card?.parts?.[0]?.name??"",stage):path("p",project));
  return true;
}

export function startHome(root,payload,{api=new ApiClient(location.origin),drafts=new Drafts(),localize=()=>{}}={}){
  const lang=payload.lang,writes=new PendingWrites(),reads=new LatestReads(),entries=new Map(),kept=new Map();
  let data=payload.data,list=data.my_turn.entries.slice(),notice=null,reading=0,order=storedOrder();
  const pushed={};
  const stateOf=id=>{if(!entries.has(id))entries.set(id,{writes:{}});return entries.get(id);};
  const cardOf=entry=>data.projects.find(item=>item.name===entry?.project)||null;
  const words=id=>root.querySelector(`#pw-${CSS.escape(id)}`);
  function render(){
    const active=document.activeElement,focus=root.contains(active)?active.closest("[data-nx-focus]")?.dataset.nxFocus:null;
    // A request whose words the browser kept shows them in its open box, so that no words that
    // a pass would send are hidden (rule 5).
    for(const entry of list){
      if(entry.asks!=="checkpoint"||!entry.request)continue;
      const state=stateOf(entry.id);if(state.checked)continue;
      state.checked=true;const scope=passScope(entry);
      if(drafts.has(scope)&&drafts.read(scope).text)state.words=true;
    }
    const template=document.createElement("template");
    template.innerHTML=drawHome(data,lang,{code:true,list,entries:Object.fromEntries(entries),pushed,notice,updating:reading>0,order});
    reconcile(root,template.content);
    localize(root);
    for(const box of root.querySelectorAll('textarea[name="words"]')){
      const entry=list.find(item=>item.id===box.closest("[data-nx-entry]")?.dataset.nxEntry);
      if(!entry)continue;
      const text=drafts.read(passScope(entry)).text;if(box.value!==text)box.value=text;
    }
    // A control that the drawing replaced: the same one again, else its entry's answer in
    // place or message, else the entry's first answer, such as the one being sent.
    if(focus&&!root.contains(active)){
      const entry=focus.split(":")[0],scope=root.querySelector(`[data-nx-entry="${CSS.escape(entry)}"]`);
      const next=root.querySelector(`[data-nx-focus="${CSS.escape(focus)}"]`)||root.querySelector(`[data-nx-focus="${CSS.escape(entry+":after")}"]`)||scope?.querySelector(".acts [data-nx-focus]");
      next?.focus({preventScroll:true});
    }
  }
  // Reading again (rule 6): after an answer, when the page comes back into view and on Try
  // again. Entries that stay drawn keep their places among the server's others.
  async function readAgain(){
    reading++;render();
    try{
      const applied=await reads.run("home",()=>api.call("GET","/api/home"),next=>{
        for(const item of next.projects){const was=data.projects.find(card=>card.name===item.name);if(was&&item.pushed_at!==was.pushed_at)pushed[item.name]=item.pushed_at;}
        const anchors=list.map((entry,index)=>[entry.id,index]).filter(([id])=>kept.has(id));
        list=next.my_turn.entries.filter(entry=>!kept.has(entry.id));
        for(const [id,index] of anchors)list.splice(Math.min(index,list.length),0,kept.get(id));
        data=next;
      });
      if(applied)notice=null;
    }catch(error){notice=error?.code==="sign_in_expired"?"sign-in":"unread";}
    // A pass refused for what its entry showed waits for this reading, which shows what is now.
    finally{reading--;for(const state of entries.values())state.reread=false;render();}
  }
  const keep=entry=>kept.set(entry.id,entry);
  // An answer's failure (SCR-110#stale, #error and #permission): its message under the entry,
  // which stays, and Try again where trying again can help, with the same write ID. A pass keeps
  // its words in the browser's storage (rule 5).
  function failed(entry,state,act,error){
    const code=error?.code||"internal",trace=error?.traceId,passing=act==="pass";
    if(code==="sign_in_expired"){notice="sign-in";return false;}
    if(passing){
      // What the entry showed changed (SCR-110#stale, SPEC-194), and nothing was recorded: my
      // turn reads again, and the entry shows the request and the commit as they are now, or
      // leaves my turn with a closed request; the next pass names what it then shows.
      if(code==="snapshot_changed"){
        const held=typeof error?.held_commit==="string"&&error.held_commit?error.held_commit.slice(0,7):null;
        state.note={tone:"warn",text:held?codeMessage(code,lang,{commit:held}):oldLabels(code,lang)[1],trace};state.reread=true;return true;
      }
      if(code==="request_changed"){state.note={tone:"warn",text:codeMessage(code,lang),trace};state.reread=true;return true;}
      // A pass that does not name what the entry showed comes from a page of before the release.
      if(code==="invalid_request"&&SHOWN.includes(error?.field)){state.note={tone:"err",text:codeMessage(code,lang),trace,load:true};return false;}
      // The words: by their box, marked; trying the same words again cannot help past the limit.
      if(code==="text_too_long"||code==="invalid_request"&&error?.field==="words"){
        state.words=true;state.note={tone:"err",box:true,text:codeMessage(code,lang,{limit:PASS_WORDS.toLocaleString("en-US")}),trace,...(code==="text_too_long"?{}:{retry:act})};
        queueMicrotask(()=>words(entry.id)?.setAttribute("aria-invalid","true"));return false;
      }
      // A full comment or space takes no reply that settles the request, so trying again cannot
      // help: the stage record passes without the request once it is marked answered in the talk.
      if(code==="reply_limit"||code==="space_full"){state.note={tone:"err",text:codeMessage(code,lang,{limit:Number(error?.limit??"")||""}),trace,open:talkPath(entry.project,entry.part,entry.stage,entry.id)};return false;}
    }
    if(code==="proposal_not_open"){
      const index=STATES.indexOf(error.state);
      state.done=true;state.mark=index===1?0:index===2?1:undefined;keep(entry);
      state.note={tone:"info",text:codeMessage(code,lang,{state:index<0?String(error.state||""):labels("Proposal states",lang)[index]})};
      return true;
    }
    if(code==="not_recommended"){state.done=true;keep(entry);state.note={tone:"info",text:codeMessage(code,lang)};return true;}
    if(GONE.includes(code)){state.done=true;keep(entry);state.note={tone:"err",text:codeMessage(code,lang),trace};return true;}
    // A part that the snapshot no longer holds has no page to open the request in: my turn reads
    // again, and the entry then shows why, with Mark answered (BUG-610).
    if(code==="part_not_found"){state.note={tone:"err",text:codeMessage(code,lang),trace};return true;}
    if(PERMISSION.includes(code)){state.note={tone:"warn",text:codeMessage(code,lang),trace};return false;}
    if(code==="cross_site"){state.note={tone:"err",text:codeMessage(code,lang),trace,here:location.origin+location.pathname+location.hash};return false;}
    if(code==="write_id_reused"){if(passing)drafts.renew(passScope(entry));else delete state.writes[act];}
    state.note={tone:"err",text:codeMessage(CONNECTION[code]||code,lang,{limit:error?.limit??""}),trace,retry:act};
    return false;
  }
  async function answer(id,act){
    const entry=list.find(item=>item.id===id),state=stateOf(id);
    if(!entry||state.done||writes.has(id)||!["accept","dismiss","recommended","answered"].includes(act))return;
    // Mark answered is offered only on an entry whose part the snapshot no longer holds (BUG-610).
    if(act==="answered"&&(entry.kind==="proposal"||!partGone(entry,cardOf(entry))))return;
    state.writes[act]??=writeId();state.sending=act;state.note=null;
    const project=encodeURIComponent(entry.project),target=encodeURIComponent(entry.id);
    const url=act==="recommended"||act==="answered"?`/api/spaces/${project}/comments/${target}/${act}`:`/api/spaces/${project}/proposals/${target}/${act}`;
    let again=false;
    const sent=writes.run(id,()=>api.call("POST",url,{write:state.writes[act]}));
    render();
    try{
      const result=await sent;
      state.done=true;keep(entry);again=true;
      state.mark=act==="accept"?0:act==="dismiss"?1:act==="recommended"?2:4;
      if(result?.changed===false)state.note={tone:"info",text:label("Done already",0,lang)};
    }catch(error){again=failed(entry,state,act,error);}
    finally{state.sending=null;render();}
    if(again)readAgain();
  }
  // The characters left of a pass's words, from 90 per cent of the limit (rule 5): true when what
  // the box shows of them changed.
  function counter(id,box){
    const state=stateOf(id),n=characters(box.value),left=n>=PASS_WORDS*.9&&n<=PASS_WORDS?PASS_WORDS-n:null,over=n>PASS_WORDS;
    const changed=left!==(state.left??null)||over!==Boolean(state.over);
    state.left=left;state.over=over;if(over)box.setAttribute("aria-invalid","true");
    return changed;
  }
  // "Add your words" (SCR-110's revision): the box opens in the entry, with the focus in it, and
  // stays open while it is there, so that no words that the pass sends are hidden.
  function openWords(id){
    const entry=list.find(item=>item.id===id),state=stateOf(id);
    if(!entry||state.done||state.words||!wholeRequest(entry,cardOf(entry))||partGone(entry,cardOf(entry)))return;
    state.words=true;render();
    words(id)?.focus();
  }
  // "Pass the stage {n} checkpoint" (SCR-110's revision, API-128): the pass names what the entry
  // showed (SPEC-194), the commit of the project's card or its revision where it names none, and
  // the request with the place of its last entry; the user's words, if any, settle the request,
  // and otherwise the button's words. driven is what navigator.webdriver says (SPEC-195).
  async function pass(id){
    const entry=list.find(item=>item.id===id),state=stateOf(id),card=cardOf(entry);
    if(!entry||state.done||state.reread||state.over||writes.has(id)||!wholeRequest(entry,card)||partGone(entry,card))return;
    const scope=passScope(entry),box=words(id),text=box?box.value:drafts.read(scope).text;
    if(characters(text)>PASS_WORDS)return;
    const draft=drafts.update(scope,{text});
    const seen=typeof card.commit==="string"&&card.commit?{commit:card.commit}:{revision:card.revision};
    const driven=typeof navigator.webdriver==="boolean"?{driven:navigator.webdriver}:{};
    const body={part:entry.part,stage:entry.stage,...seen,comment:entry.id,entry:entry.request.entry,...(draft.text.trim()?{words:draft.text}:{}),...driven};
    state.sending="pass";state.note=null;if(box)box.readOnly=true;
    let again=false;
    const sent=writes.run(id,()=>api.call("POST",`/api/spaces/${encodeURIComponent(entry.project)}/checkpoints`,{body,write:draft.write}));
    render();
    try{
      await sent;
      drafts.clear(scope,draft.write);
      state.done=true;state.mark=3;keep(entry);again=true;
    }catch(error){again=failed(entry,state,"pass",error);}
    finally{state.sending=null;const now=words(id);if(now)now.readOnly=false;render();}
    if(again)readAgain();
  }
  root.addEventListener("input",event=>{
    const box=event.target;
    if(box?.tagName!=="TEXTAREA"||box.name!=="words")return;
    const id=box.closest("[data-nx-entry]")?.dataset.nxEntry,entry=list.find(item=>item.id===id);
    if(!entry)return;
    drafts.update(passScope(entry),{text:box.value});box.removeAttribute("aria-invalid");
    if(counter(id,box))render();
  });
  root.addEventListener("click",event=>{
    const button=event.target.closest?.("button[data-nx-act]");
    if(!button||!root.contains(button)||button.disabled||button.getAttribute("aria-disabled")==="true")return;
    const act=button.dataset.nxAct,id=button.closest("[data-nx-entry]")?.dataset.nxEntry;
    if(act==="retry"){if(button.dataset.nxRetry==="pass")pass(id);else answer(id,button.dataset.nxRetry);}
    else if(act==="pass")pass(id);
    else if(act==="words")openWords(id);
    else if(act==="read")readAgain();
    else if(act==="sign-in"||act==="load")location.reload();
    else if(act==="order"){order=button.dataset.nxOrder==="push"?"push":"name";storeOrder(order);render();}
    else answer(id,act);
  });
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")readAgain();});
  // The controls that wait for the code (rule 15) work from here on; a stored order other
  // than by name draws the cards again.
  for(const control of root.querySelectorAll('[data-nx-wait="answer"],[data-nx-wait="order"]')){control.disabled=false;control.removeAttribute("data-nx-wait");}
  render();
  // The top bar's search: its words in the address as q=, in the place of this one.
  const search=createSearch({lang,api,address:q=>history.replaceState(history.state,"",location.pathname+location.search+(q?"#q="+encodeURIComponent(q):""))});
  followFragment(location.hash,data,api,undefined,search?words=>search.openWith(words):undefined).catch(()=>{});
  return{render,readAgain,answer,pass,openWords,search};
}
