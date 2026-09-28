import { normalizeTr, trLower, trTitleCase, trUpper } from './turkish-normalization';

/**
 * Yalnızca GÖSTERİM için. Veri her zaman kaynaktaki haliyle saklanır.
 */

const ACRONYMS = new Set([
  'KPSS', 'EKPSS', 'ALES', 'YDS', 'YÖKDİL', 'BDDK', 'SGK', 'TÜBİTAK', 'İŞKUR', 'PTT', 'TCDD', 'AFAD', 'MEB', 'TRT',
  'BOTAŞ', 'TPAO', 'DSİ', 'MTA', 'EPDK', 'SPK', 'BTK', 'KİK', 'TMSF', 'TÜİK', 'TOKİ', 'SBB', 'YÖK', 'ÖSYM', 'TSK',
  'MKE', 'TEİAŞ', 'EÜAŞ', 'TKDK', 'KOSGEB', 'TİKA', 'AA', 'THY', 'BİLSEM', 'TC', 'T.C.', 'A.Ş.', 'AŞ', 'LTD', 'IT',
  'BT', 'İK', 'ARGE', 'AR-GE', 'KHK', 'DMK', 'UYAP', 'MHRS', 'ÇAYKUR', 'TMO', 'TİGEM', 'ASELSAN', 'TUSAŞ', 'HAVELSAN',
  'I', 'II', 'III', 'IV', 'V', 'VI',
]);
const LOWER_WORDS = new Set(['ve', 'ile', 'veya', 'için', 'de', 'da', 'ya', 'ki']);

function isMostlyUpper(text: string): boolean {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 4) return false;
  const upper = letters.filter((ch) => ch === trUpper(ch) && ch !== trLower(ch)).length;
  return upper / letters.length > 0.7;
}

/** "BÜRO PERSONELİ (KPSS P3)" → "Büro Personeli (KPSS P3)". Karışık yazılmış metne dokunmaz. */
export function displayCase(text: string | null | undefined): string {
  if (!text) return '';
  if (!isMostlyUpper(text)) return text;
  return text
    .split(/(\s+)/)
    .map((word, i) => {
      if (/^\s+$/.test(word)) return word;
      const bare = word.replace(/^[("'“]+|[)"'”,.:;]+$/g, '');
      const parenthesizedAbbreviation = /^[A-ZÇĞİÖŞÜ]{2,6}$/.test(bare) && /^\(.*\)[,.]?$/.test(word);
      if (ACRONYMS.has(bare) || /^P\d{1,3}$/.test(bare) || /^\d/.test(bare) || parenthesizedAbbreviation) {
        return word;
      }
      const lower = trLower(word);
      if (i > 0 && LOWER_WORDS.has(lower)) return lower;
      return trTitleCase(word);
    })
    .join('');
}

/**
 * Başlık kurum adıyla başlıyorsa ("KARAYOLLARI GENEL MÜDÜRLÜĞÜ - 50 İŞÇİ ALIMI") kurum kısmı atılır;
 * kurum zaten bir alt satırda gösteriliyor.
 */
export function displayTitle(title: string, organization: string | null): string {
  let t = title;
  if (organization) {
    const idx = title.indexOf(' - ');
    if (idx > 0 && normalizeTr(title.slice(0, idx)) === normalizeTr(organization)) {
      t = title.slice(idx + 3);
    }
  }
  return displayCase(t.trim());
}

export function displayOrganization(organization: string | null): string {
  return displayCase(organization);
}

/** 2148 → "2.148". Intl'e bağımlı değil. */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
