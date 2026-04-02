import {
  View, Text, StyleSheet, TouchableOpacity,
  ImageBackground, Dimensions, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { height } = Dimensions.get('window');

// Images pulled directly from curatedkitchencollective.com
const HERO_IMAGE   = 'https://www.curatedkitchencollective.com/content/images/2024/12/family-dinner.webp';
const LOGO_IMAGE   = 'https://www.curatedkitchencollective.com/content/images/2024/10/CKC-LOGO.png';

export default function WelcomeScreen({ navigation }: Props) {
  return (
    <ImageBackground
      source={{ uri: HERO_IMAGE }}
      style={styles.bg}
      resizeMode="cover"
    >
      {/* Dark gradient overlay so text stays readable */}
      {/* Gradient sits behind all interactive content — pointerEvents="none" on the
          wrapping View ensures it never intercepts clicks on web */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={[
            'rgba(15,15,13,0.55)',
            'rgba(15,15,13,0.30)',
            'rgba(15,15,13,0.85)',
            'rgba(15,15,13,0.98)',
          ]}
          locations={[0, 0.25, 0.65, 1]}
          style={{ flex: 1 }}
        />
      </View>

      <SafeAreaView style={[styles.safe, { zIndex: 1 }]}>

        {/* ── Logo ── */}
        <View style={styles.logoArea}>
          <Image
            source={{ uri: LOGO_IMAGE }}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* ── Spacer pushes hero text toward bottom ── */}
        <View style={styles.spacer} />

        {/* ── Hero text ── */}
        <View style={styles.heroArea}>
          <Text style={styles.headline}>
            Taste the World From the{'\n'}Comfort of Your Home
          </Text>
          <Text style={styles.subheadline}>
            Weekly menus curated by private chefs — nutrient-dense, delicious,
            and built for the way you actually eat.
          </Text>

          {/* Diet protocol pills */}
          <View style={styles.pillRow}>
            {['AIP', 'Keto', 'Low-FODMAP', 'Gluten-Free', 'Dairy-Free'].map((tag) => (
              <View key={tag} style={styles.pill}>
                <Text style={styles.pillText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Buttons ── */}
        <View style={styles.buttonArea}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.88}
          >
            <Text style={styles.primaryBtnText}>Get Started — It's Free</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.6}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestBtn}
            activeOpacity={0.5}
            onPress={() => navigation.navigate('GuestDiscover')}
          >
            <Text style={styles.guestBtnText}>Browse recipes first →</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  safe: {
    flex: 1,
    paddingHorizontal: 28,
  },

  // ── Logo
  logoArea: {
    alignItems: 'center',
    paddingTop: height * 0.06,
  },
  logo: {
    width: 160,
    height: 60,
    // Tint to white so logo shows on dark overlay
    tintColor: Colors.textPrimary,
  },

  spacer: { flex: 1 },

  // ── Hero
  heroArea: {
    gap: 14,
    paddingBottom: 28,
  },
  headline: {
    fontFamily: Fonts.display,
    fontSize: 38,
    color: Colors.textPrimary,
    lineHeight: 45,
  },
  subheadline: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: 'rgba(245,243,238,0.72)',
    lineHeight: 22,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 100,
    paddingHorizontal: 11,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  pillText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: 'rgba(245,243,238,0.65)',
    letterSpacing: 0.3,
  },

  // ── Buttons
  buttonArea: {
    gap: 12,
    paddingBottom: 16,
  },
  primaryBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 100,
    paddingVertical: 17,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.bg,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  secondaryBtnText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: 'rgba(245,243,238,0.45)',
  },
  guestBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  guestBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(245,243,238,0.28)',
    textDecorationLine: 'underline',
  },
});
