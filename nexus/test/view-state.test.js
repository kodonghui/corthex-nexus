import test from "node:test";
import assert from "node:assert/strict";
import {ApiClient,NexusProblem,Drafts,PendingWrites,LatestReads,characters,writeId} from "../ui/state.js";
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const storage=()=>{const map=new Map();return{getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};
const ids=()=>{let n=0;return()=>"nw_"+(n++).toString(16).padStart(12,"0");};

test("browser transport is origin-bound, manual-redirect and uses a quoted original write ID",async()=>{
  const calls=[],client=new ApiClient("https://nexus.example.com",{fetcher:async(...args)=>{calls.push(args);return Response.json({changed:true});}});
  await client.call("POST","/api/spaces/demo/comments",{body:{text:"안녕 <script>"},write:"nw_aaaaaaaaaaaa"});
  const [url,options]=calls[0];assert.equal(new URL(url).origin,"https://nexus.example.com");
  assert.equal(options.redirect,"manual");assert.equal(options.credentials,"same-origin");assert.equal(options.headers["Idempotency-Key"],'"nw_aaaaaaaaaaaa"');
  assert.deepEqual(JSON.parse(options.body),{text:"안녕 <script>"});
  for(const target of ["https://other.example/x","//other.example/x","/\\other.example/x"])await assert.rejects(client.call("GET",target),error=>error.code==="cross_site");
  assert.equal(calls.length,1);
});
test("an expired login and public errors never expose the server detail",async()=>{
  let client=new ApiClient("https://nexus.example.com",{fetcher:async()=>({type:"opaqueredirect",status:0})});
  await assert.rejects(client.call("GET","/api/view"),error=>error.code==="sign_in_expired");
  client=new ApiClient("https://nexus.example.com",{fetcher:async()=>Response.json({code:"comment_limit",detail:"untrusted private text",traceId:"fixture-trace",limit:2000},{status:409})});
  await assert.rejects(client.call("GET","/api/view"),error=>error instanceof NexusProblem&&error.code==="comment_limit"&&error.traceId==="fixture-trace"&&error.limit===2000&&!Object.hasOwn(error,"detail"));
  // A pass refused by snapshot_changed keeps the commit that the project now shows (SPEC-194), only in its form.
  const held="b".repeat(40);
  client=new ApiClient("https://nexus.example.com",{fetcher:async()=>Response.json({code:"snapshot_changed",detail:"untrusted private text",traceId:"fixture-trace",held_commit:held},{status:409})});
  await assert.rejects(client.call("GET","/api/view"),error=>error.code==="snapshot_changed"&&error.held_commit===held&&!Object.hasOwn(error,"detail"));
  for(const other of["B".repeat(40),"b".repeat(39),"<b>x</b>",40])
    await assert.rejects(new ApiClient("https://nexus.example.com",{fetcher:async()=>Response.json({code:"snapshot_changed",held_commit:other},{status:409})}).call("GET","/api/view"),error=>!Object.hasOwn(error,"held_commit"));
});
test("the removal goes once, without a write ID or a body, and every other write still needs its ID (API-108, SCR-130)",async()=>{
  const calls=[],client=new ApiClient("https://nexus.example.com",{fetcher:async(...args)=>{calls.push(args);return Response.json({name:"demo",removed:true});}});
  assert.deepEqual(await client.call("DELETE","/api/snapshots/demo",{once:true}),{name:"demo",removed:true});
  const [,options]=calls[0];
  assert.equal(options.method,"DELETE");assert.equal(options.body,undefined);
  assert.ok(!Object.hasOwn(options.headers,"Idempotency-Key")&&!Object.hasOwn(options.headers,"Content-Type"),"no write ID and no body");
  assert.equal(options.redirect,"manual");assert.equal(options.credentials,"same-origin");
  await assert.rejects(client.call("DELETE","/api/snapshots/demo"),/original ID/);
  await assert.rejects(client.call("POST","/api/spaces/demo/comments",{once:true,body:{}}),/original ID/,"once is the removal's only");
  await assert.rejects(client.call("DELETE","https://other.example/api/snapshots/demo",{once:true}),error=>error.code==="cross_site");
  assert.equal(calls.length,1);
});
test("the export comes whole, as the server wrote it, with its Content-Disposition (API-178, SCR-130)",async()=>{
  const text='{"format":1,"project":"demo","counts":{}}',disposition='attachment; filename="nexus-demo-2026-11-14.json"';
  const client=new ApiClient("https://nexus.example.com",{fetcher:async()=>new Response(text,{headers:{"Content-Type":"application/json","Content-Disposition":disposition}})});
  const reply=await client.file("/api/spaces/demo/export");
  assert.equal(reply.text,text);assert.deepEqual(reply.data,JSON.parse(text));assert.equal(reply.disposition,disposition);
  // A reply cut on its way is no JSON: no file.
  const cut=new ApiClient("https://nexus.example.com",{fetcher:async()=>new Response(text.slice(0,-3),{headers:{"Content-Disposition":disposition}})});
  await assert.rejects(cut.file("/api/spaces/demo/export"),error=>error.code==="internal");
  // A refusal keeps its code and trace ID, as a read's does.
  const refused=new ApiClient("https://nexus.example.com",{fetcher:async()=>Response.json({code:"user_only",traceId:"fixture-trace",detail:"private"},{status:403})});
  await assert.rejects(refused.file("/api/spaces/demo/export"),error=>error.code==="user_only"&&error.traceId==="fixture-trace"&&!Object.hasOwn(error,"detail"));
});
test("the deadline covers a stalled response body and a late result cannot become success",async()=>{
  const body=deferred();let signal;
  const client=new ApiClient("https://nexus.example.com",{deadline:10,fetcher:async(_,options)=>{signal=options.signal;return{ok:true,status:200,json:()=>body.promise};}});
  await assert.rejects(client.call("GET","/api/view"),error=>error.code==="timeout");
  assert.equal(signal.aborted,true);body.resolve({late:true});
});
test("draft text and ID survive reload/retry, while editing creates a different write",()=>{
  const disk=storage(),makeId=ids();let drafts=new Drafts({storage:()=>disk,makeId});
  const first=drafts.update("item",{text:"😀한글 <img>",settles:true});
  drafts=new Drafts({storage:()=>disk,makeId});assert.deepEqual(drafts.ensure("item"),first);
  const edited=drafts.update("item",{text:"다른 말",settles:false});assert.notEqual(edited.write,first.write);
  assert.equal(drafts.clear("item",first.write),false);assert.equal(drafts.read("item").text,"다른 말");
  assert.equal(drafts.clear("item",edited.write),true);assert.equal(drafts.read("item").text,"");
  assert.equal(characters("😀한글"),3);
});
test("private-window storage failure retains the draft in this page",()=>{
  const drafts=new Drafts({storage:()=>{throw new Error("unavailable");},makeId:ids()});
  const first=drafts.update("checkpoint",{text:"",settles:false});assert.deepEqual(drafts.ensure("checkpoint"),first);
  const changed=drafts.update("checkpoint",{text:"Keep this"});assert.equal(drafts.read("checkpoint").text,"Keep this");
  assert.notEqual(changed.write,first.write);
});
test("double sends and closing/reopening a pending form share one write",async()=>{
  const writes=new PendingWrites(),send=deferred();let calls=0;const pending=[];
  writes.subscribe((scope,value)=>pending.push([scope,value]));
  const first=writes.run("item",()=>{calls++;return send.promise;});
  const reopened=writes.run("item",()=>{calls++;throw new Error("duplicate send");});
  assert.equal(first,reopened);assert.equal(writes.has("item"),true);
  await Promise.resolve();assert.equal(calls,1);send.resolve({id:1});await first;
  assert.deepEqual(pending,[["item",true],["item",false]]);assert.equal(writes.has("item"),false);
});
test("out-of-order reads cannot roll a panel back to its previous data",async()=>{
  const latest=new LatestReads(),old=deferred(),fresh=deferred(),shown=[];
  const first=latest.run("panel",()=>old.promise,value=>shown.push(value));
  const second=latest.run("panel",()=>fresh.promise,value=>shown.push(value));
  fresh.resolve("current");assert.equal(await second,true);old.resolve("old");assert.equal(await first,false);assert.deepEqual(shown,["current"]);
});
test("browser write IDs have the contract's alphabet and length",()=>{
  assert.match(writeId(),/^nw_[0-9a-hjkmnp-tv-z]{12}$/);
});

test("an old failed read cannot replace a newly opened panel with its error",async()=>{
  const latest=new LatestReads(),old=deferred(),shown=[];
  const first=latest.run("panel",()=>old.promise,value=>shown.push(value));
  await latest.run("panel",async()=>"current",value=>shown.push(value));
  old.reject(new Error("old request failed"));assert.equal(await first,false);
  assert.deepEqual(shown,["current"]);
  await assert.rejects(latest.run("panel",async()=>{throw new Error("current failed");},()=>{}),/current failed/);
});
