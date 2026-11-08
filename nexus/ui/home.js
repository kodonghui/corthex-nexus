// The first page's code (SCR-110): answers in place, reading again, the cards' order and
// 0.2's fragments on `/` (SPEC-143 to SPEC-145, SPEC-154). It draws with the server's own
// functions (../src/draw/home.js) and replaces only the elements whose drawing changed,
// so that the focus and the messages stay where they are (stage 08's rules 3 to 8).
import {drawHome,talkPath} from "../src/draw/home.js";
import {path} from "../src/draw/html.js";
import {STAGE_KEYS,stagePath} from "../src/draw/stages.js";
import {label,labels,codeMessage} from "../src/draw/words.js";
import {ApiClient,LatestReads,PendingWrites,writeId} from "./state.js";

const ORDER_KEY="nexus0.3:order";
const STATES=Object.freeze(["open","accepted","dismissed","withdrawn"]);
const GONE=Object.freeze(["proposal_not_found","comment_not_found","project_not_found","space_not_found"]);
const PERMISSION=Object.freeze(["user_only","access_missing","access_other_app"]);
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
const PROJECT=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// What was drawn for each element that the code compares: the markup of the drawing, not of
// the element, whose times the code writes in the browser's time zone.
const drawn=new WeakMap();
const drawnOf=element=>drawn.get(element)??element.outerHTML;
const attributes=element=>[...element.attributes].map(a=>a.name+"="+a.value).join("\n");
// An element and the elements that it holds and the code compares, with their drawing,
// which holds the same elements in the same order.
function remember(element,drawing){
  const nodes=[drawing,...drawing.querySelectorAll("[data-nx-key]")];
  [element,...element.querySelectorAll("[data-nx-key]")].forEach((node,index)=>{if(nodes[index])drawn.set(node,nodes[index].outerHTML);});
}
// Children by their data-nx-key: kept when drawn the same, compared one by one inside a
// data-nx-sub element, changed in place in a data-nx-live one, and otherwise replaced.
export function reconcile(live,next){
  const old=new Map([...live.children].map(element=>[element.dataset.nxKey,element])),kids=[...next.children];
  kids.forEach((child,index)=>{
    const match=old.get(child.dataset.nxKey),html=child.outerHTML;let use=child;
    if(match&&match.tagName===child.tagName){
      if(drawnOf(match)===html){remember(match,child);use=match;}
      else if(child.hasAttribute("data-nx-live")&&attributes(match)===attributes(child)){if(match.innerHTML!==child.innerHTML)match.innerHTML=child.innerHTML;remember(match,child);use=match;}
      // The drawing as it was before its children moved into the page.
      else if(child.hasAttribute("data-nx-sub")&&attributes(match)===attributes(child)){reconcile(match,child);drawn.set(match,html);use=match;}
    }
    if(use===child)remember(child,child);
    if(live.children[index]!==use)live.insertBefore(use,live.children[index]||null);
    if(match&&match!==use)match.remove();
  });
  while(live.children.length>kids.length)live.lastElementChild.remove();
}

function storedOrder(){try{return globalThis.localStorage?.getItem(ORDER_KEY)==="push"?"push":"name";}catch{return"name";}}
function storeOrder(order){try{globalThis.localStorage?.setItem(ORDER_KEY,order);}catch{/* The order stays for this page only. */}}

