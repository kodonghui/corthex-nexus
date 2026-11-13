// The first page (SCR-110): my turn, the agent to-do and the projects' cards, as the
// server draws them from API-151's answer and the view's code draws them again. view is
// what the code adds, and the server draws with none: the entries to show, each entry's
// answer in place with its messages (stage 08's rules 3 to 8, choice 19), the notes of
// reading again, the cards' order and the cards pushed again. Every element that the code
// compares when it draws again has data-nx-key; data-nx-sub marks one whose children it
// compares one by one, and data-nx-live one whose text it changes in place.
import {esc,path,count,time,timed,keepWidth} from "./html.js";
import {icon,shapeIcon} from "./icons.js";
import {label,labels,oldLabels,legendWord,codeMessage,notCurrentWhy,STATES} from "./words.js";
import {STAGE_KEYS,stageName,stageNumber,stagePath} from "./stages.js";
import {PALETTE} from "./palette.js";
import {lastPush,lastRead,longWait,pushed as pushedAt} from "./loop.js";

export const PICTURED=Object.freeze(["01-domain","05-erd","07-sitemap"]);
const sr=text=>`<span class="sr">${esc(text)}</span>`;
const stageLabel=(key,lang)=>`${stageNumber(key)} ${stageName(key,lang)}`;
const stateOf=state=>STATES.includes(state)?state:"unknown";
// Where an entry opens: the talk of its part and stage at it (SCR-114).
export const talkPath=(project,part,stage,id)=>`${stagePath(project,part,stage)}#talk=${encodeURIComponent(id)}`;
// Where each count of the agent to-do opens (SPEC-144): the talk at the oldest comment;
// the list filtered to what is left for discrepancies and pending reflections; the stage,
// whose record shows it, for a checkpoint that waits for its record.
export const AGENT_LISTS=Object.freeze([["comments",1],["discrepancies",2],["reflections",3],["checkpoints",4]]);
export function countPath(project,list,oldest){
  if(!oldest)return path("p",project);
  if(list==="comments")return talkPath(project,oldest.part,oldest.stage,oldest.entry);
  return stagePath(project,oldest.part,oldest.stage)+(list==="checkpoints"?"":"#filter=left");
}
// An entry's kind: a proposal, or a comment by what its last entry asks of the user.
export const entryKind=entry=>entry.kind==="proposal"?0:entry.asks==="recommended"?2:entry.asks==="checkpoint"?3:1;
// The answers that each kind offers: the writes, then Reply, the link to the talk. A checkpoint
// request has buttons of its own (requestActs), and API-159 passes no checkpoint (TASK-302).
const ANSWERS=Object.freeze([[["accept",0],["dismiss",1]],[],[["recommended",2]],[]]);
const LINKS=Object.freeze([null,3,3,null]);
// The pass's words, up to 2,000 characters (SPEC-196), as the stage record's (./stage.js).
export const PASS_WORDS=2000;
// The scope of the pass's words and write ID in the browser's storage: the request's comment
// (SCR-110's revision, rule 5).
export const passScope=entry=>`${entry.project}:pass:${entry.id}`;
// A checkpoint request in form shows whole (SPEC-196, TASK-302): its last entry's whole text, the
// thing to look at first, the commit and the stage. Only then does its entry offer the pass, which
// names what the entry shows (SPEC-194): so an item to look at first that no stage holds now, a
// request stored without the form or a workshop's, and a project without its card, offer only
// "Open the request".
export function wholeRequest(entry,card){
  const request=entry?.request,look=request?.look_first;
  if(entry?.kind!=="comment"||entry.asks!=="checkpoint"||!request||!look||!card)return false;
  const shown=typeof look.url==="string"&&look.url.startsWith("https://")||Boolean(look.held&&typeof look.stage==="string"&&STAGE_KEYS.includes(look.stage)&&typeof look.item==="string");
  return shown&&(typeof card.commit==="string"&&card.commit!==""||Number.isInteger(card.revision));
}
// An entry on a part that the project's snapshot no longer holds, which its card does not list
// (BUG-610): its stage has no page (SCR-111#error), so the entry links to no talk and offers no
// pass; it says why, and a comment closes as answered in place (API-120).
export function partGone(entry,card){
  return Boolean(card&&Array.isArray(card.parts)&&!card.parts.some(part=>part?.name===entry?.part));
}
const number=value=>Number.isFinite(Number(value))?Math.round(Number(value)):0;
const backticks=text=>esc(text).replace(/`([^`]+)`/g,"<code>$1</code>");

// A picture's small view from the server's first layout of it, without labels.
export function drawingSVG(drawing){
  const [x,y,width,height]=[0,1,2,3].map(index=>number(drawing.bounds?.[index]));
  const lines=(drawing.lines||[]).map(line=>{const [a,b,c,d]=line.map(number);return`M${a} ${b}L${c} ${d}`;}).join("");
  const boxes=(drawing.boxes||[]).map(([kind,...box])=>{
    const [stroke,fill]=Object.hasOwn(PALETTE,kind)?PALETTE[kind]:PALETTE.screen,[bx,by,bw,bh]=box.map(number);
    return`<rect x="${bx}" y="${by}" width="${Math.max(0,bw)}" height="${Math.max(0,bh)}" fill="${fill}" stroke="${stroke}"${kind==="context"||kind==="lane"?' class="dash"':""}/>`;
  }).join("");
  return`<svg viewBox="${x} ${y} ${Math.max(1,width)} ${Math.max(1,height)}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${lines?`<path d="${lines}" fill="none" stroke="${PALETTE.context[0]}"/>`:""}${boxes}</svg>`;
}

