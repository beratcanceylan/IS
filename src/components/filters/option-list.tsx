import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/common/icon';
import { Group } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import { GUTTER, HIT, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

import type { Option } from './filter-labels';

/**
 * Tek veya çoklu seçim listesi. Tekli seçimde seçili öğeye tekrar dokunmak seçimi kaldırır
 * ("Tümü" durumuna döner).
 */
export function OptionList<T extends string>({
  options,
  selected,
  onChange,
  multiple,
}: Readonly<{
  options: Option<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
  multiple?: boolean;
}>) {
  const c = useColors();
  const toggle = (v: T) => {
    if (multiple) onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
    else onChange(selected.includes(v) ? [] : [v]);
  };
  return (
    <Group>
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <Pressable
            key={o.value}
            onPress={() => toggle(o.value)}
            accessibilityRole={multiple ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? c.surfacePressed : c.surface }]}>
            <Text variant="body" style={styles.flex}>
              {o.label}
            </Text>
            <View style={styles.check}>{on ? <Icon name="check" size={18} color={c.accent} /> : null}</View>
          </Pressable>
        );
      })}
    </Group>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: HIT + 4, paddingHorizontal: GUTTER, flexDirection: 'row', alignItems: 'center', gap: space.s },
  flex: { flex: 1 },
  check: { width: 22, alignItems: 'center' },
});
