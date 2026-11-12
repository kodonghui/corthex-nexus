// The item in the workspace's side (SCR-115, SPEC-149): its head with the ID, the kind, the switch
// back to the talk and Close; the line on why the stage does not show it where the user looks
// (rule 24); its text as the source has it, in the source's language; its fields in words, with
// the others folded under Details; its context and the place of its source; on a pictured stage
// its open discrepancies, each with "Comment on this discrepancy"; the items that it comes from and
// leads to, by stage; then "Talk on {id}", the talk narrowed to it (SCR-114#narrowed) with "All talk
// of the stage", and the talk's box. The view's code draws it (../../ui/item.js); the server never
// does, since only the address after # selects an item. item is the view's state of it: {id,
// state, data, seed, raw, discrepancies, error, why, open}: state is loading, ready, gone, failed
// or refused; data is API-157's answer; seed is what the row or the picture that the user selected
// shows of it until data comes; raw is the picture's own fields of it; discrepancies are its open
// ones in the picture (API-111); why is stale, none or narrowed; open holds the stages whose links
// the user unfolded. Every element that the code compares when it draws again has data-nx-key, as
// in the talk (../../ui/reconcile.js).
import {esc,count} from "./html.js";
import {icon} from "./icons.js";
import {label,labels,codeMessage,oldLabels} from "./words.js";
import {stageName,stageNumber,stagePath} from "./stages.js";
import {talkBody,talkBox,sideSwitch} from "./talk.js";
import {FIELDS,itemFields,reasonText} from "../../ui/fields.js";
import {words} from "../../ui/messages.js";

