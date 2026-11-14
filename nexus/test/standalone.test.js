// TASK-259/260/262: real TCP, RSA signatures, on-disk SQLite and restore.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request as httpRequest } from "node:http";
import { createConnection } from "node:net";
import { createHash } from "node:crypto";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { AccessVerifier } from "../src/access.js";
import { createNodeServer, publicOrigin } from "../src/node-server.js";
import { SQLiteD1 } from "../src/sqlite.js";
import { Store, MIGRATIONS } from "../src/store.js";
import { backupDatabase, restoreDatabase, retainBackups } from "../tools/database.js";

const env = { ACCESS_AUD: "synthetic-audience", ACCESS_TEAM_DOMAIN: "access.example.com", NEXUS_LANGUAGE: "ko" };
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "synthetic", alg: "RS256" };
async function token(changes = {}, signing = pair.privateKey) {
  const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const content = b64({ alg: "RS256", kid: jwk.kid }) + "." + b64({ iss: "https://access.example.com", aud: [env.ACCESS_AUD], exp: Math.floor(Date.now() / 1000) + 600, sub: "synthetic-person", ...changes });
  return content + "." + Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signing, new TextEncoder().encode(content))).toString("base64url");
}
const verifier = (requireContext = false) => new AccessVerifier({ requireContext, fetcher: async (url) => {
  assert.equal(url, "https://access.example.com/cdn-cgi/access/certs");
  return Response.json({ keys: [jwk] });
} });
const template = readFileSync(new URL("../src/hub.html", import.meta.url), "utf8");
const example = () => JSON.parse(readFileSync(new URL("./snapshot-02-example.json", import.meta.url), "utf8"));
const withoutPictures = ({ pictures, ...body }) => body;

async function fixture(t) {
  const folder = mkdtempSync(join(tmpdir(), "nexus-standalone-"));
  const database = join(folder, "db.sqlite");
  const db = new SQLiteD1(database);
  const metrics = [];
  const server = createNodeServer({ env: { ...env, DB: db }, origin: "https://nexus.example.com", template, verifier: verifier(), onMetric: (row) => metrics.push(row) });
  await server.start();
  assert.equal(server.address().address, "127.0.0.1");
  const base = `http://127.0.0.1:${server.address().port}`;
  let seq = 0;
  const call = async (method, path, body, { jwt, headers = {} } = {}) => {
    const response = await fetch(base + path, { method, headers: { "Cf-Access-Jwt-Assertion": jwt ?? await token(), ...(method === "POST" ? { "Idempotency-Key": '"nw_' + (++seq).toString().padStart(12, "0") + '"' } : {}), ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...headers }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
    const text = await response.text();
    return { status: response.status, headers: response.headers, text, data: text && response.headers.get("Content-Type")?.includes("json") ? JSON.parse(text) : null };
  };
  t.after(async () => { await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }); db.close(); rmSync(folder, { recursive: true, force: true }); });
  return { folder, database, db, server, call, metrics };
}

test("standalone signs in without ctx, and keeps issuer, audience, expiry, nbf and signature checks", async (t) => {
  const { call, metrics } = await fixture(t);
  assert.equal((await call("GET", "/api/snapshots")).status, 200);
  const other = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
  for (const jwt of ["malformed", await token({ iss: "https://other.example.com" }), await token({ aud: ["other"] }), await token({ exp: 1 }), await token({ nbf: Date.now() / 1000 + 60 }), await token({}, other.privateKey)]) {
    assert.equal((await call("GET", "/api/snapshots", undefined, { jwt })).status, 403);
  }
  assert.equal((await call("GET", "/api/snapshots", undefined, { headers: { "Cf-Access-Jwt-Assertion": "" } })).status, 403);
  assert.deepEqual(Object.keys(metrics[0]).sort(), ["after_body_ms", "body_complete", "body_receive_ms", "cpu_system_ms", "cpu_user_ms", "processing_ms", "request_bytes", "rss_bytes", "status"]);
  assert.ok(Object.values(metrics[0]).every((value) => Number.isFinite(value) && value >= 0));
  const agentRequest = new Request("https://nexus.example.com", { headers: { "Cf-Access-Jwt-Assertion": await token({ sub: "", common_name: "synthetic-client" }) } });
  assert.equal(await verifier().verify(agentRequest, env, {}), "agent");
  // Worker mode still refuses the same signed token with no checked context.
  await assert.rejects(verifier(true).verify(new Request("https://nexus.example.com", { headers: { "Cf-Access-Jwt-Assertion": await token() } }), env, {}), (error) => error.code === "access_missing");
});

