// The picture in a pictured stage's frame (SCR-112; SPEC-156, SPEC-119, SPEC-141, SPEC-209), as
// the stage page's code runs it (./stage.js). The server drew the picture as one SVG at 100 per
// cent, which the frame scrolls (../src/draw/picture.js); this code keeps the view where the
// user left it and from then on moves and zooms the picture inside its frame, so that the page
// itself never scrolls: two fingers or the wheel move it, Ctrl or ⌘ with the wheel, a pinch,
// the keys + and − or the zoom buttons size it, the arrow keys move it, Fit shows it whole and
// Go to fits a context, a table or a screen in the view. While the picture is larger than the
// view, the map in a corner shows the whole picture with a frame where the view is, and
// dragging or tapping it moves the view. The marks of the items' talk (rule 13) and the outline
// of a selected item stand over the picture at their own size. Then the editor, read-only, is
// laid over the SVG in the same place (SCR-112#loading): Excalidraw for 01 and 07, ERD Editor's
// viewer for 05. It only draws: this code keeps the camera and gives it to the editor, so that
// both move the same way, and an editor that fails leaves the SVG as it is (SCR-112#code-failed).
// The page's elements are the drawing's (./reconcile.js); what this code adds stands inside the
// board, the marks and the map, whose drawings do not change, and carries no data-nx-key.
import {pictureScene,gotoTargets,union,PAD,LARGE} from "../src/draw/picture.js";
import {itemMarks,itemIdentity} from "../src/layout.js";
import {PALETTE} from "../src/draw/palette.js";
import {label,labels} from "../src/draw/words.js";
import {esc,count} from "../src/draw/html.js";
import {words} from "./messages.js";
import {cameraZoom,zoomCamera,fitCamera} from "./camera.js";
import {stylesheetReady} from "./styles.js";

// One step of the zoom buttons and keys; how far an arrow key moves the view, and with Shift;
// how far a pointer moves before it drags rather than selects; and the room that an item in
// sight keeps from the frame's edges.
const STEP=1.25,KEY_MOVE=40,KEY_MOVE_FAR=200,DRAG=6,ROOM=24;
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const r2=value=>Math.round(value*100)/100;

