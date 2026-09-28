import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { GUTTER, HIT, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

import { Icon } from './icon';
import { Text } from './text';

/** İnce ayraç; soldan metin hizasında başlar (native liste gibi). */
export function Separator({ inset = GUTTER }: Readonly<{ inset?: number }>) {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: inset }} />;
}

export function SectionHeader({ title, right }: Readonly<{ title: string; right?: ReactNode }>) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="sectionTitle" tone="secondary">
        {title}
      </Text>
      {right}
    </View>
  );
}

export interface RowProps {
  label: string;
  value?: string | null;
  detail?: string | null;
  onPress?: () => void;
  chevron?: boolean;
  right?: ReactNode;
  destructive?: boolean;
  style?: ViewStyle;
}

/** Ayarlar tarzı satır: etiket solda, değer sağda. */
export function Row({ label, value, detail, onPress, chevron = !!onPress, right, destructive, style }: Readonly<RowProps>) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfacePressed : c.surface }, style]}>
      <View style={styles.rowText}>
        <Text variant="body" tone={destructive ? 'critical' : 'primary'}>
          {label}
        </Text>
        {detail ? (
          <Text variant="caption" tone="tertiary" numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" tone="secondary" numberOfLines={1} style={styles.rowValue}>
          {value}
        </Text>
      ) : null}
      {right}
      {chevron ? <Icon name="chevronRight" size={16} color={c.textTertiary} /> : null}
    </Pressable>
  );
}

/** Gruplanmış satırlar: arada ayraç, üst/alt kenarda ince çizgi. Kart değil. */
export function Group({ children }: Readonly<{ children: ReactNode[] | ReactNode }>) {
  const c = useColors();
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.separator }}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 ? (
            <View style={{ backgroundColor: c.surface }}>
              <Separator />
            </View>
          ) : null}
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingTop: space.xxl,
    paddingBottom: space.s,
  },
  row: {
    minHeight: HIT + 4,
    paddingHorizontal: GUTTER,
    paddingVertical: space.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
  },
  rowText: { flex: 1, gap: 2 },
  rowValue: { maxWidth: '50%', textAlign: 'right' },
});
