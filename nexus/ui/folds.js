// The folds of the workspace's columns (SPEC-210, SCR-111#folded): the list of stages from 1,024
// pixels and the talk from 1,280, each kept in the browser's storage for the device, not for a
// project and never on the server (REQ-118), as one of three values: nothing, folded and shown.
// Nothing kept is a first visit, which the stylesheet lays out by the window's width (stage 08's
// layout of the revision); storage that cannot be read or written keeps a fold for the visit.
export const FOLD_KEYS=Object.freeze({stages:"nexus0.3:fold-stages",talk:"nexus0.3:fold-talk"});
export const FOLD_VALUES=Object.freeze(["folded","shown"]);

export function createFolds(ws,{storage=()=>globalThis.localStorage}={}){
  const kept={stages:null,talk:null};
  for(const name of Object.keys(FOLD_KEYS)){
    try{const value=storage()?.getItem(FOLD_KEYS[name]);kept[name]=FOLD_VALUES.includes(value)?value:null;}
    catch{kept[name]=null;}
  }
  // The kept folds as the stylesheet reads them on .ws, both in one step: a folded list as
  // data-nx-stages, and the talk's value as data-nx-talk, which nothing kept leaves out.
  function apply(){
    if(!ws)return;
    if(kept.stages==="folded")ws.dataset.nxStages="folded";else delete ws.dataset.nxStages;
    if(kept.talk)ws.dataset.nxTalk=kept.talk;else delete ws.dataset.nxTalk;
  }
  // What the user last did, fold or show: on the page at once, then in the browser's storage.
  function keep(name,value){
    if(!Object.hasOwn(FOLD_KEYS,name)||!FOLD_VALUES.includes(value))return;
    kept[name]=value;apply();
    try{storage()?.setItem(FOLD_KEYS[name],value);}catch{/* The fold lasts for this visit. */}
  }
  return{apply,keep,value:name=>kept[name]??null};
}
