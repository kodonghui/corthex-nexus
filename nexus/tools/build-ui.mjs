// Build with an external pinned esbuild; the Worker keeps no runtime deps.
import {readFileSync,writeFileSync,mkdirSync,readdirSync,unlinkSync} from "node:fs";
import {resolve,relative,basename,dirname,extname,isAbsolute} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
import {createHash} from "node:crypto";
import {gzipSync} from "node:zlib";
import {patchViewer,VIEWER_SHA} from "../ui/editor-patches.mjs";
import {compileTokens} from "./tokens.mjs";
import {compileMessages} from "./messages.mjs";
const root=fileURLToPath(new URL("../../",import.meta.url)),ui=resolve(root,"nexus/ui"),out=resolve(root,"nexus/src/view-code");
const args=process.argv.slice(2),option=name=>args[args.indexOf(name)+1];
if(!args.includes("--dependencies")||!args.includes("--tool"))throw new Error("Use --dependencies <absolute node_modules> --tool <absolute esbuild/lib/main.js>; esbuild 0.28.2 is an external build tool");
const dependencies=option("--dependencies"),tool=option("--tool");
if(!isAbsolute(dependencies)||!isAbsolute(tool))throw new Error("Use absolute installed tool/dependency paths");
const {build,version}=await import(pathToFileURL(tool));if(version!=="0.28.2")throw new Error("Use pinned external esbuild 0.28.2");
const expected={"@excalidraw/excalidraw":"0.18.1","@dineug/erd-editor":"5.1.0",react:"18.3.1","react-dom":"18.3.1"};
for(const [name,version]of Object.entries(expected))if(JSON.parse(readFileSync(resolve(dependencies,name,"package.json"))).version!==version)throw new Error("Browser dependency differs: "+name);
const sha=bytes=>createHash("sha256").update(bytes).digest("hex"),short=bytes=>sha(bytes).slice(0,8),walk=folder=>readdirSync(folder,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0).flatMap(row=>row.isDirectory()?walk(resolve(folder,row.name)):[resolve(folder,row.name)]);
mkdirSync(out,{recursive:true});
writeFileSync(resolve(ui,"tokens.css"),compileTokens().css);writeFileSync(resolve(ui,"messages.js"),compileMessages());
const files=[],fontMap=new Map(),patches=[],metafiles={},legal=[];
const emit=(name,path,type,bytes,extra={})=>{writeFileSync(resolve(out,path),bytes);const file={name,path,type,raw:Buffer.byteLength(bytes),gzip:gzipSync(bytes).length,payloadSha256:sha(bytes),...extra};files.push(file);return file;};
const fallback=readFileSync(resolve(ui,"vendor/LiberationSans-Regular-2.1.5.woff2"));
if(sha(fallback)!=="455f80807d01a6920a653ed102161cb886594fba540db52be52502f11fbf8322")throw new Error("Pinned OFL fallback font differs");
const fonts=resolve(dependencies,"@excalidraw/excalidraw/dist/prod/fonts");
for(const path of walk(fonts).filter(p=>p.endsWith(".woff2"))){const key=relative(fonts,path).replaceAll("\\","/"),bytes=key==="Liberation/LiberationSans-Regular.woff2"?fallback:readFileSync(path),name=`editor-font-${fontMap.size}.${short(bytes)}.woff2`;emit(name,name,"font/woff2",bytes,{binary:true});fontMap.set("fonts/"+key,"/code/"+name);}
const plugin={name:"nexus-same-origin-editors",setup(builder){builder.onLoad({filter:/\.(js|css)$/},async args=>{
  const path=args.path.replaceAll("\\","/");
  if(path.endsWith("/@dineug/erd-editor/dist/components/erd-viewer/ErdViewer.js")){const contents=patchViewer(readFileSync(args.path,"utf8"));patches.push({name:"erd-viewport-bridge",package:"@dineug/erd-editor@5.1.0",license:"MIT",sourceSha256:VIEWER_SHA});return{contents,loader:"js",resolveDir:dirname(args.path)};}
  if(path.endsWith("/@dineug/erd-editor/dist/components/erd/canvas/high-level-table/HighLevelTable.js")){
    let contents=readFileSync(args.path,"utf8");const needle='fontSize=${nameFontSize(zoomLevel)}',anchor="var HighLevelTable =";
    if(sha(contents)!=="691b0e3906decaf92d128b8f5f58b7093b73b8ffe9716fd87dc0a1da5cb5ec0e"||contents.split(needle).length!==2||contents.split(anchor).length!==2)throw new Error("Pinned ERD label patch changed");patches.push({name:"erd-high-level-label-fit",package:"@dineug/erd-editor@5.1.0",license:"MIT",sourceSha256:sha(contents)});
    const fit=String.raw`// NEXUS modification: fit labels without changing their text.
var fitNameFontSize = (preferred, rect, text) => {
 const lines=String(text).split("\n"),longest=Math.max(1,...lines.map(line=>Array.from(line).length));
 return Math.max(1,Math.min(preferred,(rect.width-TABLE_INSET*2)/(longest*1.05),(rect.height-TABLE_INSET*2)/(lines.length*1.25)));
};
`;
    contents=contents.replace(anchor,fit+anchor).replace(needle,'fontSize=${fitNameFontSize(nameFontSize(zoomLevel),rect,isEmptyName?i18n.value.t("common.unnamed"):nameText(label))}');return{contents,loader:"js",resolveDir:dirname(args.path)};
  }
  if(!path.includes("@excalidraw"))return;
  let contents=readFileSync(args.path,"utf8");
  if(path.endsWith("/@excalidraw/excalidraw/dist/prod/chunk-ZUYEQ4TG.js")){
    if(sha(contents)!=="810dbb85e738f382cdd82e080185029a5ba30c17d3ba0df587e0e6d92e04d952")throw new Error("Pinned Excalidraw configuration changed");
    const config=/VITE_APP_FIREBASE_CONFIG:'[^']*'/g;if([...contents.matchAll(config)].length!==1)throw new Error("Expected one upstream hosted-service configuration");
    patches.push({name:"excalidraw-no-hosted-firebase",package:"@excalidraw/excalidraw@0.18.1",license:"MIT",sourceSha256:sha(contents)});
    contents=contents.replace(config,'VITE_APP_FIREBASE_CONFIG:"{}"');
  }
  contents=contents.replace(/(["'])(\.\/)?(fonts\/[^"']+\.woff2)\1/g,(whole,q,p,key)=>fontMap.has(key)?q+fontMap.get(key)+q:whole).replace(/url\((["']?)(?:\.\/)?(fonts\/[^)'"\s]+\.woff2)\1\)/g,(whole,q,key)=>fontMap.has(key)?`url(${fontMap.get(key)})`:whole).replace("r.push(new URL(n,jn.ASSETS_FALLBACK_URL)),r","r");
  return{contents,loader:path.endsWith(".css")?"css":"js",resolveDir:dirname(args.path)};
});}};
const entries={};
async function bundle(name,entry,define={}){
 const result=await build({absWorkingDir:root,entryPoints:[entry],nodePaths:[dependencies],bundle:true,minify:true,external:["/code/*"],format:"esm",splitting:true,platform:"browser",conditions:["production"],target:"es2022",write:false,outdir:resolve(out,"temporary-"+name),metafile:true,legalComments:"external",plugins:[plugin],define:{"process.env.NODE_ENV":'"production"',...define}});
 const outputs=new Map(result.outputFiles.filter(f=>/\.(js|css)$/.test(f.path)).map(f=>[resolve(f.path),f])),metas=new Map(Object.entries(result.metafile.outputs).map(([p,m])=>[resolve(root,p),m])),ordered=[...outputs].sort(([a],[b])=>a<b?-1:1),graph=sha(Buffer.concat(ordered.flatMap(([p,f])=>[Buffer.from(basename(p)),f.contents]))),names=new Map(ordered.map(([p,f],i)=>[p,`${basename(p).startsWith(basename(entry,extname(entry)))?name:name+"-chunk-"+i}.${short(Buffer.concat([Buffer.from(graph+basename(p)),f.contents]))}${extname(p)}`]));
 const made=new Map();
 function dependency(path,p){const absolute=resolve(root,p);return outputs.has(absolute)?absolute:resolve(dirname(path),p);}
 for(const [path,file]of ordered){let text=file.text;for(const dep of metas.get(path)?.imports||[]){if(dep.external)continue;const target=dependency(path,dep.path);if(!outputs.has(target))throw new Error("Unknown generated chunk dependency");text=text.replaceAll(JSON.stringify("./"+basename(target)),JSON.stringify("/code/"+names.get(target)));}const key=names.get(path);made.set(path,emit(key,key+".txt",extname(path)===".css"?"text/css; charset=utf-8":"text/javascript; charset=utf-8",Buffer.from(text),{graphDigest:graph}));}
 const main=[...outputs.keys()].find(p=>basename(p)===basename(entry,extname(entry))+".js"),css=[...outputs.keys()].find(p=>basename(p)===basename(entry,extname(entry))+".css");if(!main)throw new Error("Entry output missing");entries[name+"-js"]="/code/"+made.get(main).name;if(css)entries[name+"-css"]="/code/"+made.get(css).name;
 const preload=new Set();function staticGraph(path,found=preload){if(found.has(path))return;found.add(path);for(const dep of metas.get(path)?.imports||[])if(!dep.external&&dep.kind==="import-statement")staticGraph(dependency(path,dep.path),found);}staticGraph(main);entries[name+"-preload"]=[...preload].map(p=>"/code/"+made.get(p).name);
 if(name==="excalidraw"){
  // These tiny backends/polyfill are eagerly imported by the pinned library;
  // loading them with the main graph removes a late network round trip.
  const eager=new Set(),locale={en:new Set(),ko:new Set()};
  for(const [path,meta]of metas){
   const inputs=Object.keys(meta.inputs||{}).map(p=>p.replaceAll("\\","/"));
   if(inputs.some(p=>/\/browser-fs-access\/dist\/(?:directory-open|file-open|file-save)-/.test(p)||/\/canvas-roundrect-polyfill\/(?:.*\/)?roundRect\.js$/.test(p)))eager.add(path);
   for(const [lang,code]of [["ko","ko-KR"],["en","en"]])if(inputs.some(p=>p.includes("/locales/")&&basename(p).replace(/(?:-[A-Z0-9]{8})?\.js$/,"")===code))locale[lang].add(path);
  }
  for(const path of eager)staticGraph(path);
  entries[name+"-preload"]=[...preload].map(p=>"/code/"+made.get(p).name);
  for(const [lang,paths]of Object.entries(locale)){const graph=new Set(preload);for(const p of paths)staticGraph(p,graph);entries[name+"-"+lang+"-preload"]=[...graph].map(p=>"/code/"+made.get(p).name);}
 }
 const inputs={};for(const [path,value]of Object.entries(result.metafile.inputs)){const absolute=resolve(root,path);let label=relative(dependencies,absolute).replaceAll("\\","/");if(label.startsWith(".."))label=relative(root,absolute).replaceAll("\\","/");else label="node_modules/"+label;inputs[label]={bytes:value.bytes,sha256:sha(readFileSync(absolute))};}metafiles[name]=inputs;
 for(const file of result.outputFiles.filter(f=>f.path.endsWith(".LEGAL.txt")))legal.push({name:name+"-"+basename(file.path),text:file.text,sha256:sha(file.contents)});
}
await bundle("excalidraw",resolve(ui,"editor-excalidraw.js"));await bundle("erd",resolve(ui,"editor-erd.js"));
await bundle("view",resolve(ui,"core.js"),{__NEXUS_ERD__:JSON.stringify(entries["erd-js"]),__NEXUS_EXCALIDRAW__:JSON.stringify(entries["excalidraw-js"]),__NEXUS_EXCALIDRAW_CSS__:JSON.stringify(entries["excalidraw-css"]||"")});
entries["font-preload"]=["fonts/Assistant/Assistant-Regular.woff2","fonts/Assistant/Assistant-Medium.woff2","fonts/Assistant/Assistant-Bold.woff2"].map(p=>fontMap.get(p)).filter(Boolean);
if(patches.filter(p=>p.name==="erd-viewport-bridge").length!==1||patches.filter(p=>p.name==="erd-high-level-label-fit").length!==1||patches.filter(p=>p.name==="excalidraw-no-hosted-firebase").length!==1)throw new Error("Expected browser patches not applied exactly once");
const imports=files.map((f,i)=>`import f${i} from ${JSON.stringify("./"+f.path)};`).join("\n");writeFileSync(resolve(out,"manifest.js"),imports+"\nexport const code={\n"+files.map((f,i)=>JSON.stringify(f.name)+`:{type:${JSON.stringify(f.type)},body:f${i}}`).join(",\n")+"\n};\nexport const entries="+JSON.stringify(entries)+";\n");
const buildInputs=Object.fromEntries(["nexus/tools/build-ui.mjs","nexus/tools/tokens.mjs","nexus/tools/messages.mjs","nexus/ui/editor-patches.mjs","nexus/ui/package-lock.json","nexus/ui/vendor/liberation-2.1.5.json"].map(path=>[path,sha(readFileSync(resolve(root,path)))]));
const report={packages:expected,tool:{esbuild:version},buildInputs,patches,entries,files,totalRaw:files.reduce((n,f)=>n+f.raw,0),totalGzip:files.reduce((n,f)=>n+f.gzip,0),inputs:metafiles,legalComments:legal.map(({name,sha256})=>({name,sha256}))};
writeFileSync(resolve(out,"sizes.json"),JSON.stringify(report,null,2)+"\n");writeFileSync(resolve(out,"legal-comments.txt"),legal.map(f=>f.name+"\n"+f.text).join("\n\n"));
writeFileSync(resolve(root,"nexus/NOTICE"),readFileSync(resolve(root,"NOTICE"),"utf8")+"\nNEXUS browser components\n========================\n\n"+readFileSync(resolve(ui,"vendor/EDITOR-NOTICES.txt"),"utf8")+"\nThe pinned ERD Viewer also exposes bounded read-only navigation/geometry and a viewport event.\nThe bridge changes only this browser build; uploaded JSON and persisted layout are unchanged.\n\nGenerated bundle legal comments\n==============================\n\n"+legal.map(f=>f.name+"\n"+f.text).join("\n\n"));
// Only obsolete generated payloads in this exact directory are removed, after
// the complete new graph and manifest have been written successfully.
const keep=new Set(files.map(f=>f.path));
for(const name of readdirSync(out))if(/^[a-z0-9-]+\.[0-9a-f]{8}\.(?:js\.txt|css\.txt|woff2)$/.test(name)&&!keep.has(name)){
 const target=resolve(out,name);if(dirname(target)!==out)throw new Error("Generated output escaped its directory");unlinkSync(target);
}
console.log(JSON.stringify({files:files.length,raw:report.totalRaw,gzip:report.totalGzip,patches:patches.map(p=>p.name)}));
