import {initialPictureView,previewSVG} from "../src/preview.js";
import {itemMarks,itemIdentity} from "./layout.js";
import {zoomCamera,fitCamera} from "./camera.js";

// The first picture uses the same world coordinates as the pinned editor.
export function mountPreview(target,scene,{data,lang,onSelect}){
  const layer=document.createElement("div"),marks=document.createElement("div");
  layer.className="picture-preview";marks.className="markers preview-marks";
  layer.innerHTML=previewSVG(scene,data,lang);
  const svg=layer.querySelector("svg");svg.removeAttribute("style");
  svg.querySelector("[data-preview-static-marks]")?.remove();
  target.append(layer,marks);
  const initial=initialPictureView(scene,data,target.clientWidth,target.clientHeight,matchMedia("(min-width:1024px)").matches);
  let current=data,view=zoomCamera(initial,data.stage,initial.zoom,target.clientWidth,target.clientHeight),down=null,destroyed=false;
  const pointers=new Set();
  const bounds=nodes=>{const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y));return{x,y,width:Math.max(...nodes.map(n=>n.x+n.width))-x,height:Math.max(...nodes.map(n=>n.y+n.height))-y};};
  function navigate(rect,whole=false){view=fitCamera(rect,data.stage,target.clientWidth,target.clientHeight,whole);render();}
  function select(node,mark){if(mark.total===1&&mark.comments.length===1)onSelect("comment",mark.comments[0].id);else if(mark.total===1&&mark.proposals.length===1)onSelect("proposal",mark.proposals[0].id);else onSelect("item",node.id,node);}
  function render(){
    if(destroyed)return;
    svg.setAttribute("viewBox",`${-view.x/view.zoom} ${-view.y/view.zoom} ${target.clientWidth/view.zoom} ${target.clientHeight/view.zoom}`);
    marks.replaceChildren();const seen=new Set(),groups=new Map();
    for(const node of scene.nodes){if(node.kind==="lane")continue;const key=itemIdentity(node),mark=itemMarks(node,current);if(!mark.total||seen.has(key))continue;seen.add(key);const context=node.context||key;if(!groups.has(context))groups.set(context,[]);groups.get(context).push({node,mark});}
    for(const [context,group]of groups){
      if(target.clientWidth<1024&&view.zoom<.55&&group.length>1){const rect=bounds(group.map(e=>e.node));pin(rect,group.reduce((n,e)=>n+e.mark.total,0),"cluster",()=>navigate(rect),context);}
      else for(const {node,mark}of group)pin(node,mark.total,mark.discrepancies.length?"discrepancy":mark.reflections.length?"accepted":"",()=>select(node,mark),node.id||node.text);
    }
    function pin(rect,count,kind,click,label){const x=(rect.x+rect.width)*view.zoom+view.x,y=rect.y*view.zoom+view.y;if(x< -44||y< -44||x>target.clientWidth+44||y>target.clientHeight+44)return;const button=document.createElement("button"),span=document.createElement("span");button.type="button";button.className="pin "+kind;button.style.left=x+"px";button.style.top=y+"px";button.title=label+": "+count;button.tabIndex=-1;span.textContent=count>999?"999+":String(count);button.append(span);button.addEventListener("click",click);marks.append(button);}
  }
  function pointerDown(event){if(event.button!==0)return;pointers.add(event.pointerId);if(pointers.size!==1){down=null;return;}event.preventDefault();down={id:event.pointerId,x:event.clientX,y:event.clientY,view:{...view},node:event.target.closest("[data-nexus-node]")?.getAttribute("data-nexus-node"),moved:false};layer.setPointerCapture(event.pointerId);}
  function pointerMove(event){if(!down||down.id!==event.pointerId)return;const x=event.clientX-down.x,y=event.clientY-down.y;if(Math.hypot(x,y)>6)down.moved=true;if(down.moved){view={...view,x:down.view.x+x,y:down.view.y+y};render();}}
  function pointerEnd(event){pointers.delete(event.pointerId);if(!down||down.id!==event.pointerId)return;const selected=!down.moved&&event.type==="pointerup"&&scene.nodes.find(n=>n.key===down.node&&n.kind!=="lane");down=null;if(layer.hasPointerCapture(event.pointerId))layer.releasePointerCapture(event.pointerId);if(selected)onSelect("item",selected.id,selected);}
  layer.addEventListener("pointerdown",pointerDown);layer.addEventListener("pointermove",pointerMove);layer.addEventListener("pointerup",pointerEnd);layer.addEventListener("pointercancel",pointerEnd);
  const observer=new ResizeObserver(render);observer.observe(target);render();
  return {view:()=>({...view,rects:scene.nodes}),update:value=>{current=value;render();},zoom:factor=>{view=zoomCamera(view,data.stage,view.zoom*factor,target.clientWidth,target.clientHeight);render();},fit:()=>navigate(scene.bounds,true),focus:node=>navigate(node),destroy:()=>{destroyed=true;down=null;pointers.clear();observer.disconnect();layer.remove();marks.remove();}};
}
