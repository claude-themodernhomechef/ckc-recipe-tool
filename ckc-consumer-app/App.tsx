import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
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

import SplashScreen          from './screens/SplashScreen';
import WelcomeScreen         from './screens/WelcomeScreen';
import SignUpScreen          from './screens/SignUpScreen';
import LoginScreen           from './screens/LoginScreen';
import DietProtocolScreen    from './screens/DietProtocolScreen';
import HouseholdScreen       from './screens/HouseholdScreen';
import ProteinScreen         from './screens/ProteinScreen';
import CuisineScreen         from './screens/CuisineScreen';
import SetupCompleteScreen   from './screens/SetupCompleteScreen';
import ShoppingPlannerScreen from './screens/ShoppingPlannerScreen';
import GuestDiscoverScreen   from './screens/GuestDiscoverScreen';
import MainTabs              from './navigation/MainTabs';
import RecipeDetailScreen    from './screens/RecipeDetailScreen';
import AdminScreen           from './screens/admin/AdminScreen';

// ─────────────────────────────────────────────
//  Route type map
// ─────────────────────────────────────────────

export type RootStackParamList = {
  Splash:          undefined;
  Welcome:         undefined;
  SignUp:          undefined;
  Login:           undefined;
  DietProtocol:    undefined;
  Household:       { protocols: string[] };
  Protein:         { protocols: string[]; household: number };
  Cuisine:         { protocols: string[]; household: number; proteins: string[] };
  SetupComplete:   { protocols: string[]; household: number; proteins: string[]; cuisines: string[] };
  GuestDiscover:   undefined;
  ShoppingPlanner: undefined;
  MainTabs:        undefined;
  Discover:        undefined;
  RecipeDetail:    { recipeId: string };
  Admin:           undefined;
};

// On web: /admin routes straight to AdminScreen
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
  config: {
    screens: {
      Admin:   'admin',
      Discover: '',
    },
  },
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
          <Stack.Screen name="Admin" component={AdminScreen} />
        </>
      ) : (
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
          <Stack.Screen name="ShoppingPlanner" component={ShoppingPlannerScreen} />
          <Stack.Screen name="GuestDiscover" component={GuestDiscoverScreen} options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="Admin"         component={AdminScreen} />
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

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  }

  return (
    <UserProvider>
      <MenuProvider>
        <NavigationContainer linking={linking}>
          <AppNavigator />
        </NavigationContainer>
      </MenuProvider>
    </UserProvider>
  );
}
