// Keeps a copy of the newest verified backup on another machine with rclone, and reads the age of the newest copy
// there (REQ-291, TASK-313). The remote's login stays in rclone's own configuration on the server, which rclone finds
// through RCLONE_CONFIG. Output holds archive names, sizes, counts and ages: never rows, a path of the server, the
// remote's name or rclone's own messages.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ARCHIVE = /^nexus-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2}\.\d{3})Z-(?:daily|predeploy|premigrate|prerestore)-[0-9a-f-]{36}\.sqlite$/;
const HOUR = 3600000, DAY = 24 * HOUR;
// rclone's name:folder, without options, parent folders or anything a shell or rclone reads differently.
const REMOTE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*:(?:[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)?$/;

// A refusal this tool words itself, which names no path, remote or message of rclone's.
export class CopyError extends Error {}

export function archiveTime(name) {
  const match = ARCHIVE.exec(name);
  return match ? Date.parse(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`) : null;
}

function checked({ remote, rclone, directory }, needsDirectory) {
  if (!rclone || !isAbsolute(rclone)) throw new CopyError("rclone's absolute path is required");
  if (typeof remote !== "string" || !REMOTE.test(remote) || remote.split(/[:/]/).includes("..")) throw new CopyError("a remote such as name:folder is required");
  if (needsDirectory && (!directory || !isAbsolute(directory))) throw new CopyError("the backups' absolute directory is required");
  return { remote, rclone, directory: needsDirectory ? resolve(directory) : null };
}

function run(rclone, args, timeout, also = []) {
  // The environment passes on as it is, so that rclone finds RCLONE_CONFIG; its output and messages stay here.
  const result = spawnSync(rclone, args, { encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  if (result.error || (result.status !== 0 && !also.includes(result.status))) throw new CopyError(`rclone ${args[0]} failed`);
  return result;
}

const at = (remote, name) => remote.endsWith(":") ? remote + name : `${remote}/${name}`;

// rclone's exit code 3 says that the folder is not there, which holds no copy.
function listRemote(rclone, remote) {
  const listed = run(rclone, ["lsjson", remote, "--files-only", "--no-mimetype", "--no-modtime"], 120000, [3]);
  if (listed.status === 3) return new Set();
  let entries;
  try { entries = JSON.parse(listed.stdout); } catch { throw new CopyError("rclone lsjson answered no list"); }
  if (!Array.isArray(entries)) throw new CopyError("rclone lsjson answered no list");
  return new Set(entries.map((entry) => entry && entry.Name).filter((name) => typeof name === "string"));
}

// The copies that are whole, oldest first: an archive counts once its receipt is beside it, since the receipt goes
// second and is removed first.
export function wholeCopies(names) {
  return [...names].filter((name) => archiveTime(name) !== null && names.has(name + ".json")).sort((a, b) => archiveTime(a) - archiveTime(b));
}

// The newest backup in the directory whose receipt names it, as database.js writes them.
export function newestBackup(directory) {
  let newest = null, names;
  try { names = readdirSync(directory); } catch { throw new CopyError("the backups' directory cannot be read"); }
  for (const name of names) {
    const time = archiveTime(name);
    if (time === null || (newest && time <= newest.time) || !existsSync(join(directory, name + ".json"))) continue;
    let receipt;
    try { receipt = JSON.parse(readFileSync(join(directory, name + ".json"), "utf8")); } catch { continue; }
    if (receipt?.schema !== "nexus-backup/1" || receipt.file !== name) continue;
    newest = { name, time, bytes: statSync(join(directory, name)).size };
  }
  return newest;
}

export function copyBackup(options, { now = Date.now(), days = 30 } = {}) {
  const { remote, rclone, directory } = checked(options, true);
  if (!Number.isInteger(days) || days < 7) throw new CopyError("retain at least seven days");
  const newest = newestBackup(directory);
  if (!newest) throw new CopyError("no backup to copy");
  run(rclone, ["mkdir", remote], 120000);
  let names = listRemote(rclone, remote), copied = null;
  if (!wholeCopies(names).includes(newest.name)) {
    // The archive goes first and its receipt second, so that a receipt on the remote stands for a whole archive.
    run(rclone, ["copyto", join(directory, newest.name), at(remote, newest.name)], 3 * HOUR);
    run(rclone, ["copyto", join(directory, newest.name + ".json"), at(remote, newest.name + ".json")], 600000);
    names = listRemote(rclone, remote);
    if (!wholeCopies(names).includes(newest.name)) throw new CopyError("the copy is not on the remote");
    copied = newest.name;
  }
  // Older copies go only while the newest whole copy is less than a day old, so that a backup that stopped never
  // empties the remote. A receipt goes before its archive.
  const copies = wholeCopies(names), newestCopy = copies.at(-1) ?? null;
  let removed = 0;
  if (newestCopy && now - archiveTime(newestCopy) < DAY) {
    const old = [...names].filter((name) => {
      const time = archiveTime(name.endsWith(".json") ? name.slice(0, -5) : name);
      return time !== null && now - time > days * DAY;
    }).sort((a, b) => Number(b.endsWith(".json")) - Number(a.endsWith(".json")));
    for (const name of old) {
      run(rclone, ["deletefile", at(remote, name)], 600000);
      if (!name.endsWith(".json")) removed++;
    }
  }
  return { copied, bytes: copied ? newest.bytes : null, newest: newestCopy, removed, retention_days: days };
}

export function copyAge(options, { now = Date.now() } = {}) {
  const { remote, rclone } = checked(options, false);
  const newest = wholeCopies(listRemote(rclone, remote)).at(-1) ?? null;
  if (!newest) return { newest: null, age_hours: null, older_than_a_day: true, say: "No copy of the backup is on the other machine." };
  const age = Math.max(0, now - archiveTime(newest)), hours = Math.floor(age / HOUR), older = age > DAY;
  const words = hours < 1 ? "less than an hour" : hours === 1 ? "1 hour" : `${hours} hours`;
  return { newest, age_hours: Math.round(age / 360000) / 10, older_than_a_day: older,
    say: older ? `The newest copy of the backup is ${words} old, older than a day.` : `The newest copy of the backup is ${words} old.` };
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--(?:directory|remote|rclone)$/.test(args[i]) || !args[i + 1]) throw new CopyError("use --directory, --remote and --rclone");
    options[args[i].slice(2)] = args[i + 1];
  }
  if (command === "copy") {
    const result = copyBackup(options);
    console.log(result.copied ? `Copied ${result.copied} to the other machine.` : "The newest backup was already on the other machine.");
    console.log(JSON.stringify(result));
  } else if (command === "age") {
    let result;
    try { result = copyAge(options); }
    catch (error) { console.log("The age of the newest copy of the backup could not be read."); throw error; }
    console.log(result.say);
    console.log(JSON.stringify(result));
    if (result.older_than_a_day) process.exitCode = 1;
  } else throw new CopyError("choose copy or age");
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) {
  try { main(); }
  catch (error) {
    console.error(JSON.stringify({ kind: "backup_copy_failed", reason: error instanceof CopyError ? error.message : "unexpected" }));
    process.exitCode = 1;
  }
}
