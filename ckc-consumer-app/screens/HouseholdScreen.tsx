import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import ProgressDots from './components/ProgressDots';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Household'>;
  route:      RouteProp<RootStackParamList, 'Household'>;
};

const OPTIONS = [
  { value: 1, label: '1',  sub: 'Just me' },
  { value: 2, label: '2',  sub: 'Two people' },
  { value: 3, label: '3',  sub: 'Small family' },
  { value: 4, label: '4',  sub: 'Family of four' },
  { value: 5, label: '5+', sub: 'Large household' },
];

export default function HouseholdScreen({ navigation, route }: Props) {
  const { protocols } = route.params;
  const [selected, setSelected] = useState<number | null>(null);

  function handleContinue() {
    navigation.navigate('Protein', {
      protocols,
      household: selected ?? 2,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Top nav ── */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <ProgressDots total={4} current={1} />
        <TouchableOpacity onPress={handleContinue} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* ── Title ── */}
      <View style={styles.titleArea}>
        <Text style={styles.title}>Who are you{'\n'}cooking for?</Text>
        <Text style={styles.subtitle}>
          We'll adjust serving sizes and shopping list quantities.
        </Text>
      </View>

      {/* ── Options ── */}
      <View style={styles.optionsArea}>
        {OPTIONS.map((opt) => {
          const isSelected = selected === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => setSelected(opt.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.optionNumber, isSelected && styles.optionNumberSelected]}>
                {opt.label}
              </Text>
              <Text style={[styles.optionSub, isSelected && styles.optionSubSelected]}>
                {opt.sub}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Continue ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.continueBtn, selected === null && styles.continueBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
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
    paddingBottom: 40,
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

  // ── Number buttons — one row
  optionsArea: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  option: {
    flex: 1,
    aspectRatio: 0.8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  optionSelected: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,168,67,0.10)',
  },
  optionNumber: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textSecondary,
  },
  optionNumberSelected: {
    color: Colors.gold,
  },
  optionSub: {
    fontFamily: Fonts.body,
    fontSize: 9,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  optionSubSelected: {
    color: Colors.gold,
    opacity: 0.8,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 40,
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
