import * as SQLite from 'expo-sqlite';

import { runMigrations } from './migrations';
import type { Db, SqlParams } from './types';

export const DB_NAME = 'jobs.db';

/**
 * Tek bağlantı + yazma kilidi.
 *
 * `withExclusiveTransactionAsync` her transaction için ikinci bir bağlantı açıp kapatır; SDK 57'de
 * bu bağlantı kapanırken Android'de native çökme (statement double-free, SIGABRT) gözlendi.
 * Bu yüzden transaction'lar ana bağlantıda `BEGIN IMMEDIATE` ile açılır ve tüm yazmalar
 * (transaction dışındaki tekil yazmalar dahil) sırayla çalışır. Böylece bir kullanıcı işlemi
 * (örn. favori) asla başka bir senkron transaction'ının içine karışmaz. Okumalar kilitlenmez.
 */
class WriteLock {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn);
    this.tail = result.catch(() => undefined);
    return result;
  }
}

function createDb(native: SQLite.SQLiteDatabase): Db {
  const lock = new WriteLock();

  const raw = {
    execAsync: (sql: string) => native.execAsync(sql),
    runAsync: async (sql: string, params: SqlParams = []) => {
      const r = await native.runAsync(sql, params);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    getAllAsync: <T>(sql: string, params: SqlParams = []) => native.getAllAsync<T>(sql, params),
    getFirstAsync: <T>(sql: string, params: SqlParams = []) => native.getFirstAsync<T>(sql, params),
  };

  // Transaction içinde kullanılan görünüm: kilit zaten alınmış, iç içe transaction düz çalışır.
  const tx: Db = { ...raw, transaction: (fn) => fn(tx) };

  return {
    execAsync: (sql) => lock.run(() => raw.execAsync(sql)),
    runAsync: (sql, params) => lock.run(() => raw.runAsync(sql, params)),
    getAllAsync: raw.getAllAsync,
    getFirstAsync: raw.getFirstAsync,
    transaction: (fn) =>
      lock.run(async () => {
        await native.execAsync('BEGIN IMMEDIATE');
        try {
          const result = await fn(tx);
          await native.execAsync('COMMIT');
          return result;
        } catch (error) {
          await native.execAsync('ROLLBACK').catch(() => undefined);
          throw error;
        }
      }),
  };
}

let instance: Promise<Db> | null = null;

/**
 * Uygulama genelinde tek DB bağlantısı. İlk çağrıda açılır ve migration'lar çalışır.
 * Background task da aynı fonksiyonu kullanır.
 */
export function getDb(): Promise<Db> {
  instance ??= open().catch((error) => {
    instance = null;
    throw error;
  });
  return instance;
}

async function open(): Promise<Db> {
  const native = await SQLite.openDatabaseAsync(DB_NAME);
  // WAL: okuma ve yazma birbirini bloklamaz.
  await native.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  const db = createDb(native);
  await runMigrations(db);
  return db;
}
