import type {
  ApplicationMethod,
  EducationLevel,
  EmploymentType,
  JobLifecycle,
  JobListItem,
  JobPosting,
  KpssScoreType,
  NormalizedJob,
  PersonalStatus,
  PublicEmploymentType,
  Sector,
  WorkModel,
} from '@/domain/job';
import type { SqlValue } from '@/db/types';
import { buildSearchColumns } from '@/search/search-text';

/** Çok değerli alanlar ",a,b," biçiminde saklanır. */
export function encodeList(values: readonly string[]): string {
  return values.length ? `,${values.join(',')},` : '';
}

export function decodeList<T extends string>(value: string | null): T[] {
  return value ? (value.split(',').filter(Boolean) as T[]) : [];
}

function bool(value: number | null): boolean | null {
  return value === null ? null : value === 1;
}

export interface JobRow {
  id: number;
  source_id: string;
  source_external_id: string;
  source_url: string;
  canonical_url: string | null;
  title: string;
  organization: string | null;
  organization_norm: string | null;
  department: string | null;
  profession: string | null;
  sector: string;
  employment_category: string | null;
  public_employment_type: string | null;
  employment_type: string;
  work_model: string;
  description: string | null;
  requirements: string | null;
  summary: string | null;
  city: string | null;
  district: string | null;
  location_text: string | null;
  published_at: string | null;
  application_start_at: string | null;
  application_deadline: string | null;
  exam_date: string | null;
  sort_at: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_text: string | null;
  education_levels: string;
  experience_text: string | null;
  experience_years_min: number | null;
  age_min: number | null;
  age_max: number | null;
  kpss_required: number | null;
  kpss_score_types: string;
  kpss_min_score: number | null;
  kpss_year: number | null;
  gender_requirement: string | null;
  military_requirement: string | null;
  driver_license_requirement: string | null;
  foreign_language_requirement: string | null;
  quota: number | null;
  legal_status: string | null;
  application_method: string;
  application_url: string | null;
  application_platform: string | null;
  raw_source_data: string | null;
  parser_version: number;
  fingerprint: string;
  duplicate_group_id: number | null;
  lifecycle: string;
  baseline: number;
  discovered_at: string;
  last_seen_at: string;
  detail_fetched_at: string | null;
  updated_at: string;
}

export function rowToJob(r: JobRow): JobPosting {
  return {
    id: r.id,
    sourceId: r.source_id,
    sourceExternalId: r.source_external_id,
    sourceUrl: r.source_url,
    canonicalUrl: r.canonical_url,
    title: r.title,
    organization: r.organization,
    organizationNormalized: r.organization_norm,
    department: r.department,
    profession: r.profession,
    sector: r.sector as Sector,
    employmentCategory: r.employment_category,
    publicEmploymentType: r.public_employment_type as PublicEmploymentType | null,
    employmentType: r.employment_type as EmploymentType,
    workModel: r.work_model as WorkModel,
    description: r.description,
    requirements: r.requirements,
    summary: r.summary,
    city: r.city,
    district: r.district,
    locationText: r.location_text,
    publishedAt: r.published_at,
    applicationStartAt: r.application_start_at,
    applicationDeadline: r.application_deadline,
    examDate: r.exam_date,
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    salaryText: r.salary_text,
    educationLevels: decodeList<EducationLevel>(r.education_levels),
    experienceText: r.experience_text,
    experienceYearsMin: r.experience_years_min,
    ageMin: r.age_min,
    ageMax: r.age_max,
    kpssRequired: bool(r.kpss_required),
    kpssScoreTypes: decodeList<KpssScoreType>(r.kpss_score_types),
    kpssMinimumScore: r.kpss_min_score,
    kpssYear: r.kpss_year,
    genderRequirement: r.gender_requirement,
    militaryRequirement: r.military_requirement,
    driverLicenseRequirement: r.driver_license_requirement,
    foreignLanguageRequirement: r.foreign_language_requirement,
    quota: r.quota,
    legalStatus: r.legal_status,
    applicationMethod: r.application_method as ApplicationMethod,
    applicationUrl: r.application_url,
    applicationPlatform: r.application_platform,
    rawSourceData: r.raw_source_data,
    parserVersion: r.parser_version,
    fingerprint: r.fingerprint,
    duplicateGroupId: r.duplicate_group_id,
    lifecycle: r.lifecycle as JobLifecycle,
    discoveredAt: r.discovered_at,
    lastSeenAt: r.last_seen_at,
    detailFetchedAt: r.detail_fetched_at,
  };
}

