// TASK-313: the copy of the backup on another machine and the daily check of its age (REQ-291), with a stand-in for
// rclone that keeps the remote in a local folder and records each call. No test reaches a real remote.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { archiveTime, wholeCopies } from "../tools/backup-copy.js";
import { backupDatabase, restoreDatabase } from "../tools/database.js";
import { SQLiteD1 } from "../src/sqlite.js";
import { Store } from "../src/store.js";
import { readSnapshot02 } from "../src/snapshot02.js";

const TOOL = fileURLToPath(new URL("../tools/backup-copy.js", import.meta.url));
const DATABASE_TOOL = fileURLToPath(new URL("../tools/database.js", import.meta.url));
const OPS = new URL("../ops/", import.meta.url);
const HOUR = 3600000, DAY = 24 * HOUR;
const CONFIG = "/synthetic/rclone-config-7f3a.conf";

// rclone's calls that the tool makes, on a remote "drive:" kept under FAKE_REMOTE.
const FAKE = String.raw`
import { appendFileSync, copyFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
const [command, ...rest] = process.argv.slice(2);
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ command, rest, config: process.env.RCLONE_CONFIG ?? null }) + "\n");
if (process.env.FAKE_FAIL === command) { console.error("synthetic failure at " + process.env.FAKE_REMOTE); process.exit(1); }
const local = (spec) => { if (!spec.startsWith("drive:")) process.exit(2); return join(process.env.FAKE_REMOTE, spec.slice(6)); };
if (command === "mkdir") mkdirSync(local(rest[0]), { recursive: true });
else if (command === "lsjson") {
  let names; try { names = readdirSync(local(rest[0])); } catch { console.error("directory not found"); process.exit(3); }
  console.log(JSON.stringify(names.filter((name) => statSync(join(local(rest[0]), name)).isFile()).map((name) => ({ Path: name, Name: name, Size: 1, IsDir: false }))));
} else if (command === "copyto") { mkdirSync(dirname(local(rest[1])), { recursive: true }); copyFileSync(rest[0], local(rest[1])); }
else if (command === "deletefile") unlinkSync(local(rest[0]));
else process.exit(2);
`;

const stamp = (time) => new Date(time).toISOString().replaceAll(":", "-");
let serial = 0;
const archive = (time, reason = "daily") => `nexus-${stamp(time)}-${reason}-00000000-0000-4000-8000-${String(++serial).padStart(12, "0")}.sqlite`;

