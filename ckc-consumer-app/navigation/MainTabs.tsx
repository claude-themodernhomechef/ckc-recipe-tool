/**
 * MainTabs — primary app shell after onboarding.
 *
 * 5 tabs: Discover · Meal Plan · Scan · Shop · Profile
 *
 * Desktop web (≥900px): fixed left sidebar (220px) + content area
 * Mobile / narrow web:  content + bottom tab bar
 *
 * Shop tab shows a recipe-count badge when the shopping list has items.
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
import { useMenu } from '../context/MenuContext';

import DiscoverScreen  from '../screens/main/DiscoverScreen';
import MealPlanScreen  from '../screens/main/MealPlanScreen';
import ScanScreen      from '../screens/main/ScanScreen';
import ShopScreen      from '../screens/main/ShopScreen';
import ProfileScreen   from '../screens/main/ProfileScreen';

export type TabId = 'discover' | 'mealplan' | 'scan' | 'shop' | 'profile';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'discover', label: 'Discover',  icon: '✦' },
  { id: 'mealplan', label: 'Meal Plan', icon: '▦' },
  { id: 'scan',     label: 'Scan',      icon: '⊞' },
  { id: 'shop',     label: 'Shop',      icon: '⊕' },
  { id: 'profile',  label: 'Profile',   icon: '○' },
];

// ── Badge component ───────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <View style={badge.wrap}>
      <Text style={badge.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  wrap: {
    position:        'absolute',
    top:             -5,
    right:           -8,
    minWidth:        16,
    height:          16,
    borderRadius:    8,
    backgroundColor: Colors.gold,
    alignItems:      'center',
    justifyContent:  'center',
    paddingHorizontal: 3,
    zIndex:          10,
  },
  text: {
    fontFamily: Fonts.bodyMedium,
    fontSize:   9,
    color:      '#000',
    lineHeight: 12,
  },
});

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function Sidebar({
  active,
  onSelect,
  shopBadge,
}: {
  active:    TabId;
  onSelect:  (t: TabId) => void;
  shopBadge: number;
}) {
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
            <View style={sidebar.iconWrap}>
              <Text style={[sidebar.icon, active === tab.id && sidebar.iconActive]}>
                {tab.icon}
              </Text>
              {tab.id === 'shop' && <Badge count={shopBadge} />}
            </View>
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
  nav:      { flex: 1, paddingHorizontal: 12, paddingTop: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    marginBottom: 2,
  },
  itemActive:  { backgroundColor: Colors.surfaceElevated },
  iconWrap:    { width: 18, alignItems: 'center', position: 'relative' },
  icon:        { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center' },
  iconActive:  { color: Colors.textPrimary },
  label:       { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  labelActive: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
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

function BottomTabs({
  active,
  onSelect,
  shopBadge,
}: {
  active:    TabId;
  onSelect:  (t: TabId) => void;
  shopBadge: number;
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
            <View style={bottom.iconWrap}>
              <Text style={[bottom.icon, active === tab.id && bottom.iconActive]}>
                {tab.icon}
              </Text>
              {tab.id === 'shop' && <Badge count={shopBadge} />}
            </View>
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
  wrap:      { backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  bar:       { flexDirection: 'row' },
  item:      { flex: 1, alignItems: 'center', paddingVertical: 10, gap: 3 },
  iconWrap:  { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 24, height: 22 },
  icon:      { fontSize: 16, color: Colors.textMuted },
  iconActive:{ color: Colors.textPrimary },
  label:     { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  labelActive:{ fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
});

// ── Main export ───────────────────────────────────────────────────────────────

export default function MainTabs() {
  const [active, setActive] = useState<TabId>('discover');
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  // Badge: total recipe count in the shopping list
  const { menuItems } = useMenu();
  const shopBadge = menuItems.length;

  const content = (() => {
    switch (active) {
      case 'discover': return <DiscoverScreen />;
      case 'mealplan': return <MealPlanScreen />;
      case 'scan':     return <ScanScreen />;
      case 'shop':     return <ShopScreen />;
      case 'profile':  return <ProfileScreen onNavigate={setActive} />;
    }
  })();

  return (
    <View style={[styles.root, { flexDirection: isDesktop ? 'row' : 'column' }]}>
      {isDesktop && <Sidebar active={active} onSelect={setActive} shopBadge={shopBadge} />}
      <View style={styles.content}>{content}</View>
      {!isDesktop && <BottomTabs active={active} onSelect={setActive} shopBadge={shopBadge} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  content: { flex: 1 },
});
