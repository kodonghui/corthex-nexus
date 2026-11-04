// TASK-259/260/262: real TCP, RSA signatures, on-disk SQLite and restore.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  assert.deepEqual(Object.keys(metrics[0]).sort(), ["processing_ms", "request_bytes", "rss_bytes", "status"]);
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
  const checkpoint = await call("POST", "/api/spaces/corthex/checkpoints", { part: "nexus", stage: "05-erd", words: "확인했습니다" });
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
