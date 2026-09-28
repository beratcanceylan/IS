/**
 * Türkçe metin normalizasyonu.
 *
 * JavaScript'in `toLowerCase()`'i "I" → "i" ve "İ" → "i̇" (i + U+0307) üretir; Türkçe için
 * ikisi de yanlıştır. `toLocaleLowerCase('tr')` ise her JS motorunda (Hermes dahil) güvenilir
 * değildir. Bu yüzden dönüşüm burada açıkça yapılır.
 *
 * İki farklı seviye vardır:
 * - `normalizeTr`: Türkçe harfleri KORUR (ş ≠ s). Fingerprint ve dedup bunu kullanır.
 * - `foldTr`: Türkçe harfleri ASCII'ye katlar (ş → s). Yalnızca kontrollü yerlerde,
 *   örn. kullanıcı Türkçe klavye kullanmadan arama yaptığında, kullanılır.
 */

const COMBINING_DOT_ABOVE = /̇/g;

export function trLower(input: string): string {
  return input
    .normalize('NFC')
    .replaceAll('I', 'ı')
    .replaceAll('İ', 'i')
    .toLowerCase()
    .replaceAll(COMBINING_DOT_ABOVE, '');
}

export function trUpper(input: string): string {
  return input.normalize('NFC').replaceAll('i', 'İ').replaceAll('ı', 'I').toUpperCase();
}

/** Türkçe başlık biçimi: "TEKİRDAĞ BÜYÜKŞEHİR" → "Tekirdağ Büyükşehir". */
export function trTitleCase(input: string): string {
  // Kesme işaretinden sonra büyük harf yapılmaz: "Müdürlüğü'ne".
  return trLower(input).replaceAll(/(^|[\s\-/(."“])(\p{L})/gu, (_m, sep: string, ch: string) => sep + trUpper(ch));
}

// Harf ve rakam dışındaki her şey ayraç kabul edilir.
const NON_WORD = /[^\p{L}\p{N}]+/gu;

/** Karşılaştırma için normalize: küçük harf, noktalama → boşluk, tek boşluk. Türkçe harfler korunur. */
export function normalizeTr(input: string | null | undefined): string {
  if (!input) return '';
  return trLower(input).replaceAll(NON_WORD, ' ').trim();
}

const FOLD_MAP: Record<string, string> = {
  ç: 'c',
  ğ: 'g',
  ı: 'i',
  ö: 'o',
  ş: 's',
  ü: 'u',
  â: 'a',
  î: 'i',
  û: 'u',
};

/** ASCII katlama. `normalizeTr` sonrasında uygulanır. */
export function foldTr(input: string | null | undefined): string {
  return normalizeTr(input).replaceAll(/[çğıöşüâîû]/g, (ch) => FOLD_MAP[ch] ?? ch);
}

const TURKISH_SPECIFIC = /[çğıöşüÇĞİÖŞÜ]/;

/** Kullanıcı Türkçe'ye özgü karakter yazdı mı? Yazmadıysa arama katlanmış metinde yapılabilir. */
export function hasTurkishSpecificChars(input: string): boolean {
  return TURKISH_SPECIFIC.test(input);
}

export function tokenizeTr(input: string | null | undefined): string[] {
  const n = normalizeTr(input);
  return n ? n.split(' ') : [];
}

/** Kurum adlarındaki kalıp ekleri kaldırır; dedup ve gruplamada kullanılır. */
const ORG_NOISE = [
  'tc',
  't c',
  'türkiye cumhuriyeti',
  'başkanlığı',
  'başkanlığına',
  'müdürlüğü',
  'müdürlüğüne',
  'genel',
  'bakanlığı',
  'bakanlığına',
  'rektörlüğü',
  'rektörlüğüne',
  'a ş',
  'aş',
  'ltd',
  'şti',
];

export function normalizeOrganization(input: string | null | undefined): string {
  let n = ` ${normalizeTr(input)} `;
  for (const noise of ORG_NOISE) {
    n = n.split(` ${noise} `).join(' ');
  }
  return n.replaceAll(/\s+/g, ' ').trim();
}

/** LIKE sorgusunda `%`, `_` ve kaçış karakterini etkisizleştirir (ESCAPE '\\' ile kullanılır). */
export function escapeLike(input: string): string {
  return input.replaceAll(/[\\%_]/g, (ch) => `\\${ch}`);
}
