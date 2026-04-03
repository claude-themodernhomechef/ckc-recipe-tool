/**
 * RecipeDetailScreen
 *
 * Full recipe detail — accessible from swipe cards, browse, or saved recipes.
 *
 * Sections:
 *   ─ Hero photo + back button
 *   ─ Recipe name, cuisine, protein, prep time
 *   ─ Diet compliance badges (expandable)
 *   ─ Diet compliant notes (swap recommendations) — VISIBLE TO ALL
 *   ─ Ingredients (scaled to household size)
 *   ─ Chef notes (first visible, rest behind paywall teaser)
 *   ─ Actions: Save · Generate Shopping List · View Full Recipe
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Colors, Fonts } from '../constants/theme';
import { useUser } from '../context/UserContext';
import {
  SAMPLE_RECIPES,
  Recipe,
  getComplianceStatus,
  scaleQty,
} from '../data/sampleRecipes';
import { fetchRecipeById } from '../lib/firestore';
import DietTag from './components/DietTag';
import SectionLabel from './components/SectionLabel';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'RecipeDetail'>;
  route:      RouteProp<RootStackParamList, 'RecipeDetail'>;
};

const { width } = Dimensions.get('window');
const HERO_HEIGHT = width * 0.65;

const ALL_PROTOCOLS = ['GF', 'DF', 'LF', 'K', 'AIP', 'V', 'Vg', 'LH'];

export default function RecipeDetailScreen({ navigation, route }: Props) {
  const { recipeId } = route.params;
  const { profile, saveRecipe, unsaveRecipe } = useUser();

  const [recipe, setRecipe]   = useState<Recipe | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(true);
  const [swapAccordionOpen, setSwapAccordionOpen] = useState(false);

  // Load recipe: Firestore first, sampleRecipes fallback
  useEffect(() => {
    fetchRecipeById(recipeId).then(fetched => {
      if (fetched) {
        setRecipe(fetched);
      } else {
        setRecipe(SAMPLE_RECIPES.find(r => r.id === recipeId) ?? null);
      }
      setRecipeLoading(false);
    }).catch(() => {
      setRecipe(SAMPLE_RECIPES.find(r => r.id === recipeId) ?? null);
      setRecipeLoading(false);
    });
  }, [recipeId]);

  const isSaved      = recipe ? profile.savedRecipes.includes(recipe.id) : false;
  const servingCount = profile.household;

  const complianceBadges = recipe
    ? ALL_PROTOCOLS
        .map(p => ({ p, status: getComplianceStatus(recipe, p) }))
        .filter(b => b.status !== 'none')
    : [];

  if (recipeLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.textMuted} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Recipe not found.</Text>
      </View>
    );
  }

  // After null guard — recipe is guaranteed non-null for all functions below
  const r = recipe;

  function handleSave() {
    if (isSaved) {
      unsaveRecipe(r.id);
    } else {
      saveRecipe(r.id);
    }
  }

  function handleViewFullRecipe() {
    // If household differs from 4, show scaling info
    if (profile.household !== 4) {
      Alert.alert(
        `Scaled for ${servingCount} people`,
        `CKC scaled this recipe from 4 to ${servingCount} servings.\n\nIf the original recipe differs, follow our shopping list quantities.\n\nScale seasonings and spices to taste.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue to Recipe', onPress: () => Linking.openURL(r.blog_url) },
        ]
      );
    } else {
      Linking.openURL(r.blog_url);
    }
  }

  function handleGenerateShoppingList() {
    Alert.alert(
      'Shopping List',
      'Shopping list generation coming soon! Your ingredients are scaled to your household size.',
      [{ text: 'OK' }]
    );
  }

  const formatQty = (qty: number): string => {
    const scaled = scaleQty(qty, profile.household);
    if (scaled === Math.floor(scaled)) return String(scaled);
    // Show clean fractions for common values
    const fractionMap: Record<number, string> = {
      0.25: '¼', 0.5: '½', 0.75: '¾',
      0.33: '⅓', 0.67: '⅔',
    };
    const rounded = Math.round(scaled * 100) / 100;
    const whole = Math.floor(rounded);
    const decimal = Math.round((rounded - whole) * 100) / 100;
    const fraction = fractionMap[decimal];
    if (fraction) return whole > 0 ? `${whole} ${fraction}` : fraction;
    return String(rounded);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Hero ── */}
        <View style={[styles.hero, { backgroundColor: recipe.placeholder_color }]}>
          {/* Back button */}
          <SafeAreaView edges={['top']} style={styles.heroOverlay}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.8}
            >
              <Text style={styles.backBtnText}>←</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {/* Prep time pill */}
          <View style={styles.heroPrepPill}>
            <Text style={styles.heroPrepText}>{recipe.prep_time} min</Text>
          </View>
        </View>

        {/* ── Content ── */}
        <View style={styles.content}>

          {/* ── Recipe identity ── */}
          <View style={styles.identity}>
            <View style={styles.metaRow}>
              <Text style={styles.metaCuisine}>{recipe.cuisine}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaProtein}>{recipe.protein_type}</Text>
            </View>
            <Text style={styles.recipeName}>{recipe.name}</Text>
            <Text style={styles.recipeDesc}>{recipe.menu_description}</Text>
          </View>

          {/* ── Compliance circles ── */}
          {complianceBadges.length > 0 && (
            <View style={styles.badgeRow}>
              {complianceBadges.map(({ p, status }) => (
                <DietTag key={p} protocol={p} variant="circle" status={status} />
              ))}
            </View>
          )}

          {/* ── Make it work for you (collapsible swap accordion) ── */}
          {(() => {
            const swapProtocols = ALL_PROTOCOLS.filter(
              p => r.swap_notes[p as keyof typeof r.swap_notes]?.length
            );
            if (swapProtocols.length === 0) return null;
            return (
              <View style={styles.section}>
                <TouchableOpacity
                  style={styles.accordionHeader}
                  onPress={() => setSwapAccordionOpen(open => !open)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.accordionHeaderText}>Make it work for you</Text>
                  <Text style={styles.accordionChevron}>{swapAccordionOpen ? '▲' : '▼'}</Text>
                </TouchableOpacity>

                {swapAccordionOpen && (
                  <View style={styles.accordionBody}>
                    {swapProtocols.map((p, idx) => {
                      const notes = r.swap_notes[p as keyof typeof r.swap_notes]!;
                      return (
                        <View key={p} style={[styles.swapGroup, idx > 0 && styles.swapGroupBorder]}>
                          <View style={styles.swapGroupHeader}>
                            <DietTag protocol={p} variant="circle" />
                          </View>
                          {notes.map((note, i) => (
                            <Text key={i} style={styles.swapNoteText}>{note}</Text>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}

          {/* ── Ingredients ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <SectionLabel>Ingredients</SectionLabel>
              <Text style={styles.sectionNote}>
                Scaled for {servingCount} {servingCount === 1 ? 'person' : 'people'}
              </Text>
            </View>

            <View style={styles.ingredientList}>
              {recipe.ingredients.map((ing, i) => (
                <View
                  key={i}
                  style={[styles.ingredientRow, i > 0 && styles.ingredientRowBorder]}
                >
                  <Text style={styles.ingredientQty}>
                    {formatQty(ing.quantity)} {ing.unit}
                  </Text>
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* ── Chef notes ── */}
          {recipe.chef_notes.length > 0 && (
            <View style={styles.section}>
              <SectionLabel>Chef Notes</SectionLabel>

              {/* First note always visible */}
              <View style={styles.chefNoteCard}>
                <Text style={styles.chefNoteQuote}>"</Text>
                <Text style={styles.chefNoteText}>{recipe.chef_notes[0]}</Text>
              </View>

              {/* Additional notes — gated for free users */}
              {recipe.chef_notes.length > 1 && (
                profile.tier === 'paid' ? (
                  recipe.chef_notes.slice(1).map((note, i) => (
                    <View key={i} style={styles.chefNoteCard}>
                      <Text style={styles.chefNoteQuote}>"</Text>
                      <Text style={styles.chefNoteText}>{note}</Text>
                    </View>
                  ))
                ) : (
                  <TouchableOpacity style={styles.chefNotesGate} activeOpacity={0.8}>
                    <Text style={styles.chefNotesGateText}>
                      {recipe.chef_notes.length - 1} more chef{' '}
                      {recipe.chef_notes.length - 1 === 1 ? 'tip' : 'tips'} with Premium
                    </Text>
                    <Text style={styles.chefNotesGateArrow}>→</Text>
                  </TouchableOpacity>
                )
              )}
            </View>
          )}

          {/* Bottom padding for actions bar */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* ── Action bar (sticky bottom) ── */}
      <View style={styles.actionBar}>
        {/* Save button */}
        <TouchableOpacity
          style={[styles.actionIconBtn, isSaved && styles.actionIconBtnActive]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionIconBtnText, isSaved && styles.actionIconBtnTextActive]}>
            {isSaved ? '♥' : '♡'}
          </Text>
        </TouchableOpacity>

        {/* Shopping list */}
        <TouchableOpacity
          style={styles.actionSecondaryBtn}
          onPress={handleGenerateShoppingList}
          activeOpacity={0.8}
        >
          <Text style={styles.actionSecondaryBtnText}>Shopping List</Text>
        </TouchableOpacity>

        {/* View full recipe */}
        <TouchableOpacity
          style={styles.actionPrimaryBtn}
          onPress={handleViewFullRecipe}
          activeOpacity={0.85}
        >
          <Text style={styles.actionPrimaryBtnText}>View Full Recipe</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    paddingBottom: 0,
  },
  errorText: {
    fontFamily: Fonts.body,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },

  // Hero
  hero: {
    height: HERO_HEIGHT,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  backBtn: {
    margin: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 20,
    color: '#fff',
  },
  heroPrepPill: {
    position: 'absolute',
    bottom: 14,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  heroPrepText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: '#fff',
  },

  // Content
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },

  // Recipe identity
  identity: {
    marginBottom: 24,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaCuisine: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metaDot: {
    color: Colors.textMuted,
  },
  metaProtein: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  recipeName: {
    fontFamily: Fonts.display,
    fontSize: 38,
    color: Colors.textPrimary,
    lineHeight: 42,
  },
  recipeDesc: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // Section
  section: {
    marginBottom: 28,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  // Compliance circles
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },

  // Swap accordion
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
  },
  accordionHeaderText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  accordionChevron: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  accordionBody: {
    marginTop: 2,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  swapGroup: {
    padding: 14,
    gap: 6,
  },
  swapGroupBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  swapGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  swapNoteText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingLeft: 34,
  },

  // Ingredients
  ingredientList: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  ingredientRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ingredientRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  ingredientQty: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    minWidth: 80,
  },
  ingredientName: {
    flex: 1,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Chef notes
  chefNoteCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 2,
    borderLeftColor: Colors.gold,
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  chefNoteQuote: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.gold,
    lineHeight: 20,
    marginBottom: 2,
  },
  chefNoteText: {
    fontFamily: Fonts.displayItalic,
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  chefNotesGate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    borderStyle: 'dashed',
  },
  chefNotesGateText: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  chefNotesGateArrow: {
    color: Colors.gold,
    fontSize: 14,
  },

  // Action bar
  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: Colors.bg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconBtnActive: {
    borderColor: Colors.green,
    backgroundColor: 'rgba(124,184,122,0.12)',
  },
  actionIconBtnText: {
    fontSize: 18,
    color: Colors.textMuted,
  },
  actionIconBtnTextActive: {
    color: Colors.green,
  },
  actionSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondaryBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
  },
  actionPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 100,
    backgroundColor: Colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPrimaryBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.bg,
  },
});
