import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';

import { getSyncStatus, onSyncEvent, subscribeSyncStatus } from '@/sync/sync-controller';

export function useSyncStatus() {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
}

/**
 * Senkron sırasında her kaynak bittiğinde DB'den okunan sorguları tazeler; böylece ilk kaynak
 * biter bitmez ilanlar görünür, diğerlerini beklemez. Kök layout'ta bir kez kullanılır.
 */
export function useInvalidateOnSync() {
  const qc = useQueryClient();
  useEffect(
    () =>
      onSyncEvent((e) => {
        if (e.type === 'source' && e.report.outcome === 'skipped') return;
        void qc.invalidateQueries({ queryKey: ['feed'] });
        void qc.invalidateQueries({ queryKey: ['count'] });
        void qc.invalidateQueries({ queryKey: ['sources'] });
        if (e.type === 'finished') {
          void qc.invalidateQueries({ queryKey: ['settings'] });
          void qc.invalidateQueries({ queryKey: ['job'] });
        }
      }),
    [qc],
  );
}
