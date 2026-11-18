import { execFile } from "node:child_process";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";
import { commitPattern, idPattern } from "./rebuild-contract.js";
import { repositoryNames, verifySourceFiles } from "./rebuild-github.js";
import { RebuildProblem } from "./rebuild-http.js";

const runFile = promisify(execFile);
const quote = (text) => "'" + text.replaceAll("'", "'\\''") + "'";
const treeEntry = /^(100644|100755) blob ([a-f0-9]{40}|[a-f0-9]{64})\t([\s\S]+)$/u;
const remoteHead = /^ref: (refs\/heads\/[^\t\r\n]+)\tHEAD\n([a-f0-9]{40}|[a-f0-9]{64})\tHEAD\n?$/u;

// A GitHub deploy key authorizes one repository. Bind it to one NEXUS project as well.
export class RebuildGitHubSSH {
  #projectId;
  #repository;
  #remote;
  #cache;
  #environment;
  #run;
  #timeout;
  #initialized = false;
  #fetching;

  constructor({ projectId, repository, keyFile, knownHostsFile, cache, run = runFile, timeout = 10000 }) {
    const names = typeof repository === "string" && repositoryNames(repository);
    if (!names || !idPattern.test(projectId ?? "") || ![keyFile, knownHostsFile, cache].every((path) => typeof path === "string" && isAbsolute(path))) {
      throw new Error("Incomplete NEXUS private GitHub source settings");
    }
    this.#projectId = projectId;
    this.#repository = repository.toLowerCase();
    const remote = new URL(`ssh://ssh.github.com:443/${names.join("/")}.git`);
    remote.username = "git";
    this.#remote = remote.href;
    this.#cache = cache;
    this.#run = run;
    this.#timeout = timeout;
    const ssh = ["ssh", "-F", "/dev/null", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes", "-o", "IdentitiesOnly=yes",
      "-o", "GlobalKnownHostsFile=/dev/null", "-o", `UserKnownHostsFile=${knownHostsFile}`, "-i", keyFile, "-o", "ConnectTimeout=7"];
    this.#environment = { PATH: process.env.PATH, LANG: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_ALLOW_PROTOCOL: "ssh", GIT_NO_LAZY_FETCH: "1", GIT_SSH_COMMAND: ssh.map(quote).join(" "), GIT_TERMINAL_PROMPT: "0" };
  }

  matches(project) {
    return project.id === this.#projectId && project.repository_url?.toLowerCase() === this.#repository;
  }

  async #git(args, signal) {
    const { stdout } = await this.#run("git", args, { env: this.#environment, encoding: "utf8", maxBuffer: 12 * 1024 * 1024, signal });
    return stdout;
  }

  async #readLiveDefault(signal) {
    const gitDir = `--git-dir=${this.#cache}`;
    if (!this.#initialized) {
      await this.#git(["init", "--bare", "--quiet", this.#cache], signal);
      await this.#git([gitDir, "config", "remote.github.url", this.#remote], signal);
      this.#initialized = true;
    }
    const head = await this.#git(["ls-remote", "--symref", this.#remote, "HEAD"], signal);
    const info = remoteHead.exec(head);
    if (!info) throw new Error("GitHub did not return a symbolic default branch");
    const [, ref, tip] = info;
    const fetched = "refs/nexus/github-default";
    await this.#git([gitDir, "fetch", "--no-tags", "--no-recurse-submodules", "--no-auto-gc", "--no-write-fetch-head",
      "--filter=blob:none", "github", `+${ref}:${fetched}`], signal);
    if ((await this.#git([gitDir, "rev-parse", "--verify", `${fetched}^{commit}`], signal)).trim() !== tip) {
      throw new Error("GitHub default branch changed during verification");
    }
    return { ref, tip };
  }

  #liveDefault(signal) {
    this.#fetching ??= this.#readLiveDefault(signal).catch((error) => {
      if (signal.aborted) throw new RebuildProblem("upstream_timeout");
      throw error;
    }).finally(() => { this.#fetching = undefined; });
    return this.#fetching;
  }

  async #assertAncestor(ancestor, descendant, code, signal) {
    if (ancestor === descendant) return;
    const gitDir = `--git-dir=${this.#cache}`;
    let kind;
    try { kind = (await this.#git([gitDir, "cat-file", "-t", ancestor], signal)).trim(); }
    catch (error) {
      if (error.code !== 128 || signal.aborted) throw error;
    }
    if (kind !== "commit") throw new RebuildProblem(code);
    try { await this.#git([gitDir, "merge-base", "--is-ancestor", ancestor, descendant], signal); }
    catch (error) {
      if (error.code === 1) throw new RebuildProblem(code);
      throw error;
    }
  }

  async verify(project, input, held) {
    if (!this.matches(project) || !project.default_branch || !commitPattern.test(input.commit) || (held && !commitPattern.test(held))) {
      throw new RebuildProblem("source_verification_unavailable");
    }
    const signal = AbortSignal.timeout(this.#timeout);
    try {
      const { ref, tip } = await this.#liveDefault(signal);
      if (ref !== `refs/heads/${project.default_branch}`) throw new Error("GitHub default branch does not match");
      await this.#assertAncestor(input.commit, tip, "unmerged_commit", signal);
      if (held) await this.#assertAncestor(held, input.commit, "older_publication", signal);
      const tree = await this.#git([`--git-dir=${this.#cache}`, "ls-tree", "-z", "-r", "--full-tree", input.commit], signal);
      const blobs = new Map();
      for (const entry of tree.split("\0")) {
        const blob = treeEntry.exec(entry);
        if (blob) blobs.set(blob[3], blob[2]);
      }
      verifySourceFiles(blobs, input);
    } catch (error) {
      if (signal.aborted) throw new RebuildProblem("upstream_timeout");
      if (error instanceof RebuildProblem) throw error;
      throw new RebuildProblem("source_verification_unavailable");
    }
  }
}
