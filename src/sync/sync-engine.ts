import { applyLifecycleRules, jobsNeedingDetails, markMissingAsPossiblyRemoved, upsertJob } from '@/db/repositories/jobs-repository';
import { setSetting } from '@/db/repositories/settings-repository';
import {
  deleteSyncRun,
  finishSyncRun,
  getHealth,
  getSourceEnabledMap,
  saveHealth,
  startSyncRun,
  type SourceHealthRecord,
} from '@/db/repositories/sources-repository';
import type { Db } from '@/db/types';
import type { SyncTrigger } from '@/domain/source';
import { enrichFromText } from '@/extraction';
import { getSyncSources, isSourceEnabled } from '@/sources/registry';
import type { ListingContext, SyncSourceAdapter } from '@/sources/types';
import { HttpClient, HttpError } from '@/utils/network';

/**
 * Senkron motoru. Akış (kaynak başına):
 * 1. Cooldown / backoff kontrolü (kaynağı gereksiz yere vurmamak için)
 * 2. Liste çekimi → normalize → metinden alan çıkarımı
 * 3. Tek transaction'da upsert (+ dedup), tam listelerde görünmeyenleri "muhtemelen kaldırıldı" yap
 * 4. Anomali tespiti (önceki 842 → şimdi 0 gibi)
 * 5. Detay çekimi (bütçeli, her ilan kendi küçük transaction'ında)
 * 6. Kaynak sağlığını kaydet
 * Bir kaynağın hatası diğerlerini etkilemez.
 */

export interface SourceSyncReport {
  sourceId: string;
  outcome: 'ok' | 'notModified' | 'skipped' | 'error';
  skippedReason?: 'cooldown' | 'backoff' | 'disabled';
  parsed: number;
  insertedIds: number[];
  /** Baseline olmayan (bildirim/yeni sayılabilecek) yeni ilanlar. */
  newIds: number[];
  updated: number;
  detailsFetched: number;
  detailErrors: number;
  httpStatus: number | null;
  error: string | null;
  warning: string | null;
  durationMs: number;
}

export interface SyncReport {
  runId: number;
  trigger: SyncTrigger;
  startedAt: string;
  finishedAt: string;
  sources: SourceSyncReport[];
  newJobIds: number[];
}

export interface SyncOptions {
  trigger: SyncTrigger;
  /** Cooldown'u yok say (kullanıcı elle yeniledi). Engellenmiş / 429 kaynaklara yine istek atılmaz. */
  force?: boolean;
  sourceIds?: string[];
  now?: () => Date;
  concurrency?: number;
  httpFactory?: (adapter: SyncSourceAdapter) => HttpClient;
  onSourceDone?: (report: SourceSyncReport) => void;
  sources?: SyncSourceAdapter[];
}

const MINUTE = 60_000;
const BLOCKED_COOLDOWN_MS = 24 * 60 * MINUTE;
const MAX_BACKOFF_MS = 12 * 60 * MINUTE;

export async function runSync(db: Db, opts: SyncOptions): Promise<SyncReport> {
  const now = opts.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const runId = await startSyncRun(db, opts.trigger, startedAt);
  const enabledMap = await getSourceEnabledMap(db);
  const all = opts.sources ?? getSyncSources();
  const targets = all.filter((s) => (opts.sourceIds ? opts.sourceIds.includes(s.id) : isSourceEnabled(s, enabledMap)));

  const reports: SourceSyncReport[] = [];
  await runPool(targets, opts.concurrency ?? 2, async (adapter) => {
    const report = await syncSource(db, adapter, opts, now);
    reports.push(report);
    opts.onSourceDone?.(report);
  });

  await applyLifecycleRules(db, now());
  const finishedAt = now().toISOString();
  const newJobIds = reports.flatMap((r) => r.newIds);
  if (reports.every((r) => r.outcome === 'skipped')) {
    await deleteSyncRun(db, runId);
    return { runId, trigger: opts.trigger, startedAt, finishedAt, sources: reports, newJobIds };
  }
  await finishSyncRun(
    db,
    runId,
    {
      newCount: newJobIds.length,
      updatedCount: reports.reduce((a, r) => a + r.updated, 0),
      errorCount: reports.filter((r) => r.outcome === 'error').length,
      details: reports.map(({ insertedIds: _i, newIds: _n, ...rest }) => rest),
    },
    finishedAt,
  );
  if (reports.some((r) => r.outcome === 'ok' || r.outcome === 'notModified')) {
    await setSetting(db, 'lastSyncAt', finishedAt);
  }
  return { runId, trigger: opts.trigger, startedAt, finishedAt, sources: reports, newJobIds };
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
      await worker(item);
    }
  });
  await Promise.all(runners);
}

