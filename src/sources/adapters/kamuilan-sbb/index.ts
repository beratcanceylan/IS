import type { SyncSourceAdapter } from '@/sources/types';

import { HOMEPAGE, mapItem, PARSER_VERSION, SOURCE_ID } from './mapper';
import { parseTimeline } from './parser';

export const kamuilanSbbAdapter: SyncSourceAdapter = {
  id: SOURCE_ID,
  displayName: 'Kamu Personel Alım İlanları (SBB)',
  kind: 'official',
  mode: 'PUBLIC_HTML',
  homepageUrl: HOMEPAGE,
  description:
    'Strateji ve Bütçe Başkanlığı\'nın derlediği kamu personel alım ilanları (üniversiteler, belediyeler, kurumlar). Son ~1 ayın ilanları tek sayfada yayınlanır.',
  defaultEnabled: true,
  minIntervalMinutes: 120,
  requestDelayMs: 2000,
  parserVersion: PARSER_VERSION,
  // Sayfa normalde son bir ayın 100+ ilanını içerir.
  expectedMinCount: 20,

  async fetchListings(ctx) {
    const res = await ctx.http.request({
      url: HOMEPAGE,
      headers: { Accept: 'text/html' },
      etag: ctx.etag,
      lastModified: ctx.lastModified,
    });
    if (res.notModified) {
      return { notModified: true, jobs: [], complete: false, httpStatus: 304, etag: res.etag, lastModified: res.lastModified };
    }
    const items = parseTimeline(res.text);
    return {
      notModified: false,
      jobs: items.map((item) => mapItem(item, ctx.now)),
      // Sayfa kayan bir pencere (son ~30 gün) gösterir; eski ilanlar düştüğünde kaldırılmış
      // sayılmaz. Süreleri başvuru aralığından zaten bilindiği için yaşam döngüsü tarihle yönetilir.
      complete: false,
      httpStatus: res.status,
      etag: res.etag,
      lastModified: res.lastModified,
    };
  },
};
