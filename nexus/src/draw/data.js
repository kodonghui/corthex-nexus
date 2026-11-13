// The project's data (SCR-130, SPEC-201 to SPEC-203): a panel of the workspace over the stage's
// column from 1,024 pixels and a sheet under it, which the stage page's code opens from the
// address's `data` (stage 07) and draws with these functions (../../ui/data.js). The server draws
// it closed, since it knows no address after `#`. The panel shows what the server holds of the
// project and Git does not, each kind with its count, the loop's two times (rules 19 and 20),
// the export as one file, and the removal, whose confirmation lists what it deletes and asks for
// the project's name. state is the code's:
//   open, whether the panel shows; project, the project's name from the page's data;
//   answer, the last answer of API-177, null until the first; at, when it came, the time of
//   how long ago until the code works it out again (../../ui/page.js); reading, a read runs;
//   note, the read's failure; gone, which request found the project gone ("read", "export"
//   or "remove");
//   exporting, the export runs; file, the name of the file that the browser has; exportNote,
//   the export's failure;
//   confirm, the removal's confirmation shows; stale, what it deletes changed while it was open
//   (SCR-130#stale); ready, the typed name is the project's; removing, the removal runs;
//   removeNote, the removal's failure.
// A note is {tone, text, trace, retry, signIn, here, home, icon}: its words, the trace ID, Try
// again with the act that it sends again, Sign in again (rule 7), a link to the page at the
// server's own address (cross_site), a link to all projects, and its icon.
// Every element that the code compares has data-nx-key (../../ui/reconcile.js): the field of the
// project's name keeps the same markup in every drawing, so that what the user typed stays in it.
import {esc,count} from "./html.js";
import {icon} from "./icons.js";
import {label,labels,codeMessage} from "./words.js";
import {loopTime,longWait,placed} from "./loop.js";

// The six kinds that the panel counts: each a member of the dry run's deletes (API-110, API-177),
// which the export's head counts in the same way, with its label in "The project's data".
export const KINDS=Object.freeze([["comments",7],["replies",8],["decisions",9],["proposals",10],["edits",11],["checkpoints",12]]);
// The four lists of the confirmation: each a member of the dry run's open, with its label in
// "The removal's confirmation".
export const OPEN_LISTS=Object.freeze([["comments",4],["proposals",5],["reflections",6],["checkpoints",7]]);
const sr=text=>`<span class="sr">${esc(text)}</span>`;
const name=project=>`<span class="pn">${esc(project)}</span>`;

