import {itemMarks,itemIdentity} from "./layout.js";
import {initialPictureView} from "../src/preview.js";
import {stylesheetReady} from "./styles.js";
import {zoomCamera,fitCamera} from "./camera.js";
const union=rects=>{const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));return{x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y};};
const paint=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
export async function drawPicture(target,scene,{stage,data,lang,onSelect,onReady,initialView,signal}){
  // Give the complete SVG a paint before native chunks or fonts compete for bandwidth.
  await paint();if(signal?.aborted)return null;
  const assets=document.getElementById("nexus-editor-assets");if(assets){document.head.append(assets.content.cloneNode(true));assets.remove();}
  if(!await stylesheetReady("editor",{required:stage!=="05-erd",href:stage==="05-erd"?"":__NEXUS_EXCALIDRAW_CSS__}))throw new Error("The editor stylesheet is unavailable");
  if(signal?.aborted)return null;
  const canvas=document.createElement("div"),marks=document.createElement("div");canvas.className="picture-canvas";marks.className="markers";marks.setAttribute("aria-hidden","true");target.append(canvas,marks);
  canvas.style.visibility="hidden";marks.style.visibility="hidden";
  let current=data,controller,destroyed=false,renderFrame,observer,down=null,moved=false,pointers=new Set();
  const dark=matchMedia("(prefers-color-scheme: dark)"),theme=dark.matches?"dark":"light";
  const changeTheme=()=>{controller?.theme(dark.matches?"dark":"light");schedule();};
  function destroy(){if(destroyed)return;destroyed=true;cancelAnimationFrame(renderFrame);observer?.disconnect();dark.removeEventListener("change",changeTheme);signal?.removeEventListener("abort",destroy);controller?.destroy();canvas.remove();marks.remove();}
  signal?.addEventListener("abort",destroy,{once:true});
  function rectFor(node,view){return view.rects.find(r=>r.key===node.key)||node;}
  function navigateTo(rect,whole=false){if(!controller)return;controller.navigate(fitCamera(rect,stage,target.clientWidth,target.clientHeight,whole));}
  function selectMark(node,mark){if(mark.total===1&&mark.comments.length===1)onSelect("comment",mark.comments[0].id);else if(mark.total===1&&mark.proposals.length===1)onSelect("proposal",mark.proposals[0].id);else onSelect("item",node.id,node);}
  function render(){
    if(!controller||destroyed)return;const view=controller.view();if(!view)return;marks.replaceChildren();
    const marked=scene.nodes.filter(n=>n.kind!=="lane").map(n=>({node:n,mark:itemMarks(n,current)})).filter(x=>x.mark.total),seen=new Set(),groups=new Map();
    for(const entry of marked){const key=itemIdentity(entry.node);if(seen.has(key))continue;seen.add(key);const ctx=entry.node.context||key;if(!groups.has(ctx))groups.set(ctx,[]);groups.get(ctx).push(entry);}
    const small=target.clientWidth<1024&&view.zoom<.55;
    for(const [ctx,group]of groups){
      if(small&&group.length>1){const b=union(group.map(e=>rectFor(e.node,view))),count=group.reduce((n,e)=>n+e.mark.total,0);pin(b,count,"cluster",()=>navigateTo(b),ctx);}
      else for(const {node,mark}of group){pin(rectFor(node,view),mark.total,mark.discrepancies.length?"discrepancy":mark.reflections.length?"accepted":"",()=>selectMark(node,mark),node.id||node.text);}
    }
    function pin(rect,count,kind,click,label){const x=(rect.x+rect.width)*view.zoom+view.x,y=rect.y*view.zoom+view.y;if(x< -44||y< -44||x>target.clientWidth+44||y>target.clientHeight+44)return;const button=document.createElement("button"),span=document.createElement("span");button.type="button";button.className="pin "+kind;button.style.left=x+"px";button.style.top=y+"px";button.tabIndex=-1;span.textContent=count>999?"999+":String(count);button.append(span);button.title=label+": "+count;button.addEventListener("click",click);marks.append(button);}
  }
  function schedule(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(render);}
  try{
    const module=await import(stage==="05-erd"?__NEXUS_ERD__:__NEXUS_EXCALIDRAW__);
    if(destroyed)return null;
    controller=await module.mount(canvas,scene,{lang,theme,onView:schedule});
    if(destroyed){controller.destroy();return null;}
    const first=initialView?.()||initialPictureView(scene,data,target.clientWidth,target.clientHeight,matchMedia("(min-width:1024px)").matches);
    controller.navigate(zoomCamera(first,stage,first.zoom,target.clientWidth,target.clientHeight));
    await paint();if(destroyed)return null;
    // A reader can pan or zoom the SVG while the native editor mounts.
    if(initialView){const latest=initialView();controller.navigate(zoomCamera(latest,stage,latest.zoom,target.clientWidth,target.clientHeight));}
    await paint();if(destroyed)return null;
  }catch(error){destroy();throw error;}
  function pointerDown(e){if(e.target.closest("button"))return;pointers.add(e.pointerId);if(pointers.size===1){down={x:e.clientX,y:e.clientY};moved=false;}else moved=true;}
  function pointerMove(e){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)moved=true;}
  function pointerUp(e){pointers.delete(e.pointerId);if(!down||moved||e.target.closest("button")){if(!pointers.size)down=null;return;}const view=controller.view(),b=canvas.getBoundingClientRect(),x=(e.clientX-b.left-view.x)/view.zoom,y=(e.clientY-b.top-view.y)/view.zoom;down=null;const node=[...scene.nodes].reverse().find(n=>n.kind!=="lane"&&(()=>{const r=rectFor(n,view);return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;})());if(node)onSelect("item",node.id,node);}
  canvas.addEventListener("pointerdown",pointerDown,true);canvas.addEventListener("pointermove",pointerMove,true);canvas.addEventListener("pointerup",pointerUp,true);canvas.addEventListener("pointercancel",()=>{down=null;pointers.clear();},true);
  observer=new ResizeObserver(schedule);observer.observe(target);dark.addEventListener("change",changeTheme);canvas.style.visibility="";marks.style.visibility="";render();onReady?.();
  return{view:()=>controller.view(),update:value=>{current=value;schedule();},zoom:factor=>{const v=controller.view();controller.navigate(zoomCamera(v,stage,v.zoom*factor,target.clientWidth,target.clientHeight));schedule();},fit:()=>navigateTo(union(controller.view().rects),true),focus:node=>navigateTo(rectFor(node,controller.view())),destroy};
}
