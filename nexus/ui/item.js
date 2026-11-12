// The item's panel's code (SCR-115, SPEC-149), in a stage page's side: the item that the address
// selects, read from the server (API-157) with what the row or the picture showed of it until the
// answer comes (SCR-115#loading); on a pictured stage the picture's own fields of it and its open
// discrepancies (API-111); the stages of its trace that the user unfolded; and why the stage does
// not show it where the user looks, which ./stage.js finds. The panel's talk is the talk's own
// (./talk.js), narrowed to the item. The stage page (./stage.js) draws it and calls in.
import {LatestReads} from "./state.js";
import {pictureScene} from "../src/draw/picture.js";
import {stagePath} from "../src/draw/stages.js";
import {KINDS} from "../src/draw/item.js";

const REFUSED=Object.freeze(["sign_in_expired","access_missing","access_other_app","user_only"]);
// After these the page's place is gone, and the page reads again (SCR-115#error).
const PLACE=Object.freeze(["project_not_found","space_not_found","part_not_found"]);
const WHY=Object.freeze(["stale","none","narrowed"]);

export function createItem({payload,view,api,base,project,part,stage,entries,render,refreshPage,onGone}){
  const reads=new LatestReads();
  const url=id=>`${base}/items/${encodeURIComponent(id)}?part=${encodeURIComponent(part||"_")}`;
  // The item in the picture as a whole, a DDD board's every step: its first box with the ID.
  function node(id){
    const scene=pictureScene(payload.picture,stage);
    return scene?.nodes.find(entry=>entry.kind!=="lane"&&entry.id===id)||null;
  }
  // What the row or the picture shows of the item, until the server's answer comes.
  function seed(id){
    const row=entries().find(entry=>String(entry.id)===id);
    if(row)return{kind:row.kind,title:row.title};
    const box=node(id);
    return box?{kind:KINDS.includes(box.kind)?box.kind:undefined,title:box.raw?.name??box.raw?.title}:{};
  }
  // On a pictured stage, its open discrepancies as the picture holds them, on it or on its term.
  const discrepancies=id=>(payload.picture?.discrepancies||[]).filter(d=>d&&d.state!=="resolved"&&(d.item===id||d.term===id));

  // Opening an item: its panel at once, then the server's answer; the same item again keeps the
  // panel as it is (SCR-115's repeats). True when a new item opened.
  function open(id){
    if(view.item?.id===id)return false;
    view.item={id,state:"loading",data:null,seed:seed(id),raw:node(id)?.raw||null,discrepancies:discrepancies(id),error:null,why:null,open:{}};
    read(id);
    return true;
  }
  function close(){reads.invalidate("item");view.item=null;}
  async function read(id){
    const shown=view.item;if(!shown||shown.id!==id)return;
    view.item={...shown,state:"loading",error:null};render(["side","tabs"]);
    try{
      const ran=await reads.run("item",()=>api.call("GET",url(id)),answer=>{
        if(!answer?.item||answer.item.id!==id)throw new Error("Unreadable answer");
        if(view.item?.id!==id)return;
        // An address that names an item of another stage leads to its stage (SCR-115's Target).
        if(answer.item.stage!==stage){location.replace(stagePath(project,part,answer.item.stage)+"#item="+encodeURIComponent(id));return;}
        view.item={...view.item,state:"ready",data:answer,error:null};
      });
      if(!ran)return;
    }catch(error){
      if(view.item?.id!==id)return;
      const code=error?.code||"internal",trace=error?.traceId;
      if(code==="item_not_found"){view.item={...view.item,state:"gone",error:null,why:null};onGone(id);}
      else if(REFUSED.includes(code))view.item={...view.item,state:"refused",error:{code,trace}};
      else{
        view.item={...view.item,state:"failed",error:{code,trace}};
        if(PLACE.includes(code))refreshPage();
      }
    }
    render(["side","tabs"]);
  }
  return{
    open,close,
    // Try again, which is unavailable while it runs, and the reading after a discrepancy that was
    // resolved meanwhile (SCR-115's repeats and state changes).
    read(){const shown=view.item;if(shown&&shown.state!=="loading")read(shown.id);},
    // Why the stage does not show the item where the user looks (rule 24).
    setWhy(id,why){if(view.item?.id===id&&view.item.state!=="gone"){view.item={...view.item,why:WHY.includes(why)?why:null};render(["side"]);}},
    // A stage of the trace unfolded: its links after the first six (SCR-115's limits).
    unfold(key,stage_){
      const shown=view.item;if(!shown||!["from","to"].includes(key))return;
      const open=shown.open[key]||[];if(open.includes(stage_))return;
      view.item={...shown,open:{...shown.open,[key]:[...open,stage_]}};
    },
    // Before each drawing: the picture's fields and discrepancies of the item, as the page holds
    // them now, after a newer picture or a reading again.
    sync(){
      const shown=view.item;if(!shown)return;
      shown.raw=node(shown.id)?.raw||null;shown.discrepancies=shown.state==="gone"?[]:discrepancies(shown.id);
    },
  };
}
