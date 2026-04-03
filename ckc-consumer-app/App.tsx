/**
 * App.tsx
 *
 * Root navigator with conditional auth/app stack routing.
 *
 * ── How routing works ──
 *
 * AppNavigator (inside UserProvider + NavigationContainer) reads auth state
 * from UserContext and renders one of two stacks:
 *
 *   AuthStack  — when user is not logged in, or logged in but onboarding incomplete
 *     Splash → Welcome → SignUp / Login → DietProtocol → … → SetupComplete
 *
 *   AppStack   — when user is fully authenticated (logged in + onboarding done)
 *     MainTabs (Discover / MealPlan / Scan / Shop / Profile)
 *     RecipeDetail (pushed over any tab)
 *
 * When SetupCompleteScreen calls completeOnboarding(), UserContext sets
 * onboardingComplete = true → AppNavigator re-renders → AppStack mounts →
 * user lands on MainTabs. No explicit navigation.navigate() needed.
 *
 * Same logic applies on app restart: if Firebase Auth has a persisted session
 * and Firestore has an onboardingComplete profile, the user goes straight to
 * MainTabs without seeing any auth or onboarding screens.
 */

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from 'expo-font';
import {
  CormorantGaramond_500Medium,
  CormorantGaramond_500Medium_Italic,
} from '@expo-google-fonts/cormorant-garamond';
import {
  DMSans_400Regular,
  DMSans_500Medium,
} from '@expo-google-fonts/dm-sans';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { Colors } from './constants/theme';
import { UserProvider, useUser } from './context/UserContext';
import { MenuProvider } from './context/MenuContext';

// ── Onboarding / auth screens ─────────────────────────────────────────────────
import SplashScreen        from './screens/SplashScreen';
import WelcomeScreen       from './screens/WelcomeScreen';
import SignUpScreen        from './screens/SignUpScreen';
import LoginScreen         from './screens/LoginScreen';
import DietProtocolScreen  from './screens/DietProtocolScreen';
import HouseholdScreen     from './screens/HouseholdScreen';
import ProteinScreen       from './screens/ProteinScreen';
import CuisineScreen       from './screens/CuisineScreen';
import SetupCompleteScreen from './screens/SetupCompleteScreen';
import GuestDiscoverScreen from './screens/GuestDiscoverScreen';

// ── Main app ──────────────────────────────────────────────────────────────────
import MainTabs           from './navigation/MainTabs';
import RecipeDetailScreen from './screens/RecipeDetailScreen';

// ─────────────────────────────────────────────
//  Route type map
// ─────────────────────────────────────────────

export type RootStackParamList = {
  // Auth / onboarding
  Splash:        undefined;
  Welcome:       undefined;
  SignUp:        undefined;
  Login:         undefined;
  DietProtocol:  undefined;
  Household:     { protocols: string[] };
  Protein:       { protocols: string[]; household: number };
  Cuisine:       { protocols: string[]; household: number; proteins: string[] };
  SetupComplete: { protocols: string[]; household: number; proteins: string[]; cuisines: string[] };
  GuestDiscover: undefined;
  // Main app
  MainTabs:        undefined;
  RecipeDetail:    { recipeId: string };
  // Legacy — kept so ShoppingPlannerScreen doesn't break until it's refactored
  ShoppingPlanner: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// ─────────────────────────────────────────────
//  AppNavigator
//
//  Must be a child of both UserProvider and NavigationContainer
//  so it can call useUser() and use React Navigation hooks.
// ─────────────────────────────────────────────

function AppNavigator() {
  const { authUser, authLoading, onboardingComplete } = useUser();

  // Hold on the blank screen while Firebase resolves the persisted session
  if (authLoading) return null;

  const isAuthenticated = !!authUser && onboardingComplete;

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.bg },
      }}
    >
      {isAuthenticated ? (
        // ── Main app stack ────────────────────────────────────────────────────
        <>
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ animation: 'fade' }}
          />
          <Stack.Screen
            name="RecipeDetail"
            component={RecipeDetailScreen}
            options={{ animation: 'slide_from_bottom' }}
          />
        </>
      ) : (
        // ── Auth + onboarding stack ────────────────────────────────────────────
        <>
          <Stack.Screen name="Splash"        component={SplashScreen} />
          <Stack.Screen name="Welcome"       component={WelcomeScreen} />
          <Stack.Screen name="SignUp"        component={SignUpScreen} />
          <Stack.Screen name="Login"         component={LoginScreen} />
          <Stack.Screen name="DietProtocol"  component={DietProtocolScreen} />
          <Stack.Screen name="Household"     component={HouseholdScreen} />
          <Stack.Screen name="Protein"       component={ProteinScreen} />
          <Stack.Screen name="Cuisine"       component={CuisineScreen} />
          <Stack.Screen name="SetupComplete" component={SetupCompleteScreen} />
          <Stack.Screen name="GuestDiscover" component={GuestDiscoverScreen} options={{ animation: 'slide_from_bottom' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
//  Root
// ─────────────────────────────────────────────

export default function App() {
  const [fontsLoaded] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
    ...Ionicons.font,
  });

  // Hold blank screen while fonts load (auth loading is handled inside AppNavigator)
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  }

  return (
    <UserProvider>
      <MenuProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </MenuProvider>
    </UserProvider>
  );
}
