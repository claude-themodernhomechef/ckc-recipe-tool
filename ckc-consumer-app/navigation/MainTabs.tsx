/**
 * MainTabs — primary app shell after onboarding.
 *
 * 5 tabs: Discover · Catalog · Scan · Shop · Profile
 *
 * Desktop web (≥900px): fixed left sidebar (220px) + content area
 * Mobile / narrow web:  content + bottom tab bar
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Colors, Fonts } from '../constants/theme';

import DiscoverScreen        from '../screens/main/DiscoverScreen';
import CatalogScreen         from '../screens/main/CatalogScreen';
import ScanScreen            from '../screens/main/ScanScreen';
import ShoppingPlannerScreen from '../screens/ShoppingPlannerScreen';
import ProfileScreen         from '../screens/main/ProfileScreen';

export type TabId = 'Discover' | 'Catalog' | 'Scan' | 'Shop' | 'Profile';

const Tab = createBottomTabNavigator();

const TABS: { name: TabId; label: string; icon: string; iconActive: string }[] = [
  { name: 'Discover', label: 'Discover', icon: '◎', iconActive: '●' },
  { name: 'Catalog',  label: 'Catalog',  icon: '≡', iconActive: '≡' },
  { name: 'Scan',     label: 'Scan',     icon: '⊞', iconActive: '⊞' },
  { name: 'Shop',     label: 'Shop',     icon: '⊕', iconActive: '⊕' },
  { name: 'Profile',  label: 'Profile',  icon: '○', iconActive: '●' },
];

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function DesktopSidebar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={sidebar.wrap}>
      {/* Wordmark */}
      <View style={sidebar.brand}>
        <Text style={sidebar.wordmark}>CKC</Text>
        <Text style={sidebar.tagline}>Chef-Curated Recipes</Text>
      </View>

      {/* Nav items */}
      <View style={sidebar.nav}>
        {TABS.map((tab, index) => {
          const route = state.routes[index];
          if (!route) return null;
          const isFocused = state.index === index;

          function onPress() {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(tab.name);
            }
          }

          return (
            <TouchableOpacity
              key={tab.name}
              style={[sidebar.item, isFocused && sidebar.itemActive]}
              onPress={onPress}
              activeOpacity={0.7}
            >
              <Text style={[sidebar.icon, isFocused && sidebar.iconActive]}>
                {isFocused ? tab.iconActive : tab.icon}
              </Text>
              <Text style={[sidebar.label, isFocused && sidebar.labelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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

// ── Main navigator ────────────────────────────────────────────────────────────

export default function MainTabs() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 900;

  return (
    <Tab.Navigator
      tabBar={isDesktop ? (props) => <DesktopSidebar {...props} /> : undefined}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bg,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.textPrimary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontFamily: Fonts.bodyMedium,
          fontSize: 10,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tab.Screen name="Discover" component={DiscoverScreen}        options={{ title: 'Discover' }} />
      <Tab.Screen name="Catalog"  component={CatalogScreen}         options={{ title: 'Catalog' }} />
      <Tab.Screen name="Scan"     component={ScanScreen}            options={{ title: 'Scan' }} />
      <Tab.Screen name="Shop"     component={ShoppingPlannerScreen} options={{ title: 'Shop' }} />
      <Tab.Screen name="Profile"  component={ProfileScreen}         options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
