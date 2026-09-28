import provincesJson from '@/assets/data/provinces.json';
import { foldTr, normalizeTr } from '@/utils/turkish-normalization';

export interface Province {
  plate: number;
  name: string;
  districts: string[];
}

export const PROVINCES: readonly Province[] = provincesJson as Province[];

const byPlate = new Map<number, Province>(PROVINCES.map((p) => [p.plate, p]));

export function getProvince(plate: number): Province | undefined {
  return byPlate.get(plate);
}

const provinceByNormalized = new Map<string, Province>();
for (const p of PROVINCES) {
  provinceByNormalized.set(normalizeTr(p.name), p);
}
// Resmî adı dışında yaygın kullanılan adlar.
const PROVINCE_ALIASES: Record<string, number> = {
  afyon: 3,
  maraş: 46,
  urfa: 63,
  antep: 27,
  içel: 33,
  'k maraş': 46,
};
for (const [alias, plate] of Object.entries(PROVINCE_ALIASES)) {
  const p = byPlate.get(plate);
  if (p) provinceByNormalized.set(alias, p);
}

export function findProvinceByName(name: string | null | undefined): Province | undefined {
  if (!name) return undefined;
  const n = normalizeTr(name);
  return provinceByNormalized.get(n) ?? PROVINCES.find((p) => foldTr(p.name) === foldTr(name));
}

/**
 * İlçe adı → iller. Aynı ilçe adı birden fazla ilde varsa (örn. "Yenice") liste uzun olur;
 * metinden çıkarımda yalnızca tekil ilçeler kullanılır.
 */
/**
 * Metinden çıkarımda kullanılmayan ilçe adları: genel kelimeler ("güney", "çay", "genç")
 * ve başka ildeki kurum adlarında geçenler ("Akdeniz Üniversitesi" Antalya'da, Akdeniz ilçesi
 * Mersin'de; "Selçuk Üniversitesi" Konya'da, Selçuk ilçesi İzmir'de).
 * Yanlış konum, boş konumdan daha zararlıdır.
 */
const AMBIGUOUS_DISTRICT_WORDS = new Set([
  'merkez', 'güney', 'bahçe', 'ulus', 'çay', 'kiraz', 'bor', 'tut', 'sur', 'of', 'selim', 'genç', 'evren',
  'bala', 'çubuk', 'çiftlik', 'defne', 'belen', 'ceyhan', 'imamoğlu', 'mut', 'kaş', 'kale', 'akdeniz',
  'marmara', 'yıldırım', 'selçuk', 'inönü', 'menderes', 'fatih', 'kartal', 'hassa', 'eğil', 'lice',
  'kulp', 'palu', 'kemah', 'havza', 'ilıca', 'arsin', 'uzundere', 'derik', 'idil', 'emet', 'honaz',
  'altınova', 'yenişehir', 'kocaali', 'saray', 'pazar', 'kemer', 'ağın', 'çat', 'bozkurt', 'yeşilyurt',
]);

const districtIndex = new Map<string, { plate: number; name: string }[]>();
for (const p of PROVINCES) {
  for (const d of p.districts) {
    const key = normalizeTr(d);
    // İl adıyla aynı olan ilçeler de çıkarımda yanıltıcıdır.
    if (AMBIGUOUS_DISTRICT_WORDS.has(key) || provinceByNormalized.has(key)) continue;
    const list = districtIndex.get(key) ?? [];
    list.push({ plate: p.plate, name: d });
    districtIndex.set(key, list);
  }
}

/**
 * Adında il geçmeyen, yeri kesin bilinen kurumlar (çoğunlukla devlet üniversiteleri).
 * Anahtar `normalizeTr` biçiminde ve metinde ardışık kelimeler olarak aranır.
 * Emin olunmayan kurum eklenmez: yanlış konum, boş konumdan kötüdür.
 */
