import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

test("server and database CLIs execute through the immutable-release symlink", (t) => {
  const folder = mkdtempSync(join(tmpdir(), "nexus-entry-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const link = join(folder, "current");
  symlinkSync(fileURLToPath(new URL("../../", import.meta.url)), link, process.platform === "win32" ? "junction" : "dir");
  for (const [path, kind] of [["src/node.js", "startup_failed"], ["tools/database.js", "database_operation_failed"]]) {
    const result = spawnSync(process.execPath, [join(link, "nexus", path)], { encoding: "utf8", timeout: 10000, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot } });
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(kind), result.stderr);
  }
});
