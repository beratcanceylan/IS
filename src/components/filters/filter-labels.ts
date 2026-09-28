import { getProvince } from '@/data/locations';
import type { EducationLevel, EmploymentType, KpssScoreType, PublicEmploymentType, WorkModel } from '@/domain/job';
import type {
  DeadlineWithin,
  ExperienceFilter,
  JobFilter,
  KpssFilter,
  LocationSelection,
  PublishedWithin,
} from '@/domain/saved-search';
import { EDUCATION_LABELS } from '@/extraction/education';
import { getSyncSources } from '@/sources/registry';

import { PUBLIC_TYPE_LABELS } from '../jobs/job-format';

export type FilterCategory =
  | 'location'
  | 'published'
  | 'deadline'
  | 'education'
  | 'kpss'
  | 'publicTypes'
  | 'employment'
  | 'workModel'
  | 'experience'
  | 'keywords'
  | 'sources';

export const FILTER_TITLES: Record<FilterCategory, string> = {
  location: 'Konum',
  published: 'Yayın tarihi',
  deadline: 'Son başvuru',
  education: 'Eğitim',
  kpss: 'KPSS',
  publicTypes: 'Kadro türü',
  employment: 'Çalışma tipi',
  workModel: 'Çalışma modeli',
  experience: 'Deneyim',
  keywords: 'Kelimeler',
  sources: 'Kaynaklar',
};

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const PUBLISHED_OPTIONS: Option<PublishedWithin>[] = [
  { value: 'today', label: 'Bugün' },
  { value: '24h', label: 'Son 24 saat' },
  { value: '3d', label: 'Son 3 gün' },
  { value: '7d', label: 'Son 7 gün' },
  { value: '30d', label: 'Son 30 gün' },
];

export const DEADLINE_OPTIONS: Option<DeadlineWithin>[] = [
  { value: 'today', label: 'Bugün bitiyor' },
  { value: '3d', label: '3 gün içinde bitiyor' },
  { value: '7d', label: '7 gün içinde bitiyor' },
  { value: 'notPassed', label: 'Tarihi geçmemiş' },
];

export const EDUCATION_OPTIONS: Option<EducationLevel>[] = (
  ['primary', 'highSchool', 'associate', 'bachelor', 'master'] as EducationLevel[]
).map((value) => ({ value, label: EDUCATION_LABELS[value] }));

export const KPSS_OPTIONS: Option<KpssFilter>[] = [
  { value: 'any', label: 'Fark etmez' },
  { value: 'notRequired', label: 'KPSS istemeyen' },
  { value: 'required', label: 'KPSS isteyen' },
];

export const KPSS_TYPE_OPTIONS: Option<KpssScoreType>[] = [
  { value: 'P3', label: 'P3 (lisans)' },
  { value: 'P93', label: 'P93 (önlisans)' },
  { value: 'P94', label: 'P94 (ortaöğretim)' },
];

export const PUBLIC_TYPE_OPTIONS: Option<PublicEmploymentType>[] = (
  ['memur', 'contracted', 'permanentWorker', 'temporaryWorker', 'academic', 'expertAssistant', 'contractedIT', 'other'] as PublicEmploymentType[]
).map((value) => ({ value, label: PUBLIC_TYPE_LABELS[value] }));

export const EMPLOYMENT_OPTIONS: Option<EmploymentType>[] = [
  { value: 'fullTime', label: 'Tam zamanlı' },
  { value: 'partTime', label: 'Yarı zamanlı' },
  { value: 'contract', label: 'Sözleşmeli' },
  { value: 'temporary', label: 'Geçici' },
  { value: 'internship', label: 'Staj' },
  { value: 'seasonal', label: 'Sezonluk' },
];

export const WORK_MODEL_OPTIONS: Option<WorkModel>[] = [
  { value: 'onsite', label: 'Ofiste' },
  { value: 'hybrid', label: 'Hibrit' },
  { value: 'remote', label: 'Uzaktan' },
];

export const EXPERIENCE_OPTIONS: Option<ExperienceFilter>[] = [
  { value: 'none', label: 'Deneyimsiz' },
  { value: '0-1', label: '0–1 yıl' },
  { value: '1-3', label: '1–3 yıl' },
  { value: '3+', label: '3 yıl ve üzeri' },
];

export function sourceOptions(): Option<string>[] {
  return getSyncSources()
    .filter((s) => s.id !== 'demo')
    .map((s) => ({ value: s.id, label: s.displayName }));
}

function labelOf<T extends string>(options: Option<T>[], value: T | undefined): string | null {
  return options.find((o) => o.value === value)?.label ?? null;
}

function labelsOf<T extends string>(options: Option<T>[], values: T[] | undefined): string | null {
  if (!values?.length) return null;
  const labels = values.map((v) => options.find((o) => o.value === v)?.label ?? v);
  return labels.length > 2 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ');
}

export function locationSummary(locations: LocationSelection[] | undefined): string {
  if (!locations?.length) return 'Tüm Türkiye';
  const first = getProvince(locations[0].plate);
  if (!first) return 'Tüm Türkiye';
  const firstLabel = locations[0].districts?.length ? `${first.name} (${locations[0].districts.length} ilçe)` : first.name;
  return locations.length > 1 ? `${firstLabel} +${locations.length - 1}` : firstLabel;
}

/** Filtre ekranındaki her kategori için kısa değer özeti. */
export function filterSummaries(f: JobFilter) {
  const kpssParts = [
    f.kpss && f.kpss !== 'any' ? labelOf(KPSS_OPTIONS, f.kpss) : null,
    labelsOf(KPSS_TYPE_OPTIONS, f.kpssScoreTypes)?.replace(/ \([^)]*\)/g, ''),
    f.kpssMyScore != null ? `puanım ${f.kpssMyScore}` : null,
  ].filter(Boolean);
  return {
    location: f.locations?.length ? locationSummary(f.locations) : null,
    sources: labelsOf(sourceOptions(), f.sources),
    publicTypes: labelsOf(PUBLIC_TYPE_OPTIONS, f.publicEmploymentTypes),
    published: labelOf(PUBLISHED_OPTIONS, f.publishedWithin),
    deadline: labelOf(DEADLINE_OPTIONS, f.deadlineWithin),
    education: labelsOf(EDUCATION_OPTIONS, f.educationLevels),
    kpss: kpssParts.length ? kpssParts.join(' · ') : null,
    employment: labelsOf(EMPLOYMENT_OPTIONS, f.employmentTypes),
    workModel: labelsOf(WORK_MODEL_OPTIONS, f.workModels),
    experience: labelOf(EXPERIENCE_OPTIONS, f.experience),
    keywords:
      [f.includeKeywords?.length ? `+${f.includeKeywords.length}` : null, f.excludeKeywords?.length ? `−${f.excludeKeywords.length}` : null]
        .filter(Boolean)
        .join(' ') || null,
  };
}