function emptyReport(sourceId: string): SourceSyncReport {
  return {
    sourceId,
    outcome: 'skipped',
    parsed: 0,
    insertedIds: [],
    newIds: [],
    updated: 0,
    detailsFetched: 0,
    detailErrors: 0,
    httpStatus: null,
    error: null,
    warning: null,
    durationMs: 0,
  };
}

/** Kaynağa şimdi istek atılabilir mi? */
export function checkCooldown(
  health: SourceHealthRecord,
  adapter: SyncSourceAdapter,
  nowMs: number,
  force: boolean,
): SourceSyncReport['skippedReason'] | null {
  // Engellenmiş veya 429 almış kaynak, elle yenilemede bile dinlendirilir.
  if (health.nextAllowedAt && Date.parse(health.nextAllowedAt) > nowMs) {
    if (!force || health.status === 'blocked' || health.lastHttpStatus === 429) return 'backoff';
  }
  if (!force && health.lastSuccessAt && Date.parse(health.lastSuccessAt) + adapter.minIntervalMinutes * MINUTE > nowMs) {
    return 'cooldown';
  }
  return null;
}

/**
 * Anomali: kaynak normalde onlarca ilan döndürürken birden sıfıra veya çok aza düştüyse
 * bu büyük olasılıkla parser/format sorunudur ve başarı sayılmamalıdır.
 */
export function detectAnomaly(previousCount: number | null, newCount: number, expectedMin: number): string | null {
  const baseline = previousCount ?? expectedMin;
  if (newCount === 0 && baseline >= expectedMin && expectedMin > 0) {
    return `Kaynak hiç ilan döndürmedi (önceki: ${previousCount ?? '—'}, beklenen en az: ${expectedMin}). Parser kontrol edilmeli.`;
  }
  if (previousCount !== null && previousCount >= 20 && newCount < previousCount * 0.2) {
    return `İlan sayısı olağandışı düştü (önceki: ${previousCount}, şimdi: ${newCount}).`;
  }
  return null;
}

