import fs from 'node:fs';
import path from 'node:path';

import { enrichFromText } from '@/extraction';
import { mapItem } from '@/sources/adapters/kamuilan-sbb/mapper';
import { PageFormatError, parseTimeline } from '@/sources/adapters/kamuilan-sbb/parser';

const html = fs.readFileSync(path.join(__dirname, '../fixtures/kamuilan-sbb/timeline.html'), 'utf8');
const NOW = new Date('2026-09-25T09:00:00Z');

describe('kamuilan.sbb.gov.tr parser', () => {
  const items = parseTimeline(html);

  it('gün gruplarındaki ilanları okur', () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
    expect(items[0]).toMatchObject({
      dayLabel: '25 Eylül',
      organization: 'ÇELTİK BELEDİYE BAŞKANLIĞI',
      title: '2 MEMUR ALACAK',
      rangeText: '2 Kasım - 6 Kasım',
    });
    expect(items[0].logo).not.toContain('#');
  });

  it('ortak modele dönüştürür; tarih ve konum çıkarımı', () => {
    const job = enrichFromText(mapItem(items[0], NOW));
    expect(job.publishedAt).toBe('2026-09-24T21:00:00.000Z');
    expect(job.applicationStartAt).toBe('2026-11-01T21:00:00.000Z');
    expect(job.applicationDeadline).toBe('2026-11-06T20:59:59.000Z');
    expect(job.city).toBe('Konya');
    expect(job.district).toBe('Çeltik');
    expect(job.quota).toBe(2);
    expect(job.publicEmploymentType).toBe('memur');
    expect(job.sourceUrl).toBe('https://kamuilan.sbb.gov.tr/');
  });

  it('kalıcı kimlik oturum bağlantısından bağımsızdır', () => {
    const a = mapItem(items[0], NOW);
    const b = mapItem({ ...items[0], href: 'ilanDetay.aspx?kod=BAŞKA' }, NOW);
    expect(a.sourceExternalId).toBe(b.sourceExternalId);
    const ids = items.map((i) => mapItem(i, NOW).sourceExternalId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('en eski gün grubunun yılını doğru çıkarır', () => {
    const last = items[items.length - 1];
    expect(last.dayLabel).toBe('3 Ağustos');
    expect(mapItem(last, NOW).publishedAt).toBe('2026-08-02T21:00:00.000Z');
  });

  it('yapı değiştiyse sessizce 0 ilan döndürmez', () => {
    expect(() => parseTimeline('<html><body><div>Bakım çalışması</div></body></html>')).toThrow(PageFormatError);
  });
});
