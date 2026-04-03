/**
 * MainTabs — primary app shell after onboarding.
 *
 * 5 tabs: Discover · Catalog · Scan · Shop · Profile
 *
 * Desktop web (≥900px): fixed left sidebar (220px) + content area
 * Mobile / narrow web:  content + bottom tab bar
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../constants/theme';

import DiscoverScreen        from '../screens/main/DiscoverScreen';
import CatalogScreen         from '../screens/main/CatalogScreen';
import ScanScreen            from '../screens/main/ScanScreen';
import ShopScreen            from '../screens/main/ShopScreen';
import ProfileScreen         from '../screens/main/ProfileScreen';

export type TabId = 'discover' | 'catalog' | 'scan' | 'shop' | 'profile';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'discover', label: 'Discover', icon: '✦' },
  { id: 'catalog',  label: 'Catalog',  icon: '≡' },
  { id: 'scan',     label: 'Scan',     icon: '⊞' },
  { id: 'shop',     label: 'Shop',     icon: '⊕' },
  { id: 'profile',  label: 'Profile',  icon: '○' },
];

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function Sidebar({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
  return (
    <View style={sidebar.wrap}>
      {/* Wordmark */}
      <View style={sidebar.brand}>
        <Text style={sidebar.wordmark}>CKC</Text>
        <Text style={sidebar.tagline}>Chef-Curated Recipes</Text>
      </View>

      {/* Nav items */}
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

      {/* Footer */}
      <View style={sidebar.footer}>
        <Text style={sidebar.footerText}>Curated Kitchen Collective</Text>
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
  wordmark: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  tagline: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  nav:       { flex: 1, paddingHorizontal: 12, paddingTop: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    marginBottom: 2,
  },
  itemActive: { backgroundColor: Colors.surfaceElevated },
  icon:       { width: 18, fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  iconActive: { color: Colors.textPrimary },
  label:      { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  labelActive:{ fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
  },
  footerText: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
});

// ── Mobile bottom tab bar ─────────────────────────────────────────────────────

function BottomTabs({ active, onSelect }: { active: TabId; onSelect: (t: TabId) => void }) {
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
  wrap: { backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  bar:  { flexDirection: 'row' },
  item: { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  icon: { fontSize: 16, color: Colors.textMuted },
  iconActive: { color: Colors.textPrimary },
  label: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  labelActive: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
});

// ── Main export ───────────────────────────────────────────────────────────────

export default function MainTabs() {
  const [active, setActive] = useState<TabId>('discover');
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  const content = (() => {
    switch (active) {
      case 'discover': return <DiscoverScreen />;
      case 'catalog':  return <CatalogScreen />;
      case 'scan':     return <ScanScreen />;
      case 'shop':     return <ShopScreen />;
      case 'profile':  return <ProfileScreen />;
    }
  })();

  return (
    <View style={[styles.root, { flexDirection: isDesktop ? 'row' : 'column' }]}>
      {isDesktop && <Sidebar active={active} onSelect={setActive} />}
      <View style={styles.content}>{content}</View>
      {!isDesktop && <BottomTabs active={active} onSelect={setActive} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1 },
});
