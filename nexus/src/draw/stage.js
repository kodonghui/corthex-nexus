// The stage in the workspace's middle (SCR-113, and SCR-112's list, whose picture ./picture.js
// draws): its head, the filters, the search in the stage, the grouping and the items, 200
// at a time; and the stage record in the side, in the talk's place (SCR-112's and SCR-113's
// "Stage record"). The server draws them from API-158's answer and the view's code draws
// them again. view is what the code adds, and the server draws with none: the query that
// the user picked, the items read so far, the selected item, the notes of reading again and
// the record's state. Every element that the code compares when it draws again has
// data-nx-key; data-nx-sub marks one whose children it compares one by one, and
// data-nx-live one whose text it changes in place (../../ui/reconcile.js).
import {esc,count,time,timed,dated,dayTime} from "./html.js";
import {icon,shapeIcon} from "./icons.js";
import {label,labels,codeMessage,oldLabels,legendWord,capital,STATES} from "./words.js";
import {stageName,stageNumber} from "./stages.js";

export const FILTERS=Object.freeze(["all","talk","mine","left"]);
export const GROUPS=Object.freeze(["context","source"]);
export const PICTURE_STAGES=Object.freeze(["01-domain","05-erd","07-sitemap"]);
export const WORDS_LIMIT=2000;
const sr=text=>`<span class="sr">${esc(text)}</span>`;
const stateOf=state=>STATES.includes(state)?state:"unknown";
const stateWord=(state,lang)=>`<span class="stw">${shapeIcon(stateOf(state))}<span>${esc(capital(legendWord(stateOf(state),lang),lang))}</span></span>`;

// Where a row of the list leads: the item, selected in the list (SCR-115 from TASK-277), and on a
// pictured stage the list's tab too, so that the address keeps the list (SCR-111's `#`).
export const itemHash=(stage,id)=>(PICTURE_STAGES.includes(stage)?"#view=list&item=":"#item=")+encodeURIComponent(id);

// The head's counts (REQ-226): the kinds that a stage defines, and the items of the others;
// stage 01's open hotspots, and stage 02's requirements by priority, MoSCoW's order first.
const COUNTED=Object.freeze({"01-domain":[["context",0],["term",1]],"02-prd":[["requirement",5]],"05-erd":[["table",3]],"07-sitemap":[["screen",4]],"12-qa":[["test",6]]});
const MOSCOW=Object.freeze(["must","should","could","won't","wont"]);
export function headCountParts(head,lang){
  const counts=head.counts||{},kinds=new Map((counts.kinds||[]).map(kind=>[kind.kind,Number(kind.count)||0]));
  const named=COUNTED[head.key];
  const parts=named?named.map(([kind,index])=>label("The head's counts",index,lang,{n:count(kinds.get(kind)||0)})):[label("Projects",8,lang,{n:count(counts.items)})];
  if(head.key==="01-domain"&&Number.isFinite(counts.hotspots))parts.push(label("The head's counts",2,lang,{n:count(counts.hotspots)}));
  if(head.key==="02-prd"){
    const rank=priority=>{const at=MOSCOW.indexOf(String(priority).toLowerCase().replace("’","'"));return at<0?MOSCOW.length:at;};
    const priorities=(counts.priorities||[]).map((entry,index)=>({...entry,index})).sort((a,b)=>rank(a.priority)-rank(b.priority)||a.index-b.index);
    for(const entry of priorities)parts.push(`${entry.priority} ${count(entry.count)}`);
  }
  return parts;
}
export const headCounts=(head,lang)=>headCountParts(head,lang).join(" · ");
// Why the project does not read the stage, from the state of its text source.
const NOT_READ=Object.freeze({missing:1,none:2,skipped:3,"no-checkout":4,invalid:5});
export const notReadWhy=(state,lang)=>label("Not read",NOT_READ[state]??1,lang);
// The newest checkpoint passed in NEXUS that no stage record names yet (SPEC-138).
export const waiting=record=>(record?.checkpoints||[]).filter(cp=>cp.state==="passed"&&!cp.recorded_commit).sort((a,b)=>String(b.passed_at).localeCompare(String(a.passed_at)))[0]||null;

