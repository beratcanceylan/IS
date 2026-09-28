import type { JobListItem, JobPosting, NormalizedJob } from '@/domain/job';
import type { JobFilter } from '@/domain/saved-search';
import type { Db, SqlValue } from '@/db/types';
import { buildFilterWhere, type FilterSqlOptions } from '@/search/filter-sql';
import { computeFingerprint, similarity, SIMILARITY_THRESHOLD, toDedupInput, type DedupInput } from '@/sync/deduplication';
import { normalizeOrganization } from '@/utils/turkish-normalization';

import { JOB_LIST_COLUMNS, jobContentColumns, rowToJob, rowToListItem, type JobListRow, type JobRow } from './job-rows';

// ---------------------------------------------------------------------------
// Yazma

export interface UpsertOutcome {
  id: number;
  inserted: boolean;
  /** Mevcut ilanın içeriği değişti mi (başlık, son başvuru, detay vb.). */
  changed: boolean;
}

/**
 * Var olan ilanla birleştirme: gelen değer boş/bilinmiyor ise eski değer korunur.
 * Böylece açıklamasız RSS listesi, daha önce detaydan gelmiş açıklamayı silmez.
 */
export function mergeJob(existing: NormalizedJob, incoming: NormalizedJob): NormalizedJob {
  const merged = { ...existing } as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    const empty =
      value === null ||
      value === undefined ||
      value === 'unknown' ||
      (Array.isArray(value) && value.length === 0) ||
      (typeof value === 'string' && value.trim() === '');
    if (!empty) merged[key] = value;
  }
  return merged as unknown as NormalizedJob;
}

const CHANGE_KEYS: (keyof NormalizedJob)[] = ['title', 'organization', 'applicationDeadline', 'description', 'city'];