function setup(t) {
  const folder = mkdtempSync(join(tmpdir(), "nexus-backup-copy-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const backups = join(folder, "backups"), remote = join(folder, "remote"), log = join(folder, "rclone.log");
  mkdirSync(backups);
  writeFileSync(join(folder, "fake-rclone.mjs"), FAKE);
  const rclone = join(folder, "rclone");
  writeFileSync(rclone, `#!/bin/sh\nexec "${process.execPath}" "${join(folder, "fake-rclone.mjs")}" "$@"\n`);
  chmodSync(rclone, 0o755);
  const backup = (name, { receipt = true, bytes = 64 } = {}) => {
    writeFileSync(join(backups, name), Buffer.alloc(bytes, 1));
    if (receipt) writeFileSync(join(backups, name + ".json"), JSON.stringify({ schema: "nexus-backup/1", file: name, bytes, sha256: "0".repeat(64) }) + "\n");
  };
  const copy = (name, { receipt = true } = {}) => {
    mkdirSync(join(remote, "backups"), { recursive: true });
    writeFileSync(join(remote, "backups", name), "copy");
    if (receipt) writeFileSync(join(remote, "backups", name + ".json"), "{}");
  };
  const tool = (command, extra = {}, env = {}) => {
    const args = { directory: backups, remote: "drive:backups", rclone, ...extra };
    const list = command === "age" ? ["--remote", args.remote, "--rclone", args.rclone] : ["--directory", args.directory, "--remote", args.remote, "--rclone", args.rclone];
    const result = spawnSync(process.execPath, [TOOL, command, ...list], { encoding: "utf8",
      env: { PATH: process.env.PATH, RCLONE_CONFIG: CONFIG, FAKE_REMOTE: remote, FAKE_LOG: log, ...env } });
    const lines = result.stdout.trim().split("\n");
    const json = lines.length > 1 ? JSON.parse(lines.at(-1)) : null;
    return { status: result.status, out: result.stdout, err: result.stderr, say: lines[0], json };
  };
  const calls = () => existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
  const onRemote = () => existsSync(join(remote, "backups")) ? readdirSync(join(remote, "backups")).sort() : [];
  return { folder, backups, remote, rclone, backup, copy, tool, calls, onRemote };
}

test("copy puts the newest whole backup on the remote, the archive before its receipt, once", (t) => {
  const s = setup(t), now = Date.now();
  const older = archive(now - DAY), newest = archive(now - HOUR, "predeploy"), unfinished = archive(now - 60000);
  s.backup(older);
  s.backup(newest, { bytes: 96 });
  s.backup(unfinished, { receipt: false });
  writeFileSync(join(s.backups, "nexus-in-progress.partial"), "");
  const first = s.tool("copy");
  assert.equal(first.status, 0, first.err);
  assert.equal(first.say, `Copied ${newest} to the other machine.`);
  assert.deepEqual(first.json, { copied: newest, bytes: 96, newest, removed: 0, retention_days: 30 });
  assert.deepEqual(s.onRemote(), [newest, newest + ".json"]);
  assert.deepEqual(s.calls().map((call) => [call.command, call.rest.at(-1)]), [
    ["mkdir", "drive:backups"], ["lsjson", "--no-modtime"], ["copyto", "drive:backups/" + newest],
    ["copyto", "drive:backups/" + newest + ".json"], ["lsjson", "--no-modtime"]]);
  assert.ok(s.calls().every((call) => call.config === CONFIG), "rclone finds its configuration through the environment");
  const again = s.tool("copy");
  assert.equal(again.status, 0, again.err);
  assert.equal(again.say, "The newest backup was already on the other machine.");
  assert.equal(again.json.copied, null);
  assert.equal(s.calls().filter((call) => call.command === "copyto").length, 2);
});

test("an archive on the remote without its receipt is not a copy, and is sent again", (t) => {
  const s = setup(t), now = Date.now(), newest = archive(now - HOUR);
  s.backup(newest);
  s.copy(newest, { receipt: false });
  assert.deepEqual(wholeCopies(new Set([newest])), []);
  const result = s.tool("copy");
  assert.equal(result.status, 0, result.err);
  assert.equal(result.json.copied, newest);
  assert.deepEqual(s.onRemote(), [newest, newest + ".json"]);
});

test("the age check says how old the newest whole copy is and fails past a day", (t) => {
  const s = setup(t), now = Date.now();
  let result = s.tool("age");
  assert.equal(result.status, 1);
  assert.equal(result.say, "No copy of the backup is on the other machine.");
  assert.deepEqual(result.json, { newest: null, age_hours: null, older_than_a_day: true, say: result.say });
  const whole = archive(now - 5 * HOUR - 60000);
  s.copy(whole);
  s.copy(archive(now - HOUR), { receipt: false });
  result = s.tool("age");
  assert.equal(result.status, 0, result.err);
  assert.equal(result.say, "The newest copy of the backup is 5 hours old.");
  assert.equal(result.json.newest, whole);
  assert.equal(result.json.older_than_a_day, false);
  const t2 = setup(t);
  t2.copy(archive(now - DAY - 2 * HOUR));
  result = t2.tool("age");
  assert.equal(result.status, 1);
  assert.equal(result.say, "The newest copy of the backup is 26 hours old, older than a day.");
  assert.equal(result.json.older_than_a_day, true);
  assert.deepEqual(t2.calls().map((call) => call.command), ["lsjson"], "the age check reads the list and no copy");
  const unread = t2.tool("age", {}, { FAKE_FAIL: "lsjson" });
  assert.equal(unread.status, 1);
  assert.equal(unread.out, "The age of the newest copy of the backup could not be read.\n");
  assert.deepEqual(JSON.parse(unread.err), { kind: "backup_copy_failed", reason: "rclone lsjson failed" });
});

test("copies older than 30 days go, receipts first, only while the newest copy is less than a day old", (t) => {
  const s = setup(t), now = Date.now();
  const gone = [archive(now - 40 * DAY), archive(now - 31 * DAY)], kept = archive(now - 29 * DAY), newest = archive(now - HOUR);
  for (const name of [...gone, kept]) s.copy(name);
  s.copy(archive(now - 35 * DAY), { receipt: false });
  s.backup(newest);
  const result = s.tool("copy");
  assert.equal(result.status, 0, result.err);
  assert.equal(result.json.removed, 3);
  assert.deepEqual(s.onRemote(), [kept, kept + ".json", newest, newest + ".json"].sort());
  const deletes = s.calls().filter((call) => call.command === "deletefile").map((call) => call.rest[0]);
  assert.equal(deletes.length, 5);
  assert.ok(deletes.slice(0, 2).every((name) => name.endsWith(".json")), "the receipts go before their archives");

  const stale = setup(t);
  const old = archive(now - 40 * DAY), last = archive(now - 2 * DAY);
  stale.copy(old);
  stale.copy(last);
  stale.backup(last);
  const kept2 = stale.tool("copy");
  assert.equal(kept2.status, 0, kept2.err);
  assert.equal(kept2.json.removed, 0);
  assert.deepEqual(stale.onRemote(), [old, old + ".json", last, last + ".json"].sort());
});

test("a failed copy says only which call failed, and the service's age check still runs after it", (t) => {
  const s = setup(t), now = Date.now(), newest = archive(now - HOUR);
  s.backup(newest);
  const result = s.tool("copy", {}, { FAKE_FAIL: "copyto" });
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.err), { kind: "backup_copy_failed", reason: "rclone copyto failed" });
  for (const text of [result.out, result.err]) {
    assert.ok(!text.includes(s.folder) && !text.includes("drive:") && !text.includes(CONFIG) && !text.includes("synthetic failure"), text);
  }
  const unit = readFileSync(new URL("nexus-backup-copy@.service", OPS), "utf8");
  const starts = unit.split("\n").filter((line) => line.startsWith("ExecStart="));
  assert.equal(starts.length, 2);
  assert.match(starts[0], /^ExecStart=-\/usr\/bin\/node \/opt\/nexus\/%i\/current\/nexus\/tools\/backup-copy\.js copy --directory \/var\/lib\/nexus-%i\/backups --remote \$\{NEXUS_BACKUP_REMOTE\} --rclone \/usr\/bin\/rclone$/);
  assert.match(starts[1], /^ExecStart=\/usr\/bin\/node \/opt\/nexus\/%i\/current\/nexus\/tools\/backup-copy\.js age --remote \$\{NEXUS_BACKUP_REMOTE\} --rclone \/usr\/bin\/rclone$/);
});

