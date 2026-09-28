import { displayCase, displayTitle, formatCount } from '@/utils/display';

describe('displayCase', () => {
  it('büyük harfli başlığı Türkçe kurallarla düzeltir, kısaltmaları korur', () => {
    expect(displayCase('BÜRO PERSONELİ ALIMI')).toBe('Büro Personeli Alımı');
    expect(displayCase('KPSS P3 İLE 25 SÖZLEŞMELİ PERSONEL')).toBe('KPSS P3 ile 25 Sözleşmeli Personel');
    expect(displayCase('BURSA ESKİŞEHİR BİLECİK KALKINMA AJANSI (BEBKA)')).toBe('Bursa Eskişehir Bilecik Kalkınma Ajansı (BEBKA)');
    expect(displayCase("KARAYOLLARI GENEL MÜDÜRLÜĞÜ'NE")).toBe("Karayolları Genel Müdürlüğü'ne");
    expect(displayCase('ISPARTA İL MÜDÜRLÜĞÜ')).toBe('Isparta İl Müdürlüğü');
  });

  it('karışık yazılmış metne dokunmaz', () => {
    expect(displayCase('Frontend Developer (React)')).toBe('Frontend Developer (React)');
  });
});

describe('displayTitle', () => {
  it('kurum önekini atar', () => {
    expect(displayTitle('KARAYOLLARI GENEL MÜDÜRLÜĞÜ - 50 İŞÇİ ALIMI', 'KARAYOLLARI GENEL MÜDÜRLÜĞÜ')).toBe('50 İşçi Alımı');
    expect(displayTitle('50 İŞÇİ ALACAK', 'KARAYOLLARI GENEL MÜDÜRLÜĞÜ')).toBe('50 İşçi Alacak');
  });
});

it('formatCount', () => {
  expect(formatCount(2148)).toBe('2.148');
  expect(formatCount(1234567)).toBe('1.234.567');
  expect(formatCount(12)).toBe('12');
});
