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
  navigation: NativeStackNavigationProp<RootStackParamList, 'Cuisine'>;
  route:      RouteProp<RootStackParamList, 'Cuisine'>;
};

const CUISINES = [
  { key: 'American' },
  { key: 'Italian' },
  { key: 'Mediterranean' },
  { key: 'Mexican' },
  { key: 'Asian' },
  { key: 'Middle Eastern' },
  { key: 'Indian' },
  { key: 'French' },
  { key: 'Latin' },
];

export default function CuisineScreen({ navigation, route }: Props) {
  const { protocols, household, proteins } = route.params;
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(key: string) {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function handleContinue() {
    navigation.navigate('SetupComplete', { protocols, household, proteins, cuisines: selected });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OnboardingHeader
        onBack={() => navigation.goBack()}
        onSkip={handleContinue}
        step={3}
        total={4}
      />

      <View style={styles.titleArea}>
        <Text style={styles.title}>What cuisines{'\n'}do you love?</Text>
        <Text style={styles.subtitle}>Your feed will feature these flavors most.</Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.chipGrid}>
          {CUISINES.map((c) => (
            <SelectableChip
              key={c.key}
              label={c.key}
              selected={selected.includes(c.key)}
              onPress={() => toggle(c.key)}
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
