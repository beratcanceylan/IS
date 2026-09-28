import { emptyNormalizedJob, type ApplicationMethod, type NormalizedJob } from '@/domain/job';
import { parseIsoLocal, parseRfc822 } from '@/utils/dates';
import { cleanWhitespace, stripBbcode, truncate } from '@/utils/text';

import type { KariyerKapisiDetail, KariyerKapisiRssItem } from './parser';

export const SOURCE_ID = 'kariyer-kapisi';
export const PARSER_VERSION = 1;

export function canonicalUrl(guid: string): string {
  return `https://kariyerkapisi.gov.tr/IlanDetay?i=${guid}`;
}

/** "KURUM ADI - İLAN BAŞLIĞI" → kurum. Ayraç yoksa kurum bilinmiyor kabul edilir. */
export function splitTitle(title: string): { organization: string | null; position: string } {
  const idx = title.indexOf(' - ');
  if (idx <= 0) return { organization: null, position: title.trim() };
  return { organization: title.slice(0, idx).trim(), position: title.slice(idx + 3).trim() || title.trim() };
}

export function mapRssItem(item: KariyerKapisiRssItem): NormalizedJob {
  const { organization } = splitTitle(item.title);
  return {
    ...emptyNormalizedJob({
      sourceId: SOURCE_ID,
      sourceExternalId: item.guid,
      sourceUrl: item.link,
      title: item.title,
      parserVersion: PARSER_VERSION,
    }),
    canonicalUrl: canonicalUrl(item.guid),
    organization,
    sector: 'public',
    employmentCategory: item.category,
    publishedAt: parseRfc822(item.pubDate),
    applicationPlatform: 'Kariyer Kapısı',
    rawSourceData: JSON.stringify({ rss: item }),
  };
}

function isEdevlet(url: string | null): boolean {
  return !!url && /turkiye\.gov\.tr/i.test(url);
}

function applicationPlatform(method: ApplicationMethod, applicationLink: string | null | undefined): string {
  if (method === 'eDevlet') return 'e-Devlet / Kariyer Kapısı';
  const host = applicationLink ? /^https?:\/\/([^/]+)/i.exec(applicationLink)?.[1]?.replace(/^www\./, '') : undefined;
  if (!host) return 'Kariyer Kapısı';
  return host.includes('iskur') ? 'İŞKUR' : host;
}

/** RSS öğesi + detay JSON'u. Detaydaki değerler listedekilerden önceliklidir. */
export function mapDetail(base: NormalizedJob, d: KariyerKapisiDetail): NormalizedJob {
  const description = d.ilanMetni ? cleanWhitespace(stripBbcode(d.ilanMetni)) : null;
  const applicationUrl = d.basvuruLinki ?? (d.eDevletteGorunsun === 1 ? d.eDevletServisURL : null) ?? base.sourceUrl;
  const applicationMethod: ApplicationMethod =
    !d.basvuruLinki && d.eDevletteGorunsun === 1 && isEdevlet(d.eDevletServisURL) ? 'eDevlet' : 'online';
  const platform = applicationPlatform(applicationMethod, d.basvuruLinki);

  const title = d.ilanBaslik ?? base.title;
  return {
    ...base,
    title,
    organization: d.kurumAdi ?? base.organization,
    department: d.birimAdi,
    employmentCategory: d.ilanTuru ?? base.employmentCategory,
    description,
    summary: description ? truncate(description.replaceAll(/\s+/g, ' '), 280) : null,
    applicationStartAt: d.basTarih ? parseIsoLocal(d.basTarih) : null,
    applicationDeadline: d.bitTarih ? parseIsoLocal(d.bitTarih) : null,
    // 0 "belirtilmemiş" anlamında dönüyor; kadro sayısı yoksa başlıktan çıkarılır.
    quota: d.kontenjan && d.kontenjan > 0 ? d.kontenjan : null,
    applicationUrl,
    applicationMethod,
    applicationPlatform: platform,
    // İlan metni zaten `description`'da; ham veride tekrar saklanmaz.
    rawSourceData: JSON.stringify({ detail: { ...d, ilanMetni: undefined } }),
  };
}
