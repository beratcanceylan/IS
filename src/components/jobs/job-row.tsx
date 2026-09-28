import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/common/controls';
import { Icon } from '@/components/common/icon';
import { Text } from '@/components/common/text';
import type { JobListItem } from '@/domain/job';
import { sourceDisplayName } from '@/sources/registry';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { displayOrganization, displayTitle } from '@/utils/display';

import { deadlineInfo, locationLine, publishedLabel, rowBadges, STATUS_LABELS } from './job-format';

interface Props {
  job: JobListItem;
  onPress: (id: number) => void;
}

/**
 * Akış satırı. Kart değil: tipografi + boşluk + ayraç ile ayrılır.
 *   Başlık
 *   Kurum
 *   Konum · kaynak · yayın
 *   [rozetler]                 son başvuru
 */
function JobRowBase({ job, onPress }: Props) {
  const c = useColors();
  const deadline = deadlineInfo(job.applicationDeadline);
  const location = locationLine(job) || (job.sector === 'public' ? 'Konum belirtilmemiş' : '');
  const meta = [location, sourceDisplayName(job.sourceId), publishedLabel(job)].filter(Boolean).join(' · ');
  const badges = rowBadges(job);

  return (
    <Pressable
      onPress={() => onPress(job.id)}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfacePressed : c.background }]}
      accessibilityRole="button"
      accessibilityLabel={`${displayTitle(job.title, job.organization)}, ${displayOrganization(job.organization)}`}>
      <View style={styles.titleLine}>
        {job.isNew && !job.isSeen ? <View style={[styles.dot, { backgroundColor: c.accent }]} /> : null}
        <Text variant="jobTitle" numberOfLines={2} style={styles.flex}>
          {displayTitle(job.title, job.organization)}
        </Text>
        {job.isFavorite ? <Icon name="bookmarkFilled" size={16} color={c.accent} /> : null}
      </View>
      {job.organization ? (
        <Text variant="organization" tone="secondary" numberOfLines={1}>
          {displayOrganization(job.organization)}
        </Text>
      ) : null}
      <Text variant="meta" tone="tertiary" numberOfLines={1}>
        {meta}
      </Text>
      {badges.length || deadline || job.personalStatus ? (
        <View style={styles.footer}>
          <View style={styles.badges}>
            {job.personalStatus ? <Badge label={STATUS_LABELS[job.personalStatus]} tone="accent" /> : null}
            {badges.map((b) => (
              <Badge key={b} label={b} />
            ))}
          </View>
          {deadline ? (
            <Text variant="meta" tone={deadline.urgent ? 'critical' : 'secondary'} style={deadline.urgent && styles.urgent}>
              {deadline.label}
            </Text>
          ) : null}
        </View>
      ) : null}
      {job.duplicateCount > 0 ? (
        <Text variant="caption" tone="tertiary">
          +{job.duplicateCount} kaynakta daha
        </Text>
      ) : null}
    </Pressable>
  );
}

export const JobRow = memo(JobRowBase);

const styles = StyleSheet.create({
  row: { paddingHorizontal: GUTTER, paddingVertical: space.m, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s },
  flex: { flex: 1 },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs, gap: space.s },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, flex: 1 },
  urgent: { fontWeight: '600' },
});
