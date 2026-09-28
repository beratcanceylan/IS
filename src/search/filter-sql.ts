import { getProvince } from '@/data/locations';
import type { JobFilter } from '@/domain/saved-search';
import type { SqlParams, SqlValue } from '@/db/types';
import { daysAgoIso, startOfIstanbulDay } from '@/utils/dates';
import { normalizeTr } from '@/utils/turkish-normalization';

import { buildFtsQuery, keywordPattern, prefixPattern } from './search-text';

export interface FilterSqlOptions {
  now?: Date;
  /** `sourceKind` filtresi için kaynak id'leri (registry'den gelir; SQL katmanı registry bilmez). */
  sourceIdsByKind?: Record<'official' | 'private', string[]>;
  ftsAvailable: boolean;
}

export interface WhereClause {
  sql: string;
  params: SqlParams;
}

const DAY_MS = 86_400_000;

class WhereBuilder {
  readonly where: string[] = [];
  readonly params: SqlValue[] = [];

  constructor(private readonly strict: boolean) {}

  add(sql: string, ...params: SqlValue[]): void {
    this.where.push(sql);
    this.params.push(...params);
  }

  orUnknown(known: string, unknown: string): string {
    return this.strict ? `(${known})` : `(${known} OR ${unknown})`;
  }

  /** `column IN (...)`; strict değilse bilinmeyen değer de geçer. */
  addIn(column: string, values: readonly SqlValue[], unknown: string): void {
    this.add(this.orUnknown(`${column} IN (${placeholders(values.length)})`, unknown), ...values);
  }

  /** Virgülle kodlanmış liste sütununda herhangi bir değer. */
  addListMatch(column: string, values: readonly string[]): void {
    const likes = values.map(() => `${column} LIKE ?`).join(' OR ');
    this.add(this.orUnknown(likes, `${column} = ''`), ...values.map((v) => `%,${v},%`));
  }
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ');
}

function likeClause(column: string, negate = false): string {
  const operator = negate ? 'NOT LIKE' : 'LIKE';
  return String.raw`${column} ${operator} ? ESCAPE '\'`;
}

function addLifecycle(b: WhereBuilder, filter: JobFilter, nowIso: string): void {
  b.add('NOT EXISTS (SELECT 1 FROM hidden_jobs h WHERE h.job_id = j.id)');
  b.add('(j.duplicate_group_id IS NULL OR j.duplicate_group_id = j.id)');
  if (filter.includeExpired) {
    b.add(`j.lifecycle != 'archived'`);
    return;
  }
  b.add(`j.lifecycle IN ('active', 'possiblyRemoved')`);
  b.add('(j.application_deadline IS NULL OR j.application_deadline >= ?)', nowIso);
}

function addLocations(b: WhereBuilder, filter: JobFilter): void {
  if (!filter.locations?.length) return;
  const parts: string[] = [];
  const params: SqlValue[] = [];
  for (const loc of filter.locations) {
    const province = getProvince(loc.plate);
    if (!province) continue;
    if (loc.districts?.length) {
      // İlçe seçiliyse, ilçesi bilinmeyen ama ili tutan ilanlar da gösterilir (strict değilse).
      const districtSql = `j.district IN (${placeholders(loc.districts.length)})`;
      parts.push(`(j.city = ? AND ${b.orUnknown(districtSql, 'j.district IS NULL')})`);
      params.push(province.name, ...loc.districts);
    } else {
      parts.push('j.city = ?');
      params.push(province.name);
    }
  }
  if (parts.length) b.add(b.orUnknown(parts.join(' OR '), 'j.city IS NULL'), ...params);
}

function addSources(b: WhereBuilder, filter: JobFilter, opts: FilterSqlOptions): void {
  if (filter.sources?.length) {
    b.add(`j.source_id IN (${placeholders(filter.sources.length)})`, ...filter.sources);
  }
  if (!filter.sourceKind || !opts.sourceIdsByKind) return;
  const ids = opts.sourceIdsByKind[filter.sourceKind];
  if (ids.length) b.add(`j.source_id IN (${placeholders(ids.length)})`, ...ids);
  else b.add('0');
}

function addSector(b: WhereBuilder, filter: JobFilter): void {
  // Sektör (bilinmeyen sektör strict değilse iki tarafta da görünür)
  if (filter.sector && filter.sector !== 'all') {
    b.add(b.orUnknown('j.sector = ?', `j.sector = 'unknown'`), filter.sector);
  }
  if (filter.publicEmploymentTypes?.length) {
    b.addIn('j.public_employment_type', filter.publicEmploymentTypes, `(j.public_employment_type IS NULL AND j.sector != 'private')`);
  }
}

const PUBLISHED_DAYS = { '24h': 1, '3d': 3, '7d': 7, '30d': 30 } as const;

function addPublished(b: WhereBuilder, filter: JobFilter, now: Date): void {
  if (!filter.publishedWithin) return;
  const since =
    filter.publishedWithin === 'today'
      ? startOfIstanbulDay(now).toISOString()
      : daysAgoIso(PUBLISHED_DAYS[filter.publishedWithin], now);
  b.add('j.sort_at >= ?', since);
}

