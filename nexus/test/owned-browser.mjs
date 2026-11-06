import {spawn} from "node:child_process";
import {promises as fs} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const windows = process.platform === "win32";
const jobOwner = fileURLToPath(new URL("./windows-browser-job.py", import.meta.url));

export async function createBrowserRun(artifactBase, prefix = "run-") {
  const folder = await fs.mkdtemp(path.join(await fs.realpath(artifactBase), prefix));
  const profile = await fs.mkdtemp(path.join(folder, "profile-"));
  let child, spawnError, stopped = false;

  function launch(chrome, args, env) {
    const browserArgs = ["--user-data-dir=" + profile, ...args];
    child = windows
      ? spawn(env.NEXUS_QA_PYTHON || "python", [jobOwner, chrome, ...browserArgs], {
        stdio: ["pipe", "ignore", "inherit"], windowsHide: true, env
      })
      : spawn(chrome, browserArgs, {stdio: "ignore", env});
    child.on("error", error => { spawnError = error; });
    child.stdin?.on("error", () => {}); // The job owner may have exited before EOF.
  }

  const running = () => child?.pid !== undefined && child.exitCode === null && child.signalCode === null;
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

  return {folder, profile, launch, stop, removeProfile};
}
