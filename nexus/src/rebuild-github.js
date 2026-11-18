import { createHash } from "node:crypto";
import { commitPattern } from "./rebuild-contract.js";
import { RebuildProblem } from "./rebuild-http.js";

const github = "https://api.github.com";
const repositoryPattern = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/;
export const repositoryNames = (url) => {
  const match = repositoryPattern.exec(url);
  return match && match.slice(1).every((name) => ![".", ".."].includes(name)) ? match.slice(1) : null;
};

async function readJSON(response, limit) {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("GitHub refused the request");
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body || []) {
    size += chunk.byteLength;
    if (size > limit) throw new Error("GitHub response exceeds its limit");
    chunks.push(chunk);
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}

function blobId(source, length) {
  const bytes = Buffer.from(source, "utf8");
  return createHash(length === 40 ? "sha1" : "sha256").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

export function verifySourceFiles(blobs, input) {
  for (const { source_files } of input.artifacts) {
    for (const { path, content_utf8: source } of source_files) {
      if (blobs.get(path) !== blobId(source, input.commit.length)) throw new RebuildProblem("unmerged_commit");
    }
  }
}

// API-225. The repository and branch are stored project settings. Every
// request is built under one fixed host and the credential is read-only.
export class RebuildGitHub {
  #headers;
  #fetch;
  #timeout;
  #privateSource;

  constructor({ token, fetchImpl = fetch, timeout = 10000, privateSource } = {}) {
    this.#headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "CORTHEX-NEXUS", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    this.#fetch = fetchImpl;
    this.#timeout = timeout;
    this.#privateSource = privateSource;
  }

  async verify(project, input, held) {
    if (this.#privateSource?.matches(project)) return this.#privateSource.verify(project, input, held);
    const names = repositoryNames(project.repository_url);
    if (!names || !project.default_branch) throw new RebuildProblem("source_verification_unavailable");
    const root = `/repos/${names.map(encodeURIComponent).join("/")}`;
    const signal = AbortSignal.timeout(this.#timeout);
    const get = async (path, limit = 1024 * 1024) => readJSON(await this.#fetch(github + root + path, {
      headers: this.#headers, redirect: "error", signal,
    }), limit);
    const assertAncestor = async (ancestor, descendant, code) => {
      if (ancestor === descendant) return;
      const value = await get(`/compare/${ancestor}...${descendant}?per_page=1`, 4 * 1024 * 1024);
      if (value?.status !== "ahead" || value.merge_base_commit?.sha !== ancestor) throw new RebuildProblem(code);
    };
    try {
      const refPath = project.default_branch.split("/").map(encodeURIComponent).join("/");
      const [repository, ref] = await Promise.all([get(""), get(`/git/ref/heads/${refPath}`)]);
      if (repository?.default_branch !== project.default_branch || repository.full_name?.toLowerCase() !== names.join("/").toLowerCase() ||
          ref?.ref !== `refs/heads/${project.default_branch}` || ref.object?.type !== "commit" || !commitPattern.test(ref.object.sha)) {
        throw new Error("Unexpected repository or ref");
      }
      await assertAncestor(input.commit, ref.object.sha, "unmerged_commit");
      if (held) await assertAncestor(held, input.commit, "older_publication");
      const { sha, tree } = await get(`/git/commits/${input.commit}`);
      if (sha !== input.commit || !commitPattern.test(tree?.sha)) throw new Error("Unexpected commit");
      const listing = await get(`/git/trees/${tree.sha}?recursive=1`, 12 * 1024 * 1024);
      if (listing.sha !== tree.sha || listing.truncated !== false || !Array.isArray(listing.tree)) throw new Error("Incomplete Git tree");
      const blobs = new Map(listing.tree.filter((item) => item?.type === "blob" && ["100644", "100755"].includes(item.mode))
        .map((item) => [item.path, item.sha]));
      verifySourceFiles(blobs, input);
    } catch (error) {
      if (signal.aborted || error?.name === "TimeoutError") throw new RebuildProblem("upstream_timeout");
      if (error instanceof RebuildProblem) throw error;
      throw new RebuildProblem("source_verification_unavailable");
    }
  }
}
