import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {handle} from "../src/app.js";
import {createViews} from "../src/views.js";
import {words} from "../ui/messages.js";
import {testAccess} from "./access-fixture.js";

const access=await testAccess(),folder=new URL("../src/view-code/",import.meta.url);
const metadata=JSON.parse(readFileSync(new URL("sizes.json",folder))),code=Object.fromEntries(metadata.files.map(f=>[f.name,{type:f.type,body:readFileSync(new URL(f.path,folder))}]));
const views=createViews(code,metadata.entries),template=readFileSync(new URL("../src/hub.html",import.meta.url),"utf8");
const escape=value=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// The way out of each page's message (stage 08's rule 9): the first page has only
// Load again; the hub page and the redesign's pages lead to all projects, the
// first page; 0.2's views lead to the hub page, which moved to /hub (TASK-271).
const WAY_OUT={"/":null,"/hub":"/","/p/synthetic":"/","/p/synthetic/_/05-erd":"/","/pictures/synthetic/_/05-erd":"/hub","/overview/synthetic/_/05-erd":"/hub"};
// 0.2's picture view and stage overview read nothing since TASK-278 leads them to the stage's page
// (SPEC-154): a storage that fails reaches them only there, while Access still refuses them.
const LEADS={"/pictures/synthetic/_/05-erd":"/p/synthetic/_/05-erd","/overview/synthetic/_/05-erd":"/p/synthetic/_/05-erd#view=list"};

test("all six refused pages reuse complete localized messages and frozen critical styles without code requests",async()=>{
 const original=console.error,logs=[];console.error=(...args)=>logs.push(args);
 try{
  for(const lang of["en","ko"])for(const path of Object.keys(WAY_OUT))for(const [problem,ctx,status]of[["access_missing",{},403],["access_other_app",{access:{aud:"another-app"}},403],["internal",access.ctx,500]]){
   const env={...access.env,NEXUS_LANGUAGE:lang,DB:{prepare(){throw new Error("PRIVATE_STORAGE_EXCEPTION_MARKER");}}};
   for(const method of["GET","HEAD"]){
    const response=await handle(new Request("https://nexus.example.com"+path,{method,headers:{...access.headers(),Accept:"text/html"}}),env,ctx,template,views);
    if(problem==="internal"&&LEADS[path]){assert.deepEqual([response.status,response.headers.get("Location"),await response.text()],[302,LEADS[path],""]);continue;}
    assert.equal(response.status,status);assert.equal(response.headers.get("Content-Type"),"text/html; charset=utf-8");assert.match(response.headers.get("Cache-Control"),/no-store/);assert.match(response.headers.get("Content-Security-Policy"),/default-src 'none'/);
    const body=await response.text();if(method==="HEAD"){assert.equal(body,"");continue;}
    assert.ok(body.includes("<h1>"+escape(words(problem,lang))+"</h1>"),lang+" "+problem);
    assert.ok(body.includes(views.refusalCSS));assert.match(body,/prefers-color-scheme:dark/);assert.match(body,/word-break:keep-all/);assert.match(body,/class="content refusal"/);
    const links=[...body.matchAll(/<a class="control" href="([^"]*)">([^<]*)<\/a>/g)].map(([,href,text])=>[href,text]);
    assert.deepEqual(links[0],["",lang==="ko"?"다시 불러오기":"Load again"],path);
    assert.deepEqual(links.slice(1),WAY_OUT[path]===null?[]:[[WAY_OUT[path],WAY_OUT[path]==="/"?escape(words("All projects",lang)):lang==="ko"?"허브로":"Hub"]],path);
    assert.equal((body.match(/class="control"/g)||[]).length,links.length);assert.doesNotMatch(body,/<script|<link|PRIVATE_STORAGE_EXCEPTION_MARKER/);
   }
  }
  assert.equal(logs.length,64);assert.ok(logs.every(([label,value])=>label==="nexus"&&Object.keys(value).sort().join() === "kind,traceId"));
  assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_STORAGE_EXCEPTION_MARKER/);
 }finally{console.error=original;}
});