export function drawHead(data,lang,view){
  const head=data.head,words=labels("The head",lang),checkpoint=head.checkpoint,meta=[];
  if(checkpoint)meta.push(`<span>${checkpoint.date?dated(words[0],checkpoint.date):esc(words[0].replace(/\s*\{date\}\s*/,""))}</span>`);
  else meta.push(`<span>${esc(words[1])}</span>`);
  if(head.reads===false)meta.push(`<span>${esc(label("Not read",0,lang,{why:notReadWhy(head.source_state,lang)}))}</span>`);
  else if(head.commit){
    const when=head.time?` · ${head.picture?timed(words[3],head.time):time(head.time)}`:"";
    meta.push(`<span>${esc(label("The head",2,lang,{commit:String(head.commit).slice(0,7)}))}${when}</span>`);
  }
  const passed=waiting(data.record);
  if(passed)meta.push(`<span class="wait">${icon("i-warn")}<span>${dated(codeMessage("Waiting for its record",lang),passed.passed_at)}</span></span>`);
  const wait=view.code?"":' disabled data-nx-wait="record"';
  // On a pictured stage (SCR-112's layout) Stage record is in the head under 1,024 pixels and
  // at the right end of the tools' line from 1,024. The head shows no Edit until a release
  // includes editing, so that its counts reach its right end (stage 08's rule 23, SPEC-147).
  const record=`<button class="btn sm${view.pictured?" only-ph":""}" type="button" data-nx-key="rec" data-nx-act="record" data-nx-focus="record" aria-expanded="${Boolean(view.record)}"${wait}>${icon("i-record")}<span>${esc(words[4])}</span></button>`;
  // From 1,024 to 1,279 pixels the talk folds into "Talk ({n})" (SCR-111, rule 16), whose link
  // opens it without the code.
  const talk=`<a class="btn sm only-mid" href="#talk" data-nx-key="talk" data-nx-act="talk" data-nx-focus="talk">${icon("i-talk")}<span>${esc(label("Tabs",4,lang,{n:count(view.talk)}))}</span></a>`;
  // Each count whole on its line, so that a line that breaks ends with "·" (REQ-226).
  const counts=head.reads===false?"":headCountParts(head,lang).map((part,index,all)=>`<span class="c">${esc(part)}${index<all.length-1?" ·":""}</span>`).join(" ");
  return`<div class="shd" data-nx-key="head" data-nx-sub><h1 data-nx-key="h"><span class="num">${esc(stageNumber(head.key))}</span> ${esc(stageName(head.key,lang))}</h1><span class="st" data-nx-key="st">${stateWord(head.state,lang)}</span><span class="meta" data-nx-key="meta">${meta.join("")}</span><span class="counts" data-nx-key="counts" data-nx-sub><span class="cn" data-nx-key="cn">${counts}</span>${record}${talk}</span></div>`;
}

// The notes of reading again, between the head and the filters (SCR-113#error and #permission):
// a read that failed, with Try again (rule 6), or a refusal's message with its trace ID.
export function drawNotes(view,lang){
  const note=view.notice;let html="";
  if(note?.kind==="unread")html=`<div class="bar err" role="alert">${icon("i-err")}<span class="t">${esc(codeMessage("Could not update",lang))}</span><button class="btn sm" type="button" data-nx-act="read" data-nx-focus="read">${icon("i-reload")}${esc(labels("Page buttons",lang)[0])}</button></div>`;
  else if(note?.kind==="refused")html=`<div class="bar warn" role="status">${icon("i-warn")}<span class="t">${esc(codeMessage(note.code,lang))}${note.trace?` <span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:note.trace}))}</span>`:""}</span></div>`;
  return`<div class="notes" data-nx-key="notes">${html}</div>`;
}

// What the list is asked for: the user's pick while the code runs, else what was read.
const queryOf=(items,view)=>({filter:FILTERS.includes(view.query?.filter)?view.query.filter:items.filter,group:GROUPS.includes(view.query?.group)?view.query.group:items.group,q:view.query?.q??items.q??""});

