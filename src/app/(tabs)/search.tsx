import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/common/controls';
import { Icon } from '@/components/common/icon';
import { Group, Row, SectionHeader } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import { JobList } from '@/components/jobs/job-list';
import { useFeed } from '@/hooks/use-jobs';
import { useSettings } from '@/state/settings-context';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { normalizeTr } from '@/utils/turkish-normalization';

const EPOCH = '1970-01-01T00:00:00.000Z';
const MAX_RECENT = 8;

function resultCountLabel(count: number, hasMore: boolean): string {
  if (count === 0) return '';
  return hasMore ? `${count}+ sonuç` : `${count} sonuç`;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { settings, update } = useSettings();
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 200);
  const filter = useMemo(() => ({ query }), [query]);
  const results = useFeed(filter, EPOCH);
  const items = useMemo(() => (query ? (results.data?.pages.flatMap((p) => p.items) ?? []) : []), [results.data, query]);

  const remember = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const rest = settings.recentSearches.filter((r) => normalizeTr(r) !== normalizeTr(trimmed));
    update('recentSearches', [trimmed, ...rest].slice(0, MAX_RECENT));
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
      <Text variant="screenTitle">Ara</Text>
      <View style={[styles.field, { backgroundColor: c.badge }]}>
        <Icon name="search" size={18} color={c.textTertiary} />
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => remember(text)}
          placeholder="Pozisyon, kurum veya şehir"
          placeholderTextColor={c.textTertiary}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.input, { color: c.text }]}
          accessibilityLabel="Arama"
        />
        {text ? (
          <Pressable onPress={() => setText('')} hitSlop={10} accessibilityLabel="Aramayı temizle">
            <Icon name="close" size={18} color={c.textTertiary} />
          </Pressable>
        ) : null}
      </View>
      {query && !results.isLoading ? (
        <Text variant="caption" tone="tertiary">
          {resultCountLabel(items.length, results.hasNextPage)}
        </Text>
      ) : null}
    </View>
  );

  if (!query) {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        {header}
        {settings.recentSearches.length ? (
          <>
            <SectionHeader
              title="Son aramalar"
              right={
                <Pressable onPress={() => update('recentSearches', [])} hitSlop={8}>
                  <Text variant="meta" tone="accent">
                    Temizle
                  </Text>
                </Pressable>
              }
            />
            <Group>
              {settings.recentSearches.map((r) => (
                <Row key={r} label={r} onPress={() => setText(r)} chevron={false} />
              ))}
            </Group>
          </>
        ) : (
          <EmptyState title="İndirilmiş ilanlarda arar. İnternet gerekmez." />
        )}
      </View>
    );
  }

  return (
    <JobList
      items={items}
      header={header}
      empty={results.isLoading ? null : <EmptyState title={`"${query}" için ilan bulunamadı.`} />}
      onItemPress={() => remember(query)}
      onEndReached={() => {
        if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: GUTTER, paddingBottom: space.s, gap: space.m },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.s, borderRadius: 10, paddingHorizontal: space.m, minHeight: 40 },
  input: { flex: 1, fontSize: 16, paddingVertical: space.s },
});