// The notes above my turn: the sign-in that expired (rule 7) and a reading again that
// failed (rule 6), each with its button.
function notes(view,lang){
  const buttons=labels("Page buttons",lang),out=[];
  if(view.notice==="sign-in")out.push(`<div class="bar warn" role="status">${icon("i-warn")}<span class="t">${esc(codeMessage("Sign-in expired",lang))}</span><button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="sign-in">${esc(buttons[2])}</button></div>`);
  if(view.notice==="unread")out.push(`<div class="bar err" role="alert">${icon("i-err")}<span class="t">${esc(codeMessage("Could not update",lang))}</span><button class="btn sm" type="button" data-nx-act="read" data-nx-focus="read">${icon("i-reload")}${esc(buttons[0])}</button></div>`);
  return`<div class="full notes" data-nx-key="notes">${out.join("")}</div>`;
}

// An entry's answer in place (choice 19) and its message (rule 3): state is the view's
// {sending, done, mark, note} for the entry.
function after(entry,state,lang){
  const id=esc(entry.id),parts=[];
  if(Number.isInteger(state.mark)){
    // After a pass, the link opens the stage's record, where the checkpoint can be withdrawn
    // until it is recorded (BUG-607).
    const record=state.mark===3?` <a class="lnk" href="${esc(stagePath(entry.project,entry.part,entry.stage)+"#record")}">${esc(label("The head",4,lang))}</a>`:"";
    const mark=state.mark===4?labels("The talk's entries",lang)[2]:label("Answered",state.mark,lang);
    parts.push(`<p class="res">${icon("i-check")}<span>${esc(mark)}${record}</span></p>`);
  }
  // A refusal by the pass's words shows by the words' box (wordsBox).
  const note=state.note&&!(state.note.box&&state.words)?state.note:null;
  if(note){
    const tone=["info","warn","err"].includes(note.tone)?note.tone:"err",buttons=labels("Page buttons",lang),row=[];
    if(note.retry)row.push(`<button class="btn sm" type="button" data-nx-act="retry" data-nx-retry="${esc(note.retry)}" data-nx-focus="${id}:retry">${icon("i-reload")}${esc(buttons[0])}</button>`);
    if(note.load)row.push(`<button class="btn sm" type="button" data-nx-act="load" data-nx-focus="${id}:load">${icon("i-reload")}${esc(buttons[1])}</button>`);
    if(note.open)row.push(`<a class="btn sm" href="${esc(note.open)}">${esc(label("A checkpoint request's buttons",0,lang))}</a>`);
    if(note.here)row.push(`<a class="lnk" href="${esc(note.here)}">${esc(buttons[3])}</a>`);
    parts.push(`<div class="msg ${tone}" role="${tone==="err"?"alert":"status"}">${icon(tone==="err"?"i-err":tone==="warn"?"i-warn":"i-info")}<div><span class="t">${esc(note.text)}</span>${note.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:note.trace}))}</span>`:""}${row.length?`<div class="row">${row.join("")}</div>`:""}</div></div>`);
  }
  return parts.length?`<div class="after" tabindex="-1" data-nx-key="x" data-nx-focus="${id}:after">${parts.join("")}</div>`:"";
}
// A message under an entry or by its words' box (rule 3).
function noteHtml(note,id,lang){
  const tone=["info","warn","err"].includes(note.tone)?note.tone:"err",buttons=labels("Page buttons",lang);
  const retry=note.retry?`<div class="row"><button class="btn sm" type="button" data-nx-act="retry" data-nx-retry="${esc(note.retry)}" data-nx-focus="${id}:retry-box">${icon("i-reload")}${esc(buttons[0])}</button></div>`:"";
  return`<div class="msg ${tone}" role="${tone==="err"?"alert":"status"}">${icon(tone==="err"?"i-err":tone==="warn"?"i-warn":"i-info")}<div><span class="t">${esc(note.text)}</span>${note.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:note.trace}))}</span>`:""}${retry}</div></div>`;
}

