import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { HIT, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

import { Icon, type IconName } from './icon';
import { Text } from './text';

export function Badge({ label, tone = 'neutral' }: Readonly<{ label: string; tone?: 'neutral' | 'accent' }>) {
  const c = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: tone === 'accent' ? c.accentSoft : c.badge }]}>
      <Text variant="caption" tone={tone === 'accent' ? 'accent' : 'secondary'} style={styles.badgeText}>
        {label}
      </Text>
    </View>
  );
}

/** Metin sekmeleri: "Tümü  Kamu  Özel". Alt çizgi ile seçim; kutu yok. */
export function TextTabs<T extends string>({
  options,
  value,
  onChange,
}: Readonly<{
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}>) {
  const c = useColors();
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={8}
            style={[styles.tab, { borderBottomColor: selected ? c.accent : 'transparent' }]}>
            <Text variant="bodyStrong" tone={selected ? 'primary' : 'tertiary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Segmentli seçim (Kaydedilenler ekranındaki gibi eşit genişlikli). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: Readonly<{
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}>) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.badge }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: c.surface }]}>
            <Text variant="meta" tone={selected ? 'primary' : 'secondary'} style={{ fontWeight: selected ? '600' : '400' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  busy,
  color,
}: Readonly<{
  icon: IconName;
  onPress: () => void;
  label: string;
  busy?: boolean;
  color?: string;
}>) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} accessibilityRole="button" hitSlop={8} style={styles.iconButton} disabled={busy}>
      {busy ? <ActivityIndicator size="small" color={c.textSecondary} /> : <Icon name={icon} color={color} />}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  flex,
}: Readonly<{
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'plain';
  icon?: IconName;
  disabled?: boolean;
  flex?: boolean;
}>) {
  const c = useColors();
  const bg = kind === 'primary' ? c.accent : kind === 'secondary' ? c.badge : 'transparent';
  const fg = kind === 'primary' ? c.onAccent : kind === 'secondary' ? c.text : c.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        flex && { flex: 1 },
      ]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <Text variant="bodyStrong" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function EmptyState({ title, action }: Readonly<{ title: string; action?: ReactNode }>) {
  return (
    <View style={styles.empty}>
      <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontWeight: '500' },
  tabs: { flexDirection: 'row', gap: space.xl },
  tab: { paddingVertical: space.xs, borderBottomWidth: 2 },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 2 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  iconButton: { width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  button: {
    minHeight: HIT,
    paddingHorizontal: space.l,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
  },
  empty: { paddingHorizontal: space.xxxl, paddingVertical: space.xxxl * 2, alignItems: 'center', gap: space.l },
});
