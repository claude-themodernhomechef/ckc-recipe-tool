/**
 * PremiumGate
 *
 * Consistent upgrade CTA used wherever a premium paywall appears.
 * Replaces one-off upgradeCard / gate / consolidatedCTA styles across screens.
 *
 * Usage:
 *   <PremiumGate
 *     title="Build Your Week"
 *     body="Assign recipes to each day..."
 *     features={['7-day calendar', 'Shopping list']}   // optional
 *     buttonLabel="Upgrade to Premium"                 // optional
 *     onPress={() => {}}
 *   />
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

interface PremiumGateProps {
  title: string;
  body: string;
  features?: string[];
  buttonLabel?: string;
  onPress?: () => void;
}

export default function PremiumGate({
  title,
  body,
  features,
  buttonLabel = 'Upgrade to Premium',
  onPress,
}: PremiumGateProps) {
  return (
    <View style={styles.container}>
      {/* Gold accent bar */}
      <View style={styles.accentBar} />

      <View style={styles.inner}>
        <View style={styles.labelRow}>
          <View style={styles.premiumPill}>
            <Text style={styles.premiumPillText}>PREMIUM</Text>
          </View>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>

        {features && features.length > 0 && (
          <View style={styles.featureList}>
            {features.map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <Text style={styles.featureCheck}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          activeOpacity={0.85}
          onPress={onPress}
        >
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    backgroundColor: Colors.gold,
  },
  inner: {
    padding: 20,
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
  },
  premiumPill: {
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(212,168,67,0.10)',
  },
  premiumPillText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 9,
    color: Colors.gold,
    letterSpacing: 1.2,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  featureList: {
    gap: 10,
    backgroundColor: Colors.bg,
    borderRadius: 10,
    padding: 14,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  featureCheck: {
    color: Colors.green,
    fontSize: 13,
    marginTop: 1,
  },
  featureText: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 2,
  },
  buttonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: '#000',
  },
});
