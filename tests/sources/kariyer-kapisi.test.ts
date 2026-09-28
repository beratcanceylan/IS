import fs from 'node:fs';
import path from 'node:path';

import { enrichFromText } from '@/extraction';
import { mapDetail, mapRssItem, splitTitle } from '@/sources/adapters/kariyer-kapisi/mapper';
import { FeedFormatError, parseDetail, parseRss } from '@/sources/adapters/kariyer-kapisi/parser';

const dir = path.join(__dirname, '../fixtures/kariyer-kapisi');
const rss = fs.readFileSync(path.join(dir, 'rss.xml'), 'utf8');
const details = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith('detail-'))
  .map((f) => ({ guid: f.slice(7, -5), body: fs.readFileSync(path.join(dir, f), 'utf8') }));

describe('Kariyer Kapısı RSS parser', () => {
  const items = parseRss(rss);

  it('gerçek RSS örneğindeki tüm ilanları okur', () => {
    expect(items.length).toBeGreaterThanOrEqual(10);
    for (const item of items) {
      expect(item.guid).toMatch(/^[0-9a-f-]{36}$/);
      expect(item.link).toContain(item.guid);
      expect(item.title.length).toBeGreaterThan(5);
    }
    expect(new Set(items.map((i) => i.guid)).size).toBe(items.length);
  });

  it('ortak modele dönüştürür: kurum, kategori, yayın tarihi', () => {
    const job = mapRssItem(items[0]);
    expect(job.sourceId).toBe('kariyer-kapisi');
    expect(job.sector).toBe('public');
    expect(job.organization).toBeTruthy();
    expect(job.employmentCategory).toBeTruthy();
    expect(job.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(job.canonicalUrl).toBe(`https://kariyerkapisi.gov.tr/IlanDetay?i=${items[0].guid}`);
  });

  it('BOM içeren ve bozuk yanıtları ayırt eder', () => {
    expect(parseRss(`﻿${rss}`)).toHaveLength(items.length);
    expect(() => parseRss('<html><body>Bakım</body></html>')).toThrow(FeedFormatError);
    expect(() => parseRss('Request Rejected')).toThrow(FeedFormatError);
  });

  it('başlıktan kurumu ayırır', () => {
    expect(splitTitle('KARAYOLLARI GENEL MÜDÜRLÜĞÜ - 50 İŞÇİ ALIMI')).toEqual({
      organization: 'KARAYOLLARI GENEL MÜDÜRLÜĞÜ',
      position: '50 İŞÇİ ALIMI',
    });
    expect(splitTitle('TEK PARÇA BAŞLIK').organization).toBeNull();
  });
});

describe('Kariyer Kapısı detay', () => {
  it.each(details)('$guid: tarihler, metin ve başvuru bilgisi', ({ guid, body }) => {
    const d = parseDetail(body);
    expect(d).not.toBeNull();
    const base = mapRssItem({ guid, link: `https://kariyerkapisi.gov.tr/IlanDetay?i=${guid}`, title: d!.ilanBaslik!, category: null, pubDate: null, imageUrl: null });
    const job = enrichFromText(mapDetail(base, d!));
    expect(job.applicationDeadline).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(job.applicationStartAt! < job.applicationDeadline!).toBe(true);
    expect(job.description).not.toMatch(/\[\/?(?:b|size|justify)/);
    expect(job.applicationUrl).toMatch(/^https:\/\//);
  });

  it('sözleşmeli personel ilanında KPSS ve eğitim şartlarını metinden çıkarır', () => {
    const afyon = details.map((x) => parseDetail(x.body)!).find((d) => d.ilanBaslik?.includes('AFYON'));
    expect(afyon).toBeDefined();
    const base = mapRssItem({ guid: '00000000-0000-0000-0000-000000000000', link: 'x', title: afyon!.ilanBaslik!, category: null, pubDate: null, imageUrl: null });
    const job = enrichFromText({ ...mapDetail(base, afyon!), sector: 'public' });
    expect(job.kpssRequired).toBe(true);
    expect(job.kpssScoreTypes.sort()).toEqual(['P3', 'P93', 'P94']);
    expect(job.kpssYear).toBe(2024);
    expect(job.educationLevels).toEqual(expect.arrayContaining(['highSchool', 'associate', 'bachelor']));
    expect(job.publicEmploymentType).toBe('contracted');
    expect(job.legalStatus).toBe('657 s. DMK 4/B');
    expect(job.city).toBe('Afyonkarahisar');
  });

  it('boş ve bozuk detay yanıtları', () => {
    expect(parseDetail('')).toBeNull();
    expect(() => parseDetail('<html>')).toThrow(FeedFormatError);
    expect(() => parseDetail('{"foo":1}')).toThrow(FeedFormatError);
  });
});
