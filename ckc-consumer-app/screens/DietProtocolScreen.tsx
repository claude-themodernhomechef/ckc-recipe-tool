import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import OnboardingHeader from './components/OnboardingHeader';
import PrimaryButton from './components/PrimaryButton';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DietProtocol'>;
};

// All 8 supported dietary protocols
const PROTOCOLS = [
  {
    key: 'AIP',
    label: 'Autoimmune Protocol',
    short: 'AIP',
    description: 'Eliminate inflammatory foods to calm the immune system',
    color: Colors.diet.AIP,
  },
  {
    key: 'LF',
    label: 'Low-FODMAP',
    short: 'Low-FODMAP',
    description: 'Reduce fermentable carbs that trigger IBS symptoms',
    color: Colors.diet.LF,
  },
  {
    key: 'K',
    label: 'Keto',
    short: 'Keto',
    description: 'High fat, very low carb for metabolic health',
    color: Colors.diet.K,
  },
  {
    key: 'GF',
    label: 'Gluten-Free',
    short: 'Gluten-Free',
    description: 'No wheat, rye, or barley — celiac and sensitivity',
    color: Colors.diet.GF,
  },
  {
    key: 'DF',
    label: 'Dairy-Free',
    short: 'Dairy-Free',
    description: 'No milk, cream, cheese, or butter',
    color: Colors.diet.DF,
  },
  {
    key: 'V',
    label: 'Vegan',
    short: 'Vegan',
    description: 'No animal products of any kind',
    color: Colors.diet.V,
  },
  {
    key: 'Vg',
    label: 'Vegetarian',
    short: 'Vegetarian',
    description: 'No meat or fish, but eggs and dairy are okay',
    color: Colors.diet.Vg,
  },
  {
    key: 'LH',
    label: 'Low-Histamine',
    short: 'Low-Histamine',
    description: 'Avoid aged, fermented, and smoked foods',
    color: Colors.diet.LH,
  },
];

export default function DietProtocolScreen({ navigation }: Props) {
  const [selected, setSelected] = useState<string[]>([]);

  const NO_RESTRICTIONS_KEY = 'NONE';

  function toggleProtocol(key: string) {
    if (key === NO_RESTRICTIONS_KEY) {
      // Selecting "no restrictions" clears everything else
      setSelected((prev) =>
        prev.includes(NO_RESTRICTIONS_KEY) ? [] : [NO_RESTRICTIONS_KEY]
      );
    } else {
      // Selecting any protocol clears "no restrictions"
      setSelected((prev) => {
        const without = prev.filter((k) => k !== NO_RESTRICTIONS_KEY);
        return without.includes(key)
          ? without.filter((k) => k !== key)
          : [...without, key];
      });
    }
  }

  function handleContinue() {
    navigation.navigate('Household', { protocols: selected });
  }

  return (
    <SafeAreaView style={styles.safe}>

      <OnboardingHeader
        onBack={() => navigation.goBack()}
        onSkip={handleContinue}
        step={0}
        total={4}
      />

      {/* ── Title ── */}
      <View style={styles.titleArea}>
        <Text style={styles.title}>What's your dietary{'\n'}protocol?</Text>
        <Text style={styles.subtitle}>Check all that apply. You can change this anytime.</Text>
      </View>

      {/* ── Protocol cards ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {/* No restrictions option — full width */}
        <TouchableOpacity
          style={[
            styles.card,
            styles.cardFull,
            selected.includes(NO_RESTRICTIONS_KEY) && {
              borderColor: Colors.gold,
              backgroundColor: `${Colors.gold}12`,
            },
          ]}
          onPress={() => toggleProtocol(NO_RESTRICTIONS_KEY)}
          activeOpacity={0.75}
        >
          <Text style={[styles.cardTag, { color: Colors.gold }]}>No Restrictions</Text>
          <Text style={styles.cardName}>Show me everything</Text>
          <Text style={styles.cardDesc}>
            No dietary protocol — browse the full curated recipe collection
          </Text>
          {selected.includes(NO_RESTRICTIONS_KEY) && (
            <View style={[styles.checkmark, { backgroundColor: Colors.gold }]}>
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </TouchableOpacity>

        {PROTOCOLS.map((p) => {
          const isSelected = selected.includes(p.key);
          return (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.card,
                isSelected && {
                  borderColor: p.color,
                  backgroundColor: `${p.color}12`,
                },
              ]}
              onPress={() => toggleProtocol(p.key)}
              activeOpacity={0.75}
            >
              {/* Colored tag label */}
              <Text style={[styles.cardTag, { color: p.color }]}>{p.short}</Text>
              <Text style={styles.cardName}>{p.label}</Text>
              <Text style={styles.cardDesc}>{p.description}</Text>

              {/* Checkmark when selected */}
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: p.color }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={
            selected.length === 0
              ? 'Continue'
              : selected.includes(NO_RESTRICTIONS_KEY)
              ? 'Continue — show me everything'
              : `Continue with ${selected.length} selected`
          }
          onPress={handleContinue}
        />
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // ── Title
  titleArea: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 20,
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
  },

  // ── Grid
  scroll: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 16,
  },
  cardFull: {
    width: '100%',
  },
  card: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    position: 'relative',
  },
  cardTag: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '600',
  },
  cardName: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cardDesc: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
    marginTop: 4,
  },
  checkmark: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: Colors.bg,
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Footer
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
});
