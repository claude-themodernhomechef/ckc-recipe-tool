// ─────────────────────────────────────────────
//  DietTag — diet protocol badge component
//  variant="circle" → small filled dot with initials
//  variant="pill"   → rounded label chip
// ─────────────────────────────────────────────

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// Color map matches Colors.diet in theme.ts and catalog.html
export const DIET_COLORS: Record<string, string> = {
  GF:  '#d4943a',
  DF:  '#6aabda',
  V:   '#7cb87a',
  Vg:  '#5bbfb5',
  K:   '#9b8ee0',
  AIP: '#e07878',
  LF:  '#d4a843',
  LH:  '#c47fc4',
};

interface DietTagProps {
  protocol: string;
  variant?: 'circle' | 'pill';
  status?: 'native' | 'modified';
}

export default function DietTag({ protocol, variant = 'pill', status = 'native' }: DietTagProps) {
  const color = DIET_COLORS[protocol] ?? '#888';
  const isModified = status === 'modified';

  if (variant === 'circle') {
    return (
      <View style={[
        styles.circle,
        { backgroundColor: isModified ? 'transparent' : color, borderColor: color },
        isModified && styles.circleMod,
      ]}>
        <Text style={[styles.circleText, isModified && { color }]}>
          {protocol}
        </Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.pill,
      { backgroundColor: isModified ? 'transparent' : color + '22', borderColor: color },
    ]}>
      <Text style={[styles.pillText, { color }]}>
        {protocol}{isModified ? '*' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  circleMod: {
    borderStyle: 'dashed',
  },
  circleText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0f0f0d',
    letterSpacing: 0.3,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 4,
    marginBottom: 4,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
});