// A checkpoint request whole (SCR-110's revision, rule 22): after its text, "Look at first", the
// commit that the project's card shows, and what is left in its stage. An item to look at first
// that a stage holds is a link to that stage's page at #item= with its ID and title; an address,
// its host and what follows cut after 120 characters, opens only when pressed, in a new tab
// without a referrer, and the page never loads it; an item that no stage holds now is its ID as
// text. A snapshot that names no commit shows no commit, as the stage record (TASK-300).
function requestLines(entry,card,lang){
  const request=entry.request,look=request.look_first||{},words=labels("A checkpoint request, whole",lang),left=request.left||{};
  let what="";
  if(typeof look.url==="string"&&look.url.startsWith("https://")&&look.url.length<=2000){
    const shown=Array.from(look.url.slice(8)),text=shown.length>120?shown.slice(0,120).join("")+"…":shown.join("");
    what=`<a class="lnk" href="${esc(look.url)}" target="_blank" rel="noopener noreferrer" data-nx-focus="${esc(entry.id)}:look">${esc(text)}</a>`;
  }else if(typeof look.item==="string"&&look.item){
    const named=`<span class="mono">${esc(look.item)}</span>${look.title?" "+esc(look.title):""}`;
    what=look.held&&STAGE_KEYS.includes(look.stage)?`<a class="lnk" href="${esc(stagePath(entry.project,entry.part,look.stage)+"#item="+encodeURIComponent(look.item))}" data-nx-focus="${esc(entry.id)}:look">${named}</a>`:`<span>${named}</span>`;
  }
  const n=key=>count(Math.max(0,Number(left[key])||0));
  const lines=[
    what?`<span class="lf"><span class="rk">${esc(words[0])}</span>${what}</span>`:"",
    typeof card?.commit==="string"&&card.commit?`<span class="cm">${esc(label("The head",2,lang,{commit:card.commit.slice(0,7)}))}</span>`:"",
    `<span class="lt"><span class="rk">${esc(words[1])}</span>${["discrepancies","comments","reflections"].map((key,index)=>`<span class="c">${esc(label("A checkpoint request, whole",index+2,lang,{n:n(key)}))}${index<2?" ·":""}</span>`).join(" ")}</span>`];
  return`<div class="rqf" data-nx-key="f">${lines.join("")}</div>`;
}
// The pass's words (SCR-110's revision): a box of up to 2,000 characters, which the code keeps
// in the browser's storage for the request's comment with the write ID (rule 5) and fills after it
// draws; the characters left show from 90 per cent of the limit, and a refusal by the words shows
// above them.
function wordsBox(entry,state,lang){
  const id=esc(entry.id);
  const left=state.over?esc(codeMessage("text_too_long",lang,{limit:PASS_WORDS.toLocaleString("en-US")})):Number.isInteger(state.left)?esc(codeMessage("Characters left",lang,{n:state.left})):"";
  const note=state.note?.box?noteHtml(state.note,id,lang):"";
  return`<div class="wb" data-nx-key="b" data-nx-sub><div class="bn" data-nx-key="bn">${note}</div><label class="lab" for="pw-${id}" data-nx-key="bl">${esc(oldLabels("Overview's headings",lang)[5])}</label><textarea class="ta" id="pw-${id}" name="words" rows="3" data-nx-key="bt" data-nx-focus="${id}:words" aria-describedby="pw-left-${id}"></textarea><p class="left" id="pw-left-${id}" data-nx-key="bf" data-nx-live>${left}</p></div>`;
}
// A checkpoint request's buttons (SCR-110's revision): "Open the request", the first and filled,
// a link to the talk at the request that works before the code runs; and, while the entry shows
// the request whole, "Pass the stage {n} checkpoint" and "Add your words", which wait for the code.
// The pass is off while it is sent and while my turn reads again after a refusal, and disabled
// over the words' limit.
function requestActs(entry,state,lang,code,whole,talk,where){
  const id=esc(entry.id),buttons=labels("A checkpoint request's buttons",lang);
  const open=`<a class="btn sm pri answer" href="${talk}" data-nx-focus="${id}:talk" aria-describedby="${where}">${esc(buttons[0])}</a>`;
  if(!whole)return open;
  const sending=state.sending==="pass",wait=code?(state.over?" disabled":sending||state.reread?' aria-disabled="true"':""):` disabled data-nx-wait="answer"`;
  const pass=`<button class="btn sm answer" type="button" data-nx-act="pass" data-nx-focus="${id}:pass" aria-describedby="${where}"${wait}>${keepWidth(label("The pass",0,lang,{n:String(entry.stage).slice(0,2)}),sending&&codeMessage("Sending",lang))}</button>`;
  const add=state.words?"":`<button class="btn sm quiet answer" type="button" data-nx-act="words" data-nx-focus="${id}:add" aria-describedby="${where}"${code?"":` disabled data-nx-wait="answer"`}>${esc(buttons[1])}</button>`;
  return open+pass+add;
}

