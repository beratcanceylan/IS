import type { EmploymentType, PublicEmploymentType, WorkModel } from '@/domain/job';
import { normalizeTr } from '@/utils/turkish-normalization';

// Not: tüm regex'ler `normalizeTr` çıktısı (küçük harf, noktalama yerine boşluk) üzerinde çalışır.
// Kelime başı için `(?<!\S)` kullanılır; JS'de `\b` Türkçe harflerde çalışmaz.

export interface AgeExtraction {
  min: number | null;
  max: number | null;
}

/**
 * "35 yaşını doldurmamış" → max 34, "18 yaşını tamamlamış" → min 18,
 * "18-35 yaş arası" → 18..35, "en fazla 30 yaşında" → max 30.
 * "Doldurmamış / gün almamış" ifadeleri o yaşın altı anlamına geldiği için N-1 saklanır.
 */
const isValidAge = (v: number) => v >= 15 && v <= 70;

/** Eşleşmelerdeki ilk dolu gruptan geçerli yaşları toplar. */
function agesFrom(n: string, re: RegExp): number[] {
  const ages: number[] = [];
  for (const m of n.matchAll(re)) {
    const v = Number(m.slice(1).find((g) => g !== undefined));
    if (isValidAge(v)) ages.push(v);
  }
  return ages;
}

function ageRange(n: string): AgeExtraction | null {
  const range = /(?<!\S)(\d{2}) (?:ile )?(\d{2}) yaş (?:arası|aralığında)/u.exec(n);
  if (!range) return null;
  const a = Number(range[1]);
  const b = Number(range[2]);
  return isValidAge(a) && isValidAge(b) && a < b ? { min: a, max: b } : null;
}

export function extractAge(text: string | null | undefined): AgeExtraction {
  const n = normalizeTr(text);
  if (!n.includes('yaş')) return { min: null, max: null };

  const range = ageRange(n);
  if (range) return range;

  const maxima = [
    ...agesFrom(n, /(?<!\S)(\d{2}) yaşını (?:doldurmamış|bitirmemiş)|(?<!\S)(\d{2}) yaşından gün almamış|(?<!\S)(\d{2}) yaşından (?:büyük|fazla) olmamak/gu).map((v) => v - 1),
    ...agesFrom(n, /en fazla (\d{2}) yaş/gu),
  ];
  const minima = agesFrom(n, /(?<!\S)(\d{2}) yaşını (?:tamamlamış|doldurmuş|bitirmiş)|en az (\d{2}) yaş/gu);
  const max = maxima.length ? Math.min(...maxima) : null;
  const min = minima.length ? Math.max(...minima) : null;
  if (min !== null && max !== null && min > max) return { min: null, max: null };
  return { min, max };
}

export interface ExperienceExtraction {
  text: string | null;
  yearsMin: number | null;
}

export function extractExperience(text: string | null | undefined): ExperienceExtraction {
  const n = normalizeTr(text);
  if (!n) return { text: null, yearsMin: null };
  if (/(?:deneyim|tecrübe)(?: şartı)? (?:aranmaz|aranmamaktadır|aranmayacaktır|gerekmez)|deneyimsiz|tecrübesiz/u.test(n)) {
    return { text: 'Deneyim şartı yok', yearsMin: 0 };
  }
  const m = /(?:en az|minimum|asgari) (\d{1,2}) (?:yıl|sene)\p{L}*(?: \p{L}+){0,3} (?:deneyim|tecrübe|mesleki|iş)/u.exec(n)
    ?? /(?<!\S)(\d{1,2}) (?:yıl|sene)\p{L}* (?:deneyim|tecrübe)/u.exec(n);
  if (m) {
    const years = Number(m[1]);
    if (years >= 0 && years <= 40) return { text: `En az ${years} yıl deneyim`, yearsMin: years };
  }
  return { text: null, yearsMin: null };
}

export interface SalaryExtraction {
  min: number | null;
  max: number | null;
  text: string | null;
}