// 0.2's fragments on `/` (SPEC-154): #q= opens the search, #p=&id= the item in its stage and
// #p=&s= that stage of the project's first part. Until the search of SCR-116 is built
// (TASK-277), the search is the hub page's, at /hub.
export async function followFragment(hash,data,api,go=target=>location.replace(target)){
  const params=new URLSearchParams(String(hash||"").replace(/^#/,""));
  const search=words=>go("/hub#q="+encodeURIComponent(words));
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

export function startHome(root,payload,{api=new ApiClient(location.origin),localize=()=>{}}={}){
  const lang=payload.lang,writes=new PendingWrites(),reads=new LatestReads(),entries=new Map(),kept=new Map();
  let data=payload.data,list=data.my_turn.entries.slice(),notice=null,reading=0,order=storedOrder();
  const pushed={};
  const stateOf=id=>{if(!entries.has(id))entries.set(id,{writes:{}});return entries.get(id);};
  function render(){
    const active=document.activeElement,focus=root.contains(active)?active.closest("[data-nx-focus]")?.dataset.nxFocus:null;
    const template=document.createElement("template");
    template.innerHTML=drawHome(data,lang,{code:true,list,entries:Object.fromEntries(entries),pushed,notice,updating:reading>0,order});
    reconcile(root,template.content);
    localize(root);
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
    finally{reading--;render();}
  }
  const keep=entry=>kept.set(entry.id,entry);
  // An answer's failure (SCR-110#stale, #error and #permission): its message under the entry,
  // which stays, and Try again where trying again can help, with the same write ID.
  function failed(entry,state,act,error){
    const code=error?.code||"internal",trace=error?.traceId;
    if(code==="sign_in_expired"){notice="sign-in";return false;}
    if(code==="proposal_not_open"){
      const index=STATES.indexOf(error.state);
      state.done=true;state.mark=index===1?0:index===2?1:undefined;keep(entry);
      state.note={tone:"info",text:codeMessage(code,lang,{state:index<0?String(error.state||""):labels("Proposal states",lang)[index]})};
      return true;
    }
    if(code==="not_recommended"){state.done=true;keep(entry);state.note={tone:"info",text:codeMessage(code,lang)};return true;}
    if(GONE.includes(code)){state.done=true;keep(entry);state.note={tone:"err",text:codeMessage(code,lang),trace};return true;}
    if(code==="part_not_found"){state.note={tone:"err",text:codeMessage(code,lang),trace,open:talkPath(entry.project,entry.part,entry.stage,entry.id)};return false;}
    if(PERMISSION.includes(code)){state.note={tone:"warn",text:codeMessage(code,lang),trace};return false;}
    if(code==="cross_site"){state.note={tone:"err",text:codeMessage(code,lang),trace,here:location.origin+location.pathname+location.hash};return false;}
    if(code==="write_id_reused")delete state.writes[act];
    state.note={tone:"err",text:codeMessage(CONNECTION[code]||code,lang,{limit:error?.limit??""}),trace,retry:act};
    return false;
  }
  async function answer(id,act){
    const entry=list.find(item=>item.id===id),state=stateOf(id);
    if(!entry||state.done||writes.has(id)||!["accept","dismiss","recommended"].includes(act))return;
    state.writes[act]??=writeId();state.sending=act;state.note=null;
    const project=encodeURIComponent(entry.project),target=encodeURIComponent(entry.id);
    const url=act==="recommended"?`/api/spaces/${project}/comments/${target}/recommended`:`/api/spaces/${project}/proposals/${target}/${act}`;
    let again=false;
    const sent=writes.run(id,()=>api.call("POST",url,{write:state.writes[act]}));
    render();
    try{
      const result=await sent;
      state.done=true;keep(entry);again=true;
      state.mark=act==="accept"?0:act==="dismiss"?1:entry.asks==="checkpoint"?3:2;
      if(result?.changed===false)state.note={tone:"info",text:label("Done already",0,lang)};
    }catch(error){again=failed(entry,state,act,error);}
    finally{state.sending=null;render();}
    if(again)readAgain();
  }
  root.addEventListener("click",event=>{
    const button=event.target.closest?.("button[data-nx-act]");
    if(!button||!root.contains(button)||button.disabled||button.getAttribute("aria-disabled")==="true")return;
    const act=button.dataset.nxAct,id=button.closest("[data-nx-entry]")?.dataset.nxEntry;
    if(act==="retry")answer(id,button.dataset.nxRetry);
    else if(act==="read")readAgain();
    else if(act==="sign-in")location.reload();
    else if(act==="order"){order=button.dataset.nxOrder==="push"?"push":"name";storeOrder(order);render();}
    else answer(id,act);
  });
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")readAgain();});
  // The controls that wait for the code (rule 15) work from here on; a stored order other
  // than by name draws the cards again.
  for(const control of root.querySelectorAll('[data-nx-wait="answer"],[data-nx-wait="order"]')){control.disabled=false;control.removeAttribute("data-nx-wait");}
  render();
  followFragment(location.hash,data,api).catch(()=>{});
  return{render,readAgain,answer};
}
