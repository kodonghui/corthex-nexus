// Offline operations: output contains receipts, never rows or SQL errors.
import { backup } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SQLiteD1 } from "../src/sqlite.js";
import { Store, SQLITE } from "../src/store.js";

const REASONS = new Set(["daily", "predeploy", "premigrate", "prerestore"]);
const absolute = (path) => { if (!path || !isAbsolute(path)) throw new Error("an absolute path is required"); return resolve(path); };
const digest = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");

export async function backupDatabase(database, directory, reason = "daily", { now = new Date() } = {}) {
  database = absolute(database); directory = absolute(directory);
  if (!REASONS.has(reason)) throw new Error("unknown backup reason");
  process.umask(0o077);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stem = `nexus-${now.toISOString().replaceAll(":", "-")}-${reason}-${randomUUID()}`;
  const temporary = join(directory, stem + ".partial"), destination = join(directory, stem + ".sqlite");
  closeSync(openSync(temporary, "wx", 0o600));
  let source;
  try {
    source = new SQLiteD1(database, { readOnly: true });
    await backup(source.connection, temporary);
    const check = new SQLiteD1(temporary);
    // A standalone archive must not depend on WAL/SHM companions. Checkpoint
    // this completed copy, never the live source, before hashing it.
    try { check.check(); check.connection.exec(SQLITE.archive); } finally { check.close(); }
    chmodSync(temporary, 0o600);
    const receipt = { schema: "nexus-backup/1", created_at: now.toISOString(), reason, file: basename(destination), bytes: statSync(temporary).size, sha256: digest(temporary) };
    renameSync(temporary, destination);
    writeFileSync(destination + ".json", JSON.stringify(receipt) + "\n", { flag: "wx", mode: 0o600 });
    return receipt;
  } finally {
    source?.close();
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

export function retainBackups(directory, { now = Date.now(), days = 30 } = {}) {
  directory = absolute(directory);
  if (!Number.isInteger(days) || days < 7) throw new Error("retain at least seven days");
  let removed = 0;
  for (const name of readdirSync(directory)) {
    const match = /^nexus-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)-(daily|predeploy|premigrate|prerestore)-[0-9a-f-]{36}\.sqlite$/.exec(name);
    if (!match) continue;
    const timestamp = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3");
    if (now - Date.parse(timestamp) <= days * 86400000) continue;
    const file = join(directory, name);
    if (statSync(file).isFile()) {
      unlinkSync(file);
      if (existsSync(file + ".json")) unlinkSync(file + ".json");
      removed++;
    }
  }
  return { removed, retention_days: days };
}

export async function restoreDatabase(sourcePath, destination) {
  sourcePath = absolute(sourcePath); destination = absolute(destination);
  // Restore always makes a separate file. Stopping the service and selecting
  // it is an explicit operator step; no live WAL files are overwritten.
  const receipt = JSON.parse(readFileSync(sourcePath + ".json", "utf8"));
  if (receipt.schema !== "nexus-backup/1" || receipt.file !== basename(sourcePath) || receipt.sha256 !== digest(sourcePath)) throw new Error("backup receipt does not match");
  closeSync(openSync(destination, "wx", 0o600));
  const source = new SQLiteD1(sourcePath, { readOnly: true });
  try {
    source.check();
    await backup(source.connection, destination);
    const restored = new SQLiteD1(destination);
    try { restored.check(); await new Store(restored).ensure(); restored.check(); }
    finally { restored.close(); }
    return { restored: true, bytes: statSync(destination).size, sha256: digest(destination) };
  } catch (error) { unlinkSync(destination); throw error; }
  finally { source.close(); }
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--[a-z-]+$/.test(args[i]) || !args[i + 1]) throw new Error("invalid option");
    options[args[i].slice(2)] = args[i + 1];
  }
  if (command === "backup") {
    const receipt = await backupDatabase(options.database, options.directory, options.reason);
    const retention = retainBackups(options.directory);
    console.log(JSON.stringify({ ...receipt, ...retention }));
  } else if (command === "restore") console.log(JSON.stringify(await restoreDatabase(options.backup, options.destination)));
  else if (command === "migrate") {
    await backupDatabase(options.database, options.directory, "premigrate");
    const db = new SQLiteD1(absolute(options.database));
    try { await new Store(db).ensure(); db.check(); console.log(JSON.stringify({ migrated: true })); }
    finally { db.close(); }
  } else throw new Error("choose backup, restore or migrate");
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) main().catch(() => { console.error(JSON.stringify({ kind: "database_operation_failed" })); process.exitCode = 1; });
