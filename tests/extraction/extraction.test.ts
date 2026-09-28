import { guessLocation } from '@/data/locations';
import { extractEducation } from '@/extraction/education';
import { extractKpss } from '@/extraction/kpss';
import {
  extractAge,
  extractDriverLicense,
  extractExperience,
  extractLegalStatus,
  extractPublicEmploymentType,
  extractQuotaFromTitle,
  extractSalary,
} from '@/extraction/requirements';

describe('extractKpss', () => {
  it('puan türü ve minimum puan', () => {
    const r = extractKpss('Adayların 2024 KPSS P3 puan türünden en az 70 puan almış olmaları gerekmektedir.');
    expect(r.required).toBe(true);
    expect(r.scoreTypes).toEqual(['P3']);
    expect(r.minimumScore).toBe(70);
    expect(r.year).toBe(2024);
  });

  it('birden fazla puan türü; en düşük eşik alınır', () => {
    const r = extractKpss(
      'Lisans mezunları için KPSSP3 puan türünden 70 ve üzeri, önlisans için KPSSP93 puan türünden 60 ve üzeri, ortaöğretim için KPSSP94 puanı.',
    );
    expect(r.scoreTypes.sort()).toEqual(['P3', 'P93', 'P94']);
    expect(r.minimumScore).toBe(60);
  });

  it('KPSS şartı aranmayan ilanlar', () => {
    expect(extractKpss('Bu alımda KPSS şartı aranmayacaktır.').required).toBe(false);
    expect(extractKpss('KPSS puanı şartı aranmaz.').required).toBe(false);
    expect(extractKpss("KPSS'siz personel alımı").required).toBe(false);
  });

  it('KPSS hiç geçmiyorsa bilinmiyor kabul edilir', () => {
    const r = extractKpss('Lise mezunu, B sınıfı ehliyet sahibi olmak.');
    expect(r.required).toBeNull();
    expect(r.scoreTypes).toEqual([]);
  });

  it('puan olmayan sayıları almaz', () => {
    const r = extractKpss('KPSS P3 puanı ile 35 yaşını doldurmamış 3 kişi alınacaktır.');
    expect(r.minimumScore).toBeNull();
    expect(r.scoreTypes).toEqual(['P3']);
  });
});

describe('extractEducation', () => {
  it('"yüksek lisans" ve "ön lisans"ı "lisans"tan ayırır', () => {
    expect(extractEducation('Yüksek lisans mezunu olmak')).toEqual(['master']);
    expect(extractEducation('Önlisans programlarından mezun olmak')).toEqual(['associate']);
    expect(extractEducation('Ön lisans veya lisans mezunu')).toEqual(['associate', 'bachelor']);
  });

  it('lise ve ilköğretim', () => {
    expect(extractEducation('En az lise mezunu olmak')).toEqual(['highSchool']);
    expect(extractEducation('İlköğretim mezunu olmak')).toEqual(['primary']);
    expect(extractEducation('ORTAÖĞRETİM (LİSE VE DENGİ) MEZUNU')).toEqual(['highSchool']);
  });

  it('eğitim bağlamı olmayan "lisans"ı almaz', () => {
    expect(extractEducation('Yazılım lisansı satın alınacaktır')).toEqual([]);
  });
});

describe('extractAge', () => {
  it('doldurmamış → N-1', () => {
    expect(extractAge('35 yaşını doldurmamış olmak')).toEqual({ min: null, max: 34 });
    expect(extractAge('30 yaşından gün almamış olmak')).toEqual({ min: null, max: 29 });
  });

  it('alt sınır ve aralık', () => {
    expect(extractAge('18 yaşını tamamlamış olmak')).toEqual({ min: 18, max: null });
    expect(extractAge('18-35 yaş arası')).toEqual({ min: 18, max: 35 });
  });
});

