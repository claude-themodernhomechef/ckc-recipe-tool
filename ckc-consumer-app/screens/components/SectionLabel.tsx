/**
 * SectionLabel
 *
 * Small uppercase muted label used to introduce content sections.
 * Appears on Profile, Shop, Scan, MealPlan, Discover, RecipeDetail, and more.
 */

import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

interface SectionLabelProps {
  children: string;
}

export default function SectionLabel({ children }: SectionLabelProps) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
