import type { Db } from '../types';

import { migration001 } from './001-initial';
import { migration002 } from './002-fts';

export interface Migration {
  version: number;
  name: string;
  up(db: Db): Promise<void>;
}

/**
 * Sıralı migration listesi. Yeni migration eklerken:
 * 1. `00N-ad.ts` dosyası oluştur, `version` bir öncekinden bir fazla olsun.
 * 2. Buraya ekle.
 * 3. Var olan migration'ları ASLA değiştirme; kullanıcı cihazında zaten çalışmış olabilirler.
 */
export const MIGRATIONS: readonly Migration[] = [migration001, migration002];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function getSchemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Bekleyen migration'ları sırayla, her biri kendi transaction'ında çalıştırır.
 * Sürüm `PRAGMA user_version` içinde tutulur. Bir migration hata verirse o migration geri alınır
 * ve sonraki migration'lar çalıştırılmaz; mevcut veri korunur.
 */
export async function runMigrations(db: Db, migrations: readonly Migration[] = MIGRATIONS): Promise<number[]> {
  const current = await getSchemaVersion(db);
  const applied: number[] = [];
  for (const m of migrations) {
    if (m.version <= current) continue;
    await db.transaction(async (tx) => {
      await m.up(tx);
      // PRAGMA parametre kabul etmez; sürüm tamsayı olduğu için doğrudan yazmak güvenlidir.
      await tx.execAsync(`PRAGMA user_version = ${Math.trunc(m.version)}`);
    });
    applied.push(m.version);
  }
  return applied;
}