describe('diğer şartlar', () => {
  it('deneyim', () => {
    expect(extractExperience('En az 3 yıl deneyimli').yearsMin).toBe(3);
    expect(extractExperience('Tecrübe şartı aranmaz').yearsMin).toBe(0);
    expect(extractExperience('Ekip çalışmasına yatkın').yearsMin).toBeNull();
  });

  it('maaş yalnızca açık para birimiyle', () => {
    expect(extractSalary('Maaş: 30.000 TL - 35.000 TL')).toMatchObject({ min: 30000, max: 35000 });
    expect(extractSalary('Aylık net ücret ₺42.500')).toMatchObject({ min: 42500, max: 42500 });
    expect(extractSalary('Başvuru ücreti 250 TL')).toMatchObject({ min: null });
    expect(extractSalary('3 kişi alınacaktır')).toMatchObject({ min: null });
  });

  it('kadro sayısı', () => {
    expect(extractQuotaFromTitle('KARAYOLLARI GENEL MÜDÜRLÜĞÜ - 50 İŞÇİ ALIMI')).toBe(50);
    expect(extractQuotaFromTitle('3 ADET ÖĞRETİM ÜYESİ ALIMI')).toBe(3);
    expect(extractQuotaFromTitle('BEBKA - PERSONEL ALIM İLANI-2026')).toBeNull();
    expect(extractQuotaFromTitle('2026 YILI UZMAN YARDIMCISI ALIMI')).toBeNull();
  });

  it('kamu istihdam türü', () => {
    expect(extractPublicEmploymentType('Sözleşmeli Personel İlanları')).toBe('contracted');
    expect(extractPublicEmploymentType('A Grubu Memur (Kariyer Meslek)', 'SAYIŞTAY DENETÇİ YARDIMCISI ALIMI')).toBe('memur');
    expect(extractPublicEmploymentType('HAZİNE UZMAN YARDIMCISI ALIMI')).toBe('expertAssistant');
    expect(extractPublicEmploymentType('25 ÖĞRETİM ÜYESİ ALACAK')).toBe('academic');
    expect(extractPublicEmploymentType('Sürekli işçi alımı')).toBe('permanentWorker');
    expect(extractPublicEmploymentType('Yurt Dışı Eğitim İlanları')).toBeNull();
  });

  it('mevzuat ve ehliyet', () => {
    expect(extractLegalStatus("657 sayılı Devlet Memurları Kanunu'nun 4 üncü maddesinin (B) fıkrası")).toBe('657 s. DMK 4/B');
    expect(extractDriverLicense('En az B sınıfı sürücü belgesine sahip olmak')).toBe('B sınıfı');
  });
});

describe('guessLocation', () => {
  it('il adından', () => {
    expect(guessLocation('TEKİRDAĞ BÜYÜKŞEHİR BELEDİYESİ')).toMatchObject({ city: 'Tekirdağ', district: null });
    expect(guessLocation('KOCAELİ ÜNİVERSİTESİ')).toMatchObject({ city: 'Kocaeli' });
  });

  it('il + ilçe', () => {
    expect(guessLocation('Tekirdağ Çorlu Belediyesi')).toMatchObject({ city: 'Tekirdağ', district: 'Çorlu' });
  });

  it('tekil ilçe adından il çıkarır', () => {
    expect(guessLocation('ÇELTİK BELEDİYE BAŞKANLIĞI')).toMatchObject({ city: 'Konya', district: 'Çeltik' });
    expect(guessLocation('Çorlu Belediyesi')).toMatchObject({ city: 'Tekirdağ', district: 'Çorlu' });
  });

  it('adında il geçmeyen bilinen kurumlar', () => {
    expect(guessLocation('HACETTEPE ÜNİVERSİTESİ').city).toBe('Ankara');
    expect(guessLocation('AKDENİZ ÜNİVERSİTESİ').city).toBe('Antalya');
    expect(guessLocation('TEKİRDAĞ NAMIK KEMAL ÜNİVERSİTESİ').city).toBe('Tekirdağ');
  });

  it('yanıltıcı kurum adlarında tahmin yapmaz', () => {
    expect(guessLocation('AKDENİZ KALKINMA AJANSI').city).toBeNull();
    expect(guessLocation('KARAYOLLARI GENEL MÜDÜRLÜĞÜ').city).toBeNull();
    expect(guessLocation('Güney Marmara Kalkınma Ajansı').city).toBeNull();
    expect(guessLocation('İstanbul ve Ankara il müdürlükleri').city).toBeNull();
  });
});
