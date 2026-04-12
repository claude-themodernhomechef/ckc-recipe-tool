/**
 * ProfileScreen — Phase 1G
 *
 * Shows the user's dietary protocols, household size, cuisine preferences,
 * saved recipe bank, and subscription tier.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { TabId } from '../../navigation/MainTabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import { useUser } from '../../context/UserContext';
import { SAMPLE_RECIPES } from '../../data/sampleRecipes';
import DietTag from '../components/DietTag';
import PremiumGate from '../components/PremiumGate';
import SectionLabel from '../components/SectionLabel';

export default function ProfileScreen({ onNavigate }: { onNavigate?: (tab: TabId) => void }) {
  const { profile, signOut } = useUser();

  const savedRecipeObjects = SAMPLE_RECIPES.filter(r =>
    profile.savedRecipes.includes(r.id)
  );

  const householdText = profile.household === 1
    ? 'Just me'
    : profile.household >= 5 ? '5+ people' : `${profile.household} people`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {/* Avatar */}
        <Pressable style={styles.avatar}>
          <Text style={styles.avatarIcon}>👤</Text>
        </Pressable>

        {/* Greeting + tier */}
        <View style={styles.headerText}>
          <Text style={styles.greeting}>
            Hello, {profile.name ? profile.name : 'Chef'} 👋
          </Text>
          <View style={[
            styles.tierBadge,
            profile.tier === 'paid' && styles.tierBadgePaid,
          ]}>
            <Text style={[
              styles.tierBadgeText,
              profile.tier === 'paid' && styles.tierBadgeTextPaid,
            ]}>
              {profile.tier === 'paid' ? 'Premium' : 'Free'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Protocols ── */}
        <View style={styles.section}>
          <SectionLabel>Dietary Protocols</SectionLabel>
          {profile.protocols.length > 0 ? (
            <View style={styles.tagRow}>
              {profile.protocols.map(key => (
                <DietTag key={key} protocol={key} variant="circle" />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyNote}>No protocols selected. All recipes shown.</Text>
          )}
        </View>

        {/* ── Household ── */}
        <View style={styles.section}>
          <SectionLabel>Cooking For</SectionLabel>
          <Text style={styles.sectionValue}>{householdText}</Text>
          <Text style={styles.sectionNote}>
            Ingredient quantities are scaled to {profile.household}{' '}
            {profile.household === 1 ? 'serving' : 'servings'} on every recipe.
          </Text>
        </View>

        {/* ── Cuisine preferences ── */}
        {profile.cuisines.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Favorite Cuisines</SectionLabel>
            <View style={styles.tagRow}>
              {profile.cuisines.map(c => (
                <View key={c} style={styles.tagNeutral}>
                  <Text style={styles.tagNeutralText}>{c}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── My Pantry ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <SectionLabel>My Pantry</SectionLabel>
            {profile.pantryIngredients.length > 0 && (
              <Text style={styles.sectionCount}>{profile.pantryIngredients.length} items</Text>
            )}
          </View>
          {profile.pantryIngredients.length > 0 ? (
            <View style={styles.pantryGrid}>
              {profile.pantryIngredients.map((name, i) => (
                <View key={i} style={styles.pantryChip}>
                  <Text style={styles.pantryChipText}>{name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.pantryEmpty}>
              <Text style={styles.emptyNote}>No pantry ingredients scanned yet.</Text>
              <TouchableOpacity
                style={styles.scanButton}
                activeOpacity={0.7}
                onPress={() => onNavigate?.('scan')}
              >
                <Text style={styles.scanButtonText}>Scan Pantry</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Saved recipes ── */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <SectionLabel>Saved Recipes</SectionLabel>
            <Text style={styles.sectionCount}>{savedRecipeObjects.length}</Text>
          </View>

          {savedRecipeObjects.length > 0 ? (
            <View style={styles.savedList}>
              {savedRecipeObjects.map(recipe => (
                <View key={recipe.id} style={styles.savedCard}>
                  <View style={[styles.savedCardThumb, { backgroundColor: recipe.placeholder_color }]} />
                  <View style={styles.savedCardInfo}>
                    <Text style={styles.savedCardName} numberOfLines={1}>{recipe.name}</Text>
                    <Text style={styles.savedCardMeta}>{recipe.cuisine} · {recipe.prep_time} min</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyNote}>
              Swipe right on recipes in Discover to save them here.
            </Text>
          )}
        </View>

        {/* ── Subscription ── */}
        {profile.tier === 'free' && (
          <PremiumGate
            title="Unlock the Full CKC Experience"
            body="Meal Plan calendar, consolidated shopping lists, unlimited swipes, and all chef notes."
          />
        )}

        {/* ── Settings links ── */}
        <View style={styles.settingsSection}>
          {['Edit Dietary Protocols', 'Change Household Size', 'Edit Cuisine Preferences', 'Account Settings'].map((item, i) => (
            <TouchableOpacity key={i} style={styles.settingsRow} activeOpacity={0.7}>
              <Text style={styles.settingsRowText}>{item}</Text>
              <Text style={styles.settingsRowArrow}>›</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={signOut}
          >
            <Text style={[styles.settingsRowText, { color: Colors.red }]}>Sign Out</Text>
            <Text style={styles.settingsRowArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 26,
  },
  headerText: {
    flex: 1,
    gap: 6,
  },
  greeting: {
    fontFamily: Fonts.display,
    fontSize: 26,
    color: Colors.textPrimary,
    lineHeight: 30,
  },
  tierBadge: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierBadgePaid: {
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,168,67,0.12)',
  },
  tierBadgeText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.textMuted,
  },
  tierBadgeTextPaid: {
    color: Colors.gold,
  },

  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 24,
  },

  // Section
  section: {
    gap: 10,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionValue: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  sectionNote: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  sectionCount: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyNote: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  // Tags
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  tagNeutral: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.surface,
  },
  tagNeutralText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },

  // Pantry ingredients
  pantryEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scanButton: {
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  scanButtonText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.gold,
  },
  pantryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pantryChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pantryChipText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Saved recipes
  savedList: {
    gap: 8,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 10,
  },
  savedCardThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  savedCardInfo: {
    flex: 1,
    gap: 2,
  },
  savedCardName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  savedCardMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Upgrade card
  upgradeCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  upgradeTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.textPrimary,
    lineHeight: 28,
  },
  upgradeBody: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  upgradeBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingVertical: 12,
    alignItems: 'center',
  },
  upgradeBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: '#000',
  },

  // Settings
  settingsSection: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  settingsRowText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
  },
  settingsRowArrow: {
    fontSize: 18,
    color: Colors.textMuted,
  },
});
