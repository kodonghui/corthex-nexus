import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SQLiteD1 } from "./sqlite.js";
import { Store } from "./store.js";
import { createNodeServer } from "./node-server.js";

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
    const env = { DB: db, ACCESS_TEAM_DOMAIN: settings.ACCESS_TEAM_DOMAIN, ACCESS_AUD: settings.ACCESS_AUD, NEXUS_LANGUAGE: settings.NEXUS_LANGUAGE || "en" };
    const template = readFileSync(new URL("./hub.html", import.meta.url), "utf8");
    const server = createNodeServer({ env, origin: settings.NEXUS_ORIGIN, template });
    await server.start(port);
    const stop = () => { server.close(() => { db.close(); process.exitCode = 0; }); server.closeIdleConnections(); };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    console.log("nexus", { kind: "started" });
    return server;
  } catch (error) { db.close(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) start().catch(() => { console.error("nexus", { kind: "startup_failed" }); process.exitCode = 1; });
