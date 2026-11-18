import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { RebuildGitHub } from "../src/rebuild-github.js";
import { RebuildGitHubSSH } from "../src/rebuild-github-ssh.js";

test("a project-scoped deploy key verifies live Git history and exact source bytes", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "nexus-private-source-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const upstream = join(directory, "upstream");
  const git = (...args) => execFileSync("git", ["-C", upstream, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  execFileSync("git", ["init", "--quiet", "--initial-branch=main", upstream]);
  git("config", "user.name", "Fixture");
  git("config", "user.email", "fixture@localhost");
  git("config", "commit.gpgsign", "false");
  git("config", "uploadpack.allowFilter", "true");
  const commit = (text) => {
    writeFileSync(join(upstream, "source.md"), text);
    git("add", "source.md");
    git("commit", "--quiet", "-m", text.trim());
    return git("rev-parse", "HEAD");
  };
  const first = commit("first\n");
  const main = commit("merged\n");
  git("switch", "--quiet", "-c", "feature", first);
  const feature = commit("unmerged\n");
  git("switch", "--quiet", "main");

  const repository = "https://github.com/example/private";
  const project = { id: "project_private", repository_url: repository, default_branch: "main" };
  const remoteUrl = new URL("ssh://ssh.github.com:443/example/private.git");
  remoteUrl.username = "git";
  const remote = remoteUrl.href;
  const gitProcess = promisify(execFile);
  let reachable = true;
  let fetches = 0;
  const privateSource = new RebuildGitHubSSH({ projectId: project.id, repository, cache: join(directory, "cache.git"),
    keyFile: join(directory, "private key"), knownHostsFile: join(directory, "host keys"),
    run: async (file, args, options) => {
      if (args.includes("ls-remote") || args.includes("fetch") || args.includes("remote.github.url")) {
        assert.ok(args.includes(args.includes("fetch") ? "github" : remote));
        assert.equal(options.env.GIT_ALLOW_PROTOCOL, "ssh");
        assert.match(options.env.GIT_SSH_COMMAND, /'StrictHostKeyChecking=yes'/);
        if (!reachable) throw new Error("provider unavailable");
        if (args.includes("fetch")) fetches++;
        return gitProcess(file, args.map((arg) => arg === remote ? upstream : arg), { ...options, env: { ...options.env, GIT_ALLOW_PROTOCOL: "file" } });
      }
      return gitProcess(file, args, options);
    } });
  let restRequests = 0;
  const verifier = new RebuildGitHub({ privateSource, fetchImpl: async () => { restRequests++; return new Response(null, { status: 404 }); } });
  const input = (commit, text) => ({ commit, artifacts: [{ source_files: [{ path: "source.md", content_utf8: text }] }] });
  const refusal = (code) => (error) => error.code === code;

  await Promise.all([verifier.verify(project, input(main, "merged\n"), first), verifier.verify(project, input(first, "first\n"))]);
  assert.equal(fetches, 1);
  assert.equal(restRequests, 0);
  await assert.rejects(verifier.verify(project, input(feature, "unmerged\n"), first), refusal("unmerged_commit"));
  await assert.rejects(verifier.verify(project, input(first, "first\n"), main), refusal("older_publication"));
  await assert.rejects(verifier.verify(project, input(main, "changed\n"), first), refusal("unmerged_commit"));
  await assert.rejects(verifier.verify({ ...project, default_branch: "feature" }, input(main, "merged\n")), refusal("source_verification_unavailable"));
  await assert.rejects(verifier.verify({ ...project, id: "project_other" }, input(main, "merged\n")), refusal("source_verification_unavailable"));
  assert.ok(restRequests > 0);
  const next = commit("new main\n");
  await verifier.verify(project, input(next, "new main\n"), main);
  reachable = false;
  await assert.rejects(verifier.verify(project, input(next, "new main\n"), main), refusal("source_verification_unavailable"));
});