async function syncSource(
  db: Db,
  adapter: SyncSourceAdapter,
  opts: SyncOptions,
  now: () => Date,
): Promise<SourceSyncReport> {
  const report = emptyReport(adapter.id);
  const health = await getHealth(db, adapter.id);
  const started = now();
  const skip = checkCooldown(health, adapter, started.getTime(), opts.force === true);
  if (skip) {
    report.skippedReason = skip;
    return report;
  }

  const http = opts.httpFactory?.(adapter) ?? new HttpClient({ minDelayMs: adapter.requestDelayMs });
  const ctx: ListingContext = { http, now: started, etag: health.etag, lastModified: health.lastModified };
  const next: SourceHealthRecord = { ...health, lastAttemptAt: started.toISOString(), parserVersion: adapter.parserVersion };

  try {
    const listing = await adapter.fetchListings(ctx);
    report.httpStatus = listing.httpStatus;
    next.lastHttpStatus = listing.httpStatus;
    next.etag = listing.etag;
    next.lastModified = listing.lastModified;

    if (listing.notModified) {
      report.outcome = 'notModified';
    } else {
      const jobs = listing.jobs.map(enrichFromText);
      report.parsed = jobs.length;
      const warning = detectAnomaly(health.lastParsedCount, jobs.length, adapter.expectedMinCount);
      const baseline = health.lastSuccessAt === null;
      const nowIso = started.toISOString();

      await db.transaction(async (tx) => {
        for (const job of jobs) {
          const r = await upsertJob(tx, job, { now: nowIso, baseline });
          if (r.inserted) {
            report.insertedIds.push(r.id);
            if (!baseline) report.newIds.push(r.id);
          } else if (r.changed) {
            report.updated++;
          }
        }
        // Anomali varken "görünmeyenleri kaldır" adımı atlanır; boş bir yanıt tüm ilanları silmemeli.
        if (listing.complete && !warning) {
          await markMissingAsPossiblyRemoved(tx, adapter.id, nowIso);
        }
      });

      report.warning = warning;
      next.warning = warning;
      next.lastParsedCount = jobs.length;
      report.outcome = 'ok';
    }

    if (adapter.fetchDetails) await fetchDetails(db, adapter, ctx, report, now);

    next.status = report.warning ? 'degraded' : 'ok';
    next.lastSuccessAt = now().toISOString();
    next.lastError = report.detailErrors ? `${report.detailErrors} ilanın detayı alınamadı` : null;
    next.consecutiveFailures = 0;
    next.nextAllowedAt = null;
    next.lastNewCount = report.newIds.length;
  } catch (error) {
    report.outcome = 'error';
    report.error = describeError(error);
    next.lastError = report.error;
    next.consecutiveFailures = health.consecutiveFailures + 1;
    const nowMs = now().getTime();
    if (error instanceof HttpError) {
      report.httpStatus = error.status;
      next.lastHttpStatus = error.status;
      if (error.kind === 'blocked') {
        next.status = 'blocked';
        next.nextAllowedAt = new Date(nowMs + BLOCKED_COOLDOWN_MS).toISOString();
      } else if (error.kind === 'rateLimited') {
        next.status = 'failing';
        next.nextAllowedAt = new Date(nowMs + (error.retryAfterMs ?? 60 * MINUTE)).toISOString();
      } else {
        next.status = 'failing';
        next.nextAllowedAt = new Date(nowMs + backoffMs(next.consecutiveFailures)).toISOString();
      }
    } else {
      // Parser / format hatası: kaynak cevap veriyor ama beklenen yapı yok.
      next.status = 'failing';
      next.warning = 'Parser kontrol edilmeli';
      next.nextAllowedAt = new Date(nowMs + backoffMs(next.consecutiveFailures)).toISOString();
    }
  } finally {
    report.durationMs = now().getTime() - started.getTime();
    next.lastDurationMs = report.durationMs;
    await saveHealth(db, next);
  }
  return report;
}

/** 10 dk, 20 dk, 40 dk ... en fazla 12 saat. */
export function backoffMs(failures: number): number {
  return Math.min(MAX_BACKOFF_MS, 10 * MINUTE * 2 ** Math.max(0, failures - 1));
}

async function fetchDetails(
  db: Db,
  adapter: SyncSourceAdapter,
  ctx: ListingContext,
  report: SourceSyncReport,
  now: () => Date,
): Promise<void> {
  const fetchDetail = adapter.fetchDetails;
  if (!fetchDetail) return;
  const targets = await jobsNeedingDetails(db, adapter.id, adapter.parserVersion, adapter.detailBudget ?? 20);
  for (const target of targets) {
    try {
      const detail = await fetchDetail(ctx, target);
      const nowIso = now().toISOString();
      if (!detail) {
        // Kaynak ilanı artık sunmuyor; tekrar tekrar sorulmasın.
        await db.runAsync('UPDATE jobs SET detail_fetched_at = ? WHERE id = ?', [nowIso, target.id]);
        continue;
      }
      await db.transaction((tx) => upsertJob(tx, enrichFromText(detail), { now: nowIso, baseline: false, detailFetched: true }));
      report.detailsFetched++;
    } catch (error) {
      report.detailErrors++;
      // Erişim reddi veya hız sınırı: bu senkronda detay çekmeyi bırak.
      if (error instanceof HttpError && (error.kind === 'blocked' || error.kind === 'rateLimited')) break;
      if (report.detailErrors >= 5) break;
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const prefix = error.name === 'Error' ? '' : `${error.name}: `;
    return prefix + error.message;
  }
  return String(error);
}
