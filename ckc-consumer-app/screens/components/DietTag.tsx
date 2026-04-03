/**
 * DietTag
 *
 * Single source of truth for diet protocol tag rendering.
 *
 * Variants:
 *   circle — compact filled circle with abbreviation. Used on recipe cards and
 *            detail screens. Outlined (border only) when status === 'modified'.
 *   pill   — bordered pill with full protocol label. Used on Profile and
 *            SetupComplete screens.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

export const DIET_COLORS: Record<string, string> = {
  AIP: Colors.diet.AIP,
  LF:  Colors.diet.LF,
  K:   Colors.diet.K,
  GF:  Colors.diet.GF,
  DF:  Colors.diet.DF,
  V:   Colors.diet.V,
  Vg:  Colors.diet.Vg,
  LH:  Colors.diet.LH,
};

export const DIET_LABELS: Record<string, string> = {
  AIP: 'Autoimmune Protocol',
  LF:  'Low-FODMAP',
  K:   'Keto',
  GF:  'Gluten-Free',
  DF:  'Dairy-Free',
  V:   'Vegan',
  Vg:  'Vegetarian',
  LH:  'Low-Histamine',
};

interface DietTagProps {
  protocol: string;
  variant?: 'circle' | 'pill';
  /** 'modified' renders an outlined circle (border only) to indicate swap-required compliance */
  status?: 'native' | 'modified';
}

export default function DietTag({
  protocol,
  variant = 'circle',
  status = 'native',
}: DietTagProps) {
  const color = DIET_COLORS[protocol] ?? Colors.textMuted;
  const label = DIET_LABELS[protocol] ?? protocol;

  if (variant === 'pill') {
    return (
      <View style={[
        styles.pill,
        { borderColor: color, backgroundColor: `${color}14` },
      ]}>
        <Text style={[styles.pillText, { color }]}>
          {label}
        </Text>
      </View>
    );
  }

  if (status === 'modified') {
    return (
      <View style={[styles.circle, styles.circleOutlined, { borderColor: color }]}>
        <Text style={[styles.circleText, { color }]}>{protocol}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.circle, { backgroundColor: color }]}>
      <Text style={styles.circleText}>{protocol}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleOutlined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  circleText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.3,
  },

  pill: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
});
