import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/icon';
import { Separator } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import type { PersonalStatus } from '@/domain/job';
import { GUTTER, HIT, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

import { STATUS_LABELS } from './job-format';

const ORDER: PersonalStatus[] = ['toReview', 'applied', 'interview', 'waiting', 'offer', 'rejected', 'notInterested'];

/** Küçük durum seçici. Trello tahtası değil; tek bir liste. */
export function StatusSheet({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: PersonalStatus | null;
  onSelect: (s: PersonalStatus | null) => void;
  onClose: () => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const options: { value: PersonalStatus | null; label: string }[] = [
    { value: null, label: 'Durum yok' },
    ...ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Kapat" />
      <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + space.s }]}>
        <Text variant="sectionTitle" tone="secondary" style={styles.title}>
          Başvuru durumu
        </Text>
        {options.map((o, i) => (
          <View key={o.label}>
            {i > 0 ? <Separator /> : null}
            <Pressable
              onPress={() => onSelect(o.value)}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: c.surfacePressed }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: o.value === value }}>
              <Text variant="body">{o.label}</Text>
              {o.value === value ? <Icon name="check" size={18} color={c.accent} /> : null}
            </Pressable>
          </View>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { borderTopLeftRadius: 14, borderTopRightRadius: 14, paddingTop: space.l },
  title: { paddingHorizontal: GUTTER, paddingBottom: space.s },
  option: { minHeight: HIT + 4, paddingHorizontal: GUTTER, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
