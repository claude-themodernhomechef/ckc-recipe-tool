/**
 * ScanScreen — Scan Tab
 *
 * Mode 1: Recipe Scanner — paste URL / photo / manual text → diet compliance check
 * Mode 2: Pantry Scanner — photo of fridge/pantry → cross-reference shopping list
 */

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';

// ─────────────────────────────────────────────
//  Demo data
// ─────────────────────────────────────────────

const DEMO_RECIPE_RESULTS = [
  { name: 'Chicken breast',     qty: '2 lbs',   type: 'normal' },
  { name: 'Olive oil',          qty: '2 tbsp',  type: 'normal' },
  { name: 'Garlic',             qty: '3 cloves',type: 'crossed', swapNote: 'High fructans → use garlic-infused oil' },
  { name: 'Garlic-infused oil', qty: '1 tbsp',  type: 'swap',    swapFor: 'Garlic' },
  { name: 'Onion',              qty: '1 medium',type: 'crossed', swapNote: 'High FODMAP → use leek greens only' },
  { name: 'Leek greens',        qty: '½ cup',   type: 'swap',    swapFor: 'Onion' },
  { name: 'Lemon juice',        qty: '2 tbsp',  type: 'normal' },
  { name: 'Fresh thyme',        qty: '1 tsp',   type: 'normal' },
  { name: 'Wheat flour',        qty: '¼ cup',   type: 'crossed', swapNote: 'Contains gluten → omit or use rice flour' },
];

const DEMO_PANTRY_RESULTS = [
  { name: 'Olive oil',     matched: true },
  { name: 'Chicken breast',matched: false },
  { name: 'Lemon juice',   matched: true },
  { name: 'Fresh thyme',   matched: true },
  { name: 'Garlic',        matched: false },
  { name: 'Onion',         matched: false },
];

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

type Mode      = null | 'recipe' | 'pantry';
type RecipeStep = 'input' | 'loading' | 'results';
type PantryStep = 'input' | 'loading' | 'results';
type InputMethod = 'url' | 'photo' | 'manual';

// ─────────────────────────────────────────────
//  Main Screen
// ─────────────────────────────────────────────

