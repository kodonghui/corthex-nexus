import React from "react";
import {createRoot} from "react-dom/client";
import {Excalidraw,MainMenu,convertToExcalidrawElements} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import {EXCALIDRAW_MIN_ZOOM} from "./camera.js";
window.EXCALIDRAW_ASSET_PATH=location.origin+"/";
const palette={context:["#64748b","transparent"],event:["#9a3412","#ffedd5"],command:["#1e40af","#dbeafe"],actor:["#854d0e","#fef9c3"],aggregate:["#854d0e","#fef08a"],"read-model":["#166534","#dcfce7"],policy:["#6b21a8","#f3e8ff"],external:["#86198f","#fae8ff"],hotspot:["#991b1b","#fee2e2"],screen:["#334155","#e2e8f0"],lane:["#64748b","transparent"]};
export function mount(target,scene,{lang,onView,theme}){
  return new Promise((resolve,reject)=>{
    const idMap=new Map(scene.nodes.map((n,i)=>[n.key,"nx-shape-"+i]));
    const skeleton=scene.nodes.map(n=>{const [strokeColor,backgroundColor]=palette[n.kind]||palette.screen;return{type:"rectangle",id:idMap.get(n.key),x:n.x,y:n.y,width:n.width,height:n.height,strokeColor,backgroundColor,strokeStyle:n.removed?"dashed":"solid",strokeWidth:n.kind==="context"?2:1,roughness:0,fillStyle:"solid",label:{text:n.label||n.text,fontSize:n.kind==="context"?18:16,fontFamily:2,verticalAlign:n.kind==="context"?"top":"middle"}};});
    for(const edge of scene.edges){const a=scene.nodes.find(n=>n.key===edge.from),b=scene.nodes.find(n=>n.key===edge.to);if(!a||!b)continue;const x=a.x+a.width,y=a.y+a.height/2,x2=b.x,y2=b.y+b.height/2;skeleton.push({type:"arrow",x,y,points:[[0,0],[x2-x,y2-y]],strokeColor:"#64748b",strokeWidth:1,roughness:0,endArrowhead:"arrow",...(edge.text?{label:{text:edge.text,fontSize:12,fontFamily:2}}:{})});}
    const elements=convertToExcalidrawElements(skeleton),root=createRoot(target);let api,done=false,destroyed=false,readyFrame;
    const deadline=performance.now()+30000;
    const controller={
      view:()=>{const s=api.getAppState();return{x:s.scrollX*s.zoom.value,y:s.scrollY*s.zoom.value,zoom:s.zoom.value,rects:scene.nodes};},
      navigate:({x,y,zoom})=>api.updateScene({appState:{scrollX:x/zoom,scrollY:y/zoom,zoom:{value:Math.max(EXCALIDRAW_MIN_ZOOM,Math.min(30,zoom))}}}),
      destroy:()=>{destroyed=true;cancelAnimationFrame(readyFrame);root.unmount();},
      theme:value=>api.updateScene({appState:{theme:value}})
    };
    function ready(){
      if(destroyed||done)return;
      const state=api?.getAppState();
      // The API arrives before initialData. Fitting at that earlier callback
      // is overwritten when Excalidraw finishes loading its initial scene.
      if(state&&!state.isLoading&&state.width>0&&state.height>0&&api.getSceneElements().length>=elements.length){done=true;resolve(controller);return;}
      if(!target.isConnected||performance.now()>deadline){done=true;root.unmount();reject(new Error("Excalidraw scene unavailable"));return;}
      readyFrame=requestAnimationFrame(ready);
    }
    // The ground stays white in both themes: Excalidraw's dark theme draws the canvas through
    // invert(93%) hue-rotate(180deg), which turns it into the dark token color.picture-ground,
    // #121212, as the page's own picture under the same filter (BUG-595).
    try{root.render(React.createElement(Excalidraw,{initialData:{elements,appState:{viewBackgroundColor:"#ffffff",theme}},viewModeEnabled:true,zenModeEnabled:true,gridModeEnabled:false,aiEnabled:false,detectScroll:false,langCode:lang==="ko"?"ko-KR":"en",UIOptions:{canvasActions:{changeViewBackgroundColor:false,clearCanvas:false,loadScene:false,saveToActiveFile:false,toggleTheme:false,saveAsImage:false,export:false},tools:{image:false}},excalidrawAPI:value=>{api=value;readyFrame=requestAnimationFrame(ready);},onChange:()=>{if(api&&!destroyed)onView(controller.view());},onLinkOpen:(_,event)=>event.preventDefault()},React.createElement(MainMenu,null)));}catch(error){root.unmount();reject(error);}
  });
}
