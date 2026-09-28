import type { JobFilter } from '@/domain/saved-search';
import type { Db } from '@/db/types';

/**
 * Tip güvenli ayarlar. Değerler JSON olarak saklanır; bilinmeyen/bozuk değer varsayılana döner.
 */
export interface AppSettings {
  onboardingDone: boolean;
  /** Akışın varsayılan filtresi (ilk açılışta seçilen iller dahil). */
  feedFilter: JobFilter;
  /** Bu zamandan sonra bulunan ilanlar "Yeni" bölümünde gösterilir. */
  feedSeenUntil: string;
  /** Otomatik kontrol için minimum aralık (dakika). İşletim sistemi daha geç çalıştırabilir. */
  syncIntervalMinutes: number;
  backgroundSyncEnabled: boolean;
  notificationsEnabled: boolean;
  developerMode: boolean;
  recentSearches: string[];
  lastSyncAt: string | null;
  ftsAvailable: boolean | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  onboardingDone: false,
  feedFilter: {},
  feedSeenUntil: '1970-01-01T00:00:00.000Z',
  syncIntervalMinutes: 180,
  backgroundSyncEnabled: true,
  notificationsEnabled: true,
  developerMode: false,
  recentSearches: [],
  lastSyncAt: null,
  ftsAvailable: null,
};

// DB'deki anahtar adları (migration 002, fts_available anahtarını düz metin yazar).
const KEYS: Record<keyof AppSettings, string> = {
  onboardingDone: 'onboarding_done',
  feedFilter: 'feed_filter',
  feedSeenUntil: 'feed_seen_until',
  syncIntervalMinutes: 'sync_interval_minutes',
  backgroundSyncEnabled: 'background_sync_enabled',
  notificationsEnabled: 'notifications_enabled',
  developerMode: 'developer_mode',
  recentSearches: 'recent_searches',
  lastSyncAt: 'last_sync_at',
  ftsAvailable: 'fts_available',
};

export async function getSetting<K extends keyof AppSettings>(db: Db, key: K): Promise<AppSettings[K]> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [KEYS[key]]);
  if (!row) return DEFAULT_SETTINGS[key];
  try {
    return JSON.parse(row.value) as AppSettings[K];
  } catch {
    return DEFAULT_SETTINGS[key];
  }
}

export async function setSetting<K extends keyof AppSettings>(db: Db, key: K, value: AppSettings[K]): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [KEYS[key], JSON.stringify(value)]);
}

export async function getAllSettings(db: Db): Promise<AppSettings> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const [name, key] of Object.entries(KEYS)) {
    const raw = byKey.get(key);
    if (raw === undefined) continue;
    try {
      out[name] = JSON.parse(raw);
    } catch {
      // bozuk değer: varsayılan kalır
    }
  }
  return out as unknown as AppSettings;
}
