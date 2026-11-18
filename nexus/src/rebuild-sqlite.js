import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { applyRebuildSchema, SQLITE } from "./store.js";

const migration = new URL("../../db/rebuild/migrations/001-initial.sql", import.meta.url);

// Open only a dedicated rebuild database. The legacy entry point continues to
// use SQLiteD1 and does not call this adapter.
export function openRebuildDatabase(path) {
  const schema = readFileSync(migration, "utf8");
  const connection = new DatabaseSync(path);
  try {
    applyRebuildSchema(connection, schema);
    connection.exec(SQLITE.setup);
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}
