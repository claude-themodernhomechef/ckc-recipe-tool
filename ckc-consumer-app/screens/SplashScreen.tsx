/**
 * SplashScreen
 *
 * White background. The CKC logo splits into two layers:
 *   1. OUTER RING  — the letter-paths circling the edge, spinning slowly clockwise
 *   2. CENTRAL C   — the large C letterform, perfectly still
 *
 * Exit animation:
 *   1. Chef's knife slides in from the right and slashes across the center
 *   2. Screen splits — top half flies up, bottom half flies down
 *   3. Navigate → Welcome
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Text,
} from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Splash'>;
};

const { width, height } = Dimensions.get('window');

// Render size of the badge (original SVG viewBox is 336×336)
const LOGO_SIZE = Math.min(width * 0.78, 300);

// Vertical center offset — so the badge sits exactly in the middle of the screen
const LOGO_TOP = (height - LOGO_SIZE) / 2;

// ─── SVG path data extracted from LOGO_02.svg ───────────────────────────────
//
// OUTER_PATHS — the 24 letter-forms arranged around the circle edge.
// In the original SVG these are filled white; we override to dark below.
//
const OUTER_PATHS = [
  // C
  'M146.067 324.867C144.335 333.047 139.617 337.237 132.435 335.689C126.576 334.425 123.154 330.988 124.309 324.029L129.294 325.108C128.844 328.772 130.167 330.775 133.336 331.471C138.279 332.536 139.983 328.63 141.011 323.787C142.025 319.029 142.067 314.712 137.124 313.647C133.913 312.951 131.928 314.243 130.857 317.737L125.872 316.658C127.661 309.94 132.378 308.165 138.11 309.4C145.602 311.019 147.827 316.615 146.067 324.881V324.867Z',
  // U
  'M111.619 311.884L104.592 326.782L100.071 324.623L107.098 309.725C108.873 305.947 108.239 304.129 105.507 302.823C102.775 301.516 100.972 302.169 99.1978 305.933L92.1846 320.831L87.6641 318.673L94.6913 303.774C97.5079 297.781 101.606 296.077 107.394 298.846C113.252 301.658 114.449 305.905 111.619 311.898V311.884Z',
  // R
  'M70.0762 307.466L64.1615 302.694C59.1339 298.632 57.1342 293.817 60.8802 289.088C63.1898 286.176 66.7809 285.651 69.8227 286.759L70.2452 274.289L75.0333 278.152L74.2165 289.145L76.6388 291.105L82.2719 284.003L86.1728 287.156L70.0621 307.452L70.0762 307.466ZM74.118 294.314L72.1182 292.695C68.9918 290.167 66.6119 290.167 64.8938 292.34C63.1757 294.499 63.6827 296.842 66.8231 299.37L68.8229 300.99L74.118 294.314Z',
  // A
  'M37.6563 276.35L34.375 272.132L49.0492 248.883L52.3587 253.129L49.0633 258.171L54.6541 265.358L60.2591 263.284L63.5122 267.46L37.6422 276.336L37.6563 276.35ZM50.8377 266.934L46.7115 261.651L45.1483 263.994L40.1208 271.152L48.2042 267.928L50.8236 266.948L50.8377 266.934Z',
  // T
  'M20.6321 241.399L24.2232 249.182L20.3786 250.985L11.084 230.79L14.9286 228.986L18.5197 236.783L38.0524 227.637L40.1789 232.252L20.6462 241.399H20.6321Z',
  // E
  'M5.3376 212.368L1.73242 194.6L5.88683 193.748L8.49214 206.573L14.6745 205.295L12.4494 194.288L16.6038 193.436L18.8289 204.443L25.4478 203.079L22.8424 190.254L26.9969 189.402L30.602 207.17L5.3376 212.382V212.368Z',
  // D
  'M0 173.665L0.225324 165.542C0.46473 156.907 5.36552 154.137 13.4208 154.364C21.1241 154.577 26.2221 157.773 25.9827 166.266L25.7573 174.39L0 173.665ZM21.6733 169.22L21.7578 166.138C21.9127 160.642 17.8287 159.761 13.28 159.633C8.68905 159.506 4.60506 160.159 4.46423 165.655L4.37973 168.737L21.6733 169.22Z',
  // Y
  'M15.8574 97.5001L18.2233 93.0547L27.8418 98.2528L22.6453 84.7321L25.4759 79.4062L30.3063 92.8417L48.5294 91.0806L45.6424 96.5343L31.9117 97.4717L33.1792 101.15L40.9669 105.354L38.601 109.799L15.8715 97.5285L15.8574 97.5001Z',
  // T
  'M52.458 78.6389L56.5983 73.8953L43.614 62.3488L39.4737 67.0924L36.291 64.2661L47.9093 50.9727L51.092 53.7989L46.9516 58.5425L59.9359 70.0891L64.0763 65.3455L67.2589 68.1717L55.6407 81.4652L52.458 78.6389Z',
  // I
  'M71.2584 36.4436L64.3156 41.4286L61.8652 37.949L79.863 25.0391L82.3134 28.5186L75.3706 33.5037L87.862 51.1999L83.7498 54.154L71.2584 36.4578V36.4436Z',
  // C (Kitchen)
  'M99.7758 28.7585C96.6495 21.0182 98.2127 14.8828 105.015 12.0849C110.563 9.8125 115.309 10.7073 118.238 17.1125L113.521 19.0441C111.845 15.7491 109.634 14.8544 106.634 16.09C101.959 18.0073 102.733 22.2112 104.578 26.7986C106.395 31.3007 108.775 34.8939 113.45 32.9766C116.492 31.7268 117.407 29.5396 116.337 26.0458L121.055 24.1143C123.322 30.69 120.421 34.8229 114.999 37.0527C107.902 39.9642 102.944 36.6124 99.7899 28.7727L99.7758 28.7585Z',
  // H
  'M133.588 3.55108L138.531 2.76995L140.15 13.2797L147.544 12.1151L145.924 1.60535L150.867 0.824219L154.825 26.5021L149.882 27.2833L148.192 16.2764L140.798 17.441L142.488 28.4479L137.545 29.229L133.588 3.55108Z',
  // E (Kitchen)
  'M172.232 0L190.159 1.36343L189.85 5.62414L176.908 4.64418L176.443 10.9926L187.54 11.8306L187.216 16.0913L176.119 15.2534L175.612 22.0563L188.554 23.0363L188.23 27.297L170.303 25.9336L172.232 0.0142024V0Z',
  // N
  'M210.663 5.41016L216.718 7.34168L217.352 29.6678L219.239 21.6861L223.112 9.38682L227.323 10.7361L219.535 35.5192L213.479 33.5877L212.846 11.2615L210.958 19.2433L207.086 31.5425L202.875 30.1933L210.663 5.41016Z',
  // C (Collective)
  'M268.431 49.7367C274.205 43.729 280.401 42.7065 285.682 47.8619C289.991 52.0658 291.076 56.8094 286.442 62.0927L282.781 58.5137C285.091 55.6448 285.02 53.2446 282.696 50.9581C279.077 47.4075 275.571 49.8219 272.149 53.3725C268.797 56.8663 266.487 60.5021 270.121 64.0385C272.486 66.3534 274.838 66.3108 277.57 63.9248L281.232 67.5038C276.176 72.2474 271.247 71.2249 267.036 67.1204C261.53 61.7377 262.586 55.8153 268.431 49.7367Z',
  // O
  'M292.922 76.1953C299.907 71.6789 306.089 71.7215 310.06 77.9564C314.046 84.2338 311.553 89.7301 304.695 94.1755C297.794 98.6492 291.556 98.6918 287.556 92.4144C283.585 86.1795 285.979 80.6832 292.922 76.1953ZM301.822 89.929C305.652 87.4436 309.173 84.4753 306.469 80.2287C303.765 75.9822 299.625 77.9706 295.795 80.4418C292.034 82.8704 288.443 85.8955 291.147 90.142C293.851 94.3885 298.076 92.3576 301.822 89.929Z',
  // L
  'M323.79 105L325.451 109.758L305.13 116.973L309.524 129.528L305.524 130.948L299.469 113.635L323.776 105H323.79Z',
  // L
  'M334.31 142.691L334.845 147.705L313.426 150.02L314.834 163.256L310.623 163.711L308.68 145.461L334.31 142.691Z',
  // E
  'M336 181.746L333.803 199.741L329.592 199.215L331.169 186.234L324.902 185.453L323.551 196.588L319.354 196.062L320.706 184.928L314.002 184.09L312.425 197.071L308.229 196.545L310.425 178.551L336 181.718V181.746Z',
  // C (second)
  'M317.396 213.859C325.17 216.771 328.606 222.068 326.043 229.013C323.959 234.68 320.1 237.591 313.439 235.447L315.214 230.632C318.748 231.612 320.903 230.575 322.03 227.508C323.79 222.736 320.199 220.478 315.594 218.745C311.073 217.055 306.848 216.387 305.088 221.174C303.947 224.284 304.933 226.443 308.2 228.005L306.426 232.819C300.089 230.064 299.018 225.108 301.06 219.569C303.722 212.325 309.524 210.905 317.382 213.845L317.396 213.859Z',
  // T (Collective)
  'M306.017 258.882L310.735 251.724L314.256 254.096L302.018 272.63L298.497 270.258L303.215 263.1L285.273 251.057L288.076 246.824L306.003 258.854L306.017 258.882Z',
  // I (Collective)
  'M274.81 271.278L270.247 275.596L282.091 288.321L286.654 284.004L289.555 287.114L276.739 299.243L273.838 296.132L278.401 291.815L266.558 279.09L261.995 283.407L259.094 280.297L271.909 268.168L274.81 271.278Z',
  // V
  'M262.262 310.535L257.376 313.375L247.208 304.13L241.744 298.861L243.504 306.232L246.391 319.766L241.701 322.493L236.871 295.296L241.321 292.711L262.234 310.563L262.262 310.535Z',
  // E (end)
  'M224.774 329.438L207.551 334.636L206.34 330.546L218.775 326.797L216.973 320.704L206.312 323.914L205.101 319.823L215.761 316.599L213.818 310.066L201.383 313.816L200.172 309.725L217.395 304.527L224.788 329.438H224.774Z',
];

// CENTRAL C — the large C letterform in the middle of the badge
const CENTER_C_PATH =
  'M173.277 263C108.092 263 68 224.243 68 171.603C68 118.385 106.938 75 175.873 75C193.756 75 210.773 79.3385 220.292 84.2554L243.078 78.76L245.097 141.523H235.867L209.043 89.1723C202.697 85.7015 190.295 82.2308 177.604 82.2308C139.819 82.2308 119.052 117.806 119.052 169.289C119.052 223.375 142.415 256.058 175.296 256.058C199.813 256.058 216.83 244.2 227.502 224.532C227.502 224.243 240.193 195.031 240.193 195.031H250L241.924 253.166L228.368 252.877C217.407 257.215 193.179 263 173.277 263Z';

// ─── Component ───────────────────────────────────────────────────────────────

export default function SplashScreen({ navigation }: Props) {
  const spinAnim    = useRef(new Animated.Value(0)).current;
  // Knife: starts upper-right, crosses screen CENTER at midpoint, exits lower-left.
  // With top:0 left:0 anchor, mid-animation values must equal (width/2 - 80, height/2 - 80)
  // so the emoji center lands on the screen center. start/end are symmetric around that.
  const knifeX      = useRef(new Animated.Value(width + 80)).current;
  const knifeY      = useRef(new Animated.Value(-240)).current;
  const topHalfY    = useRef(new Animated.Value(0)).current;
  const bottomHalfY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slow clockwise spin — one revolution every 18 seconds (half speed)
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    // After 2.8 s, trigger the chop
    const t = setTimeout(startChop, 2800);
    // Safety fallback — if animation callbacks don't fire (common on web), navigate anyway
    const fallback = setTimeout(() => navigation.replace('Welcome'), 5000);
    return () => { clearTimeout(t); clearTimeout(fallback); };
  }, []);

  function startChop() {
    // 1 — knife slashes diagonally: upper-right → lower-left (slow, dramatic)
    Animated.parallel([
      Animated.timing(knifeX, {
        toValue: -240,
        duration: 700,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(knifeY, {
        toValue: height + 80,
        duration: 700,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // 2 — screen splits
      Animated.parallel([
        Animated.timing(topHalfY, {
          toValue: -(height / 2 + 10),
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bottomHalfY, {
          toValue: height / 2 + 10,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        navigation.replace('Welcome');
      });
    });
  }

  const rotation = spinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ── The badge — rendered identically in both split halves ──────────────────
  const Badge = () => (
    <View style={styles.badge}>
      {/* ── Spinning outer ring (real letter-paths from SVG) ── */}
      <Animated.View
        style={[styles.svgLayer, { transform: [{ rotate: rotation }] }]}
        pointerEvents="none"
      >
        <Svg
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          viewBox="0 0 336 336"
        >
          <G fill="#1a1a16">
            {OUTER_PATHS.map((d, i) => (
              <Path key={i} d={d} />
            ))}
          </G>
        </Svg>
      </Animated.View>

      {/* ── Static central C (real letterform from SVG) ── */}
      <View style={styles.svgLayer} pointerEvents="none">
        <Svg
          width={LOGO_SIZE}
          height={LOGO_SIZE}
          viewBox="0 0 336 336"
        >
          <Path d={CENTER_C_PATH} fill="#1a1a16" />
        </Svg>
      </View>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>

      {/* TOP HALF — clipped, flies upward on chop */}
      <Animated.View
        style={[styles.topHalf, { transform: [{ translateY: topHalfY }] }]}
      >
        <View style={[styles.badgeFrame, { top: LOGO_TOP }]}>
          <Badge />
        </View>
      </Animated.View>

      {/* BOTTOM HALF — clipped, flies downward on chop */}
      <Animated.View
        style={[styles.bottomHalf, { transform: [{ translateY: bottomHalfY }] }]}
      >
        {/* Shift up by half the screen so the bottom portion of the badge shows */}
        <View style={[styles.badgeFrame, { top: LOGO_TOP - height / 2 }]}>
          <Badge />
        </View>
      </Animated.View>

      {/* KNIFE — diagonal slash from upper-right to lower-left */}
      <Animated.View
        style={[
          styles.knife,
          { transform: [{ translateX: knifeX }, { translateY: knifeY }] },
        ]}
      >
        <Text style={styles.knifeGlyph}>🔪</Text>
      </Animated.View>

    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f3ee',
  },

  // Split halves
  topHalf: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: height / 2,
    overflow: 'hidden',
    backgroundColor: '#f5f3ee',
  },
  bottomHalf: {
    position: 'absolute',
    top: height / 2, left: 0, right: 0,
    height: height / 2,
    overflow: 'hidden',
    backgroundColor: '#f5f3ee',
  },

  // Inner frame that positions the badge at LOGO_TOP
  badgeFrame: {
    position: 'absolute',
    left: 0, right: 0,
    height: LOGO_SIZE,
    alignItems: 'center',
  },

  // Badge container
  badge: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },

  // Both SVG layers (outer ring + center C) are stacked on top of each other
  svgLayer: {
    position: 'absolute',
    top: 0, left: 0,
  },

  // Knife — anchored top-left; translateX/Y move it diagonally across the screen
  knife: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  knifeGlyph: {
    fontSize: 160,
    // 🔪 emoji naturally points upper-right.
    // Rotating 180° flips it so blade faces lower-left — the direction of travel.
    transform: [{ rotate: '180deg' }],
  },
});