const ORGANIZATION_HINTS: [string, number][] = [
  ['hacettepe üniversitesi', 6], ['orta doğu teknik üniversitesi', 6], ['gazi üniversitesi', 6], ['bilkent üniversitesi', 6],
  ['ankara hacı bayram veli üniversitesi', 6], ['ankara yıldırım beyazıt üniversitesi', 6], ['ankara sosyal bilimler üniversitesi', 6],
  ['boğaziçi üniversitesi', 34], ['marmara üniversitesi', 34], ['mimar sinan güzel sanatlar üniversitesi', 34],
  ['yıldız teknik üniversitesi', 34], ['galatasaray üniversitesi', 34], ['türk alman üniversitesi', 34], ['sağlık bilimleri üniversitesi', 34],
  ['ege üniversitesi', 35], ['dokuz eylül üniversitesi', 35], ['katip çelebi üniversitesi', 35],
  ['uludağ üniversitesi', 16], ['akdeniz üniversitesi', 7], ['alanya alaaddin keykubat üniversitesi', 7],
  ['çukurova üniversitesi', 1], ['dicle üniversitesi', 21], ['harran üniversitesi', 63], ['fırat üniversitesi', 23],
  ['inönü üniversitesi', 44], ['atatürk üniversitesi', 25], ['ondokuz mayıs üniversitesi', 55], ['karadeniz teknik üniversitesi', 61],
  ['erciyes üniversitesi', 38], ['selçuk üniversitesi', 42], ['necmettin erbakan üniversitesi', 42], ['pamukkale üniversitesi', 20],
  ['süleyman demirel üniversitesi', 32], ['namık kemal üniversitesi', 59], ['trakya üniversitesi', 22], ['kırklareli üniversitesi', 39],
  ['onsekiz mart üniversitesi', 17], ['recep tayyip erdoğan üniversitesi', 53], ['hitit üniversitesi', 19], ['cumhuriyet üniversitesi', 58],
  ['kafkas üniversitesi', 36], ['yüzüncü yıl üniversitesi', 65], ['gaziosmanpaşa üniversitesi', 60], ['dumlupınar üniversitesi', 43],
  ['abant izzet baysal üniversitesi', 14], ['mustafa kemal üniversitesi', 31], ['adnan menderes üniversitesi', 9],
  ['celal bayar üniversitesi', 45], ['sütçü imam üniversitesi', 46], ['nevşehir hacı bektaş veli üniversitesi', 50],
  ['ömer halisdemir üniversitesi', 51], ['bülent ecevit üniversitesi', 67], ['sakarya uygulamalı bilimler üniversitesi', 54],
  ['gebze teknik üniversitesi', 41], ['kocaeli sağlık ve teknoloji üniversitesi', 41], ['munzur üniversitesi', 62],
];

function organizationHint(normalized: string): Province | undefined {
  const padded = ` ${normalized} `;
  for (const [phrase, plate] of ORGANIZATION_HINTS) {
    if (padded.includes(` ${phrase} `)) return byPlate.get(plate);
  }
  return undefined;
}

export interface LocationGuess {
  city: string | null;
  district: string | null;
  plate: number | null;
}

/**
 * Metinden il/ilçe çıkarır. Önce il adı aranır; bulunamazsa Türkiye'de tekil olan bir
 * ilçe adı aranır ("Çeltik Belediye Başkanlığı" → Konya / Çeltik).
 * Birden fazla farklı il geçiyorsa konum belirsiz kabul edilir (null).
 */
const NO_LOCATION: LocationGuess = { city: null, district: null, plate: null };

function provincesIn(tokens: string[]): Set<Province> {
  const provinces = new Set<Province>();
  for (let i = 0; i < tokens.length; i++) {
    const one = provinceByNormalized.get(tokens[i]);
    if (one) provinces.add(one);
    const two = i + 1 < tokens.length ? provinceByNormalized.get(`${tokens[i]} ${tokens[i + 1]}`) : undefined;
    if (two) provinces.add(two);
  }
  return provinces;
}

function districtHitsIn(tokens: string[]): { plate: number; name: string }[] {
  const hits: { plate: number; name: string }[] = [];
  for (let i = 0; i < tokens.length; i++) {
    for (const len of [1, 2].filter((l) => i + l <= tokens.length)) {
      hits.push(...(districtIndex.get(tokens.slice(i, i + len).join(' ')) ?? []));
    }
  }
  return hits;
}

/** Tek metin için tahmin; `undefined` sonraki metne geçilmesi gerektiğini belirtir. */
function guessFromText(n: string): LocationGuess | undefined {
  const hinted = organizationHint(n);
  if (hinted) return { city: hinted.name, district: null, plate: hinted.plate };
  const tokens = n.split(' ');
  const provinces = provincesIn(tokens);
  const districtHits = districtHitsIn(tokens);

  if (provinces.size > 1) return NO_LOCATION;
  if (provinces.size === 1) {
    const [p] = [...provinces];
    const d = districtHits.find((h) => h.plate === p.plate);
    return { city: p.name, district: d?.name ?? null, plate: p.plate };
  }

  const uniqueDistricts = districtHits.filter((h) => districtIndex.get(normalizeTr(h.name))?.length === 1);
  const plates = new Set(uniqueDistricts.map((h) => h.plate));
  if (plates.size !== 1) return undefined;
  const h = uniqueDistricts[0];
  return { city: byPlate.get(h.plate)?.name ?? null, district: h.name, plate: h.plate };
}

export function guessLocation(...texts: (string | null | undefined)[]): LocationGuess {
  for (const text of texts) {
    const n = normalizeTr(text);
    const guess = n ? guessFromText(n) : undefined;
    if (guess) return guess;
  }
  return NO_LOCATION;
}
