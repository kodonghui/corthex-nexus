// The 13 stages in six groups, and the workspace's list of them (SCR-111): each a
// link with its state as a shape and a word, its number, name, picture mark, item
// count and entries in my turn (rule 13), as the server and the view draw it.
// A stage row of API-158: {key, state, items, picture, not_current, mine}.
import {esc,path,count} from "./html.js";
import {icon,shapeIcon} from "./icons.js";
import {label,legendWord,STATES} from "./words.js";
export const STAGE_KEYS=Object.freeze(["01-domain","02-prd","03-user-flow","04-functional-spec","05-erd","06-api","07-sitemap","08-screen-states","09-mockup","10-wbs","11-development","12-qa","13-presentation"]);
// Discovery (01), Definition (02 to 04), Contracts (05 and 06), Screens (07 to 09),
// Building (10 to 12) and Presentation (13): the index of each stage's group.
const GROUP_OF=Object.freeze([0,1,1,1,2,2,3,3,3,4,4,4,5]);
export const stageNumber=key=>String(key).slice(0,2);
export const stageName=(key,lang)=>label("Stage names",STAGE_KEYS.indexOf(key),lang);
export const stagePath=(project,part,key)=>path("p",project,part||"_",key);
const sr=text=>`<span class="sr">${esc(text)}</span>`;
export const shape=(state,lang)=>shapeIcon(STATES.includes(state)?state:"unknown")+sr(legendWord(STATES.includes(state)?state:"unknown",lang));
export function legend(lang){
  return `<ul class="key">${STATES.map(state=>`<li>${shapeIcon(state)}<span>${esc(legendWord(state,lang))}</span></li>`).join("")}<li>${icon("i-pic")}<span>${esc(legendWord("picture",lang))}</span></li></ul>`;
}
// A count says what it counts (rule 13): the digits show, and its words are read.
const counted=(className,n,words)=>`<span class="${className}"><span aria-hidden="true">${esc(count(n))}</span>${sr(words)}</span>`;
function row(data,stage,lang){
  const key=stage.key,on=key===data.stage,mine=Number(stage.mine)||0,items=Number(stage.items)||0;
  // A picture that is not current says so to screen readers (SCR-111#stale); its stage's
  // page shows why (SCR-112#stale).
  const picture=stage.picture?` ${icon("i-pic")}${sr(stage.not_current?`${legendWord("picture",lang)}, ${label("Projects",6,lang).toLocaleLowerCase(lang)}`:legendWord("picture",lang))}`:"";
  const end=`<span class="end">${[items?counted("n",items,label("Projects",8,lang,{n:count(items)})):"",mine?counted("cnt",mine,label("The talk",1,lang,{n:count(mine)})):""].filter(Boolean).join(" ")}</span>`;
  // The spaces between the parts keep their words apart when the link is read.
  return `<li><a class="row${on?" on":""}" href="${esc(stagePath(data.project.name,data.part,key))}"${on?' aria-current="page"':""}>${shape(stage.state,lang)} <span class="num">${esc(stageNumber(key))}</span> <span class="name"><span class="clip">${esc(stageName(key,lang))}</span>${picture}</span> ${end}</a></li>`;
}
// The part's switch: links to the same stage of each part, which work without code.
function parts(data,lang){
  const list=data.project.parts||[];
  if(list.length<2)return"";
  const name=part=>part||"_";
  return `<details class="partsw"><summary class="btn sm">${esc(name(data.part))}${icon("i-down")}</summary><ul>${list.map(part=>`<li><a class="lnk" href="${esc(stagePath(data.project.name,part,data.stage))}"${part===data.part?' aria-current="page"':""}>${esc(name(part))}</a></li>`).join("")}</ul></details>`;
}
// The inside of the list of stages; data is the answer of API-158 (StageData).
export function stageRail(data,lang){
  const project=data.project,rows=STAGE_KEYS.map(key=>data.stages.find(stage=>stage.key===key)||{key,state:"unknown",items:0,picture:false,mine:0});
  const head=`<div class="proj"><b id="rail-name">${esc(project.title||project.name)}</b>${project.repository?`<span class="mu sm clip">${esc(String(project.repository).replace(/^https:\/\/github\.com\//,""))}</span>`:""}${project.commit?`<span class="mu cap mono">${esc(String(project.commit).slice(0,7))}</span>`:""}${parts(data,lang)}</div>`;
  let group=-1,list="";
  rows.forEach((stage,index)=>{
    if(GROUP_OF[index]!==group){if(group>=0)list+="</ul></li>";group=GROUP_OF[index];list+=`<li class="grp"><span class="gname" id="grp-${group}">${esc(label("Stage groups",group,lang))}</span><ul aria-labelledby="grp-${group}">`;}
    list+=row(data,stage,lang);
  });
  // A project without recorded progress says how progress gets recorded (SCR-111#unrecorded,
  // REQ-103): no stage has a state but those that its settings skip.
  const unrecorded=rows.every(stage=>stage.state==="unknown"||stage.state==="skipped"||!STATES.includes(stage.state));
  return `${head}${unrecorded?`<p class="unrec">${esc(label("No progress",0,lang))}</p>`:""}<ul class="stl">${list}</ul></li></ul>${legend(lang)}`;
}
