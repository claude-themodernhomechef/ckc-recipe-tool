/**
 * MainTabs
 *
 * Root of the main app experience.
 * 5 tabs: Discover · Meal Plan · Scan · Shop · Profile
 *
 * Mobile  — standard bottom tab bar
 * Desktop — left sidebar with logo (web, width ≥ 900)
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Colors, Fonts } from '../constants/theme';

import DiscoverScreen from '../screens/main/DiscoverScreen';
import MealPlanScreen from '../screens/main/MealPlanScreen';
import ScanScreen     from '../screens/main/ScanScreen';
import ShopScreen     from '../screens/main/ShopScreen';
import ProfileScreen  from '../screens/main/ProfileScreen';

const Tab = createBottomTabNavigator();

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: {
  name: string;
  label: string;
  active: IoniconsName;
  inactive: IoniconsName;
}[] = [
  { name: 'Discover', label: 'Discover',  active: 'compass',       inactive: 'compass-outline' },
  { name: 'MealPlan', label: 'Meal Plan', active: 'calendar',      inactive: 'calendar-outline' },
  { name: 'Scan',     label: 'Scan',      active: 'scan-circle',   inactive: 'scan-circle-outline' },
  { name: 'Shop',     label: 'Shop',      active: 'cart',          inactive: 'cart-outline' },
  { name: 'Profile',  label: 'Profile',   active: 'person-circle', inactive: 'person-circle-outline' },
];

// ── Desktop sidebar ───────────────────────────────────────────────────────────

function DesktopSidebar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={sidebar.container}>
      {/* Logo */}
      <View style={sidebar.logoArea}>
        <Text style={sidebar.logoWordmark}>Curated Kitchen</Text>
        <Text style={sidebar.logoSub}>COLLECTIVE</Text>
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
              style={[sidebar.navItem, isFocused && sidebar.navItemActive]}
              onPress={onPress}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isFocused ? tab.active : tab.inactive}
                size={26}
                color={isFocused ? Colors.textPrimary : Colors.textMuted}
              />
              <Text style={[sidebar.navLabel, isFocused && sidebar.navLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const sidebar = StyleSheet.create({
  container: {
    width: 220,
    height: '100%' as any,
    backgroundColor: Colors.surface,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
    paddingTop: 40,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 36,
  },
  logoArea: {
    paddingHorizontal: 8,
    gap: 3,
  },
  logoWordmark: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: 0.2,
  },
  logoSub: {
    fontFamily: Fonts.body,
    fontSize: 9,
    color: Colors.textMuted,
    letterSpacing: 3,
  },
  nav: {
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  navItemActive: {
    backgroundColor: 'rgba(245,243,238,0.06)',
  },
  navLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },
  navLabelActive: {
    fontFamily: Fonts.bodyMedium,
    color: Colors.textPrimary,
  },
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
        tabBarPosition: isDesktop ? 'left' : 'bottom',
        tabBarStyle: isDesktop ? { display: 'none' } : {
          backgroundColor: Colors.surface,
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
        tabBarIcon: ({ focused, color }) => null, // icons handled in DesktopSidebar / unused on mobile (Ionicons in tabBarIcon below)
      }}
    >
      {TABS.map(tab => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={
            tab.name === 'Discover' ? DiscoverScreen :
            tab.name === 'MealPlan' ? MealPlanScreen :
            tab.name === 'Scan'     ? ScanScreen :
            tab.name === 'Shop'     ? ShopScreen :
            ProfileScreen
          }
          options={{
            title: tab.label,
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? tab.active : tab.inactive}
                size={26}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}
