/**
 * Tarih yardımcıları. DB'de her zaman ISO 8601 (UTC) saklanır; UI'da Türkçe gösterilir.
 *
 * Europe/Istanbul 2016'dan beri yaz saati uygulamadan sabit UTC+3'tür. Intl/timezone
 * desteği Hermes'te cihaza göre değiştiği için dönüşüm sabit ofsetle yapılır.
 * Kurallar değişirse tek değiştirilecek yer burasıdır.
 */

export const ISTANBUL_OFFSET_MINUTES = 180;
const OFFSET_MS = ISTANBUL_OFFSET_MINUTES * 60_000;
const DAY_MS = 86_400_000;

export const MONTHS_TR = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
] as const;

const MONTHS_SHORT_TR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'] as const;

// Normalize edilmiş (küçük harf, Türkçe korunmuş) ay adı/kısaltması → 0 tabanlı ay.
const MONTH_LOOKUP: Record<string, number> = {};
MONTHS_TR.forEach((name, i) => {
  const lower = lowerTrSimple(name);
  MONTH_LOOKUP[lower] = i;
  MONTH_LOOKUP[lower.slice(0, 3)] = i;
});
// Sık görülen ASCII yazımlar ve kısaltmalar.
Object.assign(MONTH_LOOKUP, {
  subat: 1,
  sub: 1,
  mayis: 4,
  agustos: 7,
  agu: 7,
  eylul: 8,
  kasim: 10,
  kas: 10,
  aralik: 11,
  haz: 5,
});

function lowerTrSimple(s: string): string {
  return s.replaceAll('I', 'ı').replaceAll('İ', 'i').toLowerCase().replaceAll('̇', '');
}

export interface IstanbulParts {
  year: number;
  month: number; // 0-11
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Pazar
}

/** Europe/Istanbul yerel saatinden ISO (UTC) üretir. */
export function istanbulToIso(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): string {
  return new Date(Date.UTC(year, month, day, hour, minute, second) - OFFSET_MS).toISOString();
}

