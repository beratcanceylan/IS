import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState, Segmented } from '@/components/common/controls';
import { Text } from '@/components/common/text';
import { JobList } from '@/components/jobs/job-list';
import { useSavedList } from '@/hooks/use-jobs';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

type Tab = 'favorites' | 'applications' | 'searches';

const TABS = [
  { value: 'favorites', label: 'Favoriler' },
  { value: 'applications', label: 'Başvurular' },
  { value: 'searches', label: 'Aramalar' },
] as const;

export default function SavedScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('favorites');
  const list = useSavedList(tab === 'applications' ? 'applications' : 'favorites');

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + space.s }]}>
      <Text variant="screenTitle">Kaydedilenler</Text>
      <Segmented<Tab> options={TABS} value={tab} onChange={setTab} />
    </View>
  );

  if (tab === 'searches') {
    return (
      <View style={[styles.flex, { backgroundColor: c.background }]}>
        {header}
        <EmptyState title="Kayıtlı aramalar bir sonraki aşamada eklenecek." />
      </View>
    );
  }

  return (
    <JobList
      items={list.data ?? []}
      header={header}
      empty={
        list.isLoading ? null : (
          <EmptyState
            title={
              tab === 'favorites'
                ? 'Kaydettiğin ilanlar burada görünür. İlan detayında "Kaydet"e dokun.'
                : 'Başvuru durumu verdiğin ilanlar burada görünür.'
            }
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: GUTTER, paddingBottom: space.s, gap: space.m },
});
