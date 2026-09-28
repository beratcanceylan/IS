/**
 * expo-sqlite'ın kullandığımız asenkron alt kümesi. Repository'ler yalnızca bu arayüze
 * bağımlıdır; böylece testlerde aynı SQL, Node'un yerleşik SQLite'ı üzerinde çalıştırılabilir.
 */
export type SqlValue = string | number | null;
export type SqlParams = SqlValue[];

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParams): Promise<RunResult>;
  getAllAsync<T>(sql: string, params?: SqlParams): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParams): Promise<T | null>;
  /** Tek bir yazma işlemi olarak çalışır; hata olursa geri alınır. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
