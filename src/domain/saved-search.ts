import type {
  EducationLevel,
  EmploymentType,
  KpssScoreType,
  PublicEmploymentType,
  WorkModel,
} from './job';

export interface LocationSelection {
  /** Plaka kodu. */
  plate: number;
  /** Boş ise ilin tamamı. */
  districts?: string[];
}

export type PublishedWithin = 'today' | '24h' | '3d' | '7d' | '30d';
export type DeadlineWithin = 'today' | '3d' | '7d' | 'notPassed';
export type KpssFilter = 'any' | 'notRequired' | 'required';
export type ExperienceFilter = 'none' | '0-1' | '1-3' | '3+';
export type SectorFilter = 'all' | 'public' | 'private';

/**
 * Filtre kriterleri. Tüm alanlar opsiyonel: alan yoksa o kritere göre filtrelenmez.
 * Yeni filtre eklemek için buraya opsiyonel alan ekleyip `search/filter-sql.ts`'de
 * karşılığını yazmak yeterli; eski kayıtlı aramalar bozulmaz.
 */
export interface JobFilter {
  locations?: LocationSelection[];
  sources?: string[];
  sourceKind?: 'official' | 'private';
  sector?: SectorFilter;
  publicEmploymentTypes?: PublicEmploymentType[];
  publishedWithin?: PublishedWithin;
  deadlineWithin?: DeadlineWithin;
  educationLevels?: EducationLevel[];
  kpss?: KpssFilter;
  kpssScoreTypes?: KpssScoreType[];
  /** Kullanıcının puanı: ilanın minimum puanı bundan yüksekse elenir. */
  kpssMyScore?: number;
  employmentTypes?: EmploymentType[];
  workModels?: WorkModel[];
  experience?: ExperienceFilter;
  /** Herhangi biri geçmeli (OR). Serbest metin araması için `query` kullanılır. */
  includeKeywords?: string[];
  /** Hiçbiri geçmemeli. */
  excludeKeywords?: string[];
  query?: string;
  includeExpired?: boolean;
  /**
   * true: yalnızca ilgili bilgisi kesin olan ilanlar (örn. eğitim filtresinde eğitimi çözülmüş olanlar).
   * false (varsayılan): bilgisi çıkarılamamış ilanlar da gösterilir. Resmî bir ilanı kaçırmak,
   * fazladan bir ilan görmekten daha kötüdür.
   */
  strict?: boolean;
}

export const FILTER_SCHEMA_VERSION = 1;

export interface SavedSearch {
  id: number;
  name: string;
  filter: JobFilter;
  notify: boolean;
  createdAt: string;
  lastCheckedAt: string | null;
  sortOrder: number;
}

export function isEmptyFilter(f: JobFilter): boolean {
  return countActiveFilters(f) === 0 && !f.query?.trim();
}

export function countActiveFilters(f: JobFilter): number {
  let n = 0;
  if (f.locations?.length) n++;
  if (f.sources?.length || f.sourceKind) n++;
  if (f.sector && f.sector !== 'all') n++;
  if (f.publicEmploymentTypes?.length) n++;
  if (f.publishedWithin) n++;
  if (f.deadlineWithin) n++;
  if (f.educationLevels?.length) n++;
  if ((f.kpss && f.kpss !== 'any') || f.kpssScoreTypes?.length || f.kpssMyScore != null) n++;
  if (f.employmentTypes?.length) n++;
  if (f.workModels?.length) n++;
  if (f.experience) n++;
  if (f.includeKeywords?.length) n++;
  if (f.excludeKeywords?.length) n++;
  return n;
}