test("real TCP adapter preserves the snapshot, discussion, checkpoint and cross-site contracts", async (t) => {
  const { call } = await fixture(t);
  const snapshot = example();
  assert.equal((await call("POST", "/api/snapshots", snapshot)).status, 200);
  assert.deepEqual((await call("GET", "/api/snapshots/corthex")).data, withoutPictures(snapshot));
  const body = { part: "nexus", stage: "05-erd", item: "TBL-111", text: "질문입니다" };
  assert.equal((await call("POST", "/api/spaces/corthex/comments", body, { headers: { "Sec-Fetch-Site": "cross-site" } })).data.code, "cross_site");
  const comment = await call("POST", "/api/spaces/corthex/comments", body);
  assert.equal(comment.status, 201, comment.text);
  const reply = await call("POST", `/api/spaces/corthex/comments/${comment.data.id}/replies`, { text: "답변입니다", settles: true });
  assert.equal(reply.status, 201, reply.text);
  const checkpoint = await call("POST", "/api/spaces/corthex/checkpoints", { part: "nexus", stage: "05-erd", words: "확인했습니다", commit: snapshot.repos["."].default.commit });
  assert.equal(checkpoint.status, 201, checkpoint.text);
  assert.equal((await call("HEAD", "/")).text, "");
  assert.equal((await call("PATCH", "/api/snapshots")).status, 405);
  assert.equal((await call("POST", "/api/snapshots", "x".repeat(1048577))).data.code, "snapshot_too_large");
  assert.equal((await call("GET", "/api/snapshots")).status, 200);
});

test("SQLite batch rolls back earlier statements and DDL on failure, and survives reopening", async (t) => {
  const { db, database } = await fixture(t);
  await new Store(db).ensure();
  await assert.rejects(db.batch([db.prepare("CREATE TABLE rollback_probe (value TEXT)"), db.prepare("INSERT INTO rollback_probe VALUES (?)").bind("synthetic"), db.prepare("INSERT INTO no_such_table VALUES (1)")]));
  assert.equal(await db.prepare("SELECT name FROM sqlite_master WHERE name='rollback_probe'").first(), null);
  await new Store(db).push((await import("../src/snapshot02.js")).readSnapshot02(example(), Date.now()));
  const reopened = new SQLiteD1(database);
  try { assert.equal((await new Store(reopened).list()).length, 1); reopened.check(); } finally { reopened.close(); }
});

test("a live WAL backup restores to a separate file and rejects a modified receipt", async (t) => {
  const { db, folder, database } = await fixture(t);
  const snapshot = example();
  await new Store(db).push((await import("../src/snapshot02.js")).readSnapshot02(snapshot, Date.now()));
  const directory = join(folder, "backups");
  const receipt = await backupDatabase(database, directory, "predeploy");
  const source = join(directory, receipt.file), destination = join(folder, "restored.sqlite");
  assert.equal((await restoreDatabase(source, destination)).restored, true);
  const restored = new SQLiteD1(destination);
  try { assert.deepEqual(JSON.parse(await new Store(restored).body("corthex")), withoutPictures(snapshot)); } finally { restored.close(); }
  await assert.rejects(restoreDatabase(source, destination));
  writeFileSync(source + ".json", JSON.stringify({ ...receipt, sha256: "0".repeat(64) }));
  await assert.rejects(restoreDatabase(source, join(folder, "corrupt.sqlite")));
  const untouched = join(directory, "operator-notes.txt"); writeFileSync(untouched, "keep");
  assert.equal(retainBackups(directory).removed, 0);
  assert.equal(retainBackups(directory, { now: Date.now() + 31 * 86400000 }).removed, 1);
  assert.deepEqual(readdirSync(directory), ["operator-notes.txt"]);
});

