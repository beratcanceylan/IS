import { useRouter } from 'expo-router';
import { useCallback, useMemo, type ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Separator } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import type { JobListItem } from '@/domain/job';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { calendarDaysFrom } from '@/utils/dates';
import { formatCount } from '@/utils/display';

import { JobRow } from './job-row';

type ListRow = { kind: 'header'; key: string; label: string } | { kind: 'job'; key: string; job: JobListItem };

/** Akışı "Yeni / Bugün / Daha eski" bölümlerine ayırır. Sıralama DB'den gelir, burada değişmez. */
type Section = 'new' | 'today' | 'older';

function sectionOf(job: JobListItem, now: Date): Section {
  if (job.isNew) return 'new';
  return calendarDaysFrom(job.sortAt, now) >= 0 ? 'today' : 'older';
}

function sectionLabel(section: Section, items: JobListItem[], newCount: number | undefined): string {
  if (section === 'new') return `Yeni · ${formatCount(newCount ?? items.filter((j) => j.isNew).length)}`;
  return section === 'today' ? 'Bugün' : 'Daha eski';
}

export function sectionRows(items: JobListItem[], newCount: number | undefined, now = new Date()): ListRow[] {
  const rows: ListRow[] = [];
  const seen = new Set<Section>();
  for (const job of items) {
    const section = sectionOf(job, now);
    // Her bölüm başlığı bir kez; sıralama DB'den geldiği için normalde bölümler ardışıktır.
    if (!seen.has(section)) {
      seen.add(section);
      rows.push({ kind: 'header', key: `h-${section}`, label: sectionLabel(section, items, newCount) });
    }
    rows.push({ kind: 'job', key: String(job.id), job });
  }
  return rows;
}

interface Props {
  items: JobListItem[];
  sectioned?: boolean;
  newCount?: number;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  footer?: ReactElement | null;
  onItemPress?: (id: number) => void;
}

export function JobList({ items, sectioned, newCount, header, empty, refreshing, onRefresh, onEndReached, footer, onItemPress }: Readonly<Props>) {
  const c = useColors();
  const router = useRouter();
  const rows = useMemo<ListRow[]>(
    () => (sectioned ? sectionRows(items, newCount) : items.map((job) => ({ kind: 'job', key: String(job.id), job }))),
    [items, sectioned, newCount],
  );
  const open = useCallback(
    (id: number) => {
      onItemPress?.(id);
      router.push({ pathname: '/job/[id]', params: { id: String(id) } });
    },
    [router, onItemPress],
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      renderItem={({ item, index }) =>
        item.kind === 'header' ? (
          <View style={[styles.header, { backgroundColor: c.background }]}>
            <Text variant="sectionTitle" tone={item.key === 'h-new' ? 'accent' : 'secondary'}>
              {item.label}
            </Text>
          </View>
        ) : (
          <>
            {index > 0 && rows[index - 1].kind === 'job' ? <Separator /> : null}
            <JobRow job={item.job} onPress={open} />
          </>
        )
      }
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.textSecondary} colors={[c.accent]} /> : undefined
      }
      style={{ backgroundColor: c.background }}
      contentContainerStyle={{ paddingBottom: space.xxxl }}
      initialNumToRender={12}
      windowSize={9}
      removeClippedSubviews
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: GUTTER, paddingTop: space.xl, paddingBottom: space.xs },
});