test("the output names no path, remote or login, and wrong options reach no rclone", (t) => {
  const s = setup(t), now = Date.now();
  s.backup(archive(now - HOUR));
  for (const command of ["copy", "age"]) {
    const result = s.tool(command);
    for (const text of [result.out, result.err]) assert.ok(!text.includes(s.folder) && !text.includes("drive:") && !text.includes(CONFIG), text);
  }
  const before = s.calls().length;
  const refusals = [
    [{ rclone: "rclone" }, "rclone's absolute path is required"],
    [{ remote: "-drive:backups" }, "a remote such as name:folder is required"],
    [{ remote: "drive:../backups" }, "a remote such as name:folder is required"],
    [{ remote: "drive:backups --delete" }, "a remote such as name:folder is required"],
    [{ directory: "backups" }, "the backups' absolute directory is required"],
    [{ directory: join(s.folder, "missing") }, "the backups' directory cannot be read"],
  ];
  for (const [extra, reason] of refusals) {
    const result = s.tool("copy", extra);
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(result.err), { kind: "backup_copy_failed", reason });
  }
  assert.equal(s.calls().length, before);
  const empty = setup(t);
  const none = empty.tool("copy");
  assert.deepEqual(JSON.parse(none.err), { kind: "backup_copy_failed", reason: "no backup to copy" });
});

