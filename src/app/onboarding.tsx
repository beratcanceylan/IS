import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/controls';
import { Text } from '@/components/common/text';
import { ProvincePicker } from '@/components/filters/province-picker';
import type { LocationSelection } from '@/domain/saved-search';
import { useSettings } from '@/state/settings-context';
import { requestSync } from '@/sync/sync-controller';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

/** Tek ekranlık ilk açılış: takip edilecek yerler. Atlanabilir; varsayılan Tüm Türkiye. */
export default function OnboardingScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [locations, setLocations] = useState<LocationSelection[]>(settings.feedFilter.locations ?? []);

  const finish = (selection: LocationSelection[]) => {
    update('feedFilter', { ...settings.feedFilter, locations: selection.length ? selection : undefined });
    update('onboardingDone', true);
    void requestSync('onboarding', { force: true });
    router.replace('/');
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background, paddingTop: insets.top + space.l }]}>
      <ProvincePicker
        value={locations}
        onChange={setLocations}
        header={
          <View style={styles.intro}>
            <Text variant="screenTitle">Takip etmek istediğin yerleri seç</Text>
            <Text variant="body" tone="secondary">
              Akış bu yerlere göre filtrelenir. Konumu belirtilmemiş ilanlar da gösterilir. Daha sonra değiştirebilirsin.
            </Text>
          </View>
        }
      />
      <View style={[styles.footer, { borderTopColor: c.separator, paddingBottom: insets.bottom + space.s }]}>
        <Button kind="plain" label="Atla" onPress={() => finish([])} />
        <Button label={locations.length ? `Devam (${locations.length} il)` : 'Tüm Türkiye ile devam'} onPress={() => finish(locations)} flex />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { gap: space.s, paddingBottom: space.s },
  footer: { flexDirection: 'row', gap: space.s, paddingHorizontal: GUTTER, paddingTop: space.s, borderTopWidth: StyleSheet.hairlineWidth },
});
