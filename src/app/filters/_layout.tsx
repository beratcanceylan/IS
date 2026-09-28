import { Stack } from 'expo-router';

import { useSettings } from '@/state/settings-context';
import { FilterDraftProvider } from '@/state/filter-draft-context';
import { useColors } from '@/theme/use-theme';

export default function FiltersLayout() {
  const { settings } = useSettings();
  const c = useColors();
  return (
    <FilterDraftProvider initial={settings.feedFilter}>
      <Stack
        screenOptions={{
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.text },
          headerShadowVisible: false,
          headerStyle: { backgroundColor: c.background },
          contentStyle: { backgroundColor: c.background },
          headerBackButtonDisplayMode: 'minimal',
        }}>
        <Stack.Screen name="index" options={{ title: 'Filtreler' }} />
        <Stack.Screen name="[category]" options={{ title: '' }} />
      </Stack>
    </FilterDraftProvider>
  );
}
