import type { SyncSourceAdapter } from '@/sources/types';

import { mapDetail, mapRssItem, PARSER_VERSION, SOURCE_ID } from './mapper';
import { parseDetail, parseRss } from './parser';

const RSS_URL = 'https://kariyerkapisi.gov.tr/RSS';
// İlan detay sayfasının kendi kullandığı, adıyla da herkese açık (Public) olan uç nokta.
const DETAIL_URL = 'https://api.kariyerkapisi.gov.tr/api/ilan/GetIlanPreviewPublic';

export const kariyerKapisiAdapter: SyncSourceAdapter = {
  id: SOURCE_ID,
  displayName: 'Kariyer Kapısı',
  kind: 'official',
  mode: 'RSS_OR_FEED',
  homepageUrl: 'https://kariyerkapisi.gov.tr/isealim',
  description:
    'Cumhurbaşkanlığı İnsan Kaynakları Ofisi kamu işe alım platformu. Liste resmî RSS\'ten, ilan metni ve tarihleri herkese açık detay servisinden alınır.',
  defaultEnabled: true,
  minIntervalMinutes: 60,
  requestDelayMs: 1500,
  parserVersion: PARSER_VERSION,
  // RSS genelde 15-40 aktif ilan içerir; sıfır dönmesi büyük olasılıkla format değişikliğidir.
  expectedMinCount: 3,
  detailBudget: 40,

  async fetchListings(ctx) {
    const res = await ctx.http.request({
      url: RSS_URL,
      headers: { Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.1' },
      etag: ctx.etag,
      lastModified: ctx.lastModified,
    });
    if (res.notModified) {
      return { notModified: true, jobs: [], complete: false, httpStatus: 304, etag: res.etag, lastModified: res.lastModified };
    }
    const items = parseRss(res.text);
    return {
      notModified: false,
      jobs: items.map(mapRssItem),
      // RSS tüm aktif ilanları tek seferde döndürür.
      complete: true,
      httpStatus: res.status,
      etag: res.etag,
      lastModified: res.lastModified,
    };
  },

  async fetchDetails(ctx, job) {
    const res = await ctx.http.request({
      url: DETAIL_URL,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ilanGuid: job.sourceExternalId }),
    });
    // 204: ilan artık yayında değil.
    if (res.status === 204) return null;
    const detail = parseDetail(res.text);
    if (!detail) return null;
    const base = mapRssItem({
      guid: job.sourceExternalId,
      link: job.sourceUrl,
      title: detail.ilanBaslik ?? '',
      category: detail.ilanTuru,
      pubDate: null,
      imageUrl: null,
    });
    return mapDetail(base, detail);
  },
};
