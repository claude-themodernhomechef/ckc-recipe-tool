import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import OnboardingHeader from './components/OnboardingHeader';
import PrimaryButton from './components/PrimaryButton';
import SelectableChip from './components/SelectableChip';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Protein'>;
  route:      RouteProp<RootStackParamList, 'Protein'>;
};

const PROTEINS = [
  { key: 'Chicken' },
  { key: 'Beef' },
  { key: 'Pork' },
  { key: 'Fish' },
  { key: 'Seafood' },
  { key: 'Lamb' },
  { key: 'Turkey' },
  { key: 'Eggs' },
  { key: 'Plant-Based' },
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
      <OnboardingHeader
        onBack={() => navigation.goBack()}
        onSkip={handleContinue}
        step={2}
        total={4}
      />

      <View style={styles.titleArea}>
        <Text style={styles.title}>What proteins{'\n'}do you enjoy?</Text>
        <Text style={styles.subtitle}>
          We'll prioritize these in your recipe feed. Select as many as you like.
        </Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chipGrid}>
          {PROTEINS.map((p) => (
            <SelectableChip
              key={p.key}
              label={p.key}
              selected={selected.includes(p.key)}
              onPress={() => toggle(p.key)}
            />
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={selected.length === 0 ? 'Continue' : `Continue — ${selected.length} selected`}
          onPress={handleContinue}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
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
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
});
