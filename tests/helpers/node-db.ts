import { DatabaseSync } from 'node:sqlite';

import { runMigrations } from '@/db/migrations';
import type { Db, SqlParams } from '@/db/types';

/** Testler için bellek içi SQLite; uygulamadaki `Db` arayüzünün aynısı. */
export function createNodeDb(): Db {
  const native = new DatabaseSync(':memory:');
  let depth = 0;
  const db: Db = {
    async execAsync(sql) {
      native.exec(sql);
    },
    async runAsync(sql, params: SqlParams = []) {
      const r = native.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async getAllAsync<T>(sql: string, params: SqlParams = []) {
      return native.prepare(sql).all(...params).map((row) => ({ ...row })) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParams = []) {
      const row = native.prepare(sql).get(...params);
      return (row ? { ...row } : null) as T | null;
    },
    async transaction<T>(fn: (tx: Db) => Promise<T>) {
      if (depth > 0) return fn(db);
      depth++;
      native.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(db);
        native.exec('COMMIT');
        return result;
      } catch (e) {
        native.exec('ROLLBACK');
        throw e;
      } finally {
        depth--;
      }
    },
  };
  return db;
}

export async function createMigratedDb(): Promise<Db> {
  const db = createNodeDb();
  await runMigrations(db);
  return db;
}
