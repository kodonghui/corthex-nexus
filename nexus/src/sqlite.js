// D1's small prepared-statement surface over Node's built-in SQLite. Product
// queries remain in Store; a batch executes synchronously in one transaction.
import { DatabaseSync } from "node:sqlite";
import { SQLITE } from "./store.js";

class Statement {
  constructor(owner, sql, params = []) {
    this.owner = owner;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) { return new Statement(this.owner, this.sql, params); }
  async first(column) {
    const row = this.owner.connection.prepare(this.sql).get(...this.params);
    return row === undefined ? null : column === undefined ? { ...row } : row[column];
  }
  async all() { return this.owner.execute(this); }
  async run() { return this.owner.execute(this); }
}

export class SQLiteD1 {
  constructor(path, { readOnly = false } = {}) {
    this.connection = new DatabaseSync(path, { readOnly });
    try { if (!readOnly) this.connection.exec(SQLITE.setup); }
    catch (error) { this.connection.close(); throw error; }
  }
  prepare(sql) { return new Statement(this, sql); }
  execute(statement) {
    if (!(statement instanceof Statement) || statement.owner !== this) throw new TypeError("statement belongs to another database");
    const db = this.connection;
    const before = db.prepare(SQLITE.changes).get().n;
    const prepared = db.prepare(statement.sql);
    const rows = prepared.columns().length ? prepared.all(...statement.params).map((row) => ({ ...row })) : (prepared.run(...statement.params), []);
    const after = db.prepare(SQLITE.changes).get().n;
    return { success: true, results: rows, meta: { changes: Number(after - before) } };
  }
  async batch(statements) {
    this.connection.exec(SQLITE.begin);
    try {
      const results = statements.map((statement) => this.execute(statement));
      this.connection.exec(SQLITE.commit);
      return results;
    } catch (error) {
      this.connection.exec(SQLITE.rollback);
      throw error;
    }
  }
  check() {
    const integrity = this.connection.prepare(SQLITE.integrity).all();
    const foreignKeys = this.connection.prepare(SQLITE.foreignKeys).all();
    if (integrity.length !== 1 || integrity[0].integrity_check !== "ok" || foreignKeys.length) throw new Error("database integrity check failed");
  }
  close() { this.connection.close(); }
}
