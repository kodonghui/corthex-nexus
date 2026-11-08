// One layout for the redesign's pages (stage 08's rule 15): the server draws each
// page's reading parts from the page's data, and the view's code draws the same
// parts with these functions, so that nothing moves when it runs. Each part is an
// element with data-nx-part; its inside is what the view compares and redraws.
import {esc} from "./html.js";
import {SPRITE,icon} from "./icons.js";
import {topBar,codeBar,tabs} from "./frame.js";
import {stageRail,stageName,stageNumber} from "./stages.js";
import {labels} from "./words.js";
import {drawHome} from "./home.js";
import {drawStage,drawSide,stageBars} from "./stage.js";
export const PAGE_SCHEMAS=Object.freeze({home:"corthex-home-page/0.3",stage:"corthex-stage-page/0.3"});
export function pageKind(payload){
  const kind=Object.keys(PAGE_SCHEMAS).find(key=>PAGE_SCHEMAS[key]===payload?.schema);
  if(!kind||!["en","ko"].includes(payload.lang))throw new Error("Unreadable page data");
  return kind;
}
// The open talk of the stage, for its tab: what waits for the user, for the agent,
// and the comments whose item is gone (API-152).
export const openTalk=talk=>talk?["mine","agent","apart"].reduce((n,key)=>n+(Number(talk[key]?.total)||0),0):0;
// The inside of every part of the page, by the part's name, from the page's data: the
// first page's sections (SCR-110, TASK-273), and a stage's frame, middle and side (SCR-111
// and SCR-113, TASK-274), which the picture and the talk join in TASK-275 and TASK-276.
// view is what the stage page's code adds when it draws again (./stage.js); the server
// draws with none.
export function drawParts(payload,view={}){
  const kind=pageKind(payload),lang=payload.lang;
  if(kind==="home")return{top:topBar({kind:"home"},lang),bars:codeBar(lang),home:drawHome(payload.data,lang)};
  const data=payload.data,talk=openTalk(payload.talk);
  return{
    top:topBar({kind:"stage",project:data.project.name,title:data.project.title,part:data.part,stage:data.stage},lang),
    bars:codeBar(lang)+stageBars(view,lang),
    rail:stageRail(data,lang),
    tabs:tabs({picture:Boolean(payload.picture),talk},lang),
    stage:drawStage(data,lang,{...view,talk}),
    side:drawSide(data,payload.problem,lang,view),
  };
}
export function pageTitle(payload){
  if(pageKind(payload)==="home")return"NEXUS";
  const data=payload.data;
  return `${stageNumber(data.stage)} ${stageName(data.stage,payload.lang)} · ${data.project.title||data.project.name} · NEXUS`;
}
// The page's body around its parts: the first page in one column under 1,024 pixels,
// and the workspace's three widths (rule 16), which the page's stylesheet lays out.
export function drawBody(payload){
  const kind=pageKind(payload),parts=drawParts(payload),close=labels("Top bar",payload.lang)[5];
  const head=`${SPRITE}<header class="tb" data-nx-part="top">${parts.top}</header><div class="bars" data-nx-part="bars">${parts.bars}</div>`;
  if(kind==="home")return `${head}<main class="home" id="main" data-nx-part="home">${parts.home}</main>`;
  return `${head}<div class="ws"><a class="scrim" href="#stage" tabindex="-1" aria-hidden="true"></a><nav class="rail" id="stages" aria-labelledby="rail-name"><a class="ib close only-ph" href="#stage">${icon("i-close")}<span class="sr">${esc(close)}</span></a><div class="rail-in" data-nx-part="rail">${parts.rail}</div></nav><nav class="tabs only-ph" data-nx-part="tabs">${parts.tabs}</nav><main class="stage" id="stage" data-nx-part="stage">${parts.stage}</main><aside class="side" id="talk" data-nx-part="side">${parts.side}</aside></div>`;
}
