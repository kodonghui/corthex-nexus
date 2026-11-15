// BUG-630: a release holds only the paths that nexus/ops/deploy-dev.ps1 hands to `git archive`, and the switch of the
// maintainer's server takes the same paths. The server's code imports two of the page's files, nexus/ui/messages.js
// and nexus/ui/fields.js; the list named the first only, so the release of 0.3.0 could not start until the second was
// added. The archive of the listed paths, made by `git archive` from the commit and extracted with `tar` as the server
// extracts it, imports the runtime and both database tools, and its runtime starts and refuses an unsigned request,
// which is how the switch knows it is ready.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DEPLOY = new URL("../ops/deploy-dev.ps1", import.meta.url);
const ENTRIES = ["nexus/src/node.js", "nexus/tools/database.js", "nexus/tools/backup-copy.js"];
const ENV = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
const CHECKOUT = spawnSync("git", ["-C", ROOT, "rev-parse", "--verify", "HEAD^{commit}"], { encoding: "utf8", timeout: 20000 });
const NEEDS_GIT = CHECKOUT.status === 0 ? false : "needs a Git checkout, since the release is made with git archive";

// The paths after the revision on the script's `git archive` line.
function listed() {
  const line = readFileSync(DEPLOY, "utf8").split("\n").find((text) => /\barchive --format=tar\b/.test(text));
  assert.ok(line, "deploy-dev.ps1 makes the release with git archive");
  const paths = line.slice(line.indexOf("$revision") + "$revision".length).trim().split(/\s+/);
  assert.ok(paths.length > 0 && paths.every((path) => /^nexus\/[\w./@-]+$/.test(path)), line);
  return paths;
}

// The release as the script makes it: `git archive` of the listed paths at the checkout's commit, extracted into a
// folder of its own, so a file that the commit lacks is missing here as it is on the server.
function release(t) {
  const folder = mkdtempSync(join(tmpdir(), "nexus-release-"));
  t.after(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
  const made = spawnSync("git", ["-C", ROOT, "archive", "--format=tar", `--output=${join(folder, "release.tar")}`, "HEAD", ...listed()], {
    encoding: "utf8", timeout: 60000,
  });
  assert.equal(made.status, 0, `git archive: ${made.stderr}`);
  const opened = spawnSync("tar", ["-xf", "release.tar"], { cwd: folder, encoding: "utf8", timeout: 60000 });
  assert.equal(opened.status, 0, `tar: ${opened.stderr}`);
  return folder;
}

const freePort = () => new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => { const { port } = probe.address(); probe.close(() => resolve(port)); });
});

test("the release's list names the page's files that the server imports", () => {
  const paths = listed();
  for (const path of ["nexus/src", "nexus/ui/messages.js", "nexus/ui/fields.js", "nexus/ops", ...ENTRIES.slice(1), "nexus/package.json"]) {
    assert.ok(paths.includes(path), path);
  }
});

test("a release of the listed paths imports the runtime and both database tools", { skip: NEEDS_GIT }, (t) => {
  const folder = release(t);
  for (const entry of ENTRIES) {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", "await import(process.env.NEXUS_RUNTIME_CHECK_MODULE)"], {
      encoding: "utf8", timeout: 20000, env: { ...ENV, NEXUS_RUNTIME_CHECK_MODULE: pathToFileURL(join(folder, entry)).href },
    });
    assert.equal(result.status, 0, `${entry}: ${result.stderr}`);
  }
});

test("the runtime of a release of the listed paths starts and refuses an unsigned request", { skip: NEEDS_GIT, timeout: 60000 }, async (t) => {
  const folder = release(t);
  const port = await freePort();
  const child = spawn(process.execPath, [join(folder, "nexus/src/node.js")], {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...ENV, NEXUS_PORT: String(port), NEXUS_DATABASE: join(folder, "check.sqlite"), NEXUS_ORIGIN: "https://nexus.example.com",
      ACCESS_TEAM_DOMAIN: "check.cloudflareaccess.com", ACCESS_AUD: "check",
    },
  });
  const exited = new Promise((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  let output = "";
  child.stderr.setEncoding("utf8").on("data", (text) => { output += text; });
  try {
    await new Promise((resolve, reject) => {
      child.stdout.setEncoding("utf8").on("data", (text) => { output += text; if (output.includes("kind: 'started'")) resolve(); });
      exited.then(() => reject(new Error(`the runtime stopped before it started:\n${output}`)));
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/snapshots`);
    await response.arrayBuffer();
    assert.equal(response.status, 403);
    assert.ok(!output.includes("startup_failed"), output);
  } finally {
    // The runtime goes before its folder does, which Windows keeps while the database is open.
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  }
});
