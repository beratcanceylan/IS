import type { EducationLevel, JobListItem, JobPosting, PersonalStatus, PublicEmploymentType } from '@/domain/job';
import { EDUCATION_ORDER } from '@/domain/job';
import { EDUCATION_LABELS } from '@/extraction/education';
import { formatKpssType } from '@/extraction/kpss';
import { formatDeadline, formatRelativeDay } from '@/utils/dates';
import { displayCase } from '@/utils/display';

export const PUBLIC_TYPE_LABELS: Record<PublicEmploymentType, string> = {
  memur: 'Memur',
  contracted: 'Sözleşmeli',
  permanentWorker: 'Sürekli işçi',
  temporaryWorker: 'Geçici işçi',
  academic: 'Akademik',
  expertAssistant: 'Uzman yardımcısı',
  inspectorAssistant: 'Denetçi yardımcısı',
  contractedIT: 'Bilişim personeli',
  other: 'Diğer',
};

export const STATUS_LABELS: Record<PersonalStatus, string> = {
  toReview: 'İncelenecek',
  applied: 'Başvurdum',
  interview: 'Görüşme',
  waiting: 'Sonuç bekliyorum',
  rejected: 'Olumsuz',
  offer: 'Teklif',
  notInterested: 'İlgilenmiyorum',
};

export function locationLine(job: Pick<JobListItem, 'city' | 'district' | 'locationText'>): string {
  if (job.city) return job.district ? `${job.city} · ${job.district}` : job.city;
  return job.locationText ? displayCase(job.locationText) : '';
}

/** "Önlisans", "Lise–Lisans". */
export function educationLabel(levels: EducationLevel[]): string | null {
  if (!levels.length) return null;
  const sorted = EDUCATION_ORDER.filter((l) => levels.includes(l));
  const first = sorted[0];
  const last = sorted.at(-1);
  if (first === undefined || last === undefined) return null;
  if (first === last) return EDUCATION_LABELS[first];
  return `${EDUCATION_LABELS[first]}–${EDUCATION_LABELS[last]}`;
}

export function kpssLabel(job: Pick<JobListItem, 'kpssRequired' | 'kpssScoreTypes' | 'kpssMinimumScore'>): string | null {
  if (job.kpssRequired === false) return 'KPSS yok';
  if (job.kpssScoreTypes.length) {
    const types = job.kpssScoreTypes.slice(0, 2).map(formatKpssType).join('/');
    return job.kpssMinimumScore ? `KPSS ${types} ${job.kpssMinimumScore}+` : `KPSS ${types}`;
  }
  if (job.kpssRequired) return 'KPSS';
  return null;
}

/** Satırda en fazla üç rozet: sektör, eğitim, KPSS. Konum ve tarih rozet değildir. */
export function rowBadges(job: JobListItem): string[] {
  const out: string[] = [];
  if (job.sector === 'public') out.push(job.publicEmploymentType ? PUBLIC_TYPE_LABELS[job.publicEmploymentType] : 'Kamu');
  else if (job.sector === 'private') out.push('Özel');
  const edu = educationLabel(job.educationLevels);
  if (edu) out.push(edu);
  const kpss = kpssLabel(job);
  if (kpss) out.push(kpss);
  return out.slice(0, 3);
}

export interface DeadlineInfo {
  label: string;
  urgent: boolean;
}

export function deadlineInfo(iso: string | null, now = new Date()): DeadlineInfo | null {
  if (!iso) return null;
  const label = formatDeadline(iso, now);
  const ms = new Date(iso).getTime() - now.getTime();
  return { label, urgent: ms >= 0 && ms < 2 * 86_400_000 };
}

/** Sıralama anahtarı üzerinden: ileri tarihli yayınlar "keşif günü" olarak gösterilir. */
export function publishedLabel(job: Pick<JobListItem, 'sortAt'>): string {
  return formatRelativeDay(job.sortAt);
}

/** Detay ekranındaki metadata satırları: yalnızca bilinen değerler. */
export function detailFacts(job: JobPosting): string[] {
  const facts: string[] = [];
  if (job.sector === 'public') facts.push('Kamu');
  if (job.sector === 'private') facts.push('Özel sektör');
  if (job.publicEmploymentType) facts.push(PUBLIC_TYPE_LABELS[job.publicEmploymentType]);
  if (job.legalStatus) facts.push(job.legalStatus);
  const edu = educationLabel(job.educationLevels);
  if (edu) facts.push(edu);
  const kpss = kpssLabel(job);
  if (kpss) facts.push(job.kpssYear && job.kpssRequired !== false ? `${kpss} (${job.kpssYear})` : kpss);
  if (job.quota) facts.push(`${job.quota} kişi`);
  if (job.workModel === 'remote') facts.push('Uzaktan');
  if (job.workModel === 'hybrid') facts.push('Hibrit');
  return facts;
}
