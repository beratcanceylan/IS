import { emptyNormalizedJob, type NormalizedJob } from '@/domain/job';
import { parseDateRange, parseTurkishDate } from '@/utils/dates';
import { stableId } from '@/utils/text';
import { normalizeTr } from '@/utils/turkish-normalization';

import type { KamuilanItem } from './parser';

export const SOURCE_ID = 'kamuilan-sbb';
export const PARSER_VERSION = 1;
export const HOMEPAGE = 'https://kamuilan.sbb.gov.tr/';

/**
 * Sitedeki "ilanDetay.aspx?kod=..." bağlantıları her sayfa yüklemesinde yeniden şifrelenir ve
 * yalnızca o oturumun çereziyle çalışır. Bu yüzden:
 * - Kalıcı kimlik içerikten üretilir (kurum + başlık + yayın günü + başvuru aralığı).
 * - `sourceUrl` kaynağın ana sayfasıdır; geçici bağlantı yalnızca ham veride saklanır.
 */
export function externalId(item: KamuilanItem, publishedDay: string): string {
  return stableId([normalizeTr(item.organization), normalizeTr(item.title), publishedDay, normalizeTr(item.rangeText)].join('|'));
}

function noticeCategory(title: string): string | null {
  const n = normalizeTr(title);
  if (n.includes('iptal')) return 'İptal ilanı';
  if (n.includes('düzeltme')) return 'Düzeltme ilanı';
  return null;
}

export function mapItem(item: KamuilanItem, now: Date): NormalizedJob {
  const publishedAt = parseTurkishDate(item.dayLabel, { reference: now });
  // Başvuru aralığının yılı yayın tarihine göre çıkarılır ("28 Aralık - 5 Ocak").
  const range = parseDateRange(item.rangeText, publishedAt ? new Date(publishedAt) : now);
  const publishedDay = publishedAt?.slice(0, 10) ?? normalizeTr(item.dayLabel);
  return {
    ...emptyNormalizedJob({
      sourceId: SOURCE_ID,
      sourceExternalId: externalId(item, publishedDay),
      sourceUrl: HOMEPAGE,
      title: item.title,
      parserVersion: PARSER_VERSION,
    }),
    organization: item.organization,
    sector: 'public',
    employmentCategory: noticeCategory(item.title),
    publishedAt,
    applicationStartAt: range.start,
    applicationDeadline: range.end,
    rawSourceData: JSON.stringify(item),
  };
}
