import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { applyRebuildSchema, SQLITE } from "./store.js";

const initialMigration = new URL("../../db/rebuild/migrations/001-initial.sql", import.meta.url);
const additiveMigrations = [
  new URL("../../db/rebuild/migrations/002-publication-attempts.sql", import.meta.url),
  new URL("../../db/rebuild/migrations/003-project-credential-usage.sql", import.meta.url),
];

// Open only a dedicated rebuild database. The legacy entry point continues to
// use SQLiteD1 and does not call this adapter.
export function openRebuildDatabase(path) {
  const schema = readFileSync(initialMigration, "utf8");
  const additiveSchema = additiveMigrations.map((migration) => readFileSync(migration, "utf8")).join("\n");
  const connection = new DatabaseSync(path);
  try {
    applyRebuildSchema(connection, schema, additiveSchema);
    connection.exec(SQLITE.setup);
    return connection;
  } catch (error) {
    connection.close();
    throw error;
  }
}