export function toIstanbulParts(date: Date | string): IstanbulParts {
  const d = new Date(typeof date === 'string' ? date : date.getTime());
  const shifted = new Date(d.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** İstanbul saatine göre günün başlangıcı (UTC Date). */
export function startOfIstanbulDay(date: Date = new Date()): Date {
  const p = toIstanbulParts(date);
  return new Date(Date.UTC(p.year, p.month, p.day) - OFFSET_MS);
}

function isValidDay(year: number, month: number, day: number): boolean {
  if (month < 0 || month > 11 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCMonth() === month && d.getUTCDate() === day;
}

function normalizeYear(y: number): number {
  return y < 100 ? 2000 + y : y;
}

export interface ParseDateOptions {
  /** Saat yoksa günün sonunu (23:59:59) kullan. Son başvuru tarihleri için. */
  endOfDay?: boolean;
  /** Yılsız tarihlerde ("25 Eylül") yılı çıkarmak için referans. */
  reference?: Date;
}

const NUMERIC_DATE = /(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{2,4})(?:\D{1,3}(\d{1,2})[:.](\d{2}))?/;
const TEXT_DATE = /(\d{1,2})\s+([\p{L}]{3,8})\.?(?:\s+(\d{4}))?(?:[\s,]+(?:saat\s+)?(\d{1,2})[:.](\d{2}))?/u;
const ISO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Türkçe tarih biçimlerini ISO'ya çevirir:
 * 25.09.2026, 25/09/2026, 25-09-2026, 25 Eylül 2026, 25 Eyl 2026, 25 Eylül (yılsız),
 * isteğe bağlı saat ("25.09.2026 17:30", "25 Eylül 2026 saat 17.30").
 * Tanınmayan metinde `null` döner; asla tahmin üretmez.
 */
export function parseTurkishDate(text: string | null | undefined, opts: ParseDateOptions = {}): string | null {
  if (!text) return null;
  const input = text.trim();

  const iso = parseIsoLocal(input);
  if (iso) return iso;

  const num = NUMERIC_DATE.exec(input);
  if (num) {
    const day = Number(num[1]);
    const month = Number(num[2]) - 1;
    const year = normalizeYear(Number(num[3]));
    if (isValidDay(year, month, day)) {
      return withTime(year, month, day, num[4], num[5], opts.endOfDay);
    }
  }

  const txt = TEXT_DATE.exec(input);
  if (txt) {
    const day = Number(txt[1]);
    const month = MONTH_LOOKUP[lowerTrSimple(txt[2])];
    if (month !== undefined) {
      const year = txt[3] ? Number(txt[3]) : inferYear(month, day, opts.reference ?? new Date());
      if (isValidDay(year, month, day)) {
        return withTime(year, month, day, txt[4], txt[5], opts.endOfDay);
      }
    }
  }
  return null;
}

function withTime(
  year: number,
  month: number,
  day: number,
  hour: string | undefined,
  minute: string | undefined,
  endOfDay: boolean | undefined,
): string {
  if (hour !== undefined && minute !== undefined) {
    const h = Number(hour);
    const m = Number(minute);
    if (h <= 23 && m <= 59) return istanbulToIso(year, month, day, h, m);
  }
  return endOfDay ? istanbulToIso(year, month, day, 23, 59, 59) : istanbulToIso(year, month, day);
}

/** "2026-09-21T08:30:00" gibi ofsetsiz değerleri İstanbul saati kabul eder. */
export function parseIsoLocal(input: string): string | null {
  const m = ISO_LOCAL.exec(input.trim());
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', , zone] = m;
  if (zone) {
    const parsed = new Date(input.trim());
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const year = Number(y);
  const month = Number(mo) - 1;
  const day = Number(d);
  if (!isValidDay(year, month, day)) return null;
  return istanbulToIso(year, month, day, Number(h), Number(mi), Number(s));
}

const RFC822 =
  /^(?:[A-Za-z]{3},\s*)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s*([+-]\d{4}|GMT|UTC|Z)?$/;
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** RSS pubDate (RFC 822): "Mon, 21 Sep 2026 08:30:00 +0300". */
export function parseRfc822(input: string | null | undefined): string | null {
  if (!input) return null;
  const m = RFC822.exec(input.trim());
  if (!m) return null;
  const month = EN_MONTHS.indexOf(m[2].toLowerCase());
  if (month < 0) return null;
  const year = normalizeYear(Number(m[3]));
  const day = Number(m[1]);
  if (!isValidDay(year, month, day)) return null;
  let offsetMin = 0;
  const zone = m[7];
  if (zone && zone !== 'GMT' && zone !== 'UTC' && zone !== 'Z') {
    const sign = zone.startsWith('-') ? -1 : 1;
    offsetMin = sign * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5)));
  }
  const utc = Date.UTC(year, month, day, Number(m[4]), Number(m[5]), Number(m[6] ?? 0)) - offsetMin * 60_000;
  return new Date(utc).toISOString();
}

/**
 * Yılsız tarih için yıl çıkarımı: referansa en yakın yılı seçer (±6 ay).
 * Örn. referans Aralık 2026 iken "5 Ocak" → 2027.
 */
export function inferYear(month: number, day: number, reference: Date): number {
  const ref = toIstanbulParts(reference);
  const candidates = [ref.year - 1, ref.year, ref.year + 1];
  const refTime = Date.UTC(ref.year, ref.month, ref.day);
  let best = ref.year;
  let bestDiff = Infinity;
  for (const y of candidates) {
    const diff = Math.abs(Date.UTC(y, month, day) - refTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = y;
    }
  }
  return best;
}

export interface DateRange {
  start: string | null;
  end: string | null;
}

/**
 * "21 Eylül - 30 Eylül", "28 Aralık - 5 Ocak", "01.10.2026 - 15.10.2026" gibi aralıkları çözer.
 * Başlangıç yılı referansa göre çıkarılır; bitiş başlangıçtan önce kalıyorsa bir yıl ileri alınır.
 */
export function parseDateRange(text: string | null | undefined, reference: Date = new Date()): DateRange {
  if (!text) return { start: null, end: null };
  const cleaned = text.replaceAll(/[()]/g, ' ').trim();
  // Önce boşluklu ayraç ("21 Eylül - 30 Eylül"); yoksa yalnızca yıl ya da ay adından sonra gelen tire
  // ("01.10.2026-15.10.2026", "21 Eylül-30 Eylül"). "25-09-2026" içindeki tireler bölünmez.
  let parts = cleaned.split(/\s+[-–—]\s+/);
  if (parts.length < 2) parts = cleaned.split(/(?<=\d{4})\s*[-–—]\s*|(?<=\p{L})\s*[-–—]\s*(?=\d)/u);
  parts = parts.map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { start: null, end: null };
  const start = parseTurkishDate(parts[0], { reference });
  if (!start) return { start: null, end: null };
  let end = parseTurkishDate(parts[1], { reference: new Date(start), endOfDay: true });
  if (end && end < start) {
    const p = toIstanbulParts(end);
    end = istanbulToIso(p.year + 1, p.month, p.day, 23, 59, 59);
  }
  return { start, end };
}

// ---------------------------------------------------------------------------
// Gösterim

export function formatShortDate(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const p = toIstanbulParts(iso);
  const n = toIstanbulParts(now);
  const base = `${p.day} ${MONTHS_SHORT_TR[p.month]}`;
  return p.year === n.year ? base : `${base} ${p.year}`;
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = toIstanbulParts(iso);
  return `${p.day} ${MONTHS_TR[p.month]} ${p.year}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = toIstanbulParts(iso);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const p = toIstanbulParts(iso);
  const hasTime = p.hour !== 0 || p.minute !== 0;
  return hasTime ? `${formatLongDate(iso)} ${formatTime(iso)}` : formatLongDate(iso);
}

/** İstanbul takvim günü farkı: bugün 0, yarın 1, dün -1. */
export function calendarDaysFrom(iso: string, now: Date = new Date()): number {
  const target = startOfIstanbulDay(new Date(iso)).getTime();
  const today = startOfIstanbulDay(now).getTime();
  return Math.round((target - today) / DAY_MS);
}

/** "Bugün", "Dün", "3 gün önce", "12 Eyl". */
export function formatRelativeDay(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const diff = calendarDaysFrom(iso, now);
  if (diff === 0) return 'Bugün';
  if (diff === -1) return 'Dün';
  if (diff < 0 && diff >= -6) return `${-diff} gün önce`;
  return formatShortDate(iso, now);
}

/** Son başvuru etiketi: "Bugün bitiyor", "Yarın bitiyor", "3 gün kaldı", "Süresi doldu". */
export function formatDeadline(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  if (new Date(iso).getTime() < now.getTime()) return 'Süresi doldu';
  const diff = calendarDaysFrom(iso, now);
  if (diff === 0) return 'Bugün bitiyor';
  if (diff === 1) return 'Yarın bitiyor';
  if (diff <= 7) return `${diff} gün kaldı`;
  return `Son başvuru ${formatShortDate(iso, now)}`;
}

/** "14:32", "Dün 09:10", "12 Eyl" gibi son güncelleme etiketi. */
export function formatLastUpdated(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return 'Henüz güncellenmedi';
  const diff = calendarDaysFrom(iso, now);
  if (diff === 0) return formatTime(iso);
  if (diff === -1) return `Dün ${formatTime(iso)}`;
  return formatShortDate(iso, now);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysAgoIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}
