import { createContext, useContext, useState, type ReactNode } from 'react';

import type { JobFilter } from '@/domain/saved-search';

interface FilterDraft {
  draft: JobFilter;
  setDraft: (f: JobFilter) => void;
  patch: (p: Partial<JobFilter>) => void;
}

const Ctx = createContext<FilterDraft | null>(null);

/** Filtre ekranları arasında paylaşılan taslak; "N ilanı göster" ile akışa uygulanır. */
export function FilterDraftProvider({ initial, children }: { initial: JobFilter; children: ReactNode }) {
  const [draft, setDraft] = useState<JobFilter>(initial);
  const patch = (p: Partial<JobFilter>) =>
    setDraft((d) => {
      const next: JobFilter = { ...d, ...p };
      // Boş dizileri ve undefined alanları temizle; kayıtlı JSON sade kalsın.
      for (const key of Object.keys(next) as (keyof JobFilter)[]) {
        const v = next[key];
        if (v === undefined || (Array.isArray(v) && v.length === 0)) delete next[key];
      }
      return next;
    });
  return <Ctx.Provider value={{ draft, setDraft, patch }}>{children}</Ctx.Provider>;
}

export function useFilterDraft(): FilterDraft {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFilterDraft, FilterDraftProvider içinde kullanılmalı');
  return ctx;
}
