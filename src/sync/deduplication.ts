import type { NormalizedJob } from '@/domain/job';
import { toIstanbulParts } from '@/utils/dates';
import { stableId } from '@/utils/text';
import { normalizeOrganization, normalizeTr } from '@/utils/turkish-normalization';

/**
 * Aynı ilanın farklı kaynaklardaki kopyalarını bulma.
 *
 * 1. Kesin eşleşme (aynı kaynak): `source_external_id` — DB'deki UNIQUE kısıt ile.
 * 2. Kesin eşleşme (kaynaklar arası): aynı `canonical_url`.
 * 3. Aynı fingerprint (kurum + başlık + şehir + tarih normalize edilmiş özeti).
 * 4. Ağırlıklı benzerlik: kurum, başlık, konum, son başvuru.
 *
 * Yanlış duplicate üretmek duplicate kaçırmaktan daha kötüdür: iki farklı ilanı birleştirmek
 * kullanıcıya bir ilanı hiç göstermemek demektir. Bu yüzden eşik yüksek tutulur ve çelişen
 * sinyallerde (farklı şehir, farklı kadro sayısı, farklı son başvuru) doğrudan veto edilir.
 */

export const SIMILARITY_THRESHOLD = 0.86;

/** Başlıklarda ayırt edici olmayan kalıp kelimeler. */
const TITLE_STOPWORDS = new Set([
  'alım', 'alımı', 'alımları', 'alacak', 'alacaktır', 'alınacak', 'alınacaktır', 'ilan', 'ilanı', 'ilanları',
  'duyuru', 'duyurusu', 'adet', 'kişi', 'kişilik', 'için', 've', 'ile', 'yapılacak', 'yapacak', 'hakkında',
  'başvuru', 'başvuruları', 'personel', 'personeli',
]);

export interface DedupInput {
  sourceId: string;
  title: string;
  organization: string | null;
  city: string | null;
  district: string | null;
  applicationDeadline: string | null;
  publishedAt: string | null;
  quota: number | null;
}

function dayKey(iso: string | null): string {
  if (!iso) return '';
  const p = toIstanbulParts(iso);
  return `${p.year}-${p.month + 1}-${p.day}`;
}

/** Başlıktan kurum adını ve kalıp kelimeleri çıkarır; sayılar (kadro) korunur. */
export function titleTokens(title: string, organization: string | null): string[] {
  const orgTokens = new Set(normalizeTr(organization).split(' ').filter(Boolean));
  return normalizeTr(title)
    .split(' ')
    // Yıl ("2026") ayırt edici değildir ve kadro sayısıyla karıştırılıp yanlış veto üretir.
    .filter((t) => t && !TITLE_STOPWORDS.has(t) && !orgTokens.has(t) && !/^(19|20)\d{2}$/.test(t));
}

export function computeFingerprint(job: DedupInput): string {
  const parts = [
    normalizeOrganization(job.organization),
    titleTokens(job.title, job.organization).join(' '),
    normalizeTr(job.city),
    dayKey(job.applicationDeadline ?? job.publishedAt),
  ];
  return stableId(parts.join('|'));
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return 0;
  const sa = new Set(a);
  const sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** Kısa ifadenin uzun ifadenin içinde tamamen geçmesi ("kocaeli üniversitesi" ⊂ "kocaeli üniversitesi rektörlüğü"). */
function containment(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const [small, large] = a.length <= b.length ? [a, b] : [b, a];
  const set = new Set(large);
  return small.filter((t) => set.has(t)).length / small.length;
}

function numbersIn(tokens: string[]): string[] {
  return tokens.filter((t) => /^\d+$/.test(t));
}

export interface SimilarityResult {
  score: number;
  vetoed: string | null;
}

/** Kesin olarak farklı ilan olduklarını gösteren yapısal alanlar. */
function structuralVeto(a: DedupInput, b: DedupInput): string | null {
  // Aynı kaynak içindeki kopyalar external id ile çözülür; burada kaynaklar arası bakılır.
  if (a.sourceId === b.sourceId) return 'sameSource';
  const cityA = normalizeTr(a.city);
  const cityB = normalizeTr(b.city);
  if (cityA && cityB && cityA !== cityB) return 'city';
  if (a.district && b.district && normalizeTr(a.district) !== normalizeTr(b.district)) return 'district';
  if (a.quota != null && b.quota != null && a.quota !== b.quota) return 'quota';
  return null;
}

/** Son başvuru yakınlığı; iki günden fazla fark varsa `null` (veto). */
function deadlineScoreOf(a: DedupInput, b: DedupInput): number | null {
  if (!a.applicationDeadline || !b.applicationDeadline) return 0.5;
  const diffDays = Math.abs(new Date(a.applicationDeadline).getTime() - new Date(b.applicationDeadline).getTime()) / 86_400_000;
  if (diffDays > 2) return null;
  return diffDays < 1 ? 1 : 0.7;
}

export function similarity(a: DedupInput, b: DedupInput): SimilarityResult {
  const veto = structuralVeto(a, b);
  if (veto) return { score: 0, vetoed: veto };
  const deadlineScore = deadlineScoreOf(a, b);
  if (deadlineScore === null) return { score: 0, vetoed: 'deadline' };
  const cityA = normalizeTr(a.city);
  const cityB = normalizeTr(b.city);

  const orgA = normalizeOrganization(a.organization).split(' ').filter(Boolean);
  const orgB = normalizeOrganization(b.organization).split(' ').filter(Boolean);
  const orgScore = Math.max(jaccard(orgA, orgB), containment(orgA, orgB) * 0.95);
  // Kurum bilinmiyorsa kaynaklar arası eşleştirme yapılmaz.
  if (!orgA.length || !orgB.length) return { score: 0, vetoed: 'noOrganization' };

  const tA = titleTokens(a.title, a.organization);
  const tB = titleTokens(b.title, b.organization);
  const numsA = numbersIn(tA);
  const numsB = numbersIn(tB);
  if (numsA.length && numsB.length && jaccard(numsA, numsB) === 0) return { score: 0, vetoed: 'titleNumbers' };
  const titleScore = Math.max(jaccard(tA, tB), containment(tA, tB) * 0.9);

  const locationScore = cityA && cityB ? 1 : 0.5;

  const score = 0.35 * orgScore + 0.4 * titleScore + 0.1 * locationScore + 0.15 * deadlineScore;
  return { score, vetoed: null };
}

export function toDedupInput(job: NormalizedJob): DedupInput {
  return {
    sourceId: job.sourceId,
    title: job.title,
    organization: job.organization,
    city: job.city,
    district: job.district,
    applicationDeadline: job.applicationDeadline,
    publishedAt: job.publishedAt,
    quota: job.quota,
  };
}
