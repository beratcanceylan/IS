import type { SourceKind } from '@/domain/source';

import { demoAdapter } from './adapters/demo';
import { kamuilanSbbAdapter } from './adapters/kamuilan-sbb';
import { kariyerKapisiAdapter } from './adapters/kariyer-kapisi';
import { searchLinkSources } from './adapters/search-links';
import { isSyncSource, type SearchLinkSource, type SourceAdapter, type SyncSourceAdapter } from './types';

/**
 * Tüm kaynakların tek listesi. Yeni kaynak eklemek için adapter'ı yazıp buraya eklemek yeterlidir;
 * ekranlar ve senkron motoru kaynakları yalnızca bu registry üzerinden tanır.
 */
const ALL: readonly SourceAdapter[] = [kariyerKapisiAdapter, kamuilanSbbAdapter, ...searchLinkSources, demoAdapter];

const byId = new Map(ALL.map((s) => [s.id, s]));

export function getAllSources(): readonly SourceAdapter[] {
  return ALL;
}

export function getSource(id: string): SourceAdapter | undefined {
  return byId.get(id);
}

export function getSyncSources(): SyncSourceAdapter[] {
  return ALL.filter(isSyncSource);
}

export function getSearchLinkSources(): SearchLinkSource[] {
  return ALL.filter((s): s is SearchLinkSource => s.mode === 'SEARCH_LINK');
}

export function sourceDisplayName(id: string): string {
  return byId.get(id)?.displayName ?? id;
}

/** Filtre SQL'i için: resmî / özel kaynak id'leri (toplayıcılar özel sayılır). */
export function sourceIdsByKind(): Record<'official' | 'private', string[]> {
  const kindOf = (k: SourceKind) => (k === 'official' ? 'official' : 'private');
  const out: Record<'official' | 'private', string[]> = { official: [], private: [] };
  for (const s of getSyncSources()) out[kindOf(s.kind)].push(s.id);
  return out;
}

/** Kullanıcı ayarı yoksa adapter'ın varsayılanı geçerlidir. */
export function isSourceEnabled(source: SyncSourceAdapter, overrides: Record<string, boolean>): boolean {
  return overrides[source.id] ?? source.defaultEnabled;
}