function entryItem(entry,titles,lang,state={},code=false,card=null){
  const id=esc(entry.id),kind=entryKind(entry),answers=labels("Answers",lang),where=`w-${id}`;
  const quote=entry.quote?`<q>${esc(entry.quote)}</q>`:"";
  const item=entry.item?`<span class="mono">${esc(entry.item)}</span>${entry.title?" "+esc(entry.title):""}${quote?" "+quote:""}`:quote||esc(label("An entry's place",0,lang));
  const place=[titles.get(entry.project)||entry.project,entry.part,stageLabel(entry.stage,lang)].filter(Boolean).map(text=>`<span>${esc(text)}</span><span aria-hidden="true">·</span>`).join("");
  const talk=esc(talkPath(entry.project,entry.part,entry.stage,entry.id));
  // While an answer is sent, its buttons keep the focus and are announced as disabled.
  const wait=code?(state.sending?' aria-disabled="true"':""):` disabled data-nx-wait="answer"`;
  const gone=partGone(entry,card),button=(act,text,n)=>`<button class="btn sm answer${n===0?" pri":""}" type="button" data-nx-act="${act}" data-nx-focus="${id}:${act}" aria-describedby="${where}"${wait}>${keepWidth(text,state.sending===act&&codeMessage("Sending",lang))}</button>`;
  const writes=ANSWERS[kind].map(([act,index],n)=>button(act,answers[index],n));
  const link=LINKS[kind]===null?[]:[`<a class="btn sm answer" href="${talk}" data-nx-focus="${id}:talk" aria-describedby="${where}">${esc(answers[LINKS[kind]])}</a>`];
  const head=`<span class="kind acc" data-nx-key="k">${esc(labels("An entry's kind",lang)[kind])}</span><span class="where" id="${where}" data-nx-key="w">${place}${gone?`<span class="clip">${item}</span>`:`<a class="lnk clip" href="${talk}" data-nx-focus="${id}:place">${item}</a>`}</span>`;
  const when=`<span class="when mu cap" data-nx-key="n">${esc(labels("Author and time",lang)[0])} · ${time(entry.at)}</span>`;
  // An entry on a part that the snapshot no longer holds (BUG-610): its text, why it links
  // nowhere, and its answers in place: a proposal's Accept and Dismiss, a recommendation's As
  // recommended, and Mark answered for a comment, which closes it as answered (API-120).
  if(gone){
    const request=kind===3?entry.request:null,closes=kind===0?[]:[button("answered",labels("The talk's entries",lang)[0],writes.length)];
    const why=`<p class="rqf" data-nx-key="f">${esc(codeMessage("part_not_found",lang))}</p>`;
    const acts=state.done?"":`<span class="acts rqa" data-nx-key="a">${[...writes,...closes].join("")}</span>`;
    return`<li class="ent req gone${state.done?" answered":""}" data-nx-key="e:${id}" data-nx-entry="${id}" data-nx-sub>${head}<p class="txt${request?" rq":""}" data-nx-key="t">${esc(request?request.text:entry.text)}</p>${why}${when}${acts}${after(entry,state,lang)}</li>`;
  }
  // A checkpoint request (SCR-110's revision): in form, its last entry's whole text and its lines;
  // its words' box while it is open; and its buttons. Its parts keep their places when the code
  // draws again, so that the words and the focus stay.
  if(kind===3){
    const whole=wholeRequest(entry,card),request=entry.request;
    const text=`<p class="txt${request?" rq":""}" data-nx-key="t">${esc(request?request.text:entry.text)}</p>`;
    const box=code&&whole&&state.words&&!state.done?wordsBox(entry,state,lang):"";
    const acts=state.done?"":`<span class="acts rqa" data-nx-key="a">${requestActs(entry,state,lang,code,whole,talk,where)}</span>`;
    return`<li class="ent req${state.done?" answered":""}" data-nx-key="e:${id}" data-nx-entry="${id}" data-nx-sub>${head}${text}${request?requestLines(entry,card,lang):""}${when}${box}${acts}${after(entry,state,lang)}</li>`;
  }
  const acts=state.done?"":`<span class="acts">${[...writes,...link].join("")}</span>`;
  return`<li class="ent${state.done?" answered":""}" data-nx-key="e:${id}" data-nx-entry="${id}">${head}<p class="txt">${esc(entry.text)}</p>${when}${acts}${after(entry,state,lang)}</li>`;
}

