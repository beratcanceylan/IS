import { XMLParser } from 'fast-xml-parser';

/**
 * Kariyer Kapısı'nın resmî, herkese açık RSS'i: https://kariyerkapisi.gov.tr/RSS
 * (sitenin "Güncel ilanları sitene ekle" sayfasından üretilen bağlantı; kimlik doğrulama gerektirmez).
 */

export interface KariyerKapisiRssItem {
  guid: string;
  link: string;
  title: string;
  category: string | null;
  pubDate: string | null;
  imageUrl: string | null;
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Tek öğeli kanallarda da dizi dönsün.
  isArray: (name) => name === 'item',
  trimValues: true,
  processEntities: true,
});

function text(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return text((value as Record<string, unknown>)['#text']);
  }
  return null;
}

/** "https://kariyerkapisi.gov.tr/IlanDetay?i=<uuid>" → uuid */
export function extractGuid(link: string): string | null {
  const m = /[?&]i=([0-9a-f-]{36})/i.exec(link);
  return m ? m[1].toLowerCase() : null;
}

export class FeedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedFormatError';
  }
}

export function parseRss(body: string): KariyerKapisiRssItem[] {
  const clean = body.replace(/^﻿/, '').trim();
  if (!clean.startsWith('<')) throw new FeedFormatError('Yanıt XML değil');
  const doc = xml.parse(clean) as { rss?: { channel?: { item?: Record<string, unknown>[] } } };
  const channel = doc.rss?.channel;
  if (!channel) throw new FeedFormatError('RSS kanalı bulunamadı');
  const items = channel.item ?? [];
  const out: KariyerKapisiRssItem[] = [];
  for (const item of items) {
    const link = text(item.link) ?? text(item.guid);
    const title = text(item.title);
    if (!link || !title) continue;
    const guid = extractGuid(link);
    if (!guid) continue;
    const enclosure = item.enclosure as Record<string, unknown> | undefined;
    out.push({
      guid,
      link,
      title,
      category: text(item.category),
      pubDate: text(item.pubDate),
      imageUrl: enclosure ? text(enclosure['@_url']) : null,
    });
  }
  return out;
}

/** Detay uç noktasının (GetIlanPreviewPublic) kullandığımız alanları. */
export interface KariyerKapisiDetail {
  kurumAdi: string | null;
  birimAdi: string | null;
  ilanBaslik: string | null;
  ilanMetni: string | null;
  ilN_NO: string | null;
  ilanTuru: string | null;
  basTarih: string | null;
  bitTarih: string | null;
  eDevletServisURL: string | null;
  eDevletteGorunsun: number | null;
  basvuruLinki: string | null;
  kontenjan: number | null;
}

export function parseDetail(body: string): KariyerKapisiDetail | null {
  if (!body.trim()) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body);
  } catch {
    throw new FeedFormatError('Detay yanıtı JSON değil');
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === 'string' && (r[k] as string).trim() ? (r[k] as string).trim() : null);
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  if (!s('ilanBaslik')) throw new FeedFormatError('Detayda ilanBaslik alanı yok');
  return {
    kurumAdi: s('kurumAdi'),
    birimAdi: s('birimAdi'),
    ilanBaslik: s('ilanBaslik'),
    ilanMetni: s('ilanMetni'),
    ilN_NO: s('ilN_NO'),
    ilanTuru: s('ilanTuru'),
    basTarih: s('basTarih'),
    bitTarih: s('bitTarih'),
    eDevletServisURL: s('eDevletServisURL'),
    eDevletteGorunsun: n('eDevletteGorunsun'),
    basvuruLinki: s('basvuruLinki'),
    kontenjan: n('kontenjan'),
  };
}