export function drawFilters(data,lang,view){
  const items=data.items,words=labels("The list",lang),counts=items.counts||{},query=queryOf(items,view);
  // A stage that holds no items has nothing to narrow: its filters stay off (SCR-113#empty).
  const none=!Number(data.head.counts?.items),wait=none?" disabled":view.code?"":' disabled data-nx-wait="list"';
  const chips=FILTERS.map((name,index)=>`<button class="chip" type="button" data-nx-key="f:${name}" data-nx-act="filter" data-nx-filter="${name}" data-nx-focus="filter:${name}" aria-pressed="${query.filter===name}"${wait}><span>${esc(words[index])}</span><span class="n">${esc(count(counts[name]))}</span></button>`).join("");
  const find=`<label class="field find" data-nx-key="find">${icon("i-search")}<input type="search" name="q" maxlength="200" autocomplete="off" placeholder="${esc(words[4])}" aria-label="${esc(words[4])}" data-nx-focus="find"${wait}></label>`;
  const current=esc(words[query.group==="source"?6:5]);
  const group=none
    ?`<button class="btn sm gm" type="button" data-nx-key="group" disabled>${icon("i-group")}<span>${current}</span>${icon("i-down")}</button>`
    :`<details class="menu gm" data-nx-key="group"><summary class="btn sm" data-nx-focus="group">${icon("i-group")}<span>${current}</span>${icon("i-down")}</summary><div class="pop">${GROUPS.map((name,index)=>`<button class="btn quiet sm" type="button" data-nx-act="group" data-nx-group="${name}" data-nx-focus="group:${name}" aria-pressed="${query.group===name}"${wait}>${esc(words[5+index])}</button>`).join("")}</div></details>`;
  // The search and the grouping keep together: on the filters' line while it holds them, else
  // on a line of their own (SCR-113's layout).
  return`<div class="filters" data-nx-key="filters" data-nx-sub>${chips}<span class="tools" data-nx-key="tools" data-nx-sub>${find}${group}</span></div>`;
}

// One item of the list (SCR-113#normal): its ID, its text as the source has it, its main fields
// with their names for screen readers, its comments and its marks, each a word (rule 13).
const FIELDS=Object.freeze(["priority","status","type","parent"]);
function itemRow(entry,stage,lang,selected,key){
  const id=String(entry.id),names=labels("List fields",lang),marks=labels("List marks",lang),on=selected===id;
  const fields=FIELDS.map((name,index)=>typeof entry[name]==="string"&&entry[name]?`<span${name==="parent"?' class="mono"':""}>${sr(names[index])} ${esc(entry[name])}</span>`:"").filter(Boolean).join(" ");
  const n=Number(entry.comments)||0;
  const comments=n?`${icon("i-talk")}<span aria-hidden="true">${esc(count(n))}</span>${sr(label("List marks",2,lang,{n:count(n)}))}`:"";
  const tags=[entry.mine?`<span class="tagm my">${esc(label("The list",2,lang))}</span>`:"",Number(entry.discrepancies)>0?`<span class="tagm disc">${esc(marks[0])}</span>`:"",Number(entry.reflections)>0?`<span class="tagm refl">${esc(marks[1])}</span>`:""].filter(Boolean).join(" ");
  return`<li data-nx-key="${esc(key)}"><a class="li${on?" on":""}" href="${esc(itemHash(stage,id))}" data-nx-item="${esc(id)}" data-nx-focus="item:${esc(id)}"${on?' aria-current="true"':""}><span class="id">${esc(id)}</span> <span class="tt">${esc(entry.title||"")}</span> <span class="flds">${fields}</span> <span class="cm">${comments}</span> <span class="mks">${tags}</span></a></li>`;
}

// A list without rows: its icon, its words and what the user can do there.
const noList=(key,name,text,action="")=>`<div class="nolist" data-nx-key="${key}"><div>${icon(name,"big")}<p>${esc(text)}</p>${action}</div></div>`;
function emptyList(data,lang,view){
  const items=data.items,query=queryOf(items,view),words=labels("The list",lang);
  const wait=view.code?"":' disabled data-nx-wait="list"';
  if(data.head.reads===false){
    const record=`<button class="btn" type="button" data-nx-act="record" data-nx-focus="record-2"${view.code?"":' disabled data-nx-wait="record"'}>${icon("i-record")}<span>${esc(labels("The head",lang)[4])}</span></button>`;
    return noList("not-read","i-info",codeMessage("Not read",lang,{why:notReadWhy(data.head.source_state,lang)}),record);
  }
  if(!Number(data.head.counts?.items))return noList("empty","i-list",label("No items",0,lang));
  const text=items.q?label("No match",2,lang,{q:items.q}):items.filter==="mine"?label("No match",0,lang):items.filter==="talk"?label("No match",1,lang):codeMessage("Nothing left",lang);
  // Show all clears the filter and the search (SCR-113#no-match).
  const all=query.filter==="all"&&!query.q&&!items.q&&items.filter==="all"?"":`<button class="btn" type="button" data-nx-act="show-all" data-nx-focus="show-all"${wait}>${esc(words[7])}</button>`;
  return noList("no-match","i-search",text,all);
}

