import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { SectionHeader } from '@/components/common/list-parts';
import { Text } from '@/components/common/text';
import {
  DEADLINE_OPTIONS,
  EDUCATION_OPTIONS,
  EMPLOYMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  FILTER_TITLES,
  KPSS_OPTIONS,
  KPSS_TYPE_OPTIONS,
  PUBLIC_TYPE_OPTIONS,
  PUBLISHED_OPTIONS,
  sourceOptions,
  WORK_MODEL_OPTIONS,
  type FilterCategory,
} from '@/components/filters/filter-labels';
import { OptionList } from '@/components/filters/option-list';
import { ProvincePicker } from '@/components/filters/province-picker';
import { useFilterDraft } from '@/state/filter-draft-context';
import { GUTTER, space } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

export default function FilterCategoryScreen() {
  const { category } = useLocalSearchParams<{ category: FilterCategory }>();
  const { draft, patch } = useFilterDraft();
  const title = FILTER_TITLES[category] ?? 'Filtre';

  if (category === 'location') {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <View style={{ height: space.m }} />
        <ProvincePicker value={draft.locations ?? []} onChange={(locations) => patch({ locations })} />
      </>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title }} />
      <View style={{ height: space.m }} />
      <CategoryBody category={category} />
    </ScrollView>
  );
}

function CategoryBody({ category }: Readonly<{ category: FilterCategory }>) {
  const { draft, patch } = useFilterDraft();
  const one = <T,>(v: T | undefined) => (v === undefined ? [] : [v]);

  switch (category) {
    case 'published':
      return <OptionList options={PUBLISHED_OPTIONS} selected={one(draft.publishedWithin)} onChange={([v]) => patch({ publishedWithin: v })} />;
    case 'deadline':
      return <OptionList options={DEADLINE_OPTIONS} selected={one(draft.deadlineWithin)} onChange={([v]) => patch({ deadlineWithin: v })} />;
    case 'education':
      return (
        <OptionList
          multiple
          options={EDUCATION_OPTIONS}
          selected={draft.educationLevels ?? []}
          onChange={(educationLevels) => patch({ educationLevels })}
        />
      );
    case 'publicTypes':
      return (
        <OptionList
          multiple
          options={PUBLIC_TYPE_OPTIONS}
          selected={draft.publicEmploymentTypes ?? []}
          onChange={(publicEmploymentTypes) => patch({ publicEmploymentTypes })}
        />
      );
    case 'employment':
      return (
        <OptionList multiple options={EMPLOYMENT_OPTIONS} selected={draft.employmentTypes ?? []} onChange={(employmentTypes) => patch({ employmentTypes })} />
      );
    case 'workModel':
      return <OptionList multiple options={WORK_MODEL_OPTIONS} selected={draft.workModels ?? []} onChange={(workModels) => patch({ workModels })} />;
    case 'experience':
      return <OptionList options={EXPERIENCE_OPTIONS} selected={one(draft.experience)} onChange={([v]) => patch({ experience: v })} />;
    case 'sources':
      return <OptionList multiple options={sourceOptions()} selected={draft.sources ?? []} onChange={(sources) => patch({ sources })} />;
    case 'kpss':
      return <KpssBody />;
    case 'keywords':
      return <KeywordsBody />;
    default:
      return null;
  }
}

function KpssBody() {
  const c = useColors();
  const { draft, patch } = useFilterDraft();
  const [score, setScore] = useState(draft.kpssMyScore != null ? String(draft.kpssMyScore) : '');
  return (
    <>
      <OptionList
        options={KPSS_OPTIONS.filter((o) => o.value !== 'any')}
        selected={draft.kpss && draft.kpss !== 'any' ? [draft.kpss] : []}
        onChange={([v]) => patch({ kpss: v })}
      />
      <SectionHeader title="Puan türü" />
      <OptionList multiple options={KPSS_TYPE_OPTIONS} selected={draft.kpssScoreTypes ?? []} onChange={(kpssScoreTypes) => patch({ kpssScoreTypes })} />
      <SectionHeader title="Puanım" />
      <View style={styles.inputWrap}>
        <TextInput
          value={score}
          onChangeText={(t) => {
            const clean = t.replace(',', '.').replaceAll(/[^\d.]/g, '');
            setScore(clean);
            const n = Number(clean);
            patch({ kpssMyScore: clean && Number.isFinite(n) && n > 0 && n <= 100 ? n : undefined });
          }}
          keyboardType="decimal-pad"
          placeholder="Örn. 78,5"
          placeholderTextColor={c.textTertiary}
          style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: c.separator }]}
        />
        <Text variant="caption" tone="tertiary">
          Minimum puanı bundan yüksek olan ilanlar gizlenir. Minimum puanı belirtilmeyen ilanlar gösterilir.
        </Text>
      </View>
    </>
  );
}

/** Virgülle ayrılmış kelime listeleri. Hariç tutulanlar yalnızca başlık ve kurumda aranır. */
function KeywordsBody() {
  const c = useColors();
  const { draft, patch } = useFilterDraft();
  const [include, setInclude] = useState((draft.includeKeywords ?? []).join(', '));
  const [exclude, setExclude] = useState((draft.excludeKeywords ?? []).join(', '));
  const split = (s: string) =>
    s
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  const inputStyle = [styles.input, styles.multiline, { color: c.text, backgroundColor: c.surface, borderColor: c.separator }];
  return (
    <>
      <SectionHeader title="İçersin (herhangi biri)" />
      <View style={styles.inputWrap}>
        <TextInput
          value={include}
          onChangeText={(t) => {
            setInclude(t);
            patch({ includeKeywords: split(t) });
          }}
          placeholder="bilgisayar, bilişim, yazılım, teknik destek"
          placeholderTextColor={c.textTertiary}
          multiline
          autoCapitalize="none"
          style={inputStyle}
        />
      </View>
      <SectionHeader title="İçermesin" />
      <View style={styles.inputWrap}>
        <TextInput
          value={exclude}
          onChangeText={(t) => {
            setExclude(t);
            patch({ excludeKeywords: split(t) });
          }}
          placeholder="satış, kurye, sigorta"
          placeholderTextColor={c.textTertiary}
          multiline
          autoCapitalize="none"
          style={inputStyle}
        />
        <Text variant="caption" tone="tertiary">
          Başlıkta veya kurum adında geçen ilanlar gizlenir. 3 harf ve daha kısa kelimeler tam kelime olarak aranır.
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  inputWrap: { paddingHorizontal: GUTTER, gap: space.s },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: space.m, paddingVertical: space.m, fontSize: 16 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
});
