import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/controls';
import { ProvincePicker } from '@/components/filters/province-picker';
import type { LocationSelection } from '@/domain/saved-search';
import { useSettings } from '@/state/settings-context';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

/** Akışın konum seçimi (akış başlığındaki "Tüm Türkiye ▾"). */
export default function LocationsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { settings, update } = useSettings();
  const [locations, setLocations] = useState<LocationSelection[]>(settings.feedFilter.locations ?? []);

  const apply = () => {
    update('feedFilter', { ...settings.feedFilter, locations: locations.length ? locations : undefined });
    router.back();
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <View style={{ height: space.m }} />
      <ProvincePicker value={locations} onChange={setLocations} />
      <View style={[styles.footer, { borderTopColor: c.separator, paddingBottom: insets.bottom + space.s }]}>
        <Button label={locations.length ? `${locations.length} yeri uygula` : 'Tüm Türkiye'} onPress={apply} flex />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { paddingHorizontal: GUTTER, paddingTop: space.s, borderTopWidth: StyleSheet.hairlineWidth },
});