// A message of the panel (rule 3): its words, the trace ID, and what the user can do.
export function dataMessage(note,lang,focus){
  if(!note)return"";
  const tone=["info","warn","err"].includes(note.tone)?note.tone:"err",buttons=labels("Page buttons",lang),row=[];
  const mark=["i-reload","i-lock","i-check"].includes(note.icon)?note.icon:tone==="err"?"i-err":tone==="warn"?"i-warn":"i-info";
  if(note.retry)row.push(`<button class="btn sm" type="button" data-nx-act="${esc(note.retry)}" data-nx-focus="${esc(focus)}:retry">${icon("i-reload")}${esc(buttons[0])}</button>`);
  if(note.signIn)row.push(`<button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="${esc(focus)}:sign-in">${esc(buttons[2])}</button>`);
  if(note.here)row.push(`<a class="lnk" href="${esc(note.here)}">${esc(buttons[3])}</a>`);
  if(note.home)row.push(`<a class="lnk" href="/" data-nx-focus="${esc(focus)}:home">${esc(labels("Top bar",lang)[1])}</a>`);
  return`<div class="msg ${tone}" role="${tone==="err"?"alert":"status"}">${icon(mark)}<div><span class="t">${esc(note.text)}</span>${note.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:note.trace}))}</span>`:""}${row.length?`<div class="row">${row.join("")}</div>`:""}</div></div>`;
}

// The loop's two times (rules 19 and 20): when the server last stored the snapshot, with its
// commit, and when the agent last read its agent to-do, with the session's label of that read,
// which only this screen shows (SPEC-188); each as a date and time with how long ago, its name in
// a column of its own from 1,024 pixels and over it under 1,024 (page.css). A project without a
// space has no agent to-do yet. Then the mark of a long wait, with its line.
function times(answer,lang,base){
  const words=labels("The project's data",lang);
  const commit=answer.commit?placed(label("The head",2,lang),{commit:`<span class="mono">${esc(String(answer.commit).slice(0,7))}</span>`}):esc(label("The last push",1,lang));
  const after=text=>`<span class="dv2"><span class="sep" aria-hidden="true"> · </span>${text}</span>`;
  const push=`<div class="drow" data-nx-key="push"><span class="dk">${esc(words[1])}</span><span class="dv"><span>${loopTime(answer.pushed_at,base,lang)}</span>${after(commit)}</span></div>`;
  let read;
  if(!answer.space)read=`<span>${esc(label("The agent's last read",2,lang))}</span>`;
  else if(!answer.read_at)read=`<span>${esc(words[5])}</span>`;
  else read=`<span>${loopTime(answer.read_at,base,lang)}</span>${after(answer.read_session?esc(label("The project's data",3,lang,{label:answer.read_session})):esc(words[4]))}`;
  const mark=answer.space?longWait(answer.unread_since,base,lang):"";
  return`${push}<div class="drow" data-nx-key="read"><span class="dk">${esc(words[2])}</span><span class="dv">${read}</span></div>${mark?`<div class="dmark" data-nx-key="mark">${mark}</div>`:""}`;
}
// What the server holds of the project and Git does not, a row for each kind with its count,
// over 999 as 999+ (rule 12); a project without a space says why every count is 0.
function counts(answer,lang){
  const words=labels("The project's data",lang),deletes=answer.removal?.deletes||{};
  const rows=KINDS.map(([key,index])=>`<div class="dcnt"><span>${esc(words[index])}</span><b>${esc(count(deletes[key]))}</b></div>`).join("");
  return`<h3 data-nx-key="ch">${esc(words[6])}</h3><div class="dcnts" data-nx-key="cnts">${rows}</div>${answer.space?"":`<p data-nx-key="nosp">${esc(label("No space",0,lang))}</p>`}`;
}
// The file that the browser has after an export (SPEC-201).
const fileNote=(file,lang)=>file?`<p class="res" role="status" data-nx-key="file">${icon("i-check")}<span>${placed(label("The export",3,lang),{file:`<span class="mono">${esc(file)}</span>`})}</span></p>`:"";
// The two acts, each with its line: Export, which says "Preparing the file…" while it runs and
// keeps the width of its own words (stage 08's choice 19), and "Remove this project". off turns
// both off, as while the data loads and once the project is gone.
function acts(state,lang,off){
  const words=labels("The export",lang),removal=labels("The removal",lang),busy=Boolean(state.exporting);
  const exportButton=`<button class="btn sm" type="button" data-nx-act="data-export" data-nx-focus="data-export"${off||busy||state.removing?' aria-disabled="true"':""}>${keepWords(esc(words[0]),busy&&words[2])}</button>`;
  const removeButton=`<button class="btn sm danger" type="button" data-nx-act="data-remove" data-nx-focus="data-remove"${off||state.removing?' aria-disabled="true"':""}>${esc(removal[0])}</button>`;
  return`<div class="dact" data-nx-key="ax"><span class="dl">${esc(words[1])}</span>${exportButton}</div><div class="dact" data-nx-key="ar"><span class="dl">${esc(removal[1])}</span>${removeButton}</div>`;
}
// A button's words while it runs over its own, which keep their room unseen (BUG-606), as
// keepWidth() of ./html.js does for words that hold markup, such as the project's name.
const keepWords=(html,busy)=>busy?`<span class="keep"><span class="was" aria-hidden="true">${html}</span><span>${esc(busy)}</span></span>`:html;

// The grey lines of SCR-130#normal's layout while the data loads, with their words for screen
// readers; the acts show off. Their widths are the stylesheet's (page.css): a name, a value
// and a count.
function loading(state,lang){
  const bar=kind=>`<span class="skel ${kind}"></span>`;
  const lines=[["k","v"],["k","v"],["k"]].map(row=>`<div class="skr">${row.map(bar).join("")}</div>`).join("");
  const rows=KINDS.map(()=>`<div class="dcnt">${bar("k")}${bar("n")}</div>`).join("");
  return`<div class="dsk" aria-hidden="true" data-nx-key="sk">${lines}${rows}</div><p class="sr" role="status" data-nx-key="ld">${esc(labels("The project's data",lang)[13])}</p>${acts(state,lang,true)}`;
}
// The project that the server no longer holds (SCR-130#gone): its message, with what the act
// that found it cannot do, and a link to all projects; the two acts off.
function gone(state,lang){
  const why=state.gone==="export"?` ${label("The export failed",1,lang)}`:state.gone==="remove"?` ${label("Nothing to remove",0,lang)}`:"";
  return`<div data-nx-key="gone">${dataMessage({tone:"err",text:codeMessage("project_not_found",lang)+why,home:true},lang,"gone")}</div>${acts(state,lang,true)}`;
}

// The removal's confirmation (SCR-130#removal, #removal-ready and #stale), in the data's place:
// the heading; what changed while it was open, and a read again that failed; what the removal
// deletes, the snapshot with its
// pictures and discrepancies, and the space with the counts of what Git does not hold; under them
// by ID the open comments, the open proposals, the pending reflections and the checkpoints not
// yet recorded, up to 20 of each with "{n} of {total}" where more are open (rule 12); "Export
// first", with the file that the browser has or the export's failure; and how a removed project
// comes back. A project without a space lists the snapshot only.
function confirmation(state,lang){
  const answer=state.answer,removal=answer.removal,deletes=removal.deletes,words=labels("The removal's confirmation",lang),kinds=labels("The project's data",lang);
  const heading=`<h3 class="rmh" id="rm-h" tabindex="-1" data-nx-focus="rm-h" data-nx-key="rmh">${placed(words[0],{project:name(state.project)})}</h3>`;
  const stale=state.stale?`<div data-nx-key="stale">${dataMessage({tone:"warn",icon:"i-reload",text:label("The removal changed",0,lang)},lang,"stale")}</div>`:"";
  const snapshot=`<li>${esc(label("The removal's confirmation",2,lang,{n:count(deletes.pictures),m:count(deletes.discrepancies)}))}</li>`;
  const space=deletes.space?`<li>${esc(words[3])}<span class="mu sm rmc">${KINDS.map(([key,index])=>`${esc(kinds[index])} ${esc(count(deletes[key]))}`).join(" · ")}</span></li>`:"";
  const groups=deletes.space?OPEN_LISTS.map(([key,index])=>{
    const list=removal.open?.[key]||{total:0,ids:[]},total=Number(list.total)||0,ids=Array.isArray(list.ids)?list.ids:[];
    if(!total)return"";
    const more=ids.length<total?` <span class="mu">${esc(label("The list",9,lang,{n:count(ids.length),total:count(total)}))}</span>`:"";
    return`<div class="idg"><h4>${esc(words[index])} <span class="mu">${esc(count(total))}</span></h4><p class="idl">${ids.map(id=>`<span class="mono">${esc(id)}</span>`).join(" ")}${more}</p></div>`;
  }).join(""):"";
  const busy=Boolean(state.exporting);
  const first=`<div class="xf" data-nx-key="xf"><button class="btn sm" type="button" data-nx-act="data-export" data-nx-focus="data-export-first"${busy||state.removing?' aria-disabled="true"':""}>${keepWords(esc(words[8]),busy&&labels("The export",lang)[2])}</button></div>`;
  const note=state.note?`<div data-nx-key="note">${dataMessage(state.note,lang,"read")}</div>`:"";
  return`${heading}${stale}${note}<p class="b" data-nx-key="del">${esc(words[1])}</p><ul class="rml" data-nx-key="rml">${snapshot}${space}</ul>${groups?`<div class="idgs" data-nx-key="idgs">${groups}</div>`:""}${first}${fileNote(state.file,lang)}${state.exportNote?`<div data-nx-key="xnote">${dataMessage(state.exportNote,lang,"export")}</div>`:""}<p class="mu sm" data-nx-key="back">${esc(words[9])}</p>`;
}
// The confirmation's foot, at the panel's bottom: the field for the project's name, the
// removal's failure above the buttons, and Cancel and "Remove {project} from this server", which
// works once the typed name is the project's (SCR-130#removal-ready) and says "Removing…" while
// the removal runs, when Cancel is off too. Its words are one piece, which a long name wraps
// inside the button (rule 1). The field turns off capitals, corrections and
// suggestions, and its markup never changes, so that what the user typed stays.
function foot(state,lang){
  const words=labels("The removal's confirmation",lang),removing=Boolean(state.removing),on=Boolean(state.ready)&&!state.reading&&!removing;
  const field=`<label class="lab" for="dp-name" data-nx-key="lab">${placed(words[10],{project:name(state.project)})}</label><div class="field rmf" data-nx-key="fld"><input id="dp-name" name="confirm" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" maxlength="200" data-nx-focus="data-name"></div>`;
  const button=`<button class="btn sm danger" type="button" data-nx-key="go" data-nx-act="data-confirm" data-nx-focus="data-confirm"${on?"":' aria-disabled="true"'}>${keepWords(`<span class="bw">${placed(words[0],{project:name(state.project)})}</span>`,removing&&words[13])}${state.ready?"":sr(words[11])}</button>`;
  return`<div class="rmft" data-nx-key="rmft" data-nx-sub>${field}<div class="rnote" data-nx-key="rnote">${dataMessage(state.removeNote,lang,"remove")}</div><div class="rma" data-nx-key="rma" data-nx-sub><button class="btn sm" type="button" data-nx-key="cancel" data-nx-act="data-cancel" data-nx-focus="data-cancel"${removing?' aria-disabled="true"':""}>${esc(words[12])}</button>${button}</div></div>`;
}

