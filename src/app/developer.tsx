import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/common/controls';
import { Group, Row, SectionHeader } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import { getDb } from '@/db/database';
import { purgeOldJobs, rebuildFingerprints } from '@/db/repositories/jobs-repository';
import { LATEST_VERSION } from '@/db/migrations';
import { useDeveloperStats } from '@/hooks/use-sources';
import { useSettings } from '@/state/settings-context';
import { requestSync } from '@/sync/sync-controller';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { formatDateTime } from '@/utils/dates';
import { formatCount } from '@/utils/display';

export default function DeveloperScreen() {
  const c = useColors();
  const qc = useQueryClient();
  const { settings, update } = useSettings();
  const dev = useDeveloperStats();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    try {
      const msg = await fn();
      await qc.invalidateQueries({ refetchType: 'all' });
      Alert.alert(label, msg);
    } catch (e) {
      Alert.alert(label, e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const stats = dev.data?.stats;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
      <SectionHeader title="Veritabanı" />
      <Group>
        <Row label="Şema sürümü" value={`${dev.data?.version ?? '—'} / ${LATEST_VERSION}`} />
        <Row label="Tam metin arama (FTS5)" value={settings.ftsAvailable === false ? 'Yok (LIKE)' : 'Var'} />
        <Row label="Toplam ilan" value={stats ? formatCount(stats.total) : '—'} />
        <Row
          label="Yaşam döngüsü"
          detail={stats ? Object.entries(stats.byLifecycle).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—' : '—'}
        />
        <Row label="Duplicate grupları" value={stats ? String(stats.duplicateGroups) : '—'} />
        <Row label="Detayı çekilmiş" value={stats ? formatCount(stats.withDetails) : '—'} />
      </Group>

      <SectionHeader title="Son senkronlar" />
      <Group>
        {(dev.data?.runs ?? []).map((r) => (
          <Row
            key={r.id}
            label={`${formatDateTime(r.startedAt)} · ${r.trigger}`}
            detail={`Yeni ${r.newCount} · güncellenen ${r.updatedCount} · hata ${r.errorCount}${r.finishedAt ? '' : ' · yarıda kaldı'}`}
          />
        ))}
      </Group>

      <SectionHeader title="İşlemler" />
      <View style={styles.actions}>
        <Button
          kind="secondary"
          label="Tüm kaynakları şimdi senkronize et"
          disabled={!!busy}
          onPress={() => void run('Senkron', async () => {
            const r = await requestSync('manual', { force: true });
            return r ? r.sources.map((s) => `${s.sourceId}: ${s.outcome}${s.error ? ` (${s.error})` : ''}`).join('\n') : 'Başarısız';
          })}
        />
        <Button
          kind="secondary"
          label="Demo kaynağı çalıştır"
          disabled={!!busy}
          onPress={() => void run('Demo', async () => {
            const r = await requestSync('manual', { force: true, sourceIds: ['demo'] });
            return `${r?.sources[0]?.insertedIds.length ?? 0} ilan eklendi`;
          })}
        />
        <Button
          kind="secondary"
          label="Fingerprint ve grupları yeniden oluştur"
          disabled={!!busy}
          onPress={() => void run('Fingerprint', async () => {
            const r = await rebuildFingerprints(await getDb());
            return `${r.jobs} ilan, ${r.groups} duplicate grubu`;
          })}
        />
        <Button
          kind="secondary"
          label="Eski önbelleği temizle (60 gün+)"
          disabled={!!busy}
          onPress={() => void run('Temizlik', async () => `${await purgeOldJobs(await getDb(), 60)} ilan silindi (kişisel verisi olanlar korunur)`)}
        />
      </View>

      <SectionHeader title="Görünüm" />
      <Group>
        <Row
          label="Demo kaynağını listele"
          right={<Switch value={settings.developerMode} onValueChange={(v) => update('developerMode', v)} trackColor={{ true: c.accent }} />}
        />
      </Group>
      {busy ? (
        <Text variant="caption" tone="tertiary" style={styles.busy}>
          {busy} çalışıyor…
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: { paddingHorizontal: GUTTER, gap: space.s },
  busy: { textAlign: 'center', marginTop: space.l },
});
