import type { TextStyle } from 'react-native';

/**
 * Görsel sistem. Küçük palet, tek accent (petrol), hiyerarşi renkten çok tipografiyle kurulur.
 * Yeni renk eklemeden önce var olanlardan biri iş görüyor mu diye bak.
 */
export interface Palette {
  /** Ekran zemini. */
  background: string;
  /** Gruplanmış satırlar, sheet'ler, alt aksiyon alanı. */
  surface: string;
  /** Basılı durum / seçili satır. */
  surfacePressed: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  separator: string;
  accent: string;
  /** Accent üzerindeki metin. */
  onAccent: string;
  /** Rozet ve seçili chip zemini. */
  accentSoft: string;
  badge: string;
  /** Yalnızca acil durumlar: "Bugün bitiyor", hata. */
  critical: string;
}

export const light: Palette = {
  background: '#F4F5F7',
  surface: '#FFFFFF',
  surfacePressed: '#E9EBEE',
  text: '#16191D',
  textSecondary: '#555D67',
  textTertiary: '#8A919A',
  separator: '#DADDE2',
  accent: '#1F5F74',
  onAccent: '#FFFFFF',
  accentSoft: '#E3EDF0',
  badge: '#EBEDF0',
  critical: '#B4232C',
};

export const dark: Palette = {
  background: '#121416',
  surface: '#1B1E21',
  surfacePressed: '#262A2E',
  text: '#E7E9EC',
  textSecondary: '#A3A9B1',
  textTertiary: '#6E757D',
  separator: '#2B2F34',
  accent: '#86B8CB',
  onAccent: '#0E1A1F',
  accentSoft: '#1E3038',
  badge: '#25292D',
  critical: '#F0A6A6',
};

export const space = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

/** Ekran kenar boşluğu. */
export const GUTTER = space.l;
/** Minimum dokunma alanı. */
export const HIT = 44;

export type TypeVariant = 'screenTitle' | 'headline' | 'sectionTitle' | 'jobTitle' | 'organization' | 'meta' | 'caption' | 'body' | 'bodyStrong';

export const type: Record<TypeVariant, TextStyle> = {
  screenTitle: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.4 },
  /** İlan detayındaki pozisyon adı. */
  headline: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.3 },
  sectionTitle: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  jobTitle: { fontSize: 16, lineHeight: 21, fontWeight: '600', letterSpacing: -0.1 },
  organization: { fontSize: 14, lineHeight: 19, fontWeight: '400' },
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
};
