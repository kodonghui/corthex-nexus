// CI only: real HTTP/SQLite and RSA verification with generated local keys.
// The production entry point never imports this fixture or accepts its keys.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AccessVerifier } from "../src/access.js";
import { createNodeServer } from "../src/node-server.js";
import { SQLiteD1 } from "../src/sqlite.js";
const folder = mkdtempSync(join(tmpdir(), "nexus-contract-"));
const db = new SQLiteD1(join(folder, "db.sqlite"));
const pair = await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const jwk = { ...await crypto.subtle.exportKey("jwk", pair.publicKey), kid: "ci-generated-key", alg: "RS256" };
const env = { DB: db, ACCESS_TEAM_DOMAIN: "access.example.com", ACCESS_AUD: "synthetic", NEXUS_LANGUAGE: "en" };
const verifier = new AccessVerifier({ requireContext: false, fetcher: async (url) => {
  if (url !== "https://access.example.com/cdn-cgi/access/certs") throw new Error("unexpected fixture fetch");
  return Response.json({ keys: [jwk] });
} });
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const content = b64({ alg: "RS256", kid: jwk.kid }) + "." + b64({ iss: "https://access.example.com", aud: [env.ACCESS_AUD], exp: Math.floor(Date.now() / 1000) + 3600, sub: "", common_name: "ci-generated-client" });
const token = content + "." + Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(content))).toString("base64url");
const server = createNodeServer({ env, origin: "https://nexus.example.com", template: readFileSync(new URL("../src/hub.html", import.meta.url), "utf8"), verifier });
await server.start();
process.stdout.write(JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, assertion: token }) + "\n");
process.stdin.on("end", () => {
  server.close(() => { db.close(); rmSync(folder, { recursive: true, force: true }); });
  server.closeAllConnections();
});
process.stdin.resume();
