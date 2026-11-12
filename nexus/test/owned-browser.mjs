import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const windows = process.platform === "win32";
const jobOwner = fileURLToPath(new URL("./windows-browser-job.py", import.meta.url));

export async function createBrowserRun(artifactBase, prefix = "run-") {
  const folder = await fs.mkdtemp(path.join(await fs.realpath(artifactBase), prefix));
  const profile = await fs.mkdtemp(path.join(folder, "profile-"));
  let child, spawnError, stopped = false, output = "";

  function launch(chrome, args, env) {
    const browserArgs = ["--user-data-dir=" + profile, ...args];
    child = windows
      ? spawn(env.NEXUS_QA_PYTHON || "python", [jobOwner, chrome, ...browserArgs], {
        stdio: ["pipe", "ignore", "inherit"], windowsHide: true, env
      })
      : spawn(chrome, browserArgs, {stdio: ["ignore", "ignore", "pipe"], env});
    child.on("error", error => { spawnError = error; });
    child.stdin?.on("error", () => {}); // The job owner may have exited before EOF.
    // The browser's own last words, kept for a start that fails.
    child.stderr?.on("data", chunk => { output = (output + chunk.toString("utf8")).slice(-4000); });
  }

  const running = () => child?.pid !== undefined && child.exitCode === null && child.signalCode === null;
  // The browser writes the port of its DevTools endpoint into the profile once it listens. A start
  // that does not says whether the browser still runs or how it ended, with its last output.
  async function endpoint(ms = 30000) {
    for (const end = Date.now() + ms; ;) {
      try {
        return (await fs.readFile(path.join(profile, "DevToolsActivePort"), "utf8")).trim().split("\n");
      } catch {
        if (spawnError || (child && !running()) || Date.now() >= end) break;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    const state = spawnError ? "it could not start: " + spawnError.message
      : running() ? `it still runs after ${ms / 1000} seconds` : `it ended with ${child?.exitCode ?? child?.signalCode}`;
    const words = output.trim().split("\n").slice(-6).join(" | ");
    throw new Error("Owned Chrome did not publish its CDP endpoint: " + state + (words ? "; its last output: " + words : ""));
  }
  async function waitForExit(ms) {
    if (!running()) return;
    await new Promise(resolve => {
      const done = () => { clearTimeout(timer); child.off("exit", done); resolve(); };
      const timer = setTimeout(done, ms);
      child.once("exit", done);
      if (!running()) done();
    });
  }

  async function stop() {
    if (!child) return;
    if (windows) child.stdin.end();
    await waitForExit(windows ? 10000 : 2500);
    if (running()) {
      child.kill();
      await waitForExit(5000);
    }
    if (spawnError) throw spawnError;
    if (running() || (windows && child.exitCode !== 0)) {
      throw new Error("Owned browser shutdown was not confirmed. Profile preserved.");
    }
    stopped = true;
  }

  async function removeProfile() {
    if (child && !stopped) throw new Error("Owned browser shutdown was not confirmed. Profile preserved.");
    const realFolder = await fs.realpath(folder);
    const realProfile = await fs.realpath(profile);
    if (!(await fs.lstat(profile)).isDirectory() || realFolder !== folder ||
        realProfile !== profile || path.dirname(realProfile) !== realFolder) {
      throw new Error("Refusing cleanup outside the generated run folder");
    }
    await fs.rm(realProfile, {recursive: true, force: true, maxRetries: 5, retryDelay: 200});
  }

  return {folder, profile, launch, endpoint, stop, removeProfile};
}
