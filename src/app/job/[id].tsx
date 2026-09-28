import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, EmptyState } from '@/components/common/controls';
import { Icon } from '@/components/common/icon';
import { Text } from '@/components/common/text';
import { ApplicationFacts, DetailSection, Fact, LongText, requirementFacts, SourceList } from '@/components/jobs/job-detail-sections';
import { deadlineInfo, detailFacts, locationLine, STATUS_LABELS } from '@/components/jobs/job-format';
import { StatusSheet } from '@/components/jobs/status-sheet';
import { useJobActions, useJobDetail } from '@/hooks/use-jobs';
import { markViewed } from '@/services/jobs-service';
import { getSource, sourceDisplayName } from '@/sources/registry';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { formatLongDate } from '@/utils/dates';
import { displayOrganization, displayTitle } from '@/utils/display';

async function openExternal(url: string) {
  try {
    await WebBrowser.openBrowserAsync(url, { showTitle: true, enableBarCollapsing: true });
  } catch {
    Alert.alert('Bağlantı açılamadı', url);
  }
}

export default function JobDetailScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);
  const router = useRouter();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const detail = useJobDetail(id);
  const actions = useJobActions();
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (Number.isFinite(id)) void markViewed(id);
  }, [id]);

  if (detail.isLoading) return null;
  if (!detail.data) return <EmptyState title="İlan bulunamadı." />;

  const { job, duplicates, personal } = detail.data;
  const deadline = deadlineInfo(job.applicationDeadline);
  const facts = detailFacts(job);
  const requirements = requirementFacts(job);
  const source = getSource(job.sourceId);
  const originalUrl = job.canonicalUrl ?? job.sourceUrl;
  const applyUrl = job.applicationUrl ?? originalUrl;
  const sessionBoundSource = job.sourceId === 'kamuilan-sbb';

  const toggleFavorite = () => {
    void Haptics.selectionAsync();
    actions.favorite.mutate({ id, value: !personal.isFavorite });
  };
  const toggleHidden = () => {
    actions.hide.mutate({ id, value: !personal.isHidden });
    if (!personal.isHidden) router.back();
  };

  return (
    <View style={[styles.flex, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }}>
        <View style={styles.head}>
          <Text variant="headline" selectable>
            {displayTitle(job.title, job.organization)}
          </Text>
          {job.organization ? (
            <Text variant="bodyStrong" tone="secondary" selectable>
              {displayOrganization(job.organization)}
            </Text>
          ) : null}
          <Text variant="meta" tone="tertiary">
            {[locationLine(job) || 'Konum belirtilmemiş', job.publishedAt ? formatLongDate(job.publishedAt) : null].filter(Boolean).join(' · ')}
          </Text>
          <Text variant="meta" tone="tertiary">
            Kaynak: {sourceDisplayName(job.sourceId)}
            {duplicates.length ? ` · ayrıca ${duplicates.length} kaynakta daha bulundu` : ''}
          </Text>
          {deadline ? (
            <View style={styles.deadline}>
              <Icon name="clock" size={16} color={deadline.urgent ? c.critical : c.textSecondary} />
              <Text variant="bodyStrong" tone={deadline.urgent ? 'critical' : 'primary'}>
                {deadline.label === 'Süresi doldu' ? 'Başvuru süresi doldu' : `Son başvuru ${formatLongDate(job.applicationDeadline)}`}
              </Text>
              {deadline.label !== 'Süresi doldu' && !deadline.label.startsWith('Son başvuru') ? (
                <Text variant="meta" tone={deadline.urgent ? 'critical' : 'secondary'}>
                  · {deadline.label}
                </Text>
              ) : null}
            </View>
          ) : null}
          {facts.length ? (
            <Text variant="meta" tone="secondary" style={styles.facts}>
              {facts.join('  ·  ')}
            </Text>
          ) : null}
        </View>

        <DetailSection title="Takip">
          <Pressable onPress={() => setStatusOpen(true)} style={styles.statusRow} accessibilityRole="button">
            <Text variant="meta" tone="secondary" style={styles.factLabel}>
              Durum
            </Text>
            <Text variant="body" tone={personal.status ? 'primary' : 'tertiary'} style={styles.flex}>
              {personal.status ? STATUS_LABELS[personal.status] : 'Seç'}
            </Text>
            <Icon name="chevronRight" size={16} color={c.textTertiary} />
          </Pressable>
          <Fact label="Başvuru tarihi" value={formatLongDate(personal.appliedAt)} />
          <NoteField initial={personal.note ?? ''} onSave={(value) => actions.note.mutate({ id, value })} />
        </DetailSection>

        {job.description ? (
          <DetailSection title="İlan metni">
            <LongText text={job.description} />
          </DetailSection>
        ) : (
          <DetailSection title="İlan metni">
            <Text variant="meta" tone="tertiary">
              {job.detailFetchedAt ? 'Kaynak ilan metni sunmuyor.' : 'Bu kaynakta yalnızca özet bilgi var. Ayrıntılar için orijinal ilanı aç.'}
            </Text>
          </DetailSection>
        )}

        {requirements.length ? (
          <DetailSection title="Şartlar">
            {requirements.map((f) => (
              <Fact key={f.label} label={f.label} value={f.value} />
            ))}
            <Text variant="caption" tone="tertiary" style={{ marginTop: space.xs }}>
              İlan metninden otomatik çıkarıldı. Başvurmadan önce orijinal ilanı kontrol et.
            </Text>
          </DetailSection>
        ) : null}

        <DetailSection title="Başvuru">
          <ApplicationFacts job={job} />
          <Text variant="caption" tone="tertiary" style={{ marginTop: space.xs }}>
            Başvuru yalnızca kaynağın kendi sitesinde yapılır; bu uygulama şifre istemez.
          </Text>
        </DetailSection>

        <DetailSection title="Orijinal ilan">
          <SourceList job={job} duplicates={duplicates} onOpen={(u) => void openExternal(u)} />
          {sessionBoundSource ? (
            <Text variant="caption" tone="tertiary">
              {source?.displayName} ilan bağlantılarını oturuma göre değiştirdiği için kaynağın ana sayfası açılır.
            </Text>
          ) : null}
        </DetailSection>
      </ScrollView>

      <View style={[styles.actionBar, { borderTopColor: c.separator, backgroundColor: c.background, paddingBottom: insets.bottom + space.s }]}>
        <Button kind="secondary" icon={personal.isFavorite ? 'bookmarkFilled' : 'bookmark'} label={personal.isFavorite ? 'Kaydedildi' : 'Kaydet'} onPress={toggleFavorite} />
        <Button kind="secondary" icon="hide" label={personal.isHidden ? 'Göster' : 'Gizle'} onPress={toggleHidden} />
        <Button kind="primary" icon="external" label="Başvuruyu aç" onPress={() => void openExternal(applyUrl)} flex />
      </View>

      <StatusSheet
        visible={statusOpen}
        value={personal.status}
        onClose={() => setStatusOpen(false)}
        onSelect={(s) => {
          setStatusOpen(false);
          void Haptics.selectionAsync();
          actions.status.mutate({ id, value: s });
        }}
      />
    </View>
  );
}

/** Kişisel not; klavye kapanınca kaydedilir. */
function NoteField({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const c = useColors();
  const [value, setValue] = useState(initial);
  return (
    <TextInput
      value={value}
      onChangeText={setValue}
      onEndEditing={() => {
        if (value.trim() !== initial.trim()) onSave(value);
      }}
      placeholder="Not ekle (ör. CV'yi güncelle, 26 Eylül'de başvur)"
      placeholderTextColor={c.textTertiary}
      multiline
      style={[styles.note, { color: c.text, borderColor: c.separator }]}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: GUTTER, paddingTop: space.s, gap: space.xs },
  deadline: { flexDirection: 'row', alignItems: 'center', gap: space.s, marginTop: space.m },
  facts: { marginTop: space.s },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.m, minHeight: 40 },
  factLabel: { width: 128 },
  note: {
    marginTop: space.s,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: space.m,
    paddingVertical: space.s,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  actionBar: {
    flexDirection: 'row',
    gap: space.s,
    paddingHorizontal: GUTTER,
    paddingTop: space.s,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
