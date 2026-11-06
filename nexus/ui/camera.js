// Match the pinned ERD viewer before it replaces the interactive SVG.
// ERD Editor 5.1.0 supports 0.1–1.5 and stores zoom to two decimal places.
export function cameraZoom(stage,value){
  const zoom=Math.max(.1,Math.min(stage==="05-erd"?1.5:5,Number.isFinite(value)?value:.1));
  return stage==="05-erd"?Math.round(zoom*100)/100:zoom;
}
export function zoomCamera(view,stage,value,width,height){
  const zoom=cameraZoom(stage,value);
  if(zoom===view.zoom)return{x:view.x,y:view.y,zoom};
  const cx=width/2,cy=height/2;
  return{x:cx-(cx-view.x)*zoom/view.zoom,y:cy-(cy-view.y)*zoom/view.zoom,zoom};
}
export function fitCamera(rect,stage,width,height,whole=false){
  const zoom=cameraZoom(stage,Math.min(whole?1:1.2,(width-48)/Math.max(1,rect.width),(height-48)/Math.max(1,rect.height)));
  return{x:(width-rect.width*zoom)/2-rect.x*zoom,y:(height-rect.height*zoom)/2-rect.y*zoom,zoom};
}
