/**
 * GuestDiscoverScreen
 *
 * Lets non-signed-in users browse and swipe recipes immediately.
 * After GUEST_SWIPE_LIMIT swipes, a sign-up gate appears.
 *
 * Flow: Welcome → GuestDiscover → (gate) → SignUp → DietProtocol → … → MainTabs
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  TouchableOpacity,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import { SAMPLE_RECIPES, Recipe } from '../data/sampleRecipes';
import { fetchRecipes } from '../lib/firestore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GuestDiscover'>;
};

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD  = width * 0.35;
const CARD_WIDTH       = width - 48;
const CARD_HEIGHT      = CARD_WIDTH * 1.28;
const GUEST_SWIPE_LIMIT = 8;

// ── Single swipeable card ─────────────────────────────────────────────────────

interface CardProps {
  recipe: Recipe;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onTap: () => void;
}

function SwipeCard({ recipe, onSwipeLeft, onSwipeRight, onTap }: CardProps) {
  const position = useRef(new Animated.ValueXY()).current;

  const rotate = position.x.interpolate({
    inputRange:  [-width / 2, 0, width / 2],
    outputRange: ['-8deg', '0deg', '8deg'],
    extrapolate: 'clamp',
  });

  const saveOpacity = position.x.interpolate({
    inputRange:  [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const passOpacity = position.x.interpolate({
    inputRange:  [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  function flyOff(direction: 'left' | 'right', callback: () => void) {
    const x = direction === 'right' ? width * 1.4 : -width * 1.4;
    Animated.timing(position, {
      toValue: { x, y: 0 },
      duration: 220,
      useNativeDriver: true,
    }).start(callback);
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
          // Treat as tap
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: true,
          }).start();
          onTap();
          return;
        }
        if (gesture.dx > SWIPE_THRESHOLD) {
          flyOff('right', onSwipeRight);
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          flyOff('left', onSwipeLeft);
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            friction: 5,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const hasPhoto = recipe.photo_url && recipe.photo_url.startsWith('http');

  return (
    <Animated.View
      style={[
        styles.card,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Photo / color placeholder */}
      {hasPhoto ? (
        <Image source={{ uri: recipe.photo_url }} style={styles.cardPhoto} resizeMode="cover" />
      ) : (
        <View style={[styles.cardPhoto, { backgroundColor: recipe.placeholder_color ?? '#3a3a34' }]} />
      )}

      {/* Gradient overlay */}
      <View style={styles.cardOverlay} />

      {/* Save stamp */}
      <Animated.View style={[styles.stamp, styles.stampSave, { opacity: saveOpacity }]}>
        <Text style={styles.stampText}>SAVE</Text>
      </Animated.View>

      {/* Pass stamp */}
      <Animated.View style={[styles.stamp, styles.stampPass, { opacity: passOpacity }]}>
        <Text style={styles.stampText}>PASS</Text>
      </Animated.View>

      {/* Recipe info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={2}>{recipe.name}</Text>
        <Text style={styles.cardMeta}>{recipe.cuisine} · {recipe.prep_time} min</Text>
      </View>
    </Animated.View>
  );
}

// ── Background card (depth stack) ────────────────────────────────────────────

function BackCard({ recipe, offset }: { recipe: Recipe; offset: number }) {
  const scale      = 1 - offset * 0.04;
  const translateY = offset * 10;
  const hasPhoto   = recipe.photo_url && recipe.photo_url.startsWith('http');

  return (
    <View style={[
      styles.card,
      {
        transform: [{ scale }, { translateY }],
        zIndex: 10 - offset,
        position: 'absolute',
      },
    ]}>
      {hasPhoto ? (
        <Image source={{ uri: recipe.photo_url }} style={styles.cardPhoto} resizeMode="cover" />
      ) : (
        <View style={[styles.cardPhoto, { backgroundColor: recipe.placeholder_color ?? '#3a3a34' }]} />
      )}
      <View style={styles.cardOverlay} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function GuestDiscoverScreen({ navigation }: Props) {
  const [recipes, setRecipes]       = useState<Recipe[]>(SAMPLE_RECIPES);
  const [queue, setQueue]           = useState<Recipe[]>([]);
  const [swipeCount, setSwipeCount] = useState(0);
  const [showGate, setShowGate]     = useState(false);

  // Load recipes — Firestore first, fall back to sample data
  useEffect(() => {
    fetchRecipes()
      .then((r) => {
        if (r && r.length > 0) setRecipes(r as unknown as Recipe[]);
      })
      .catch(() => {/* keep sample data */});
  }, []);

  // Shuffle recipes into the queue
  useEffect(() => {
    const shuffled = [...recipes].sort(() => Math.random() - 0.5);
    setQueue(shuffled);
  }, [recipes]);

  function handleSwipe() {
    const next = swipeCount + 1;
    setSwipeCount(next);
    setQueue((prev) => prev.slice(1));
    if (next >= GUEST_SWIPE_LIMIT) {
      setShowGate(true);
    }
  }

  const topCards = queue.slice(0, 3);
  const remaining = GUEST_SWIPE_LIMIT - swipeCount;

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CKC Recipes</Text>
        <View style={styles.counterPill}>
          <Text style={styles.counterText}>{Math.max(0, remaining)} left</Text>
        </View>
      </View>

      <Text style={styles.hint}>Swipe right to save · left to pass</Text>

      {/* ── Card stack ── */}
      <View style={styles.stackArea}>
        {topCards.length === 0 && !showGate ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>You've seen them all!</Text>
          </View>
        ) : (
          <>
            {/* Background cards (depth 2, 3) */}
            {topCards[2] && <BackCard recipe={topCards[2]} offset={2} />}
            {topCards[1] && <BackCard recipe={topCards[1]} offset={1} />}

            {/* Top swipeable card */}
            {topCards[0] && !showGate && (
              <SwipeCard
                key={topCards[0].id}
                recipe={topCards[0]}
                onSwipeLeft={handleSwipe}
                onSwipeRight={handleSwipe}
                onTap={() => {}}
              />
            )}
          </>
        )}
      </View>

      {/* ── Action buttons ── */}
      {!showGate && topCards.length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleSwipe} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSave]} onPress={handleSwipe} activeOpacity={0.8}>
            <Text style={styles.actionIcon}>♥</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Sign-up gate modal ── */}
      <Modal visible={showGate} transparent animationType="fade">
        <View style={styles.gateOverlay}>
          <View style={styles.gateCard}>
            <Text style={styles.gateTitle}>You're on a roll.</Text>
            <Text style={styles.gateSubtitle}>
              Create a free account to keep exploring, save recipes, and build your weekly plan.
            </Text>
            <TouchableOpacity
              style={styles.gatePrimaryBtn}
              onPress={() => {
                setShowGate(false);
                navigation.navigate('SignUp');
              }}
              activeOpacity={0.88}
            >
              <Text style={styles.gatePrimaryBtnText}>Create Free Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gateSecondaryBtn}
              onPress={() => {
                setShowGate(false);
                navigation.navigate('Login');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.gateSecondaryBtnText}>I already have an account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gateDismissBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.5}
            >
              <Text style={styles.gateDismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.bg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    color: Colors.textPrimary,
  },
  counterPill: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  counterText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
  },

  hint: {
    textAlign: 'center',
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },

  // Card stack
  stackArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
  },
  cardPhoto: {
    ...StyleSheet.absoluteFillObject,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardInfo: {
    position: 'absolute',
    bottom: 20,
    left: 18,
    right: 18,
    gap: 6,
  },
  cardName: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  cardMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(245,243,238,0.65)',
  },

  // Stamps
  stamp: {
    position: 'absolute',
    top: 40,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 3,
  },
  stampSave: {
    right: 20,
    borderColor: Colors.green,
    transform: [{ rotate: '15deg' }],
  },
  stampPass: {
    left: 20,
    borderColor: Colors.red,
    transform: [{ rotate: '-15deg' }],
  },
  stampText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: 2,
  },

  // Action buttons
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    paddingVertical: 20,
  },
  actionBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSave: {
    borderColor: Colors.green,
    backgroundColor: `${Colors.green}18`,
  },
  actionIcon: {
    fontSize: 22,
    color: Colors.textPrimary,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.textSecondary,
  },

  // Gate modal
  gateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  gateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.borderActive,
  },
  gateTitle: {
    fontFamily: Fonts.display,
    fontSize: 36,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  gateSubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  gatePrimaryBtn: {
    backgroundColor: Colors.textPrimary,
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  gatePrimaryBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.bg,
  },
  gateSecondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.borderActive,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gateSecondaryBtnText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  gateDismissBtn: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  gateDismissText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
