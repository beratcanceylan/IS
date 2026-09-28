import { selectAll, selectOne } from 'css-select';
import type { AnyNode, Element } from 'domhandler';
import { textContent } from 'domutils';
import { parseDocument } from 'htmlparser2';

import { SELECTORS } from './selectors';

export interface KamuilanItem {
  /** Gün grubundaki tarih metni, örn. "25 Eylül". */
  dayLabel: string;
  organization: string;
  /** Aralık metni çıkarılmış başlık, örn. "3 ÖĞRETİM ÜYESİ ALACAK". */
  title: string;
  /** "25 Eylül - 8 Aralık" */
  rangeText: string | null;
  /** Oturuma bağlı geçici bağlantı (bkz. mapper). */
  href: string | null;
  logo: string | null;
}

export class PageFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageFormatError';
  }
}

function clean(s: string): string {
  return s.replaceAll(' ', ' ').replaceAll(/\s+/g, ' ').trim();
}

export function parseTimeline(html: string): KamuilanItem[] {
  const doc = parseDocument(html, { decodeEntities: true });
  const groups = selectAll<AnyNode, Element>(SELECTORS.dayGroup, doc);
  if (!groups.length) {
    // Sayfa geldi ama beklenen yapı yok: sessizce "0 ilan" demek yerine hata ver.
    throw new PageFormatError(`Zaman çizelgesi bulunamadı (${SELECTORS.dayGroup})`);
  }
  const out: KamuilanItem[] = [];
  for (const group of groups) {
    const day = selectOne(SELECTORS.dayNumber, group);
    const month = selectOne(SELECTORS.monthName, group);
    if (!day || !month) continue;
    const dayLabel = `${clean(textContent(day))} ${clean(textContent(month))}`;
    for (const a of selectAll<AnyNode, Element>(SELECTORS.listing, group)) {
      const orgEl = selectOne(SELECTORS.organization, a);
      const titleEl = selectOne(SELECTORS.title, a);
      if (!orgEl || !titleEl) continue;
      const rangeEl = selectOne(SELECTORS.applicationRange, a);
      const rangeRaw = rangeEl ? clean(textContent(rangeEl)) : '';
      const fullTitle = clean(textContent(titleEl));
      const title = rangeRaw ? clean(fullTitle.replace(rangeRaw, '')) : fullTitle;
      const organization = clean(textContent(orgEl));
      if (!organization || !title) continue;
      const logo = selectOne<AnyNode, Element>(SELECTORS.logo, a)?.attribs.src ?? null;
      out.push({
        dayLabel,
        organization,
        title,
        rangeText: rangeRaw.replaceAll(/[()]/g, '').trim() || null,
        href: a.attribs.href ?? null,
        logo: logo ? logo.split('#')[0] : null,
      });
    }
  }
  return out;
}
