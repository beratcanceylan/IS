import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/common/controls';
import { Group, Row, SectionHeader } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import { lastSuccessLabel, MODE_LABELS, problemSummary, statusLabel } from '@/components/sources/source-status';
import { getDb } from '@/db/database';
import { setSourceEnabled } from '@/db/repositories/sources-repository';
import { useSyncStatus } from '@/hooks/use-sync';
import { useSourcesOverview } from '@/hooks/use-sources';
import { requestSync } from '@/sync/sync-controller';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { formatDateTime } from '@/utils/dates';
import { formatCount } from '@/utils/display';

export default function SourceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const qc = useQueryClient();
  const overview = useSourcesOverview();
  const sync = useSyncStatus();
  const [showDev, setShowDev] = useState(false);
  const item = overview.data?.find((o) => o.source.id === id);
  if (!item) return null;
  const { source, health } = item;

  const toggle = async (enabled: boolean) => {
    await setSourceEnabled(await getDb(), source.id, enabled);
    await qc.invalidateQueries({ queryKey: ['sources'] });
  };

  if (source.mode === 'SEARCH_LINK') {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <Stack.Screen options={{ title: source.displayName }} />
        <Text variant="body">{source.description}</Text>
        <Text variant="meta" tone="secondary">
          Otomatik çekilmiyor: {source.reason}
        </Text>
        <Button label="Sitede ara" icon="external" onPress={() => void WebBrowser.openBrowserAsync(source.buildSearchUrl({}))} />
      </ScrollView>
    );
  }

  const problem = problemSummary(health);
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
      <Stack.Screen options={{ title: source.displayName }} />
      <View style={styles.pad}>
        <Text variant="body" tone="secondary">
          {source.description}
        </Text>
        {problem ? (
          <Text variant="meta" tone="critical">
            {problem}
          </Text>
        ) : null}
      </View>

      <Group>
        <Row label="Durum" value={item.enabled ? statusLabel(health) : 'Kapalı'} />
        <Row label="Son kontrol" value={lastSuccessLabel(health).replace('Son başarılı kontrol: ', '')} />
        <Row label="Son senkronda yeni" value={health?.lastNewCount != null ? String(health.lastNewCount) : '—'} />
        <Row label="Aktif ilan" value={formatCount(item.activeCount)} />
        <Row label="Erişim" value={MODE_LABELS[source.mode]} />
        <Row
          label="Otomatik kontrol"
          right={<Switch value={item.enabled} onValueChange={(v) => void toggle(v)} trackColor={{ true: c.accent }} />}
        />
      </Group>

      <View style={styles.pad}>
        <Button
          kind="secondary"
          label={sync.running ? 'Kontrol ediliyor…' : 'Şimdi kontrol et'}
          disabled={sync.running}
          onPress={() => void requestSync('manual', { force: true, sourceIds: [source.id] })}
        />
        <Button kind="plain" label="Kaynağın sitesini aç" onPress={() => void WebBrowser.openBrowserAsync(source.homepageUrl)} />
      </View>

      <SectionHeader
        title="Geliştirici ayrıntıları"
        right={<Button kind="plain" label={showDev ? 'Gizle' : 'Göster'} onPress={() => setShowDev((s) => !s)} />}
      />
      {showDev ? (
        <Group>
          <Row label="Son deneme" value={formatDateTime(health?.lastAttemptAt) || '—'} />
          <Row label="HTTP durumu" value={health?.lastHttpStatus != null ? String(health.lastHttpStatus) : '—'} />
          <Row label="Parser sürümü" value={String(health?.parserVersion ?? source.parserVersion)} />
          <Row label="Ayrıştırılan ilan" value={health?.lastParsedCount != null ? String(health.lastParsedCount) : '—'} />
          <Row label="Süre" value={health?.lastDurationMs != null ? `${(health.lastDurationMs / 1000).toFixed(1)} sn` : '—'} />
          <Row label="Ardışık hata" value={String(health?.consecutiveFailures ?? 0)} />
          <Row label="Sonraki izinli istek" value={formatDateTime(health?.nextAllowedAt) || 'Şimdi'} />
          <Row label="Hata" detail={health?.lastError ?? '—'} />
          <Row label="Uyarı" detail={health?.warning ?? '—'} />
          <Row label="ETag / Last-Modified" detail={[health?.etag, health?.lastModified].filter(Boolean).join(' · ') || '—'} />
        </Group>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: GUTTER, paddingVertical: space.l, gap: space.m },
});