/** Yalnızca açık para birimi (TL, ₺) olan değerleri okur. "25.000 - 30.000 TL", "₺35.000". */
export function extractSalary(text: string | null | undefined): SalaryExtraction {
  if (!text) return { min: null, max: null, text: null };
  const num = String.raw`(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})(?:,\d{1,2})?`;
  const range = new RegExp(String.raw`(?:₺\s*)?${num}\s*(?:TL|₺)?\s*[-–]\s*(?:₺\s*)?${num}\s*(?:TL|₺|türk lirası)`, 'iu').exec(text)
    ?? new RegExp(String.raw`₺\s*${num}\s*[-–]\s*₺?\s*${num}`, 'iu').exec(text);
  const toNumber = (s: string) => Number(s.replaceAll(/[.\s]/g, ''));
  if (range) {
    const a = toNumber(range[1]);
    const b = toNumber(range[2]);
    if (a > 0 && b >= a) return { min: a, max: b, text: range[0].trim() };
  }
  const single = new RegExp(String.raw`₺\s*${num}|${num}\s*(?:TL|₺|türk lirası)`, 'iu').exec(text);
  if (single) {
    const v = toNumber(single[1] ?? single[2]);
    // Maaş dışı tutarları (ücret iadesi, teminat) elemek için yakın bağlam kontrolü.
    const window = normalizeTr(text.slice(Math.max(0, single.index - 60), single.index + single[0].length + 20));
    if (v >= 5000 && /maaş|ücret|brüt|net|aylık/u.test(window)) return { min: v, max: v, text: single[0].trim() };
  }
  return { min: null, max: null, text: null };
}

/**
 * Başlıktan kadro sayısı: "KARAYOLLARI GENEL MÜDÜRLÜĞÜ - 50 İŞÇİ ALIMI" → 50,
 * "3 ADET ÖĞRETİM ÜYESİ ALACAK" → 3. Yıl gibi görünen sayılar (2026) alınmaz.
 */
export function extractQuotaFromTitle(title: string | null | undefined): number | null {
  const n = normalizeTr(title);
  const m = /(?:^| )(\d{1,4}) (?:adet |kişi |kişilik |kadro )?(?!yıl|yılı|sayılı|puan|yaş)\p{L}/u.exec(n);
  if (!m) return null;
  const v = Number(m[1]);
  if (v <= 0 || (v >= 1900 && v <= 2100)) return null;
  return v;
}

const PUBLIC_TYPE_RULES: [PublicEmploymentType, RegExp][] = [
  ['expertAssistant', /uzman yardımcı/u],
  ['inspectorAssistant', /(?:müfettiş|denetçi|denetmen|kontrolör) yardımcı/u],
  ['academic', /öğretim üyesi|öğretim elemanı|öğretim görevlisi|araştırma görevlisi|akademik personel|doçent|profesör|doktor öğretim/u],
  ['contractedIT', /bilişim personeli|375 sayılı .*ek 6|sözleşmeli bilişim/u],
  ['contracted', /sözleşmeli/u],
  ['permanentWorker', /sürekli işçi|süresi belirli olmayan|belirsiz süreli/u],
  ['temporaryWorker', /geçici işçi|süreli işçi|mevsimlik işçi|süresi belirli/u],
  ['memur', /(?<!\S)memur|kadrolu|a grubu|b grubu/u],
];

/**
 * Kamu istihdam türü. Kaynağın kategori etiketi ve başlık önceliklidir; ilan metni ek sinyaldir.
 * Hiçbir kural eşleşmezse null döner.
 */
export function extractPublicEmploymentType(...texts: (string | null | undefined)[]): PublicEmploymentType | null {
  for (const t of texts) {
    const n = normalizeTr(t);
    if (!n) continue;
    for (const [type, re] of PUBLIC_TYPE_RULES) {
      if (re.test(n)) return type;
    }
  }
  return null;
}