// The items read so far, in groups by context or in the source's order (REQ-227), and the last
// row while more remain: "{n} of {total}", "Loading more…", or "Could not load more." with Try
// again. view.entries holds the pages that the code read after the first.
export function drawList(data,lang,view){
  const items=data.items,entries=view.entries||items.entries,words=labels("The list",lang),stage=data.stage;
  if(!entries.length)return`<section class="list" data-nx-key="list" data-nx-sub>${emptyList(data,lang,view)}</section>`;
  // Each row's key: its ID, and a count after it for a second item with the same ID, so that
  // no two rows share one.
  const seen=new Map(),row=entry=>{const id=String(entry.id),n=seen.get(id)||0;seen.set(id,n+1);return itemRow(entry,stage,lang,view.selected,n?`i:${id}#${n}`:`i:${id}`);};
  let body="";
  if(items.group==="context"){
    const byContext=new Map();
    for(const entry of entries){const key=entry.context??null;if(!byContext.has(key))byContext.set(key,[]);byContext.get(key).push(entry);}
    const known=new Map((items.groups||[]).map(group=>[group.context??null,group]));
    // The groups in the answer's order, then any that only a later page named.
    const order=[...known.keys(),...[...byContext.keys()].filter(key=>!known.has(key))].filter(key=>byContext.has(key));
    body=order.map(key=>{
      const group=known.get(key)||{context:key,title:null,count:byContext.get(key).length},slug=key===null?"_":key,id=`gh-${esc(slug)}`;
      const title=key===null?esc(words[8]):`<span class="mono">${esc(key)}</span> ${esc(group.title||"")}`;
      return`<section class="grp-l" data-nx-key="g:${esc(slug)}" data-nx-sub aria-labelledby="${id}"><h2 class="gh" id="${id}" data-nx-key="h">${title} <span class="mono n">${esc(count(group.count))}</span></h2><ul data-nx-key="u" data-nx-sub>${byContext.get(key).map(row).join("")}</ul></section>`;
    }).join("");
  }else body=`<ul data-nx-key="u" data-nx-sub>${entries.map(row).join("")}</ul>`;
  const total=Number(items.total)||0;
  let more="";
  if(entries.length<total){
    const inside=view.more==="loading"?esc(words[10]):view.more==="failed"?`${esc(words[11])} <button class="btn sm" type="button" data-nx-act="more" data-nx-focus="more">${icon("i-reload")}${esc(labels("Page buttons",lang)[0])}</button>`:esc(label("The list",9,lang,{n:count(entries.length),total:count(total)}));
    more=`<p class="more" data-nx-key="more" data-nx-live${view.more==="failed"?' role="alert"':""}>${inside}</p>`;
  }
  return`<section class="list" data-nx-key="list" data-nx-sub>${body}${more}</section>`;
}

// "Updating…" while the code reads again (rule 6), over the list or the picture.
export const drawUpdating=(view,lang)=>`<p class="upd" role="status" data-nx-key="upd" data-nx-live>${view.updating?esc(codeMessage("Updating",lang)):""}</p>`;
// The inside of the stage's middle (the stage part): data is API-158's answer.
export function drawStage(data,lang,view={}){
  if(!data?.head||!data.items||!Array.isArray(data.items.entries))throw new Error("Unreadable page data");
  const filters=data.head.reads===false?"":drawFilters(data,lang,view);
  return drawHead(data,lang,view)+drawNotes(view,lang)+filters+`<div class="lw" data-nx-key="lw" data-nx-sub>${drawUpdating(view,lang)}${drawList(data,lang,view)}</div>`;
}

