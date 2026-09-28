import { computeFingerprint, similarity, SIMILARITY_THRESHOLD, titleTokens, type DedupInput } from '@/sync/deduplication';

const base: DedupInput = {
  sourceId: 'kariyer-kapisi',
  title: 'YÜKSEK SEÇİM KURULU BAŞKANLIĞI - SÖZLEŞMELİ BİLİŞİM PERSONELİ ALIM İLANI (2026)',
  organization: 'YÜKSEK SEÇİM KURULU BAŞKANLIĞI',
  city: null,
  district: null,
  applicationDeadline: '2026-09-29T14:00:00.000Z',
  publishedAt: '2026-09-18T06:00:00.000Z',
  quota: null,
};

describe('deduplication', () => {
  it('başlıktan kurumu, kalıp kelimeleri ve yılı atar', () => {
    expect(titleTokens(base.title, base.organization)).toEqual(['sözleşmeli', 'bilişim']);
  });

  it('farklı kaynaklardaki aynı ilanı eşleştirir (yıl kadro sayısı sanılmaz)', () => {
    const sbb: DedupInput = {
      ...base,
      sourceId: 'kamuilan-sbb',
      title: '6 SÖZLEŞMELİ BİLİŞİM PERSONELİ ALACAK',
      applicationDeadline: '2026-09-29T20:59:59.000Z',
      quota: 6,
    };
    expect(similarity(base, sbb).score).toBeGreaterThanOrEqual(SIMILARITY_THRESHOLD);
  });

  it('çelişen sinyallerde veto eder', () => {
    expect(similarity({ ...base, city: 'İstanbul' }, { ...base, sourceId: 'x', city: 'Ankara' }).vetoed).toBe('city');
    expect(similarity({ ...base, quota: 3 }, { ...base, sourceId: 'x', quota: 5 }).vetoed).toBe('quota');
    expect(similarity(base, { ...base, sourceId: 'x', applicationDeadline: '2026-11-01T00:00:00.000Z' }).vetoed).toBe('deadline');
    expect(similarity(base, { ...base }).vetoed).toBe('sameSource');
    expect(similarity(base, { ...base, sourceId: 'x', organization: null }).vetoed).toBe('noOrganization');
  });

  it('aynı kurumun farklı pozisyonlarını birleştirmez', () => {
    const other: DedupInput = { ...base, sourceId: 'x', title: 'HUKUK MÜŞAVİRİ ALIM İLANI' };
    expect(similarity(base, other).score).toBeLessThan(SIMILARITY_THRESHOLD);
  });

  it('fingerprint büyük/küçük harf ve noktalamadan etkilenmez, Türkçe harfleri korur', () => {
    const a = computeFingerprint(base);
    const b = computeFingerprint({ ...base, title: 'Yüksek Seçim Kurulu Başkanlığı - Sözleşmeli Bilişim Personeli Alım İlanı 2026', organization: 'Yüksek Seçim Kurulu Başkanlığı' });
    expect(a).toBe(b);
    expect(computeFingerprint({ ...base, title: 'Şoför' })).not.toBe(computeFingerprint({ ...base, title: 'Sofor' }));
  });
});