/** Mevzuat/statü: "657 sayılı Devlet Memurları Kanunu'nun 4/B" gibi. */
export function extractLegalStatus(text: string | null | undefined): string | null {
  if (!text) return null;
  const n = normalizeTr(text);
  if (/657 sayılı[\s\S]{0,80}4 (?:üncü )?madde\p{L}* b|4 b maddesi|(?<!\S)4 b (?:sözleşmeli|statü)/u.test(n)) return '657 s. DMK 4/B';
  if (/657 sayılı[\s\S]{0,80}4 (?:üncü )?madde\p{L}* a|(?<!\S)4 a (?:kadro|statü)/u.test(n)) return '657 s. DMK 4/A';
  if (/657 sayılı[\s\S]{0,80}4 (?:üncü )?madde\p{L}* d|(?<!\S)4 d (?:kadro|statü|işçi)/u.test(n)) return '4/D işçi';
  if (/375 sayılı/u.test(n)) return '375 s. KHK';
  if (/2547 sayılı/u.test(n)) return '2547 s. YÖK Kanunu';
  return null;
}

export function extractEmploymentType(...texts: (string | null | undefined)[]): EmploymentType {
  const n = texts.map(normalizeTr).join(' ');
  if (/(?<!\S)staj\p{L}*|stajyer/u.test(n)) return 'internship';
  if (/yarı zamanlı|part time/u.test(n)) return 'partTime';
  if (/sezonluk|mevsimlik/u.test(n)) return 'seasonal';
  if (/geçici işçi|geçici süreli/u.test(n)) return 'temporary';
  if (/sözleşmeli/u.test(n)) return 'contract';
  if (/tam zamanlı|full time|sürekli işçi|kadrolu/u.test(n)) return 'fullTime';
  return 'unknown';
}

export function extractWorkModel(...texts: (string | null | undefined)[]): WorkModel {
  const n = texts.map(normalizeTr).join(' ');
  if (/hibrit|hybrid/u.test(n)) return 'hybrid';
  if (/uzaktan çalış|remote|evden çalış/u.test(n)) return 'remote';
  return 'unknown';
}

export function extractDriverLicense(text: string | null | undefined): string | null {
  const n = normalizeTr(text);
  // İki kalıptan metinde önce geçen kullanılır (tek alternation ile aynı davranış).
  const classFirst = /(?<!\S)([a-e][1-2]?|b1|c1|d1|ce|de|g) sınıfı (?:sürücü belgesi|ehliyet)/u.exec(n);
  const licenseFirst = /(?:sürücü belgesi|ehliyet)\p{L}* \(?([a-e][1-2]?|ce|de|g)\)? sınıf/u.exec(n);
  const m = [classFirst, licenseFirst]
    .filter((match) => match !== null)
    .reduce<RegExpExecArray | null>((best, match) => (best === null || match.index < best.index ? match : best), null);
  if (!m) return null;
  return `${m[1].toUpperCase()} sınıfı`;
}

export function extractMilitary(text: string | null | undefined): string | null {
  const n = normalizeTr(text);
  if (/askerlik (?:hizmetini )?(?:yapmış|tamamlamış|muaf|tecilli)|askerlikle ilişiği/u.test(n)) {
    return 'Askerlikle ilişiği olmamak';
  }
  return null;
}

export function extractForeignLanguage(text: string | null | undefined): string | null {
  const n = normalizeTr(text);
  const m = /(?<!\S)(yds|e yds|yökdil|toefl|ielts)(?: \p{L}+){0,4}? (?:en az )?\(?(\d{2,3})\)?/u.exec(n);
  if (m) return `${m[1].toUpperCase().replace('E YDS', 'e-YDS')} ${m[2]}`;
  if (/yabancı dil (?:bilgisi|şartı|seviyesi)/u.test(n)) return 'Yabancı dil şartı var';
  return null;
}

export function extractAles(text: string | null | undefined): string | null {
  const n = normalizeTr(text);
  const m = /(?<!\S)ales(?: \p{L}+){0,4}? (?:en az )?\(?(\d{2,3})\)?/u.exec(n);
  if (m) {
    const v = Number(m[1]);
    if (v >= 40 && v <= 100) return `ALES ${v}`;
  }
  return /(?<!\S)ales(?!\S)/u.test(n) ? 'ALES şartı var' : null;
}
