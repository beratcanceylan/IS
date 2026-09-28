import type { SourceStatus } from '@/domain/source';
import type { SourceHealthRecord } from '@/db/repositories/sources-repository';
import { calendarDaysFrom, formatLastUpdated } from '@/utils/dates';

export const MODE_LABELS = {
  DIRECT_API: 'Resmî/açık servis',
  PUBLIC_HTML: 'Herkese açık sayfa',
  RSS_OR_FEED: 'RSS',
  SEARCH_LINK: 'Bağlantı',
  MANUAL_IMPORT: 'Elle ekleme',
} as const;

const STATUS_LABELS: Record<SourceStatus, string> = {
  ok: 'Çalışıyor',
  degraded: 'Kontrol edilmeli',
  failing: 'Güncellenemedi',
  blocked: 'Erişim reddedildi',
  idle: 'Henüz kontrol edilmedi',
};

export function statusLabel(h: SourceHealthRecord | null): string {
  if (!h) return STATUS_LABELS.idle;
  if (h.status === 'failing' && h.warning === 'Parser kontrol edilmeli') return 'Parser kontrol edilmeli';
  return STATUS_LABELS[h.status];
}

export function isProblem(h: SourceHealthRecord | null): boolean {
  return !!h && (h.status === 'failing' || h.status === 'blocked' || h.status === 'degraded');
}

/** "Son başarılı kontrol: 14:32", "Son başarılı kontrol: Dün 09:10" */
export function lastSuccessLabel(h: SourceHealthRecord | null): string {
  if (!h?.lastSuccessAt) return 'Başarılı kontrol yok';
  return `Son başarılı kontrol: ${formatLastUpdated(h.lastSuccessAt)}`;
}

/** Kısa sorun özeti: "Bugün güncellenemedi". */
export function problemSummary(h: SourceHealthRecord | null): string | null {
  if (!h || !isProblem(h)) return null;
  if (h.status === 'degraded') return h.warning;
  const today = h.lastAttemptAt ? calendarDaysFrom(h.lastAttemptAt) === 0 : false;
  const when = today ? 'Bugün' : 'Son denemede';
  const detail = h.lastError ? `: ${h.lastError}` : '';
  return `${when} güncellenemedi${detail}`;
}
