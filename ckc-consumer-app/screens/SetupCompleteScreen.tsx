import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import DietTag from './components/DietTag';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SetupComplete'>;
  route:      RouteProp<RootStackParamList, 'SetupComplete'>;
};


export default function SetupCompleteScreen({ navigation, route }: Props) {
  const { protocols, household, proteins, cuisines } = route.params;
  const [loading, setLoading] = useState(false);

  // Build a friendly summary line
  const householdText = household === 1
    ? 'Just you'
    : household >= 5 ? '5+ people' : `${household} people`;

  return (
    <View style={styles.container}>
      {/* Subtle green glow at top — celebratory */}
      <LinearGradient
        colors={['rgba(124,184,122,0.10)', 'transparent']}
        style={styles.glow}
      />

      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >

          {/* ── Check icon ── */}
          <View style={styles.checkCircle}>
            <Text style={styles.checkIcon}>✓</Text>
          </View>

          {/* ── Headline ── */}
          <Text style={styles.title}>You're all set.</Text>
          <Text style={styles.subtitle}>
            Your personalized recipe feed is ready. Here's what we know about you:
          </Text>

          {/* ── Summary cards ── */}
          <View style={styles.summarySection}>

            {/* Diet protocols */}
            {protocols.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Dietary Protocols</Text>
                <View style={styles.tagRow}>
                  {protocols.map((key) => (
                    <DietTag key={key} protocol={key} variant="circle" />
                  ))}
                </View>
              </View>
            )}

            {/* Household */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Cooking for</Text>
              <Text style={styles.summaryValue}>{householdText}</Text>
            </View>

            {/* Proteins */}
            {proteins.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Preferred Proteins</Text>
                <Text style={styles.summaryValue}>{proteins.join(', ')}</Text>
              </View>
            )}

            {/* Cuisines */}
            {cuisines.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Favorite Cuisines</Text>
                <Text style={styles.summaryValue}>{cuisines.join(', ')}</Text>
              </View>
            )}

          </View>

          {/* ── Chef note ── */}
          <View style={styles.chefNote}>
            <Text style={styles.chefNoteText}>
              "Every recipe in your feed has been tested in a real kitchen. When a swap is needed for your protocol, you'll get exact ratios — not guesses."
            </Text>
            <Text style={styles.chefNoteSig}>— The CKC Team</Text>
          </View>

        </ScrollView>

        {/* ── CTA ── */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            activeOpacity={0.85}
            onPress={async () => {
              try {
                const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                await AsyncStorage.setItem('@ckc/userDiets', JSON.stringify(protocols));
              } catch {}
              navigation.navigate('MainTabs');
            }}
          >
            {loading
              ? <ActivityIndicator color={Colors.bg} />
              : <Text style={styles.primaryBtnText}>Start Exploring Recipes</Text>
            }
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  glow: {
    position: 'absolute',
    top: -60,
    left: '50%',
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
  },
  safe: { flex: 1 },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
    gap: 0,
  },

  // ── Check icon
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(124,184,122,0.15)',
    borderWidth: 1,
    borderColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  checkIcon: {
    fontSize: 28,
    color: Colors.green,
  },

  // ── Headline
  title: {
    fontFamily: Fonts.display,
    fontSize: 44,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },

  // ── Summary
  summarySection: { gap: 10 },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  summaryLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },

  // ── Chef note
  chefNote: {
    marginTop: 24,
    padding: 20,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
    gap: 8,
  },
  chefNoteText: {
    fontFamily: Fonts.displayItalic,
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  chefNoteSig: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // ── Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  primaryBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.bg,
  },
});
