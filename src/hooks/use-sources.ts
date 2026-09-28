import { useQuery } from '@tanstack/react-query';

import { getDb } from '@/db/database';
import { countActiveBySource, getDbStats } from '@/db/repositories/jobs-repository';
import { getAllHealth, getSourceEnabledMap, listSyncRuns, type SourceHealthRecord } from '@/db/repositories/sources-repository';
import { getSchemaVersion } from '@/db/migrations';
import { getAllSources, isSourceEnabled } from '@/sources/registry';
import { isSyncSource, type SourceAdapter } from '@/sources/types';

export interface SourceOverview {
  source: SourceAdapter;
  enabled: boolean;
  health: SourceHealthRecord | null;
  activeCount: number;
}

async function loadOverview(): Promise<SourceOverview[]> {
  const db = await getDb();
  const [health, enabled, counts] = await Promise.all([getAllHealth(db), getSourceEnabledMap(db), countActiveBySource(db)]);
  return getAllSources().map((source) => ({
    source,
    enabled: isSyncSource(source) ? isSourceEnabled(source, enabled) : false,
    health: health[source.id] ?? null,
    activeCount: counts[source.id] ?? 0,
  }));
}

export function useSourcesOverview() {
  return useQuery({ queryKey: ['sources', 'overview'], queryFn: loadOverview });
}

export function useDeveloperStats() {
  return useQuery({
    queryKey: ['sources', 'developer'],
    queryFn: async () => {
      const db = await getDb();
      const [stats, version, runs] = await Promise.all([getDbStats(db), getSchemaVersion(db), listSyncRuns(db, 10)]);
      return { stats, version, runs };
    },
  });
}
