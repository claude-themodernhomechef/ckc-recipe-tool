/**
 * SelectableChip
 *
 * Toggleable bordered pill chip. Used for protein, cuisine, and filter
 * selection throughout onboarding and the Discover screen.
 *
 * Unselected: surface bg, muted border, secondary text
 * Selected: active border, subtle fill, primary text
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

interface SelectableChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function SelectableChip({ label, selected, onPress }: SelectableChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipSelected: {
    borderColor: Colors.textPrimary,
    backgroundColor: 'rgba(245,243,238,0.07)',
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  labelSelected: {
    color: Colors.textPrimary,
  },
});
