/**
 * MealPlanScreen — Phase 1E
 *
 * Free users  → PremiumGate paywall
 * Paid, <2 saved recipes → modal prompting them to swipe first
 * Paid, ≥2 saved recipes → 7-day calendar (tappable day slots)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import PremiumGate from '../components/PremiumGate';
import { useUser } from '../../context/UserContext';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MIN_RECIPES = 2;

export default function MealPlanScreen() {
  const { profile } = useUser();
  const navigation   = useNavigation<any>();

  const isPaid          = profile.tier === 'paid';
  const savedCount      = profile.savedRecipes.length;
  const hasEnoughRecipes = savedCount >= MIN_RECIPES;

  // Modal shows on mount for paid users who haven't saved enough yet.
  // Once dismissed (either via "Start Swiping" or "Maybe later"), it stays
  // closed for this session. The real UI appears once savedCount ≥ MIN_RECIPES.
  const [modalDismissed, setModalDismissed] = useState(false);
  const showModal = isPaid && !hasEnoughRecipes && !modalDismissed;

  function goToDiscover() {
    setModalDismissed(true);
    navigation.navigate('Discover');
  }

  // ── Shared calendar preview (shown in all paid-user states) ────────────────

  function CalendarRow({ interactive }: { interactive: boolean }) {
    return (
      <View style={styles.calendarRow}>
        {DAYS.map(day => (
          <View key={day} style={styles.daySlot}>
            <Text style={styles.dayLabel}>{day}</Text>
            {interactive ? (
              <TouchableOpacity style={styles.dayCard} activeOpacity={0.7}>
                <Text style={styles.dayCardPlus}>+</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.dayCard}>
                <Text style={styles.dayCardPlus}>+</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    );
  }

  // ── Free user ──────────────────────────────────────────────────────────────

  if (!isPaid) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Meal Plan</Text>
          <Text style={styles.week}>This Week</Text>
        </View>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <CalendarRow interactive={false} />
          <PremiumGate
            title="Build Your Week"
            body="Plan your meals, get Private Chef side pairings, and generate a full shopping list — all scaled to your household."
            features={[
              '7-day meal calendar and tracker',
              'Private Chef curated side pairings',
              'Smart shopping lists, built automatically',
              'Tailored to your household, your protocols, your life',
            ]}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Paid user ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Meal Plan</Text>
        <Text style={styles.week}>This Week</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <CalendarRow interactive={hasEnoughRecipes} />

        {hasEnoughRecipes ? (
          <Text style={styles.calendarHint}>
            Tap a day to assign a recipe from your saved collection.
          </Text>
        ) : (
          <View style={styles.emptyHint}>
            <Text style={styles.emptyHintText}>
              Save {MIN_RECIPES - savedCount} more {MIN_RECIPES - savedCount === 1 ? 'recipe' : 'recipes'} in Discover to start planning.
            </Text>
            <TouchableOpacity onPress={goToDiscover} activeOpacity={0.75}>
              <Text style={styles.emptyHintLink}>Go to Discover →</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ── "Not enough recipes" modal ── */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setModalDismissed(true)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalCard}>

            {/* Progress dots */}
            <View style={styles.progressRow}>
              {Array.from({ length: MIN_RECIPES }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.progressDot, i < savedCount && styles.progressDotFilled]}
                />
              ))}
            </View>

            <Text style={styles.modalTitle}>Your Meal Plan{'\n'}Awaits</Text>

            <Text style={styles.modalBody}>
              Save at least {MIN_RECIPES} recipes by swiping in Discover to start building your week. The more you save, the smarter your plan gets.
            </Text>

            <Text style={styles.modalCount}>
              {savedCount} of {MIN_RECIPES} recipes saved
            </Text>

            <TouchableOpacity style={styles.modalBtn} onPress={goToDiscover} activeOpacity={0.85}>
              <Text style={styles.modalBtnText}>Start Swiping</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setModalDismissed(true)} activeOpacity={0.6}>
              <Text style={styles.modalDismiss}>Maybe later</Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textPrimary,
  },
  week: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },

  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 20,
  },

  // ── Calendar ──
  calendarRow: {
    flexDirection: 'row',
    gap: 6,
  },
  daySlot: {
    flex: 1,
    gap: 4,
    alignItems: 'center',
  },
  dayLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayCard: {
    width: '100%',
    aspectRatio: 0.72,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  dayCardPlus: {
    color: Colors.textMuted,
    fontSize: 16,
  },

  calendarHint: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // ── Empty hint (modal dismissed but not enough recipes) ──
  emptyHint: {
    alignItems: 'center',
    gap: 10,
  },
  emptyHintText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyHintLink: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.gold,
  },

  // ── Modal ──
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    gap: 16,
  },

  progressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressDotFilled: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },

  modalTitle: {
    fontFamily: Fonts.display,
    fontSize: 30,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 36,
  },
  modalBody: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalCount: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  modalBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: '#000',
  },
  modalDismiss: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
});
