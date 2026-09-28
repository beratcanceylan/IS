import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Separator } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import type { JobPosting } from '@/domain/job';
import type { DuplicateMember } from '@/db/repositories/jobs-repository';
import { EDUCATION_LABELS } from '@/extraction/education';
import { sourceDisplayName } from '@/sources/registry';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { formatDateTime, formatLongDate } from '@/utils/dates';

import { kpssLabel } from './job-format';

export function DetailSection({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <View style={styles.section}>
      <Text variant="sectionTitle" tone="secondary" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Etiket–değer satırı. Değer yoksa hiç çizilmez. */
export function Fact({ label, value, emphasize }: Readonly<{ label: string; value: string | null | undefined; emphasize?: boolean }>) {
  if (!value) return null;
  return (
    <View style={styles.fact}>
      <Text variant="meta" tone="secondary" style={styles.factLabel}>
        {label}
      </Text>
      <Text variant={emphasize ? 'bodyStrong' : 'body'} style={styles.factValue}>
        {value}
      </Text>
    </View>
  );
}

export function requirementFacts(job: JobPosting): { label: string; value: string }[] {
  const out: { label: string; value: string | null }[] = [
    { label: 'Eğitim', value: job.educationLevels.map((l) => EDUCATION_LABELS[l]).join(', ') || null },
    { label: 'KPSS', value: kpssLabel(job) === 'KPSS yok' ? 'Aranmıyor' : kpssLabel(job)?.replace(/^KPSS /, '') ?? null },
    { label: 'KPSS yılı', value: job.kpssYear ? String(job.kpssYear) : null },
    { label: 'Yaş', value: ageText(job) },
    { label: 'Deneyim', value: job.experienceText },
    { label: 'Ehliyet', value: job.driverLicenseRequirement },
    { label: 'Askerlik', value: job.militaryRequirement },
    { label: 'Yabancı dil', value: job.foreignLanguageRequirement },
    { label: 'Kadro', value: job.quota ? `${job.quota} kişi` : null },
    { label: 'Statü', value: job.legalStatus },
    { label: 'Maaş', value: job.salaryText },
  ];
  return out.filter((f): f is { label: string; value: string } => !!f.value);
}

function ageText(job: JobPosting): string | null {
  if (job.ageMin && job.ageMax) return `${job.ageMin}–${job.ageMax}`;
  if (job.ageMax) return `En fazla ${job.ageMax}`;
  if (job.ageMin) return `En az ${job.ageMin}`;
  return null;
}

export function ApplicationFacts({ job }: Readonly<{ job: JobPosting }>) {
  return (
    <>
      <Fact label="Başvuru başlangıcı" value={formatDateTime(job.applicationStartAt)} />
      <Fact label="Son başvuru" value={formatDateTime(job.applicationDeadline)} emphasize />
      <Fact label="Sınav tarihi" value={formatLongDate(job.examDate)} />
      <Fact label="Başvuru yeri" value={job.applicationPlatform} />
    </>
  );
}

const COLLAPSED_CHARS = 1200;

/** Uzun ilan metni: ilk kısmı gösterilir, istenirse tamamı. */
export function LongText({ text }: Readonly<{ text: string }>) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > COLLAPSED_CHARS;
  const shown = !long || expanded ? text : `${text.slice(0, COLLAPSED_CHARS).trimEnd()}…`;
  return (
    <View style={{ gap: space.s }}>
      <Text variant="body" selectable>
        {shown}
      </Text>
      {long ? (
        <Pressable onPress={() => setExpanded((e) => !e)} hitSlop={8}>
          <Text variant="bodyStrong" tone="accent">
            {expanded ? 'Daha az göster' : 'Tamamını göster'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SourceList({
  job,
  duplicates,
  onOpen,
}: Readonly<{
  job: JobPosting;
  duplicates: DuplicateMember[];
  onOpen: (url: string) => void;
}>) {
  const c = useColors();
  const all = [{ id: job.id, sourceId: job.sourceId, sourceUrl: job.canonicalUrl ?? job.sourceUrl }, ...duplicates];
  return (
    <View style={[styles.sources, { borderColor: c.separator }]}>
      {all.map((m, i) => (
        <View key={m.id}>
          {i > 0 ? <Separator inset={0} /> : null}
          <Pressable onPress={() => onOpen(m.sourceUrl)} style={styles.sourceRow} accessibilityRole="link">
            <Text variant="body">{sourceDisplayName(m.sourceId)}</Text>
            <Text variant="meta" tone="accent">
              Aç
            </Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: GUTTER, paddingTop: space.xxl, gap: space.s },
  sectionTitle: { marginBottom: space.xs },
  fact: { flexDirection: 'row', gap: space.m, paddingVertical: 2 },
  factLabel: { width: 128, paddingTop: 2 },
  factValue: { flex: 1 },
  sources: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  sourceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: space.m },
});