// Where a box of the picture stands in the frame.
export const onScreen=(rect,cam)=>({x:rect.x*cam.zoom+cam.x,y:rect.y*cam.zoom+cam.y,width:rect.width*cam.zoom,height:rect.height*cam.zoom});
// The view that the picture opens with (SPEC-156): 100 per cent, or the zoom that the user
// last chose on this page, with the picture's top-left corner PAD pixels inside the frame, as
// the server drew it, less what the user scrolled before the code ran.
export const openingCamera=(bounds,zoom=1,scrolled={x:0,y:0})=>({x:PAD-bounds.x*zoom-scrolled.x,y:PAD-bounds.y*zoom-scrolled.y,zoom});
// The view that brings a box into sight (SPEC-209): the same while the whole box is in view; else
// the box in the middle at the same zoom; and where it does not fit at that zoom, zoomed out until
// it fits.
export function sightCamera(cam,rect,stage,width,height){
  const r=onScreen(rect,cam);
  if(r.x>=ROOM&&r.y>=ROOM&&r.x+r.width<=width-ROOM&&r.y+r.height<=height-ROOM)return cam;
  if(r.width<=width-2*ROOM&&r.height<=height-2*ROOM)return{x:width/2-(rect.x+rect.width/2)*cam.zoom,y:height/2-(rect.y+rect.height/2)*cam.zoom,zoom:cam.zoom};
  return fitCamera(rect,stage,width,height);
}
// Whether the picture is larger than the view, so that the map shows (SPEC-156).
export const needsMap=(bounds,cam,width,height)=>bounds.width*cam.zoom>width||bounds.height*cam.zoom>height;
// The item under a point of the picture: the topmost box but a lane, an item before the frame of
// its context.
export function nodeAt(scene,x,y,rectOf=node=>node){
  for(let index=scene.nodes.length-1;index>=0;index--){
    const node=scene.nodes[index];if(node.kind==="lane")continue;
    const r=rectOf(node);if(x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height)return node;
  }
  return null;
}
// Where an item is in the picture: its boxes, or on a DDD board's step that draws no frame of a
// context, the boxes of its members; null where the picture does not hold it.
export function itemBox(scene,id,rectOf=node=>node){
  const own=scene.nodes.filter(node=>node.kind!=="lane"&&node.id===id);
  if(own.length)return union(own.map(rectOf));
  const members=scene.nodes.filter(node=>node.kind!=="lane"&&node.kind!=="context"&&node.context===id&&/^CTX-/.test(id));
  return members.length?union(members.map(rectOf)):null;
}
// The marks of the items in view (rule 13, SCR-112#normal and #stale): for each item with open
// talk, its kinds as shapes from its top-right corner to the left, a comment with its count, a
// proposal with its count, a discrepancy, dashed where it waits for a current picture, and
// "Accepted, not yet reflected".
export function markLayout(scene,data,cam,width,height,rectOf=node=>node){
  const seen=new Set(),out=[];
  for(const node of scene.nodes){
    if(node.kind==="lane")continue;
    const key=itemIdentity(node);if(seen.has(key))continue;
    const mark=itemMarks(node,data||{});if(!mark.total)continue;seen.add(key);
    const r=onScreen(rectOf(node),cam),kinds=[];
    if(mark.comments.length)kinds.push(["comment",mark.comments.length]);
    if(mark.proposals.length)kinds.push(["proposal",mark.proposals.length]);
    if(mark.discrepancies.length)kinds.push([mark.discrepancies.every(d=>d.waiting)?"waiting":"discrepancy",mark.discrepancies.length]);
    if(mark.reflections.length)kinds.push(["accepted",mark.reflections.length]);
    kinds.forEach(([kind,n],index)=>{const cx=r.x+r.width-index*30,cy=r.y;if(cx>-40&&cy>-40&&cx<width+40&&cy<height+40)out.push({kind,n,node,cx,cy});});
  }
  return out;
}
const MARK_WORDS=Object.freeze({comment:0,proposal:1,discrepancy:2,accepted:3});
export function markSVG(mark,lang){
  const {kind,n,cx,cy}=mark,x=r2(cx),y=r2(cy),said=kind==="waiting"?words("Waits",lang):label("The marks",5,lang,{label:labels("The marks",lang)[MARK_WORDS[kind]],n:count(n)});
  const title=`<title>${esc(said)}</title>`,id=mark.node.id?` data-nx-id="${esc(mark.node.id)}"`:"";
  if(kind==="comment")return`<g class="mk"${id}>${title}<circle class="mk-pin" cx="${x}" cy="${y}" r="12"/><text class="mk-txt" x="${x}" y="${r2(cy+4.2)}" text-anchor="middle">${esc(count(n))}</text></g>`;
  if(kind==="proposal")return`<g class="mk"${id}>${title}<rect class="mk-prop" x="${r2(cx-12)}" y="${r2(cy-12)}" width="24" height="24" rx="3"/><text class="mk-prop-t" x="${x}" y="${r2(cy+4.2)}" text-anchor="middle">${esc(count(n))}</text></g>`;
  if(kind==="accepted")return`<g class="mk"${id}>${title}<rect class="mk-acc" x="${r2(cx-15)}" y="${r2(cy-12)}" width="30" height="24" rx="12"/><text class="mk-acc-t" x="${x}" y="${r2(cy+4.2)}" text-anchor="middle">✓</text></g>`;
  const wait=kind==="waiting";
  return`<g class="mk"${id}>${title}<path class="${wait?"mk-wait":"mk-warn"}" d="M${x} ${r2(cy-14)}l14 14-14 14-14-14z"/><text class="${wait?"mk-wait-t":"mk-warn-t"}" x="${x}" y="${r2(cy+4.5)}" text-anchor="middle">!</text></g>`;
}
// The map's drawing (SPEC-156): the whole picture's boxes, or a large picture's frames only, in
// the picture's units, which the map's viewBox fits in its corner.
export function mapBoxes(scene){
  const large=scene.nodes.length>LARGE;
  const boxes=scene.nodes.filter(node=>!large||node.kind==="context"||node.kind==="lane");
  return boxes.map(node=>{const [stroke,fill]=Object.hasOwn(PALETTE,node.kind)?PALETTE[node.kind]:PALETTE.screen;return`<rect x="${r2(node.x)}" y="${r2(node.y)}" width="${r2(node.width)}" height="${r2(node.height)}" fill="${fill}" stroke="${stroke}" vector-effect="non-scaling-stroke"/>`;}).join("");
}
export const mapView=bounds=>{const room=Math.max(bounds.width,bounds.height)*.04;return{x:bounds.x-room,y:bounds.y-room,width:bounds.width+2*room,height:bounds.height+2*room};};