export const KINDS=Object.freeze(["context","term","requirement","flow","spec","table","api","screen","task","test","bug","decision","scene"]);
// An item's kind in words, as the hub page names it; a kind outside the stage contract's as the
// snapshot names it.
export const kindWord=(kind,lang)=>{const at=KINDS.indexOf(kind);return at<0?String(kind??""):labels("An item's kind",lang)[at];};
// A stage's links show their first six, as stage 09 draws them, until the user unfolds them; then
// the 100 that API-157 gives, and the count of the rest.
export const TRACE_FIRST=6;
const WHY=Object.freeze({stale:1,none:2,narrowed:3});
// The list's main fields (SCR-113), for an item that no picture holds.
const MAIN=Object.freeze(["priority","status","type","parent"]);
const https=value=>typeof value==="string"&&/^https:\/\/[^\s"'<>]+$/.test(value)&&value.length<=2000?value:null;
const sr=text=>`<span class="sr">${esc(text)}</span>`;

// A message in the panel (rule 3): its words, the trace ID and its buttons: Try again, which reads
// the item again; Sign in again; Show all, which clears the list's filter and search; and the
// search of every project for the ID.
function message(note,lang){
  const tone=["info","warn","err"].includes(note.tone)?note.tone:"err",buttons=labels("Page buttons",lang),row=[];
  if(note.retry)row.push(`<button class="btn sm" type="button" data-nx-act="item-retry" data-nx-focus="item-retry"${note.waiting?' aria-disabled="true"':""}>${icon("i-reload")}${esc(buttons[0])}</button>`);
  if(note.signIn)row.push(`<button class="btn sm pri" type="button" data-nx-act="sign-in" data-nx-focus="item-sign-in">${esc(buttons[2])}</button>`);
  if(note.showAll)row.push(`<button class="btn sm" type="button" data-nx-act="item-show-all" data-nx-focus="item-show-all">${esc(labels("The list",lang)[7])}</button>`);
  if(note.search)row.push(`<button class="btn sm" type="button" data-nx-act="item-search" data-nx-focus="item-search">${icon("i-search")}${esc(note.search)}</button>`);
  return`<div class="msg ${tone}" role="${tone==="err"?"alert":"status"}">${icon(tone==="err"?"i-err":tone==="warn"?"i-warn":"i-info")}<div><span class="t">${esc(note.text)}</span>${note.trace?`<span class="tid">${esc(codeMessage("Trace ID",lang,{traceId:note.trace}))}</span>`:""}${row.length?`<div class="row">${row.join("")}</div>`:""}</div></div>`;
}

// The fields: on a pictured stage the picture's own fields of the item in words (SCR-106's), else
// the list's main fields; "None" for an empty one, and the source's other fields as Details, but
// its place, which the source's line shows.
export function itemFieldList(item,lang){
  const none=oldLabels("Item values",lang)[0];
  if(item.raw&&typeof item.raw==="object"){
    const shown=new Set(["id","name","title","where",...FIELDS]);
    return{list:itemFields(item.raw,lang).filter(field=>field.field!=="context").map(field=>[field.name,field.text]),rest:Object.fromEntries(Object.entries(item.raw).filter(([key])=>!shown.has(key)))};
  }
  const source=item.data?.item||{},names=labels("List fields",lang),shown=new Set(["id","kind","stage","title","where",...MAIN]);
  const list=MAIN.flatMap((name,index)=>source[name]===undefined?[]:[[names[index],typeof source[name]==="string"&&source[name].trim()?source[name]:none]]);
  return{list,rest:Object.fromEntries(Object.entries(source).filter(([key])=>!shown.has(key)))};
}
function fields(item,lang){
  const {list,rest}=itemFieldList(item,lang);
  const dl=list.length?`<dl class="fields" data-nx-key="fields">${list.map(([name,value])=>`<dt>${esc(name)}</dt><dd>${esc(value)}</dd>`).join("")}</dl>`:"";
  const more=Object.keys(rest).length?`<details class="det" data-nx-key="det"><summary data-nx-focus="item-details">${icon("i-next")}<span>${esc(oldLabels("Item values",lang)[2])}</span></summary><pre class="stx">${esc(JSON.stringify(rest,null,2))}</pre></details>`:"";
  return dl+more;
}
// The context and the place of the source: a link to the file at the snapshot's commit, in a new
// tab and without a referrer, when the settings give the repository's address, else text.
function where(data,lang){
  const context=data.context,source=data.source,out=[];
  if(context?.id)out.push(`<p class="ctx" data-nx-key="ctx">${esc(label("The item",0,lang,{id:context.id,name:context.title??""}).trim())}</p>`);
  if(source?.path){
    const text=Number.isInteger(source.line)?label("The item",1,lang,{path:source.path,n:source.line}):label("The item",7,lang,{path:source.path}),link=https(source.link);
    const place=link?`<a class="lnk" href="${esc(link)}" target="_blank" rel="noreferrer" data-nx-focus="item-source">${icon("i-ext")}<span>${esc(text)}</span></a>`:`<span>${esc(text)}</span>`;
    out.push(`<p class="src" data-nx-key="src">${place}${source.commit?` <span class="mu cap mono">${esc(String(source.commit).slice(0,7))}</span>`:""}</p>`);
  }
  return out.join("");
}
// The open discrepancies on a pictured stage, each reason a sentence, whether it waits for a
// current picture, and "Comment on this discrepancy", which the box then names (SPEC-126).
function discrepancies(item,lang,state){
  const list=Array.isArray(item.discrepancies)?item.discrepancies:[];
  if(!list.length)return"";
  const target=state.box?.discrepancy||null;
  const rows=list.map(d=>{
    const id=esc(d.id),reasons=(Array.isArray(d.reasons)?d.reasons:[]).map(reason=>reasonText(reason,d.compares,lang)).join(" ");
    return`<div class="dsc" data-nx-key="d:${id}"><p>${esc(reasons)}</p>${d.waiting?`<p class="mu cap">${esc(words("Waits",lang))}</p>`:""}<button class="btn sm quiet" type="button" data-nx-act="discrepancy" data-nx-discrepancy="${id}" data-nx-focus="dsc:${id}" aria-pressed="${target===d.id}">${icon("i-talk")}<span>${esc(label("The item",5,lang))}</span></button></div>`;
  }).join("");
  return`<h3 data-nx-key="h-dsc">${esc(label("The item",4,lang,{n:count(list.length)}))}</h3><div class="dscs" data-nx-key="dscs">${rows}</div>`;
}
// "Comes from" or "Leads to": each stage's items with its count, each a link to the item at its
// place in this part of the project (SPEC-122), the first six until the user unfolds the stage.
function trace(key,groups,item,data,lang){
  const list=Array.isArray(groups)?groups:[];
  if(!list.length)return"";
  const total=list.reduce((sum,group)=>sum+(Number(group.total)||0),0),open=item.open?.[key]||[];
  const body=list.map(group=>{
    const stage=String(group.stage),items=Array.isArray(group.items)?group.items:[],unfolded=open.includes(stage),shown=unfolded?items:items.slice(0,TRACE_FIRST);
    const left=Math.max(0,(Number(group.total)||items.length)-shown.length),focus=`t:${key}:${esc(stage)}`;
    const links=shown.map((linked,index)=>`<a class="a" href="${esc(stagePath(data.project.name,data.part,stage)+"#item="+encodeURIComponent(linked.id))}" data-nx-focus="${focus}:${index}"><span class="mono">${esc(linked.id)}</span><span class="clip">${esc(linked.title??"")}</span></a>`).join("");
    const words=esc(label("More",0,lang,{n:count(left)}));
    const more=!left?"":!unfolded&&items.length>shown.length?`<button class="btn quiet sm" type="button" data-nx-act="trace-more" data-nx-trace="${key}" data-nx-stage="${esc(stage)}" data-nx-focus="${focus}:more">${words}</button>`:`<span class="mu cap">${words}</span>`;
    return`<div class="tsg"><p class="sgh"><span>${esc(stageNumber(stage)+" "+stageName(stage,lang))}</span> <span>(${esc(count(group.total))})</span></p>${links}${more}</div>`;
  }).join("");
  return`<h3 data-nx-key="h-${key}">${esc(label("The item",key==="from"?2:3,lang))} <span class="mu">(${esc(count(total))})</span></h3><div class="trace" data-nx-key="t-${key}">${body}</div>`;
}
// What stands in the item's place while it reads, is gone, failed or was refused (SCR-115's states).
function state(item,lang){
  const id=item.id,error=item.error||{};
  if(item.state==="loading")return`<div class="sk" data-nx-key="load" aria-hidden="true"><span class="skel"></span><span class="skel short"></span><span class="skel"></span><span class="skel short"></span></div><p class="sr" role="status" data-nx-key="loading">${esc(label("The item",6,lang,{id}))}</p>`;
  if(item.state==="gone"){
    const [text,search]=words("item_not_found",lang,{id}).split(" · ");
    return`<div data-nx-key="gone">${message({tone:"warn",text,search},lang)}</div>`;
  }
  if(item.state==="refused"){
    const signIn=error.code==="sign_in_expired";
    return`<div data-nx-key="refused">${message({tone:"warn",text:codeMessage(signIn?"Sign-in expired":error.code,lang),trace:signIn?null:error.trace,signIn},lang)}</div>`;
  }
  if(item.state==="failed")return`<div data-nx-key="failed">${message({tone:"err",text:codeMessage({network:"No connection",timeout:"No answer in time",busy:"Busy"}[error.code]||error.code||"internal",lang),trace:error.trace,retry:true},lang)}</div>`;
  return"";
}

// The item's panel: item as above, talk the talk narrowed to it as the side shows it, data the
// stage's page data and state the talk's state, whose box is the panel's foot.
export function drawItem(item,talk,data,lang,state_={}){
  const id=String(item.id),found=item.data||null,known=found?.item||item.seed||{},kind=kindWord(known.kind,lang),title=known.title;
  const head=`<div class="ih" data-nx-key="ih"><h2 id="item-h" tabindex="-1" data-nx-focus="item-h">${sr(labels("Tabs",lang)[3]+" ")}<span class="id">${esc(id)}</span></h2>${kind?`<span class="kind">${esc(kind)}</span>`:""}<span class="sp"></span>${sideSwitch("item",lang)}<button class="ib" type="button" data-nx-act="item-close" data-nx-focus="item-close">${icon("i-close")}${sr(labels("Top bar",lang)[5])}</button></div>`;
  const gone=item.state==="gone";
  // Why the stage does not show the item where the user looks (SCR-115's revision), but on an
  // item that no stage holds, which nothing shows.
  const why=!gone&&WHY[item.why]?`<div data-nx-key="why">${message({tone:"info",text:label("An item that the talk selects",WHY[item.why],lang),showAll:item.why==="narrowed"},lang)}</div>`:"";
  const language=typeof found?.language==="string"&&/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(found.language)?` lang="${esc(found.language)}"`:"";
  const text=typeof title==="string"&&title?`<p class="tx" data-nx-key="tx"${language}>${esc(title)}</p>`:"";
  const ready=item.state==="ready"&&found?fields(item,lang)+where(found,lang):"";
  const links=item.state==="ready"&&found?trace("from",found.trace?.from,item,data,lang)+trace("to",found.trace?.to,item,data,lang):"";
  // Last, its talk, with "All talk of the stage" (SCR-114#narrowed), the groups' headings one
  // level under "Talk on {id}"; an item that is gone shows the comments that still name it.
  const own=`<section class="itk" aria-labelledby="itk-h" data-nx-key="itk" data-nx-sub><div class="itkh" data-nx-key="itkh"><h3 id="itk-h" tabindex="-1" data-nx-focus="itk-h">${esc(label("Narrowed",0,lang,{id}))}</h3><span class="sp"></span><button class="btn quiet sm" type="button" data-nx-act="whole" data-nx-focus="whole">${icon("i-back")}<span>${esc(label("Narrowed",1,lang))}</span></button></div><div class="body" data-nx-key="tbody" data-nx-sub>${talkBody(talk,lang,state_,true,4)}</div></section>`;
  const body=why+text+state(item,lang)+ready+(gone?"":discrepancies(item,lang,state_))+links+own;
  return`<section class="item" aria-labelledby="item-h" data-nx-key="item:${esc(id)}" data-nx-sub>${head}<div class="ib2" data-nx-key="ib2" data-nx-sub>${body}</div>${gone?"":talkBox(talk,lang,state_,true)}</section>`;
}
