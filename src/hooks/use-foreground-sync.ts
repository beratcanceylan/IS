import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useSettings } from '@/state/settings-context';
import { onSyncEvent, requestSync } from '@/sync/sync-controller';

/**
 * Uygulama açıldığında ve ön plana her geldiğinde senkron ister. Sıklığı SyncEngine'deki kaynak
 * bazlı cooldown belirler; son kontrolden beri yeterli süre geçmediyse hiçbir kaynağa istek atılmaz.
 * Onboarding bitmeden çalışmaz (kullanıcı henüz konum seçmemişken ağ kullanılmaz).
 */
export function useForegroundSync() {
  const { settings, update } = useSettings();
  const ready = settings.onboardingDone;

  // Motor `lastSyncAt`'i DB'ye yazar; ekrandaki "Son güncelleme" için bellekteki ayar da tazelenir.
  useEffect(
    () =>
      onSyncEvent((e) => {
        if (e.type === 'finished' && e.report.sources.some((s) => s.outcome === 'ok' || s.outcome === 'notModified')) {
          update('lastSyncAt', e.report.finishedAt);
        }
      }),
    [update],
  );

  useEffect(() => {
    if (!ready) return;
    void requestSync('foreground');
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void requestSync('foreground');
    });
    return () => sub.remove();
  }, [ready]);
}
