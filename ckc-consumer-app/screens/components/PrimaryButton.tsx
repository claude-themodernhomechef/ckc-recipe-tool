/**
 * PrimaryButton
 *
 * Full-width rounded action button used throughout onboarding and setup flows.
 * Dark background (Colors.textPrimary) with light label.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function PrimaryButton({ label, onPress, disabled = false }: PrimaryButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.bg,
  },
});
