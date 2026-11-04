import {itemMarks} from "./layout.js";
const union=rects=>{const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y));return{x,y,width:Math.max(...rects.map(r=>r.x+r.width))-x,height:Math.max(...rects.map(r=>r.y+r.height))-y};};
export async function drawPicture(target,scene,{stage,data,lang,onSelect,onReady}){
  const canvas=document.createElement("div"),marks=document.createElement("div");canvas.className="picture-canvas";marks.className="markers";marks.setAttribute("aria-hidden","true");target.append(canvas,marks);
  let current=data,controller,destroyed=false,renderFrame,down=null,moved=false,pointers=new Set();
  const dark=matchMedia("(prefers-color-scheme: dark)"),theme=dark.matches?"dark":"light";
  function rectFor(node,view){return view.rects.find(r=>r.key===node.key)||node;}
  function navigateTo(rect,whole=false){if(!controller)return;const zoom=Math.max(.1,Math.min(whole?1:1.2,(target.clientWidth-48)/Math.max(1,rect.width),(target.clientHeight-48)/Math.max(1,rect.height)));controller.navigate({x:(target.clientWidth-rect.width*zoom)/2-rect.x*zoom,y:(target.clientHeight-rect.height*zoom)/2-rect.y*zoom,zoom});}
  function selectMark(node,mark){if(mark.total===1&&mark.comments.length===1)onSelect("comment",mark.comments[0].id);else if(mark.total===1&&mark.proposals.length===1)onSelect("proposal",mark.proposals[0].id);else onSelect("item",node.id,node);}
  function render(){
    if(!controller||destroyed)return;const view=controller.view();if(!view)return;marks.replaceChildren();
    const marked=scene.nodes.filter(n=>n.kind!=="lane").map(n=>({node:n,mark:itemMarks(n,current)})).filter(x=>x.mark.total),seen=new Set(),groups=new Map();
    for(const entry of marked){const key=entry.node.id||entry.node.text;if(seen.has(key))continue;seen.add(key);const ctx=entry.node.context||key;if(!groups.has(ctx))groups.set(ctx,[]);groups.get(ctx).push(entry);}
    const small=target.clientWidth<1024&&view.zoom<.55;
    for(const [ctx,group]of groups){
      if(small&&group.length>1){const b=union(group.map(e=>rectFor(e.node,view))),count=group.reduce((n,e)=>n+e.mark.total,0);pin(b,count,"cluster",()=>navigateTo(b),ctx);}
      else for(const {node,mark}of group){pin(rectFor(node,view),mark.total,mark.discrepancies.length?"discrepancy":mark.reflections.length?"accepted":"",()=>selectMark(node,mark),node.id||node.text);}
    }
    function pin(rect,count,kind,click,label){const x=(rect.x+rect.width)*view.zoom+view.x,y=rect.y*view.zoom+view.y;if(x< -44||y< -44||x>target.clientWidth+44||y>target.clientHeight+44)return;const button=document.createElement("button"),span=document.createElement("span");button.type="button";button.className="pin "+kind;button.style.left=x+"px";button.style.top=y+"px";button.tabIndex=-1;span.textContent=count>999?"999+":String(count);button.append(span);button.title=label+": "+count;button.addEventListener("click",click);marks.append(button);}
  }
  function schedule(){cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(render);}
  const module=await import(stage==="05-erd"?__NEXUS_ERD__:__NEXUS_EXCALIDRAW__);
  controller=await module.mount(canvas,scene,{lang,theme,onView:schedule});
  if(destroyed){controller.destroy();return null;}
  const view=controller.view();
  if(matchMedia("(min-width:1024px)").matches)navigateTo(union(view?.rects?.length?view.rects:scene.nodes),true);
  else{
    const groups=new Map();for(const n of scene.nodes){const ctx=n.context||n.key;if(!groups.has(ctx))groups.set(ctx,{nodes:[],count:0});groups.get(ctx).nodes.push(n);groups.get(ctx).count+=itemMarks(n,current).total;}
    const chosen=[...groups.values()].sort((a,b)=>b.count-a.count)[0],first=(scene.step!==undefined&&scene.step<8?scene.nodes.find(n=>n.kind==="event"):chosen?.nodes.find(n=>n.kind!=="context"))||scene.nodes[0];
    if(first){const rect=rectFor(first,view),zoom=.7;controller.navigate({x:24-rect.x*zoom,y:80-rect.y*zoom,zoom});}
  }
  function pointerDown(e){if(e.target.closest("button"))return;pointers.add(e.pointerId);if(pointers.size===1){down={x:e.clientX,y:e.clientY};moved=false;}else moved=true;}
  function pointerMove(e){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)moved=true;}
  function pointerUp(e){pointers.delete(e.pointerId);if(!down||moved||e.target.closest("button")){if(!pointers.size)down=null;return;}const view=controller.view(),b=canvas.getBoundingClientRect(),x=(e.clientX-b.left-view.x)/view.zoom,y=(e.clientY-b.top-view.y)/view.zoom;down=null;const node=[...scene.nodes].reverse().find(n=>n.kind!=="lane"&&(()=>{const r=rectFor(n,view);return x>=r.x&&x<=r.x+r.width&&y>=r.y&&y<=r.y+r.height;})());if(node)onSelect("item",node.id,node);}
  canvas.addEventListener("pointerdown",pointerDown,true);canvas.addEventListener("pointermove",pointerMove,true);canvas.addEventListener("pointerup",pointerUp,true);canvas.addEventListener("pointercancel",()=>{down=null;pointers.clear();},true);
  const observer=new ResizeObserver(schedule);observer.observe(target);const changeTheme=()=>{controller.theme(dark.matches?"dark":"light");schedule();};dark.addEventListener("change",changeTheme);schedule();onReady?.();
  return{update:value=>{current=value;schedule();},zoom:factor=>{const v=controller.view(),zoom=Math.max(.1,Math.min(5,v.zoom*factor)),cx=target.clientWidth/2,cy=target.clientHeight/2;controller.navigate({x:cx-(cx-v.x)*zoom/v.zoom,y:cy-(cy-v.y)*zoom/v.zoom,zoom});schedule();},fit:()=>navigateTo(union(controller.view().rects),true),focus:node=>navigateTo(rectFor(node,controller.view())),destroy:()=>{destroyed=true;cancelAnimationFrame(renderFrame);observer.disconnect();dark.removeEventListener("change",changeTheme);controller.destroy();canvas.remove();marks.remove();}};
}
