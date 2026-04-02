/**
 * AdminSwipeScreen
 *
 * Swipe through status:"pending" recipes.
 *   Swipe right  → approve (status: "yes")   — triggers Cloud Function enrichment
 *   Swipe left   → reject  (status: "no")
 *   Maybe button → defer   (status: "maybe")
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import { fetchPendingRecipes, updateRecipeStatus } from '../../lib/firestore';
import { Recipe } from '../../data/sampleRecipes';

// ── Single admin swipe card ───────────────────────────────────────────────────

interface AdminCardProps {
  recipe: Recipe;
  onApprove: () => void;
  onReject: () => void;
  screenWidth: number;
  cardWidth: number;
  cardHeight: number;
}

function AdminCard({ recipe, onApprove, onReject, screenWidth, cardWidth, cardHeight }: AdminCardProps) {
  const position = useRef(new Animated.ValueXY()).current;
  const tapped   = useRef(false);
  const threshold = screenWidth * 0.32;

  const rotate = position.x.interpolate({
    inputRange:  [-screenWidth / 2, 0, screenWidth / 2],
    outputRange: ['-7deg', '0deg', '7deg'],
    extrapolate: 'clamp',
  });

  const approveOpacity = position.x.interpolate({
    inputRange: [0, threshold], outputRange: [0, 1], extrapolate: 'clamp',
  });
  const rejectOpacity = position.x.interpolate({
    inputRange: [-threshold, 0], outputRange: [1, 0], extrapolate: 'clamp',
  });

  function flyOff(dir: 'left' | 'right', cb: () => void) {
    Animated.timing(position, {
      toValue: { x: dir === 'right' ? screenWidth * 1.5 : -screenWidth * 1.5, y: 0 },
      duration: 260,
      useNativeDriver: true,
    }).start(cb);
  }

  function reset() {
    Animated.spring(position, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: true }).start();
  }

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => { tapped.current = true; },
      onPanResponderMove: (_, g) => {
        if (Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4) tapped.current = false;
        position.setValue({ x: g.dx, y: g.dy * 0.25 });
      },
      onPanResponderRelease: (_, g) => {
        if (tapped.current) { reset(); return; }
        if (g.dx > threshold)       flyOff('right', onApprove);
        else if (g.dx < -threshold) flyOff('left',  onReject);
        else                         reset();
      },
    }),
  ).current;

  const photoHeight = cardHeight * 0.55;

  return (
    <Animated.View
      style={[
        styles.card,
        { width: cardWidth, height: cardHeight },
        { transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }] },
      ]}
      {...pan.panHandlers}
    >
      {/* Photo */}
      <View style={[styles.photo, { height: photoHeight, backgroundColor: recipe.placeholder_color }]}>
        {recipe.photo_url ? (
          <Image source={{ uri: recipe.photo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}
        <Animated.View style={[styles.overlay, styles.overlayGreen, { opacity: approveOpacity }]}>
          <Text style={styles.overlayText}>APPROVE</Text>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.overlayRed, { opacity: rejectOpacity }]}>
          <Text style={styles.overlayText}>REJECT</Text>
        </Animated.View>
      </View>

      {/* Info */}
      <View style={styles.body}>
        <Text style={styles.meta}>{recipe.cuisine}  ·  {recipe.protein_type}</Text>
        <Text style={styles.name} numberOfLines={2}>{recipe.name}</Text>
        {recipe.menu_description ? (
          <Text style={styles.desc} numberOfLines={2}>{recipe.menu_description}</Text>
        ) : null}
        {recipe.blogger ? <Text style={styles.blogger}>{recipe.blogger}</Text> : null}
        <Text style={styles.url} numberOfLines={1}>{recipe.url}</Text>
      </View>
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AdminSwipeScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [index, setIndex]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const cardWidth  = Math.min(windowWidth - 48, 420);
  const cardHeight = cardWidth * 1.3;

  useEffect(() => {
    fetchPendingRecipes().then((r) => {
      setRecipes(r);
      setLoading(false);
    });
  }, []);

  async function decide(status: 'yes' | 'no' | 'maybe') {
    const recipe = recipes[index];
    if (!recipe || saving) return;
    setSaving(true);
    try {
      await updateRecipeStatus(recipe.id, status);
    } catch (e) {
      console.warn('Status update failed:', e);
    }
    setSaving(false);
    setIndex((i) => i + 1);
  }

  const remaining = recipes.slice(index);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  }

  if (remaining.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>All caught up</Text>
        <Text style={styles.emptyBody}>No pending recipes.</Text>
        <TouchableOpacity style={styles.reloadBtn} onPress={() => {
          setLoading(true);
          setIndex(0);
          fetchPendingRecipes().then((r) => { setRecipes(r); setLoading(false); });
        }}>
          <Text style={styles.reloadBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>

      {/* Counter */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>{remaining.length} pending</Text>
      </View>

      {/* Card stack */}
      <View style={styles.stack}>
        {/* Background cards */}
        {remaining.slice(1, 3).reverse().map((r, i) => {
          const offset = remaining.slice(1, 3).length - i;
          return (
            <View
              key={r.id}
              style={[
                styles.card,
                { width: cardWidth, height: cardHeight, position: 'absolute',
                  zIndex: 10 - offset,
                  transform: [{ scale: 1 - offset * 0.04 }, { translateY: offset * 10 }] },
              ]}
            >
              <View style={[styles.photo, { height: cardHeight * 0.55, backgroundColor: r.placeholder_color }]} />
            </View>
          );
        })}

        {/* Top card */}
        <AdminCard
          key={remaining[0].id}
          recipe={remaining[0]}
          onApprove={() => decide('yes')}
          onReject={() => decide('no')}
          screenWidth={windowWidth}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
        />
      </View>

      {/* Buttons */}
      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={() => decide('no')} disabled={saving}>
          <Text style={styles.btnIcon}>✕</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnMaybe]} onPress={() => decide('maybe')} disabled={saving}>
          <Text style={styles.btnMaybeText}>Maybe</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnApprove]} onPress={() => decide('yes')} disabled={saving}>
          <Text style={styles.btnIcon}>✓</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.bg, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg },
  counter:  { paddingVertical: 10 },
  counterText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  stack:    { flex: 1, alignItems: 'center', justifyContent: 'center' },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  photo:    { width: '100%', overflow: 'hidden' },
  overlay: {
    position: 'absolute', top: 20, padding: 8, paddingHorizontal: 14,
    borderRadius: 8, borderWidth: 3,
  },
  overlayGreen: { left: 20,  borderColor: Colors.green,  backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayRed:   { right: 20, borderColor: Colors.red,    backgroundColor: 'rgba(0,0,0,0.55)' },
  overlayText:  { fontFamily: Fonts.bodyMedium, fontSize: 18, color: Colors.textPrimary, letterSpacing: 1 },

  body:     { padding: 16, flex: 1 },
  meta:     { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, marginBottom: 4 },
  name:     { fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary, marginBottom: 4 },
  desc:     { fontFamily: Fonts.body, fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  blogger:  { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textMuted },
  url:      { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 4 },

  buttons: { flexDirection: 'row', gap: 16, paddingBottom: 24, paddingTop: 12 },
  btn: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    elevation: 4,
  },
  btnReject:   { backgroundColor: Colors.red },
  btnApprove:  { backgroundColor: Colors.green },
  btnMaybe:    { backgroundColor: Colors.surfaceElevated, width: 72, height: 44, borderRadius: 22, borderWidth: 1, borderColor: Colors.border },
  btnIcon:     { fontSize: 22, color: Colors.textPrimary },
  btnMaybeText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textSecondary },

  emptyTitle:   { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary, marginBottom: 8 },
  emptyBody:    { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  reloadBtn:    { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  reloadBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textSecondary },
});
