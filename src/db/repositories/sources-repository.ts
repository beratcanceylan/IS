import type { SourceHealth, SourceStatus, SyncRun, SyncTrigger } from '@/domain/source';
import type { Db } from '@/db/types';

interface HealthRow {
  source_id: string;
  status: string;
  last_attempt_at: string | null;
  last_success_at: string | null;
  last_http_status: number | null;
  last_error: string | null;
  last_parsed_count: number | null;
  last_new_count: number | null;
  last_duration_ms: number | null;
  consecutive_failures: number;
  warning: string | null;
  etag: string | null;
  last_modified: string | null;
  parser_version: number | null;
  next_allowed_at: string | null;
}

export interface SourceHealthRecord extends SourceHealth {
  /** Bu zamandan önce kaynağa yeniden istek atılmaz (cooldown / backoff). */
  nextAllowedAt: string | null;
}

function toHealth(r: HealthRow): SourceHealthRecord {
  return {
    sourceId: r.source_id,
    status: r.status as SourceStatus,
    lastAttemptAt: r.last_attempt_at,
    lastSuccessAt: r.last_success_at,
    lastHttpStatus: r.last_http_status,
    lastError: r.last_error,
    lastParsedCount: r.last_parsed_count,
    lastNewCount: r.last_new_count,
    lastDurationMs: r.last_duration_ms,
    consecutiveFailures: r.consecutive_failures,
    warning: r.warning,
    etag: r.etag,
    lastModified: r.last_modified,
    parserVersion: r.parser_version,
    nextAllowedAt: r.next_allowed_at,
  };
}

export function emptyHealth(sourceId: string): SourceHealthRecord {
  return {
    sourceId,
    status: 'idle',
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastHttpStatus: null,
    lastError: null,
    lastParsedCount: null,
    lastNewCount: null,
    lastDurationMs: null,
    consecutiveFailures: 0,
    warning: null,
    etag: null,
    lastModified: null,
    parserVersion: null,
    nextAllowedAt: null,
  };
}

export async function getHealth(db: Db, sourceId: string): Promise<SourceHealthRecord> {
  const row = await db.getFirstAsync<HealthRow>('SELECT * FROM source_health WHERE source_id = ?', [sourceId]);
  return row ? toHealth(row) : emptyHealth(sourceId);
}

export async function getAllHealth(db: Db): Promise<Record<string, SourceHealthRecord>> {
  const rows = await db.getAllAsync<HealthRow>('SELECT * FROM source_health');
  return Object.fromEntries(rows.map((r) => [r.source_id, toHealth(r)]));
}

export async function saveHealth(db: Db, h: SourceHealthRecord): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO source_health (
       source_id, status, last_attempt_at, last_success_at, last_http_status, last_error, last_parsed_count,
       last_new_count, last_duration_ms, consecutive_failures, warning, etag, last_modified, parser_version, next_allowed_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      h.sourceId,
      h.status,
      h.lastAttemptAt,
      h.lastSuccessAt,
      h.lastHttpStatus,
      h.lastError,
      h.lastParsedCount,
      h.lastNewCount,
      h.lastDurationMs,
      h.consecutiveFailures,
      h.warning,
      h.etag,
      h.lastModified,
      h.parserVersion,
      h.nextAllowedAt,
    ],
  );
}

/** Kullanıcının açıp kapattığı kaynaklar. Kaydı olmayan kaynak adapter'ın varsayılanını kullanır. */
export async function getSourceEnabledMap(db: Db): Promise<Record<string, boolean>> {
  const rows = await db.getAllAsync<{ id: string; enabled: number }>('SELECT id, enabled FROM sources');
  return Object.fromEntries(rows.map((r) => [r.id, r.enabled === 1]));
}

export async function setSourceEnabled(db: Db, sourceId: string, enabled: boolean): Promise<void> {
  await db.runAsync(
    `INSERT INTO sources (id, enabled) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled`,
    [sourceId, enabled ? 1 : 0],
  );
}

export async function startSyncRun(db: Db, trigger: SyncTrigger, now: string): Promise<number> {
  const r = await db.runAsync('INSERT INTO sync_runs (started_at, trigger) VALUES (?, ?)', [now, trigger]);
  return r.lastInsertRowId;
}

export async function finishSyncRun(
  db: Db,
  id: number,
  r: { newCount: number; updatedCount: number; errorCount: number; details: unknown },
  now: string,
): Promise<void> {
  await db.runAsync(
    'UPDATE sync_runs SET finished_at = ?, new_count = ?, updated_count = ?, error_count = ?, details_json = ? WHERE id = ?',
    [now, r.newCount, r.updatedCount, r.errorCount, JSON.stringify(r.details), id],
  );
  // Geçmişi sınırlı tut.
  await db.runAsync('DELETE FROM sync_runs WHERE id NOT IN (SELECT id FROM sync_runs ORDER BY id DESC LIMIT 200)');
}

/** Hiçbir kaynağın çalışmadığı (hepsi cooldown'da) senkronlar geçmişi kirletmesin. */
export async function deleteSyncRun(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM sync_runs WHERE id = ?', [id]);
}

export async function listSyncRuns(db: Db, limit = 20): Promise<(SyncRun & { details: unknown })[]> {
  const rows = await db.getAllAsync<{
    id: number;
    started_at: string;
    finished_at: string | null;
    trigger: string;
    new_count: number;
    updated_count: number;
    error_count: number;
    details_json: string | null;
  }>('SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?', [limit]);
  return rows.map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    trigger: r.trigger as SyncTrigger,
    newCount: r.new_count,
    updatedCount: r.updated_count,
    errorCount: r.error_count,
    details: r.details_json ? (JSON.parse(r.details_json) as unknown) : null,
  }));
}
