/**
 * OnboardingHeader
 *
 * Top nav bar used on every onboarding step screen.
 * Back arrow (left) · Progress dots (center) · Skip link (right)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';
import ProgressDots from './ProgressDots';

interface OnboardingHeaderProps {
  onBack: () => void;
  onSkip: () => void;
  step: number;   // 1-indexed current step
  total: number;  // total number of steps
}

export default function OnboardingHeader({ onBack, onSkip, step, total }: OnboardingHeaderProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <ProgressDots total={total} current={step} />
      <TouchableOpacity onPress={onSkip} style={styles.skipBtn} hitSlop={8}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 8 },
  backArrow: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
  skipBtn: { padding: 8 },
  skipText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
