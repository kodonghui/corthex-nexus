// Shared with the pinned Excalidraw build so native gestures and the SVG
// handoff can keep the same camera below 10%.
export const EXCALIDRAW_MIN_ZOOM=0.001;

export function cameraZoom(stage,value){
  const erd=stage==="05-erd";
  // ERD Editor 5.1.0 stores zoom to two decimal places.
  const minimum=erd?0.1:EXCALIDRAW_MIN_ZOOM;
  const zoom=Math.max(minimum,Math.min(erd?1.5:5,Number.isFinite(value)?value:.1));
  return erd?Math.round(zoom*100)/100:zoom;
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