export default function ScanScreen() {
  const [mode, setMode]               = useState<Mode>(null);
  const [recipeStep, setRecipeStep]   = useState<RecipeStep>('input');
  const [pantryStep, setPantryStep]   = useState<PantryStep>('input');
  const [inputMethod, setInputMethod] = useState<InputMethod>('url');
  const [urlText, setUrlText]         = useState('');
  const [manualText, setManualText]   = useState('');

  // Pantry "already have" toggles — key: ingredient name, value: true = have it
  const [pantryToggles, setPantryToggles] = useState<Record<string, boolean | null>>({});

  function resetAll() {
    setMode(null);
    setRecipeStep('input');
    setPantryStep('input');
    setUrlText('');
    setManualText('');
    setPantryToggles({});
  }

  function simulateRecipeScan() {
    setRecipeStep('loading');
    setTimeout(() => setRecipeStep('results'), 2500);
  }

  function simulatePantryScan() {
    setPantryStep('loading');
    setTimeout(() => setPantryStep('results'), 2000);
  }

  function togglePantryItem(name: string, value: boolean) {
    setPantryToggles(prev => ({ ...prev, [name]: value }));
  }

  // ── Entry screen ─────────────────────────────
  if (mode === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan</Text>
        </View>
        <View style={styles.entryBody}>
          <Text style={styles.entrySubtitle}>What would you like to scan?</Text>

          <TouchableOpacity style={styles.modeCard} onPress={() => setMode('recipe')} activeOpacity={0.8}>
            <Text style={styles.modeIcon}>🔗</Text>
            <View style={styles.modeCardText}>
              <Text style={styles.modeCardTitle}>Scan a Recipe</Text>
              <Text style={styles.modeCardBody}>
                Paste a URL, upload a photo, or paste an ingredient list — we'll score it against your diet protocol.
              </Text>
            </View>
            <Text style={styles.modeChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => setMode('pantry')} activeOpacity={0.8}>
            <Text style={styles.modeIcon}>🧊</Text>
            <View style={styles.modeCardText}>
              <Text style={styles.modeCardTitle}>Scan Your Pantry</Text>
              <Text style={styles.modeCardBody}>
                Take a photo of your fridge, pantry, or spice rack — we'll flag what you may already have on your shopping list.
              </Text>
            </View>
            <Text style={styles.modeChevron}>›</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Recipe Scanner ───────────────────────────
  if (mode === 'recipe') {
    if (recipeStep === 'loading') {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingTitle}>Checking your recipe…</Text>
            <Text style={styles.loadingBody}>Scoring ingredients against your Low-FODMAP protocol</Text>
          </View>
        </SafeAreaView>
      );
    }

    if (recipeStep === 'results') {
      const flagged = DEMO_RECIPE_RESULTS.filter(r => r.type === 'crossed').length;
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={resetAll}>
              <Text style={styles.backBtn}>‹ Scan</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Recipe Results</Text>
          </View>

          {/* Summary banner */}
          <View style={styles.summaryBanner}>
            <Text style={styles.summaryText}>
              <Text style={styles.summaryHighlight}>{flagged} ingredient{flagged !== 1 ? 's' : ''} flagged</Text>
              {' '}— swaps suggested below
            </Text>
            <View style={styles.protocolChip}>
              <Text style={styles.protocolChipText}>Low-FODMAP</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.resultsContent}>
            {DEMO_RECIPE_RESULTS.map((item, i) => {
              if (item.type === 'crossed') {
                return (
                  <View key={i} style={[styles.resultRow, styles.resultRowCrossed]}>
                    <View style={[styles.resultDot, styles.resultDotRed]} />
                    <View style={styles.resultRowBody}>
                      <View style={styles.resultRowTop}>
                        <Text style={[styles.resultQty, styles.resultQtyCrossed]}>{item.qty}</Text>
                        <Text style={[styles.resultName, styles.resultNameCrossed]}>{item.name}</Text>
                      </View>
                      <Text style={styles.resultSwapNote}>{item.swapNote}</Text>
                    </View>
                  </View>
                );
              }
              if (item.type === 'swap') {
                return (
                  <View key={i} style={[styles.resultRow, styles.resultRowSwap]}>
                    <View style={[styles.resultDot, styles.resultDotGold]} />
                    <View style={styles.resultRowBody}>
                      <View style={styles.resultRowTop}>
                        <Text style={[styles.resultQty, styles.resultQtySwap]}>{item.qty}</Text>
                        <Text style={[styles.resultName, styles.resultNameSwap]}>{item.name}</Text>
                      </View>
                      <Text style={styles.resultSwapFor}>Swap for {item.swapFor}</Text>
                    </View>
                  </View>
                );
              }
              return (
                <View key={i} style={styles.resultRow}>
                  <View style={[styles.resultDot, styles.resultDotGreen]} />
                  <View style={styles.resultRowBody}>
                    <View style={styles.resultRowTop}>
                      <Text style={styles.resultQty}>{item.qty}</Text>
                      <Text style={styles.resultName}>{item.name}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      );
    }

    // Recipe input
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAll}>
            <Text style={styles.backBtn}>‹ Scan</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan a Recipe</Text>
        </View>

        <ScrollView contentContainerStyle={styles.inputBody}>
          {/* Input method tabs */}
          <View style={styles.methodTabs}>
            {(['url', 'photo', 'manual'] as InputMethod[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.methodTab, inputMethod === m && styles.methodTabActive]}
                onPress={() => setInputMethod(m)}
                activeOpacity={0.8}
              >
                <Text style={[styles.methodTabText, inputMethod === m && styles.methodTabTextActive]}>
                  {m === 'url' ? 'Paste URL' : m === 'photo' ? 'Photo' : 'Paste Text'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* URL input */}
          {inputMethod === 'url' && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Recipe URL</Text>
              <TextInput
                style={styles.textInput}
                placeholder="https://..."
                placeholderTextColor={Colors.textMuted}
                value={urlText}
                onChangeText={setUrlText}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <Text style={styles.inputHint}>Paste any recipe link — blog, food site, or social media</Text>
            </View>
          )}

          {/* Photo input */}
          {inputMethod === 'photo' && (
            <View style={styles.inputSection}>
              <TouchableOpacity style={styles.photoUpload} activeOpacity={0.8}>
                <Text style={styles.photoUploadIcon}>📷</Text>
                <Text style={styles.photoUploadLabel}>Take a Photo</Text>
                <Text style={styles.photoUploadSub}>or tap to choose from library</Text>
              </TouchableOpacity>
              <Text style={styles.inputHint}>Photo of a printed recipe, cookbook page, or screen</Text>
            </View>
          )}

          {/* Manual paste */}
          {inputMethod === 'manual' && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Ingredient List</Text>
              <TextInput
                style={[styles.textInput, styles.textInputMulti]}
                placeholder={'2 lbs chicken breast\n3 cloves garlic\n1 tbsp olive oil\n…'}
                placeholderTextColor={Colors.textMuted}
                value={manualText}
                onChangeText={setManualText}
                multiline
                numberOfLines={8}
                textAlignVertical="top"
              />
              <Text style={styles.inputHint}>Copy/paste the ingredient list, one item per line</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.scanBtn,
              (inputMethod === 'url' && !urlText) ||
              (inputMethod === 'manual' && !manualText)
                ? styles.scanBtnDisabled
                : null,
            ]}
            onPress={simulateRecipeScan}
            activeOpacity={0.85}
          >
            <Text style={styles.scanBtnText}>Check This Recipe</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Pantry Scanner ───────────────────────────
  if (mode === 'pantry') {
    if (pantryStep === 'loading') {
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.gold} />
            <Text style={styles.loadingTitle}>Scanning your pantry…</Text>
            <Text style={styles.loadingBody}>Identifying ingredients and checking your shopping list</Text>
          </View>
        </SafeAreaView>
      );
    }

    if (pantryStep === 'results') {
      const matched = DEMO_PANTRY_RESULTS.filter(r => r.matched);
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={resetAll}>
              <Text style={styles.backBtn}>‹ Scan</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Pantry Check</Text>
          </View>

          <View style={styles.summaryBanner}>
            <Text style={styles.summaryText}>
              <Text style={styles.summaryHighlight}>{matched.length} item{matched.length !== 1 ? 's' : ''}</Text>
              {' '}may already be at home
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.resultsContent}>
            <Text style={styles.sectionLabel}>Your Shopping List</Text>
            {DEMO_PANTRY_RESULTS.map((item, i) => {
              const toggle = pantryToggles[item.name];
              const haveIt = toggle === true;
              const dontHave = toggle === false;

              return (
                <View
                  key={i}
                  style={[
                    styles.pantryRow,
                    item.matched && toggle == null && styles.pantryRowHighlighted,
                    haveIt && styles.pantryRowHaveIt,
                  ]}
                >
                  <View style={styles.pantryRowLeft}>
                    <Text style={[styles.pantryItemName, haveIt && styles.pantryItemNameCrossed]}>
                      {item.name}
                    </Text>
                    {item.matched && toggle == null && (
                      <Text style={styles.pantryMatchLabel}>You may already have this at home</Text>
                    )}
                    {haveIt && (
                      <Text style={styles.pantryHaveLabel}>Removed from list</Text>
                    )}
                  </View>

                  {(item.matched || toggle != null) && (
                    <View style={styles.pantryToggle}>
                      <TouchableOpacity
                        style={[styles.pantryToggleBtn, haveIt && styles.pantryToggleBtnActive]}
                        onPress={() => togglePantryItem(item.name, true)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.pantryToggleBtnText, haveIt && styles.pantryToggleBtnTextActive]}>
                          Already Have
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.pantryToggleBtn, dontHave && styles.pantryToggleBtnActiveNeg]}
                        onPress={() => togglePantryItem(item.name, false)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.pantryToggleBtnText, dontHave && styles.pantryToggleBtnTextActive]}>
                          Don't Have
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      );
    }

    // Pantry input
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAll}>
            <Text style={styles.backBtn}>‹ Scan</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan Your Pantry</Text>
        </View>

        <ScrollView contentContainerStyle={styles.inputBody}>
          <Text style={styles.inputDescription}>
            Take a photo of your fridge, pantry, or spice rack. We'll identify what you have and flag items on your shopping list that you may not need to buy.
          </Text>

          <TouchableOpacity style={styles.photoUploadLarge} activeOpacity={0.8}>
            <Text style={styles.photoUploadIconLarge}>📷</Text>
            <Text style={styles.photoUploadLabel}>Take a Photo</Text>
            <Text style={styles.photoUploadSub}>or tap to choose from library</Text>
          </TouchableOpacity>

          <Text style={styles.inputHint}>You can take multiple photos — fridge, pantry, and spice rack separately</Text>

          <TouchableOpacity style={styles.scanBtn} onPress={simulatePantryScan} activeOpacity={0.85}>
            <Text style={styles.scanBtnText}>Scan My Pantry</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 2,
  },
  backBtn: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textPrimary,
  },

  // ── Entry ──
  entryBody: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 14,
  },
  entrySubtitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 18,
  },
  modeIcon: { fontSize: 28 },
  modeCardText: { flex: 1, gap: 4 },
  modeCardTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 16,
    color: Colors.textPrimary,
  },
  modeCardBody: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  modeChevron: {
    fontFamily: Fonts.body,
    fontSize: 22,
    color: Colors.textMuted,
  },

  // ── Loading ──
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  loadingTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  loadingBody: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Summary banner ──
  summaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  summaryText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  summaryHighlight: {
    fontFamily: Fonts.bodyMedium,
    color: Colors.textPrimary,
  },
  protocolChip: {
    backgroundColor: Colors.diet.LF + '22',
    borderWidth: 1,
    borderColor: Colors.diet.LF + '55',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  protocolChipText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.diet.LF,
  },

  // ── Results ──
  resultsContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 2,
  },
  sectionLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultRowCrossed: {
    backgroundColor: 'rgba(201,107,107,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginHorizontal: -10,
  },
  resultRowSwap: {
    backgroundColor: 'rgba(212,168,67,0.08)',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginHorizontal: -10,
  },
  resultDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  resultDotGreen: { backgroundColor: Colors.green },
  resultDotRed:   { backgroundColor: Colors.red },
  resultDotGold:  { backgroundColor: Colors.gold },

  resultRowBody: { flex: 1, gap: 2 },
  resultRowTop:  { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
  resultQty: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    minWidth: 40,
  },
  resultQtyCrossed: {
    color: Colors.red,
    textDecorationLine: 'line-through',
  },
  resultQtySwap: { color: Colors.gold },
  resultName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
  },
  resultNameCrossed: {
    color: Colors.red,
    textDecorationLine: 'line-through',
  },
  resultNameSwap: { color: Colors.gold },
  resultSwapNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.red,
    lineHeight: 17,
    opacity: 0.85,
  },
  resultSwapFor: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.gold,
    opacity: 0.85,
  },

  // ── Input ──
  inputBody: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 20,
  },
  inputDescription: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  methodTabs: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  methodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  methodTabActive: {
    backgroundColor: Colors.surfaceElevated,
  },
  methodTabText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },
  methodTabTextActive: {
    color: Colors.textPrimary,
    fontFamily: Fonts.bodyMedium,
  },

  inputSection: { gap: 8 },
  inputLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  textInputMulti: {
    minHeight: 160,
    paddingTop: 14,
  },
  inputHint: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },

  photoUpload: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    gap: 6,
  },
  photoUploadLarge: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    borderStyle: 'dashed',
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  photoUploadIcon:     { fontSize: 28 },
  photoUploadIconLarge:{ fontSize: 40 },
  photoUploadLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  photoUploadSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },

  scanBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  scanBtnDisabled: {
    opacity: 0.35,
  },
  scanBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 15,
    color: '#000',
  },

  // ── Pantry results ──
  pantryRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  pantryRowHighlighted: {
    backgroundColor: 'rgba(212,168,67,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: -12,
    borderBottomWidth: 0,
    marginBottom: 2,
  },
  pantryRowHaveIt: {
    opacity: 0.45,
  },
  pantryRowLeft: { gap: 3 },
  pantryItemName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.textPrimary,
  },
  pantryItemNameCrossed: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  pantryMatchLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.gold,
  },
  pantryHaveLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
  },
  pantryToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  pantryToggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pantryToggleBtnActive: {
    backgroundColor: Colors.gold,
    borderColor: Colors.gold,
  },
  pantryToggleBtnActiveNeg: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.borderActive,
  },
  pantryToggleBtnText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
  },
  pantryToggleBtnTextActive: {
    color: '#000',
    fontFamily: Fonts.bodyMedium,
  },
});