// The inside of the panel's part, nothing while it is closed.
export function drawData(state,lang){
  if(!state?.open)return"";
  const words=labels("The project's data",lang),answer=state.answer,base=state.at||answer?.pushed_at;
  const head=`<div class="dph" data-nx-key="dph"><h2 id="dp-h" tabindex="-1" data-nx-focus="dp-h">${esc(words[0])}</h2><span class="mu sm clip">${esc(state.project)}</span><span class="sp"></span><button class="ib" type="button" data-nx-act="data-close" data-nx-focus="data-close">${icon("i-close")}${sr(labels("Top bar",lang)[5])}</button></div>`;
  let body;
  if(state.gone)body=gone(state,lang);
  else if(!answer)body=state.note?`<div data-nx-key="note">${dataMessage(state.note,lang,"read")}</div>${acts(state,lang,true)}`:loading(state,lang);
  else if(state.confirm)body=confirmation(state,lang);
  else body=`${times(answer,lang,base)}${counts(answer,lang)}${fileNote(state.file,lang)}${state.note?`<div data-nx-key="note">${dataMessage(state.note,lang,"read")}</div>`:""}${state.exportNote?`<div data-nx-key="xnote">${dataMessage(state.exportNote,lang,"export")}</div>`:""}${acts(state,lang,false)}`;
  const tail=answer&&state.confirm&&!state.gone?foot(state,lang):"";
  return`<section class="dp" role="dialog" aria-modal="true" aria-labelledby="dp-h" data-nx-key="dp" data-nx-sub><span class="handle only-ph" data-nx-key="hd" aria-hidden="true"></span>${head}<div class="dpb" data-nx-key="dpb" data-nx-sub>${body}</div>${tail}</section>`;
}
