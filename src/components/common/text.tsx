import { Text as RNText, type TextProps } from 'react-native';

import { type TypeVariant, type as typeScale } from '@/theme/tokens';
import { useColors } from '@/theme/use-theme';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'critical';

export interface AppTextProps extends TextProps {
  variant?: TypeVariant;
  tone?: Tone;
}

export function Text({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const c = useColors();
  const color = {
    primary: c.text,
    secondary: c.textSecondary,
    tertiary: c.textTertiary,
    accent: c.accent,
    critical: c.critical,
  }[tone];
  return <RNText {...rest} style={[typeScale[variant], { color }, style]} />;
}
