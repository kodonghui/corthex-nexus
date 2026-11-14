// The project's data (SCR-130, SPEC-201 to SPEC-203): the panel of the workspace that the stage
// page's code (./stage.js) opens from the address's `data` (stage 07). It reads API-177 when it
// opens, after an export, when the removal's confirmation opens and when the page comes back
// into view (rule 6); asks for the export (API-178) whole, checks it against its own head and
// hands its text to the browser, which saves it under the reply's name; and, once the typed
// name is the project's, reads again and sends the removal (API-108), after which the first
// page says once that the project was removed (SCR-110#removed). It draws with
// ../src/draw/data.js through the stage page's render. The stage page keeps the address, the
// scrim and the page behind the panel, which waits while the panel is open (hold).
import {codeMessage,label} from "../src/draw/words.js";
import {LatestReads,NexusProblem} from "./state.js";

// Where the panel leaves a removed project's name for the first page, once (SCR-110#removed).
export const REMOVED_KEY="nexus0.3:removed";
// The address after # from its keys, with data, a key without a value, written bare (stage 07):
// #item=REQ-107&data.
export const fragment=params=>params.toString().replace(/(^|&)data=(?=&|$)/g,"$1data");
// A refusal of who sent the request (SCR-130#permission), which trying again cannot help.
const PERMISSION=Object.freeze(["user_only","no_kind","access_missing","access_other_app"]);
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
const FILE=/^attachment; filename="([^"\\/]{1,200})"$/;
const readable=(answer,project)=>Boolean(answer&&answer.project===project&&typeof answer.pushed_at==="string"&&answer.removal?.deletes&&typeof answer.removal.deletes==="object"&&answer.removal.open&&typeof answer.removal.open==="object");
// What a removal deletes, or the snapshot, other than the confirmation showed (SCR-130#stale).
const changed=(shown,now)=>shown.revision!==now.revision||shown.pushed_at!==now.pushed_at||JSON.stringify(shown.removal)!==JSON.stringify(now.removal);
// The export as API-178 gives it (SPEC-201): its head names the project and counts what the file
// holds, so that a file cut on its way, or another, is not saved.
export function wholeExport(file,project){
  if(!file||typeof file!=="object"||Array.isArray(file)||file.format!==1||file.project!==project||typeof file.exported_at!=="string")return false;
  const counts=file.counts&&typeof file.counts==="object"?file.counts:{};
  if(!["comments","proposals","edits","checkpoints"].every(key=>Array.isArray(file[key])&&counts[key]===file[key].length))return false;
  const inner=key=>file.comments.reduce((n,comment)=>n+(Array.isArray(comment?.[key])?comment[key].length:Number.NaN),0);
  return counts.replies===inner("replies")&&counts.decisions===inner("decisions");
}
// The file's name from the reply's Content-Disposition, which must be the project's with the
// export's date (API-178): nexus-{project}-{date}.json.
export function exportName(disposition,file,project){
  const name=FILE.exec(String(disposition||""))?.[1];
  return name&&name===`nexus-${project}-${String(file?.exported_at).slice(0,10)}.json`?name:null;
}
// The browser saves the file under its name, from its text as the server wrote it.
export function saveFile(name,text,doc=globalThis.document){
  const url=URL.createObjectURL(new Blob([text],{type:"application/json"}));
  const link=doc.createElement("a");link.href=url;link.download=name;link.hidden=true;
  doc.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}

