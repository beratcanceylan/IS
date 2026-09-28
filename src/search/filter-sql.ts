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
  const nowIso = now.toISOString();
  const where: string[] = [];
  const params: SqlValue[] = [];
  const strict = filter.strict === true;
  const orUnknown = (known: string, unknown: string) => (strict ? `(${known})` : `(${known} OR ${unknown})`);
  const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

  where.push('NOT EXISTS (SELECT 1 FROM hidden_jobs h WHERE h.job_id = j.id)', '(j.duplicate_group_id IS NULL OR j.duplicate_group_id = j.id)');
  if (filter.includeExpired) {
    where.push(`j.lifecycle != 'archived'`);
  } else {
    where.push(`j.lifecycle IN ('active', 'possiblyRemoved')`, '(j.application_deadline IS NULL OR j.application_deadline >= ?)');
    params.push(nowIso);
  }

  // Konum
  if (filter.locations?.length) {
    const parts: string[] = [];
    for (const loc of filter.locations) {
      const province = getProvince(loc.plate);
      if (!province) continue;
      if (loc.districts?.length) {
        // İlçe seçiliyse, ilçesi bilinmeyen ama ili tutan ilanlar da gösterilir (strict değilse).
        const districtSql = `j.district IN (${placeholders(loc.districts.length)})`;
        parts.push(`(j.city = ? AND ${orUnknown(districtSql, 'j.district IS NULL')})`);
        params.push(province.name, ...loc.districts);
      } else {
        parts.push('j.city = ?');
        params.push(province.name);
      }
    }
    if (parts.length) where.push(orUnknown(parts.join(' OR '), 'j.city IS NULL'));
  }

  // Kaynak
  if (filter.sources?.length) {
    where.push(`j.source_id IN (${placeholders(filter.sources.length)})`);
    params.push(...filter.sources);
  }
  if (filter.sourceKind && opts.sourceIdsByKind) {
    const ids = opts.sourceIdsByKind[filter.sourceKind];
    if (ids.length) {
      where.push(`j.source_id IN (${placeholders(ids.length)})`);
      params.push(...ids);
    } else {
      where.push('0');
    }
  }

  // Sektör (bilinmeyen sektör strict değilse iki tarafta da görünür)
  if (filter.sector && filter.sector !== 'all') {
    where.push(orUnknown('j.sector = ?', `j.sector = 'unknown'`));
    params.push(filter.sector);
  }

  if (filter.publicEmploymentTypes?.length) {
    where.push(
      orUnknown(
        `j.public_employment_type IN (${placeholders(filter.publicEmploymentTypes.length)})`,
        `(j.public_employment_type IS NULL AND j.sector != 'private')`,
      ),
    );
    params.push(...filter.publicEmploymentTypes);
  }

  // Yayın tarihi
  if (filter.publishedWithin) {
    const since =
      filter.publishedWithin === 'today'
        ? startOfIstanbulDay(now).toISOString()
        : daysAgoIso({ '24h': 1, '3d': 3, '7d': 7, '30d': 30 }[filter.publishedWithin], now);
    where.push('j.sort_at >= ?');
    params.push(since);
  }

  // Son başvuru
  if (filter.deadlineWithin) {
    if (filter.deadlineWithin === 'notPassed') {
      where.push(orUnknown('j.application_deadline >= ?', 'j.application_deadline IS NULL'));
      params.push(nowIso);
    } else {
      const until =
        filter.deadlineWithin === 'today'
          ? new Date(startOfIstanbulDay(now).getTime() + DAY_MS - 1)
          : new Date(now.getTime() + (filter.deadlineWithin === '3d' ? 3 : 7) * DAY_MS);
      where.push('(j.application_deadline >= ? AND j.application_deadline <= ?)');
      params.push(nowIso, until.toISOString());
    }
  }

  // Eğitim
  if (filter.educationLevels?.length) {
    const likes = filter.educationLevels.map(() => `j.education_levels LIKE ?`).join(' OR ');
    where.push(orUnknown(likes, `j.education_levels = ''`));
    params.push(...filter.educationLevels.map((l) => `%,${l},%`));
  }

  // KPSS
  if (filter.kpss === 'notRequired') {
    where.push(orUnknown('j.kpss_required = 0', 'j.kpss_required IS NULL'));
  } else if (filter.kpss === 'required') {
    where.push(orUnknown('j.kpss_required = 1', 'j.kpss_required IS NULL'));
  }
  if (filter.kpssScoreTypes?.length) {
    const likes = filter.kpssScoreTypes.map(() => 'j.kpss_score_types LIKE ?').join(' OR ');
    where.push(orUnknown(likes, `j.kpss_score_types = ''`));
    params.push(...filter.kpssScoreTypes.map((t) => `%,${t},%`));
  }
  if (filter.kpssMyScore != null) {
    // Puanım ilanın minimum puanından düşükse elenir. Minimumu bilinmeyen ilanlar kalır.
    where.push('(j.kpss_min_score IS NULL OR j.kpss_min_score <= ?)');
    params.push(filter.kpssMyScore);
  }

  if (filter.employmentTypes?.length) {
    where.push(orUnknown(`j.employment_type IN (${placeholders(filter.employmentTypes.length)})`, `j.employment_type = 'unknown'`));
    params.push(...filter.employmentTypes);
  }

  if (filter.workModels?.length) {
    where.push(orUnknown(`j.work_model IN (${placeholders(filter.workModels.length)})`, `j.work_model = 'unknown'`));
    params.push(...filter.workModels);
  }

  if (filter.experience) {
    const range = { none: [0, 0], '0-1': [0, 1], '1-3': [1, 3], '3+': [3, 99] }[filter.experience];
    where.push(orUnknown('j.experience_years_min BETWEEN ? AND ?', 'j.experience_years_min IS NULL'));
    params.push(range[0], range[1]);
  }

  // Anahtar kelimeler: dahil edilenler tüm metinde (OR), hariç tutulanlar yalnızca başlık+kurumda.
  const include = (filter.includeKeywords ?? []).map(keywordPattern).filter((k) => k !== null);
  if (include.length) {
    where.push(`(${include.map((k) => (k.folded ? 'j.search_folded' : 'j.search_text') + String.raw` LIKE ? ESCAPE '\'`).join(' OR ')})`);
    params.push(...include.map((k) => k.pattern));
  }
  const exclude = (filter.excludeKeywords ?? []).map(keywordPattern).filter((k) => k !== null);
  for (const k of exclude) {
    where.push(String.raw`${k.folded ? 'j.headline_folded' : 'j.headline_norm'} NOT LIKE ? ESCAPE '\'`);
    params.push(k.pattern);
  }

  // Serbest metin
  const q = filter.query?.trim();
  if (q && normalizeTr(q)) {
    const fts = opts.ftsAvailable ? buildFtsQuery(q) : null;
    if (fts) {
      where.push('j.id IN (SELECT rowid FROM jobs_fts WHERE jobs_fts MATCH ?)');
      params.push(fts);
    } else {
      // Türkçe karakter tespiti her token için ayrı yapılır.
      for (const token of q.split(/\s+/).slice(0, 8)) {
        const k = prefixPattern(token);
        if (!k) continue;
        where.push(String.raw`${k.folded ? 'j.search_folded' : 'j.search_text'} LIKE ? ESCAPE '\'`);
        params.push(k.pattern);
      }
    }
  }

  return { sql: where.join('\n  AND '), params };
}
