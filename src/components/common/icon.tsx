import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';

import { useColors } from '@/theme/use-theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/**
 * Uygulamada kullanılan ikonların tek listesi: iOS'ta SF Symbols, Android'de Material Symbols.
 * Her metnin yanına ikon koyma; yalnızca eylem ve durum gösterimlerinde kullanılır.
 */
const ICONS = {
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  bookmark: { ios: 'bookmark', android: 'bookmark', web: 'bookmark' },
  bookmarkFilled: { ios: 'bookmark.fill', android: 'bookmark_added', web: 'bookmark_added' },
  hide: { ios: 'eye.slash', android: 'visibility_off', web: 'visibility_off' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' },
  filter: { ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  warning: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
} as const satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: Readonly<{ name: IconName; size?: number; color?: string }>) {
  const c = useColors();
  return <SymbolView name={ICONS[name]} size={size} tintColor={color ?? c.textSecondary} />;
}
