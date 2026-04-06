/**
 * ScanScreen — Scan Tab
 *
 * Mode 1: Recipe Scanner — paste URL / photo / manual text → diet compliance check
 * Mode 2: Pantry Scanner — photo of fridge/pantry → cross-reference shopping list
 */

import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import { scanRecipePhoto, scanPantryPhoto, ExtractedIngredient, PantryItem } from '../../lib/gemini';

// expo-image-picker is mobile-only — lazy import to avoid web build errors
const ImagePicker = Platform.OS !== 'web'
  ? require('expo-image-picker')
  : null;

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

type Mode        = null | 'recipe' | 'pantry';
type RecipeStep  = 'input' | 'loading' | 'results';
type PantryStep  = 'input' | 'loading' | 'results';
type InputMethod = 'url' | 'photo' | 'manual';

interface ScoredIngredient {
  name:      string;
  qty:       string;
  type:      'normal' | 'crossed' | 'swap';
  swapNote?: string;
  swapFor?:  string;
}

interface PantryResult {
  name:    string;
  matched: boolean;
}

// ─────────────────────────────────────────────
//  Compliance scoring (rules-based, Phase 1)
//  Full Claude API hybrid scoring wired in Phase 2
// ─────────────────────────────────────────────

const FLAGGED_LOWFODMAP: Record<string, string> = {
  garlic:            'High fructans → use garlic-infused oil',
  onion:             'High FODMAP → use leek greens only',
  'wheat flour':     'Contains gluten → omit or use rice flour',
  'all-purpose flour':'Contains gluten → use rice flour',
  honey:             'High fructose → use maple syrup',
  apple:             'High sorbitol → use strawberries',
  milk:              'High lactose → use lactose-free milk',
};

const SWAP_NAMES: Record<string, string> = {
  garlic:             'garlic-infused oil',
  onion:              'leek greens',
  'wheat flour':      'rice flour',
  'all-purpose flour':'rice flour',
  honey:              'maple syrup',
  apple:              'strawberries',
  milk:               'lactose-free milk',
};

function scoreIngredients(ingredients: ExtractedIngredient[]): ScoredIngredient[] {
  const result: ScoredIngredient[] = [];
  const addedSwaps = new Set<string>();

  for (const ing of ingredients) {
    const key = Object.keys(FLAGGED_LOWFODMAP).find(k => ing.name.includes(k));
    if (key) {
      result.push({ name: ing.name, qty: ing.qty, type: 'crossed', swapNote: FLAGGED_LOWFODMAP[key] });
      const swapName = SWAP_NAMES[key];
      if (swapName && !addedSwaps.has(swapName)) {
        addedSwaps.add(swapName);
        result.push({ name: swapName, qty: ing.qty, type: 'swap', swapFor: ing.name });
      }
    } else {
      result.push({ name: ing.name, qty: ing.qty, type: 'normal' });
    }
  }

  return result;
}

// ─────────────────────────────────────────────
//  Main Screen
// ─────────────────────────────────────────────

