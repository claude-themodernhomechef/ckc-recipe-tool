/**
 * LoginScreen
 *
 * Email/password sign-in for returning users.
 * Loads the user's Firestore profile on success; UserContext handles routing.
 *
 * Flow: Welcome → Login → (auth state updates) → MainTabs (via AppNavigator)
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
import { signInWithEmail, sendPasswordReset, signInWithGoogle } from '../lib/auth';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
};

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a minute and try again.';
    case 'auth/invalid-email':
      return 'That doesn\'t look like a valid email address.';
    case 'auth/network-request-failed':
      return 'No internet connection. Please check your network.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSignIn() {
    setError('');
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(trimmedEmail, password);
      // UserContext onAuthStateChanged fires → loads Firestore profile
      // AppNavigator detects authUser + onboardingComplete → navigates to MainTabs
    } catch (err: any) {
      setError(mapAuthError(err?.code ?? ''));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Enter your email address above, then tap Forgot Password.');
      return;
    }
    try {
      await sendPasswordReset(trimmedEmail);
      setError('');
      setResetSent(true);
    } catch {
      setError('Could not send a reset email. Check the address and try again.');
    }
  }

  async function handleGoogleSignIn() {
    setError('');
    setLoading(true);
    try {
      await signInWithGoogle();
      // UserContext onAuthStateChanged fires → loads profile → AppNavigator routes to app
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // User dismissed — no error needed
      } else if (err?.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is not enabled yet. Enable it in the Firebase console under Authentication → Sign-in method.');
      } else if (err?.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Allow popups for this site and try again.');
      } else {
        setError('Google sign-in failed. Please try again or use email.');
      }
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>Welcome{'\n'}back.</Text>
            <Text style={styles.subtitle}>
              Your recipes and preferences are waiting for you.
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
              <View style={styles.passwordLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <TouchableOpacity onPress={handleForgotPassword} activeOpacity={0.7}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); }}
                  placeholder="Your password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPass}
                  autoComplete="current-password"
                  returnKeyType="done"
                  onSubmitEditing={handleSignIn}
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

            {/* Password reset confirmation */}
            {resetSent && (
              <Text style={styles.successText}>
                Reset link sent! Check your inbox for {email.trim().toLowerCase()}.
              </Text>
            )}

            {/* Sign In */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleSignIn}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? 'Signing in…' : 'Sign In'}
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
              onPress={handleGoogleSignIn}
              activeOpacity={0.8}
              disabled={loading}
            >
              <Text style={styles.socialBtnText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>

          {/* ── Footer ── */}
          <TouchableOpacity
            style={styles.footer}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.7}
          >
            <Text style={styles.footerText}>
              Don't have an account?{' '}
              <Text style={styles.footerLink}>Get started →</Text>
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
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  forgotText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
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
  successText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: '#4CAF50',
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
