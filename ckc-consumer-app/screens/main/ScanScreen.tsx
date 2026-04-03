/**
 * ScanScreen — Phase 5 placeholder
 *
 * URL recipe scanner — paid feature launching in Phase 5.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import PremiumGate from '../components/PremiumGate';

export default function ScanScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan</Text>
      </View>

      <View style={styles.body}>
        {/* URL input mockup */}
        <View style={styles.inputMock}>
          <Text style={styles.inputPlaceholder}>Paste a recipe URL…</Text>
        </View>

        {/* Or upload photo divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.photoUploadMock}>
          <Text style={styles.photoUploadText}>Upload a recipe photo</Text>
        </View>

        {/* Gate */}
        <View style={styles.gate}>
          <View style={styles.exampleBox}>
            <Text style={styles.exampleLabel}>Example output</Text>
            <Text style={styles.exampleText}>
              "78% compliant with your Low-FODMAP protocol. 3 ingredients need swapping."
            </Text>
            <View style={styles.exampleIngredients}>
              {[
                { name: 'Garlic', status: '✕', note: 'High fructans → garlic-infused oil' },
                { name: 'Onion', status: '✕', note: 'High FODMAP → leek greens only' },
                { name: 'Chicken breast', status: '✓', note: 'Compliant' },
              ].map((item, i) => (
                <View key={i} style={styles.exampleRow}>
                  <Text style={[styles.exampleStatus, { color: item.status === '✓' ? Colors.green : Colors.red }]}>
                    {item.status}
                  </Text>
                  <View>
                    <Text style={styles.exampleIngName}>{item.name}</Text>
                    <Text style={styles.exampleIngNote}>{item.note}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <PremiumGate
            title="Score Any Recipe"
            body="Paste any recipe URL. CKC scores the ingredients against your protocol and suggests exact swaps."
            buttonLabel="Unlock with Premium"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textPrimary,
  },

  body: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 16,
  },

  inputMock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    opacity: 0.5,
  },
  inputIcon: { fontSize: 16 },
  inputPlaceholder: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  photoUploadMock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'center',
    opacity: 0.5,
  },
  photoUploadIcon: { fontSize: 18 },
  photoUploadText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.textMuted,
  },

  // Gate
  gate: {
    gap: 14,
    marginTop: 4,
  },
  gateTitle: {
    fontFamily: Fonts.display,
    fontSize: 30,
    color: Colors.textPrimary,
  },
  gateBody: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  exampleBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    opacity: 0.75,
  },
  exampleLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  exampleText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  exampleIngredients: {
    gap: 8,
    marginTop: 4,
  },
  exampleRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  exampleStatus: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    width: 14,
    marginTop: 1,
  },
  exampleIngName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  exampleIngNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  upgradeBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: '#000',
  },
});
