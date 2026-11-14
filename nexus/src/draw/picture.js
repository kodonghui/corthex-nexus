// The picture stage (SCR-112; SPEC-147, SPEC-156, SPEC-119, SPEC-141): a pictured stage's middle,
// which the server draws from the page's data (API-154: API-158 and API-111) and the view's code
// draws again with these functions. It is one column with the five places of stage 09's sheet of
// its four views: the head and the tools' line are the column's, and the view's region below
// them shows the picture or, with #view=list, the stage's items as SCR-113 lists them. The
// picture brings its tools, a DDD board's step control on a line of its own, the bars above the
// frame and the frame: the picture at 100 per cent with its top-left corner in view, as one SVG
// that the frame scrolls before the code runs (rule 15). The code (../../ui/board.js) then moves
// and zooms the same SVG inside its frame, adds the marks, the map and the outline of a
// selected item, and lays the editor over it. Nothing stands at the two places that wait for
// editing, the head's right end and the third place of Picture and List (stage 08's rule 23).
// view is what the code adds, as for ./stage.js: mode ("picture" or "list"), step (a DDD
// board's key, from #step=), newer (a newer picture on the server), editor ("loading" or
// "failed") and code.
import {esc} from "./html.js";
import {icon} from "./icons.js";
import {label,labels,codeMessage,oldLabels,notCurrentWhy} from "./words.js";
import {stageName,stageNumber} from "./stages.js";
import {PALETTE} from "./palette.js";
import {pictureLayout,STEPS} from "../layout.js";
import {labelLines,widthUnits,pictureLimitMessage} from "../preview.js";
import {words} from "../../ui/messages.js";
import {drawHead,drawNotes,drawFilters,drawList,drawUpdating,PICTURE_STAGES} from "./stage.js";

// The room around the picture in its first drawing, and the count of elements from which a
// picture is large (SCR-112#large), whose map draws the frames only.
export const PAD=24,LARGE=300;
// Numbers in the drawing: two decimals at most, so that the server and the code write the
// same text.
const n=value=>{const x=Number(value);return Number.isFinite(x)?String(Math.round(x*100)/100):"0";};
// The editors' ink for lines and the words beside them (palette.js), which the dark theme's
// filter turns as it turns the boxes.
const INK=PALETTE.context[0];
const WAIT=' disabled data-nx-wait="picture"';

// A picture's layout at a step (SPEC-119: the same each time), once for each source and step,
// since the code draws the stage again on every change of its parts.
const scenes=new WeakMap();
export function pictureScene(picture,stage,step){
  const source=picture?.picture?.source;
  if(!PICTURE_STAGES.includes(stage)||!source||typeof source!=="object")return null;
  let byStep=scenes.get(source);
  if(!byStep){byStep=new Map();scenes.set(source,byStep);}
  const key=stage==="01-domain"&&typeof step==="string"?step:"";
  if(!byStep.has(key))byStep.set(key,pictureLayout(source,stage,key||undefined));
  return byStep.get(key);
}
// What the frame shows: the picture, or why it shows none (SCR-112#empty and SCR-112's Target),
// with the words of the cover.
export function frameState(payload,scene,lang){
  const problem=payload.problem;
  if(problem?.code==="space_not_found")return{empty:true,text:codeMessage("space_not_found",lang)};
  if(!payload.picture?.picture){
    const why=["not-drawn","size","other-repository"].includes(problem?.why)?problem.why:"not-drawn";
    return{empty:true,text:words("picture_not_found:"+why,lang)};
  }
  if(!scene)return{empty:true,text:words("picture_not_found:not-drawn",lang)};
  if(scene.limited)return{empty:true,text:pictureLimitMessage(scene,lang),limited:true};
  if(!scene.nodes.length)return{empty:true,text:label("No items",0,lang)};
  return{empty:false};
}
// Whether a DDD board shows its step control: a board whose source has a timeline.
const stepped=payload=>payload.data.stage==="01-domain"&&Boolean(payload.picture?.picture?.source?.timeline?.length);

