/**
 * EmptyState
 *
 * Centered placeholder shown when a screen has no content yet.
 * Used on Discover, Shop, Shopping Planner, Guest Discover, and more.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

interface EmptyStateProps {
  title: string;
  body: string;
}

export default function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 32,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
