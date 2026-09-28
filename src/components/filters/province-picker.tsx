import { useMemo, useState, type ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/common/icon';
import { Separator } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import { PROVINCES, type Province } from '@/data/locations';
import type { LocationSelection } from '@/domain/saved-search';
import { GUTTER, HIT, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';
import { foldTr } from '@/utils/turkish-normalization';

type Row = { kind: 'all' } | { kind: 'province'; p: Province } | { kind: 'district'; p: Province; name: string };

/**
 * İl / ilçe seçimi. Boş seçim "Tüm Türkiye" demektir. Seçili ilin altında ilçeler açılabilir;
 * hiç ilçe seçilmemişse ilin tamamı kastedilir. GPS kullanılmaz.
 */
export function ProvincePicker({
  value,
  onChange,
  header,
}: Readonly<{
  value: LocationSelection[];
  onChange: (v: LocationSelection[]) => void;
  header?: ReactElement;
}>) {
  const c = useColors();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const selected = useMemo(() => new Map(value.map((l) => [l.plate, l])), [value]);

  const rows = useMemo<Row[]>(() => {
    const q = foldTr(query);
    const provinces = q
      ? PROVINCES.filter((p) => foldTr(p.name).includes(q) || p.districts.some((d) => foldTr(d).startsWith(q)))
      : // Seçili iller üstte.
        [...PROVINCES].sort((a, b) => Number(selected.has(b.plate)) - Number(selected.has(a.plate)));
    const out: Row[] = q ? [] : [{ kind: 'all' }];
    for (const p of provinces) {
      out.push({ kind: 'province', p });
      const showDistricts = expanded === p.plate || (q && p.districts.some((d) => foldTr(d).startsWith(q)));
      if (showDistricts) {
        const districts = q && expanded !== p.plate ? p.districts.filter((d) => foldTr(d).startsWith(q)) : p.districts;
        for (const name of districts) out.push({ kind: 'district', p, name });
      }
    }
    return out;
  }, [query, expanded, selected]);

  const toggleProvince = (p: Province) => {
    if (selected.has(p.plate)) {
      onChange(value.filter((l) => l.plate !== p.plate));
      if (expanded === p.plate) setExpanded(null);
    } else {
      onChange([...value, { plate: p.plate }]);
    }
  };

  const toggleDistrict = (p: Province, name: string) => {
    const current = selected.get(p.plate);
    const districts = new Set(current?.districts ?? []);
    if (districts.has(name)) districts.delete(name);
    else districts.add(name);
    const next: LocationSelection = { plate: p.plate, ...(districts.size ? { districts: [...districts] } : {}) };
    onChange(current ? value.map((l) => (l.plate === p.plate ? next : l)) : [...value, next]);
  };

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => (r.kind === 'all' ? 'all' : r.kind === 'province' ? `p${r.p.plate}` : `d${r.p.plate}-${r.name}`)}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          <View style={[styles.search, { backgroundColor: c.badge }]}>
            <Icon name="search" size={18} color={c.textTertiary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="İl veya ilçe ara"
              placeholderTextColor={c.textTertiary}
              style={[styles.searchInput, { color: c.text }]}
              autoCorrect={false}
            />
          </View>
        </View>
      }
      ItemSeparatorComponent={() => <Separator />}
      renderItem={({ item }) => {
        if (item.kind === 'all') {
          return <CheckRow label="Tüm Türkiye" checked={value.length === 0} onPress={() => onChange([])} />;
        }
        if (item.kind === 'province') {
          const sel = selected.get(item.p.plate);
          const districtCount = sel?.districts?.length ?? 0;
          return (
            <CheckRow
              label={item.p.name}
              checked={!!sel}
              onPress={() => toggleProvince(item.p)}
              accessory={
                <Pressable
                  hitSlop={8}
                  onPress={() => setExpanded(expanded === item.p.plate ? null : item.p.plate)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.p.name} ilçeleri`}>
                  <Text variant="meta" tone={districtCount ? 'accent' : 'tertiary'}>
                    {districtCount ? `${districtCount} ilçe` : 'İlçeler'}
                  </Text>
                </Pressable>
              }
            />
          );
        }
        const districts = selected.get(item.p.plate)?.districts ?? [];
        return (
          <CheckRow label={item.name} caption={item.p.name} indent checked={districts.includes(item.name)} onPress={() => toggleDistrict(item.p, item.name)} />
        );
      }}
    />
  );
}

function CheckRow({
  label,
  caption,
  checked,
  onPress,
  accessory,
  indent,
}: Readonly<{
  label: string;
  caption?: string;
  checked: boolean;
  onPress: () => void;
  accessory?: ReactElement;
  indent?: boolean;
}>) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.row, indent && styles.indent, { backgroundColor: pressed ? c.surfacePressed : c.background }]}>
      <View style={styles.check}>{checked ? <Icon name="check" size={18} color={c.accent} /> : null}</View>
      <Text variant="body" style={styles.flex}>
        {label}
        {caption ? <Text variant="meta" tone="tertiary">{`  ${caption}`}</Text> : null}
      </Text>
      {accessory}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: GUTTER, paddingBottom: space.s, gap: space.l },
  search: { flexDirection: 'row', alignItems: 'center', gap: space.s, borderRadius: 10, paddingHorizontal: space.m, minHeight: 40 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: space.s },
  row: { minHeight: HIT + 4, flexDirection: 'row', alignItems: 'center', paddingHorizontal: GUTTER, gap: space.s },
  indent: { paddingLeft: GUTTER + space.xxl },
  check: { width: 22, alignItems: 'center' },
  flex: { flex: 1 },
});