export async function upsertJob(
  tx: Db,
  incoming: NormalizedJob,
  opts: { now: string; baseline: boolean; detailFetched?: boolean },
): Promise<UpsertOutcome> {
  const existingRow = await tx.getFirstAsync<JobRow>(
    'SELECT * FROM jobs WHERE source_id = ? AND source_external_id = ?',
    [incoming.sourceId, incoming.sourceExternalId],
  );

  if (existingRow) {
    const existing = rowToJob(existingRow);
    const merged = mergeJob(existing, incoming);
    const changed = CHANGE_KEYS.some((k) => existing[k] !== merged[k]);
    const cols = jobContentColumns(merged, derive(merged));
    // Tekrar görünen ilan canlanır; süresi dolmuşsa aşağıdaki expire adımı yeniden işaretler.
    const revive = existing.lifecycle === 'possiblyRemoved' || existing.lifecycle === 'archived';
    const assignments = Object.keys(cols).map((c) => `${c} = ?`);
    const values: SqlValue[] = Object.values(cols);
    assignments.push('sort_at = ?', 'last_seen_at = ?', 'updated_at = ?');
    values.push(sortKey(merged.publishedAt, existing.discoveredAt), opts.now, opts.now);
    if (revive) assignments.push(`lifecycle = 'active'`);
    if (opts.detailFetched) {
      assignments.push('detail_fetched_at = ?');
      values.push(opts.now);
    }
    await tx.runAsync(`UPDATE jobs SET ${assignments.join(', ')} WHERE id = ?`, [...values, existing.id]);
    return { id: existing.id, inserted: false, changed };
  }

  const cols = jobContentColumns(incoming, derive(incoming));
  const all: Record<string, SqlValue> = {
    ...cols,
    source_id: incoming.sourceId,
    source_external_id: incoming.sourceExternalId,
    sort_at: sortKey(incoming.publishedAt, opts.now),
    lifecycle: 'active',
    baseline: opts.baseline ? 1 : 0,
    discovered_at: opts.now,
    last_seen_at: opts.now,
    updated_at: opts.now,
    detail_fetched_at: opts.detailFetched ? opts.now : null,
  };
  const keys = Object.keys(all);
  const result = await tx.runAsync(
    `INSERT INTO jobs (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
    Object.values(all),
  );
  const id = result.lastInsertRowId;
  await assignDuplicateGroup(tx, id, incoming);
  return { id, inserted: true, changed: true };
}

/**
 * Sıralama anahtarı: yayın tarihi; yoksa ya da ileri tarihliyse (bazı kaynaklar ilanı yayından
 * önce listeler) keşif zamanı. Böylece gelecekteki bir tarih listenin tepesine yapışmaz.
 */
function sortKey(publishedAt: string | null, fallback: string): string {
  return publishedAt && publishedAt <= fallback ? publishedAt : fallback;
}

function derive(job: NormalizedJob) {
  return {
    organizationNorm: normalizeOrganization(job.organization),
    fingerprint: computeFingerprint(toDedupInput(job)),
  };
}

interface CandidateRow {
  id: number;
  source_id: string;
  title: string;
  organization: string | null;
  city: string | null;
  district: string | null;
  application_deadline: string | null;
  published_at: string | null;
  quota: number | null;
  canonical_url: string | null;
  duplicate_group_id: number | null;
}

/**
 * Yeni eklenen ilan için kaynaklar arası duplicate arar ve bulursa aynı gruba bağlar.
 * Bir grupta aynı kaynaktan iki ilan bulunamaz (aynı kaynaktaki benzer ilanlar farklı ilanlardır).
 */
export async function assignDuplicateGroup(tx: Db, id: number, job: NormalizedJob): Promise<number | null> {
  const { organizationNorm, fingerprint } = derive(job);
  const candidates = await tx.getAllAsync<CandidateRow>(
    `SELECT id, source_id, title, organization, city, district, application_deadline, published_at, quota,
            canonical_url, duplicate_group_id
       FROM jobs
      WHERE id != ? AND source_id != ? AND lifecycle != 'archived'
        AND (fingerprint = ? OR (organization_norm IS NOT NULL AND organization_norm = ?)
             OR (canonical_url IS NOT NULL AND canonical_url = ?))
      LIMIT 50`,
    [id, job.sourceId, fingerprint, organizationNorm || null, job.canonicalUrl],
  );
  if (!candidates.length) return null;

  const self = toDedupInput(job);
  let best: { row: CandidateRow; score: number } | null = null;
  for (const c of candidates) {
    const exactUrl = job.canonicalUrl !== null && c.canonical_url === job.canonicalUrl;
    const input: DedupInput = {
      sourceId: c.source_id,
      title: c.title,
      organization: c.organization,
      city: c.city,
      district: c.district,
      applicationDeadline: c.application_deadline,
      publishedAt: c.published_at,
      quota: c.quota,
    };
    const score = exactUrl ? 1 : similarity(self, input).score;
    if (score >= SIMILARITY_THRESHOLD && (!best || score > best.score)) best = { row: c, score };
  }
  if (!best) return null;

  const groupId = best.row.duplicate_group_id ?? best.row.id;
  const sameSource = await tx.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM jobs WHERE (duplicate_group_id = ? OR id = ?) AND source_id = ? AND id != ?',
    [groupId, groupId, job.sourceId, id],
  );
  if ((sameSource?.n ?? 0) > 0) return null;

  await tx.runAsync('UPDATE jobs SET duplicate_group_id = ? WHERE id = ? AND duplicate_group_id IS NULL', [groupId, groupId]);
  await tx.runAsync('UPDATE jobs SET duplicate_group_id = ? WHERE id = ?', [groupId, id]);
  return groupId;
}

// ---------------------------------------------------------------------------
// Yaşam döngüsü

/**
 * Kaynağın tam listesi alındıktan sonra, bu senkronda görülmeyen aktif ilanlar
 * "muhtemelen kaldırıldı" olarak işaretlenir. Silinmez.
 */
export async function markMissingAsPossiblyRemoved(tx: Db, sourceId: string, syncStartedAt: string): Promise<number> {
  const r = await tx.runAsync(
    `UPDATE jobs SET lifecycle = 'possiblyRemoved' WHERE source_id = ? AND lifecycle = 'active' AND last_seen_at < ?`,
    [sourceId, syncStartedAt],
  );
  return r.changes;
}

const PERSONAL_REF = `(EXISTS (SELECT 1 FROM favorites f WHERE f.job_id = jobs.id)
  OR EXISTS (SELECT 1 FROM application_status s WHERE s.job_id = jobs.id)
  OR EXISTS (SELECT 1 FROM job_notes n WHERE n.job_id = jobs.id)
  OR EXISTS (SELECT 1 FROM reminders r WHERE r.job_id = jobs.id))`;

export async function applyLifecycleRules(db: Db, now: Date = new Date()): Promise<{ expired: number; archived: number }> {
  const nowIso = now.toISOString();
  const expired = await db.runAsync(
    `UPDATE jobs SET lifecycle = 'expired' WHERE application_deadline IS NOT NULL AND application_deadline < ?
       AND lifecycle IN ('active', 'possiblyRemoved')`,
    [nowIso],
  );
  // 14 gündür görünmeyen ilanlar arşivlenir. Kişisel verisi olanlar ve son başvurusu henüz
  // geçmemiş olanlar hariç (kaynak listeden düşürmüş olsa da başvuru hâlâ açık olabilir).
  const cutoff = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const archived = await db.runAsync(
    `UPDATE jobs SET lifecycle = 'archived' WHERE lifecycle = 'possiblyRemoved' AND last_seen_at < ?
       AND (application_deadline IS NULL OR application_deadline < ?) AND NOT ${PERSONAL_REF}`,
    [cutoff, nowIso],
  );
  return { expired: expired.changes, archived: archived.changes };
}

/** Kişisel verisi olmayan, uzun süredir arşivde/süresi dolmuş ilanları siler. Kullanıcı verisine dokunmaz. */
export async function purgeOldJobs(db: Db, olderThanDays: number, now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanDays * 86_400_000).toISOString();
  return db.transaction(async (tx) => {
    const where = `lifecycle IN ('archived', 'expired') AND last_seen_at < ? AND NOT ${PERSONAL_REF}`;
    await tx.runAsync(`DELETE FROM job_views WHERE job_id IN (SELECT id FROM jobs WHERE ${where})`, [cutoff]);
    await tx.runAsync(`DELETE FROM hidden_jobs WHERE job_id IN (SELECT id FROM jobs WHERE ${where})`, [cutoff]);
    // Silinecek ilan bir grubun birincilse grup bağlantısı kaldırılır.
    await tx.runAsync(
      `UPDATE jobs SET duplicate_group_id = NULL WHERE duplicate_group_id IN (SELECT id FROM jobs WHERE ${where})`,
      [cutoff],
    );
    const r = await tx.runAsync(`DELETE FROM jobs WHERE ${where}`, [cutoff]);
    return r.changes;
  });
}

// ---------------------------------------------------------------------------
// Okuma

export interface FeedCursor {
  isNew: boolean;
  sortAt: string;
  id: number;
}

export interface FeedQuery {
  filter: JobFilter;
  /** Bu tarihten sonra bulunan (baseline olmayan) ilanlar "yeni" sayılır ve üstte gösterilir. */
  newSince: string;
  cursor?: FeedCursor | null;
  limit?: number;
  sql: FilterSqlOptions;
}

export interface FeedPage {
  items: JobListItem[];
  nextCursor: FeedCursor | null;
}

export async function queryFeed(db: Db, q: FeedQuery): Promise<FeedPage> {
  const limit = q.limit ?? 40;
  const where = buildFilterWhere(q.filter, q.sql);
  const params: SqlValue[] = [q.newSince, ...where.params];
  let cursorSql = '';
  if (q.cursor) {
    const n = q.cursor.isNew ? 1 : 0;
    cursorSql = `AND (is_new < ? OR (is_new = ? AND (j.sort_at < ? OR (j.sort_at = ? AND j.id < ?))))`;
    params.push(n, n, q.cursor.sortAt, q.cursor.sortAt, q.cursor.id);
  }
  params.push(limit + 1);
  // `is_new` WHERE'de kullanılabilsin diye alt sorgu.
  const rows = await db.getAllAsync<JobListRow>(
    `SELECT * FROM (
       SELECT ${JOB_LIST_COLUMNS}, (j.baseline = 0 AND j.discovered_at > ?) AS is_new
         FROM jobs j
        WHERE ${where.sql}
     ) j
     WHERE 1 ${cursorSql}
     ORDER BY is_new DESC, j.sort_at DESC, j.id DESC
     LIMIT ?`,
    params,
  );
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(rowToListItem);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? { isNew: last.isNew, sortAt: last.sortAt, id: last.id } : null,
  };
}

export async function countFeed(db: Db, filter: JobFilter, sql: FilterSqlOptions): Promise<number> {
  const where = buildFilterWhere(filter, sql);
  const row = await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM jobs j WHERE ${where.sql}`, where.params);
  return row?.n ?? 0;
}