// The stage record (SPEC-138, SPEC-139): the recorded state, next action, checkpoints and checks,
// each checkpoint passed in NEXUS with Withdraw, and passing the checkpoint with the words.
// state is the code's {sending, note, passNote, left, over}: what is being sent; the record's
// message at its top, such as that of a checkpoint recorded meanwhile; the message of a pass or
// a withdrawal that failed, above the words box as SCR-112#error draws it; the characters left
// from 90 per cent of the limit (rule 5); and whether the words are over their limit, which
// stops Pass and says the limit.
function message(note,lang,focus){
  if(!note)return"";
  const tone=["info","warn","err"].includes(note.tone)?note.tone:"err",buttons=labels("Page buttons",lang),row=[];
  if(note.retry)row.push(`<button class="btn sm" type="button" data-nx-act="${esc(note.retry)}"${note.checkpoint?` data-nx-checkpoint="${esc(note.checkpoint)}"`:""} data-nx-focus="${esc(focus)}:retry">${icon("i-reload")}${esc(buttons[0])}</button>`);
  if(note.signIn)row.push(`<button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="${esc(focus)}:sign-in">${esc(buttons[2])}</button>`);
  if(note.here)row.push(`<a class="lnk" href="${esc(note.here)}">${esc(buttons[3])}</a>`);
  return`<div class="msg ${tone}" role="${tone==="err"?"alert":"status"}">${icon(tone==="err"?"i-err":tone==="warn"?"i-warn":"i-info")}<div><span class="t">${esc(note.text)}</span>${note.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:note.trace}))}</span>`:""}${row.length?`<div class="row">${row.join("")}</div>`:""}</div></div>`;
}
const https=value=>typeof value==="string"&&/^https:\/\/[^\s"'<>]+$/.test(value)&&value.length<=2000?value:null;
export function drawRecord(data,lang,state={}){
  const words=labels("The stage record",lang),head=labels("The head",lang),headings=oldLabels("Overview's headings",lang),none=oldLabels("Item values",lang)[0];
  const overview=data.record||{},recorded=overview.record||null,checks=Array.isArray(overview.checks)?overview.checks:[];
  const ownCheckpoints=(recorded?.checkpoints||[]).map(cp=>{
    const where=https(cp.where),meta=[cp.by?esc(cp.by):"",cp.date?dayTime(cp.date):""].filter(Boolean).join(" · ");
    return`<li><span>${esc(cp.approved||"")}</span>${meta?` <span class="mu cap">${meta}</span>`:""}${where?` <a class="lnk clip" href="${esc(where)}" rel="noreferrer">${esc(where)}</a>`:""}</li>`;
  }).join("");
  const warnings=checks.filter(check=>check.level==="warn").length;
  const checkText=checks.length?[warnings?label("Projects",9,lang,{n:count(warnings)}):"",checks[0].message||checks[0].rule||"",checks.length>1?label("More",0,lang,{n:count(checks.length-1)}):""].filter(Boolean).map(esc).join(" · "):esc(codeMessage("No checks",lang));
  const list=`<dl data-nx-key="dl"><dt>${esc(headings[0])}</dt><dd>${stateWord(recorded?.state??data.head.state,lang)}</dd><dt>${esc(words[0])}</dt><dd${recorded?.next?"":' class="mu"'}>${esc(recorded?.next||none)}</dd><dt>${esc(words[1])}</dt><dd${ownCheckpoints?"":' class="mu"'}>${ownCheckpoints?`<ul class="cps">${ownCheckpoints}</ul>`:esc(none)}</dd><dt>${esc(words[2])}</dt><dd>${checkText}</dd></dl>`;
  // The checkpoints passed in NEXUS that wait for their records, and those withdrawn that a
  // record names (SCR-112#stale), each with its words.
  const named=new Set((overview.warnings||[]).filter(w=>w.rule==="checkpoint-withdrawn").map(w=>w.checkpoint));
  const passedList=(overview.checkpoints||[]).map(cp=>{
    const id=esc(cp.id),sending=state.sending==="withdraw:"+cp.id,quote=cp.words?`<span class="mu">“${esc(cp.words)}”</span>`:"";
    if(cp.state==="passed"&&!cp.recorded_commit){
      const button=`<button class="btn sm" type="button" data-nx-act="withdraw" data-nx-checkpoint="${id}" data-nx-focus="withdraw:${id}"${sending?' aria-disabled="true"':""}>${esc(sending?codeMessage("Sending",lang):words[5])}</button>`;
      return`<div class="wbox" data-nx-key="cp:${id}"><b>${dated(codeMessage("Waiting for its record",lang),cp.passed_at)}</b>${quote}${button}</div>`;
    }
    if(cp.state==="withdrawn")return`<div class="wbox warn" data-nx-key="cp:${id}"><b>${dated(codeMessage("Withdrawn",lang),cp.withdrawn_at)}</b>${quote}${named.has(cp.id)?`<span>${esc(codeMessage("Withdrawn, recorded",lang))}</span>`:""}</div>`;
    return"";
  }).join("");
  const notOpened=Number(overview.not_opened)>0?message({tone:"warn",text:codeMessage("Not opened",lang,{n:count(overview.not_opened)})},lang,"not-opened"):"";
  const again=(overview.checkpoints||[]).some(cp=>cp.state==="passed"&&!cp.recorded_commit),sending=state.sending==="pass";
  const pass=sending?codeMessage("Sending",lang):again?codeMessage("Pass again",lang):words[4];
  // Past the limit, the limit itself, since nothing is left (rule 5).
  const left=state.over?esc(codeMessage("text_too_long",lang,{limit:WORDS_LIMIT.toLocaleString("en-US")})):state.left===null||state.left===undefined?"":esc(codeMessage("Characters left",lang,{n:state.left}));
  const off=state.over?" disabled":sending?' aria-disabled="true"':"";
  return`<section class="rec" aria-labelledby="rec-h" data-nx-key="rec" data-nx-sub><span class="handle only-ph" data-nx-key="hd" aria-hidden="true"></span><div class="th" data-nx-key="th"><h2 id="rec-h" tabindex="-1" data-nx-focus="rec-h">${esc(head[4])}</h2><span class="mu sm">${esc(stageNumber(data.stage)+" "+stageName(data.stage,lang))}</span><span class="sp"></span><button class="btn quiet sm" type="button" data-nx-act="close" data-nx-focus="close">${icon("i-back")}${esc(head[5])}</button></div><div class="rb" data-nx-key="rb" data-nx-sub><div class="rnote" data-nx-key="rnote">${message(state.note,lang,"record")}</div>${list}${notOpened?`<div data-nx-key="not-opened">${notOpened}</div>`:""}${passedList?`<div class="cpl" data-nx-key="cpl" data-nx-sub>${passedList}</div>`:""}<h3 data-nx-key="ph">${esc(words[3])}</h3><div class="pnote" data-nx-key="pnote">${message(state.passNote,lang,"pass")}</div><label class="lab" for="cp-words" data-nx-key="pl">${esc(headings[5])}</label><textarea class="ta" id="cp-words" name="words" rows="4" data-nx-key="ta" data-nx-focus="words" aria-describedby="cp-left"></textarea><p class="left" id="cp-left" data-nx-key="left" data-nx-live>${left}</p><div class="r2" data-nx-key="r2"><span class="sp"></span><button class="btn pri" type="button" data-nx-act="pass" data-nx-focus="pass"${off}>${esc(pass)}</button></div></div></section>`;
}

// The inside of the side (SCR-111): the stage record while it is open, else what the page could
// not hold, such as a project without a space (SCR-111's Target), until the talk joins it
// (SCR-114, TASK-276).
export function drawSide(data,problem,lang,view={}){
  if(view.record)return drawRecord(data,lang,view.recordState);
  if(problem?.code==="space_not_found")return`<div class="sidemsg" data-nx-key="problem">${message({tone:"warn",text:codeMessage(problem.code,lang),trace:problem.traceId},lang,"problem")}</div>`;
  return"";
}

// The bars under the top bar (SCR-111#stale and rule 7): a newer push, with Load again, and a
// sign-in that expired, with Sign in again.
export function stageBars(view,lang){
  const buttons=labels("Page buttons",lang),out=[];
  if(view.pushed)out.push(`<div class="bar info" role="status">${icon("i-info")}<span class="t">${timed(label("Pushed again",0,lang),view.pushed)}</span><button class="btn sm" type="button" data-nx-act="load" data-nx-focus="load">${icon("i-reload")}${esc(buttons[1])}</button></div>`);
  if(view.signIn)out.push(`<div class="bar warn" role="status">${icon("i-warn")}<span class="t">${esc(codeMessage("Sign-in expired",lang))}</span><button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="sign-in">${esc(buttons[2])}</button></div>`);
  return out.join("");
}
