// The search (SCR-116, SPEC-152): what the panel under the top bar's field shows. Only the view's
// code draws it (../../ui/search.js), since the field asks the server as the user types. state is
// the code's {state, q, matches, total, active, error}: state is short, loading, ready, empty,
// failed or refused; q the words that the matches answer; matches and total what API-156 gave,
// kept while newer words load (SCR-116#loading); active the match under the arrow keys; error the
// code and trace ID of a search that failed or was refused. The panel's parts are its status line,
// which screen readers hear, the matches, the line under them and the place of a message.
import {esc,count} from "./html.js";
import {icon} from "./icons.js";
import {label,labels,codeMessage} from "./words.js";
import {stageName,stageNumber,stagePath} from "./stages.js";

export const SEARCH_MIN=2,SEARCH_MAX=200;
const CONNECTION=Object.freeze({network:"No connection",timeout:"No answer in time",busy:"Busy"});
// Where a match leads: its stage's page in its project's workspace, with the item selected
// (SPEC-149, REQ-232), in the project's first part when the match names none.
export const matchPath=match=>stagePath(match.project,match.part,match.stage)+"#item="+encodeURIComponent(match.id);
// "{project} · {part} · {stage}" under a match; a match without a part, as API-156 gives one
// whose project's first part has no valid name, names none.
export const matchWhere=(match,lang)=>[match.project,match.part,stageNumber(match.stage)+" "+stageName(match.stage,lang)].filter(Boolean).join(" · ");

// A search that failed (SCR-116#error): the code's message, its trace ID and Try again; one that
// was refused (SCR-116#permission): the code's message, or rule 7's Sign in again.
function message(state,lang){
  const error=state.error||{},code=error.code||"internal",buttons=labels("Page buttons",lang);
  if(state.state==="refused"){
    const signIn=code==="sign_in_expired";
    return`<div class="msg warn" role="status">${icon("i-warn")}<div><span class="t">${esc(codeMessage(signIn?"Sign-in expired":code,lang))}</span>${!signIn&&error.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:error.trace}))}</span>`:""}${signIn?`<div class="row"><button class="btn sm pri" type="button" data-nx-search-act="sign-in">${esc(buttons[2])}</button></div>`:""}</div></div>`;
  }
  return`<div class="msg err" role="alert">${icon("i-err")}<div><span class="t">${esc(codeMessage(CONNECTION[code]||code,lang))}</span>${error.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:error.trace}))}</span>`:""}<div class="row"><button class="btn sm" type="button" data-nx-search-act="retry">${icon("i-reload")}${esc(buttons[0])}</button></div></div></div>`;
}

// The panel's parts, each the inside of its element.
export function drawSearch(state,lang){
  const said=labels("The search",lang),kind=state.state,list=Array.isArray(state.matches)?state.matches:[];
  const listed=kind==="loading"||kind==="ready";
  const status=kind==="loading"?esc(said[0]):kind==="ready"?esc(label("The search",1,lang,{n:count(state.total??list.length),q:state.q})):"";
  // Each match an option of the list, its ID, its title as the source has it, and its place.
  const rows=listed?list.map((match,index)=>{
    const on=index===state.active;
    return`<li class="m${on?" on":""}" id="sm-${index}" role="option" aria-selected="${on}" data-nx-match="${index}"><span class="mono">${esc(match.id)}</span><span class="clip">${esc(match.title??"")}</span><span class="wh">${esc(matchWhere(match,lang))}</span></li>`;
  }).join(""):"";
  // At the limit, more needs more words (SCR-116#normal).
  const foot=kind==="ready"&&Number(state.total)>list.length?esc(said[2]):"";
  let pad="";
  if(kind==="short")pad=`<p>${esc(said[3])}</p>`;
  else if(kind==="empty")pad=`<p>${esc(label("The search",4,lang,{q:state.q}))}</p><a class="btn sm" href="${esc("/hub#q="+encodeURIComponent(state.q))}">${esc(said[5])}</a>`;
  else if(kind==="failed"||kind==="refused")pad=message(state,lang);
  return{status,rows,foot,pad};
}
