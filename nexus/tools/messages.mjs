import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const source=new URL("../../docs/08-screens/nexus/README.md",import.meta.url);
const redesignSource=new URL("../../docs/08-screens/nexus/redesign-words.md",import.meta.url);
const out=new URL("../ui/messages.js",import.meta.url);
// A table row of four cells that holds words: its name or codes, where, English, Korean.
function* wordRows(text){
  for(const line of text.split(/\r?\n/)){
    if(!line.startsWith("| "))continue;
    const cells=line.slice(1,-1).split("|").map(x=>x.trim());
    if(cells.length!==4||cells[0].startsWith("---")||["Message","Words","Code"].includes(cells[0]))continue;
    if(!cells[2]||!cells[3])continue;
    yield {cells,codes:[...cells[0].matchAll(/`([a-z][a-z_-]+)`/g)].map(m=>m[1])};
  }
}
const SEPARATOR=" · ",braces=text=>[...text.matchAll(/\{([a-zA-Z_ ]+)\}/g)].map(m=>m[1]).sort().join("|");
// Each label of a redesign row has its own values in braces, the same in both languages.
export function checkLabels(name,english,korean){
  const en=english.split(SEPARATOR),ko=korean.split(SEPARATOR);
  if(en.length!==ko.length)throw new Error(`Redesign words "${name}": ${en.length} English labels, ${ko.length} Korean`);
  en.forEach((label,index)=>{if(braces(label)!==braces(ko[index]))throw new Error(`Redesign words "${name}", label ${index+1}: the values in braces differ`);});
}
export function compileMessages(){
  const messages={},redesign={};
  for(const {cells,codes} of wordRows(readFileSync(source,"utf8"))){
    const key=codes[0]||cells[0];
    if(key==="picture_not_found")messages[key+":"+(codes[2]||codes[1]||"not-drawn")]=[cells[2],cells[3]];
    else if(codes.length)for(const code of codes)messages[code]=[cells[2],cells[3]];
    else messages[key]=[cells[2],cells[3]];
  }
  for(const key of ["Drawing","Sending","Steps","Code failed","Loading the overview","sign_in_expired","internal"]){
    if(!messages[key]&&key!=="sign_in_expired")throw new Error("Missing screen words: "+key);
  }
  // The redesign's words (stage 08's redesign-words.md): its codes join 0.2's codes,
  // and its other rows are named lists of labels for the redesign's views.
  for(const {cells,codes} of wordRows(readFileSync(redesignSource,"utf8"))){
    checkLabels(cells[0],cells[2],cells[3]);
    for(const key of codes.length?codes:[cells[0]]){
      const into=codes.length?messages:redesign;
      if(Object.hasOwn(into,key))throw new Error("Redesign words repeat "+key);
      into[key]=[cells[2],cells[3]];
    }
  }
  for(const key of ["Top bar","Buttons not loaded","Legend","Stage names","Stage groups","not_recommended","item_not_found"]){
    if(!messages[key]&&!redesign[key])throw new Error("Missing redesign words: "+key);
  }
  return `// Generated from stage 08 by nexus/tools/messages.mjs. Do not edit.\nexport const messages=${JSON.stringify(messages,null,2)};\n// The redesign's words, from stage 08's redesign-words.md: one row's labels, between " · ".\nexport const redesign=${JSON.stringify(redesign,null,2)};\nexport function words(key,lang="en",values={}) {\n  const pair=messages[key]||messages.internal;\n  return pair[lang==="ko"?1:0].replace(/\\{([a-zA-Z_ ]+)\\}/g,(all,name)=>Object.hasOwn(values,name)?String(values[name]):all);\n}\n`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const generated=compileMessages();
  if(process.argv.includes("--write"))writeFileSync(out,generated);
  else if(readFileSync(out,"utf8")!==generated)throw new Error("Regenerate stage 08 messages");
}
