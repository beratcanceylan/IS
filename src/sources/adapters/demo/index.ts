import { emptyNormalizedJob, type NormalizedJob } from '@/domain/job';
import type { SyncSourceAdapter } from '@/sources/types';
import { istanbulToIso, toIstanbulParts } from '@/utils/dates';

/**
 * Ağ kullanmayan, deterministik örnek veri üreten geliştirme kaynağı.
 * Varsayılan kapalıdır ve yalnızca geliştirici modunda listelenir. UI'ı çevrimdışı test etmek,
 * dedup ve bildirim akışlarını denemek için kullanılır.
 */

const SAMPLES: (Partial<NormalizedJob> & { title: string })[] = [
  { title: 'Büro Personeli', organization: 'Tekirdağ Büyükşehir Belediyesi', city: 'Tekirdağ', district: 'Süleymanpaşa', sector: 'public', description: 'Lisans mezunu olmak. 2024 KPSS P3 puan türünden en az 70 puan almış olmak. 35 yaşını doldurmamış olmak.' },
  { title: 'Bilgi İşlem Personeli', organization: 'Çorlu Belediyesi', city: 'Tekirdağ', district: 'Çorlu', sector: 'public', description: 'Önlisans mezunu olmak. KPSS şartı aranmayacaktır.' },
  { title: 'Frontend Developer', organization: 'Örnek Teknoloji A.Ş.', city: 'İstanbul', sector: 'private', workModel: 'hybrid', description: 'En az 2 yıl deneyimli. Aylık net ücret 60.000 TL - 75.000 TL.' },
  { title: 'Şoför', organization: 'Kırklareli İl Özel İdaresi', city: 'Kırklareli', sector: 'public', description: 'Lise mezunu, E sınıfı sürücü belgesine sahip olmak.' },
  { title: 'Sürekli İşçi Alımı (Temizlik)', organization: 'Edirne Trakya Üniversitesi', city: 'Edirne', sector: 'public', description: 'İlköğretim mezunu olmak. KPSS şartı aranmaz.' },
];

export const demoAdapter: SyncSourceAdapter = {
  id: 'demo',
  displayName: 'Demo kaynak (geliştirici)',
  kind: 'official',
  mode: 'DIRECT_API',
  homepageUrl: 'https://example.invalid/',
  description: 'Ağ kullanmadan örnek ilan üretir. Yalnızca geliştirme içindir.',
  defaultEnabled: false,
  minIntervalMinutes: 0,
  requestDelayMs: 0,
  parserVersion: 1,
  expectedMinCount: 1,

  async fetchListings(ctx) {
    const p = toIstanbulParts(ctx.now);
    const day = istanbulToIso(p.year, p.month, p.day, 9);
    const jobs = SAMPLES.map((s, i) => ({
      ...emptyNormalizedJob({
        sourceId: 'demo',
        sourceExternalId: `demo-${p.year}-${p.month}-${p.day}-${i}`,
        sourceUrl: `https://example.invalid/ilan/${i}`,
        title: s.title,
        parserVersion: 1,
      }),
      ...s,
      publishedAt: day,
      applicationDeadline: istanbulToIso(p.year, p.month, p.day + 3 + i * 4, 23, 59, 59),
    }));
    return { notModified: false, jobs, complete: true, httpStatus: 200, etag: null, lastModified: null };
  },
};
