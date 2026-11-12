import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync}from"node:fs";
import {createHash}from"node:crypto";
import {createViews}from"../src/views.js";
import {handle,VIEW_POLICY}from"../src/app.js";
import {fakeD1}from"./fake-d1.js";
import {testAccess}from"./access-fixture.js";
const metadata=JSON.parse(readFileSync(new URL("../src/view-code/sizes.json",import.meta.url))),folder=new URL("../src/view-code/",import.meta.url),code=Object.fromEntries(metadata.files.map(f=>[f.name,{type:f.type,body:readFileSync(new URL(f.path,folder))}])),views=createViews(code,metadata.entries);
test("prebuilt browser code is content-hashed, self-contained and beneath the measured Worker limit",()=>{
 const names=new Set();let bytes=0;
 for(const file of metadata.files){assert.match(file.name,/^[a-z0-9][a-z0-9-]{0,63}\.[0-9a-f]{8}\.(js|css|woff2)$/);assert.ok(!names.has(file.name));names.add(file.name);const held=code[file.name].body;assert.equal(held.length,file.raw);assert.equal(createHash("sha256").update(held).digest("hex"),file.payloadSha256);bytes+=held.length;
  if(file.type.startsWith("text/javascript")||file.type.startsWith("text/css"))for(const m of held.toString().matchAll(/\/code\/([a-z0-9-]+\.[0-9a-f]{8}\.(?:js|css|woff2))/g))assert.ok(Object.hasOwn(code,m[1]),m[1]);
  if(file.type.startsWith("text/javascript"))assert.doesNotMatch(held.toString(),/AIza[0-9A-Za-z_-]{35}/,"The read-only editor must not ship the upstream hosted Firebase key");
 }
 assert.equal(bytes,metadata.totalRaw);assert.ok(bytes<64*1024*1024);assert.equal(metadata.patches.filter(p=>p.name==="erd-viewport-bridge").length,1);
 assert.equal(metadata.patches.filter(p=>p.name==="excalidraw-no-hosted-firebase").length,1);
 for(const [path,digest]of Object.entries({...metadata.buildInputs,...Object.fromEntries(Object.values(metadata.inputs).flatMap(inputs=>Object.entries(inputs).filter(([p])=>!p.startsWith("node_modules/")).map(([p,v])=>[p,v.sha256])))}))assert.equal(createHash("sha256").update(readFileSync(new URL("../../"+path,new URL("./",import.meta.url)))).digest("hex"),digest,path+" needs a rebuild");
});
test("overview loads core only, and each picture preloads only its own editor with localized static fallback",()=>{
 const overview=views.template({view:"overview",lang:"ko",data:{stage:"05-erd"}});assert.match(overview,/단계 현황을 불러오는 중/);assert.ok(!overview.includes(metadata.entries["erd-js"]));assert.ok(!overview.includes(metadata.entries["excalidraw-js"]));
 for(const [stage,kind]of[["05-erd","erd"],["01-domain","excalidraw"],["07-sitemap","excalidraw"]]){const html=views.template({view:"picture",lang:"en",data:{stage,picture:{}}});assert.ok(html.includes(metadata.entries[kind+"-js"]));assert.match(html,/Loading the picture view/);assert.equal(html.split("__CORTHEX_VIEW_DATA__").length,2);}
 assert.throws(()=>createViews({}, {core:"https://cdn.invalid/editor.js"}),/Invalid bundled/);
});
test("the handler leads 0.2's picture view to the stage's page, which the views draw, while code and font delivery still require Access",async()=>{
 const access=await testAccess(),env={...access.env,DB:fakeD1(),NEXUS_LANGUAGE:"ko"},hub=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8"),snapshot=JSON.parse(readFileSync(new URL("./snapshot-02-example.json",import.meta.url)));
 const req=(path,options={})=>new Request("https://nexus.example.com"+path,{headers:access.headers(),...options});
 assert.equal((await handle(req("/api/snapshots",{method:"POST",headers:{...access.headers("agent"),"Content-Type":"application/json"},body:JSON.stringify(snapshot)}),env,access.ctx,hub,views)).status,200);
 // 0.2's picture view answers 302 to the stage's page (TASK-278, SPEC-154); its early hints went
 // with its page, so a server that still sets NEXUS_EARLY_HINTS adds none.
 for(const settings of[env,{...env,NEXUS_EARLY_HINTS:"1"}]){const led=await handle(req("/pictures/corthex/nexus/05-erd"),settings,access.ctx,hub,views);assert.deepEqual([led.status,led.headers.get("Location"),led.headers.get("Link"),led.headers.get("Cache-Control")],[302,"/p/corthex/nexus/05-erd",null,"no-store"]);}
 const response=await handle(req("/p/corthex/nexus/05-erd"),env,access.ctx,hub,views),html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get("Content-Security-Policy"),VIEW_POLICY);assert.ok(html.includes(metadata.entries["page-js"]));assert.ok(!html.includes(metadata.entries["view-js"]));assert.match(html,/<html lang="ko">/);
 assert.equal(response.headers.get("Link"),null);
 const refused=await handle(req("/pictures/corthex/nexus/05-erd"),env,{},hub,views);assert.equal(refused.status,403);assert.equal(refused.headers.get("Location"),null);
 for(const file of[metadata.files.find(f=>f.binary),metadata.files.find(f=>f.type.startsWith("text/javascript"))]){const path="/code/"+file.name,ok=await handle(req(path),env,access.ctx,hub,views);assert.equal(ok.status,200);assert.equal(ok.headers.get("Content-Type"),file.binary?"font/woff2":"text/javascript; charset=utf-8","stage-06 API-104 media type");
  assert.equal(ok.headers.get("Cache-Control"),"public, max-age=31536000, immutable");assert.equal(ok.headers.get("Set-Cookie"),null);assert.notEqual(ok.headers.get("Vary"),"*");
  const bytes=Buffer.from(await ok.arrayBuffer());assert.equal(bytes.byteLength,file.raw);assert.equal(createHash("sha256").update(bytes).digest("hex"),file.payloadSha256);
  const other=await handle(req(path,{headers:{...access.headers("agent"),"Nexus-Session":"private-fixture-context"}}),env,access.ctx,hub,views);assert.equal(other.status,200);assert.ok(bytes.equals(Buffer.from(await other.arrayBuffer())),"cached bytes must not vary with project/session/identity");
  const refused=await handle(req(path),env,{},hub,views);assert.equal(refused.status,403);assert.equal(refused.headers.get("Cache-Control"),"no-store");}
});
test("views take IBM Plex from one cacheable same-origin stylesheet of the packages' Unicode-range slices (stage 09, REQ-147)",async()=>{
 const href=metadata.entries["fonts-css"];assert.match(href,/^\/code\/fonts\.[0-9a-f]{8}\.css$/);const sheet=code[href.slice(6)];assert.ok(sheet);assert.equal(sheet.type,"text/css; charset=utf-8");
 const css=sheet.body.toString(),rules=css.trim().split("\n"),weights={};
 for(const rule of rules){
  const m=rule.match(/^@font-face\{font-family:"(IBM Plex Sans KR|IBM Plex Mono)";font-style:normal;font-display:swap;font-weight:(\d+);src:url\(\/code\/([a-z0-9-]+\.[0-9a-f]{8}\.woff2)\) format\("woff2"\);unicode-range:(U\+[0-9a-f?-]+(?:,U\+[0-9a-f?-]+)*)\}$/i);assert.ok(m,rule.slice(0,120));
  assert.equal(code[m[3]]?.type,"font/woff2",m[3]);const key=m[1]+" "+m[2];weights[key]=(weights[key]||0)+1;
 }
 assert.deepEqual(Object.keys(weights).sort(),["IBM Plex Mono 400","IBM Plex Mono 500","IBM Plex Sans KR 400","IBM Plex Sans KR 500","IBM Plex Sans KR 600"]);
 assert.ok(rules.length===new Set(rules.map(r=>r.match(/url\(([^)]+)\)/)[1])).size,"each slice is its own file");
 assert.doesNotMatch(css,/https?:|\.woff\)/,"no other origin and no WOFF fallback");
 assert.equal(metadata.packages["@fontsource/ibm-plex-sans-kr"],"5.3.0");assert.equal(metadata.packages["@fontsource/ibm-plex-mono"],"5.3.0");
 const inert=`<template id="nexus-font-assets"><link rel="stylesheet" href="${href}" data-nexus-css="fonts"></template>`;
 for(const payload of[{view:"overview",lang:"ko",data:{stage:"05-erd"}},{view:"picture",lang:"en",data:{stage:"05-erd",picture:{}}},{view:"picture",lang:"ko",data:{stage:"01-domain",picture:{}}}]){const html=views.template(payload);assert.equal(html.split(inert).length,2,"inert until the first paint");assert.equal(html.split(href).length,2);}
 assert.doesNotMatch(views.refusalCSS,/@font-face/,"a refusal keeps only the inline critical stylesheet");
 assert.match(VIEW_POLICY,/font-src 'self'/);assert.match(VIEW_POLICY,/style-src 'self'/);
});