function myTurn(data,view,titles,lang){
  const list=view.list||data.my_turn.entries,total=Number(data.my_turn.total)||0,shown=data.my_turn.entries.length,head=labels("My turn",lang);
  const n=shown<total?label("The list",9,lang,{n:count(shown),total:count(total)}):count(total);
  const entries=view.entries||{},none=labels("Nothing waits",lang),cards=new Map(data.projects.map(item=>[item.name,item]));
  const body=list.length
    ?`<ol data-nx-key="mine-list" data-nx-sub>${list.map(entry=>entryItem(entry,titles,lang,entries[entry.id],view.code,cards.get(entry.project))).join("")}</ol>`
    :`<div class="empty-l" data-nx-key="mine-none"><b>${esc(none[0])}</b><span class="mu sm">${esc(none[1])}</span></div>`;
  return`<section class="sec mine" aria-labelledby="mine-h" data-nx-key="mine" data-nx-sub><div class="sech" data-nx-key="mine-head" data-nx-sub><h2 id="mine-h" data-nx-key="mine-h">${esc(label("My turn",0,lang,{n}))}</h2><span class="upd mu cap" role="status" data-nx-key="upd" data-nx-live>${view.updating?esc(codeMessage("Updating",lang)):""}</span><span class="sub" data-nx-key="mine-sub">${esc(head[1])}</span></div>${body}<p class="note" data-nx-key="mine-note">${esc(label("The turn",0,lang))}</p></section>`;
}

