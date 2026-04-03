/**
 * SignUpScreen
 *
 * Collects email + password. Does NOT create the Firebase account yet —
 * credentials are stored in UserContext.pendingCredentials and the account
 * is created at the end of onboarding in SetupCompleteScreen.
 *
 * This way partial sign-ups don't create ghost accounts in Firebase Auth.
 *
 * Flow: Welcome → SignUp → DietProtocol → … → SetupComplete (account created here)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import { useUser } from '../context/UserContext';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SignUp'>;
};

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function SignUpScreen({ navigation }: Props) {
  const { setPendingCredentials } = useUser();

  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

  function handleContinue() {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!validateEmail(trimmedEmail)) {
      setError('That doesn\'t look like a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    // Store credentials — account created after onboarding completes
    setPendingCredentials({ email: trimmedEmail, password });
    navigation.navigate('DietProtocol');
  }

  function handleSocialAuth(provider: 'google' | 'apple') {
    Alert.alert(
      'Coming Soon',
      `${provider === 'google' ? 'Google' : 'Apple'} sign-in is coming in the next build. Use email for now.`,
      [{ text: 'OK' }],
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Back ── */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          {/* ── Headline ── */}
          <View style={styles.headlineArea}>
            <Text style={styles.title}>Create your{'\n'}account.</Text>
            <Text style={styles.subtitle}>
              Chef-curated recipes, built around how you actually eat.
            </Text>
          </View>

          {/* ── Form ── */}
          <View style={styles.form}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={t => { setEmail(t); setError(''); }}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); }}
                  placeholder="8+ characters"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  returnKeyType="done"
                  onSubmitEditing={handleContinue}
                />
                <TouchableOpacity
                  style={styles.showPassBtn}
                  onPress={() => setShowPass(v => !v)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showPassText}>{showPass ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {!!error && (
              <Text style={styles.errorText}>{error}</Text>
            )}

            {/* Continue */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleContinue}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'One moment…' : 'Continue →'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Divider ── */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ── Social auth ── */}
          <View style={styles.socialBtns}>
            <TouchableOpacity
              style={styles.socialBtn}
              onPress={() => handleSocialAuth('google')}
              activeOpacity={0.8}
            >
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => handleSocialAuth('apple')}
                activeOpacity={0.8}
              >
                <Text style={styles.socialBtnText}>Continue with Apple</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Footer ── */}
          <TouchableOpacity
            style={styles.footer}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.footerText}>
              Already have an account?{' '}
              <Text style={styles.footerLink}>Sign in →</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    flexGrow: 1,
  },

  backBtn: {
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  headlineArea: {
    marginTop: 8,
    marginBottom: 36,
    gap: 10,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 48,
    color: Colors.textPrimary,
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  form: {
    gap: 18,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inputFlex: {
    flex: 1,
  },
  showPassBtn: {
    paddingHorizontal: 4,
    paddingVertical: 14,
  },
  showPassText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },

  errorText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.red,
    lineHeight: 20,
  },

  primaryBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.bg,
  },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 28,
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

  socialBtns: {
    gap: 12,
  },
  socialBtn: {
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
  },
  socialBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },

  footer: {
    marginTop: 32,
    alignItems: 'center',
  },
  footerText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  footerLink: {
    color: Colors.textSecondary,
    fontFamily: Fonts.bodyMedium,
  },
});
