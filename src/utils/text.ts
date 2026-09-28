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
  return input.replaceAll(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const code = body[1] === 'x' || body[1] === 'X' ? Number.parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[body] ?? match;
  });
}

/** Boşlukları sadeleştirir; paragraf kırılımlarını (en fazla bir boş satır) korur. */
export function cleanWhitespace(input: string): string {
  return input
    .replaceAll(' ', ' ')
    .replaceAll(/\r\n?/g, '\n')
    .replaceAll(/[ \t\f\v]+/g, ' ')
    // Önceki adım boşluk dizilerini teke indirdiği için satır başı/sonunda en fazla bir boşluk kalır.
    .replaceAll(/ ?\n ?/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}

/** Kariyer Kapısı gibi kaynakların kullandığı BBCode ([b], [size=14pt], [url=..]) etiketlerini düz metne çevirir. */
export function stripBbcode(input: string): string {
  return input
    .replaceAll(/\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi, (_m, url: string, label: string) =>
      label.trim() && label.trim() !== url.trim() ? `${label} (${url})` : url,
    )
    .replaceAll('[*]', '• ')
    .replaceAll(/\[\/?([a-z]+)(?:=[^\]]*)?\]/gi, (tag, name: string) => (BBCODE_TAGS.has(name.toLowerCase()) ? '' : tag));
}

const BBCODE_TAGS = new Set([
  'b', 'i', 'u', 's', 'size', 'color', 'justify', 'center', 'left', 'right', 'font',
  'list', 'quote', 'table', 'tr', 'td', 'th', 'img', 'sub', 'sup', 'hr', 'url',
]);

/** Değişiklik kalmayana kadar uygular; iç içe/bölünmüş etiketler de temizlenir. */
function replaceUntilStable(input: string, pattern: RegExp, replacement: string): string {
  let previous: string;
  let current = input;
  do {
    previous = current;
    current = current.replace(pattern, replacement);
  } while (current !== previous);
  return current;
}

const BLOCK_OPEN = /<(script|style)/gi;

/** `<script>…</script>` ve `<style>…</style>` bloklarını içerikleriyle birlikte, soldan sağa atar. */
function removeScriptAndStyle(input: string): string {
  let out = '';
  let from = 0;
  BLOCK_OPEN.lastIndex = 0;
  for (let open = BLOCK_OPEN.exec(input); open; open = BLOCK_OPEN.exec(input)) {
    const close = new RegExp(`</${open[1]}>`, 'gi');
    close.lastIndex = open.index + open[0].length;
    const end = close.exec(input);
    if (!end) {
      BLOCK_OPEN.lastIndex = open.index + 1;
      continue;
    }
    out += input.slice(from, open.index);
    from = end.index + end[0].length;
    BLOCK_OPEN.lastIndex = from;
  }
  return out + input.slice(from);
}

export function stripHtml(input: string): string {
  return decodeHtmlEntities(
    replaceUntilStable(
      removeScriptAndStyle(input)
        .replaceAll(/<br\s*\/?>/gi, '\n')
        .replaceAll(/<\/(p|div|li|tr|h\d)>/gi, '\n'),
      /<[^>]+>/g,
      '',
    ),
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
  // split('') UTF-16 kod birimlerine böler; mevcut kimliklerin değişmemesi için bu korunmalı.
  for (const unit of input.split('')) {
    hash ^= unit.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** İki farklı tohumla 64-bit'e yakın çakışma direnci. */
export function stableId(input: string): string {
  return fnv1a(input) + fnv1a(`${input.length}:${input}`);
}
