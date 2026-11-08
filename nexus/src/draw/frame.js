// The parts that every page of the redesign shares: the top bar (stage 08's rule 17),
// the bar of a page whose code did not load (rule 15) and the phone's tabs (rule 16).
// Before the view's code runs the controls that need it are disabled, with
// data-nx-wait naming what the code adds to them (rule 15); links work without it.
import {esc,count} from "./html.js";
import {icon} from "./icons.js";
import {label,labels} from "./words.js";
import {stageName,stageNumber} from "./stages.js";
const sr=text=>`<span class="sr">${esc(text)}</span>`;
// place: {kind:"home"} or {kind:"stage", project, title, part, stage}.
export function topBar(place,lang){
  const words=labels("Top bar",lang),stage=place.kind==="stage";
  // The separators are icons too, since the fonts lack › (BUG-596).
  const where=stage
    ?`<a class="lnk" href="/">${esc(words[1])}</a>${icon("i-next","sep")}<a class="lnk clip" href="${esc("/p/"+encodeURIComponent(place.project))}">${esc(place.title||place.project)}</a>${icon("i-next","sep")}<b class="clip" aria-current="page">${esc(stageNumber(place.stage)+" "+stageName(place.stage,lang))}</b>`
    :`<b aria-current="page">${esc(words[1])}</b>`;
  const hint=labels("Search hint",lang).join(" · ");
  return [
    stage?`<a class="ib only-ph" href="/">${icon("i-back")}${sr(words[1])}</a>`:"",
    `<a class="logo${stage?" only-pc":""}" href="/">${esc(words[0])}</a>`,
    `<nav class="place only-pc">${where}</nav>`,
    stage?`<a class="ttl only-ph" href="#stages"><span class="num">${esc(stageNumber(place.stage))}</span> <span class="clip">${esc(stageName(place.stage,lang))}</span>${icon("i-down")}</a>`:`<span class="sp only-ph"></span>`,
    `<label class="fw only-pc"><span class="field">${icon("i-search")}<input type="search" name="q" maxlength="200" autocomplete="off" placeholder="${esc(hint)}" aria-label="${esc(words[2])}" disabled data-nx-wait="search"></span></label>`,
    `<button class="ib only-ph" type="button" disabled data-nx-wait="search">${icon("i-search")}${sr(words[2])}</button>`,
    `<a class="btn only-pc" href="/hub">${esc(words[3])}</a>`,
    stage?"":`<details class="menu only-ph"><summary class="ib">${icon("i-menu")}${sr(words[4])}</summary><div class="pop"><a class="btn" href="/hub">${esc(words[3])}</a></div></details>`,
  ].join("");
}
// Hidden while the code may still come; shown when it failed, or after a wait
// that only a page whose code never ran reaches (the page's stylesheet times it).
export const codeBar=lang=>`<div class="bar warn" data-nx-codebar role="status">${icon("i-warn")}<span class="t">${esc(label("Buttons not loaded",0,lang))}</span></div>`;
// The phone's tabs (rule 16): the stage, its talk, and the item that the view adds
// while one is selected. As links to the parts they work without the code.
export function tabs({picture,talk},lang){
  const words=labels("Tabs",lang);
  return `<a class="tab" href="#stage" data-nx-tab="stage">${icon(picture?"i-picture":"i-list")}<span>${esc(picture?words[0]:words[1])}</span></a><a class="tab" href="#talk" data-nx-tab="talk">${icon("i-talk")}<span>${esc(label("Tabs",2,lang,{n:count(talk)}))}</span></a>`;
}
