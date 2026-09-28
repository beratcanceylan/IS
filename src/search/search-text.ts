import type { NormalizedJob } from '@/domain/job';
import { escapeLike, foldTr, hasTurkishSpecificChars, normalizeTr } from '@/utils/turkish-normalization';

const MAX_BODY_CHARS = 4000;

export interface SearchColumns {
  headlineNorm: string;
  headlineFolded: string;
  searchText: string;
  searchFolded: string;
}

/**
 * DB'de saklanan arama kolonları. Başta/sonda boşluk vardır ki LIKE '% kelime%' kelime başını,
 * LIKE '% kelime %' tam kelimeyi bulsun.
 */
export function buildSearchColumns(job: NormalizedJob): SearchColumns {
  const headline = [job.title, job.organization].filter(Boolean).join(' ');
  const body = [
    headline,
    job.city,
    job.district,
    job.department,
    job.profession,
    job.employmentCategory,
    (job.description ?? '').slice(0, MAX_BODY_CHARS),
    (job.requirements ?? '').slice(0, MAX_BODY_CHARS),
  ]
    .filter(Boolean)
    .join(' ');
  const pad = (s: string) => (s ? ` ${s} ` : '');
  return {
    headlineNorm: pad(normalizeTr(headline)),
    headlineFolded: pad(foldTr(headline)),
    searchText: pad(normalizeTr(body)),
    searchFolded: pad(foldTr(body)),
  };
}

export interface KeywordMatch {
  /** Kullanılacak kolon: kullanıcı Türkçe karakter yazdıysa korunan, yazmadıysa katlanmış metin. */
  folded: boolean;
  /** LIKE deseni (ESCAPE '\'). */
  pattern: string;
}

/**
 * Anahtar kelime için LIKE deseni. 3 harf ve altı kelimeler tam kelime olarak aranır
 * ("IT" → "itfaiye" ile eşleşmesin); daha uzunlar kelime başı olarak ("bilgisayar" → "bilgisayarcı").
 */
export function keywordPattern(keyword: string): KeywordMatch | null {
  const folded = !hasTurkishSpecificChars(keyword);
  const n = folded ? foldTr(keyword) : normalizeTr(keyword);
  if (!n) return null;
  const escaped = escapeLike(n);
  return { folded, pattern: n.length <= 3 ? `% ${escaped} %` : `% ${escaped}%` };
}

/** Serbest metin araması (FTS yoksa) için kelime başı deseni; kısa kelimeler de önek olarak aranır. */
export function prefixPattern(token: string): KeywordMatch | null {
  const folded = !hasTurkishSpecificChars(token);
  const n = folded ? foldTr(token) : normalizeTr(token);
  if (!n) return null;
  return { folded, pattern: `% ${escapeLike(n)}%` };
}

/**
 * FTS5 MATCH ifadesi. Tokenlar yalnızca harf/rakamdan oluştuğu için (normalize sonrası)
 * tırnak içine almak enjeksiyona karşı yeterlidir. Tüm tokenlar önek olarak ve AND ile aranır.
 */
export function buildFtsQuery(query: string): string | null {
  const folded = !hasTurkishSpecificChars(query);
  const n = folded ? foldTr(query) : normalizeTr(query);
  if (!n) return null;
  const column = folded ? 'search_folded' : 'search_text';
  return n
    .split(' ')
    .filter(Boolean)
    .slice(0, 8)
    .map((t) => `${column} : "${t}"*`)
    .join(' AND ');
}
