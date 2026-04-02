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
import { View } from 'react-native';
import { Colors } from './constants/theme';

import WelcomeScreen         from './screens/WelcomeScreen';
import DietProtocolScreen    from './screens/DietProtocolScreen';
import HouseholdScreen       from './screens/HouseholdScreen';
import ProteinScreen         from './screens/ProteinScreen';
import CuisineScreen         from './screens/CuisineScreen';
import SetupCompleteScreen   from './screens/SetupCompleteScreen';
import ShoppingPlannerScreen from './screens/ShoppingPlannerScreen';
import MainTabs             from './navigation/MainTabs';
import RecipeDetailScreen    from './screens/RecipeDetailScreen';
import AdminScreen           from './screens/admin/AdminScreen';

import { UserProvider }  from './context/UserContext';
import { MenuProvider }  from './context/MenuContext';

// ─────────────────────────────────────────────
//  Route definitions — what data each screen receives
// ─────────────────────────────────────────────
export type RootStackParamList = {
  Welcome:         undefined;
  DietProtocol:    undefined;
  Household:       { protocols: string[] };
  Protein:         { protocols: string[]; household: number };
  Cuisine:         { protocols: string[]; household: number; proteins: string[] };
  SetupComplete:   { protocols: string[]; household: number; proteins: string[]; cuisines: string[] };
  ShoppingPlanner: undefined;
  MainTabs:        undefined;
  Discover:        undefined;
  RecipeDetail:    { recipeId: string };
  Admin:           undefined;
  // Auth screens — not yet built, referenced by WelcomeScreen
  SignUp:          undefined;
  Login:           undefined;
  GuestDiscover:   undefined;
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

export default function App() {
  // Load both custom fonts before showing anything
  const [fontsLoaded] = useFonts({
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    DMSans_400Regular,
    DMSans_500Medium,
  });

  // Show a blank dark screen while fonts load — keeps it seamless
  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  }

  return (
    <UserProvider>
      <MenuProvider>
        <NavigationContainer linking={linking}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: Colors.bg },
            }}
          >
            <Stack.Screen name="Welcome"         component={WelcomeScreen} />
            <Stack.Screen name="DietProtocol"    component={DietProtocolScreen} />
            <Stack.Screen name="Household"       component={HouseholdScreen} />
            <Stack.Screen name="Protein"         component={ProteinScreen} />
            <Stack.Screen name="Cuisine"         component={CuisineScreen} />
            <Stack.Screen name="SetupComplete"   component={SetupCompleteScreen} />
            <Stack.Screen name="ShoppingPlanner" component={ShoppingPlannerScreen} />
            <Stack.Screen name="MainTabs"        component={MainTabs} />
            <Stack.Screen name="Discover"        component={MainTabs} />
            <Stack.Screen name="RecipeDetail"    component={RecipeDetailScreen} />
            <Stack.Screen name="Admin"           component={AdminScreen} />
            {/* Auth screens — point to MainTabs until auth is built */}
            <Stack.Screen name="SignUp"          component={MainTabs} />
            <Stack.Screen name="Login"           component={MainTabs} />
            <Stack.Screen name="GuestDiscover"   component={MainTabs} />
          </Stack.Navigator>
        </NavigationContainer>
      </MenuProvider>
    </UserProvider>
  );
}
