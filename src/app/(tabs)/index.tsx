import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState, IconButton, TextTabs } from '@/components/common/controls';
import { Icon } from '@/components/common/icon';
import { Text } from '@/components/common/text';
import { locationSummary } from '@/components/filters/filter-labels';
import { JobList } from '@/components/jobs/job-list';
import { countActiveFilters, type JobFilter, type SectorFilter } from '@/domain/saved-search';
import { useFeed, useNewCount } from '@/hooks/use-jobs';
import { useSyncStatus } from '@/hooks/use-sync';
import { useSettings } from '@/state/settings-context';
import { requestSync } from '@/sync/sync-controller';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { formatLastUpdated } from '@/utils/dates';

const SECTOR_TABS = [
  { value: 'all', label: 'Tümü' },
  { value: 'public', label: 'Kamu' },
  { value: 'private', label: 'Özel' },
] as const;

export default function FeedScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useSettings();
  const sync = useSyncStatus();
  const filter = settings.feedFilter;
  const newSince = settings.feedSeenUntil;

  const feed = useFeed(filter, newSince);
  const newCount = useNewCount(filter, newSince);
  const items = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);

  const markSeen = useCallback(() => update('feedSeenUntil', new Date().toISOString()), [update]);
  useMarkFeedSeenOnBackground(markSeen);
  // Elle yenileme: önceki "yeni"ler görülmüş sayılır, bu yenilemede bulunanlar yeni olarak gelir.
  const refresh = () => {
    markSeen();
    void requestSync('manual', { force: true });
  };

  const setFilter = (next: JobFilter) => update('feedFilter', next);
  const activeFilters = countActiveFilters({ ...filter, sector: undefined, locations: undefined });
  const failing = sync.lastReport?.sources.filter((s) => s.outcome === 'error').length ?? 0;

  const status = sync.running ? 'Güncelleniyor…' : `Son güncelleme ${formatLastUpdated(settings.lastSyncAt)}`;

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
      <View style={styles.titleRow}>
        <Text variant="screenTitle">İşler</Text>
        <View style={styles.actions}>
          <IconButton
            icon="filter"
            label={activeFilters ? `Filtreler, ${activeFilters} etkin` : 'Filtreler'}
            color={activeFilters ? c.accent : undefined}
            onPress={() => router.push('/filters')}
          />
          <IconButton icon="refresh" label="Şimdi güncelle" busy={sync.running} onPress={refresh} />
        </View>
      </View>
      <View style={styles.subRow}>
        <Pressable onPress={() => router.push('/locations')} hitSlop={8} style={styles.location} accessibilityRole="button">
          <Text variant="bodyStrong" tone="accent">
            {locationSummary(filter.locations)}
          </Text>
          <Icon name="chevronDown" size={14} color={c.accent} />
        </Pressable>
        <Text variant="caption" tone="tertiary">
          {status}
        </Text>
      </View>
      <View style={styles.tabsRow}>
        <TextTabs<SectorFilter>
          options={SECTOR_TABS}
          value={filter.sector ?? 'all'}
          onChange={(sector) => setFilter({ ...filter, sector: sector === 'all' ? undefined : sector })}
        />
        {activeFilters ? (
          <Text variant="caption" tone="accent">
            {activeFilters} filtre
          </Text>
        ) : null}
      </View>
      {failing ? (
        <Pressable onPress={() => router.push('/sources')} hitSlop={4}>
          <Text variant="caption" tone="tertiary">
            {failing} kaynak güncellenemedi · Ayrıntılar
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  let empty = null;
  if (!feed.isLoading) {
    if (activeFilters || filter.locations?.length || filter.sector) {
      empty = (
        <EmptyState
          title="Bu filtrelerle ilan bulunamadı."
          action={<Button kind="plain" label="Filtreleri temizle" onPress={() => setFilter({})} />}
        />
      );
    } else {
      empty = <EmptyState title={sync.running ? 'İlanlar indiriliyor…' : 'Henüz ilan yok. Aşağı çekerek güncelleyebilirsin.'} />;
    }
  }

  return (
    <JobList
      items={items}
      sectioned
      newCount={newCount.data}
      header={header}
      empty={empty}
      refreshing={sync.running && sync.trigger === 'manual'}
      onRefresh={refresh}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
    />
  );
}

/**
 * "Yeni" işaretleri, kullanıcı uygulamadan çıktığında (arka plana) görülmüş sayılır. Detaya gidip
 * dönmek veya sekme değiştirmek işaretleri silmez; aksi halde yeni ilanlar tek dokunuşta kaybolurdu.
 */
function useMarkFeedSeenOnBackground(markSeen: () => void) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') markSeen();
    });
    return () => sub.remove();
  }, [markSeen]);
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: GUTTER, paddingBottom: space.s, gap: space.s },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', marginRight: -space.m },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  location: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  tabsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
});
