import {
  calendarDaysFrom,
  formatDeadline,
  formatRelativeDay,
  formatShortDate,
  parseDateRange,
  parseIsoLocal,
  parseRfc822,
  parseTurkishDate,
} from '@/utils/dates';

// 25 Eylül 2026 12:00 İstanbul = 09:00 UTC
const NOW = new Date('2026-09-25T09:00:00Z');

describe('parseTurkishDate', () => {
  it.each([
    ['25.09.2026', '2026-09-24T21:00:00.000Z'],
    ['25/09/2026', '2026-09-24T21:00:00.000Z'],
    ['25-09-2026', '2026-09-24T21:00:00.000Z'],
    ['25 Eylül 2026', '2026-09-24T21:00:00.000Z'],
    ['25 Eyl 2026', '2026-09-24T21:00:00.000Z'],
    ['25 EYLÜL 2026', '2026-09-24T21:00:00.000Z'],
    ['25 eylul 2026', '2026-09-24T21:00:00.000Z'],
    ['1 Şubat 2027', '2027-01-31T21:00:00.000Z'],
    ['1 Ağustos 2026', '2026-07-31T21:00:00.000Z'],
  ])('%s', (input, expected) => {
    expect(parseTurkishDate(input)).toBe(expected);
  });

  it('saat bilgisini İstanbul saati olarak okur', () => {
    expect(parseTurkishDate('25.09.2026 17:30')).toBe('2026-09-25T14:30:00.000Z');
    expect(parseTurkishDate('25 Eylül 2026 saat 17.30')).toBe('2026-09-25T14:30:00.000Z');
  });

  it('son başvuru için gün sonunu kullanabilir', () => {
    expect(parseTurkishDate('30.09.2026', { endOfDay: true })).toBe('2026-09-30T20:59:59.000Z');
  });

  it('geçersiz tarihlerde tahmin üretmez', () => {
    expect(parseTurkishDate('31.02.2026')).toBeNull();
    expect(parseTurkishDate('yakında')).toBeNull();
    expect(parseTurkishDate('')).toBeNull();
    expect(parseTurkishDate('25 Foo 2026')).toBeNull();
  });

  it('yılsız tarihte referansa en yakın yılı seçer', () => {
    const december = new Date('2026-12-20T09:00:00Z');
    expect(parseTurkishDate('5 Ocak', { reference: december })).toBe('2027-01-04T21:00:00.000Z');
    expect(parseTurkishDate('3 Ağustos', { reference: NOW })).toBe('2026-08-02T21:00:00.000Z');
  });
});

describe('parseIsoLocal / parseRfc822', () => {
  it('ofsetsiz ISO değerini İstanbul saati kabul eder', () => {
    expect(parseIsoLocal('2026-09-21T08:30:00')).toBe('2026-09-21T05:30:00.000Z');
    expect(parseIsoLocal('2026-09-21T08:30:00Z')).toBe('2026-09-21T08:30:00.000Z');
  });

  it('RSS pubDate', () => {
    expect(parseRfc822('Mon, 21 Sep 2026 08:30:00 +0300')).toBe('2026-09-21T05:30:00.000Z');
    expect(parseRfc822('Fri, 11 Sep 2026 01:00:00 GMT')).toBe('2026-09-11T01:00:00.000Z');
    expect(parseRfc822('garbage')).toBeNull();
  });
});

describe('parseDateRange', () => {
  it('kamuilan biçimi', () => {
    expect(parseDateRange('( 21 Eylül - 30 Eylül)', NOW)).toEqual({
      start: '2026-09-20T21:00:00.000Z',
      end: '2026-09-30T20:59:59.000Z',
    });
  });

  it('yıl geçişi', () => {
    const r = parseDateRange('28 Aralık - 5 Ocak', new Date('2026-12-20T09:00:00Z'));
    expect(r.start).toBe('2026-12-27T21:00:00.000Z');
    expect(r.end).toBe('2027-01-05T20:59:59.000Z');
  });

  it('sayısal aralık ve tireli tarih', () => {
    expect(parseDateRange('01.10.2026-15.10.2026').end).toBe('2026-10-15T20:59:59.000Z');
    expect(parseDateRange('25-09-2026 - 30-09-2026').start).toBe('2026-09-24T21:00:00.000Z');
  });

  it('tek tarih aralık sayılmaz', () => {
    expect(parseDateRange('25 Eylül')).toEqual({ start: null, end: null });
  });
});

describe('gösterim', () => {
  it('kısa tarih', () => {
    expect(formatShortDate('2026-09-30T20:59:59.000Z', NOW)).toBe('30 Eyl');
    expect(formatShortDate('2027-01-05T20:59:59.000Z', NOW)).toBe('5 Oca 2027');
  });

  it('İstanbul takvim gününe göre göreli gün (UTC gece yarısı tuzağı)', () => {
    // 24 Eylül 22:30 UTC = 25 Eylül 01:30 İstanbul → bugün
    expect(calendarDaysFrom('2026-09-24T22:30:00Z', NOW)).toBe(0);
    expect(formatRelativeDay('2026-09-24T22:30:00Z', NOW)).toBe('Bugün');
    expect(formatRelativeDay('2026-09-24T09:00:00Z', NOW)).toBe('Dün');
    expect(formatRelativeDay('2026-09-22T09:00:00Z', NOW)).toBe('3 gün önce');
  });

  it('son başvuru etiketi', () => {
    expect(formatDeadline('2026-09-25T20:59:59Z', NOW)).toBe('Bugün bitiyor');
    expect(formatDeadline('2026-09-26T20:59:59Z', NOW)).toBe('Yarın bitiyor');
    expect(formatDeadline('2026-09-28T20:59:59Z', NOW)).toBe('3 gün kaldı');
    expect(formatDeadline('2026-09-24T20:59:59Z', NOW)).toBe('Süresi doldu');
    expect(formatDeadline('2026-10-30T20:59:59Z', NOW)).toBe('Son başvuru 30 Eki');
  });
});