// The picture as one SVG in the picture's own units: its boxes and lines in the editors' palette
// with their labels, laid out by ../layout.js. The group "world" places the picture at 100 per
// cent with its top-left corner PAD pixels inside the SVG, which is as large as the picture and
// its room, so that the frame scrolls it before the code runs; the code sizes the SVG to its
// frame and moves this group (SPEC-156), in the same form, so that it first writes what the
// server wrote. Each box with an ID is a link to its address, #item=,
// as the list's rows are. The page's stylesheet turns the SVG with the editors' dark filter in
// the dark theme, as it turns the first page's small views. Once for each layout.
const boards=new WeakMap();
export function boardSVG(scene){
  if(boards.has(scene))return boards.get(scene);
  const b=scene.bounds,lookup=new Map(scene.nodes.map(node=>[node.key,node]));
  const edges=scene.edges.map(edge=>{
    const a=lookup.get(edge.from),z=lookup.get(edge.to);if(!a||!z)return"";
    const x=a.x+a.width,y=a.y+a.height/2,x2=z.x,y2=z.y+z.height/2;
    return`<path d="M${n(x)} ${n(y)}L${n(x2)} ${n(y2)}" fill="none" stroke="${INK}" marker-end="url(#nx-arrow)"/>${edge.text?`<text x="${n((x+x2)/2)}" y="${n((y+y2)/2-8)}" text-anchor="middle" font-size="12" fill="${INK}">${esc(edge.text)}</text>`:""}`;
  }).join("");
  const nodes=scene.nodes.map(node=>{
    const [stroke,fill]=Object.hasOwn(PALETTE,node.kind)?PALETTE[node.kind]:PALETTE.screen,lines=labelLines(node),max=Math.max(1,...lines.map(widthUnits));
    const font=Math.max(.1,Math.min(node.kind==="context"?18:16,(node.width-20)/max,(node.height-18)/(Math.max(1,lines.length)*1.25)));
    const top=node.kind==="context"||node.kind==="lane"?node.y+font+8:node.y+(node.height-lines.length*font*1.25)/2+font;
    const inside=`<title>${esc(lines.join(" · "))}</title><rect x="${n(node.x)}" y="${n(node.y)}" width="${n(node.width)}" height="${n(node.height)}" fill="${fill}" stroke="${stroke}"${node.removed?' stroke-dasharray="6 4"':""}/><text text-anchor="middle" font-size="${n(font)}" fill="${stroke}">${lines.map((line,index)=>`<tspan x="${n(node.x+node.width/2)}" y="${n(top+index*font*1.25)}">${esc(line)}</tspan>`).join("")}</text>`;
    // A link that the keyboard passes by: the frame moves with the arrow keys, and the list
    // holds the items in the tab order.
    return node.id&&node.kind!=="lane"?`<a href="#item=${esc(encodeURIComponent(node.id))}" tabindex="-1" data-nx-node="${esc(node.key)}" aria-label="${esc(node.id+" "+String(node.raw?.name??lines[0]))}">${inside}</a>`:`<g data-nx-node="${esc(node.key)}">${inside}</g>`;
  }).join("");
  const svg=`<svg class="board" width="${n(b.width+2*PAD)}" height="${n(b.height+2*PAD)}" focusable="false"><defs><marker id="nx-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="${INK}"/></marker></defs><g class="world" transform="translate(${n(PAD-b.x)} ${n(PAD-b.y)}) scale(1)">${edges}${nodes}</g></svg>`;
  boards.set(scene,svg);
  return svg;
}

