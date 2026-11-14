// The talk in the workspace's side (SCR-114): a stage's comments and proposals by turn, what
// waits for the user first, then what waits for the agent, with whether a session took it, the
// comments whose item is gone and the closed talk, folded; narrowed to a selected item; and the
// box that leaves a comment on the item or on the stage as a whole. The server draws it from the
// page's talk, API-152's answer, and the view's code draws it again with what it adds (state):
// the talk narrowed to an item, the entry opened with its replies or its change (API-114,
// API-115), each write's state and message, and the closed talk read 50 at a time. Every element
// that the code compares when it draws again has data-nx-key; data-nx-sub marks one whose children
// it compares one by one, and data-nx-live one whose text it changes in place
// (../../ui/reconcile.js). Before the code runs the controls that need it wait, disabled. The
// item's panel (./item.js, SCR-115) holds the same body and box under its trace.
import {esc,count,time,timed,dated} from "./html.js";
import {icon} from "./icons.js";
import {label,labels,codeMessage,capital} from "./words.js";
import {stageName,stageNumber} from "./stages.js";
import {words} from "../../ui/messages.js";

export const TALK_LIMIT=4000;
// The characters left show from 90 per cent of the limit (rule 5).
export const leftOf=n=>n>=TALK_LIMIT*.9&&n<=TALK_LIMIT?TALK_LIMIT-n:null;
const sr=text=>`<span class="sr">${esc(text)}</span>`;
const https=value=>typeof value==="string"&&/^https:\/\/[^\s"'<>]+$/.test(value)&&value.length<=2000?value:null;
const TRACE=/^[A-Z][A-Z0-9]*-[0-9]{1,6}$/;

// A part's stage's checkpoint request (SPEC-197): its open comment on the stage as a whole whose
// last entry, the agent's, asks for the checkpoint. That entry is the agent's last reply where
// the comment has one, else the comment's own text; place is 0 for the comment's own text and
// otherwise the reply's seq, which a pass is to name (SPEC-194, TASK-301). look_first is null for
// a request stored before the design revision, which shows as it is (SCR-112, SCR-114).
export function requestOf(comment){
  if(!comment||comment.asks!=="checkpoint"||comment.state!=="open"||comment.item)return null;
  const last=comment.last_reply?.author==="agent"?comment.last_reply:null;
  return last?{place:Number(last.seq)||0,text:String(last.text??""),made_at:last.made_at,look_first:last.look_first??null}
    :{place:0,text:String(comment.text??""),made_at:comment.made_at,look_first:comment.look_first??null};
}
// The stage's checkpoint request in the talk that the page holds, the stage's whole talk: the
// first of my turn, as API-152 orders it (SPEC-143), with its comment.
export function stageRequest(talk){
  const row=(Array.isArray(talk?.mine?.entries)?talk.mine.entries:[]).find(entry=>entry?.kind==="comment"&&requestOf(entry.comment));
  return row?{comment:row.comment,...requestOf(row.comment)}:null;
}
// The thing to look at first (rule 22), on a line of its own after "Look at first": an item's ID,
// a link to the item's panel at #item=, which the stage that holds the item opens (SCR-115); or
// an https address as text, its host and what follows cut after 120 characters, which opens only
// when pressed, in a new tab without a referrer, and which the page never loads. A stage's page
// names no title: it holds titles only for the rows that its list read, which each filter
// changes. Anything else shows nothing. focus names the link for the focus that the code keeps.
export function lookFirst(value,lang,focus){
  let link="";
  if(typeof value==="string"&&value.length<=30&&TRACE.test(value))link=`<a class="lnk" href="#item=${encodeURIComponent(value)}" data-nx-act="look" data-nx-item="${esc(value)}" data-nx-focus="${esc(focus)}"><span class="mono">${esc(value)}</span></a>`;
  else if(https(value)){const shown=Array.from(value.slice(8)),text=shown.length>120?shown.slice(0,120).join("")+"…":shown.join("");link=`<a class="lnk" href="${esc(value)}" target="_blank" rel="noopener noreferrer" data-nx-focus="${esc(focus)}">${esc(text)}</a>`;}
  return link?`<p class="look" data-nx-key="look"><span class="mu">${esc(label("A checkpoint request, whole",0,lang))}</span> ${link}</p>`:"";
}

// An entry as the talk draws it: a comment, a proposal or a pending reflection, by its ID. My turn
// and the closed talk hold API-152's TalkEntry, {kind, comment, proposal}; the agent's turn and
// the comments apart hold comments; a reflection is an edit with its proposal.
export function entryOf(row,type){
  if(type==="reflection")return{id:String(row.id),type,edit:row,proposal:row.proposal||null,comment:null};
  if(row?.kind==="proposal"&&row.proposal)return{id:String(row.proposal.id),type:"proposal",proposal:row.proposal,comment:null};
  if(row?.kind==="comment"&&row.comment)return{id:String(row.comment.id),type:"comment",comment:row.comment,proposal:null};
  return{id:String(row.id),type:"comment",comment:row,proposal:null};
}
const rows=(talk,key)=>Array.isArray(talk?.[key]?.entries)?talk[key].entries:[];
const reflections=talk=>Array.isArray(talk?.reflections)?talk.reflections:[];
// The turns as the talk lists them: the agent's turn holds the pending reflections after the
// comments, since reflecting an accepted proposal is the agent's work too.
export function talkGroups(talk){
  return{mine:rows(talk,"mine").map(row=>entryOf(row)),agent:[...rows(talk,"agent").map(row=>entryOf(row)),...reflections(talk).map(row=>entryOf(row,"reflection"))],
    apart:rows(talk,"apart").map(row=>entryOf(row)),closed:rows(talk,"closed").map(row=>entryOf(row))};
}
export const agentCount=talk=>(Number(talk?.agent?.total)||0)+reflections(talk).length;
// An entry's kind on my turn (SCR-110's): a proposal, or a comment by what it asks of the user.
export const kindOf=entry=>entry.type!=="comment"?0:entry.comment.asks==="recommended"?2:entry.comment.asks==="checkpoint"?3:1;
// The items that an entry is on: a comment's item, or a proposal's.
export const itemsOf=entry=>entry.type==="comment"?(entry.comment.item?[String(entry.comment.item)]:[]):(Array.isArray(entry.proposal?.items)?entry.proposal.items.map(String):[]);
// The talk of one item, as API-152 narrows it, from the talk that the page holds: the view shows
// it at once, until the server's answer, which also counts the item's closed talk, comes.
export function narrowTalk(talk,item){
  const on=row=>itemsOf(entryOf(row)).includes(item),list=key=>{const entries=rows(talk,key).filter(on);return{total:entries.length,entries};};
  return{...talk,item,mine:list("mine"),agent:list("agent"),apart:list("apart"),closed:{total:null,entries:[]},reflections:reflections(talk).filter(edit=>Array.isArray(edit.proposal?.items)&&edit.proposal.items.includes(item))};
}

// A message in the talk (rule 3): its code's words, the trace ID, and its buttons, each a code's
// act that the talk's code runs where the message is: Try again sends the same write again.
function message(note,lang,focus){
  if(!note)return"";
  const tone=["info","warn","err"].includes(note.tone)?note.tone:"err",buttons=labels("Page buttons",lang),row=[];
  if(note.retry)row.push(`<button class="btn sm" type="button" data-nx-act="${esc(note.retry)}" data-nx-focus="${esc(focus)}:retry">${icon("i-reload")}${esc(buttons[0])}</button>`);
  if(note.newComment)row.push(`<button class="btn sm" type="button" data-nx-act="new-comment" data-nx-focus="${esc(focus)}:new">${esc(label("The box",3,lang))}</button>`);
  if(note.signIn)row.push(`<button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="${esc(focus)}:sign-in">${esc(buttons[2])}</button>`);
  if(note.here)row.push(`<a class="lnk" href="${esc(note.here)}">${esc(buttons[3])}</a>`);
  return`<div class="msg ${tone}" role="${tone==="err"?"alert":"status"}">${icon(tone==="err"?"i-err":tone==="warn"?"i-warn":"i-info")}<div><span class="t">${esc(note.text)}</span>${note.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:note.trace}))}</span>`:""}${row.length?`<div class="row">${row.join("")}</div>`:""}</div></div>`;
}
const who=(author,at,lang)=>{const words=labels("Author and time",lang);return`${esc(words[author==="agent"?0:2])} · ${time(at)}`;};
// Two versions of one row of 0.2's words, such as "Could not load": the comment's, then the
// proposal's.
const version=(key,lang,index)=>words(key,lang).split(lang==="ko"?" 또는: ":" Or: ")[index]||words(key,lang);
const STATES=Object.freeze(["open","accepted","dismissed","withdrawn"]);
// How a reflection stands, in 0.2's words (SCR-108).
function reflectionWords(edit,lang){
  const pr=https(edit?.pull_request)||String(edit?.pull_request||"");
  if(edit?.state==="in-review")return words("Reflection in review",lang,{"pull request":pr});
  if(edit?.state==="needs-user")return words("Reflection needs user",lang);
  if(edit?.state==="closed")return edit.pull_request?words("Reflection by pull request",lang,{"pull request":pr}):words("Reflection already in source",lang,{commit:String(edit.closed_commit||"").slice(0,7)});
  if(edit?.state==="dismissed")return words("Reflection dismissed",lang);
  return words("Reflection pending",lang);
}
// What a closed entry ended as: a comment closed as answered or with a decision, or a proposal
// accepted, dismissed or withdrawn.
function closedAs(entry,lang){
  if(entry.type==="comment")return label("The talk's entries",entry.comment.closed_as==="decided"?3:2,lang);
  const at=STATES.indexOf(entry.proposal?.state);
  return at===1||at===2?label("Answered",at-1,lang):capital(labels("Proposal states",lang)[at<0?0:at],lang);
}

// The thing that an entry's head names, which opens it: its items' IDs, or the stage as a whole.
function place(entry,lang){
  const items=itemsOf(entry);
  if(!items.length)return`<span class="mu">${esc(label("An entry's place",0,lang))}</span>`;
  const shown=items.slice(0,3).map(id=>`<span class="mono">${esc(id)}</span>`).join(" ");
  return items.length>3?`${shown} <span class="mu">${esc(label("More",0,lang,{n:count(items.length-3)}))}</span>`:shown;
}
// The answers of an entry of my turn, as on SCR-110: a proposal's Accept and Dismiss; a
// recommendation's As recommended; a checkpoint request's Stage record, its first and filled
// button, which opens the stage's record that passes it, since the talk itself passes no
// checkpoint (SCR-114's revision, TASK-302); then Reply, which opens the entry here and which an
// opened entry no longer needs.
const ANSWERS=Object.freeze([[["accept",0],["dismiss",1]],[],[["recommended",2]],[]]);
const OPENS=Object.freeze([null,["reply-open",3],["reply-open",3],["reply-open",3]]);
function acts(entry,group,lang,state,code,tx){
  const id=esc(entry.id),es=state.entries?.[entry.id]||{},answers=labels("Answers",lang),wait=code?(es.sending?' aria-disabled="true"':""):' disabled data-nx-wait="talk"';
  const button=(act,text,primary)=>`<button class="btn sm${primary?" pri":""}" type="button" data-nx-act="${act}" data-nx-focus="${id}:${act}" aria-describedby="${tx}"${wait}>${esc(es.sending===act?codeMessage("Sending",lang):text)}</button>`;
  if(es.done)return"";
  const out=[];
  if(group==="mine"){
    const kind=kindOf(entry);
    if(kind===3)out.push(`<button class="btn sm pri" type="button" data-nx-act="record" data-nx-focus="${id}:record" aria-describedby="${tx}"${code?"":' disabled data-nx-wait="talk"'}>${icon("i-record")}${esc(labels("The head",lang)[4])}</button>`);
    ANSWERS[kind].forEach(([act,index],n)=>out.push(button(act,answers[index],n===0)));
    if(OPENS[kind]&&state.open!==entry.id)out.push(button(OPENS[kind][0],answers[OPENS[kind][1]],false));
  }else if(entry.type==="reflection"&&entry.edit.state==="needs-user")out.push(button("dismiss-edit",answers[1],false));
  return out.length?`<div class="acts" data-nx-key="acts">${out.join("")}</div>`:"";
}
// An entry's answer in place and its message (choice 19, rule 3).
function after(entry,lang,state){
  const id=esc(entry.id),es=state.entries?.[entry.id]||{},parts=[];
  if(Number.isInteger(es.mark))parts.push(`<p class="res">${icon("i-check")}<span>${esc(label("Answered",es.mark,lang))}</span></p>`);
  if(es.note)parts.push(message(es.note,lang,entry.id));
  return parts.length?`<div class="after" data-nx-key="after" tabindex="-1" data-nx-focus="${id}:after">${parts.join("")}</div>`:"";
}
// A reply as the thread shows it, with "This settles it" on the one that does, and "New" on the
// agent's replies that came after the entry opened (SCR-114#stale).
function reply(row,lang,fresh){
  const settles=row.settles?` <span class="kind">${esc(words("Settles it",lang))}</span>`:"",now=fresh?` <span class="newt">${esc(words("New reply",lang))}</span>`:"";
  return`<div class="rep"><span class="who">${who(row.author,row.made_at,lang)}</span>${settles}${now}<p>${esc(row.text)}</p></div>`;
}
const skeleton=`<div class="sk" aria-hidden="true"><span class="skel"></span><span class="skel short"></span></div>`;
// An opened comment: its replies and decisions, as API-114 gives them, and while they load the
// last reply with the others' place (SCR-114#loading).
function thread(entry,lang,state){
  const id=esc(entry.id),view=state.threads?.[entry.id]||{state:"loading"},last=entry.comment.last_reply;
  if(view.state==="failed")return`<div class="tload" data-nx-key="reps">${message({tone:"err",text:version("Could not load",lang,0),trace:view.trace,retry:"reload-entry"},lang,entry.id+":load")}</div>`;
  if(view.state!=="ready")return`<div class="reps" data-nx-key="reps">${skeleton}${last?reply(last,lang,false):""}${sr(words("Loading the replies",lang))}</div>`;
  const data=view.data||{},seen=new Set(view.seen||[]),replies=Array.isArray(data.replies)?data.replies:[],decisions=Array.isArray(data.decisions)?data.decisions:[];
  const list=replies.map(row=>reply(row,lang,row.author==="agent"&&!seen.has(row.seq))).join("")+decisions.map(row=>{const link=https(row.link);return`<div class="rep dec"><span class="who">${who("agent",row.made_at,lang)}</span><p>${esc(row.text)}</p>${link?`<a class="lnk clip" href="${esc(link)}" rel="noreferrer">${esc(link)}</a>`:""}</div>`;}).join("");
  return`<div class="reps" data-nx-key="reps" id="th-${id}">${list||`<p class="mu">${esc(words("No replies",lang))}</p>`}</div>`;
}
// An entry of the agent's turn that the agent has not read yet says so (SPEC-189), as the server
// works it out: one that a session took never does.
const notRead=(row,lang)=>row?.unread&&!row.claim?.claimed_at?` <span class="nrd">${esc(label("Not read, on an entry",0,lang))}</span>`:"";
// How a reflection stands, with the mark of SPEC-189 while it waits unread.
const reflectionLine=(edit,lang)=>`<p class="rst" data-nx-key="rst">${icon("i-info")}<span>${esc(reflectionWords(edit,lang))}${notRead(edit,lang)}</span></p>`;
// An opened proposal or reflection: its change, reason and stage source text in its own box
// (SCR-108's content), and how its reflection stands.
function change(entry,lang,state){
  const p=entry.proposal||{},view=state.threads?.[entry.id]||{state:"loading"},heads=words("Proposal panel",lang).split(" · ");
  if(view.state==="failed")return`<div class="tload" data-nx-key="chg">${message({tone:"err",text:version("Could not load",lang,1),trace:view.trace,retry:"reload-entry"},lang,entry.id+":load")}</div>`;
  const full=view.state==="ready"?view.data||{}:{},source=typeof full.source_text==="string"?`<pre class="stx">${esc(full.source_text)}</pre>`:skeleton;
  const edit=entry.edit||view.edit||null,commit=p.commit?`<span class="mu cap">${esc(heads[3].replace("{commit}",String(p.commit).slice(0,7)))}</span>`:"";
  const reflected=edit?reflectionLine(edit,lang):"";
  return`<div class="chg" data-nx-key="chg"><b>${esc(heads[0])}</b><p>${esc(p.change||"")}</p><b>${esc(heads[1])}</b><p>${esc(p.reason||"")}</p><b>${esc(heads[2])}</b>${source}${commit}${view.state==="ready"?"":sr(codeMessage("Updating",lang))}</div>${reflected}`;
}
// An opened comment's reply box (SPEC-127): the reply, "This settles it", and Reply, or on a
// closed comment "Reply and open again"; Mark answered on an open one. The words and the box's
// state stay in the browser (rule 5); the code fills them in after it draws.
function replyBox(entry,lang,state){
  const id=esc(entry.id),box=state.replies?.[entry.id]||{},closed=entry.comment.state==="closed",sending=box.sending;
  const left=box.over?esc(codeMessage("text_too_long",lang,{limit:TALK_LIMIT.toLocaleString("en-US")})):Number.isInteger(box.left)?esc(codeMessage("Characters left",lang,{n:box.left})):"";
  // An empty box's button stays where the focus can reach it, unavailable, so that the focus
  // stays on it after a send empties the box; over the limit it is disabled.
  const off=box.over?" disabled":box.empty!==false||sending?' aria-disabled="true"':"";
  const send=sending==="reply"?codeMessage("Sending",lang):closed?words("Open again",lang):labels("Answers",lang)[3];
  const answered=closed?"":`<button class="btn sm" type="button" data-nx-key="ans" data-nx-act="answered" data-nx-focus="${id}:answered"${sending?' aria-disabled="true"':""}>${esc(sending==="answered"?codeMessage("Sending",lang):label("The talk's entries",0,lang))}</button>`;
  return`<div class="rbox" data-nx-key="rbox" data-nx-sub><div class="rnote" data-nx-key="rnote">${message(box.note,lang,entry.id+":reply")}</div><label class="lab" for="rp-${id}" data-nx-key="rlab">${esc(labels("Answers",lang)[3])}</label><textarea class="ta" id="rp-${id}" name="reply" rows="2" data-nx-key="rta" data-nx-focus="${id}:text" aria-describedby="rp-left-${id}"></textarea><p class="left" id="rp-left-${id}" data-nx-key="rleft" data-nx-live>${left}</p><div class="r2" data-nx-key="rr2" data-nx-sub><label class="chk" data-nx-key="chk"><input type="checkbox" name="settles" data-nx-focus="${id}:settles"><span>${esc(words("Settles it",lang))}</span></label><span class="sp" data-nx-key="sp"></span>${answered}<button class="btn sm pri" type="button" data-nx-key="rep" data-nx-act="reply" data-nx-focus="${id}:reply"${off}>${esc(send)}</button></div></div>`;
}
// The line of an entry that waits for the agent (SPEC-136): since when, with "Not read by the agent
// yet" while it waits unread (SPEC-189), or when a session took it. A reflection says how it stands
// instead of since when (SCR-114#normal), and when a session took it.
function waitLine(row,since,lang){
  if(row?.claim?.claimed_at)return`<p class="wt" data-nx-key="wt">${icon("i-lock")}<span>${timed(label("Waiting",1,lang),row.claim.claimed_at)}</span></p>`;
  return since?`<p class="wt" data-nx-key="wt">${icon("i-dot")}<span>${timed(label("Waiting",0,lang),since)}${notRead(row,lang)}</span></p>`:"";
}

// One entry of the talk: its kind on my turn, the thing that it is on, which opens it, its author
// and time, its quote, its text and last reply; opened, its thread or change and its reply box;
// on the agent's turn its wait; its answers and its message.
export function drawEntry(entry,group,lang,state={},code=false,copy=false){
  const id=esc(entry.id),es=state.entries?.[entry.id]||{},open=!copy&&state.open===entry.id,wait=code?"":' disabled data-nx-wait="talk"',tx=`tx-${id}${copy?"-2":""}`;
  const cls=["te",group==="mine"&&!es.done?"my":"",group==="apart"?"apart":"",es.done||group==="closed"?"answered":""].filter(Boolean).join(" ");
  const c=entry.comment,p=entry.proposal,made=c?c.made_at:entry.type==="reflection"?entry.edit.made_at:p?.made_at;
  const chip=group==="mine"?`<span class="kind acc">${esc(labels("An entry's kind",lang)[kindOf(entry)])}</span>`:group==="closed"?`<span class="kind">${esc(closedAs(entry,lang))}</span>`:"";
  const head=`<div class="hd" data-nx-key="hd">${chip}<button class="ref" type="button" data-nx-act="entry" data-nx-focus="talk:${id}${copy?":2":""}" aria-expanded="${open}" aria-describedby="${tx}"${wait}><span class="clip">${place(entry,lang)}</span></button><span class="who">${who(c?c.author:entry.type==="reflection"?"user":"agent",made,lang)}</span></div>`;
  const quote=c?.quote?`<p class="qt" data-nx-key="qt">“${esc(c.quote)}”</p>`:"";
  const text=`<p class="tx" id="${tx}" data-nx-key="tx">${esc(c?c.text:p?.change||"")}</p>`;
  let body="";
  if(open)body=c?thread(entry,lang,state):change(entry,lang,state);
  else if(c?.last_reply)body=`<div class="reps" data-nx-key="last">${reply(c.last_reply,lang,false)}</div>`;
  else if(entry.type==="reflection")body=reflectionLine(entry.edit,lang);
  // Opened, an entry whose item the stage no longer holds says so, and selects nothing (SPEC-209).
  const gone=open&&group==="apart"&&itemsOf(entry).length?`<div data-nx-key="gone-item">${message({tone:"info",text:label("An item that the talk selects",0,lang,{id:itemsOf(entry)[0]})},lang,entry.id+":gone")}</div>`:"";
  const waits=group!=="agent"?"":c?waitLine(c,c.last_at,lang)+(c.settled?`<p class="wt" data-nx-key="settled">${icon("i-check")}<span>${esc(label("The talk's entries",1,lang))}</span></p>`:""):waitLine(entry.edit,null,lang);
  // A checkpoint request of my turn: the thing to look at first of its last entry, after its text
  // and its last reply (SCR-114#normal, rule 22); a request stored without the form has none.
  const request=group==="mine"&&c?requestOf(c):null,look=request?lookFirst(request.look_first,lang,`${entry.id}:look${copy?":2":""}`):"";
  const box=open&&c?replyBox(entry,lang,state):"";
  return`<li class="${cls}" data-nx-key="e:${id}" data-nx-entry="${id}" data-nx-sub>${head}${quote}${text}${body}${look}${gone}${waits}${copy?"":acts(entry,group,lang,state,code,tx)+after(entry,lang,state)}${box}</li>`;
}

// The switch between the talk and the item's panel (SCR-115's head), from 1,024 pixels while an
// item is selected; under 1,024 the tabs do it (rule 16). Only the view's code draws it, since
// only the address after # selects an item.
export function sideSwitch(on,lang){
  const button=(mode,text,name)=>`<button type="button" data-nx-act="side" data-nx-side="${mode}" data-nx-focus="side:${mode}" aria-pressed="${on===mode}">${name?icon(name):""}<span>${esc(text)}</span></button>`;
  return`<span class="seg sw only-pc" data-nx-key="sw">${button("talk",labels("The talk",lang)[0],"i-talk")}${button("item",labels("Tabs",lang)[3],"")}</span>`;
}
// The talk's head: "Talk", or "Talk on {id}" with "All talk of the stage" (SCR-114#narrowed), the
// stage, and the two turns' counts, which take the talk to their groups. sw: the switch to the
// item's panel, while an item is selected.
function head(talk,data,lang,code,sw){
  const names=labels("The talk",lang),item=talk.item,mine=Number(talk.mine?.total)||0,agent=agentCount(talk),groups=talkGroups(talk);
  // A turn's count leads to its group, when the talk lists one.
  const turn=(key,text,shown)=>shown?`<a${key==="mine"?' class="mine"':""} href="#t-${key}" data-nx-act="turn" data-nx-turn="${key}" data-nx-focus="turn:${key}">${esc(text)}</a>`:`<span${key==="mine"?' class="mine"':""}>${esc(text)}</span>`;
  const whole=item?`<button class="btn quiet sm" type="button" data-nx-act="whole" data-nx-focus="whole"${code?"":' disabled data-nx-wait="talk"'}>${icon("i-back")}<span>${esc(label("Narrowed",1,lang))}</span></button>`:"";
  // From 1,024 to 1,279 pixels the talk is a panel, which Close folds (SCR-111's actions): a
  // link to the stage, which works before the code runs too, as the list of stages' Close.
  const close=`<a class="ib only-mid" href="#stage" data-nx-act="talk-close" data-nx-focus="talk-close">${icon("i-close")}<span class="sr">${esc(labels("Top bar",lang)[5])}</span></a>`;
  // From 1,280 pixels the talk is a column, which this folds to "Talk ({n})" in the stage's head
  // (SPEC-210); whenever it shows, the talk is shown.
  const folds=labels("The folds",lang),fold=`<button class="btn sm icon fold-t" type="button" data-nx-act="fold-talk" data-nx-focus="fold-talk" aria-controls="talk" aria-expanded="true" title="${esc(folds[2])}"${code?"":' disabled data-nx-wait="talk"'}>${icon("i-next")}<span class="sr">${esc(folds[2])}</span></button>`;
  return`<div class="th" data-nx-key="th" data-nx-sub><div class="r1" data-nx-key="r1"><h2 id="talk-h" tabindex="-1" data-nx-focus="talk-h">${esc(item?label("Narrowed",0,lang,{id:item}):names[0])}</h2><span class="mu sm">${esc(stageNumber(data.stage)+" "+stageName(data.stage,lang))}</span><span class="sp"></span>${whole}${sw?sideSwitch("talk",lang):""}${fold}${close}</div><div class="turns" data-nx-key="turns">${turn("mine",label("The talk",1,lang,{n:count(mine)}),groups.mine.length)}${turn("agent",label("The talk",2,lang,{n:count(agent)}),groups.agent.length)}</div></div>`;
}
// The notes at the top of the talk: an address or a link that names an entry not on the server
// (SCR-114#gone), and a reading again that failed or was refused (rule 6, SCR-114#error).
function notes(state,lang){
  const out=(state.notes||[]).map((note,index)=>message(note,lang,"talk-note-"+index)).join("");
  return`<div class="tnotes" data-nx-key="notes">${out}</div><p class="tupd" role="status" data-nx-key="upd" data-nx-live>${state.updating?esc(codeMessage("Updating",lang)):""}</p>`;
}
// The closed talk, folded until the user opens it, then newest first, 50 at a time with Show
// more, "Loading more…" or "Could not load more." with Try again.
function closedTalk(talk,lang,state,code,seen){
  const total=Number(state.closed?.total??talk.closed?.total)||0,open=Boolean(state.closed?.open),list=state.closed?.entries||[];
  if(!total&&!list.length)return"";
  const fold=`<button class="tg fold" type="button" data-nx-key="h-closed" data-nx-act="closed" data-nx-focus="closed" aria-expanded="${open}"${code?"":' disabled data-nx-wait="talk"'}><span>${esc(label("The talk",5,lang,{n:count(total)}))}</span>${icon("i-down")}</button>`;
  if(!open)return fold;
  const entries=list.map(row=>{const entry=entryOf(row);return drawEntry(entry,"closed",lang,state,code,seen.has(entry.id));}).join(""),more=state.closed?.more,list2=labels("The list",lang);
  let tail="";
  if(more==="loading")tail=esc(list2[10]);
  else if(more==="failed")tail=`${esc(list2[11])} <button class="btn sm" type="button" data-nx-act="closed-more" data-nx-focus="closed-more">${icon("i-reload")}${esc(labels("Page buttons",lang)[0])}</button>`;
  else if(list.length<total)tail=`<button class="btn sm" type="button" data-nx-act="closed-more" data-nx-focus="closed-more">${esc(label("The talk",6,lang))}</button>`;
  return`${fold}${entries?`<ol class="tl" data-nx-key="l-closed" data-nx-sub>${entries}</ol>`:""}${tail?`<p class="more" data-nx-key="cmore" data-nx-live>${tail}</p>`:""}`;
}
// The box at the talk's foot (rule 18): a comment on the selected item, on one of its discrepancies
// (SCR-115), or on the stage as a whole, up to 4,000 characters, with Leave, and the agent's time
// to read it.
export function talkBox(talk,lang,state={},code=false){
  const b=state.box||{},said=labels("The box",lang),item=talk.item||"";
  const named=item&&b.discrepancy?label("The item",5,lang):item?words("Comment on",lang,{id:item}):said[0];
  const left=b.over?esc(codeMessage("text_too_long",lang,{limit:TALK_LIMIT.toLocaleString("en-US")})):Number.isInteger(b.left)?esc(codeMessage("Characters left",lang,{n:b.left})):"";
  // Before the code runs, Leave waits, disabled, and is unavailable as the empty box's is once
  // the code runs, so that the code's first drawing finds it as it draws it (rule 15).
  const off=!code?' aria-disabled="true" disabled data-nx-wait="talk"':b.over?" disabled":b.empty!==false||b.sending?' aria-disabled="true"':"";
  return`<div class="box" data-nx-key="box" data-nx-sub><div class="bnote" data-nx-key="bnote">${message(b.note,lang,"box")}</div><label class="lab" for="talk-text" data-nx-key="lab">${esc(named)}</label><textarea class="ta" id="talk-text" name="text" rows="2" data-nx-key="ta:${esc(item)}" data-nx-focus="talk-text" aria-describedby="talk-left talk-hint"${code?"":' disabled data-nx-wait="talk"'}></textarea><p class="left" id="talk-left" data-nx-key="left" data-nx-live>${left}</p><div class="r2" data-nx-key="r2"><span class="mu" id="talk-hint">${esc(said[2])}</span><button class="btn pri" type="button" data-nx-act="leave" data-nx-focus="leave"${off}>${esc(b.sending?codeMessage("Sending",lang):said[1])}</button></div></div>`;
}

// The talk's body: its notes, the words of no talk, the turns' groups and the closed talk. level is
// the groups' heading level: 3 in the talk, 4 under the item's "Talk on {id}" (SCR-115).
export function talkBody(talk,lang,state={},code=false,level=3){
  const groups=talkGroups(talk),item=talk.item||null,seen=new Set(),h=level===4?"h4":"h3";
  // An entry drawn twice, such as a kept answer that the closed talk lists too, opens only once.
  const one=(entry,key)=>{const copy=seen.has(entry.id);seen.add(entry.id);return drawEntry(entry,key,lang,state,code,copy);};
  const group=(key,heading,list)=>list.length?`<${h} class="tg" id="t-${key}" data-nx-key="h-${key}">${esc(heading)}</${h}><ol class="tl" data-nx-key="l-${key}" data-nx-sub>${list.map(entry=>one(entry,key)).join("")}</ol>`:"";
  // No talk yet (SCR-114#empty): nothing open and nothing closed; closed talk alone shows its
  // fold under the counts of none.
  const open=groups.mine.length+groups.agent.length+groups.apart.length,closed=Number(state.closed?.total??talk.closed?.total)||state.closed?.entries?.length||0;
  const none=open||closed?"":`<div class="empty-t" data-nx-key="empty">${icon("i-talk")}<p>${esc(item?label("No talk",1,lang,{id:item}):label("No talk",0,lang))}</p></div>`;
  return notes(state,lang)+none+group("mine",label("My turn",0,lang,{n:count(talk.mine?.total)}),groups.mine)+group("agent",label("The talk",3,lang,{n:count(agentCount(talk))}),groups.agent)+group("apart",label("The talk",4,lang,{n:count(talk.apart?.total)}),groups.apart)+closedTalk(talk,lang,state,code,seen);
}
// The talk (SCR-114): talk is API-152's answer, narrowed or not, that the view shows; data is the
// stage's page data; state is what the view's code adds, and the server draws with none. sw: an
// item is selected, whose panel the switch in the head returns to (SCR-115).
export function drawTalk(talk,data,lang,state={},code=false,{sw=false}={}){
  return`<section class="talk" aria-labelledby="talk-h" data-nx-key="talk" data-nx-sub>${head(talk,data,lang,code,sw)}<div class="body" data-nx-key="body" data-nx-sub>${talkBody(talk,lang,state,code,3)}</div>${talkBox(talk,lang,state,code)}</section>`;
}