// state is the view's (../src/draw/data.js); part, the panel's element; address, the stage page's
// {open, back, drop} for the address's `data`; hold, the page behind the panel; pushed(at), a
// newer push for SCR-111#stale's bar.
export function createData({api,lang,project,base,state,part,render,address,hold,pushed,storage=()=>globalThis.sessionStorage,go=url=>location.assign(url),save=saveFile,reload=()=>location.reload()}){
  const reads=new LatestReads();
  // opener is the control that opened the panel, whose focus Close returns to; closing, that the
  // back button's step is on its way.
  let opener="data",closing=false,pending=0;
  Object.assign(state,{open:false,project,answer:null,at:null,reading:false,note:null,gone:null,exporting:false,file:null,exportNote:null,confirm:false,stale:false,ready:false,removing:false,removeNote:null});
  const field=()=>part.querySelector("#dp-name");
  const usable=element=>Boolean(element)&&!element.disabled&&element.getClientRects().length>0;
  const here=()=>location.origin+location.pathname+location.hash;
  // The panel drawn again, with the focus on target, else, where the drawing took it away, on
  // the panel's heading.
  function draw(target){
    render(["data"]);
    if(!state.open)return;
    const element=target&&part.querySelector(target);
    if(element){element.focus({preventScroll:true});reveal(element);}
    else if(!part.contains(document.activeElement))part.querySelector("#dp-h")?.focus({preventScroll:true});
  }
  // The focused control in sight in the panel's body, which scrolls alone: the confirmation, in
  // the data's place, opens at its heading wherever the data was scrolled, and Cancel shows
  // "Remove this project" again (BUG-612). Only the body moves, never the page behind it.
  function reveal(element){
    const body=part.querySelector(".dpb");
    if(!body?.contains(element))return;
    const inner=element.getBoundingClientRect(),outer=body.getBoundingClientRect(),style=getComputedStyle(body);
    const top=outer.top+parseFloat(style.paddingTop),bottom=outer.bottom-parseFloat(style.paddingBottom);
    if(inner.top<top)body.scrollTop-=top-inner.top;
    else if(inner.bottom>bottom)body.scrollTop+=Math.min(inner.bottom-bottom,inner.top-top);
  }
  // The panel opens over the stage with its head at once, and reads its data (SCR-130#loading).
  function show(){
    closing=false;
    Object.assign(state,{open:true,answer:null,at:null,note:null,gone:null,file:null,exportNote:null,confirm:false,stale:false,ready:false,removeNote:null});
    hold();draw("#dp-h");
    read();
  }
  // Closed: the confirmation and its typed name go with it, a read on its way is not shown, and
  // the focus returns to the control that opened it, "Project data" where that one is not in
  // sight, then the stage's name in the phone's top bar, which opens the sheet of stages that
  // closed when the panel opened from it (BUG-611). The back button's step ends with the
  // browser's own move of the focus to the address's target, such as the side's #talk: the
  // focus returns again once that is done.
  function hide(){
    closing=false;reads.invalidate("data");
    Object.assign(state,{open:false,confirm:false,stale:false,ready:false,note:null,exportNote:null,removeNote:null});
    render(["data"]);hold();
    const restore=()=>{
      if(state.open)return;
      const back=[opener,"data","fmk"].map(key=>document.querySelector(`[data-nx-focus="${key}"]`)).find(usable)||document.querySelector(".tb .ttl");
      if(usable(back)&&document.activeElement!==back)back.focus({preventScroll:true});
    };
    restore();
    requestAnimationFrame(()=>setTimeout(restore,0));
  }
  // The address's `data` (stage 07): the panel follows it, as the back button and a link set it.
  function follow(want){
    if(want&&!state.open)show();
    else if(!want&&state.open)hide();
    closing=false;
  }
  // "Project data" or the mark of a long wait: the panel opens, and the address gains `data`, as
  // a step of the browser's history. The panel opens first, since the browser may follow the new
  // address at once, and the panel then reads once.
  function open(from){
    if(state.open)return;
    opener=from==="fmk"?"fmk":"data";
    show();address.open();
  }
  // Close and Escape: the back button's step where opening the panel made one, else the address
  // loses `data` in its place.
  function close(){
    if(!state.open||closing)return;
    if(address.back()){closing=true;return;}
    address.drop();hide();
  }

  // An answer of API-177: one that differs from what the open confirmation shows is
  // SCR-130#stale, whose typed name is emptied, and a newer push shows SCR-111#stale's bar.
  function take(answer){
    if(!readable(answer,project))throw new NexusProblem("internal");
    if(state.confirm&&state.answer&&changed(state.answer,answer)){
      state.stale=true;state.ready=false;
      const box=field();if(box)box.value="";
    }
    state.answer=answer;state.at=new Date().toISOString();state.note=null;state.gone=null;
    pushed(answer.pushed_at);
  }
  function readFailed(error){
    const code=error?.code||"internal",trace=error?.traceId;
    if(code==="project_not_found"){state.gone="read";state.confirm=false;return;}
    // SPEC-203: the panel says which, and keeps what it showed.
    state.note=code==="sign_in_expired"?{tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true}
      :PERMISSION.includes(code)?{tone:"warn",icon:"i-lock",text:codeMessage(code,lang),trace}
      :{tone:"err",text:codeMessage(CONNECTION[code]||code,lang),trace,retry:"data-read"};
  }
  async function read(){
    if(!state.open||state.removing)return;
    pending++;state.reading=true;draw();
    try{await reads.run("data",()=>api.call("GET",`${base}/data`),take);}
    catch(error){readFailed(error);}
    finally{pending--;state.reading=pending>0;if(state.open)draw();}
  }

  // A failure of the export or the removal, by the act (SCR-130#error, #permission and #gone).
  function failed(error,act){
    const code=error?.code||"internal",trace=error?.traceId;
    if(code==="project_not_found"){state.gone=act;state.confirm=false;return null;}
    if(code==="sign_in_expired")return{tone:"warn",text:codeMessage("Sign-in expired",lang),signIn:true};
    if(PERMISSION.includes(code))return{tone:"warn",icon:"i-lock",text:codeMessage(code,lang),trace};
    if(code==="cross_site")return{tone:"err",text:codeMessage(code,lang),trace,here:here()};
    const text=codeMessage(CONNECTION[code]||code,lang);
    return act==="export"?{tone:"err",text:`${label("The export failed",0,lang)} ${text}`,trace,retry:"data-export"}:{tone:"err",text,trace,retry:"data-confirm"};
  }
  // Export, and Export first in the confirmation (SPEC-201): the file whole, saved only when its
  // head and name are the project's; then the panel says which file the browser has, and reads
  // again.
  async function exportFile(){
    if(!state.open||!state.answer||state.gone||state.exporting||state.removing)return;
    state.exporting=true;state.exportNote=null;draw();
    let saved=false;
    try{
      const reply=await api.file(`${base}/export`),name=exportName(reply.disposition,reply.data,project);
      if(!name||!wholeExport(reply.data,project))throw new NexusProblem("internal");
      save(name,reply.text);
      state.file=name;saved=true;
    }catch(error){state.exportNote=failed(error,"export");}
    finally{state.exporting=false;if(state.open)draw();}
    if(saved)read();
  }
  // "Remove this project": the confirmation, in the data's place, which reads again as it opens.
  function openConfirm(){
    if(!state.open||!state.answer||state.gone||state.confirm||state.removing)return;
    Object.assign(state,{confirm:true,stale:false,ready:false,removeNote:null});
    draw("#rm-h");
    read();
  }
  // Cancel: the confirmation closes, and its typed name is forgotten.
  function cancel(){
    if(!state.confirm||state.removing)return;
    Object.assign(state,{confirm:false,stale:false,ready:false,removeNote:null});
    draw('[data-nx-focus="data-remove"]');
  }
  // The typed name: the project's, once the spaces at its ends are left out, turns the removal's
  // button on. It is never sent or kept.
  function typed(box){
    const ready=state.confirm&&box.value.trim()===project;
    if(ready!==state.ready){state.ready=ready;draw();}
  }
  // "Remove {project} from this server": the data read again just before, so that what changed
  // meanwhile shows as SCR-130#stale and nothing is removed; then the removal, which takes no
  // write ID, since the server deletes once and answers 404 to a second (API-108). Its success
  // leads to the first page.
  async function remove(){
    const box=field();
    if(!state.open||!state.confirm||!state.answer||state.gone||state.removing||state.reading||!state.ready||box?.value.trim()!==project)return;
    state.removing=true;state.removeNote=null;draw();
    let led=false;
    try{
      let now=null;
      if(!await reads.run("data",()=>api.call("GET",`${base}/data`),answer=>{now=answer;}))return;
      if(!readable(now,project))throw new NexusProblem("internal");
      if(changed(state.answer,now)){take(now);return;}
      await api.call("DELETE",`/api/snapshots/${encodeURIComponent(project)}`,{once:true});
      try{storage()?.setItem(REMOVED_KEY,project);}catch{/* The first page then shows no bar, and the missing card tells. */}
      led=true;go("/");
    }catch(error){state.removeNote=failed(error,"remove");}
    finally{if(!led){state.removing=false;if(state.open)draw();}}
  }

  // A press: "Project data" and the mark open the panel; inside it, its controls; the scrim waits
  // with the page behind it. true when the press was the panel's.
  function click(event){
    const control=event.target.closest?.("[data-nx-act]");
    if(!control){
      if(state.open&&event.target.closest?.(".scrim")){event.preventDefault();return true;}
      return false;
    }
    const act=control.dataset.nxAct,inside=part.contains(control),off=control.disabled||control.getAttribute("aria-disabled")==="true";
    if(act==="data"&&!inside){event.preventDefault();if(!off)open(control.dataset.nxFocus);return true;}
    if(!inside)return false;
    if(off)return true;
    if(act==="data-close")close();
    else if(act==="data-read")read();
    else if(act==="data-export")exportFile();
    else if(act==="data-remove")openConfirm();
    else if(act==="data-cancel")cancel();
    else if(act==="data-confirm")remove();
    else if(act==="sign-in")reload();
    return true;
  }
  part.addEventListener("input",event=>{if(event.target?.id==="dp-name")typed(event.target);});
  // Escape closes the panel, before anything that it covers.
  function escape(){if(!state.open)return false;close();return true;}
  // The page in view again (rule 6).
  function visible(){if(state.open)read();}
  return{follow,open,close,escape,click,visible,read,exportFile,openConfirm,cancel,remove,state};
}