// "Go to"'s list (REQ-237): a DDD board's contexts, an ERD's tables or a sitemap's screens, by ID
// and name, each with the box that picking it fits in the view; a context that the step does not
// show has none, and its entry is off.
export const union=boxes=>{const x=Math.min(...boxes.map(a=>a.x)),y=Math.min(...boxes.map(a=>a.y));return{x,y,width:Math.max(...boxes.map(a=>a.x+a.width))-x,height:Math.max(...boxes.map(a=>a.y+a.height))-y};};
export function gotoTargets(scene,source,stage){
  if(!scene||scene.limited)return[];
  if(stage==="01-domain")return(Array.isArray(source?.contexts)?source.contexts:[]).map(context=>{
    const key=context.id||context.name,frame=scene.nodes.find(node=>node.kind==="context"&&node.context===key);
    const members=frame?[frame]:scene.nodes.filter(node=>node.kind!=="lane"&&node.context===key);
    return{id:String(context.id||""),name:String(context.name||""),keys:members.map(node=>node.key),rect:members.length?union(members):null};
  });
  const kind=stage==="05-erd"?"table":"screen";
  return scene.nodes.filter(node=>node.kind===kind).map(node=>({id:String(node.id||""),name:String(node.raw?.name||node.text||""),keys:[node.key],rect:{x:node.x,y:node.y,width:node.width,height:node.height}}));
}
function gotoMenu(targets,lang,wait){
  const words=labels("The picture's tools",lang),summary=`${icon("i-goto")}<span class="lbl">${esc(words[3])}</span>`;
  const items=targets.map((target,index)=>`<button class="btn quiet sm" type="button" data-nx-act="goto" data-nx-goto="${index}" data-nx-focus="goto:${index}"${target.rect?wait:" disabled"}>${target.id?`<span class="mono">${esc(target.id)}</span>`:""}<span>${esc(target.name)}</span></button>`).join("");
  return`<details class="menu goto" data-nx-key="goto"><summary class="btn sm" data-nx-focus="goto" aria-label="${esc(words[3])}">${summary}</summary><div class="pop">${items}</div></details>`;
}

// The tools' line (SCR-112's layout of the revision): Picture and List, then the tools of the
// view that shows, the zoom buttons with the zoom, Fit and Go to with a picture and none with the
// list or an empty frame, and Stage record at its right end from 1,024 pixels, where the head
// holds it under them. The line wraps where its parts do not fit, and hides none of them; its
// right end is a margin and not an element, so that it takes no gap of the line (TC-1770).
function drawTools(payload,scene,lang,view,mode,state){
  const tabs=labels("Tabs",lang),words=labels("The picture's tools",lang),head=labels("The head",lang);
  const wait=view.code?"":WAIT;
  const seg=`<span class="seg" data-nx-key="seg">${["picture","list"].map((name,index)=>`<button type="button" data-nx-act="view" data-nx-view="${name}" data-nx-focus="view:${name}" aria-pressed="${mode===name}"${wait}>${icon(index?"i-list":"i-picture")}<span>${esc(tabs[index])}</span></button>`).join("")}</span>`;
  let middle="";
  if(mode==="picture"&&!state.empty){
    middle=`<span class="zoom only-pc" data-nx-key="zoom"><button class="btn sm icon" type="button" data-nx-act="zoom-out" data-nx-focus="zoom-out" aria-label="${esc(words[0])}"${wait}>${icon("i-minus")}</button><span class="pct" data-nx-pct>100%</span><button class="btn sm icon" type="button" data-nx-act="zoom-in" data-nx-focus="zoom-in" aria-label="${esc(words[1])}"${wait}>${icon("i-plus")}</button></span>`
      +`<button class="btn sm fit" type="button" data-nx-key="fit" data-nx-act="fit" data-nx-focus="fit" aria-label="${esc(words[2])}"${wait}>${icon("i-fit")}<span class="lbl">${esc(words[2])}</span></button>`
      +gotoMenu(gotoTargets(scene,payload.picture.picture.source,payload.data.stage),lang,wait);
  }
  const record=`<button class="btn sm only-pc" type="button" data-nx-key="rec" data-nx-act="record" data-nx-focus="record-t" aria-expanded="${Boolean(view.record)}"${view.code?"":' disabled data-nx-wait="record"'}>${icon("i-record")}<span>${esc(head[4])}</span></button>`;
  return`<div class="ptools" data-nx-key="ptools" data-nx-sub>${seg}${middle}${record}</div>`;
}

