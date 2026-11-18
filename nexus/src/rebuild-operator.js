import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { constants as fileFlags } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { DatabaseSync, backup, constants as sqliteFlags } from "node:sqlite";
import { pathToFileURL } from "node:url";
import { commitPattern, idPattern } from "./rebuild-contract.js";
import { canonicalJSON, sha256 } from "./rebuild-http.js";
import { buildLegacyPlan, legacyManifest } from "./rebuild-legacy.js";
import { openRebuildDatabase } from "./rebuild-sqlite.js";
import { readLegacyCollections, RebuildStore, SQLITE } from "./store.js";

const checkedPath = (path) => {
  if (typeof path !== "string" || !isAbsolute(path)) throw new Error("Protected operator paths must be absolute");
  return resolve(path);
};

async function fingerprint(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function privateFile(file) {
  const supplied = checkedPath(file);
  const stats = await lstat(supplied);
  if (!stats.isFile() || stats.isSymbolicLink() || (stats.mode & 0o077) !== 0) throw new Error("A protected owner-only file is required");
  return realpath(supplied);
}

async function freshDirectory(path) {
  const location = checkedPath(path);
  await mkdir(location, { mode: 0o700 });
  return realpath(location);
}

async function receipt(folder, name, data) {
  await writeFile(join(folder, name), JSON.stringify(data, null, 2) + "\n", { mode: 0o600, flag: "wx" });
}

async function copySQLite(source, destination) {
  const path = await privateFile(source);
  const connection = new DatabaseSync(path, { readOnly: true });
  try { await backup(connection, destination); }
  finally { connection.close(); }
}

export async function backupLegacy(input, output) {
  const parent = await freshDirectory(output);
  const db = join(parent, "legacy.sqlite");
  await writeFile(db, "", { flag: "wx", mode: 0o600 });
  await copySQLite(input, db);
  const connection = new DatabaseSync(db, { readOnly: true });
  try {
    const manifest = legacyManifest(readLegacyCollections(connection), await fingerprint(db));
    await receipt(parent, "inventory.json", manifest);
    return { action: "legacy_backup", projects: manifest.project_names.length,
      rows: Object.values(manifest.tables).reduce((sum, table) => sum + table.count, 0),
      inventory_digest: sha256(canonicalJSON(manifest)), accepted_write_boundary: manifest.accepted_write_boundary };
  } finally { connection.close(); }
}

export async function importLegacy(input, inventory, ownerConfig, candidate) {
  const [source, manifestFile, configFile, target] = await Promise.all([input, inventory, ownerConfig, candidate].map(privateFile));
  if (source === target) throw new Error("The import target must be the isolated rebuild database");
  const [manifest, config] = await Promise.all([manifestFile, configFile].map(async (path) => JSON.parse(await readFile(path, "utf8"))));
  const legacy = new DatabaseSync(source, { readOnly: true });
  try {
    const data = readLegacyCollections(legacy);
    const actual = legacyManifest(data, await fingerprint(source));
    if (canonicalJSON(manifest) !== canonicalJSON(actual)) throw new Error("The legacy inventory differs from its backup");
    const connection = openRebuildDatabase(target);
    try {
      const store = new RebuildStore(connection);
      for (const entry of Object.values(config)) {
        if (!entry?.owner_id || !store.verifiedOwner(entry.owner_id)) throw new Error("A mapped owner has not authenticated in the target");
      }
      const plan = buildLegacyPlan(data, manifest, config, manifestFile, new Date().toISOString());
      const report = store.importLegacy(plan);
      return { action: "legacy_import", inventory_digest: plan.digest, ...report };
    } finally { connection.close(); }
  } finally { legacy.close(); }
}

export async function backupRebuild(input, output) {
  const parent = await freshDirectory(output);
  const destination = join(parent, "rebuild.sqlite");
  await writeFile(destination, "", { flag: "wx", mode: 0o600 });
  await copySQLite(input, destination);
  const connection = openRebuildDatabase(destination);
  try {
    // Fold the backup's temporary journal into the protected single-file copy
    // before computing the baseline fingerprint.
    const boundary = new RebuildStore(connection).journalBoundary();
    connection.exec(SQLITE.archive);
    const snapshot = { format: "nexus.rebuild-backup/1", sha256: await fingerprint(destination), boundary };
    await receipt(parent, "baseline.json", snapshot);
    return { action: "rebuild_backup", ...snapshot };
  } finally { connection.close(); }
}

export async function recoverAcknowledged({ baseline, inventory, frozen, output }) {
  const [base, manifestPath, tail] = await Promise.all([baseline, inventory, frozen].map(privateFile));
  if (base === tail) throw new Error("The baseline and frozen journal must be separate snapshots");
  const record = JSON.parse(await readFile(manifestPath, "utf8"));
  if (record.format !== "nexus.rebuild-backup/1" || !Number.isSafeInteger(record.boundary) || record.boundary < 0 || record.sha256 !== await fingerprint(base)) {
    throw new Error("The baseline does not match its protected fingerprint");
  }
  const folder = await freshDirectory(output);
  const target = join(folder, "recovered.sqlite");
  await copyFile(base, target, fileFlags.COPYFILE_EXCL);
  const current = new DatabaseSync(tail, { readOnly: true });
  const restored = openRebuildDatabase(target);
  try {
    const source = new RebuildStore(current), candidate = new RebuildStore(restored);
    const result = candidate.restoreJournal(source.recoveryRows(record.boundary), record.boundary, source.journalBoundary(),
      sha256, () => sqliteFlags.SQLITE_CHANGESET_ABORT);
    restored.exec(SQLITE.archive);
    const proof = { action: "journal_recovery", ...result, recovered_sha256: await fingerprint(target) };
    await receipt(folder, "recovery.json", proof);
    return proof;
  } finally { current.close(); restored.close(); }
}

// API-239. Protected signed-in QA and migration receipts must identify
// the exact candidate. Runtime routing is controlled by the server operator.
export async function checkRelease(input, expectedCommit) {
  if (!commitPattern.test(expectedCommit)) throw new Error("A candidate commit is required");
  const file = await privateFile(input);
  const report = JSON.parse(await readFile(file, "utf8"));
  if (report.format !== "nexus.release-evidence/1" || report.release_commit !== expectedCommit) throw new Error("Release evidence belongs to another candidate");
  const required = [
    ["api", "api_contract"], ["browsers", "browser_flow"], ["performance", "latency"],
    ["migration", "protected_migration"], ["recovery", "journal_recovery"], ["compatibility", "wire_compatibility"],
    ["isolation", "preview_isolation"], ["oidc", "real_oidc"], ["publication", "held_publication"], ["checkpoints", "owner_checkpoints"],
  ];
  const blocked = [];
  const data = {};
  for (const [gate, format] of required) {
    const reference = report.reports?.[gate];
    if (!reference?.path || !/^[a-f0-9]{64}$/.test(reference.sha256)) { blocked.push(gate); continue; }
    try {
      const source = await privateFile(reference.path);
      const bytes = await readFile(source);
      const proof = JSON.parse(bytes);
      if (sha256(bytes) !== reference.sha256 || proof.commit !== expectedCommit || proof.kind !== format || proof.outcome !== "passed") {
        blocked.push(gate);
        continue;
      }
      data[gate] = proof;
    } catch { blocked.push(gate); }
  }
  const flows = Array.from({ length: 9 }, (_, i) => `FL-${i + 128}`);
  if (data.api && (data.api.operations !== 36 || data.api.all_declared_responses !== true || data.api.must_failures !== 0)) blocked.push("api");
  if (data.browsers && (data.browsers.must_failures !== 0 || !Array.isArray(data.browsers.flows) ||
      flows.some((flow) => !data.browsers.flows.includes(flow)))) blocked.push("browsers");
  if (data.performance && (![data.performance.review_p95_ms, data.performance.question_p95_ms].every((ms) => Number.isFinite(ms) && ms >= 0) ||
      data.performance.review_p95_ms > 2000 || data.performance.question_p95_ms > 1000 ||
      !Number.isSafeInteger(data.performance.samples) || data.performance.samples < 200)) blocked.push("performance");
  if (data.migration && (!Array.isArray(data.migration.projects) || data.migration.projects.length !== 3 ||
      ["corthex", "corthex-nexus", "marong"].some((name) => !data.migration.projects.includes(name)) ||
      data.migration.missing_records !== 0)) blocked.push("migration");
  if (data.recovery && (!Number.isSafeInteger(data.recovery.acknowledged) || data.recovery.acknowledged < 1 ||
      data.recovery.acknowledged !== data.recovery.recovered)) blocked.push("recovery");
  if (data.publication && data.publication.held_commit !== expectedCommit) blocked.push("publication");
  if (data.checkpoints && (!Array.isArray(data.checkpoints.decisions) ||
      ["11-development", "12-qa"].some((stage) => !data.checkpoints.decisions.some((decision) =>
        decision.stage === stage && decision.state === "passed" && decision.role === "owner" && typeof decision.id === "string" && idPattern.test(decision.id))))) {
    blocked.push("checkpoints");
  }
  return { action: "release_preflight", candidate: expectedCommit, decision: blocked.length ? "keep" : "ready_to_switch", blocked };
}

const actions = new Map([
  ["backup-legacy", { args: 2, run: backupLegacy }],
  ["import-legacy", { args: 4, run: importLegacy }],
  ["backup-rebuild", { args: 2, run: backupRebuild }],
  ["check-release", { args: 2, run: checkRelease }],
  ["recover", { args: 4, run: (baseline, inventory, frozen, output) => recoverAcknowledged({ baseline, inventory, frozen, output }) }],
]);

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.umask(0o077);
  const [name, ...args] = process.argv.slice(2);
  const command = actions.get(name);
  if (!command || args.length !== command.args) {
    console.error("Usage: rebuild-operator.js backup-legacy SOURCE OUTPUT | import-legacy BACKUP INVENTORY OWNER_MAP TARGET | backup-rebuild SOURCE OUTPUT | recover BASELINE INVENTORY FROZEN OUTPUT | check-release EVIDENCE MAIN_COMMIT");
    process.exitCode = 2;
  } else {
    try {
      const result = await command.run(...args);
      console.log(JSON.stringify(result));
      if (result.decision === "keep") process.exitCode = 1;
    }
    catch { console.error(JSON.stringify({ action: name, outcome: "blocked" })); process.exitCode = 1; }
  }
}