test("the public origin cannot come from an HTTP/credential/path/forwarded address", () => {
  for (const origin of ["http://nexus.example.com", "https://user:secret@example.com", "https://nexus.example.com/private", "bad"]) assert.throws(() => publicOrigin(origin));
  assert.equal(publicOrigin("https://nexus.example.com/"), "https://nexus.example.com");
});

test("restoring a legacy backup preserves its schema until an explicit migration", async (t) => {
  const { db, folder, database } = await fixture(t);
  db.connection.exec(MIGRATIONS[0].statements[0]);
  const body = JSON.stringify({ schema: "corthex-hub/0.1", title: "Synthetic legacy" });
  db.connection.prepare("INSERT INTO snapshots VALUES (?, ?, ?, ?, ?, ?, ?)").run("synthetic", 7, 1, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", Buffer.byteLength(body), body);
  const receipt = await backupDatabase(database, join(folder, "legacy-backups"), "premigrate");
  await new Store(db).ensure();
  const destination = join(folder, "legacy-restored.sqlite");
  await restoreDatabase(join(folder, "legacy-backups", receipt.file), destination);
  const restored = new SQLiteD1(destination);
  try {
    assert.equal(restored.connection.prepare("SELECT body FROM snapshots").get().body, body);
    assert.equal(restored.connection.prepare("SELECT name FROM sqlite_master WHERE name='migrations'").get(), undefined);
    await new Store(restored).ensure();
    assert.equal((await new Store(restored).list())[0].revision, 7);
    restored.check();
  } finally { restored.close(); }
});

test("compressed code keeps checked Access, exact decoded bytes, HEAD and coding refusals", async (t) => {
  const db = new SQLiteD1(":memory:");
  const text = "// Synthetic browser payload.\n".repeat(1000) + "export const value=1;";
  const font = Buffer.from("synthetic font bytes");
  const views = { code: {
    "fixture.12345678.js": { type: "text/javascript; charset=utf-8", body: text },
    "fixture.12345678.woff2": { type: "font/woff2", body: font },
  } };
  const server = createNodeServer({ env: { ...env, DB: db }, origin: "https://nexus.example.com", template, views, verifier: verifier() });
  await server.start();
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); db.close(); });
  const jwt = await token();
  const wire = (path, coding, method = "GET", authorized = true) => new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port: server.address().port, path, method,
      headers: { ...(authorized ? { "Cf-Access-Jwt-Assertion": jwt } : {}), ...(coding === undefined ? {} : { "Accept-Encoding": coding }) } }, (res) => {
      const chunks = []; res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    });
    req.on("error", reject); req.end();
  });
  const path = "/code/fixture.12345678.js";
  for (const [header, encoding] of [["br, gzip", "br"], ["br;q=0, gzip;q=1", "gzip"], ["gzip;q=0.5, br;q=1", "br"], ["br;q=0.2, identity;q=1", undefined], ["br;q=0,gzip;q=0", undefined], ["*;q=0", undefined], [undefined, undefined]]) {
    const get = await wire(path, header);
    assert.equal(get.status, 200); assert.equal(get.headers["content-encoding"], encoding);
    const decoded = encoding === "br" ? brotliDecompressSync(get.bytes) : encoding === "gzip" ? gunzipSync(get.bytes) : get.bytes;
    assert.deepEqual(decoded, Buffer.from(text));
    assert.equal(get.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.equal(get.headers["set-cookie"],undefined);assert.notEqual(get.headers.vary,"*");
    assert.equal(get.headers["x-frame-options"], "DENY");
    assert.match(get.headers.vary, /Accept-Encoding/i);
    assert.equal(Number(get.headers["content-length"]), get.bytes.length);
    if (encoding) {
      assert.ok(get.bytes.length < Buffer.byteLength(text));
      assert.equal(Number(get.headers["content-length"]), get.bytes.length);
      const head = await wire(path, header, "HEAD");
      assert.equal(head.headers["content-encoding"], encoding);
      assert.equal(head.headers["content-length"], get.headers["content-length"]); assert.equal(head.bytes.length, 0);
    }
  }
  const denied = await wire(path, "br", "GET", false);
  assert.equal(denied.status, 403); assert.equal(denied.headers["content-encoding"], undefined);
  assert.equal(denied.headers["cache-control"], "no-store");
  const missing = await wire("/code/missing.12345678.js", "br");
  assert.equal(missing.status, 404); assert.equal(missing.headers["content-encoding"], undefined);
  const fontReply = await wire("/code/fixture.12345678.woff2", "br");
  assert.equal(fontReply.headers["content-encoding"], undefined); assert.deepEqual(fontReply.bytes, font);
});