// A DDD board's step control (SPEC-141), on a line of its own under the tools with the picture
// only: "Steps", Previous step, the list of steps and Next step; a board without a timeline has
// the notice in its place.
function drawSteps(scene,lang,view){
  const words=oldLabels("Steps",lang),at=scene.step,wait=view.code?"":WAIT,edge=off=>off&&view.code?" disabled":wait;
  const options=STEPS.map((key,index)=>`<option value="${esc(key)}"${index===at?" selected":""}>${esc(words[index+3])}</option>`).join("");
  return`<div class="steps" data-nx-key="steps" data-nx-sub><span class="mu stl1" id="steps-l" data-nx-key="stl">${esc(words[2])}</span><button class="btn sm icon" type="button" data-nx-key="back" data-nx-act="step" data-nx-step="${esc(STEPS[at-1]??"")}" data-nx-focus="step:back" aria-label="${esc(words[0])}"${edge(at<=0)}>${icon("i-back")}</button><label class="field sm-f sel" data-nx-key="pick"><select name="step" aria-labelledby="steps-l" data-nx-focus="step:pick"${wait}>${options}</select>${icon("i-down")}</label><button class="btn sm icon" type="button" data-nx-key="next" data-nx-act="step" data-nx-step="${esc(STEPS[at+1]??"")}" data-nx-focus="step:next" aria-label="${esc(words[1])}"${edge(at>=STEPS.length-1)}>${icon("i-next")}</button></div>`;
}

// The bars above the frame (SCR-112#large and #stale): a picture that is not current and why, a
// newer picture with Show it, which shows over an empty frame too, and a large picture.
const bar=(tone,text,button="")=>`<div class="bar ${tone}" role="status">${icon(tone==="warn"?"i-warn":"i-info")}<span class="t">${esc(text)}</span>${button}</div>`;
function drawBars(payload,scene,lang,view,state){
  const drawn=payload.picture?.picture,out=[];
  if(!state.empty&&drawn.not_current)out.push(bar("warn",notCurrentWhy(drawn.not_current,String(drawn.commit||"").slice(0,7),lang)));
  if(view.newer){
    const newer=labels("A newer picture",lang);
    out.push(bar("info",newer[0],`<button class="btn sm" type="button" data-nx-act="newer" data-nx-focus="newer">${icon("i-reload")}<span>${esc(newer[1])}</span></button>`));
  }
  if(!state.empty&&scene.nodes.length>LARGE)out.push(bar("info",words("Large",lang,{n:scene.nodes.length})));
  return`<div class="pbars" data-nx-key="pbars">${out.join("")}</div>`;
}

// The legend of the marks (rule 13), from 1,024 pixels in the frame's lower left: each kind a
// shape and its words, never colour alone. The code draws the marks with the same shapes.
export const MARK_SHAPES=Object.freeze({
  comment:'<circle class="mk-pin" cx="12" cy="12" r="9"/>',
  proposal:'<rect class="mk-prop" x="3" y="3" width="18" height="18" rx="3"/>',
  discrepancy:'<path class="mk-warn" d="M12 1.5l10.5 10.5-10.5 10.5-10.5-10.5z"/>',
  accepted:'<rect class="mk-acc" x="1" y="4" width="22" height="16" rx="8"/>',
});
function drawLegend(lang){
  const words=labels("The marks",lang);
  return`<ul class="lgd only-pc" data-nx-key="lgd" aria-label="${esc(words[4])}">${Object.values(MARK_SHAPES).map((shape,index)=>`<li><svg class="lg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg>${esc(words[index])}</li>`).join("")}</ul>`;
}