// The board: one for a stage page, which follows the frame that the stage's drawing holds.
// part is the stage's middle; state() gives the page's data and the view's state; pick(id) opens
// an item's address; editor(state) tells the page that the editor loads or failed.
export function createBoard(part,{state,lang,pick,editor:told}){
  const dark=matchMedia("(prefers-color-scheme: dark)");
  let cv=null,board=null,world=null,scene=null,version="",cam=null,stage="",editor=null,token=0,frame=0,selected=null,rects=null,lastZoom=1;
  // The view of each drawing, so that the picture keeps it when the list was shown between.
  const views=new Map();
  const observer=new ResizeObserver(()=>schedule());
  const rectOf=node=>rects?.get(node.key)||node;
  const size=()=>({width:cv.clientWidth,height:cv.clientHeight});

  function attach(next){
    const {payload,view}=state(),found=pictureScene(payload.picture,payload.data.stage,view.step);
    if(!found||found.limited||!found.nodes.length)return;
    cv=next;scene=found;stage=payload.data.stage;version=next.dataset.nxKey;rects=null;
    board=next.querySelector("svg.board");world=board?.querySelector("g.world");
    cam=views.get(version)||openingCamera(scene.bounds,lastZoom,{x:next.scrollLeft,y:next.scrollTop});
    next.classList.add("live");next.scrollLeft=0;next.scrollTop=0;
    observer.observe(next);
    apply();
    loadEditor(++token);
  }
  function detach(){
    if(!cv)return;
    views.set(version,{...cam});lastZoom=cam.zoom;token++;
    editor?.controller.destroy();editor?.host.remove();editor=null;
    observer.unobserve(cv);cancelAnimationFrame(frame);frame=0;
    cv=null;board=null;world=null;scene=null;rects=null;
    told(null,true);
  }
  // After each drawing of the stage: the frame that it holds, or none with the list.
  function sync(){
    const next=part.querySelector(".pf > .cv");
    if(next!==cv){detach();if(next)attach(next);}
    else if(cv)apply();
  }

  function apply(){
    frame=0;if(!cv)return;
    world?.setAttribute("transform",`translate(${r2(cam.x)} ${r2(cam.y)}) scale(${cam.zoom})`);
    const pct=part.querySelector(".ptools [data-nx-pct]"),text=Math.round(cam.zoom*100)+"%";
    if(pct&&pct.textContent!==text)pct.textContent=text;
    if(editor?.ready)editor.controller.navigate(cam);
    layers();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(apply);}
  function move(next){cam=next;schedule();}

  // The marks, the outline of the selected item and the map.
  function layers(){
    const {payload}=state(),{width,height}=size(),marks=part.querySelector(".pf > svg.mks"),map=part.querySelector(".pf > .map");
    if(marks){
      let html="";
      const box=selected?itemBox(scene,selected,rectOf):null;
      if(box){const r=onScreen(box,cam);html+=`<rect class="mk-sel" x="${r2(r.x-6)}" y="${r2(r.y-6)}" width="${r2(r.width+12)}" height="${r2(r.height+12)}" rx="6"/>`;}
      for(const mark of markLayout(scene,payload.picture,cam,width,height,rectOf))html+=markSVG(mark,lang);
      if(marks.innerHTML!==html)marks.innerHTML=html;
    }
    if(map){
      const bounds=rects?union(scene.nodes.map(rectOf)):scene.bounds,show=needsMap(bounds,cam,width,height);
      if(map.hidden===show)map.hidden=!show;
      if(show){
        const box=mapView(bounds),key=version+(rects?" editor":"");
        if(map.dataset.drawn!==key){
          const viewBox=`${r2(box.x)} ${r2(box.y)} ${r2(box.width)} ${r2(box.height)}`;
          map.innerHTML=`<svg class="mpn" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${mapBoxes({...scene,nodes:scene.nodes.map(node=>({...node,...rectOf(node)}))})}</svg><svg class="mpv" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"><rect class="mk-view" vector-effect="non-scaling-stroke"/></svg>`;
          map.dataset.drawn=key;
        }
        // The view's frame, inside the map's drawing.
        const seen={x:-cam.x/cam.zoom,y:-cam.y/cam.zoom,width:width/cam.zoom,height:height/cam.zoom};
        const x=Math.max(box.x,seen.x),y=Math.max(box.y,seen.y),right=Math.min(box.x+box.width,seen.x+seen.width),bottom=Math.min(box.y+box.height,seen.y+seen.height);
        const rect=map.querySelector(".mk-view");
        if(rect)for(const [name,value]of[["x",x],["y",y],["width",Math.max(0,right-x)],["height",Math.max(0,bottom-y)]])rect.setAttribute(name,r2(value));
      }
    }
  }

  // The tools (SCR-112's actions).
  const zoomBy=factor=>{if(!cv)return;const {width,height}=size();move(zoomCamera(cam,stage,cam.zoom*factor,width,height));};
  function fit(){if(!cv)return;const {width,height}=size();move(fitCamera(rects?union(scene.nodes.map(rectOf)):scene.bounds,stage,width,height,true));}
  function goTo(index){
    if(!cv)return;const {payload}=state(),target=gotoTargets(scene,payload.picture?.picture?.source,stage)[index];
    if(!target?.rect)return;const {width,height}=size();
    move(fitCamera(rects?union(target.keys.map(key=>rectOf(scene.nodes.find(node=>node.key===key)))):target.rect,stage,width,height));
  }
  // An item by its ID (SPEC-209): in sight, without a change of zoom unless it does not fit,
  // and marked by an outline. "elsewhere" where a DDD board's step does not hold it and the
  // whole board might, "absent" where the picture does not hold it.
  function select(id){
    selected=id||null;
    if(!cv||!id){schedule();return id?"absent":"none";}
    const box=itemBox(scene,id,rectOf);
    if(!box){schedule();return stage==="01-domain"&&scene.step<8?"elsewhere":"absent";}
    const {width,height}=size();move(sightCamera(cam,box,stage,width,height));
    return"found";
  }

  // The editor, laid over the SVG once the page has painted, in its place and at its view.
  async function loadEditor(mine){
    await paint();if(mine!==token||!cv)return;
    const host=document.createElement("div");host.className="ed";host.inert=true;host.setAttribute("aria-hidden","true");
    told("loading");
    try{
      if(typeof __NEXUS_EXCALIDRAW__!=="string"||typeof __NEXUS_ERD__!=="string")throw new Error("This build has no editor");
      const assets=document.getElementById("nexus-editor-assets");if(assets){document.head.append(assets.content.cloneNode(true));assets.remove();}
      if(!await stylesheetReady("editor",{required:stage!=="05-erd",href:stage==="05-erd"?"":__NEXUS_EXCALIDRAW_CSS__}))throw new Error("The editor's stylesheet is unavailable");
      if(mine!==token)return;
      const module=await import(stage==="05-erd"?__NEXUS_ERD__:__NEXUS_EXCALIDRAW__);
      if(mine!==token)return;
      cv.append(host);
      const controller=await module.mount(host,scene,{lang,theme:dark.matches?"dark":"light",ground:ground(),bare:true,removedMark:words("Removed mark",lang),onView:()=>{}});
      if(mine!==token){controller.destroy();host.remove();return;}
      editor={controller,host,ready:false};
      if(stage==="05-erd")rects=new Map((controller.view()?.rects||[]).map(rect=>[rect.key,rect]));
      controller.navigate(cam);await paint();
      if(mine!==token)return;
      // The view moved while the editor loaded: the editor follows it, then takes the SVG's place.
      controller.navigate(cam);editor.ready=true;cv.classList.add("drawn");
      told(null);apply();
    }catch(error){
      if(mine!==token)return;
      editor?.controller.destroy();editor=null;host.remove();rects=null;
      told("failed");apply();
    }
  }
  // The picture's ground in the theme that shows (color.picture-ground), for an editor that draws
  // its own; Excalidraw's stays white under its dark filter.
  const ground=()=>cv?getComputedStyle(cv).getPropertyValue("--nx-color-picture-ground").trim():"";
  dark.addEventListener?.("change",()=>{if(editor?.ready)editor.controller.theme(dark.matches?"dark":"light",ground());});

  // Moving and zooming: the wheel and two fingers on a touchpad move the picture, and Ctrl or ⌘
  // with the wheel, which is also how a touchpad's pinch arrives, zooms it around the pointer.
  // The page never scrolls with them (SPEC-156).
  const inFrame=target=>Boolean(cv&&target?.closest?.(".pf")&&!target.closest(".map,.zpad,.lgd,.fnote"));
  function local(event){const b=cv.getBoundingClientRect();return{x:event.clientX-b.left,y:event.clientY-b.top};}
  function zoomAt(point,zoom){
    const next=cameraZoom(stage,zoom);if(next===cam.zoom)return;
    move({x:point.x-(point.x-cam.x)*next/cam.zoom,y:point.y-(point.y-cam.y)*next/cam.zoom,zoom:next});
  }
  let pinched=1;
  part.addEventListener("wheel",event=>{
    if(!inFrame(event.target))return;
    event.preventDefault();
    const unit=event.deltaMode===1?16:event.deltaMode===2?size().height:1;
    if(event.ctrlKey||event.metaKey){
      const factor=Math.min(1.25,Math.max(.8,Math.exp(-event.deltaY*unit/400)));
      // Small pinch steps add up until a viewer's rounded zoom changes; a turn back starts again.
      if(factor<1!==pinched<1)pinched=1;pinched*=factor;
      const before=cam.zoom;zoomAt(local(event),cam.zoom*pinched);if(cam.zoom!==before)pinched=1;
      return;
    }
    const dx=(event.shiftKey&&!event.deltaX?event.deltaY:event.deltaX)*unit,dy=(event.shiftKey&&!event.deltaX?0:event.deltaY)*unit;
    move({...cam,x:cam.x-dx,y:cam.y-dy});
  },{passive:false});
  // Safari's touchpad pinch, which no editor should take as its own.
  let gestureZoom=1;
  for(const [type,handle]of[["gesturestart",()=>{gestureZoom=cam.zoom;}],["gesturechange",event=>zoomAt(local(event),gestureZoom*event.scale)],["gestureend",()=>{}]])
    part.addEventListener(type,event=>{if(!inFrame(event.target))return;event.preventDefault();event.stopPropagation();handle(event);});

  // A pointer drags the picture, and two fingers pinch it; a tap selects the item under it, or
  // the item of a mark. The page follows the pointers until they leave, wherever they go.
  const pointers=new Map();let drag=null,dragged=false;
  part.addEventListener("pointerdown",event=>{
    if(!inFrame(event.target)||event.button>0||event.target.closest("button,summary,select"))return;
    if(!pointers.size){dragged=false;window.addEventListener("pointermove",follow);window.addEventListener("pointerup",release);window.addEventListener("pointercancel",release);}
    if(event.target.closest(".cv"))cv.focus({preventScroll:true});
    pointers.set(event.pointerId,local(event));
    if(pointers.size===1)drag={start:local(event),cam:{...cam},target:event.target};
    else{const [a,b]=[...pointers.values()];drag={pinch:Math.hypot(a.x-b.x,a.y-b.y)||1,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},cam:{...cam}};dragged=true;}
  });
  function follow(event){
    if(!drag||!cv||!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,local(event));
    if(drag.pinch&&pointers.size>=2){
      const [a,b]=[...pointers.values()],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},zoom=cameraZoom(stage,drag.cam.zoom*(Math.hypot(a.x-b.x,a.y-b.y)||1)/drag.pinch);
      move({x:mid.x-(drag.mid.x-drag.cam.x)*zoom/drag.cam.zoom,y:mid.y-(drag.mid.y-drag.cam.y)*zoom/drag.cam.zoom,zoom});
      return;
    }
    const point=local(event),dx=point.x-drag.start.x,dy=point.y-drag.start.y;
    if(!dragged&&Math.hypot(dx,dy)>DRAG){dragged=true;cv.classList.add("grab");}
    if(dragged)move({...drag.cam,x:drag.cam.x+dx,y:drag.cam.y+dy});
  }
  function release(event){
    if(!pointers.delete(event.pointerId))return;
    if(pointers.size===1&&drag?.pinch){const [rest]=pointers.values();drag={start:rest,cam:{...cam},target:null};return;}
    if(pointers.size)return;
    window.removeEventListener("pointermove",follow);window.removeEventListener("pointerup",release);window.removeEventListener("pointercancel",release);
    const tap=!dragged&&event.type==="pointerup"?drag:null;drag=null;cv?.classList.remove("grab");
    if(!tap?.target||!cv)return;
    // A link of the SVG opens its item itself, below.
    const mark=tap.target.closest?.(".mk");
    if(mark){if(mark.dataset.nxId)pick(mark.dataset.nxId);return;}
    if(tap.target.closest?.("svg.board a"))return;
    const point=local(event),node=nodeAt(scene,(point.x-cam.x)/cam.zoom,(point.y-cam.y)/cam.zoom,rectOf);
    if(node?.id)pick(node.id);
  }
  part.addEventListener("dragstart",event=>{if(inFrame(event.target))event.preventDefault();});
  // The SVG's links lead to their items' addresses before the code runs; now a tap or a screen
  // reader's press selects the item here, and a drag that ends on a link opens nothing.
  part.addEventListener("click",event=>{
    const link=event.target.closest?.(".pf svg.board a[data-nx-node]");if(!link||!cv)return;
    event.preventDefault();
    if(dragged){dragged=false;return;}
    const node=scene.nodes.find(node=>node.key===link.dataset.nxNode);if(node?.id)pick(node.id);
  },true);
  // The keys on the focused frame: the arrows move the view, + and − zoom it.
  part.addEventListener("keydown",event=>{
    if(!cv||event.target!==cv||event.altKey||event.ctrlKey||event.metaKey)return;
    const far=event.shiftKey?KEY_MOVE_FAR:KEY_MOVE,moves={ArrowLeft:[far,0],ArrowRight:[-far,0],ArrowUp:[0,far],ArrowDown:[0,-far]}[event.key];
    if(moves){event.preventDefault();move({...cam,x:cam.x+moves[0],y:cam.y+moves[1]});return;}
    if(event.key==="+"||event.key==="="){event.preventDefault();zoomBy(STEP);}
    else if(event.key==="-"||event.key==="_"){event.preventDefault();zoomBy(1/STEP);}
  });
  // The map: a tap or a drag puts the middle of the view where the pointer is.
  let mapping=null;
  function toMap(event){
    const map=event.target.closest?.(".pf > .map"),svg=map?.querySelector("svg.mpv");if(!svg||!cv)return;
    const b=svg.getBoundingClientRect(),box=svg.viewBox.baseVal,scale=Math.min(b.width/box.width,b.height/box.height);
    const x=box.x+(event.clientX-b.left-(b.width-box.width*scale)/2)/scale,y=box.y+(event.clientY-b.top-(b.height-box.height*scale)/2)/scale,{width,height}=size();
    move({x:width/2-x*cam.zoom,y:height/2-y*cam.zoom,zoom:cam.zoom});
  }
  part.addEventListener("pointerdown",event=>{if(!event.target.closest?.(".pf > .map")||event.button>0)return;event.preventDefault();mapping=event.pointerId;try{event.target.setPointerCapture?.(event.pointerId);}catch{}toMap(event);});
  part.addEventListener("pointermove",event=>{if(mapping===event.pointerId)toMap(event);});
  for(const type of["pointerup","pointercancel"])part.addEventListener(type,event=>{if(mapping===event.pointerId)mapping=null;});

  return{sync,select,fit,goTo,zoomIn:()=>zoomBy(STEP),zoomOut:()=>zoomBy(1/STEP),camera:()=>cam&&{...cam},selected:()=>selected,shown:()=>Boolean(cv),editor:()=>editor?.ready?"ready":null};
}
