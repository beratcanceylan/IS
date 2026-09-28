import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Group, Row, SectionHeader } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import { locationSummary } from '@/components/filters/filter-labels';
import { useSourcesOverview } from '@/hooks/use-sources';
import { useSettings } from '@/state/settings-context';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { formatLastUpdated } from '@/utils/dates';

export default function SettingsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings } = useSettings();
  const sources = useSourcesOverview();
  const problems = sources.data?.filter((s) => s.health && (s.health.status === 'failing' || s.health.status === 'blocked' || s.health.status === 'degraded')).length ?? 0;

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ paddingTop: insets.top + space.s, paddingBottom: space.xxxl }}>
      <View style={styles.header}>
        <Text variant="screenTitle">Ayarlar</Text>
      </View>

      <SectionHeader title="Takip" />
      <Group>
        <Row label="Konumlar" value={locationSummary(settings.feedFilter.locations)} onPress={() => router.push('/locations')} />
        <Row label="Filtreler" onPress={() => router.push('/filters')} />
      </Group>

      <SectionHeader title="Kaynaklar" />
      <Group>
        <Row
          label="Kaynaklar ve durumları"
          value={problems ? `${problems} sorun` : 'Çalışıyor'}
          detail={`Son kontrol: ${formatLastUpdated(settings.lastSyncAt)}`}
          onPress={() => router.push('/sources')}
        />
      </Group>

      <SectionHeader title="Senkronizasyon" />
      <Group>
        <Row
          label="Otomatik kontrol"
          value="Uygulama açıldığında"
          detail="Arka planda kontrol ve bildirimler bir sonraki aşamada eklenecek. Arka plan zamanlamasını işletim sistemi belirler."
        />
      </Group>

      <SectionHeader title="Gizlilik" />
      <View style={styles.note}>
        <Text variant="meta" tone="secondary">
          Hesap, sunucu, analitik ya da takip yok. Tüm veriler bu cihazdaki veritabanında durur. Uygulama yalnızca ilan kaynaklarına istek atar.
        </Text>
      </View>

      <SectionHeader title="Geliştirici" />
      <Group>
        <Row label="Geliştirici araçları" detail="DB istatistikleri, manuel senkron, migration sürümü" onPress={() => router.push('/developer')} />
      </Group>

      <Text variant="caption" tone="tertiary" style={styles.version}>
        Sürüm {Constants.expoConfig?.version ?? '—'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: GUTTER },
  note: { paddingHorizontal: GUTTER },
  version: { textAlign: 'center', marginTop: space.xxl },
});
