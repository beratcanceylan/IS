import type { NormalizedJob } from '@/domain/job';
import type { SourceKind, SourceMode } from '@/domain/source';
import type { HttpClient } from '@/utils/network';

/** Tüm kaynak türlerinin ortak tanımı. */
interface SourceBase {
  /** Kalıcı kimlik; DB'de saklanır, değiştirilmemelidir. kebab-case. */
  id: string;
  displayName: string;
  kind: SourceKind;
  homepageUrl: string;
  /** Kaynak ekranında gösterilen kısa açıklama (ne tür ilanlar, nasıl erişiliyor). */
  description: string;
}

export interface ListingContext {
  http: HttpClient;
  now: Date;
  /** Önceki başarılı yanıtın önbellek başlıkları. */
  etag: string | null;
  lastModified: string | null;
}

export interface ListingResult {
  /** 304: kaynak değişmedi, ilanlar olduğu gibi kalır. */
  notModified: boolean;
  jobs: NormalizedJob[];
  /**
   * Kaynağın aktif ilanlarının TAMAMI mı döndü? Yalnızca true ise, bu listede olmayan ilanlar
   * "muhtemelen kaldırıldı" olarak işaretlenir. Sayfalama sınırına takılan kaynaklar false döner.
   */
  complete: boolean;
  httpStatus: number | null;
  etag: string | null;
  lastModified: string | null;
}

/** Otomatik senkronize edilen kaynak (API, HTML, RSS). */
export interface SyncSourceAdapter extends SourceBase {
  mode: Extract<SourceMode, 'DIRECT_API' | 'PUBLIC_HTML' | 'RSS_OR_FEED'>;
  defaultEnabled: boolean;
  /** Başarılı iki senkron arasındaki minimum süre (dakika). Uygulamayı her açışta kaynağı vurmamak için. */
  minIntervalMinutes: number;
  /** Aynı kaynağa ardışık istekler arası bekleme (ms). */
  requestDelayMs: number;
  /** Parser değiştiğinde artırılır; eski sürümle çekilmiş detaylar yenilenir. */
  parserVersion: number;
  /** Normalde beklenen asgari ilan sayısı; altına düşmek anomali uyarısı üretir. */
  expectedMinCount: number;

  fetchListings(ctx: ListingContext): Promise<ListingResult>;

  /**
   * İsteğe bağlı detay çekimi. Liste verisine eklenecek alanları döndürür.
   * Her senkronda en fazla `detailBudget` ilan için çağrılır.
   */
  fetchDetails?(ctx: ListingContext, job: { sourceExternalId: string; sourceUrl: string }): Promise<NormalizedJob | null>;
  detailBudget?: number;
}

export interface SearchLinkQuery {
  query?: string;
  city?: string | null;
}

/** Otomatik erişime uygun olmayan kaynak: uygulama yalnızca arama bağlantısı üretir. */
export interface SearchLinkSource extends SourceBase {
  mode: 'SEARCH_LINK';
  /** Neden otomatik çekilmediği (kullanıcıya açıklanır). */
  reason: string;
  buildSearchUrl(q: SearchLinkQuery): string;
}

export type SourceAdapter = SyncSourceAdapter | SearchLinkSource;

export function isSyncSource(s: SourceAdapter): s is SyncSourceAdapter {
  return s.mode !== 'SEARCH_LINK';
}
