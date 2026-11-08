// The redesign's words come from stage 08's redesign-words.md through
// nexus/tools/messages.mjs: each row a list of labels between " · ".
import {words,redesign} from "../../ui/messages.js";
const SEPARATOR=" · ";
const fill=(text,values)=>text.replace(/\{([a-zA-Z_ ]+)\}/g,(all,name)=>Object.hasOwn(values,name)?String(values[name]):all);
export function labels(key,lang){
  if(!Object.hasOwn(redesign,key))throw new Error("No redesign words: "+key);
  return redesign[key][lang==="ko"?1:0].split(SEPARATOR);
}
export function label(key,index,lang,values={}){
  const list=labels(key,lang);
  if(!Number.isInteger(index)||index<0||index>=list.length)throw new Error(`No label ${index} in ${key}`);
  return fill(list[index],values);
}
// A code's message, as rule 3 shows it: its first label, which the redesign's codes
// follow with the words of their own state, such as SCR-115#gone's link.
export const codeMessage=(code,lang,values={})=>fill(words(code,lang).split(SEPARATOR)[0],values);
// The legend's words without their symbols, which the page draws as icons (rule 13).
const LEGEND=Object.freeze({done:0,in_progress:1,not_started:2,skipped:3,unknown:4,picture:5});
export const legendWord=(name,lang)=>label("Legend",LEGEND[name]??LEGEND.unknown,lang).replace(/^[^\p{L}\p{N}]+\s+/u,"");
export const STATES=Object.freeze(["done","in_progress","not_started","skipped","unknown"]);