// The agent to-do (SCR-110): under each project's name its last push and the agent's last read
// of it, with how long ago, the mark of a long wait, and beside the name how many entries the
// agent has not read (rules 19 and 20, SPEC-189); then its counts.
function agentTodo(data,titles,lang){
  const words=labels("Agent to-do",lang),base=data.generated_at,cards=new Map(data.projects.map(item=>[item.name,item]));
  let total=0;
  const projects=data.agent.map(counts=>{
    const rows=AGENT_LISTS.filter(([list])=>Number(counts[list]?.total)>0).map(([list,index])=>{
      const n=Number(counts[list].total);total+=n;
      return`<li><a href="${esc(countPath(counts.project,list,counts[list].oldest))}" data-nx-focus="todo:${esc(counts.project)}:${list}"><span>${esc(words[index])}</span><b>${esc(count(n))}</b></a></li>`;
    });
    if(!rows.length)return"";
    const taken=Number(counts.taken)>0?`<span class="taken">${esc(label("Agent to-do",5,lang,{n:count(counts.taken)}))}</span>`:"";
    const unread=Number(counts.unread)>0?`<span class="nr">${esc(label("Not read, in the agent to-do",0,lang,{n:count(counts.unread)}))}</span>`:"";
    const card=cards.get(counts.project),push=card?`<span>${pushedAt(card.pushed_at,base,lang)}</span>`:"";
    return`<div class="pj"><h3><span>${esc(titles.get(counts.project)||counts.project)}</span>${unread}</h3><div class="loop">${push}<span>${lastRead(true,counts.read_at,base,lang)}</span></div>${longWait(counts.unread_since,base,lang)}<ul>${rows.join("")}</ul>${taken}</div>`;
  }).join("");
  const body=projects?`<div class="pjs">${projects}</div>`:`<p class="none">${esc(words[7])}</p>`;
  return`<section class="sec todo" aria-labelledby="todo-h" data-nx-key="todo"><div class="sech"><h2 id="todo-h">${esc(label("Agent to-do",0,lang,{n:count(total)}))}</h2></div>${body}<p class="note">${esc(words[6])}</p></section>`;
}

// A part's "Now" and "Next", as the hub page's cards say them (SPEC-123): nothing for a
// recorded part with no current stage, and REQ-103's words for a part without records.
function now(card,lang){
  const lines=card.parts.map(part=>{
    const name=part.name?`<b>${esc(part.name)}</b>`:"";
    if(!part.recorded)return`<p class="np">${name}<span class="mu">${esc(label("No progress",0,lang))}</span></p>`;
    if(!part.current||!STAGE_KEYS.includes(part.current))return"";
    const state=stateOf(part.states[STAGE_KEYS.indexOf(part.current)]);
    const next=part.next?`<span class="mu">${esc(label("Projects",4,lang,{"next action":part.next}))}</span>`:"";
    return`<p class="np">${name}<span>${esc(label("Projects",3,lang,{stage:stageLabel(part.current,lang),state:legendWord(state,lang)}))}</span>${next}</p>`;
  }).join("");
  return lines?`<div class="now">${lines}</div>`:"";
}

function thumbs(card,lang){
  const words=labels("Projects",lang),several=card.parts.length>1;
  return`<div class="thumbs">${card.parts.flatMap(part=>PICTURED.map(stage=>{
    const picture=card.pictures.find(p=>p.part===part.name&&p.stage===stage);
    const count_=Number(picture?.comments)>0?`<span class="cnt"><span aria-hidden="true">${esc(count(picture.comments))}</span>${sr(label("Projects",11,lang,{n:count(picture.comments)}))}</span>`:"";
    const flag=picture?.not_current?`<span class="flag">${icon("i-warn")}<span>${esc(words[6])}</span>${sr(notCurrentWhy(picture.not_current,picture.commit,lang))}</span>`:"";
    const pic=picture?`<span class="pic">${picture.drawing?drawingSVG(picture.drawing):""}${count_}${flag}</span>`:`<span class="pic none"><span>${esc(words[5])}</span></span>`;
    return`<a class="thumb" href="${esc(stagePath(card.name,part.name,stage))}">${pic}<span class="cap">${several&&part.name?esc(part.name)+" · ":""}${esc(stageLabel(stage,lang))}</span></a>`;
  })).join("")}</div>`;
}

// One row of the 13 stages for each part: a shape and a word each (rule 13), and how many
// there are of each state.
function strips(card,lang){
  const several=card.parts.length>1;
  return card.parts.map(part=>{
    const states=STAGE_KEYS.map((key,index)=>stateOf(part.states[index]));
    const marks=STAGE_KEYS.map((key,index)=>`<span class="mk" title="${esc(stageLabel(key,lang))}">${shapeIcon(states[index])}${sr(`${stageLabel(key,lang)}: ${legendWord(states[index],lang)}`)}</span>`).join("");
    const tally=STATES.map(state=>[state,states.filter(s=>s===state).length]).filter(([,n])=>n).map(([state,n])=>`<span class="tl">${shapeIcon(state)}${sr(legendWord(state,lang))}<b>${n}</b></span>`).join("");
    return`<div class="strip">${several&&part.name?`<span class="lbl">${esc(part.name)}</span>`:""}${marks}<span class="tally">${tally}</span></div>`;
  }).join("");
}