function deadlineUntil(within: 'today' | '3d' | '7d', now: Date): Date {
  if (within === 'today') return new Date(startOfIstanbulDay(now).getTime() + DAY_MS - 1);
  const days = within === '3d' ? 3 : 7;
  return new Date(now.getTime() + days * DAY_MS);
}

function addDeadline(b: WhereBuilder, filter: JobFilter, now: Date): void {
  if (!filter.deadlineWithin) return;
  const nowIso = now.toISOString();
  if (filter.deadlineWithin === 'notPassed') {
    b.add(b.orUnknown('j.application_deadline >= ?', 'j.application_deadline IS NULL'), nowIso);
    return;
  }
  const until = deadlineUntil(filter.deadlineWithin, now);
  b.add('(j.application_deadline >= ? AND j.application_deadline <= ?)', nowIso, until.toISOString());
}

function addKpss(b: WhereBuilder, filter: JobFilter): void {
  if (filter.kpss === 'notRequired') {
    b.add(b.orUnknown('j.kpss_required = 0', 'j.kpss_required IS NULL'));
  } else if (filter.kpss === 'required') {
    b.add(b.orUnknown('j.kpss_required = 1', 'j.kpss_required IS NULL'));
  }
  if (filter.kpssScoreTypes?.length) b.addListMatch('j.kpss_score_types', filter.kpssScoreTypes);
  if (filter.kpssMyScore != null) {
    // Puanım ilanın minimum puanından düşükse elenir. Minimumu bilinmeyen ilanlar kalır.
    b.add('(j.kpss_min_score IS NULL OR j.kpss_min_score <= ?)', filter.kpssMyScore);
  }
}

const EXPERIENCE_RANGES = { none: [0, 0], '0-1': [0, 1], '1-3': [1, 3], '3+': [3, 99] } as const;

function addWork(b: WhereBuilder, filter: JobFilter): void {
  if (filter.employmentTypes?.length) b.addIn('j.employment_type', filter.employmentTypes, `j.employment_type = 'unknown'`);
  if (filter.workModels?.length) b.addIn('j.work_model', filter.workModels, `j.work_model = 'unknown'`);
  if (filter.experience) {
    const [min, max] = EXPERIENCE_RANGES[filter.experience];
    b.add(b.orUnknown('j.experience_years_min BETWEEN ? AND ?', 'j.experience_years_min IS NULL'), min, max);
  }
}

function addKeywords(b: WhereBuilder, filter: JobFilter): void {
  // Anahtar kelimeler: dahil edilenler tüm metinde (OR), hariç tutulanlar yalnızca başlık+kurumda.
  const include = (filter.includeKeywords ?? []).map(keywordPattern).filter((k) => k !== null);
  if (include.length) {
    const clauses = include.map((k) => likeClause(k.folded ? 'j.search_folded' : 'j.search_text'));
    b.add(`(${clauses.join(' OR ')})`, ...include.map((k) => k.pattern));
  }
  const exclude = (filter.excludeKeywords ?? []).map(keywordPattern).filter((k) => k !== null);
  for (const k of exclude) {
    b.add(likeClause(k.folded ? 'j.headline_folded' : 'j.headline_norm', true), k.pattern);
  }
}

function addQuery(b: WhereBuilder, filter: JobFilter, opts: FilterSqlOptions): void {
  const q = filter.query?.trim();
  if (!q || !normalizeTr(q)) return;
  const fts = opts.ftsAvailable ? buildFtsQuery(q) : null;
  if (fts) {
    b.add('j.id IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?)', fts);
    return;
  }
  // Türkçe karakter tespiti her token için ayrı yapılır.
  for (const token of q.split(/\s+/).slice(0, 8)) {
    const k = prefixPattern(token);
    if (k) b.add(likeClause(k.folded ? 'j.search_folded' : 'j.search_text'), k.pattern);
  }
}

/**
 * `JobFilter` → SQL WHERE. Tablo takma adı `j` (jobs) olmalıdır.
 *
 * Genel kurallar:
 * - Gizlenen ilanlar ve birincil olmayan duplicate'ler her zaman elenir.
 * - Arşivlenmiş ilanlar gösterilmez; süresi dolanlar yalnızca `includeExpired` ile.
 * - `strict` kapalıyken çıkarılmış alanlarda bilinmeyen (NULL/boş) değerler filtreyi geçer.
 */
export function buildFilterWhere(filter: JobFilter, opts: FilterSqlOptions): WhereClause {
  const now = opts.now ?? new Date();
  const b = new WhereBuilder(filter.strict === true);

  addLifecycle(b, filter, now.toISOString());
  addLocations(b, filter);
  addSources(b, filter, opts);
  addSector(b, filter);
  addPublished(b, filter, now);
  addDeadline(b, filter, now);
  if (filter.educationLevels?.length) b.addListMatch('j.education_levels', filter.educationLevels);
  addKpss(b, filter);
  addWork(b, filter);
  addKeywords(b, filter);
  addQuery(b, filter, opts);

  return { sql: b.where.join('\n  AND '), params: b.params };
}