test("actual TCP HTML is compressed before transport while Access, no-store, CSP and HEAD remain checked", async (t) => {
  const { server, call } = await fixture(t);
  assert.equal((await call("POST", "/api/snapshots", example())).status, 200);
  const jwt=await token();
  const wire=(encoding,method="GET",authorized=true)=>new Promise((resolve,reject)=>{
    const req=httpRequest({host:"127.0.0.1",port:server.address().port,path:"/hub",method,headers:{...(authorized?{"Cf-Access-Jwt-Assertion":jwt}:{}),"Accept-Encoding":encoding}},res=>{
      const chunks=[];res.on("data",chunk=>chunks.push(chunk));res.on("end",()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));
    });req.on("error",reject);req.end();
  });
  let policy;
  for(const [header,coding]of[["br,gzip","br"],["br;q=0,gzip;q=1","gzip"],["br;q=0,gzip;q=0",undefined]]){
    const get=await wire(header),head=await wire(header,"HEAD");
    assert.equal(get.status,200);assert.equal(head.status,200);
    for(const response of[get,head]){assert.equal(response.headers["cache-control"],"no-store");assert.equal(response.headers["content-encoding"],coding);assert.match(response.headers.vary,/Accept-Encoding/i);assert.equal(response.headers["set-cookie"],undefined);assert.ok(Number(response.headers["content-length"])>0);policy??=response.headers["content-security-policy"];assert.equal(response.headers["content-security-policy"],policy);}
    assert.equal(head.bytes.length,0);assert.equal(Number(get.headers["content-length"]),get.bytes.length);
    const decoded=(coding==="br"?brotliDecompressSync(get.bytes):coding==="gzip"?gunzipSync(get.bytes):get.bytes).toString();
    assert.match(decoded,/<!doctype html>/i);assert.ok(decoded.includes('"schema":"corthex-hub-page/0.2"'));assert.ok(decoded.includes('"name":"corthex"'));assert.ok(!decoded.includes("__CORTHEX_HUB_DATA__"));
    if(coding)assert.ok(get.bytes.length<Buffer.byteLength(decoded)/2);
  }
  const refused=await wire("br","GET",false);assert.equal(refused.status,403);assert.equal(refused.headers["cache-control"],"no-store");assert.equal(refused.headers["content-encoding"],undefined);
});

test("numeric metrics separate delayed body arrival from work after the body", async (t) => {
  const db = new SQLiteD1(":memory:"), metrics = [];
  const server = createNodeServer({ env: { ...env, DB: db }, origin: "https://nexus.example.com", template, verifier: verifier(), onMetric: (value) => metrics.push(value) });
  await server.start();
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); db.close(); });
  const jwt = await token();
  const status = await new Promise((resolve, reject) => {
    const req = httpRequest({ host: "127.0.0.1", port: server.address().port, path: "/api/snapshots", method: "POST",
      headers: { "Cf-Access-Jwt-Assertion": jwt, "Nexus-Session": "synthetic-delay", "Content-Type": "application/json", "Content-Length": 2 } }, (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
    req.on("error", reject); req.flushHeaders(); setTimeout(() => req.end("{}"), 80);
  });
  assert.equal(status, 400);
  assert.equal(metrics.length, 1); const metric = metrics[0];
  assert.ok(Object.values(metric).every((value) => Number.isFinite(value) && value >= 0));
  assert.equal(metric.request_bytes, 2); assert.equal(metric.body_complete, 1);
  assert.ok(metric.body_receive_ms >= 50); assert.ok(metric.after_body_ms < metric.processing_ms);
});

