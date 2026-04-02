/**
 * AdminScreen
 *
 * Password gate → tab bar with two admin views:
 *   Swipe  — approve / reject pending recipes
 *   Maybe  — review deferred recipes
 *
 * Password is set via EXPO_PUBLIC_ADMIN_PASSWORD env var (defaults to "ckc-admin").
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import AdminSwipeScreen from './AdminSwipeScreen';
import AdminMaybeScreen from './AdminMaybeScreen';

const ADMIN_PASSWORD =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_ADMIN_PASSWORD) || 'ckc-admin';

type Tab = 'swipe' | 'maybe';

// ── Password gate ─────────────────────────────────────────────────────────────

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function submit() {
    if (value === ADMIN_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setValue('');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.gateWrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.gateTitle}>Admin</Text>
      <Text style={styles.gateSub}>CKC Recipe Management</Text>

      <TextInput
        style={[styles.gateInput, error && styles.gateInputError]}
        placeholder="Password"
        placeholderTextColor={Colors.textMuted}
        secureTextEntry
        value={value}
        onChangeText={(t) => { setValue(t); setError(false); }}
        onSubmitEditing={submit}
        returnKeyType="go"
        autoFocus
      />

      {error ? <Text style={styles.gateError}>Incorrect password</Text> : null}

      <TouchableOpacity style={styles.gateBtn} onPress={submit}>
        <Text style={styles.gateBtnText}>Enter</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

// ── Main admin screen ─────────────────────────────────────────────────────────

export default function AdminScreen() {
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab]           = useState<Tab>('swipe');

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <PasswordGate onUnlock={() => setUnlocked(true)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin</Text>
        <TouchableOpacity onPress={() => setUnlocked(false)}>
          <Text style={styles.lockBtn}>Lock</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'swipe' && styles.tabBtnActive]}
          onPress={() => setTab('swipe')}
        >
          <Text style={[styles.tabLabel, tab === 'swipe' && styles.tabLabelActive]}>
            Swipe Queue
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'maybe' && styles.tabBtnActive]}
          onPress={() => setTab('maybe')}
        >
          <Text style={[styles.tabLabel, tab === 'maybe' && styles.tabLabelActive]}>
            Maybe
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 'swipe' ? <AdminSwipeScreen /> : <AdminMaybeScreen />}
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  // Password gate
  gateWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 40, backgroundColor: Colors.bg,
  },
  gateTitle: { fontFamily: Fonts.display, fontSize: 42, color: Colors.textPrimary, marginBottom: 4 },
  gateSub:   { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, marginBottom: 40 },
  gateInput: {
    width: '100%', maxWidth: 320,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: Fonts.body, fontSize: 16, color: Colors.textPrimary,
    marginBottom: 8,
  },
  gateInputError: { borderColor: Colors.red },
  gateError: { fontFamily: Fonts.body, fontSize: 13, color: Colors.red, marginBottom: 12 },
  gateBtn: {
    width: '100%', maxWidth: 320,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.borderActive,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  gateBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 16, color: Colors.textPrimary },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary },
  lockBtn:     { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  // Tabs
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: Colors.border,
    paddingHorizontal: 20,
  },
  tabBtn: {
    paddingVertical: 12, paddingHorizontal: 16, marginRight: 4,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:   { borderBottomColor: Colors.textPrimary },
  tabLabel:       { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textMuted },
  tabLabelActive: { color: Colors.textPrimary },
});
