const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ccedil: 'ç',
  Ccedil: 'Ç',
  ouml: 'ö',
  Ouml: 'Ö',
  uuml: 'ü',
  Uuml: 'Ü',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

export function decodeHtmlEntities(input: string): string {
  return input.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Boşlukları sadeleştirir; paragraf kırılımlarını (en fazla bir boş satır) korur. */
export function cleanWhitespace(input: string): string {
  return input
    .replace(/ /g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Kariyer Kapısı gibi kaynakların kullandığı BBCode ([b], [size=14pt], [url=..]) etiketlerini düz metne çevirir. */
export function stripBbcode(input: string): string {
  return input
    .replace(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, url: string, label: string) =>
      label.trim() && label.trim() !== url.trim() ? `${label} (${url})` : url,
    )
    .replace(/\[\*\]/g, '• ')
    .replace(/\[\/?(?:b|i|u|s|size|color|justify|center|left|right|font|list|quote|table|tr|td|th|img|sub|sup|hr|url)(?:=[^\]]*)?\]/gi, '');
}

export function stripHtml(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

export function truncate(input: string, max: number): string {
  if (input.length <= max) return input;
  const cut = input.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Deterministik, hızlı 32-bit FNV-1a özeti (hex). Kriptografik değildir; kimlik üretmek için yeterli. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** İki farklı tohumla 64-bit'e yakın çakışma direnci. */
export function stableId(input: string): string {
  return fnv1a(input) + fnv1a(`${input.length}:${input}`);
}