test("the copy runs daily after the backup, as the backup's own user, and catches up after downtime", () => {
  const unit = readFileSync(new URL("nexus-backup-copy@.service", OPS), "utf8");
  const timer = readFileSync(new URL("nexus-backup-copy@.timer", OPS), "utf8");
  const backup = readFileSync(new URL("nexus-backup@.service", OPS), "utf8");
  for (const line of ["User=nexus-%i", "Group=nexus-%i", "EnvironmentFile=/etc/nexus/%i.env", "UMask=0077", "NoNewPrivileges=true", "ProtectSystem=strict", "ProtectHome=true", "ReadWritePaths=/var/lib/nexus-%i"]) {
    assert.ok(unit.split("\n").includes(line), line);
    assert.ok(backup.split("\n").includes(line), line);
  }
  assert.ok(unit.includes("After=nexus-backup@%i.service network-online.target\n"));
  assert.ok(unit.includes("Environment=RCLONE_CONFIG=/var/lib/nexus-%i/rclone/rclone.conf\n"));
  assert.ok(timer.includes("OnCalendar=*-*-* 04:00:00 UTC\n") && timer.includes("Persistent=true\n") && timer.includes("Unit=nexus-backup-copy@%i.service\n"));
  assert.ok(readFileSync(new URL("nexus-backup@.timer", OPS), "utf8").includes("OnCalendar=*-*-* 03:15:00 UTC\nRandomizedDelaySec=15m\n"), "the backup ends before the copy starts");
  const deploy = readFileSync(new URL("deploy-dev.sh", OPS), "utf8");
  for (const unit of ["nexus-backup-copy@.service", "nexus-backup-copy@.timer"]) assert.ok(deploy.includes(`install -m 0644 "$release/nexus/ops/${unit}" /etc/systemd/system/${unit}\n`), unit);
  assert.ok(deploy.includes("if grep -q '^NEXUS_BACKUP_REMOTE=' /etc/nexus/dev.env && [ -x /usr/bin/rclone ]; then\n"), "the copy runs only once its remote is set");
  assert.match(readFileSync(new URL("deploy-dev.ps1", OPS), "utf8"), / nexus\/tools\/database\.js nexus\/tools\/backup-copy\.js /);
  assert.equal(archiveTime("nexus-2026-11-14T03-15-00.000Z-daily-00000000-0000-4000-8000-000000000001.sqlite"), Date.parse("2026-11-14T03:15:00.000Z"));
  assert.equal(archiveTime("nexus-2026-11-14T03-15-00.000Z-daily-x.sqlite"), null);
});

test("a copy restored on the other machine counts the same rows as the server's archive, and shows no row", async (t) => {
  const folder = mkdtempSync(join(tmpdir(), "nexus-backup-counts-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const database = join(folder, "server.sqlite"), db = new SQLiteD1(database);
  const snapshot = JSON.parse(readFileSync(new URL("./snapshot-02-example.json", import.meta.url), "utf8"));
  try { const store = new Store(db); await store.ensure(); await store.push(readSnapshot02(snapshot, Date.now())); } finally { db.close(); }
  const receipt = await backupDatabase(database, join(folder, "backups"), "daily");
  const archived = join(folder, "backups", receipt.file), elsewhere = join(folder, "other-machine");
  mkdirSync(elsewhere);
  for (const name of [receipt.file, receipt.file + ".json"]) writeFileSync(join(elsewhere, name), readFileSync(join(folder, "backups", name)));
  const restored = join(elsewhere, "restore-check.sqlite");
  assert.equal((await restoreDatabase(join(elsewhere, receipt.file), restored)).restored, true);
  const counts = (path) => {
    const result = spawnSync(process.execPath, [DATABASE_TOOL, "counts", "--database", path], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const server = counts(archived), copy = counts(restored);
  assert.equal(copy, server);
  const { tables, projects } = JSON.parse(server);
  assert.equal(tables.snapshots, 1);
  assert.ok(Object.keys(tables).length > 5 && Object.values(tables).every(Number.isInteger));
  assert.deepEqual(Object.keys(projects), [snapshot.project.name]);
  assert.equal(projects[snapshot.project.name].project_spaces, 1);
  assert.ok(!server.includes(snapshot.project.title) && !server.includes(folder), "counts and project names only");
  const relative = spawnSync(process.execPath, [DATABASE_TOOL, "counts", "--database", "server.sqlite"], { encoding: "utf8", cwd: folder });
  assert.equal(relative.status, 1);
});
