import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button } from '@/components/common/controls';
import { Text } from '@/components/common/text';
import { getDb } from '@/db/database';
import { getAllSettings, type AppSettings } from '@/db/repositories/settings-repository';
import { useForegroundSync } from '@/hooks/use-foreground-sync';
import { useInvalidateOnSync } from '@/hooks/use-sync';
import { SettingsProvider } from '@/state/settings-context';
import { space } from '@/theme/tokens';
import { useColors, useIsDark } from '@/theme/use-theme';

void SplashScreen.preventAutoHideAsync();

// Tüm sorgular yerel SQLite'tan okunur: ağ durumundan bağımsız çalışmalı (networkMode: 'always').
// Tazeleme manuel: senkron bitince veya kullanıcı bir şeyi değiştirince invalidate edilir.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always', staleTime: Infinity, gcTime: 5 * 60_000, retry: 1 },
    mutations: { networkMode: 'always' },
  },
});

export default function RootLayout() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDb()
      .then(getAllSettings)
      .then((s) => {
        if (!cancelled) setSettings(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => void SplashScreen.hideAsync());
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (error) {
    return (
      <StartupError
        message={error}
        onRetry={() => {
          setError(null);
          setAttempt((a) => a + 1);
        }}
      />
    );
  }
  if (!settings) return null;

  return (
    <GestureHandlerRootView style={styles.flex}>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider initial={settings}>
          <AppNavigator />
        </SettingsProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function AppNavigator() {
  const c = useColors();
  const isDark = useIsDark();
  useInvalidateOnSync();
  useForegroundSync();

  const theme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: c.accent, background: c.background, card: c.background, text: c.text, border: c.separator },
    };
  }, [c, isDark]);

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'İşler' }} />
        <Stack.Screen name="job/[id]" options={{ title: '' }} />
        <Stack.Screen name="filters" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="locations" options={{ presentation: 'modal', title: 'Konum' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="sources/index" options={{ title: 'Kaynaklar' }} />
        <Stack.Screen name="sources/[id]" options={{ title: '' }} />
        <Stack.Screen name="developer" options={{ title: 'Geliştirici' }} />
      </Stack>
    </ThemeProvider>
  );
}

function StartupError({ message, onRetry }: Readonly<{ message: string; onRetry: () => void }>) {
  const c = useColors();
  return (
    <View style={[styles.error, { backgroundColor: c.background }]}>
      <Text variant="bodyStrong">Veritabanı açılamadı</Text>
      <Text variant="meta" tone="secondary" style={{ textAlign: 'center' }}>
        {message}
      </Text>
      <Button label="Tekrar dene" onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  error: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xxxl, gap: space.m },
});