// A project's card: in the place of the snapshot's commit and time, the last push with its
// commit and the agent's last read of the project, or "No agent to-do yet" without a space, with
// the mark of a long wait (rules 19 and 20). agent is the project's row of API-151's agent, if any.
function card(item,index,view,lang,agent,base){
  const words=labels("Projects",lang),id=`pc-${index}`,title=item.title||item.name;
  const repository=item.repository?String(item.repository).replace(/^https:\/\/github\.com\//,""):"";
  const pushed=view.pushed?.[item.name];
  const times=`<div class="ptimes"><div class="loop"><span>${lastPush(item.commit,item.pushed_at,base,lang)}</span><span>${lastRead(Boolean(agent),agent?.read_at,base,lang)}</span></div>${longWait(agent?.unread_since,base,lang)}</div>`;
  return`<article class="pcard" aria-labelledby="${id}"><header><h3 id="${id}">${esc(title)}</h3>${repository?`<span class="mu sm clip">${esc(repository)}</span>`:""}${pushed?`<span class="kind acc">${timed(words[7],pushed)}</span>`:""}</header>${times}${now(item,lang)}${thumbs(item,lang)}${strips(item,lang)}<footer><span>${esc(label("Projects",8,lang,{n:count(item.items)}))} · ${esc(label("Projects",9,lang,{n:count(item.warnings)}))}</span><a class="btn sm" id="${id}-open" href="${esc(path("p",item.name))}" aria-labelledby="${id}-open ${id}" data-nx-focus="open:${esc(item.name)}">${esc(words[10])}</a></footer></article>`;
}

function projects(data,view,lang){
  const words=labels("Projects",lang),byPush=view.order==="push";
  const list=byPush?[...data.projects].sort((a,b)=>String(b.pushed_at).localeCompare(String(a.pushed_at))||a.name.localeCompare(b.name)):data.projects;
  const agents=new Map(data.agent.map(row=>[row.project,row]));
  const wait=view.code?"":` disabled data-nx-wait="order"`;
  const order=[["name",1],["push",2]].map(([value,index])=>`<button type="button" data-nx-act="order" data-nx-order="${value}" data-nx-focus="order:${value}" aria-pressed="${(value==="push")===byPush}"${wait}>${esc(words[index])}</button>`).join("");
  return`<section class="full projs" aria-labelledby="projs-h" data-nx-key="projs"><div class="sech flat"><h2 id="projs-h">${esc(label("Projects",0,lang,{n:count(data.projects.length)}))}</h2><span class="seg">${order}</span></div><div class="cards">${list.map((item,index)=>card(item,index,view,lang,agents.get(item.name),data.generated_at)).join("")}</div></section>`;
}

// A server without a snapshot: SCR-101#empty's words and the four steps (REQ-223).
function nothingPushed(lang){
  const [lead,line,...steps]=labels("Nothing pushed",lang);
  return`<section class="sec full emp" data-nx-key="empty"><div class="pad"><p class="lead">${esc(lead)}</p><p class="mu">${esc(line)}</p><ol class="hsteps">${steps.map(step=>`<li><span>${backticks(step)}</span></li>`).join("")}</ol></div></section>`;
}

// The inside of the first page's main element. data is API-151's answer.
export function drawHome(data,lang,view={}){
  if(!data||!Array.isArray(data.projects)||!Array.isArray(data.agent)||!Array.isArray(data.my_turn?.entries))throw new Error("Unreadable page data");
  if(!data.projects.length)return notes(view,lang)+nothingPushed(lang);
  const titles=new Map(data.projects.map(item=>[item.name,item.title||item.name]));
  return notes(view,lang)+myTurn(data,view,titles,lang)+agentTodo(data,titles,lang)+projects(data,view,lang);
}
