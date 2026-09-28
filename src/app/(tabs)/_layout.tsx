import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useSettings } from '@/state/settings-context';
import { useColors } from '@/theme/use-theme';

export default function TabsLayout() {
  const { settings } = useSettings();
  const c = useColors();
  if (!settings.onboardingDone) return <Redirect href="/onboarding" />;

  return (
    <NativeTabs
      backgroundColor={c.background}
      indicatorColor={c.accentSoft}
      labelVisibilityMode="labeled"
      iconColor={{ default: c.textTertiary, selected: c.accent }}
      labelStyle={{ default: { color: c.textTertiary }, selected: { color: c.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Akış</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet', selected: 'list.bullet' }} md="view_agenda" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Label>Ara</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Label>Kaydedilenler</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bookmark', selected: 'bookmark.fill' }} md="bookmarks" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Ayarlar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
