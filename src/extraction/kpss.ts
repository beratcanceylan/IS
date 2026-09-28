import type { KpssScoreType } from '@/domain/job';
import { trUpper } from '@/utils/turkish-normalization';

export interface KpssExtraction {
  /** true: şart var, false: açıkça aranmıyor, null: belirsiz / karışık. */
  required: boolean | null;
  scoreTypes: KpssScoreType[];
  minimumScore: number | null;
  year: number | null;
  /** Eşleşen metin parçaları; detay ekranında "neden" olarak gösterilebilir. */
  evidence: string[];
}

// Not: JS'de `\w` Türkçe harfleri kapsamaz; bu yüzden `\p{L}` kullanılır.
// "KPSS şartı aranmaz", "KPSS puanı şartı aranmayacaktır", "KPSS şartı olmaksızın", "KPSS'siz"
// "KPSS (B) grubu puanı" gibi isteğe bağlı ara ifade ve "şartı aranmaz" gibi olumsuz bitiş.
const NEGATIVE_SUBJECT = String.raw`KPSS\s*(?:\(?[A-Z]\)?\s*grubu\s*)?(?:puan\p{L}*\s*)?`;
const NEGATIVE_CONDITION = String.raw`(?:şart|koşul)\p{L}*\s*(?:(?:aranma|bulunma|yok)\p{L}*|olmaksızın)`;
const NEGATIVE = [
  new RegExp(NEGATIVE_SUBJECT + NEGATIVE_CONDITION, 'iu'),
  /KPSS['’]?s(?:i|ı)z/iu,
  /KPSS\s*(?:puanı|belgesi|sonucu)\s*(?:istenme|aranma)\p{L}*/iu,
];

// P3, P93, P94, KPSSP3, KPSS-P3, KPSS P121 vb. "P" öncesinde harf/rakam olmamalı.
const SCORE_TYPE = /(?<![\p{L}\d])(?:KPSS\s*(?:[-–]\s*)?)?P\s?(\d{1,3})(?!\d)/giu;
const KNOWN_TYPES = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '93', '94', '121']);

// Puan: "en az 70", "70 ve üzeri", "asgari 70", "70 (yetmiş) puan almış", "taban puanı 60".
const SCORE_PATTERNS = [
  /(?:en\s+az|asgari|minimum|taban\s+puan\p{L}*)\s*(?:[:=]\s*)?(\d{2,3}(?:[.,]\d{1,5})?)/giu,
  /(\d{2,3}(?:[.,]\d{1,5})?)\s*(?:\([\p{L}\s]+\)\s*)?(?:puan\s+)?ve\s+(?:üzeri|üstü)/giu,
  /(\d{2,3}(?:[.,]\d{1,5})?)\s*(?:\([\p{L}\s]+\)\s*)?puan(?:\s+almış|\s+alan|ı\s+olan)/giu,
];

const YEAR_PATTERNS = [/(20\d{2})\s*(?:yılı\s*)?KPSS/iu, /KPSS\s*(?:[-–]\s*)?(20\d{2})/iu];

const REQUIRED_HINTS = /KPSS[\s\S]{0,40}(?:puan|sonuç\s+belgesi|sınavına\s+girmiş|P\s?\d)/iu;

interface NegativeScan {
  negative: boolean;
  /** Negatif ifadeler çıkarılmış metin. */
  rest: string;
}

// Pozitif sinyaller, negatif ifadeler çıkarılmış metinde aranır; aksi halde
// "KPSS puanı şartı aranmaz" cümlesi "puan" geçtiği için şart var sayılırdı.
function scanNegatives(text: string, evidence: string[]): NegativeScan {
  let negative = false;
  let rest = text;
  for (const re of NEGATIVE) {
    const global = new RegExp(re.source, 'giu');
    for (const m of text.matchAll(global)) {
      negative = true;
      evidence.push(m[0]);
    }
    rest = rest.replace(global, ' ');
  }
  return { negative, rest };
}

function contextAround(text: string, match: RegExpMatchArray, before: number, after: number): string {
  const idx = match.index ?? 0;
  return trUpper(text.slice(Math.max(0, idx - before), idx + match[0].length + after));
}

function collectScoreTypes(rest: string, evidence: string[]): Set<KpssScoreType> {
  const scoreTypes = new Set<KpssScoreType>();
  for (const m of rest.matchAll(SCORE_TYPE)) {
    // Yalnızca KPSS/puan bağlamında (±60 karakter) geçen P kodları sayılır.
    const window = contextAround(rest, m, 60, 60);
    const n = m[1];
    if ((!window.includes('KPSS') && !window.includes('PUAN')) || !KNOWN_TYPES.has(n)) continue;
    scoreTypes.add(n === '121' ? 'KPSSP121' : (`P${n}` as KpssScoreType));
    evidence.push(m[0].trim());
  }
  return scoreTypes;
}

function collectScores(rest: string, evidence: string[]): number[] {
  const scores: number[] = [];
  for (const re of SCORE_PATTERNS) {
    for (const m of rest.matchAll(re)) {
      const window = contextAround(rest, m, 120, 40);
      if (!window.includes('KPSS') && !/P\s?\d/.test(window)) continue;
      const value = Number(m[1].replace(',', '.'));
      // KPSS puanları 40-100 arasındadır; yaş, kadro gibi diğer sayılar elenir.
      if (value >= 40 && value <= 100) {
        scores.push(value);
        evidence.push(m[0].trim());
      }
    }
  }
  return scores;
}

function extractYear(text: string): number | null {
  let year: number | null = null;
  for (const re of YEAR_PATTERNS) {
    const y = Number(re.exec(text)?.[1]);
    if (y >= 2010 && y <= 2100) year = Math.max(year ?? y, y);
  }
  return year;
}

function decideRequired(positive: boolean, negative: boolean): boolean | null {
  if (positive === negative) return null;
  return positive;
}

/**
 * KPSS şartını ilan metninden çıkarır. Emin olunamayan durumda `required` null kalır.
 * Metinde "KPSS" hiç geçmiyorsa hiçbir sonuç üretilmez (şart yok anlamına gelmez).
 */
export function extractKpss(text: string | null | undefined): KpssExtraction {
  const empty: KpssExtraction = { required: null, scoreTypes: [], minimumScore: null, year: null, evidence: [] };
  if (!text || !trUpper(text).includes('KPSS')) return empty;

  const evidence: string[] = [];
  const { negative, rest } = scanNegatives(text, evidence);
  const scoreTypes = collectScoreTypes(rest, evidence);
  const scores = collectScores(rest, evidence);
  const positive = scoreTypes.size > 0 || scores.length > 0 || REQUIRED_HINTS.test(rest);

  return {
    required: decideRequired(positive, negative),
    scoreTypes: [...scoreTypes],
    minimumScore: scores.length ? Math.min(...scores) : null,
    year: extractYear(text),
    evidence,
  };
}

export function formatKpssType(t: string): string {
  if (t === 'KPSSP121') return 'P121';
  if (t === 'P3_EKPSS') return 'EKPSS';
  return t;
}