/** INSERT/UPDATE için kolon → değer. Kimlik, yaşam döngüsü ve zaman alanları çağıran tarafından eklenir. */
export function jobContentColumns(job: NormalizedJob, derived: { organizationNorm: string; fingerprint: string }): Record<string, SqlValue> {
  const search = buildSearchColumns(job);
  return {
    source_url: job.sourceUrl,
    canonical_url: job.canonicalUrl,
    title: job.title,
    organization: job.organization,
    organization_norm: derived.organizationNorm || null,
    department: job.department,
    profession: job.profession,
    sector: job.sector,
    employment_category: job.employmentCategory,
    public_employment_type: job.publicEmploymentType,
    employment_type: job.employmentType,
    work_model: job.workModel,
    description: job.description,
    requirements: job.requirements,
    summary: job.summary,
    city: job.city,
    district: job.district,
    location_text: job.locationText,
    published_at: job.publishedAt,
    application_start_at: job.applicationStartAt,
    application_deadline: job.applicationDeadline,
    exam_date: job.examDate,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    salary_text: job.salaryText,
    education_levels: encodeList(job.educationLevels),
    experience_text: job.experienceText,
    experience_years_min: job.experienceYearsMin,
    age_min: job.ageMin,
    age_max: job.ageMax,
    kpss_required: job.kpssRequired === null ? null : job.kpssRequired ? 1 : 0,
    kpss_score_types: encodeList(job.kpssScoreTypes),
    kpss_min_score: job.kpssMinimumScore,
    kpss_year: job.kpssYear,
    gender_requirement: job.genderRequirement,
    military_requirement: job.militaryRequirement,
    driver_license_requirement: job.driverLicenseRequirement,
    foreign_language_requirement: job.foreignLanguageRequirement,
    quota: job.quota,
    legal_status: job.legalStatus,
    application_method: job.applicationMethod,
    application_url: job.applicationUrl,
    application_platform: job.applicationPlatform,
    raw_source_data: job.rawSourceData,
    parser_version: job.parserVersion,
    fingerprint: derived.fingerprint,
    headline_norm: search.headlineNorm,
    headline_folded: search.headlineFolded,
    search_text: search.searchText,
    search_folded: search.searchFolded,
  };
}

export interface JobListRow {
  id: number;
  source_id: string;
  title: string;
  organization: string | null;
  sector: string;
  city: string | null;
  district: string | null;
  location_text: string | null;
  public_employment_type: string | null;
  work_model: string;
  education_levels: string;
  kpss_required: number | null;
  kpss_score_types: string;
  kpss_min_score: number | null;
  quota: number | null;
  published_at: string | null;
  application_deadline: string | null;
  discovered_at: string;
  lifecycle: string;
  sort_at: string;
  is_new: number;
  duplicate_count: number;
  is_favorite: number;
  personal_status: string | null;
  is_seen: number;
}

export const JOB_LIST_COLUMNS = `
  j.id, j.source_id, j.title, j.organization, j.sector, j.city, j.district, j.location_text,
  j.public_employment_type, j.work_model, j.education_levels, j.kpss_required, j.kpss_score_types,
  j.kpss_min_score, j.quota, j.published_at, j.application_deadline, j.discovered_at, j.lifecycle, j.sort_at,
  (SELECT COUNT(*) FROM jobs d WHERE d.duplicate_group_id = j.id AND d.id != j.id) AS duplicate_count,
  EXISTS (SELECT 1 FROM favorites f WHERE f.job_id = j.id) AS is_favorite,
  (SELECT s.status FROM application_status s WHERE s.job_id = j.id) AS personal_status,
  EXISTS (SELECT 1 FROM job_views v WHERE v.job_id = j.id) AS is_seen`;

export function rowToListItem(r: JobListRow): JobListItem {
  return {
    id: r.id,
    sourceId: r.source_id,
    title: r.title,
    organization: r.organization,
    sector: r.sector as Sector,
    city: r.city,
    district: r.district,
    locationText: r.location_text,
    publicEmploymentType: r.public_employment_type as PublicEmploymentType | null,
    workModel: r.work_model as WorkModel,
    educationLevels: decodeList<EducationLevel>(r.education_levels),
    kpssRequired: bool(r.kpss_required),
    kpssScoreTypes: decodeList<KpssScoreType>(r.kpss_score_types),
    kpssMinimumScore: r.kpss_min_score,
    quota: r.quota,
    publishedAt: r.published_at,
    applicationDeadline: r.application_deadline,
    discoveredAt: r.discovered_at,
    lifecycle: r.lifecycle as JobLifecycle,
    duplicateCount: r.duplicate_count,
    isFavorite: r.is_favorite === 1,
    personalStatus: r.personal_status as PersonalStatus | null,
    isSeen: r.is_seen === 1,
    isNew: r.is_new === 1,
    sortAt: r.sort_at,
  };
}
