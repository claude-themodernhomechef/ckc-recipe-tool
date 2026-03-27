import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import ProgressDots from './components/ProgressDots';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Protein'>;
  route:      RouteProp<RootStackParamList, 'Protein'>;
};

const PROTEINS = [
  { key: 'Chicken',     emoji: '🍗' },
  { key: 'Beef',        emoji: '🥩' },
  { key: 'Pork',        emoji: '🥓' },
  { key: 'Fish',        emoji: '🐟' },
  { key: 'Seafood',     emoji: '🦐' },
  { key: 'Lamb',        emoji: '🫙' },
  { key: 'Turkey',      emoji: '🦃' },
  { key: 'Eggs',        emoji: '🥚' },
  { key: 'Plant-Based', emoji: '🌱' },
];

export default function ProteinScreen({ navigation, route }: Props) {
  const { protocols, household } = route.params;
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleContinue() {
    navigation.navigate('Cuisine', { protocols, household, proteins: selected });
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Top nav ── */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <ProgressDots total={4} current={2} />
        <TouchableOpacity onPress={handleContinue} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* ── Title ── */}
      <View style={styles.titleArea}>
        <Text style={styles.title}>What proteins{'\n'}do you enjoy?</Text>
        <Text style={styles.subtitle}>
          We'll prioritize these in your recipe feed. Select as many as you like.
        </Text>
      </View>

      {/* ── Protein chips ── */}
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chipGrid}>
          {PROTEINS.map((p) => {
            const isSelected = selected.includes(p.key);
            return (
              <TouchableOpacity
                key={p.key}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggle(p.key)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipEmoji}>{p.emoji}</Text>
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {p.key}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* ── Continue ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, selected.length === 0 && styles.continueBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>
            {selected.length === 0 ? 'Continue' : `Continue — ${selected.length} selected`}
          </Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 8 },
  backArrow: { fontSize: 22, color: Colors.textSecondary },
  skipBtn: { padding: 8 },
  skipText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  titleArea: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 8,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 34,
    color: Colors.textPrimary,
    lineHeight: 40,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  scroll: { flex: 1 },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  chipEmoji: { fontSize: 16 },
  chipText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.textPrimary,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
  continueBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnDisabled: { opacity: 0.4 },
  continueBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.bg,
  },
});
