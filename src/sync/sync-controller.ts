import { getDb } from '@/db/database';
import type { SyncTrigger } from '@/domain/source';

import { runSync, type SourceSyncReport, type SyncReport } from './sync-engine';

/**
 * Uygulama içindeki tek senkron giriş noktası. Aynı anda iki senkron çalışmaz: ikinci çağrı
 * çalışan senkronun sonucunu bekler. UI durumu `subscribe` ile dinler.
 */

export interface SyncStatus {
  running: boolean;
  trigger: SyncTrigger | null;
  lastReport: SyncReport | null;
  lastError: string | null;
}

type Listener = () => void;
type SyncEvent = { type: 'source'; report: SourceSyncReport } | { type: 'finished'; report: SyncReport };

let status: SyncStatus = { running: false, trigger: null, lastReport: null, lastError: null };
let current: Promise<SyncReport | null> | null = null;
const listeners = new Set<Listener>();
const eventListeners = new Set<(e: SyncEvent) => void>();

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function subscribeSyncStatus(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Senkron olayları (ör. her kaynak bittiğinde sorguları tazelemek için). */
export function onSyncEvent(listener: (e: SyncEvent) => void): () => void {
  eventListeners.add(listener);
  return () => eventListeners.delete(listener);
}

export type AfterSyncHook = (report: SyncReport) => Promise<void>;
const afterSyncHooks: AfterSyncHook[] = [];

/** Bildirimler gibi senkron sonrası işler buraya kaydolur (motor bunlardan habersizdir). */
export function registerAfterSync(hook: AfterSyncHook) {
  afterSyncHooks.push(hook);
}

export function requestSync(trigger: SyncTrigger, opts: { force?: boolean; sourceIds?: string[] } = {}): Promise<SyncReport | null> {
  if (current) return current;
  setStatus({ running: true, trigger, lastError: null });
  current = (async () => {
    try {
      const db = await getDb();
      const report = await runSync(db, {
        trigger,
        force: opts.force,
        sourceIds: opts.sourceIds,
        onSourceDone: (r) => eventListeners.forEach((l) => l({ type: 'source', report: r })),
      });
      for (const hook of afterSyncHooks) {
        try {
          await hook(report);
        } catch (e) {
          console.warn('[sync] senkron sonrası adım başarısız', e);
        }
      }
      setStatus({ running: false, trigger: null, lastReport: report });
      eventListeners.forEach((l) => l({ type: 'finished', report }));
      return report;
    } catch (e) {
      setStatus({ running: false, trigger: null, lastError: e instanceof Error ? e.message : String(e) });
      return null;
    } finally {
      current = null;
    }
  })();
  return current;
}
