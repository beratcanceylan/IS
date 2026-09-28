import {
  escapeLike,
  foldTr,
  hasTurkishSpecificChars,
  normalizeOrganization,
  normalizeTr,
  trLower,
  trTitleCase,
  trUpper,
} from '@/utils/turkish-normalization';

describe('trLower / trUpper', () => {
  it('İ/I/ı/i dönüşümünü Türkçe kurallarla yapar', () => {
    expect(trLower('İSTANBUL')).toBe('istanbul');
    expect(trLower('ISPARTA')).toBe('ısparta');
    expect(trLower('BİLGİ İŞLEM')).toBe('bilgi işlem');
    expect(trUpper('bilgi işlem')).toBe('BİLGİ İŞLEM');
    expect(trUpper('ılgaz')).toBe('ILGAZ');
  });

  it('JS varsayılanının ürettiği birleşik noktayı (U+0307) bırakmaz', () => {
    expect(trLower('İ')).toHaveLength(1);
    // I + U+0307, NFC'de İ'dir.
    expect(trLower('İ')).toBe('i');
  });

  it('başlık biçimi', () => {
    expect(trTitleCase('TEKİRDAĞ BÜYÜKŞEHİR BELEDİYESİ')).toBe('Tekirdağ Büyükşehir Belediyesi');
    expect(trTitleCase('ISPARTA İL MÜDÜRLÜĞÜ')).toBe('Isparta İl Müdürlüğü');
  });
});

describe('normalizeTr', () => {
  it('büyük/küçük harf ve noktalama farkını kaldırır', () => {
    expect(normalizeTr('BİLGİ İŞLEM')).toBe(normalizeTr('bilgi  işlem'));
    expect(normalizeTr('  Büro Personeli (3 kişi)! ')).toBe('büro personeli 3 kişi');
    expect(normalizeTr("TEKİRDAĞ'DA")).toBe('tekirdağ da');
  });

  it('Türkçe harfleri korur: ş ≠ s', () => {
    expect(normalizeTr('şoför')).not.toBe(normalizeTr('sofor'));
    expect(normalizeTr('ışık')).toBe('ışık');
  });
});

describe('foldTr', () => {
  it('yalnızca açıkça istendiğinde ASCII katlar', () => {
    expect(foldTr('Şoför Çağrı İĞDIR')).toBe('sofor cagri igdir');
  });

  it('Türkçe karakter tespiti', () => {
    expect(hasTurkishSpecificChars('bilgi islem')).toBe(false);
    expect(hasTurkishSpecificChars('bilgi işlem')).toBe(true);
  });
});

describe('normalizeOrganization', () => {
  it('kurum eklerini atar', () => {
    expect(normalizeOrganization('T.C. KARAYOLLARI GENEL MÜDÜRLÜĞÜ')).toBe('karayolları');
    expect(normalizeOrganization('Çeltik Belediye Başkanlığı')).toBe('çeltik belediye');
  });
});

describe('escapeLike', () => {
  it('LIKE jokerlerini kaçışlar', () => {
    expect(escapeLike('%50_indirim\\')).toBe('\\%50\\_indirim\\\\');
  });
});
