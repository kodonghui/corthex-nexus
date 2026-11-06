import {createHash} from "node:crypto";
export const VIEWER_SHA="a00453b277930062024de3d5b5880e41da28130cd950a757ae2fc33f4641d47b";
export function patchViewer(source){
  // A packaged MIT modification; never reach into the viewer's closed shadow.
  if(createHash("sha256").update(source).digest("hex")!==VIEWER_SHA)throw new Error("The pinned ERD viewport bridge source changed");
  source='import { changeZoomLevelAction, scrollToAction } from "../../engine/modules/settings/atom.actions.js";\nimport { getActiveTransform } from "../../konva/scene/viewport.js";\nimport { getTableRect } from "../../konva/scene/metrics.js";\nimport { CANVAS_ZOOM_MIN as NEXUS_CANVAS_ZOOM_MIN, CANVAS_ZOOM_MAX as NEXUS_CANVAS_ZOOM_MAX } from "../../constants/schema.js";\n'+source;
  const anchor="\tctx.destroy = destroy;";
  if(source.split(anchor).length!==2)throw new Error("ERD bridge anchor changed");
  source=source.replace(anchor,`// NEXUS modification: bounded read-only scene navigation and geometry.
  ctx.nexusView = () => {
    const app = live();
    if (!app || destroyed) return null;
    const state=app.store.state, t=getActiveTransform(state);
    return {x:t.originX,y:t.originY,zoom:t.zoomLevel,rects:state.doc.tableIds.map(id=>({id,...getTableRect(state,state.collections.tableEntities[id])}))};
  };
  ctx.nexusNavigate = ({x,y,zoom}) => {
    const app=live();
    if (!app || destroyed || ![x,y,zoom].every(Number.isFinite) || zoom<=0) return false;
    app.store.dispatchSync(changeZoomLevelAction({value:Math.max(NEXUS_CANVAS_ZOOM_MIN,Math.min(NEXUS_CANVAS_ZOOM_MAX,zoom))}),scrollToAction({originX:x,originY:y}));
    return true;
  };
  ${anchor}`);
  const subscription="\t\tstopViewport ??= app.store.subscribe((actions) => {";
  if(source.split(subscription).length!==2)throw new Error("ERD subscription anchor changed");
  source=source.replace(subscription,subscription+`\n      queueMicrotask(()=>{if(!destroyed)ctx.dispatchEvent(new CustomEvent("nexus-viewport"));});`);
  return source;
}