export async function countNew(db: Db, filter: JobFilter, newSince: string, sql: FilterSqlOptions): Promise<number> {
  const where = buildFilterWhere(filter, sql);
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jobs j WHERE ${where.sql} AND j.baseline = 0 AND j.discovered_at > ?`,
    [...where.params, newSince],
  );
  return row?.n ?? 0;
}

/** Verilen id'lerden filtreye uyanlar (kayıtlı arama bildirimi için). */
export async function filterJobIds(db: Db, filter: JobFilter, ids: number[], sql: FilterSqlOptions): Promise<number[]> {
  if (!ids.length) return [];
  const where = buildFilterWhere(filter, sql);
  const out: number[] = [];
  // SQLite parametre limitine takılmamak için parçalar halinde.
  for (let i = 0; i < ids.length; i += 400) {
    const chunk = ids.slice(i, i + 400);
    const rows = await db.getAllAsync<{ id: number }>(
      `SELECT j.id FROM jobs j WHERE ${where.sql} AND j.id IN (${chunk.map(() => '?').join(', ')})`,
      [...where.params, ...chunk],
    );
    out.push(...rows.map((r) => r.id));
  }
  return out;
}

export async function getJob(db: Db, id: number): Promise<JobPosting | null> {
  const row = await db.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE id = ?', [id]);
  return row ? rowToJob(row) : null;
}

export async function getJobsByIds(db: Db, ids: number[]): Promise<JobListItem[]> {
  if (!ids.length) return [];
  const rows = await db.getAllAsync<JobListRow>(
    `SELECT ${JOB_LIST_COLUMNS}, 0 AS is_new FROM jobs j WHERE j.id IN (${ids.map(() => '?').join(', ')})
      ORDER BY j.sort_at DESC`,
    ids,
  );
  return rows.map(rowToListItem);
}

export interface DuplicateMember {
  id: number;
  sourceId: string;
  sourceUrl: string;
  title: string;
}

/** Aynı ilanın diğer kaynaklardaki kopyaları (kendisi hariç). */
export async function getDuplicateMembers(db: Db, job: Pick<JobPosting, 'id' | 'duplicateGroupId'>): Promise<DuplicateMember[]> {
  if (job.duplicateGroupId === null) return [];
  const rows = await db.getAllAsync<{ id: number; source_id: string; source_url: string; title: string }>(
    `SELECT id, source_id, source_url, title FROM jobs
      WHERE (duplicate_group_id = ? OR id = ?) AND id != ? ORDER BY id`,
    [job.duplicateGroupId, job.duplicateGroupId, job.id],
  );
  return rows.map((r) => ({ id: r.id, sourceId: r.source_id, sourceUrl: r.source_url, title: r.title }));
}

/** Detayı hiç çekilmemiş veya eski parser ile çekilmiş aktif ilanlar. */
export async function jobsNeedingDetails(
  db: Db,
  sourceId: string,
  parserVersion: number,
  limit: number,
): Promise<{ id: number; sourceExternalId: string; sourceUrl: string }[]> {
  const rows = await db.getAllAsync<{ id: number; source_external_id: string; source_url: string }>(
    `SELECT id, source_external_id, source_url FROM jobs
      WHERE source_id = ? AND lifecycle = 'active' AND (detail_fetched_at IS NULL OR parser_version < ?)
      ORDER BY discovered_at DESC LIMIT ?`,
    [sourceId, parserVersion, limit],
  );
  return rows.map((r) => ({ id: r.id, sourceExternalId: r.source_external_id, sourceUrl: r.source_url }));
}

export async function getJobRowForSource(db: Db, sourceId: string, externalId: string): Promise<JobPosting | null> {
  const row = await db.getFirstAsync<JobRow>('SELECT * FROM jobs WHERE source_id = ? AND source_external_id = ?', [
    sourceId,
    externalId,
  ]);
  return row ? rowToJob(row) : null;
}

export async function countActiveBySource(db: Db): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ source_id: string; n: number }>(
    `SELECT source_id, COUNT(*) AS n FROM jobs WHERE lifecycle IN ('active', 'possiblyRemoved') GROUP BY source_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.source_id, r.n]));
}

