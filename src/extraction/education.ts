import { EDUCATION_ORDER, type EducationLevel } from '@/domain/job';
import { normalizeTr } from '@/utils/turkish-normalization';

/**
 * Eğitim seviyesi kalıpları. Metin önce `normalizeTr` ile küçük harfe ve tek boşluğa indirgenir,
 * bu yüzden kelime başı `(?<!\S)` ile ifade edilir. (JS'de `\b` Türkçe harflerde çalışmaz.)
 * Sıra önemlidir: "yüksek lisans" ve "ön lisans" düz "lisans"tan önce yakalanıp metinden çıkarılır.
 */
const W = '(?<!\\S)';
const PATTERNS: [EducationLevel, RegExp][] = [
  ['doctorate', new RegExp(`${W}doktora\\p{L}*`, 'gu')],
  ['master', new RegExp(`${W}yüksek lisans\\p{L}*`, 'gu')],
  ['associate', new RegExp(`${W}(?:ön ?lisans\\p{L}*|meslek yüksekokul\\p{L}*|iki yıllık|2 yıllık)`, 'gu')],
  ['bachelor', new RegExp(`${W}(?:lisans\\p{L}*|fakülte\\p{L}*|dört yıllık|4 yıllık)`, 'gu')],
  ['highSchool', new RegExp(`${W}(?:lise\\p{L}*|ortaöğretim\\p{L}*|ortaöğrenim\\p{L}*)`, 'gu')],
  ['primary', new RegExp(`${W}(?:ilköğretim\\p{L}*|ilkokul\\p{L}*|ortaokul\\p{L}*|ilköğrenim\\p{L}*)`, 'gu')],
];

/**
 * Eşleşmenin eğitim bağlamında geçtiğini doğrulamak için yakın çevrede aranan kelimeler.
 * "lisans" kelimesi "yazılım lisansı" gibi bağlamlarda da geçebildiği için bu kontrol şarttır.
 */
const CONTEXT = /mezun|düzey|öğrenim|diploma|bitirmiş|program|bölüm|eğitim|seviye|şart|kadro|pozisyon/u;

export function extractEducation(text: string | null | undefined): EducationLevel[] {
  if (!text) return [];
  let n = normalizeTr(text);
  const found = new Set<EducationLevel>();
  for (const [level, re] of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(n))) {
      const window = n.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40);
      if (CONTEXT.test(window)) found.add(level);
    }
    // Bulunan ifadeyi sil ki "yüksek lisans" sonraki adımda "lisans" olarak tekrar sayılmasın.
    n = n.replace(re, ' ');
  }
  return EDUCATION_ORDER.filter((l) => found.has(l));
}

export const EDUCATION_LABELS: Record<EducationLevel, string> = {
  primary: 'İlköğretim',
  highSchool: 'Lise',
  associate: 'Önlisans',
  bachelor: 'Lisans',
  master: 'Yüksek lisans',
  doctorate: 'Doktora',
};
