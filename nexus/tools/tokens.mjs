// Compile this project's frozen DTCG files; no third-party build dependency.
import {readFileSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const variable=name=>"--nx-"+name.replaceAll(".","-");
function collect(node,prefix="",inherited,output=new Map()) {
  if(!node||typeof node!=="object"||Array.isArray(node))throw new Error("Invalid token group: "+prefix);
  const type=node.$type||inherited;
  if(Object.hasOwn(node,"$value")) {
    if(!type||!prefix)throw new Error("A token needs a type and path");
    output.set(prefix,{type,value:node.$value});
  } else for(const [key,value] of Object.entries(node))if(!key.startsWith("$"))collect(value,prefix?prefix+"."+key:key,type,output);
  return output;
}
function dimension(value,units=["px","rem"]) {
  if(!value||!Number.isFinite(value.value)||!units.includes(value.unit))throw new Error("Invalid token dimension");
  return value.value+value.unit;
}
function color(value) {
  if(value?.colorSpace!=="srgb"||!/^#[0-9a-f]{6}$/i.test(value.hex))throw new Error("Invalid token color");
  if(value.alpha===undefined||value.alpha===1)return value.hex;
  if(!Number.isFinite(value.alpha)||value.alpha<0||value.alpha>1)throw new Error("Invalid token alpha");
  const channels=[1,3,5].map(index=>parseInt(value.hex.slice(index,index+2),16));
  return `rgb(${channels.join(" ")} / ${value.alpha})`;
}
function cssValue(token,tokens,seen=new Set()) {
  const {type,value}=token;
  const alias=typeof value==="string"&&/^\{([^{}]+)\}$/.exec(value);
  if(alias) {
    if(!tokens.has(alias[1])||seen.has(alias[1]))throw new Error("Missing or circular token alias");
    cssValue(tokens.get(alias[1]),tokens,new Set([...seen,alias[1]]));
    return `var(${variable(alias[1])})`;
  }
  if(type==="dimension")return dimension(value);
  if(type==="duration")return dimension(value,["ms","s"]);
  if(type==="color")return color(value);
  if(type==="number"||type==="fontWeight") {
    if(!Number.isFinite(value))throw new Error("Invalid numeric token");
    return String(value);
  }
  if(type==="fontFamily") {
    if(!Array.isArray(value)||!value.every(x=>typeof x==="string"))throw new Error("Invalid font family token");
    return value.map(x=>/^(?:system-ui|sans-serif|monospace|ui-monospace|-apple-system)$/.test(x)?x:JSON.stringify(x)).join(", ");
  }
  if(type==="cubicBezier") {
    if(!Array.isArray(value)||value.length!==4||!value.every(Number.isFinite))throw new Error("Invalid curve token");
    return `cubic-bezier(${value.join(", ")})`;
  }
  if(type==="shadow")return [value.offsetX,value.offsetY,value.blur,value.spread].map(x=>dimension(x)).join(" ")+" "+color(value.color);
  throw new Error("Unsupported project token type: "+type);
}
export function compileTokens(projectRoot=root) {
  const folder=resolve(projectRoot,"design/nexus"),read=name=>JSON.parse(readFileSync(resolve(folder,name),"utf8"));
  const resolver=read("tokens.resolver.json");
  if(JSON.stringify(resolver.resolutionOrder)!==JSON.stringify([{$ref:"#/sets/base"},{$ref:"#/modifiers/theme"}]))throw new Error("Review the changed token resolution order");
  const base=collect(read(resolver.sets.base.sources[0].$ref));
  const themes={};
  for(const name of ["light","dark"]) {
    const source=resolver.modifiers.theme.contexts[name];
    if(source.length!==1)throw new Error("Review the changed theme sources");
    themes[name]=collect(read(source[0].$ref));
    if([...themes[name].keys()].some(key=>base.has(key)))throw new Error("A theme overrides a shared token");
  }
  if(JSON.stringify([...themes.light.keys()])!==JSON.stringify([...themes.dark.keys()]))throw new Error("Theme token names differ");
  const declarations=(entries,all)=>[...entries].map(([name,token])=>`  ${variable(name)}: ${cssValue(token,all)};`).join("\n");
  const light=new Map([...base,...themes.light]),dark=new Map([...base,...themes.dark]);
  const css="/* Generated from design/nexus/tokens.resolver.json. Edit no token values here. */\n"+
    ":root {\n"+declarations(light,light)+"\n}\n@media (prefers-color-scheme: dark) {\n:root {\n"+declarations(themes.dark,dark)+"\n}\n}\n";
  return {css,base,light,dark,breakpoint:dimension(base.get("breakpoint.side-panel").value)};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=compileTokens(),output=resolve(root,"nexus/ui/tokens.css");
  if(process.argv.includes("--write"))writeFileSync(output,result.css);
  else if(readFileSync(output,"utf8")!==result.css)throw new Error("Regenerate token CSS with --write");
  console.log(`NEXUS tokens: ${result.base.size} shared, ${result.light.size-result.base.size} per theme; ${result.breakpoint} side panel`);
}
