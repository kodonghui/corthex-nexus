import {readFileSync,writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const source=new URL("../../docs/08-screens/nexus/README.md",import.meta.url);
const out=new URL("../ui/messages.js",import.meta.url);
export function compileMessages(){
  const text=readFileSync(source,"utf8"),messages={};
  for(const line of text.split(/\r?\n/)){
    if(!line.startsWith("| "))continue;
    const cells=line.slice(1,-1).split("|").map(x=>x.trim());
    if(cells.length!==4||cells[0].startsWith("---")||["Message","Words","Code"].includes(cells[0]))continue;
    if(!cells[2]||!cells[3])continue;
    const codes=[...cells[0].matchAll(/`([a-z][a-z_-]+)`/g)].map(m=>m[1]);
    const key=codes[0]||cells[0];
    if(key==="picture_not_found")messages[key+":"+(codes[2]||codes[1]||"not-drawn")]=[cells[2],cells[3]];
    else if(codes.length)for(const code of codes)messages[code]=[cells[2],cells[3]];
    else messages[key]=[cells[2],cells[3]];
  }
  for(const key of ["Drawing","Sending","Steps","Code failed","Loading the overview","sign_in_expired","internal"]){
    if(!messages[key]&&key!=="sign_in_expired")throw new Error("Missing screen words: "+key);
  }
  const serialized=JSON.stringify(messages,null,2);
  return `// Generated from stage 08 by nexus/tools/messages.mjs. Do not edit.\nexport const messages=${serialized};\nexport function words(key,lang="en",values={}) {\n  const pair=messages[key]||messages.internal;\n  return pair[lang==="ko"?1:0].replace(/\\{([a-zA-Z_ ]+)\\}/g,(all,name)=>Object.hasOwn(values,name)?String(values[name]):all);\n}\n`;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const generated=compileMessages();
  if(process.argv.includes("--write"))writeFileSync(out,generated);
  else if(readFileSync(out,"utf8")!==generated)throw new Error("Regenerate stage 08 messages");
}
