import { Stack, useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Segmented } from '@/components/common/controls';
import { Group, Row, SectionHeader } from '@/components/common/list-parts';
import { filterSummaries, type FilterCategory } from '@/components/filters/filter-labels';
import type { SectorFilter } from '@/domain/saved-search';
import { useFeedCount } from '@/hooks/use-jobs';
import { useSettings } from '@/state/settings-context';
import { useFilterDraft } from '@/state/filter-draft-context';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { formatCount } from '@/utils/display';

const SECTORS = [
  { value: 'all', label: 'Tümü' },
  { value: 'public', label: 'Kamu' },
  { value: 'private', label: 'Özel' },
] as const;

export default function FiltersScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { update } = useSettings();
  const { draft, setDraft, patch } = useFilterDraft();
  const count = useFeedCount(draft);
  const s = filterSummaries(draft);
  const go = (category: FilterCategory) => router.push({ pathname: '/filters/[category]', params: { category } } as Href);

  const apply = () => {
    update('feedFilter', draft);
    router.dismissTo('/');
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <Stack.Screen
        options={{
          headerLeft: () => <Button kind="plain" label="Kapat" onPress={() => router.back()} />,
          headerRight: () => <Button kind="plain" label="Sıfırla" onPress={() => setDraft({})} />,
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <View style={styles.sector}>
          <Segmented<SectorFilter>
            options={SECTORS}
            value={draft.sector ?? 'all'}
            onChange={(v) => patch({ sector: v === 'all' ? undefined : v })}
          />
        </View>

        <SectionHeader title="Temel" />
        <Group>
          <Row label="Konum" value={s.location ?? 'Tüm Türkiye'} onPress={() => go('location')} />
          <Row label="Yayın tarihi" value={s.published ?? 'Tümü'} onPress={() => go('published')} />
          <Row label="Son başvuru" value={s.deadline ?? 'Tümü'} onPress={() => go('deadline')} />
          <Row label="Eğitim" value={s.education ?? 'Tümü'} onPress={() => go('education')} />
          <Row label="KPSS" value={s.kpss ?? 'Fark etmez'} onPress={() => go('kpss')} />
        </Group>

        <SectionHeader title="Kamu" />
        <Group>
          <Row label="Kadro türü" value={s.publicTypes ?? 'Tümü'} onPress={() => go('publicTypes')} />
        </Group>

        <SectionHeader title="Çalışma" />
        <Group>
          <Row label="Çalışma tipi" value={s.employment ?? 'Tümü'} onPress={() => go('employment')} />
          <Row label="Çalışma modeli" value={s.workModel ?? 'Tümü'} onPress={() => go('workModel')} />
          <Row label="Deneyim" value={s.experience ?? 'Tümü'} onPress={() => go('experience')} />
        </Group>

        <SectionHeader title="Diğer" />
        <Group>
          <Row label="Kelimeler" value={s.keywords ?? 'Yok'} detail="İçermesi / içermemesi gerekenler" onPress={() => go('keywords')} />
          <Row label="Kaynaklar" value={s.sources ?? 'Tümü'} onPress={() => go('sources')} />
          <Row
            label="Yalnızca bilgisi kesin olanlar"
            detail="Kapalıyken, örneğin eğitim şartı metinden çıkarılamamış ilanlar da gösterilir."
            right={<Switch value={draft.strict === true} onValueChange={(v) => patch({ strict: v || undefined })} trackColor={{ true: c.accent }} />}
          />
          <Row
            label="Süresi dolanları göster"
            right={<Switch value={draft.includeExpired === true} onValueChange={(v) => patch({ includeExpired: v || undefined })} trackColor={{ true: c.accent }} />}
          />
        </Group>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.separator, paddingBottom: insets.bottom + space.s }]}>
        <Button label={count.data === undefined ? 'Göster' : count.data === 0 ? 'İlan yok' : `${formatCount(count.data)} ilanı göster`} onPress={apply} flex />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sector: { paddingHorizontal: GUTTER, paddingTop: space.m },
  footer: { paddingHorizontal: GUTTER, paddingTop: space.s, borderTopWidth: StyleSheet.hairlineWidth },
});