export interface DbStats {
  total: number;
  byLifecycle: Record<string, number>;
  duplicateGroups: number;
  withDetails: number;
}

export async function getDbStats(db: Db): Promise<DbStats> {
  const lifecycle = await db.getAllAsync<{ lifecycle: string; n: number }>(
    'SELECT lifecycle, COUNT(*) AS n FROM jobs GROUP BY lifecycle',
  );
  const groups = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(DISTINCT duplicate_group_id) AS n FROM jobs WHERE duplicate_group_id IS NOT NULL',
  );
  const details = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM jobs WHERE detail_fetched_at IS NOT NULL');
  const byLifecycle = Object.fromEntries(lifecycle.map((r) => [r.lifecycle, r.n]));
  return {
    total: lifecycle.reduce((a, r) => a + r.n, 0),
    byLifecycle,
    duplicateGroups: groups?.n ?? 0,
    withDetails: details?.n ?? 0,
  };
}

export async function markViewed(db: Db, jobId: number, now: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO job_views (job_id, first_viewed_at) VALUES (?, ?)', [jobId, now]);
}

/** Geliştirici: tüm fingerprint'leri ve grupları yeniden hesaplar. */
export async function rebuildFingerprints(db: Db): Promise<{ jobs: number; groups: number }> {
  return db.transaction(async (tx) => {
    const rows = await tx.getAllAsync<JobRow>(`SELECT * FROM jobs WHERE lifecycle != 'archived' ORDER BY id`);
    await tx.runAsync('UPDATE jobs SET duplicate_group_id = NULL');
    for (const row of rows) {
      const job = rowToJob(row);
      const { fingerprint, organizationNorm } = derive(job);
      await tx.runAsync('UPDATE jobs SET fingerprint = ?, organization_norm = ? WHERE id = ?', [
        fingerprint,
        organizationNorm || null,
        job.id,
      ]);
      await assignDuplicateGroup(tx, job.id, job);
    }
    const groups = await tx.getFirstAsync<{ n: number }>(
      'SELECT COUNT(DISTINCT duplicate_group_id) AS n FROM jobs WHERE duplicate_group_id IS NOT NULL',
    );
    return { jobs: rows.length, groups: groups?.n ?? 0 };
  });
}
