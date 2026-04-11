import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet,
  KeyboardAvoidingView, Platform, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import { useUser } from '../context/UserContext';
import OnboardingHeader from './components/OnboardingHeader';
import PrimaryButton from './components/PrimaryButton';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Name'>;
};

export default function NameScreen({ navigation }: Props) {
  const { setName } = useUser();
  const [value, setValue] = useState('');

  function handleContinue() {
    setName(value.trim());
    navigation.navigate('DietProtocol');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <OnboardingHeader
        onBack={() => navigation.goBack()}
        onSkip={() => {
          setName('');
          navigation.navigate('DietProtocol');
        }}
        step={0}
        total={5}
      />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.title}>What's your{'\n'}first name?</Text>
          <Text style={styles.subtitle}>
            We'll use this to personalize your experience.
          </Text>

          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder="Your first name"
            placeholderTextColor={Colors.textMuted}
            autoFocus
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
            maxLength={40}
          />
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            label={value.trim() ? `Continue as ${value.trim()}` : 'Continue'}
            onPress={handleContinue}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  flex: { flex: 1 },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    gap: 12,
  },

  title: {
    fontFamily: Fonts.display,
    fontSize: 36,
    color: Colors.textPrimary,
    lineHeight: 42,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  input: {
    marginTop: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontFamily: Fonts.body,
    fontSize: 18,
    color: Colors.textPrimary,
  },

  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    paddingTop: 8,
  },
});
