import { realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openRebuildDatabase } from "./rebuild-sqlite.js";
import { RebuildStore } from "./store.js";
import { createNodeServer, publicOrigin } from "./node-server.js";
import { createRebuildHandler } from "./rebuild-app.js";
import { RebuildOIDC } from "./rebuild-oidc.js";
import { RebuildGitHub } from "./rebuild-github.js";
import { rebuildView } from "./rebuild-views.js";

export async function startRebuild(settings = process.env) {
  const port = Number(settings.NEXUS_REBUILD_PORT || "8788");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("NEXUS_REBUILD_PORT must be a TCP port");
  if (!settings.NEXUS_REBUILD_DATABASE || !isAbsolute(settings.NEXUS_REBUILD_DATABASE)) throw new Error("NEXUS_REBUILD_DATABASE must be an absolute database path");
  const origin = publicOrigin(settings.NEXUS_ORIGIN);
  const { NEXUS_OIDC_ISSUER: issuer, NEXUS_OIDC_CLIENT_ID: clientId, NEXUS_OIDC_CLIENT_SECRET: clientSecret,
    NEXUS_OIDC_ATTEMPT_KEY: attemptSetting } = settings;
  let oidc, attemptKey;
  if (issuer || clientId || clientSecret || attemptSetting) {
    if (!issuer || !clientId || !/^[A-Za-z0-9_-]{43}$/.test(attemptSetting || "")) throw new Error("Incomplete NEXUS OIDC settings");
    attemptKey = Buffer.from(attemptSetting, "base64url");
    oidc = new RebuildOIDC({ issuer, clientId, clientSecret, origin });
  }
  process.umask(0o077);
  const connection = openRebuildDatabase(settings.NEXUS_REBUILD_DATABASE);
  try {
    const github = new RebuildGitHub({ token: settings.NEXUS_GITHUB_READ_TOKEN });
    const metrics = settings.NEXUS_METRICS === "1";
    const counts = new Map();
    const onMetric = metrics ? (sample) => console.log(JSON.stringify({ kind: "request_metrics", ...sample })) : undefined;
    const onOutcome = metrics ? ({ outcome, traceId }) => {
      const count = (counts.get(outcome) ?? 0) + 1;
      counts.set(outcome, count);
      console.log(JSON.stringify({ kind: "operation_count", outcome, count, traceId }));
    } : undefined;
    const handler = createRebuildHandler({ store: new RebuildStore(connection), origin, oidc, attemptKey, github, releaseCommit: settings.NEXUS_REBUILD_RELEASE_COMMIT,
      onTrace: (record) => console.error("nexus-rebuild", record), onOutcome });
    const server = createNodeServer({ origin, onMetric, handleRequest: (request, context) =>
      rebuildView(request, settings.NEXUS_LANGUAGE) ?? handler(request, context) });
    await server.start(port);
    const stop = () => { server.close(() => connection.close()); server.closeIdleConnections(); };
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
    console.log("nexus-rebuild", { kind: "started", owner_sign_in_configured: Boolean(oidc) });
    return server;
  } catch (error) { connection.close(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) {
  startRebuild().catch(() => { console.error("nexus-rebuild", { kind: "startup_failed" }); process.exitCode = 1; });
}
