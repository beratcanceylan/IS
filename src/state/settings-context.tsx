import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { getDb } from '@/db/database';
import { setSetting, type AppSettings } from '@/db/repositories/settings-repository';

interface SettingsContextValue {
  settings: AppSettings;
  update<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Ayarlar açılışta bir kez DB'den okunur (bkz. kök layout) ve burada tutulur.
 * `update` UI'ı hemen günceller, DB'ye arka planda yazar.
 */
export function SettingsProvider({ initial, children }: Readonly<{ initial: AppSettings; children: ReactNode }>) {
  const [settings, setSettings] = useState(initial);
  const update = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
    void getDb()
      .then((db) => setSetting(db, key, value))
      .catch((e) => console.warn('[settings] kaydedilemedi', key, e));
  }, []);
  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings, SettingsProvider içinde kullanılmalı');
  return ctx;
}
