/**
 * AdminScreen
 *
 * Password gate → admin shell with sidebar nav (desktop) / bottom tabs (mobile).
 *
 * Tabs: Swipe · Catalog · Needs Review · Shopping List
 *
 * Password: EXPO_PUBLIC_ADMIN_PASSWORD env var (defaults to "ckc-admin").
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
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import AdminSwipeScreen      from './AdminSwipeScreen';
import DecisionsCatalogScreen from './DecisionsCatalogScreen';
import ReviewQueueScreen     from './ReviewQueueScreen';

const ADMIN_PASSWORD =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_ADMIN_PASSWORD) || 'ckc-admin';

type TabId = 'swipe' | 'catalog' | 'queue';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'swipe',   label: 'Swipe',        icon: '⇄' },
  { id: 'catalog', label: 'Catalog',      icon: '▤' },
  { id: 'queue',   label: 'Review Queue', icon: '✓' },
];

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
      style={gate.wrap}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={gate.title}>Admin</Text>
      <Text style={gate.sub}>CKC Recipe Management</Text>

      <TextInput
        style={[gate.input, error && gate.inputError]}
        placeholder="Password"
        placeholderTextColor={Colors.textMuted}
        secureTextEntry
        value={value}
        onChangeText={(t) => { setValue(t); setError(false); }}
        onSubmitEditing={submit}
        returnKeyType="go"
        autoFocus
      />

      {error ? <Text style={gate.error}>Incorrect password</Text> : null}

      <TouchableOpacity style={gate.btn} onPress={submit}>
        <Text style={gate.btnText}>Enter</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const gate = StyleSheet.create({
  wrap:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, backgroundColor: Colors.bg },
  title:      { fontFamily: Fonts.display, fontSize: 42, color: Colors.textPrimary, marginBottom: 4 },
  sub:        { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, marginBottom: 40 },
  input: {
    width: '100%', maxWidth: 320,
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    fontFamily: Fonts.body, fontSize: 16, color: Colors.textPrimary,
    marginBottom: 8,
  },
  inputError: { borderColor: Colors.red },
  error:      { fontFamily: Fonts.body, fontSize: 13, color: Colors.red, marginBottom: 12 },
  btn: {
    width: '100%', maxWidth: 320,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.borderActive,
    borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  btnText:    { fontFamily: Fonts.bodyMedium, fontSize: 16, color: Colors.textPrimary },
});

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function Sidebar({
  active,
  onSelect,
  onLock,
}: {
  active:   TabId;
  onSelect: (t: TabId) => void;
  onLock:   () => void;
}) {
  return (
    <View style={sidebar.wrap}>
      {/* Wordmark */}
      <View style={sidebar.brand}>
        <Text style={sidebar.wordmark}>CKC</Text>
        <Text style={sidebar.tagline}>Admin</Text>
      </View>

      {/* Nav */}
      <View style={sidebar.nav}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[sidebar.item, active === tab.id && sidebar.itemActive]}
            onPress={() => onSelect(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[sidebar.icon, active === tab.id && sidebar.iconActive]}>
              {tab.icon}
            </Text>
            <Text style={[sidebar.label, active === tab.id && sidebar.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Lock */}
      <View style={sidebar.footer}>
        <TouchableOpacity onPress={onLock}>
          <Text style={sidebar.lockText}>Lock</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sidebar = StyleSheet.create({
  wrap: {
    width: 220,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    backgroundColor: Colors.bg,
    flexDirection: 'column',
  },
  brand: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: 8,
  },
  wordmark: { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary, letterSpacing: 4 },
  tagline:  { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, letterSpacing: 1, marginTop: 2 },
  nav:      { flex: 1, paddingHorizontal: 12, paddingTop: 4 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 8, marginBottom: 2,
  },
  itemActive:  { backgroundColor: Colors.surfaceElevated },
  icon:        { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, width: 18, textAlign: 'center' },
  iconActive:  { color: Colors.textPrimary },
  label:       { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  labelActive: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  footer: {
    paddingHorizontal: 20, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 16,
  },
  lockText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
});

// ── Mobile bottom tab bar ─────────────────────────────────────────────────────

function BottomTabs({
  active,
  onSelect,
}: {
  active:   TabId;
  onSelect: (t: TabId) => void;
}) {
  return (
    <SafeAreaView edges={['bottom']} style={bottom.wrap}>
      <View style={bottom.bar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={bottom.item}
            onPress={() => onSelect(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[bottom.icon, active === tab.id && bottom.iconActive]}>
              {tab.icon}
            </Text>
            <Text style={[bottom.label, active === tab.id && bottom.labelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const bottom = StyleSheet.create({
  wrap:       { backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  bar:        { flexDirection: 'row' },
  item:       { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  icon:       { fontSize: 16, color: Colors.textMuted },
  iconActive: { color: Colors.textPrimary },
  label:      { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  labelActive:{ fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
});

// ── Main export ───────────────────────────────────────────────────────────────

const AUTH_KEY = 'ckc_admin_unlocked';

function readPersistedAuth(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(AUTH_KEY) === '1'; }
  catch { return false; }
}

export default function AdminScreen() {
  const [unlocked, setUnlocked] = useState(readPersistedAuth);
  const [tab, setTab]           = useState<TabId>('swipe');

  function unlock() {
    try { localStorage.setItem(AUTH_KEY, '1'); } catch {}
    setUnlocked(true);
  }

  function lock() {
    try { localStorage.removeItem(AUTH_KEY); } catch {}
    setUnlocked(false);
  }
  const { width }               = useWindowDimensions();
  const isDesktop               = Platform.OS === 'web' && width >= 900;

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <PasswordGate onUnlock={unlock} />
      </SafeAreaView>
    );
  }

  const content = (() => {
    switch (tab) {
      case 'swipe':   return <AdminSwipeScreen />;
      case 'catalog': return <DecisionsCatalogScreen />;
      case 'queue':   return <ReviewQueueScreen />;
    }
  })();

  return (
    <View style={[styles.shell, { flexDirection: isDesktop ? 'row' : 'column' }]}>
      {isDesktop && (
        <Sidebar active={tab} onSelect={setTab} onLock={lock} />
      )}
      <View style={styles.content}>{content}</View>
      {!isDesktop && (
        <BottomTabs active={tab} onSelect={setTab} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  shell:   { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1 },
});
