// An item's source fields and a discrepancy's reasons in words (SCR-106, SCR-109).
// The words come from stage 08; the codes themselves stay under Details.
import {words} from "./messages.js";

export const FIELDS=Object.freeze(["context","terms","primary_key","unique","foreign_keys","path","flows","purpose"]);
const ACTIONS=["cascade","set null","set default","restrict","no action"];
// Split a row into its labels first, so a name holding " · " cannot shift them.
const labels=(key,lang)=>words(key,lang).split(" · ");
const fill=(text,values)=>text.replace(/\{([a-zA-Z_ ]+)\}/g,(all,name)=>Object.hasOwn(values,name)?String(values[name]):all);

export function itemFields(raw,lang){
  if(!raw||typeof raw!=="object")return[];
  const names=labels("Item fields",lang),[none,partial]=labels("Item values",lang),actions=labels("On delete",lang),[named,bare]=labels("Foreign key",lang);
  const list=value=>Array.isArray(value)?(value.length?value.map(String).join(", "):none):typeof value==="string"&&value.trim()?value:none;
  const unique=keys=>Array.isArray(keys)&&keys.length?keys.map(key=>key?.partial?fill(partial,{columns:list(key?.columns)}):list(key?.columns)).join("; "):none;
  const foreign=keys=>Array.isArray(keys)&&keys.length?keys.map(key=>{
    const index=ACTIONS.indexOf(key?.on_delete||"no action"),action=index<0?String(key.on_delete):actions[index];
    const references=Array.isArray(key?.references)&&key.references.length;
    return fill(references?named:bare,{columns:list(key?.columns),table:String(key?.table||""),references:references?list(key.references):"",action});
  }).join(" "):none;
  const shown={unique,foreign_keys:foreign};
  return FIELDS.filter(field=>raw[field]!==undefined).map(field=>({field,name:names[FIELDS.indexOf(field)],text:(shown[field]||list)(raw[field])}));
}

export function reasonText(reason,compares,lang){
  const screen=compares==="read-model-screen",kind=reason?.kind;
  if(kind==="no-term")return labels("No 01 term",lang)[screen?1:0];
  if(kind==="not-on-board")return words("Not on the board",lang);
  if(kind==="other-context"){
    const [board,here]=Array.isArray(reason.contexts)?reason.contexts:[],none=labels("Item values",lang)[0];
    return fill(labels("Other context",lang)[screen?1:0],{board:board||none,here:here||none});
  }
  if(kind==="removed")return labels("Removed",lang)[reason.side==="term"?0:screen?2:1];
  if(kind==="no-table")return words("No table",lang);
  if(kind==="no-screen")return words("No screen",lang);
  return String(kind||"");
}