// The frame: the board, which the code's layers join, the marks, the map, the zoom buttons under
// 1,024 pixels, and in the lower left corner the frame's note, where the editor says that it
// loads or failed, above the legend once the code draws the marks; or the cover that says why
// there is no picture, with List (SCR-112#empty).
function drawFrame(payload,scene,lang,view,state){
  const stage=payload.data.stage,wait=view.code?"":WAIT,updating=drawUpdating(view,lang);
  if(state.empty){
    const list=`<button class="btn" type="button" data-nx-act="view" data-nx-view="list" data-nx-focus="view:list-2"${wait}>${icon("i-list")}<span>${esc(labels("Tabs",lang)[1])}</span></button>`;
    return`<div class="pf" data-nx-key="pf" data-nx-sub>${updating}<div class="empty-p" data-nx-key="empty"><div>${icon("i-picture","big")}<p>${esc(state.text)}</p>${list}</div></div></div>`;
  }
  const tools=labels("The picture's tools",lang),drawn=payload.picture.picture;
  const name=label("The picture's tools",5,lang,{stage:`${stageNumber(stage)} ${stageName(stage,lang)}`});
  // The board's key changes with what it draws, so that the code lays its layers and the editor
  // on each new drawing.
  const version=[drawn.commit,drawn.drawn_at,scene.step??"",lang].join(" ");
  const zoom=`<div class="zpad only-ph" data-nx-key="zpad"><button class="btn icon" type="button" data-nx-act="zoom-in" data-nx-focus="zoom-in-ph" aria-label="${esc(tools[1])}"${wait}>${icon("i-plus")}</button><button class="btn icon" type="button" data-nx-act="zoom-out" data-nx-focus="zoom-out-ph" aria-label="${esc(tools[0])}"${wait}>${icon("i-minus")}</button></div>`;
  // The editor's note (SCR-112#loading and #code-failed), which the frame says as it changes.
  const note=view.editor==="loading"?["info",0]:view.editor==="failed"?["warn",1]:null;
  const said=note?`<div class="msg ${note[0]}">${icon("i-"+note[0])}<div><span class="t">${esc(label("The editor",note[1],lang))}</span></div></div>`:"";
  return`<div class="pf" data-nx-key="pf" data-nx-sub><div class="cv" data-nx-key="${esc("cv "+version)}" tabindex="0" role="group" aria-label="${esc(name)}">${boardSVG(scene)}</div><svg class="mks" data-nx-key="mks" aria-hidden="true" focusable="false"></svg><div class="map" data-nx-key="map" role="img" aria-label="${esc(tools[4])}" hidden></div>${zoom}${updating}<div class="pcn" data-nx-key="pcn" data-nx-sub><div class="fnote" data-nx-key="fnote" role="status" data-nx-live>${said}</div>${view.code?drawLegend(lang):""}</div></div>`;
}

// The inside of a pictured stage's middle: payload is the stage page's data.
export function drawPictureStage(payload,lang,view={}){
  const data=payload.data;
  if(!data?.head||!data.items||!Array.isArray(data.items.entries))throw new Error("Unreadable page data");
  const mode=view.mode==="list"?"list":"picture",scene=pictureScene(payload.picture,data.stage,view.step),state=frameState(payload,scene,lang);
  const head=drawHead(data,lang,{...view,pictured:true}),tools=drawTools(payload,scene,lang,view,mode,state),notes=drawNotes(view,lang);
  if(mode==="list"){
    const filters=data.head.reads===false?"":drawFilters(data,lang,view);
    return head+tools+notes+filters+`<div class="lw" data-nx-key="lw" data-nx-sub>${drawUpdating(view,lang)}${drawList(data,lang,view)}</div>`;
  }
  const steps=state.empty||data.stage!=="01-domain"?"":stepped(payload)?drawSteps(scene,lang,view):`<div class="pnote" data-nx-key="steps">${bar("info",words("No timeline",lang))}</div>`;
  return head+tools+steps+notes+drawBars(payload,scene,lang,view,state)+drawFrame(payload,scene,lang,view,state);
}
