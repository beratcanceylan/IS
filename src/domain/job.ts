/**
 * Ortak ilan modeli. Kaynaklar bu modelin yalnızca bir kısmını doldurabilir;
 * bilinmeyen alanlar `null` / `'unknown'` kalır, asla tahminle doldurulmaz.
 */

export type Sector = 'public' | 'private' | 'unknown';

export type WorkModel = 'onsite' | 'hybrid' | 'remote' | 'unknown';

export type EmploymentType =
  | 'fullTime'
  | 'partTime'
  | 'temporary'
  | 'internship'
  | 'seasonal'
  | 'contract'
  | 'unknown';

export type PublicEmploymentType =
  | 'memur'
  /** Sözleşmeli personel (657 4/B, 5510 vb.). Kesin statü `legalStatus` alanında. */
  | 'contracted'
  | 'permanentWorker'
  | 'temporaryWorker'
  | 'academic'
  | 'expertAssistant'
  | 'inspectorAssistant'
  | 'contractedIT'
  | 'other';

export type EducationLevel = 'primary' | 'highSchool' | 'associate' | 'bachelor' | 'master' | 'doctorate';

export const EDUCATION_ORDER: readonly EducationLevel[] = [
  'primary',
  'highSchool',
  'associate',
  'bachelor',
  'master',
  'doctorate',
];

/** KPSS puan türleri. Liste bilinçli olarak kapalı; tanınmayan tür kaydedilmez. */
export type KpssScoreType =
  | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9' | 'P10'
  | 'P93' | 'P94' | 'P3_EKPSS' | 'KPSSP121' | 'OTHER';

/**
 * İlanın yaşam döngüsü. Kaynakta görünmeyen ilan hemen silinmez:
 * active → possiblyRemoved → archived. Son başvurusu geçen ilan expired olur.
 */
export type JobLifecycle = 'active' | 'possiblyRemoved' | 'expired' | 'archived';

export type ApplicationMethod = 'online' | 'eDevlet' | 'inPerson' | 'mail' | 'email' | 'unknown';

/** Bir adapter'ın ürettiği normalize edilmiş ilan (DB kimliği henüz yok). */
export interface NormalizedJob {
  sourceId: string;
  sourceExternalId: string;
  sourceUrl: string;
  canonicalUrl: string | null;

  title: string;
  organization: string | null;
  department: string | null;
  profession: string | null;

  sector: Sector;
  /** Kaynağın kendi kategori etiketi, örn. "Sözleşmeli Personel İlanları". */
  employmentCategory: string | null;
  publicEmploymentType: PublicEmploymentType | null;
  employmentType: EmploymentType;
  workModel: WorkModel;

  description: string | null;
  requirements: string | null;
  summary: string | null;

  city: string | null;
  district: string | null;
  locationText: string | null;

  /** ISO 8601 (UTC). */
  publishedAt: string | null;
  applicationStartAt: string | null;
  applicationDeadline: string | null;
  examDate: string | null;

  salaryMin: number | null;
  salaryMax: number | null;
  salaryText: string | null;

  educationLevels: EducationLevel[];
  experienceText: string | null;
  experienceYearsMin: number | null;

  ageMin: number | null;
  ageMax: number | null;

  kpssRequired: boolean | null;
  kpssScoreTypes: KpssScoreType[];
  kpssMinimumScore: number | null;
  kpssYear: number | null;

  genderRequirement: string | null;
  militaryRequirement: string | null;
  driverLicenseRequirement: string | null;
  foreignLanguageRequirement: string | null;
  quota: number | null;
  /** Mevzuat/statü metni, örn. "657 s. DMK 4/B". Yalnızca metinde açıkça geçiyorsa. */
  legalStatus: string | null;

  applicationMethod: ApplicationMethod;
  applicationUrl: string | null;
  applicationPlatform: string | null;

  rawSourceData: string | null;
  parserVersion: number;
}

/** DB'den okunan ilan. */
export interface JobPosting extends NormalizedJob {
  id: number;
  organizationNormalized: string | null;
  fingerprint: string;
  duplicateGroupId: number | null;
  lifecycle: JobLifecycle;
  discoveredAt: string;
  lastSeenAt: string;
  detailFetchedAt: string | null;
}

/** Liste ekranlarında kullanılan hafif satır. Ağır metin alanlarını taşımaz. */
export interface JobListItem {
  id: number;
  sourceId: string;
  title: string;
  organization: string | null;
  sector: Sector;
  city: string | null;
  district: string | null;
  locationText: string | null;
  publicEmploymentType: PublicEmploymentType | null;
  workModel: WorkModel;
  educationLevels: EducationLevel[];
  kpssRequired: boolean | null;
  kpssScoreTypes: KpssScoreType[];
  kpssMinimumScore: number | null;
  quota: number | null;
  publishedAt: string | null;
  applicationDeadline: string | null;
  discoveredAt: string;
  lifecycle: JobLifecycle;
  duplicateCount: number;
  isFavorite: boolean;
  personalStatus: PersonalStatus | null;
  isSeen: boolean;
  /** Kullanıcı akışı son gördüğünden beri bulunan (ilk senkron hariç) ilan. */
  isNew: boolean;
  /** Sıralama anahtarı: yayın tarihi, yoksa keşif zamanı. */
  sortAt: string;
}

/** Kişisel iş akışı durumları. */
export type PersonalStatus =
  | 'toReview'
  | 'applied'
  | 'interview'
  | 'waiting'
  | 'rejected'
  | 'offer'
  | 'notInterested';

export function emptyNormalizedJob(
  base: Pick<NormalizedJob, 'sourceId' | 'sourceExternalId' | 'sourceUrl' | 'title' | 'parserVersion'>,
): NormalizedJob {
  return {
    canonicalUrl: null,
    organization: null,
    department: null,
    profession: null,
    sector: 'unknown',
    employmentCategory: null,
    publicEmploymentType: null,
    employmentType: 'unknown',
    workModel: 'unknown',
    description: null,
    requirements: null,
    summary: null,
    city: null,
    district: null,
    locationText: null,
    publishedAt: null,
    applicationStartAt: null,
    applicationDeadline: null,
    examDate: null,
    salaryMin: null,
    salaryMax: null,
    salaryText: null,
    educationLevels: [],
    experienceText: null,
    experienceYearsMin: null,
    ageMin: null,
    ageMax: null,
    kpssRequired: null,
    kpssScoreTypes: [],
    kpssMinimumScore: null,
    kpssYear: null,
    genderRequirement: null,
    militaryRequirement: null,
    driverLicenseRequirement: null,
    foreignLanguageRequirement: null,
    quota: null,
    legalStatus: null,
    applicationMethod: 'unknown',
    applicationUrl: null,
    applicationPlatform: null,
    rawSourceData: null,
    ...base,
  };
}
