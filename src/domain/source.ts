export type SourceMode = 'DIRECT_API' | 'PUBLIC_HTML' | 'RSS_OR_FEED' | 'SEARCH_LINK' | 'MANUAL_IMPORT';

export type SourceKind = 'official' | 'private' | 'aggregator';

/**
 * Kaynağın kullanıcıya gösterilen sağlık durumu. `SourceHealth` kaydından türetilir.
 * - ok: son sync başarılı ve beklenen sayıda ilan döndü
 * - degraded: başarılı ama anomali var (örn. 842 → 0)
 * - failing: son deneme(ler) hata verdi
 * - blocked: 403/401 gibi erişim reddi; agresif retry yapılmaz
 * - idle: henüz hiç çalışmadı
 */
export type SourceStatus = 'ok' | 'degraded' | 'failing' | 'blocked' | 'idle';

export interface SourceHealth {
  sourceId: string;
  status: SourceStatus;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastHttpStatus: number | null;
  lastError: string | null;
  lastParsedCount: number | null;
  lastNewCount: number | null;
  lastDurationMs: number | null;
  consecutiveFailures: number;
  /** Anomali açıklaması, örn. "Önceki: 842, şimdi: 0". */
  warning: string | null;
  etag: string | null;
  lastModified: string | null;
  parserVersion: number | null;
}

export interface SourceSettings {
  sourceId: string;
  enabled: boolean;
}

export interface SyncRun {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  trigger: SyncTrigger;
  newCount: number;
  updatedCount: number;
  errorCount: number;
}

export type SyncTrigger = 'manual' | 'foreground' | 'background' | 'onboarding';
