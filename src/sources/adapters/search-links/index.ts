import type { SearchLinkQuery, SearchLinkSource } from '@/sources/types';

/**
 * Otomatik erişime uygun olmayan kaynaklar. Uygulama bu sitelere istek ATMAZ; yalnızca
 * kullanıcının tarayıcıda açacağı bir arama bağlantısı üretir. Nedenler docs/source-matrix.md'de.
 *
 * Arama parametresi doğrulanmamış sitelerde yalnızca ilan listesi sayfası açılır.
 */

const enc = (s: string | undefined | null) => encodeURIComponent((s ?? '').trim());

function withParams(base: string, params: Record<string, string | null | undefined>): string {
  const q = Object.entries(params)
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}=${enc(v)}`)
    .join('&');
  return q ? `${base}?${q}` : base;
}

export const searchLinkSources: SearchLinkSource[] = [
  {
    id: 'ilan-gov-tr',
    displayName: 'ilan.gov.tr',
    kind: 'official',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://www.ilan.gov.tr/ilan/kategori/9/personel-alimi-ilanlari',
    description: 'Basın İlan Kurumu resmî ilan portalı, personel alımı kategorisi.',
    reason: 'Veri servisi tarayıcı dışı istekleri reddediyor (HTTP 403); zorlanmıyor.',
    buildSearchUrl: () => 'https://www.ilan.gov.tr/ilan/kategori/9/personel-alimi-ilanlari',
  },
  {
    id: 'iskur',
    displayName: 'İŞKUR',
    kind: 'official',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://esube.iskur.gov.tr/Istihdam/AcikIsIlanAra.aspx',
    description: 'Türkiye İş Kurumu açık iş ilanları (kamu işçi alımları dahil).',
    reason: 'Güvenlik duvarı otomatik istekleri reddediyor; arama formu oturum gerektiriyor.',
    buildSearchUrl: () => 'https://esube.iskur.gov.tr/Istihdam/AcikIsIlanAra.aspx',
  },
  {
    id: 'resmi-gazete',
    displayName: 'Resmî Gazete İlan Bölümü',
    kind: 'official',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://www.resmigazete.gov.tr/',
    description: 'Üniversite öğretim üyesi ve kurum personel ilanları "Çeşitli İlânlar" altında yayımlanır.',
    reason: 'İlanlar PDF/HTML belge olarak yayımlanıyor; yapılandırılmış liste yok. İlk sürümde yalnızca bağlantı.',
    buildSearchUrl: () => 'https://www.resmigazete.gov.tr/',
  },
  {
    id: 'kariyer-net',
    displayName: 'Kariyer.net',
    kind: 'private',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://www.kariyer.net/is-ilanlari',
    description: 'Özel sektör iş ilanları.',
    reason: 'Kullanım koşulları otomatik veri toplamaya izin vermiyor.',
    buildSearchUrl: (q: SearchLinkQuery) => withParams('https://www.kariyer.net/is-ilanlari', { kw: q.query }),
  },
  {
    id: 'linkedin',
    displayName: 'LinkedIn Jobs',
    kind: 'private',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://www.linkedin.com/jobs/',
    description: 'Özel sektör, özellikle beyaz yaka ve teknoloji ilanları.',
    reason: 'Kullanım koşulları scraping\'i açıkça yasaklıyor.',
    buildSearchUrl: (q) =>
      withParams('https://www.linkedin.com/jobs/search/', { keywords: q.query, location: q.city ? `${q.city}, Türkiye` : 'Türkiye' }),
  },
  {
    id: 'indeed',
    displayName: 'Indeed',
    kind: 'aggregator',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://tr.indeed.com/',
    description: 'İlan toplayıcı.',
    reason: 'Kullanım koşulları ve bot koruması otomatik erişime izin vermiyor.',
    buildSearchUrl: (q) => withParams('https://tr.indeed.com/jobs', { q: q.query, l: q.city }),
  },
  {
    id: 'eleman-net',
    displayName: 'Eleman.net',
    kind: 'private',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://www.eleman.net/is-ilanlari',
    description: 'Mavi yaka ve KOBİ ilanları.',
    reason: 'robots.txt ilan ve arama sayfalarını kapatıyor.',
    buildSearchUrl: () => 'https://www.eleman.net/is-ilanlari',
  },
  {
    id: 'yenibiris',
    displayName: 'Yenibiriş',
    kind: 'private',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://www.yenibiris.com/is-ilanlari',
    description: 'Özel sektör iş ilanları.',
    reason: 'Bot koruması (robots.txt dahil 403) otomatik erişimi engelliyor.',
    buildSearchUrl: () => 'https://www.yenibiris.com/is-ilanlari',
  },
  {
    id: 'secretcv',
    displayName: 'Secretcv',
    kind: 'private',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://www.secretcv.com/is-ilanlari',
    description: 'Özel sektör iş ilanları.',
    reason: 'Kullanım koşulları otomatik veri toplamaya izin vermiyor; arama sayfası robots.txt ile kapalı.',
    buildSearchUrl: () => 'https://www.secretcv.com/is-ilanlari',
  },
  {
    id: 'isinolsun',
    displayName: 'İşin Olsun',
    kind: 'private',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://isinolsun.com/is-ilanlari',
    description: 'Mavi yaka, yarı zamanlı ve saatlik işler.',
    reason: 'Uygulama odaklı, JS ile render edilen site; açık bir feed/API yok.',
    buildSearchUrl: () => 'https://isinolsun.com/is-ilanlari',
  },
  {
    id: 'jooble',
    displayName: 'Jooble',
    kind: 'aggregator',
    mode: 'SEARCH_LINK',
    homepageUrl: 'https://tr.jooble.org/',
    description: 'İlan toplayıcı. Resmî API anahtar ile kullanılabilir (ileride DIRECT_API adayı).',
    reason: 'robots.txt tüm siteyi kapatıyor; API için kayıt/anahtar gerekiyor.',
    buildSearchUrl: (q) => withParams('https://tr.jooble.org/SearchResult', { ukw: q.query, rgns: q.city }),
  },
];
