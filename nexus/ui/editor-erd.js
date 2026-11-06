import "@dineug/erd-editor/erd-viewer.js";
const deleteActions={"":1,"no action":2,cascade:4,"set null":8,"set default":16,restrict:32};
// The removed mark comes from the view, in the page's language (SCR-105, 0.2.3).
export function erdDocument(scene,removedMark="removed"){
  const tableEntities={},tableColumnEntities={},relationshipEntities={},tableIds=[],relationshipIds=[];
  for(const n of scene.nodes){
    const t=n.raw,id=n.key,columnIds=t.columns.map((_,i)=>id+"-column-"+i);tableIds.push(id);
    tableEntities[id]={id,name:t.name,comment:[t.id,t.context,t.removed?removedMark:""].filter(Boolean).join(" · "),logicalName:t.name,columnIds,seqColumnIds:columnIds,ui:{x:n.x,y:n.y,zIndex:tableIds.length,widthName:Math.max(160,n.width/2),widthLogicalName:Math.max(160,n.width/2),widthComment:200}};
    t.columns.forEach((c,i)=>{const primary=t.primary_key.includes(c.name),foreign=t.foreign_keys.some(f=>f.columns.includes(c.name)),unique=t.unique.some(u=>u.columns.length===1&&u.columns[0]===c.name&&!u.partial);tableColumnEntities[columnIds[i]]={id:columnIds[i],tableId:id,name:c.name,logicalName:c.name,dataType:c.type,options:(primary?2:0)|(unique?4:0)|(!c.null?8:0),ui:{keys:(primary?1:0)|(foreign?2:0),widthName:Math.max(120,n.width/2),widthLogicalName:120,widthDataType:Math.max(120,n.width/2),widthComment:60,widthDomain:60,widthDefault:60}};});
  }
  for(const [i,edge]of scene.edges.entries()){
    const id="relationship-"+i,child=scene.nodes.find(n=>n.key===edge.from),parent=scene.nodes.find(n=>n.key===edge.to),fk=edge.foreignKey;if(!child||!parent||!fk)continue;relationshipIds.push(id);
    const columns=(node,names)=>names.map(name=>{const i=node.raw.columns.findIndex(c=>c.name===name);return i<0?null:node.key+"-column-"+i;}).filter(Boolean);
    relationshipEntities[id]={id,identification:fk.columns.every(c=>child.raw.primary_key.includes(c)),relationshipType:4,startRelationshipType:2,onDelete:deleteActions[fk.on_delete]||1,onUpdate:1,start:{tableId:parent.key,columnIds:columns(parent,fk.references.length?fk.references:parent.raw.primary_key),x:parent.x+parent.width,y:parent.y+45,direction:2},end:{tableId:child.key,columnIds:columns(child,fk.columns),x:child.x,y:child.y+45,direction:1}};
  }
  return{version:"3.0.0",settings:{zoomLevel:1,originX:0,originY:0,lockSettings:0,show:1|4|32|128|256,nameViewMode:"physical"},doc:{tableIds,relationshipIds},collections:{tableEntities,tableColumnEntities,relationshipEntities}};
}
export function mount(target,scene,{lang,onView,theme,removedMark}){
  return new Promise((resolve,reject)=>{
    const viewer=document.createElement("erd-viewer");let destroyed=false,frame;
    viewer.style.cssText="display:block;width:100%;height:100%";viewer.minimap=false;viewer.controls=false;
    viewer.setPresetTheme({appearance:theme});viewer.setLocale(lang==="ko"?"ko-KR":"en");
    const view=()=>{const v=viewer.nexusView();if(!v)return null;return{...v,rects:v.rects.map(r=>({...r,key:r.id}))};};
    const controller={view,navigate:v=>viewer.nexusNavigate(v),theme:value=>viewer.setPresetTheme({appearance:value}),destroy:()=>{destroyed=true;cancelAnimationFrame(frame);viewer.destroy();viewer.remove();}};
    const update=()=>{const v=view();if(v)onView(v);};viewer.addEventListener("nexus-viewport",update);
    try{target.append(viewer);viewer.value=JSON.stringify(erdDocument(scene,removedMark));let tries=0;
      function ready(){if(destroyed)return;const v=view();if(v?.rects.length===scene.nodes.length&&viewer.clientWidth>0){resolve(controller);update();}else if(++tries<180)frame=requestAnimationFrame(ready);else{controller.destroy();reject(new Error("ERD scene unavailable"));}}
      frame=requestAnimationFrame(ready);
    }catch(error){controller.destroy();reject(error);}
  });
}