export default function ScanScreen() {
  const [mode, setMode]                   = useState<Mode>(null);
  const [recipeStep, setRecipeStep]       = useState<RecipeStep>('input');
  const [pantryStep, setPantryStep]       = useState<PantryStep>('input');
  const [inputMethod, setInputMethod]     = useState<InputMethod>('url');
  const [urlText, setUrlText]             = useState('');
  const [manualText, setManualText]       = useState('');
  const [recipeImageUri, setRecipeImageUri] = useState<string | null>(null);
  const [pantryImageUri, setPantryImageUri] = useState<string | null>(null);
  const [recipeResults, setRecipeResults] = useState<ScoredIngredient[]>([]);
  const [pantryResults, setPantryResults] = useState<PantryResult[]>([]);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);
  const [pantryToggles, setPantryToggles] = useState<Record<string, boolean | null>>({});

  // Web file input refs
  const recipeFileInputRef = useRef<any>(null);
  const pantryFileInputRef = useRef<any>(null);

  function handleWebFileSelect(target: 'recipe' | 'pantry', e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    const uri = URL.createObjectURL(file);
    if (target === 'recipe') setRecipeImageUri(uri);
    else setPantryImageUri(uri);
  }

  function resetAll() {
    setMode(null);
    setRecipeStep('input');
    setPantryStep('input');
    setUrlText('');
    setManualText('');
    setRecipeImageUri(null);
    setPantryImageUri(null);
    setRecipeResults([]);
    setPantryResults([]);
    setErrorMsg(null);
    setPantryToggles({});
  }

  async function pickImage(target: 'recipe' | 'pantry') {
    if (Platform.OS === 'web') {
      const ref = target === 'recipe' ? recipeFileInputRef : pantryFileInputRef;
      ref.current?.click();
      return;
    }
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { setErrorMsg('Photo library permission is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      if (target === 'recipe') setRecipeImageUri(result.assets[0].uri);
      else setPantryImageUri(result.assets[0].uri);
    }
  }

  async function takePhoto(target: 'recipe' | 'pantry') {
    if (Platform.OS === 'web') {
      // On web, camera access via file input with capture attribute
      const ref = target === 'recipe' ? recipeFileInputRef : pantryFileInputRef;
      if (ref.current) {
        ref.current.setAttribute('capture', 'environment');
        ref.current.click();
      }
      return;
    }
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setErrorMsg('Camera permission is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      if (target === 'recipe') setRecipeImageUri(result.assets[0].uri);
      else setPantryImageUri(result.assets[0].uri);
    }
  }

  async function runRecipeScan() {
    setErrorMsg(null);
    setRecipeStep('loading');
    try {
      let ingredients: ExtractedIngredient[] = [];

      if (inputMethod === 'photo' && recipeImageUri) {
        ingredients = await scanRecipePhoto(recipeImageUri);
      } else if (inputMethod === 'manual' && manualText.trim()) {
        // Parse manual text — one ingredient per line
        ingredients = manualText.trim().split('\n').filter(Boolean).map(line => {
          const raw  = line.trim();
          // Split on first word boundary after leading qty tokens
          // e.g. "1 and 1/2 teaspoons cornstarch" → qty="1 and 1/2 teaspoons", name="cornstarch"
          const qtyUnits = /^([\d\/\s¼½¾⅓⅔.]+(?:and\s+[\d\/]+\s+)?\s*(?:teaspoons?|tablespoons?|tbsp|tsp|cups?|oz|lbs?|g|kg|cloves?|medium|large|small|pinch)?)\s+/i;
          const match = raw.match(qtyUnits);
          const qty  = match ? match[1].trim() : '';
          const name = (match ? raw.slice(match[0].length) : raw).toLowerCase()
            .replace(/\s*[\(\*].*$/, '') // strip parenthetical notes and asterisks
            .trim();
          return { raw, name, qty };
        });
      } else if (inputMethod === 'url' && urlText.trim()) {
        // URL extraction — Phase 2 (server-side scrape)
        // For now, show a friendly message
        setErrorMsg('URL scanning coming soon — use Photo or Paste Text for now.');
        setRecipeStep('input');
        return;
      }

      if (ingredients.length === 0) {
        setErrorMsg('No ingredients found. Try a clearer photo or paste the list manually.');
        setRecipeStep('input');
        return;
      }

      const scored = scoreIngredients(ingredients);
      setRecipeResults(scored);
      setRecipeStep('results');
    } catch (e: any) {
      console.error('[ScanScreen] runRecipeScan error', e);
      if (e?.message === 'GEMINI_KEY_MISSING') {
        setErrorMsg('API key not configured. Check Vercel environment variables.');
      } else {
        setErrorMsg(`Error: ${e?.message ?? 'Unknown error'}`);
      }
      setRecipeStep('input');
    }
  }

  async function runPantryScan() {
    if (!pantryImageUri) return;
    setErrorMsg(null);
    setPantryStep('loading');
    try {
      const items: PantryItem[] = await scanPantryPhoto(pantryImageUri);

      // Mock shopping list to cross-reference against
      // Phase 2: pull from Firestore shopping list
      const shoppingList = [
        'olive oil', 'chicken breast', 'lemon juice',
        'fresh thyme', 'garlic', 'onion', 'rice flour',
      ];

      const results: PantryResult[] = shoppingList.map(listItem => ({
        name:    listItem,
        matched: items.some(i => i.name.includes(listItem) || listItem.includes(i.name)),
      }));

      setPantryResults(results);
      setPantryStep('results');
    } catch (e) {
      console.error('[ScanScreen] runPantryScan error', e);
      setErrorMsg('Something went wrong. Please try again.');
      setPantryStep('input');
    }
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
                Upload a photo or paste an ingredient list — we'll score it against your diet protocol.
              </Text>
            </View>
            <Text style={styles.modeChevron}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => setMode('pantry')} activeOpacity={0.8}>
            <Text style={styles.modeIcon}>🧊</Text>
            <View style={styles.modeCardText}>
              <Text style={styles.modeCardTitle}>Scan Your Pantry</Text>
              <Text style={styles.modeCardBody}>
                Take a photo of your fridge, pantry, or spice rack — we'll flag what you may already have.
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
      const flagged = recipeResults.filter(r => r.type === 'crossed').length;
      return (
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={resetAll}>
              <Text style={styles.backBtn}>‹ Scan</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Recipe Results</Text>
          </View>

          <View style={styles.summaryBanner}>
            <Text style={styles.summaryText}>
              <Text style={styles.summaryHighlight}>
                {flagged === 0 ? 'All clear' : `${flagged} ingredient${flagged !== 1 ? 's' : ''} flagged`}
              </Text>
              {flagged > 0 ? ' — swaps suggested below' : ' — this recipe is compatible'}
            </Text>
            <View style={styles.protocolChip}>
              <Text style={styles.protocolChipText}>Low-FODMAP</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.resultsContent}>
            {recipeResults.map((item, i) => {
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
    const canScan =
      (inputMethod === 'photo' && recipeImageUri != null) ||
      (inputMethod === 'manual' && manualText.trim().length > 0) ||
      (inputMethod === 'url' && urlText.trim().length > 0);

    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={resetAll}>
            <Text style={styles.backBtn}>‹ Scan</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Scan a Recipe</Text>
        </View>

        <ScrollView contentContainerStyle={styles.inputBody}>
          {errorMsg && <Text style={styles.errorMsg}>{errorMsg}</Text>}

          {/* Input method tabs */}
          <View style={styles.methodTabs}>
            {(['url', 'photo', 'manual'] as InputMethod[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.methodTab, inputMethod === m && styles.methodTabActive]}
                onPress={() => { setInputMethod(m); setErrorMsg(null); }}
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
              <Text style={styles.inputHint}>URL scanning coming soon — use Photo or Paste Text for now</Text>
            </View>
          )}

          {/* Photo input */}
          {inputMethod === 'photo' && (
            <View style={styles.inputSection}>
              {recipeImageUri ? (
                <View style={styles.imagePreviewWrap}>
                  <Text style={styles.imagePreviewLabel}>Photo selected ✓</Text>
                  <TouchableOpacity onPress={() => setRecipeImageUri(null)}>
                    <Text style={styles.imageRemoveBtn}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.photoOptions}>
                  {Platform.OS === 'web' && (
                    <input
                      ref={recipeFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e: any) => handleWebFileSelect('recipe', e)}
                    />
                  )}
                  <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto('recipe')} activeOpacity={0.8}>
                    <Text style={styles.photoBtnIcon}>📷</Text>
                    <Text style={styles.photoBtnLabel}>Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage('recipe')} activeOpacity={0.8}>
                    <Text style={styles.photoBtnIcon}>🖼️</Text>
                    <Text style={styles.photoBtnLabel}>Choose from Library</Text>
                  </TouchableOpacity>
                </View>
              )}
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
            style={[styles.scanBtn, !canScan && styles.scanBtnDisabled]}
            onPress={runRecipeScan}
            disabled={!canScan}
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
      const matched = pantryResults.filter(r => r.matched);
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
              <Text style={styles.summaryHighlight}>
                {matched.length} item{matched.length !== 1 ? 's' : ''}
              </Text>
              {' '}may already be at home
            </Text>
          </View>

          <ScrollView contentContainerStyle={styles.resultsContent}>
            <Text style={styles.sectionLabel}>Your Shopping List</Text>
            {pantryResults.map((item, i) => {
              const toggle   = pantryToggles[item.name];
              const haveIt   = toggle === true;
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
          {errorMsg && <Text style={styles.errorMsg}>{errorMsg}</Text>}

          <Text style={styles.inputDescription}>
            Take a photo of your fridge, pantry, or spice rack. We'll identify what you have and flag items on your shopping list that you may not need to buy.
          </Text>

          {pantryImageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Text style={styles.imagePreviewLabel}>Photo selected ✓</Text>
              <TouchableOpacity onPress={() => setPantryImageUri(null)}>
                <Text style={styles.imageRemoveBtn}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.photoOptions}>
              {Platform.OS === 'web' && (
                <input
                  ref={pantryFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e: any) => handleWebFileSelect('pantry', e)}
                />
              )}
              <TouchableOpacity style={styles.photoBtn} onPress={() => takePhoto('pantry')} activeOpacity={0.8}>
                <Text style={styles.photoBtnIcon}>📷</Text>
                <Text style={styles.photoBtnLabel}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => pickImage('pantry')} activeOpacity={0.8}>
                <Text style={styles.photoBtnIcon}>🖼️</Text>
                <Text style={styles.photoBtnLabel}>Choose from Library</Text>
              </TouchableOpacity>
            </View>
          )}

          <Text style={styles.inputHint}>You can scan your fridge, pantry, and spice rack separately</Text>

          <TouchableOpacity
            style={[styles.scanBtn, !pantryImageUri && styles.scanBtnDisabled]}
            onPress={runPantryScan}
            disabled={!pantryImageUri}
            activeOpacity={0.85}
          >
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

  errorMsg: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.red,
    backgroundColor: 'rgba(201,107,107,0.1)',
    borderRadius: 8,
    padding: 12,
    lineHeight: 19,
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
  resultRowBody:  { flex: 1, gap: 2 },
  resultRowTop:   { flexDirection: 'row', gap: 8, alignItems: 'baseline' },
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
  methodTabActive: { backgroundColor: Colors.surfaceElevated },
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

  // ── Photo picker ──
  photoOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 28,
    alignItems: 'center',
    gap: 8,
  },
  photoBtnIcon:  { fontSize: 28 },
  photoBtnLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  imagePreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.green + '55',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  imagePreviewLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.green,
  },
  imageRemoveBtn: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textMuted,
  },

  // ── Scan button ──
  scanBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  scanBtnDisabled: { opacity: 0.35 },
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
  pantryRowHaveIt: { opacity: 0.45 },
  pantryRowLeft:   { gap: 3 },
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
