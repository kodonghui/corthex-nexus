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
test("actual handler uses the view factory while code and font delivery still require Access",async()=>{
 const access=await testAccess(),env={...access.env,DB:fakeD1(),NEXUS_LANGUAGE:"ko"},hub=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8"),snapshot=JSON.parse(readFileSync(new URL("./snapshot-02-example.json",import.meta.url)));
 const req=(path,options={})=>new Request("https://nexus.example.com"+path,{headers:access.headers(),...options});
 assert.equal((await handle(req("/api/snapshots",{method:"POST",headers:{...access.headers("agent"),"Content-Type":"application/json"},body:JSON.stringify(snapshot)}),env,access.ctx,hub,views)).status,200);
 const response=await handle(req("/pictures/corthex/nexus/05-erd"),env,access.ctx,hub,views),html=await response.text();assert.equal(response.status,200);assert.equal(response.headers.get("Content-Security-Policy"),VIEW_POLICY);assert.ok(html.includes(metadata.entries["view-js"]));assert.match(html,/<html lang="ko">/);
 assert.equal(response.headers.get("Link"),null,"hints are opt-in");
 const enabled={...env,NEXUS_EARLY_HINTS:"1"};
 const hinted=await handle(req("/pictures/corthex/nexus/05-erd"),enabled,access.ctx,hub,views);
 assert.equal(hinted.status,200);assert.equal(hinted.headers.get("Cache-Control"),"no-store");assert.equal(hinted.headers.get("Content-Security-Policy"),VIEW_POLICY);
 assert.ok(hinted.headers.get("Link").includes(metadata.entries["erd-js"]));
 assert.doesNotMatch(hinted.headers.get("Link"),/corthex\/nexus|project|Bearer|Assertion|\/api\//);
 for(const path of hinted.headers.get("Link").matchAll(/<([^>]+)>/g))assert.ok(Object.hasOwn(code,path[1].slice(6)));
 const refusedHints=await handle(req("/pictures/corthex/nexus/05-erd"),enabled,{},hub,views);assert.equal(refusedHints.status,403);assert.equal(refusedHints.headers.get("Link"),null);
 for(const file of[metadata.files.find(f=>f.binary),metadata.files.find(f=>f.type.startsWith("text/javascript"))]){const path="/code/"+file.name,ok=await handle(req(path),env,access.ctx,hub,views);assert.equal(ok.status,200);assert.equal(ok.headers.get("Content-Type"),file.binary?"font/woff2":"text/javascript; charset=utf-8","stage-06 API-104 media type");
  assert.equal(ok.headers.get("Cache-Control"),"public, max-age=31536000, immutable");assert.equal(ok.headers.get("Set-Cookie"),null);assert.notEqual(ok.headers.get("Vary"),"*");
  const bytes=Buffer.from(await ok.arrayBuffer());assert.equal(bytes.byteLength,file.raw);assert.equal(createHash("sha256").update(bytes).digest("hex"),file.payloadSha256);
  const other=await handle(req(path,{headers:{...access.headers("agent"),"Nexus-Session":"private-fixture-context"}}),env,access.ctx,hub,views);assert.equal(other.status,200);assert.ok(bytes.equals(Buffer.from(await other.arrayBuffer())),"cached bytes must not vary with project/session/identity");
  const refused=await handle(req(path),env,{},hub,views);assert.equal(refused.status,403);assert.equal(refused.headers.get("Cache-Control"),"no-store");}
});
