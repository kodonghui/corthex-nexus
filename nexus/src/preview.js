// Shared, dependency-free SVG. Only checked geometry and escaped text enter HTML.
import {pictureLayout,itemMarks,sceneItems,itemIdentity,STEPS} from "./layout.js";
import {words} from "../ui/messages.js";
export const escapePreview=value=>String(value??"").replace(/[&<>"'_]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","_":"&#95;"}[ch]));
export function pictureLimitMessage(scene,lang){return lang==="ko"?`반복 배치가 너무 복잡해 이 그림을 표시하지 못했습니다. 원본은 그대로 보관되어 있으며 아래에 원본 항목 ${scene.nodes.length}개${scene.listLimited?"까지":""}를 표시합니다.`:`Repeated layout is too complex to display this picture. The original source is unchanged; ${scene.listLimited?"up to ":""}${scene.nodes.length} source items are listed below.`;}
const number=value=>Number.isFinite(Number(value))?Number(value):0;
const palette={context:["#64748b","none"],lane:["#64748b","none"],event:["#9a3412","#ffedd5"],command:["#1e40af","#dbeafe"],actor:["#854d0e","#fef9c3"],aggregate:["#854d0e","#fef08a"],"read-model":["#166534","#dcfce7"],policy:["#6b21a8","#f3e8ff"],external:["#86198f","#fae8ff"],hotspot:["#991b1b","#fee2e2"],screen:["#334155","#e2e8f0"],table:["#334155","#e2e8f0"]};
const fragment=id=>{try{return "#item="+encodeURIComponent(id);}catch{return "#items";}};
function labelLines(node){
 if(node.kind!=="table")return String(node.label||node.text).split("\n");
 const table=node.raw;return [table.name,...table.columns.map(column=>[table.primary_key.includes(column.name)?"PK":"",table.foreign_keys.some(fk=>fk.columns.includes(column.name))?"FK":"",column.name,column.type,column.null?"":"NOT NULL"].filter(Boolean).join(" "))];
}
const widthUnits=text=>Array.from(text).reduce((n,ch)=>n+(ch.codePointAt(0)>255?1:.62),0);
export function firstPictureNode(scene,data){
 if(scene.step!==undefined&&scene.step<8)return scene.nodes.find(node=>node.kind==="event")||scene.nodes[0];
 const groups=new Map();for(const node of scene.nodes){const key=node.context||node.key;if(!groups.has(key))groups.set(key,{nodes:[],marks:0});groups.get(key).nodes.push(node);groups.get(key).marks+=itemMarks(node,data||{}).total;}
 const chosen=[...groups.values()].sort((a,b)=>b.marks-a.marks)[0];return chosen?.nodes.find(node=>node.kind!=="context")||scene.nodes[0];
}
export function initialPictureView(scene,data,width,height,desktop=width>=1024){
 if(desktop){const b=scene.bounds,zoom=Math.max(.1,Math.min(1,(width-48)/Math.max(1,b.width),(height-48)/Math.max(1,b.height)));return{x:(width-b.width*zoom)/2-b.x*zoom,y:(height-b.height*zoom)/2-b.y*zoom,zoom};}
 const first=firstPictureNode(scene,data)||{x:0,y:0};return{x:24-first.x*.7,y:80-first.y*.7,zoom:.7};
}
export function previewSVG(scene,data={},lang="en"){
 const b=scene.bounds,first=firstPictureNode(scene,data)||{x:b.x,y:b.y};
 const lookup=new Map(scene.nodes.map(node=>[node.key,node]));
 const edges=scene.edges.flatMap(edge=>{const a=lookup.get(edge.from),z=lookup.get(edge.to);if(!a||!z)return[];const x=a.x+a.width,y=a.y+a.height/2,x2=z.x,y2=z.y+z.height/2;return [`<g class="preview-edge"><path d="M ${number(x)} ${number(y)} L ${number(x2)} ${number(y2)}" fill="none" stroke="#64748b" marker-end="url(#nexus-preview-arrow)"/>${edge.text?`<text x="${number((x+x2)/2)}" y="${number((y+y2)/2-8)}" text-anchor="middle" font-size="12" fill="var(--nx-color-muted)">${escapePreview(edge.text)}</text>`:""}</g>`];}).join("");
 const nodes=scene.nodes.map(node=>{
  const [stroke,fill]=palette[node.kind]||palette.screen,lines=labelLines(node),max=Math.max(1,...lines.map(widthUnits));
  const font=Math.max(.1,Math.min(node.kind==="context"?18:16,(node.width-20)/max,(node.height-18)/(Math.max(1,lines.length)*1.25)));
  const top=node.kind==="context"||node.kind==="lane"?node.y+font+8:node.y+(node.height-lines.length*font*1.25)/2+font;
  const ink=fill==="none"?"var(--nx-color-text)":stroke;
  return `<g data-nexus-node="${escapePreview(node.key)}"><title>${escapePreview(lines.join(" · "))}</title><rect x="${number(node.x)}" y="${number(node.y)}" width="${number(node.width)}" height="${number(node.height)}" fill="${fill}" stroke="${stroke}"${node.removed?' stroke-dasharray="6 4"':""}/><text text-anchor="middle" font-size="${font}" fill="${ink}">${lines.map((line,index)=>`<tspan x="${number(node.x+node.width/2)}" y="${number(top+index*font*1.25)}">${escapePreview(line)}</tspan>`).join("")}</text></g>`;
 }).join("");
 const seen=new Set(),marks=scene.nodes.filter(node=>node.kind!=="lane").flatMap(node=>{const mark=itemMarks(node,data),key=itemIdentity(node);if(!mark.total||seen.has(key))return[];seen.add(key);return[`<g><circle cx="${number(node.x+node.width)}" cy="${number(node.y)}" r="18" fill="#334155"/><text x="${number(node.x+node.width)}" y="${number(node.y+5)}" text-anchor="middle" fill="white" font-size="14">${mark.total>999?"999+":mark.total}</text></g>`];}).join("");
 return `<svg data-nexus-preview class="preview-scene" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${lang==="ko"?"그림 미리보기":"Picture preview"}" viewBox="${number(b.x)} ${number(b.y)} ${Math.max(1,number(b.width))} ${Math.max(1,number(b.height))}" style="--preview-width:${Math.max(1,b.width)}px;--preview-height:${Math.max(1,b.height)}px;width:${Math.max(1,b.width*.7)}px;height:${Math.max(1,b.height*.7)}px;left:${24-(first.x-b.x)*.7}px;top:${80-(first.y-b.y)*.7}px"><defs><marker id="nexus-preview-arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>${edges}${nodes}<g data-preview-static-marks>${marks}</g></svg><span class="sr-only" data-preview-complete>${lang==="ko"?"미리보기 준비":"Preview ready"}</span>`;
}
export function picturePreview(data,lang="en"){
 if(!data?.picture?.source)return"";
 const scene=pictureLayout(data.picture.source,data.stage);if(!scene.nodes.length&&!scene.limited)return"";
 const ko=lang==="ko",name=[data.project,data.part,data.stage].filter(Boolean).join(" / "),place=[data.project,data.part||"_",data.stage].map(encodeURIComponent).join("/");
 const items=sceneItems(scene),t=(key,values={})=>words(key,lang,values),button=label=>`<button disabled>${escapePreview(label)}</button>`;
 const notice=text=>`<div class="notice">${escapePreview(text)}</div>`;
 let before="";
 if(data.picture.not_current){
  const versions=t("Not current",{commit:data.picture.commit}).split(ko?" 또는: ":" Or: "),index={size:0,"source-gone":1,"other-repository":2}[data.picture.not_current]||0;
  const message=index===0?versions[0]:(ko?`이 그림은 커밋 ${data.picture.commit}의 그림입니다. `:`This picture shows commit ${data.picture.commit}: `)+versions[index];
  before+=`<div class="notice warn" data-preview-stale>${escapePreview(message)}</div>`;
 }
 if(data.stage==="01-domain"){
  if(!data.picture.source.timeline?.length)before+=notice(t("No timeline"));
  else{
   const labels=t("Steps").split(" · ");
   before+=`<nav class="controls" data-preview-steps>${button(labels[0])}<select disabled aria-label="${escapePreview(labels[2])}">${STEPS.map((key,index)=>`<option value="${escapePreview(key)}"${index===scene.step?" selected":""}>${escapePreview(labels[index+3])}</option>`).join("")}</select>${button(labels[1])}</nav>`;
  }
 }
 const controls=`<div class="controls">${scene.limited?"":button(ko?"축소":"Zoom out")+button(ko?"확대":"Zoom in")+button(ko?"그림 전체":"Whole picture")}<a class="control" href="#items">${ko?"항목 목록":"Items as a list"}</a>${button(ko?"새로 읽기":"Refresh")}</div>`;
 if(!scene.limited&&scene.nodes.length>300)before+=notice(t("Large",{n:scene.nodes.length}));
 const date=new Date(data.picture.committed_at),time=Number.isNaN(date.valueOf())?String(data.picture.committed_at||""):new Intl.DateTimeFormat(lang,{dateStyle:"medium",timeStyle:"short"}).format(date);
 const header=`<header class="topbar"><a class="control" href="/hub">${ko?"허브 페이지":"Hub page"}</a><h1>${escapePreview(name)}</h1><a class="control" href="/overview/${escapePreview(place)}">${ko?"단계 현황":"Stage overview"}</a></header>`;
 const meta=`<div class="subbar"><span>${ko?"커밋 ":"Commit "}${escapePreview(data.picture.commit)}</span><time>${escapePreview(time)}</time></div>`;
 const picture=scene.limited?`<div class="notice warn" data-preview-limited>${escapePreview(pictureLimitMessage(scene,lang))}</div>`:`<div class="picture-shell preview-container" aria-label="${ko?"읽기 전용 그림":"Read-only picture"}" data-preview-ready="true" data-editor-ready="false">${previewSVG(scene,data,lang)}</div>`;
 const list=`<div class="after-picture"><details id="items" class="items"><summary>${ko?"항목 목록":"Items as a list"} (${items.length})</summary><ul>${items.map(node=>`<li><a href="${escapePreview(node.id?fragment(node.id):"#items")}">${escapePreview([node.id,node.text].filter(Boolean).join(" · "))}</a></li>`).join("")}</ul></details></div>`;
 return `${header}${meta}<main class="content"><div></div><div>${before}${controls}${picture}${list}</div></main>`;
}