function logicalDatabase(db) {
  const schema=db.connection.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  const rows=Object.fromEntries(schema.filter(row=>row.type==="table").map(row=>[row.name,db.connection.prepare('SELECT * FROM "'+row.name.replaceAll('"','""')+'"').all()]));
  return createHash("sha256").update(JSON.stringify({schema,rows})).digest("hex");
}
async function bodyWire(server,body,{length=body.length,chunked=false,connection="close",end=true,jwt,headers={}}={}) {
  jwt??=await token();
  const started=performance.now();
  return new Promise((resolve,reject)=>{
    const req=httpRequest({host:"127.0.0.1",port:server.address().port,path:"/api/snapshots",method:"POST",agent:false,headers:{"Cf-Access-Jwt-Assertion":jwt,"Content-Type":"application/json",Connection:connection,...(chunked?{"Transfer-Encoding":"chunked"}:{"Content-Length":String(length)}),...headers}},res=>{
      const chunks=[];res.on("data",chunk=>chunks.push(chunk));res.on("error",reject);
      res.on("end",()=>{const bytes=Buffer.concat(chunks);resolve({status:res.statusCode,headers:res.headers,data:JSON.parse(bytes),bytes:bytes.length,elapsedMs:performance.now()-started});req.destroy();});
    });
    req.setTimeout(2000,()=>req.destroy(new Error("bounded TCP fixture did not receive its response")));
    req.on("error",reject);
    if(end)req.end(body);else{req.flushHeaders();if(body.length)req.write(body);}
  });
}
test("BUG564: oversized fixed-length Connection:close returns the complete413 before socket teardown",async t=>{
  const {server,db}=await fixture(t);await new Store(db).ensure();const before=logicalDatabase(db),body=Buffer.alloc(1048577,32),jwt=await token();
  const errors=[],original=console.error;console.error=(...args)=>errors.push(args);t.after(()=>{console.error=original;});
  for(const options of[{connection:"close"},{connection:"keep-alive"},{chunked:true}]){
    const ray=(errors.length+1).toString(16).padStart(16,"0")+"-ICN",response=await bodyWire(server,body,{...options,jwt,headers:{"Cf-Ray":ray}});
    assert.equal(response.status,413);assert.equal(response.data.code,"snapshot_too_large");assert.equal(response.data.limit,1048576);assert.equal(response.data.traceId,ray);
    assert.equal(response.headers["cache-control"],"no-store");assert.equal(response.headers["x-frame-options"],"DENY");assert.equal(response.headers["content-security-policy"],"default-src 'none'; frame-ancestors 'none'");
    assert.equal(errors.at(-1)[1].traceId,ray);assert.equal(errors.at(-1)[1].kind,"snapshot_too_large");assert.equal(logicalDatabase(db),before,"same refused request changes no catalog, row or receipt");
  }
});
test("early refusals complete for unfinished, falsely huge and chunked uploads while a normal1MiB snapshot still works",async t=>{
  const {server,db}=await fixture(t);await new Store(db).ensure();const before=logicalDatabase(db),jwt=await token();
  for(const options of[{length:1048577},{length:1000000000000},{chunked:true}]){
    const body=options.chunked?Buffer.alloc(1048577,32):Buffer.from("{}");
    const response=await bodyWire(server,body,{...options,end:false,jwt});
    assert.equal(response.status,413);assert.equal(response.data.code,"snapshot_too_large");assert.equal(Number(response.headers["content-length"]),response.bytes);assert.equal(logicalDatabase(db),before);
    assert.ok(response.elapsedMs<1500,"the complete refusal does not wait for the unfinished upload or its30-second receive deadline");
    t.diagnostic(JSON.stringify({scope:"synthetic unfinished upload; not a response-time SLO",declaredBytes:options.chunked?null:options.length,actualBytes:body.length,chunked:Boolean(options.chunked),clientRequestEnded:false,status:response.status,responseCompleteMs:response.elapsedMs}));
  }
  const oversized=Buffer.alloc(1048577,32);
  for(const [options,code]of[[{jwt:"malformed"},"access_missing"],[{jwt,headers:{"Sec-Fetch-Site":"cross-site"}},"cross_site"]]){
    const response=await bodyWire(server,oversized,options);assert.equal(response.status,403);assert.equal(response.data.code,code);assert.equal(logicalDatabase(db),before);
  }
  const json=JSON.stringify(example()),normal=Buffer.from(json+" ".repeat(1048576-Buffer.byteLength(json)));
  const accepted=await bodyWire(server,normal,{jwt});assert.equal(accepted.status,200);assert.equal(accepted.data.name,"corthex");assert.equal(accepted.data.revision,1);db.check();
});
test("an unread oversized upload discards finitely and releases every socket by the existing receive deadline",async t=>{
  const {server,db,metrics}=await fixture(t);await new Store(db).ensure();const before=logicalDatabase(db),jwt=await token(),sockets=new Set();
  // Shorten the existing server property only in this disposable fixture.
  // Production keeps its30-second receive deadline; there is no new setting.
  server.requestTimeout=160;server.on("connection",socket=>{sockets.add(socket);socket.once("close",()=>sockets.delete(socket));});
  const socket=createConnection({host:"127.0.0.1",port:server.address().port});t.after(()=>socket.destroy());
  socket.on("error",()=>{});await new Promise(resolve=>socket.once("connect",resolve));socket.pause();
  socket.write("POST /api/snapshots HTTP/1.1\r\nHost: nexus.example.com\r\nCf-Access-Jwt-Assertion: "+jwt+"\r\nContent-Type: application/json\r\nContent-Length: 1000000000000\r\nConnection: close\r\n\r\n");
  for(let i=0;i<64;i++)socket.write(Buffer.alloc(65536,32));
  const deadline=Date.now()+1500;while(sockets.size&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(sockets.size,0,"the refusing server cannot retain a stalled or unread upload");assert.equal(await new Promise((resolve,reject)=>server.getConnections((error,n)=>error?reject(error):resolve(n))),0);
  assert.equal(logicalDatabase(db),before);assert.equal(metrics.length,1);assert.equal(metrics[0].status,413);assert.ok(metrics[0].request_bytes<=2*1048576+2*65536,"discard stops after a finite budget plus an in-flight chunk");assert.ok(metrics[0].processing_ms<1400);socket.destroy();
  // A client that aborts before finishing its advertised body also releases
  // the server and preserves the database; no response is required to a gone peer.
  const aborted=createConnection({host:"127.0.0.1",port:server.address().port});t.after(()=>aborted.destroy());aborted.on("error",()=>{});await new Promise(resolve=>aborted.once("connect",resolve));aborted.write("POST /api/snapshots HTTP/1.1\r\nHost: nexus.example.com\r\nContent-Length: 1048577\r\n\r\n{");aborted.destroy();
  const stop=Date.now()+1500;while(sockets.size&&Date.now()<stop)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(sockets.size,0);assert.equal(logicalDatabase(db),before);
  t.diagnostic(JSON.stringify({scope:"synthetic unread/aborted upload and socket cleanup",testReceiveDeadlineMs:server.requestTimeout,productionReceiveDeadlineMs:30000,receivedBytes:metrics[0].request_bytes,processingMs:metrics[0].processing_ms,serverSocketsRemaining:sockets.size,dbUnchanged:logicalDatabase(db)===before}));
});
