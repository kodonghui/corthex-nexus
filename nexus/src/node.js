import { readFileSync, realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SQLiteD1 } from "./sqlite.js";
import { Store } from "./store.js";
import { createNodeServer } from "./node-server.js";
import { createViews } from "./views.js";

export async function start(settings = process.env) {
  const port = Number(settings.NEXUS_PORT || "8787");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("NEXUS_PORT must be a TCP port");
  if (!settings.NEXUS_DATABASE || !isAbsolute(settings.NEXUS_DATABASE)) throw new Error("NEXUS_DATABASE must be an absolute database path");
  if (!settings.ACCESS_TEAM_DOMAIN || !settings.ACCESS_AUD) throw new Error("Access settings are required");
  process.umask(0o077);
  const db = new SQLiteD1(settings.NEXUS_DATABASE);
  try {
    await new Store(db).ensure();
    db.check();
    const env = { DB: db, ACCESS_TEAM_DOMAIN: settings.ACCESS_TEAM_DOMAIN, ACCESS_AUD: settings.ACCESS_AUD, NEXUS_LANGUAGE: settings.NEXUS_LANGUAGE || "en", NEXUS_EARLY_HINTS: settings.NEXUS_EARLY_HINTS === "1" ? "1" : "0" };
    const template = readFileSync(new URL("./hub.html", import.meta.url), "utf8");
    const folder = new URL("./view-code/", import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL("sizes.json", folder), "utf8"));
    const code = Object.fromEntries(manifest.files.map((file) => [file.name, { type: file.type, body: readFileSync(new URL(file.path, folder)) }]));
    const views = createViews(code, manifest.entries);
    const onMetric = settings.NEXUS_METRICS === "1" ? (metric) => console.log(JSON.stringify({ kind: "request_metrics", ...metric })) : undefined;
    const server = createNodeServer({ env, origin: settings.NEXUS_ORIGIN, template, views, onMetric });
    await server.start(port);
    const stop = () => { server.close(() => { db.close(); process.exitCode = 0; }); server.closeIdleConnections(); };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    console.log("nexus", { kind: "started" });
    return server;
  } catch (error) { db.close(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) start().catch(() => { console.error("nexus", { kind: "startup_failed" }); process.exitCode = 1; });
