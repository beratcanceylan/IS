import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Group, Row, SectionHeader } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import { isProblem, lastSuccessLabel, statusLabel } from '@/components/sources/source-status';
import { useSourcesOverview } from '@/hooks/use-sources';
import { useSettings } from '@/state/settings-context';
import { GUTTER, space } from '@/theme/tokens';
import { formatCount } from '@/utils/display';

export default function SourcesScreen() {
  const router = useRouter();
  const { settings } = useSettings();
  const overview = useSourcesOverview();
  const all = overview.data ?? [];
  const synced = all.filter((o) => o.source.mode !== 'SEARCH_LINK' && (o.source.id !== 'demo' || settings.developerMode));
  const links = all.filter((o) => o.source.mode === 'SEARCH_LINK');
  const open = (id: string) => router.push({ pathname: '/sources/[id]', params: { id } });

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
      <SectionHeader title="Otomatik kontrol edilenler" />
      <Group>
        {synced.map((o) => {
          const parts = [
            lastSuccessLabel(o.health),
            o.health?.lastNewCount != null ? `Yeni: ${o.health.lastNewCount}` : null,
            `Aktif: ${formatCount(o.activeCount)}`,
          ].filter(Boolean);
          return (
            <Row
              key={o.source.id}
              label={o.source.displayName}
              detail={parts.join(' · ')}
              value={o.enabled ? statusLabel(o.health) : 'Kapalı'}
              destructive={o.enabled && isProblem(o.health)}
              onPress={() => open(o.source.id)}
            />
          );
        })}
      </Group>

      <SectionHeader title="Bağlantı ile açılanlar" />
      <View style={{ paddingHorizontal: GUTTER, paddingBottom: space.s }}>
        <Text variant="caption" tone="tertiary">
          Bu siteler otomatik veri toplamaya izin vermediği ya da erişimi engellediği için uygulama onlara istek atmaz; arama sayfalarını tarayıcıda açar.
        </Text>
      </View>
      <Group>
        {links.map((o) => (
          <Row key={o.source.id} label={o.source.displayName} detail={o.source.description} onPress={() => open(o.source.id)} />
        ))}
      </Group>
    </ScrollView>
  );
}
