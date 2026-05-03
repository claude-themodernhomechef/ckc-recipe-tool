/**
 * ShopScreen — Phase 1F + Phase 6 scaffold
 *
 * ─ Pulls recipes from MenuContext (auto-synced from MealPlanScreen)
 * ─ Free users: max 2 entrees / 6 total (manual adds only)
 * ─ Instacart button (green) always visible top-right
 * ─ Pre-checkout confirmation sheet:
 *     order summary → organic preference → "Confirm & Open Instacart"
 *     Selection saves back to organicPreference (profile default going forward)
 */

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SectionList, Share, Platform, Modal, FlatList, TextInput,
  Image, Linking, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import EmptyState from '../components/EmptyState';
import PremiumGate from '../components/PremiumGate';
import DietTag from '../components/DietTag';
import { useMenu, OrganicPreference } from '../../context/MenuContext';
import { useUser } from '../../context/UserContext';
import { SAMPLE_RECIPES, Recipe } from '../../data/sampleRecipes';
import { fetchRecipesByIds } from '../../lib/firestore';
import {
  parseIngredient, fmtQty, fmtNum, getDairyGroup,
  SHOPPING_CATEGORIES, normalizeProtein, splitIngredientLine,
} from '../../lib/ingredientParser';

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const INSTACART_GREEN = '#43B02A';

// ── Protocol metadata ────────────────────────────────────────────────────────
// Keys match both profile.protocols[] values and recipe dietTags keys exactly.

const PROTOCOL_META: Record<string, { label: string; color: string }> = {
  AIP: { label: 'AIP',         color: Colors.diet.AIP },
  LF:  { label: 'Low-FODMAP',  color: Colors.diet.LF  },
  K:   { label: 'Keto',        color: Colors.diet.K   },
  GF:  { label: 'Gluten-Free', color: Colors.diet.GF  },
  DF:  { label: 'Dairy-Free',  color: Colors.diet.DF  },
  V:   { label: 'Vegan',        color: Colors.diet.V   },
  Vg:  { label: 'Vegetarian',  color: Colors.diet.Vg  },
  LH:  { label: 'Low-Histamine', color: Colors.diet.LH },
};

const ORGANIC_OPTIONS: { value: OrganicPreference; label: string; sublabel: string }[] = [
  {
    value:    'conventional',
    label:    'Conventional',
    sublabel: 'Standard grocery items',
  },
  {
    value:    'dirty-dozen',
    label:    'Dirty Dozen',
    sublabel: 'Organic on high-pesticide produce',
  },
  {
    value:    'all-organic',
    label:    'All Organic',
    sublabel: 'Organic wherever available',
  },
];

const SERVING_STEPS = [0.5, 1, 2, 3, 4, 5];

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface AggregatedEntry {
  name:          string;
  unitQtys:      Record<string, number>;
  category:      string;
  sources:       string[];
  // Swap metadata — set when diet mode is active
  _itemType?:    'normal' | 'swap' | 'crossed' | 'reverted';
  _swapName?:    string;    // for 'crossed': the ingredient that replaces this
  _swapFor?:     string;    // for 'swap': the original ingredient this replaces
  _swapRecipe?:  string;    // which recipe required this swap
  _swapProtocol?:string;
  _swapColor?:   string;
}

interface SectionData {
  title: string;
  key:   string;
  data:  AggregatedEntry[];
}

interface RecipeMod {
  recipeId:   string;
  recipeName: string;
  mods: { protocol: string; label: string; notes: string; color: string }[];
}

// ─────────────────────────────────────────────
//  Ingredient helpers
// ─────────────────────────────────────────────

function expandEachLine(raw: string): string[] {
  const m = raw.match(/^((?:[\d\s/½¼¾⅓⅔.]+\s*(?:tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g|ml)\.?\s+)?)each[:\s]+(.+)$/i);
  if (!m) return [raw];
  const qty = m[1].trim();
  const rest = m[2].trim();
  if (!/[,;&]|\band\b/i.test(rest)) return [raw];
  const items = rest.split(/[,;]|\band\b/i).map((s: string) => s.trim()).filter(Boolean);
  if (items.length <= 1) return [raw];
  return items.map((item: string) => qty ? `${qty} ${item}` : item);
}

// ─────────────────────────────────────────────
//  Ingredient aggregation
// ─────────────────────────────────────────────

function aggregateIngredients(
  menuItems: { recipeId: string; recipeName: string; servings: number }[],
  allRecipes: Recipe[],
): Map<string, AggregatedEntry> {
  const agg = new Map<string, AggregatedEntry>();

  for (const menuItem of menuItems) {
    const recipe = allRecipes.find(
      r => r.id === menuItem.recipeId || r.name === menuItem.recipeName,
    );
    if (!recipe) continue;

    const scale = menuItem.servings;

    for (const ingRaw of recipe.ingredients) {
      // Expand "each:" lines and comma-joined ingredient lines
      // e.g. "¼ tsp each: paprika, thyme" → ["¼ tsp paprika", "¼ tsp thyme"]
      // e.g. "steamed rice, naan for serving" → ["steamed rice", "naan for serving"]
      const ingsToProcess: (typeof ingRaw)[] = typeof ingRaw === 'string'
        ? expandEachLine(ingRaw).flatMap(splitIngredientLine)
        : [ingRaw];
      for (const ing of ingsToProcess) {
      // Sample data has string[] ingredients; Firestore data will have structured objects.
      // Handle both gracefully.
      let parsed;
      if (typeof ing === 'string') {
        parsed = parseIngredient(ing);
      } else {
        const structured = ing as { name: string; quantity: number; unit: string };
        parsed = {
          qty:      structured.quantity ?? 1,
          unit:     structured.unit === 'pieces' ? '' : (structured.unit ?? ''),
          name:     structured.name.toLowerCase(),
          category: 'pantry-staples',
          raw:      `${structured.quantity} ${structured.unit} ${structured.name}`,
        };
      }

      if (!parsed.name) continue;

      const key       = parsed.name;
      const scaledQty = parsed.qty * scale;
      const unit      = parsed.unit || 'count';

      if (agg.has(key)) {
        const entry = agg.get(key)!;
        entry.unitQtys[unit] = (entry.unitQtys[unit] || 0) + scaledQty;
        if (!entry.sources.includes(menuItem.recipeName)) {
          entry.sources.push(menuItem.recipeName);
        }
      } else {
        agg.set(key, {
          name:     key,
          unitQtys: { [unit]: scaledQty },
          category: parsed.category,
          sources:  [menuItem.recipeName],
        });
      }
      } // end expandEachLine loop
    }
  }

  // Remove sub-components already covered by a compound entry in the same category.
  // e.g. if "salt and pepper" exists, remove standalone "salt" and "pepper".
  const allNames = [...agg.keys()];
  for (const name of allNames) {
    const entry = agg.get(name)!;
    const coveredByCompound = allNames.some(other =>
      other !== name &&
      agg.get(other)?.category === entry.category &&
      other.length > name.length &&
      new RegExp(`(?:^|\\s|and|&)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|and|&|$)`, 'i').test(other)
    );
    if (coveredByCompound) agg.delete(name);
  }

  return agg;
}

function formatEntry(entry: AggregatedEntry): string {
  const parts = Object.entries(entry.unitQtys)
    .filter(([, q]) => q > 0)
    .map(([u, q]) => {
      if (u === 'count') return fmtNum(q);
      return fmtQty(q, u, entry.category);
    });
  return parts.join(' + ');
}

function capFirst(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Strip leading quantities like "6 Tbsp", "1 1/2 tsp", "2" from ingredient references in swap notes
function stripLeadingQty(s: string): string {
  return s
    .replace(/^[\d\s/½¼¾⅓⅔.]+\s*(tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g|ml|pounds?|ounces?)\.?\s*/i, '')
    .replace(/\s+entirely\s*$/i, '')
    .trim();
}

// Extract the leading quantity string (e.g. "6 Tbsp") without stripping it
function extractLeadingQty(s: string): string {
  const m = s.match(/^([\d\s/½¼¾⅓⅔.]+\s*(?:tbsp|tsp|tablespoons?|teaspoons?|cups?|oz|lb|g|ml|pounds?|ounces?)\.?)\s*/i);
  return m ? m[1].trim() : '';
}

// Parses free-text swap notes into explicit (from → to) pairs
function parseSwapPairs(notes: string): Array<{ from: string; to: string | null }> {
  const result: Array<{ from: string; to: string | null }> = [];
  const s = notes.toLowerCase();

  // "Use X instead of Y" → { from: Y, to: X }
  const insteadRe = /use\s+(.+?)\s+instead\s+of\s+(.+?)(?:[,.]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = insteadRe.exec(s)) !== null) {
    const rawFrom = m[2].trim();
    const rawTo   = m[1].trim();
    const qty     = extractLeadingQty(rawFrom);
    const to      = (qty && !extractLeadingQty(rawTo)) ? `${qty} ${rawTo}` : rawTo;
    result.push({ from: stripLeadingQty(rawFrom), to });
  }

  // "Replace X (and Z) with Y" → multiple froms
  const replaceRe = /replace\s+(.+?)\s+with\s+(.+?)(?:[,.]|$)/gi;
  while ((m = replaceRe.exec(s)) !== null) {
    const rawTo    = m[2].trim();
    const toHasQty = extractLeadingQty(rawTo) !== '';
    m[1].split(/\s+and\s+/i).forEach(f => {
      const rawFrom = f.trim();
      const qty     = extractLeadingQty(rawFrom);
      const to      = (qty && !toHasQty) ? `${qty} ${rawTo}` : rawTo;
      result.push({ from: stripLeadingQty(rawFrom), to });
    });
  }

  // "Remove X (and Z)" → crossed out
  const removeRe = /remove\s+([^,.\n—–\u2013\u2014]+)/gi;
  while ((m = removeRe.exec(s)) !== null) {
    m[1].split(/\s+and\s+/i).forEach(f => {
      const clean = stripLeadingQty(f.trim());
      if (clean) result.push({ from: clean, to: null });
    });
  }

  // "Skip X" / "Omit X" → { from: X, to: null }
  const skipRe = /(?:skip|omit)\s+([^,.\n]+)/gi;
  while ((m = skipRe.exec(s)) !== null) {
    result.push({ from: stripLeadingQty(m[1].split(',')[0].trim()), to: null });
  }

  return result;
}

// Fuzzy-matches a parsed term against an ingredient list key
function fuzzyMatch(parsedTerm: string, ingredientName: string): boolean {
  const clean = (x: string) =>
    x.replace(/\b(cloves?|heads?|tbsp\s+of|tsp\s+of|cups?\s+of|\bof\b)\b/g, '')
     .replace(/\s+/g, ' ').trim();
  const a = clean(parsedTerm);
  const b = clean(ingredientName);
  // Also compare without spaces to handle "cornstarch" vs "corn starch"
  const aFlat = a.replace(/\s+/g, '');
  const bFlat = b.replace(/\s+/g, '');
  return b.includes(a) || a.includes(b) || bFlat.includes(aFlat) || aFlat.includes(bFlat);
}

// ─────────────────────────────────────────────
//  Protocol toggle bar
// ─────────────────────────────────────────────

function ProtocolToggleBar({
  protocols,
  enabled,
  onToggle,
}: {
  protocols: string[];
  enabled:   boolean;
  onToggle:  () => void;
}) {
  if (protocols.length === 0) return null;

  return (
    <TouchableOpacity
      style={[ptb.wrap, enabled && ptb.wrapActive]}
      onPress={onToggle}
      activeOpacity={0.85}
    >
      {/* Protocol chips */}
      <View style={ptb.chips}>
        {protocols.map(p => (
          <DietTag key={p} protocol={p} variant="circle" status="native" />
        ))}
      </View>

      {/* Toggle switch */}
      <View style={ptb.toggle}>
        <Text style={ptb.toggleLabel}>Diet Mode</Text>
        <View style={[ptb.track, enabled && ptb.trackActive]}>
          <View style={[ptb.thumb, enabled && ptb.thumbActive]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const ptb = StyleSheet.create({
  wrap: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderColor:       Colors.border,
    backgroundColor:   Colors.surface,
  },
  wrapActive: {
    backgroundColor: 'rgba(212,168,67,0.04)',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      100,
    borderWidth:       1,
  },
  chipText: { fontFamily: Fonts.bodyMedium, fontSize: 11 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 10 },
  toggleLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  track: {
    width: 36, height: 20, borderRadius: 10,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  trackActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  thumb: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.textMuted,
    alignSelf: 'flex-start',
  },
  thumbActive: { backgroundColor: '#000', alignSelf: 'flex-end' },
});

// ─────────────────────────────────────────────
//  Pre-checkout confirmation sheet
// ─────────────────────────────────────────────

interface CheckoutSheetProps {
  visible:           boolean;
  totalItems:        number;
  recipeCount:       number;
  organicPreference: OrganicPreference;
  onSelectOrganic:   (pref: OrganicPreference) => void;
  onConfirm:         () => void;
  onClose:           () => void;
}

function CheckoutSheet({
  visible,
  totalItems,
  recipeCount,
  organicPreference,
  onSelectOrganic,
  onConfirm,
  onClose,
}: CheckoutSheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={cs.overlay}>
        <TouchableOpacity style={cs.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={cs.sheet}>
          <View style={cs.handle} />

          {/* Header */}
          <View style={cs.header}>
            <View>
              <Text style={cs.title}>Ready to Order?</Text>
              <Text style={cs.subtitle}>
                {totalItems} items · {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={cs.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Organic preference */}
          <View style={cs.organicSection}>
            <Text style={cs.organicLabel}>PRODUCE PREFERENCE</Text>
            <View style={cs.organicOptions}>
              {ORGANIC_OPTIONS.map(opt => {
                const isActive = organicPreference === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[cs.organicOption, isActive && cs.organicOptionActive]}
                    onPress={() => onSelectOrganic(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[cs.organicRadio, isActive && cs.organicRadioActive]}>
                      {isActive && <View style={cs.organicRadioDot} />}
                    </View>
                    <View style={cs.organicText}>
                      <Text style={[cs.organicOptionLabel, isActive && cs.organicOptionLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={cs.organicOptionSub}>{opt.sublabel}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={cs.organicNote}>
              Your selection is saved as your default for future orders.
            </Text>
          </View>

          {/* Confirm button */}
          <View style={cs.footer}>
            <TouchableOpacity style={cs.confirmBtn} onPress={onConfirm} activeOpacity={0.85}>
              <Text style={cs.confirmBtnText}>Confirm & Open Instacart</Text>
            </TouchableOpacity>
            <Text style={cs.footerNote}>
              You'll be taken to Instacart to select your store and check out.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cs = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor:      Colors.surface,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    borderWidth:          1,
    borderBottomWidth:    0,
    borderColor:          Colors.border,
    paddingBottom:        36,
  },
  handle: {
    width:           36,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.border,
    alignSelf:       'center',
    marginTop:       10,
    marginBottom:    4,
  },

  // Header
  header: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical:   18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:    { fontFamily: Fonts.display, fontSize: 26, color: Colors.textPrimary },
  subtitle: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 3 },
  closeBtn: { fontSize: 18, color: Colors.textMuted, paddingTop: 4 },

  // Organic section
  organicSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  organicLabel: {
    fontFamily:    Fonts.bodyMedium,
    fontSize:      10,
    color:         Colors.textMuted,
    letterSpacing: 1,
    marginBottom:  12,
  },
  organicOptions: { gap: 8 },
  organicOption: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            12,
    padding:        14,
    borderRadius:   12,
    borderWidth:    1,
    borderColor:    Colors.border,
    backgroundColor:Colors.bg,
  },
  organicOptionActive: {
    borderColor:     INSTACART_GREEN,
    backgroundColor: 'rgba(67,176,42,0.06)',
  },
  organicRadio: {
    width:           20,
    height:          20,
    borderRadius:    10,
    borderWidth:     1.5,
    borderColor:     Colors.border,
    alignItems:      'center',
    justifyContent:  'center',
  },
  organicRadioActive:  { borderColor: INSTACART_GREEN },
  organicRadioDot: {
    width:           10,
    height:          10,
    borderRadius:    5,
    backgroundColor: INSTACART_GREEN,
  },
  organicText:           { flex: 1 },
  organicOptionLabel:    { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textSecondary },
  organicOptionLabelActive:{ color: Colors.textPrimary },
  organicOptionSub:      { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  organicNote: {
    fontFamily: Fonts.body,
    fontSize:   11,
    color:      Colors.textMuted,
    marginTop:  12,
    lineHeight: 16,
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop:        16,
    gap:               10,
  },
  confirmBtn: {
    backgroundColor: INSTACART_GREEN,
    borderRadius:    100,
    paddingVertical: 16,
    alignItems:      'center',
  },
  confirmBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize:   16,
    color:      '#fff',
    letterSpacing: 0.2,
  },
  footerNote: {
    fontFamily: Fonts.body,
    fontSize:   11,
    color:      Colors.textMuted,
    textAlign:  'center',
    lineHeight: 16,
  },
});

// ─────────────────────────────────────────────
//  Paywall modal
// ─────────────────────────────────────────────

function PaywallModal({ visible, isEntreeLimit, onClose }: {
  visible:        boolean;
  isEntreeLimit:  boolean;
  onClose:        () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={pw.overlay}>
        <TouchableOpacity style={pw.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={pw.card}>
          <Text style={pw.icon}>✦</Text>
          <Text style={pw.title}>
            {isEntreeLimit ? 'Upgrade for More Recipes' : 'Shopping List Limit Reached'}
          </Text>
          <Text style={pw.body}>
            {isEntreeLimit
              ? 'Free accounts can add up to 2 entree recipes to their shopping list. Upgrade to Premium for unlimited recipes and a full 7-day meal plan.'
              : 'Free accounts can add up to 6 recipes total. Upgrade to Premium to unlock unlimited shopping lists and the full meal planner.'}
          </Text>
          <TouchableOpacity style={pw.upgradeBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={pw.upgradeBtnText}>Upgrade to Premium</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={pw.dismissBtn}>
            <Text style={pw.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const pw = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius:    20,
    padding:         28,
    alignItems:      'center',
    gap:             12,
    borderWidth:     1,
    borderColor:     Colors.border,
    width:           '100%',
    maxWidth:        360,
  },
  icon:    { fontSize: 28, color: Colors.gold },
  title:   { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary, textAlign: 'center' },
  body:    { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  upgradeBtn: {
    backgroundColor: Colors.gold,
    borderRadius:    100,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop:       6,
    alignSelf:       'stretch',
    alignItems:      'center',
  },
  upgradeBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 15, color: '#000' },
  dismissBtn:     { paddingVertical: 6 },
  dismissText:    { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
});

// ─────────────────────────────────────────────
//  ShopScreen component
// ─────────────────────────────────────────────

export default function ShopScreen() {
  const {
    menuItems, checkedItems, addToMenu, removeFromMenu, setServings,
    toggleChecked, uncheckAll, clearMenu, isInMenu,
    organicPreference, setOrganicPreference,
    canAddEntree, canAddItem,
    revertedSwaps, toggleRevertedSwap, clearRevertedSwaps,
  } = useMenu();
  const { profile } = useUser();
  const isPaid = profile.tier === 'paid';

  const [hideChecked,     setHideChecked]     = useState(false);
  const [pickerVisible,   setPickerVisible]   = useState(false);
  const [pickerSearch,    setPickerSearch]    = useState('');
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [paywallVisible,  setPaywallVisible]  = useState(false);
  const [paywallEntree,   setPaywallEntree]   = useState(false);
  // Diet mode: default ON when user has active protocols
  const [dietModeEnabled, setDietModeEnabled] = useState(() => profile.protocols.length > 0);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>(SAMPLE_RECIPES);

  // Fetch the actual Firestore recipe docs for whatever's in the menu
  useEffect(() => {
    const ids = menuItems.map(m => m.recipeId).filter(Boolean);
    if (!ids.length) return;
    fetchRecipesByIds(ids).then(recipes => {
      if (recipes.length > 0) setAllRecipes(recipes);
    }).catch(() => {}); // silently fall back to SAMPLE_RECIPES
  }, [menuItems]);

  // ── Aggregate ingredients ────────────────────────────────────────────────────
  const aggregated = useMemo(() => aggregateIngredients(menuItems, allRecipes), [menuItems]);

  // ── Diet mode: collect modification notes per recipe ─────────────────────────
  const modificationNotes = useMemo((): RecipeMod[] => {
    if (!dietModeEnabled || profile.protocols.length === 0) return [];
    const result: RecipeMod[] = [];
    const seen = new Set<string>();

    for (const menuItem of menuItems) {
      if (seen.has(menuItem.recipeId)) continue;
      const recipe = allRecipes.find(
        r => r.id === menuItem.recipeId || r.name === menuItem.recipeName,
      );
      if (!recipe) continue;

      const mods = profile.protocols
        .map(p => {
          const tag = recipe.dietTags?.[p];
          if (!tag || tag.native || !tag.mod || !tag.notes.trim()) return null;
          const meta = PROTOCOL_META[p];
          return { protocol: p, label: meta?.label ?? p, notes: tag.notes, color: meta?.color ?? Colors.gold };
        })
        .filter(Boolean) as RecipeMod['mods'];

      if (mods.length > 0) {
        result.push({ recipeId: menuItem.recipeId, recipeName: menuItem.recipeName, mods });
        seen.add(menuItem.recipeId);
      }
    }
    return result;
  }, [dietModeEnabled, menuItems, allRecipes, profile.protocols]);

  // ── Build swap map from modification notes ───────────────────────────────────
  // Builds a map: original ingredient name → swap info
  // Derived from modification notes + free-text parsing
  const swapMap = useMemo((): Map<string, { to: string | null; recipe: string; protocol: string; color: string }> => {
    if (!dietModeEnabled || modificationNotes.length === 0) return new Map();
    const map = new Map<string, { to: string | null; recipe: string; protocol: string; color: string }>();

    for (const recipeMod of modificationNotes) {
      for (const mod of recipeMod.mods) {
        const pairs = parseSwapPairs(mod.notes);
        for (const pair of pairs) {
          // Find matching ingredient in aggregated list
          for (const ingName of aggregated.keys()) {
            if (!map.has(ingName) && fuzzyMatch(pair.from, ingName)) {
              map.set(ingName, {
                to:       pair.to,
                recipe:   recipeMod.recipeName,
                protocol: mod.protocol,
                color:    mod.color,
              });
            }
          }
        }
      }
    }
    return map;
  }, [dietModeEnabled, modificationNotes, aggregated]);

  // ── Build section list ───────────────────────────────────────────────────────
  const sections: SectionData[] = useMemo(() => {
    return SHOPPING_CATEGORIES.map(cat => {
      let items = [...aggregated.values()].filter(e => e.category === cat.key);

      if (cat.key === 'dairy') {
        items.sort((a, b) => getDairyGroup(a.name) - getDairyGroup(b.name) || a.name.localeCompare(b.name));
      } else {
        items.sort((a, b) => a.name.localeCompare(b.name));
      }

      if (cat.key === 'pantry-staples') {
        const knownKeys = new Set<string>(SHOPPING_CATEGORIES.map(c => c.key));
        const uncategorized = [...aggregated.values()].filter(e => !knownKeys.has(e.category));
        items = [...items, ...uncategorized].sort((a, b) => a.name.localeCompare(b.name));
      }

      // Inject swap metadata + swap replacement items
      const withSwaps: AggregatedEntry[] = [];
      for (const item of items) {
        const swapInfo = swapMap.get(item.name);
        const isReverted = revertedSwaps.has(item.name);

        if (swapInfo && !isReverted) {
          if (swapInfo.to) {
            // Has a replacement — show gold swap row
            withSwaps.push({
              name:          swapInfo.to,
              unitQtys:      {},
              category:      item.category,
              sources:       [swapInfo.recipe],
              _itemType:     'swap',
              _swapFor:      item.name,
              _swapRecipe:   swapInfo.recipe,
              _swapProtocol: swapInfo.protocol,
              _swapColor:    swapInfo.color,
            });
          } else {
            // No replacement — ingredient should be removed; show crossed out in red
            withSwaps.push({
              ...item,
              _itemType:     'crossed',
              _swapRecipe:   swapInfo.recipe,
              _swapProtocol: swapInfo.protocol,
              _swapColor:    swapInfo.color,
            });
          }
        } else if (swapInfo && isReverted) {
          // User reverted — show original ingredient with inactive toggle button
          withSwaps.push({
            ...item,
            _itemType:     'reverted',
            _swapName:     swapInfo.to ?? undefined,
            _swapRecipe:   swapInfo.recipe,
            _swapProtocol: swapInfo.protocol,
            _swapColor:    swapInfo.color,
          });
        } else {
          withSwaps.push({ ...item, _itemType: 'normal' });
        }
      }

      // Apply hideChecked (never hide an active swap item)
      const visible = hideChecked
        ? withSwaps.filter(e =>
            e._itemType === 'swap' ||     // always show swap items
            e._itemType === 'crossed' ||  // always show crossed items
            e._itemType === 'reverted' || // always show reverted items
            !checkedItems.has(e.name)
          )
        : withSwaps;

      return { title: cat.label, key: cat.key, data: visible };
    }).filter(s => s.data.length > 0);
  }, [aggregated, checkedItems, hideChecked, swapMap, revertedSwaps]);

  // ── Counts ───────────────────────────────────────────────────────────────────
  const totalItems = useMemo(() => [...aggregated.values()].length, [aggregated]);
  const checkedCount = useMemo(
    () => [...aggregated.values()].filter(e => checkedItems.has(e.name)).length,
    [aggregated, checkedItems],
  );
  const recipeCount = menuItems.length;

  // ── Copy to clipboard ────────────────────────────────────────────────────────
  const handleCopy = useCallback(async () => {
    const lines: string[] = [];
    for (const cat of SHOPPING_CATEGORIES) {
      const items = [...aggregated.values()].filter(e => e.category === cat.key);
      if (items.length === 0) continue;
      lines.push(cat.label.toUpperCase());
      for (const entry of items) {
        const qty = formatEntry(entry);
        lines.push(`  \u25a1 ${qty ? qty + ' ' : ''}${capFirst(entry.name)}`);
      }
      lines.push('');
    }
    const text = lines.join('\n');
    if (Platform.OS === 'web') {
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    } else {
      await Share.share({ message: text });
    }
  }, [aggregated]);

  // ── Instacart hand-off ───────────────────────────────────────────────────────
  const handleConfirmInstacart = useCallback(() => {
    setCheckoutVisible(false);
    // Phase 6: replace this URL with the Instacart Developer Platform cart URL
    const instacartUrl = 'https://www.instacart.com';
    Linking.openURL(instacartUrl).catch(() => {});
  }, []);

  // ── Organic preference (saves back as new default) ───────────────────────────
  const handleSelectOrganic = useCallback((pref: OrganicPreference) => {
    setOrganicPreference(pref);
  }, [setOrganicPreference]);

  // ── Manual add with paywall check ────────────────────────────────────────────
  const handlePickerAdd = useCallback((item: Recipe) => {
    const type = (!item.meal_type || item.meal_type === 'entree') ? 'entree' : 'side';

    if (type === 'entree' && !canAddEntree(isPaid)) {
      setPaywallEntree(true);
      setPaywallVisible(true);
      return;
    }
    if (!canAddItem(isPaid)) {
      setPaywallEntree(false);
      setPaywallVisible(true);
      return;
    }

    addToMenu({
      recipeId:   item.id,
      recipeName: item.name,
      recipeImage:item.photo_url ?? undefined,
      recipeType: type,
      source:     'manual',
    });
  }, [addToMenu, canAddEntree, canAddItem, isPaid]);

  // ── Picker filtered list ─────────────────────────────────────────────────────
  const pickerRecipes = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    return allRecipes.filter(r =>
      !isInMenu(r.id) &&
      (r.name.toLowerCase().includes(q) ||
        r.cuisine?.toLowerCase().includes(q) ||
        normalizeProtein(r.protein_type).toLowerCase().includes(q)),
    );
  }, [allRecipes, pickerSearch, isInMenu]);

  // ── Separate meal plan vs manual items for display ───────────────────────────
  const mealPlanCount = menuItems.filter(m => m.source === 'mealplan').length;
  const manualCount   = menuItems.filter(m => m.source === 'manual').length;

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Shopping List</Text>
          <TouchableOpacity
            style={styles.instacartBtn}
            onPress={() => setCheckoutVisible(true)}
            activeOpacity={0.85}
            disabled={menuItems.length === 0}
          >
            <Text style={styles.instacartBtnText}>
              🛒  Order on Instacart
            </Text>
          </TouchableOpacity>
        </View>

        {/* Subtitle row */}
        {menuItems.length > 0 ? (
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>
              {checkedCount}/{totalItems} items
              {mealPlanCount > 0 && manualCount > 0
                ? ` · ${mealPlanCount} from plan, ${manualCount} added`
                : mealPlanCount > 0
                  ? ` · ${mealPlanCount} from meal plan`
                  : ` · ${manualCount} ${manualCount === 1 ? 'recipe' : 'recipes'}`}
            </Text>
            <TouchableOpacity
              style={styles.addRecipeLink}
              onPress={() => { setPickerSearch(''); setPickerVisible(true); }}
            >
              <Text style={styles.addRecipeLinkText}>+ Add Recipe</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.subtitleRow}>
            <Text style={styles.subtitle}>No recipes added yet</Text>
          </View>
        )}
      </View>

      {/* ── Recipe strip ────────────────────────────────────────────────────── */}
      {menuItems.length > 0 && (
        <View style={styles.menuStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.menuStripContent}
          >
            {menuItems.map(item => {
              const recipe = allRecipes.find(r => r.id === item.recipeId || r.name === item.recipeName);
              const photoUri = item.recipeImage || recipe?.photo_url;
              const bgColor = recipe?.placeholder_color || Colors.surface;
              return (
                <View key={item.recipeId} style={styles.menuCard}>
                  {/* Photo area */}
                  <View style={[styles.menuCardPhoto, { backgroundColor: bgColor }]}>
                    {photoUri ? (
                      <Image
                        source={{ uri: photoUri }}
                        style={StyleSheet.absoluteFillObject}
                        resizeMode="cover"
                      />
                    ) : null}
                    {/* Remove × */}
                    <TouchableOpacity
                      style={styles.menuCardRemove}
                      onPress={() => removeFromMenu(item.recipeId)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.menuCardRemoveText}>×</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Name */}
                  <Text style={styles.menuCardName} numberOfLines={2}>{item.recipeName}</Text>
                  {/* Servings stepper */}
                  <View style={styles.menuCardControls}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const idx = SERVING_STEPS.indexOf(item.servings);
                        if (idx > 0) setServings(item.recipeId, SERVING_STEPS[idx - 1]);
                      }}
                    >
                      <Text style={styles.stepperBtnText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.servingsLabel}>{item.servings}×</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => {
                        const idx = SERVING_STEPS.indexOf(item.servings);
                        if (idx < SERVING_STEPS.length - 1) setServings(item.recipeId, SERVING_STEPS[idx + 1]);
                      }}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Protocol diet-mode toggle ────────────────────────────────────────── */}
      {menuItems.length > 0 && (
        <ProtocolToggleBar
          protocols={profile.protocols}
          enabled={dietModeEnabled}
          onToggle={() => { setDietModeEnabled(v => !v); clearRevertedSwaps(); }}
        />
      )}

      {/* ── Action row ──────────────────────────────────────────────────────── */}
      {menuItems.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setHideChecked(h => !h)}>
            <Text style={styles.actionBtnText}>{hideChecked ? 'Show all' : 'Hide checked'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
            <Text style={styles.actionBtnText}>Copy list</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={uncheckAll}>
            <Text style={styles.actionBtnText}>Uncheck all</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnDanger]}
            onPress={clearMenu}
          >
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Shopping list / empty state ──────────────────────────────────────── */}
      {menuItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Your list is empty"
            body={'Add recipes from the Meal Plan tab or tap "+ Add Recipe" to build your shopping list.'}
          />
          <TouchableOpacity
            style={styles.emptyAddBtn}
            onPress={() => { setPickerSearch(''); setPickerVisible(true); }}
            activeOpacity={0.85}
          >
            <Text style={styles.emptyAddBtnText}>+ Add Recipe</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item._itemType === 'swap' ? `swap__${item._swapFor}__${item.name}` : item.name}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            dietModeEnabled && profile.protocols.length > 0 ? (
              <View style={styles.dietModeSummary}>
                {modificationNotes.length === 0 ? (
                  <>
                    <Text style={styles.dietModeAllGoodIcon}>✓</Text>
                    <Text style={styles.dietModeAllGoodText}>All items compliant with your protocols</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.dietModeSummaryIcon}>⚑</Text>
                    <Text style={styles.dietModeSummaryText}>
                      {swapMap.size - revertedSwaps.size} ingredient{swapMap.size - revertedSwaps.size === 1 ? '' : 's'} swapped for your protocols
                      {revertedSwaps.size > 0 ? ` · ${revertedSwaps.size} reverted` : ''}
                    </Text>
                  </>
                )}
              </View>
            ) : null
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{section.data.length}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => {
            const checked = checkedItems.has(item.name);

            // ── Swap replacement item (gold) — diet-compliant state ──────────
            if (item._itemType === 'swap') {
              return (
                <View style={[styles.listItem, styles.listItemSwap]}>
                  <View style={[styles.checkbox, styles.checkboxSwap]}>
                    <Text style={styles.swapIcon}>↑</Text>
                  </View>
                  <View style={styles.listItemBody}>
                    <Text style={styles.listItemSwapName}>{capFirst(item.name)}</Text>
                    <View style={styles.swapMeta}>
                      <View style={[styles.swapProtocolChip, { borderColor: (item._swapColor ?? Colors.gold) + '66' }]}>
                        <Text style={[styles.swapProtocolText, { color: item._swapColor ?? Colors.gold }]}>
                          {item._swapProtocol}
                        </Text>
                      </View>
                      <Text style={styles.swapSource}>replaces {capFirst(item._swapFor ?? '')} · {item._swapRecipe}</Text>
                    </View>
                  </View>
                  {/* Active toggle: compliant state */}
                  <TouchableOpacity
                    onPress={() => toggleRevertedSwap(item._swapFor ?? item.name)}
                    style={styles.swapToggleActive}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Text style={styles.swapToggleActiveText}>✓ Compliant</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // ── Crossed item — removed ingredient (no swap available) ─────────
            if (item._itemType === 'crossed') {
              const qtyStr = formatEntry(item);
              return (
                <View style={[styles.listItem, styles.listItemCrossed]}>
                  <View style={[styles.checkbox, styles.checkboxCrossed]}>
                    <Text style={styles.crossedIcon}>✕</Text>
                  </View>
                  <View style={styles.listItemBody}>
                    <Text style={[styles.listItemQty, styles.listItemQtyCrossed]}>{qtyStr}</Text>
                    <Text style={[styles.listItemName, styles.listItemNameCrossed]}>{capFirst(item.name)}</Text>
                    <View style={styles.swapMeta}>
                      <View style={[styles.swapProtocolChip, { borderColor: (item._swapColor ?? Colors.red) + '66' }]}>
                        <Text style={[styles.swapProtocolText, { color: item._swapColor ?? Colors.red }]}>
                          {item._swapProtocol}
                        </Text>
                      </View>
                      <Text style={styles.swapSource}>removed · {item._swapRecipe}</Text>
                    </View>
                  </View>
                  {/* Active toggle: compliant state (removed) */}
                  <TouchableOpacity
                    onPress={() => toggleRevertedSwap(item.name)}
                    style={styles.swapToggleActive}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Text style={styles.swapToggleActiveText}>✓ Compliant</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // ── Reverted item — original ingredient, not diet-compliant ───────
            if (item._itemType === 'reverted') {
              const qtyStr = formatEntry(item);
              return (
                <View style={styles.listItem}>
                  <TouchableOpacity
                    style={[styles.checkbox, checked && styles.checkboxChecked]}
                    onPress={() => toggleChecked(item.name)}
                  >
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </TouchableOpacity>
                  <View style={styles.listItemBody}>
                    <Text style={[styles.listItemQty, checked && styles.listItemTextChecked]}>{qtyStr}</Text>
                    <Text style={[styles.listItemName, checked && styles.listItemTextChecked]}>{capFirst(item.name)}</Text>
                  </View>
                  {/* Inactive toggle: original state */}
                  <TouchableOpacity
                    onPress={() => toggleRevertedSwap(item.name)}
                    style={styles.swapToggleInactive}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  >
                    <Text style={styles.swapToggleInactiveText}>Original</Text>
                  </TouchableOpacity>
                </View>
              );
            }

            // ── Normal item ────────────────────────────────────────────────────
            const qtyStr = formatEntry(item);
            return (
              <TouchableOpacity
                style={[styles.listItem, checked && styles.listItemChecked]}
                onPress={() => toggleChecked(item.name)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                  {checked && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <View style={styles.listItemBody}>
                  <Text style={[styles.listItemQty, checked && styles.listItemTextChecked]}>{qtyStr}</Text>
                  <Text style={[styles.listItemName, checked && styles.listItemTextChecked]}>{capFirst(item.name)}</Text>
                </View>
                {item.sources.length > 1 && (
                  <Text style={styles.sourceCount}>{item.sources.length} recipes</Text>
                )}
              </TouchableOpacity>
            );
          }}
          renderSectionFooter={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* ── Free-tier upgrade prompt ─────────────────────────────────────────── */}
      {!isPaid && menuItems.length > 0 && (
        <View style={styles.freeNotice}>
          <Text style={styles.freeNoticeText}>
            Free plan · {2 - menuItems.filter(m => m.source === 'manual' && m.recipeType === 'entree').length} entree{' '}
            {2 - menuItems.filter(m => m.source === 'manual' && m.recipeType === 'entree').length === 1 ? 'slot' : 'slots'} remaining
          </Text>
          <TouchableOpacity>
            <Text style={styles.freeNoticeUpgrade}>Upgrade ›</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Recipe Picker Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerVisible(false)}
      >
        <SafeAreaView style={styles.pickerModal} edges={['top']}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add Recipe</Text>
            <TouchableOpacity onPress={() => setPickerVisible(false)} style={styles.pickerClose}>
              <Text style={styles.pickerCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.pickerSearch}>
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search recipes…"
              placeholderTextColor={Colors.textMuted}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              autoFocus
            />
          </View>
          {!isPaid && (
            <View style={styles.pickerLimit}>
              <Text style={styles.pickerLimitText}>
                Free plan: {2 - menuItems.filter(m => m.source === 'manual' && m.recipeType === 'entree').length} of 2 entree slots remaining
              </Text>
            </View>
          )}
          <FlatList
            data={pickerRecipes}
            keyExtractor={r => r.id}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => {
              const inMenu     = isInMenu(item.id);
              const isEntree   = !item.meal_type || item.meal_type === 'entree';
              const wouldBlock = !isPaid && !inMenu && (
                (isEntree && !canAddEntree(isPaid)) || !canAddItem(isPaid)
              );
              return (
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    inMenu       && styles.pickerItemSelected,
                    wouldBlock   && styles.pickerItemBlocked,
                  ]}
                  onPress={() => {
                    if (inMenu) {
                      removeFromMenu(item.id);
                    } else {
                      handlePickerAdd(item);
                    }
                  }}
                >
                  {item.photo_url && item.photo_url.startsWith('http') ? (
                    <Image source={{ uri: item.photo_url }} style={styles.pickerThumb} />
                  ) : (
                    <View style={[styles.pickerThumb, { backgroundColor: item.placeholder_color || Colors.surface }]} />
                  )}
                  <View style={styles.pickerItemBody}>
                    <Text style={styles.pickerItemName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.pickerItemMeta}>
                      {normalizeProtein(item.protein_type)} · {item.cuisine}
                      {isEntree ? '' : ' · Side'}
                    </Text>
                  </View>
                  <View style={[styles.pickerCheck, inMenu && styles.pickerCheckActive]}>
                    {inMenu
                      ? <Text style={styles.pickerCheckMark}>✓</Text>
                      : wouldBlock
                        ? <Text style={styles.pickerLockIcon}>🔒</Text>
                        : null}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.pickerEmpty}>No recipes found</Text>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* ── Pre-checkout confirmation sheet ─────────────────────────────────── */}
      <CheckoutSheet
        visible={checkoutVisible}
        totalItems={totalItems}
        recipeCount={recipeCount}
        organicPreference={organicPreference}
        onSelectOrganic={handleSelectOrganic}
        onConfirm={handleConfirmInstacart}
        onClose={() => setCheckoutVisible(false)}
      />

      {/* ── Paywall modal ────────────────────────────────────────────────────── */}
      <PaywallModal
        visible={paywallVisible}
        isEntreeLimit={paywallEntree}
        onClose={() => setPaywallVisible(false)}
      />

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  headerTop: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   6,
  },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary },

  instacartBtn: {
    backgroundColor: INSTACART_GREEN,
    borderRadius:    100,
    paddingHorizontal: 14,
    paddingVertical:   8,
  },
  instacartBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize:   13,
    color:      '#fff',
    letterSpacing: 0.1,
  },

  subtitleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  subtitle: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  addRecipeLink: { paddingVertical: 2 },
  addRecipeLinkText: {
    fontFamily: Fonts.bodyMedium,
    fontSize:   12,
    color:      Colors.gold,
  },

  // Recipe strip
  menuStrip: {
    borderTopWidth:    1,
    borderBottomWidth: 1,
    borderColor:       Colors.border,
    paddingVertical:   12,
  },
  menuStripContent: { paddingHorizontal: 16, gap: 10 },

  // Photo cards
  menuCard: {
    width:           130,
    borderRadius:    10,
    overflow:        'hidden',
    backgroundColor: Colors.surface,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  menuCardPhoto: {
    width:    '100%',
    height:   100,
    overflow: 'hidden',
  },
  menuCardRemove: {
    position:        'absolute',
    top:             6,
    right:           6,
    width:           22,
    height:          22,
    borderRadius:    11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems:      'center',
    justifyContent:  'center',
  },
  menuCardRemoveText: { fontFamily: Fonts.body, fontSize: 14, color: '#fff', lineHeight: 18 },
  menuCardName: {
    fontFamily:      Fonts.bodyMedium,
    fontSize:        11,
    color:           Colors.textPrimary,
    paddingHorizontal: 8,
    paddingTop:      6,
    paddingBottom:   2,
    lineHeight:      15,
  },
  menuCardControls: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    paddingHorizontal: 8,
    paddingBottom:   8,
    paddingTop:      4,
  },
  stepperBtn: {
    width:           24,
    height:          24,
    borderRadius:    12,
    backgroundColor: Colors.surfaceElevated,
    alignItems:      'center',
    justifyContent:  'center',
  },
  stepperBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  servingsLabel: {
    fontFamily: Fonts.body,
    fontSize:   12,
    color:      Colors.gold,
    minWidth:   24,
    textAlign:  'center',
  },

  // Action row
  actionRow: {
    flexDirection:     'row',
    paddingHorizontal: 16,
    paddingVertical:   8,
    gap:               6,
    borderBottomWidth: 1,
    borderColor:       Colors.border,
    flexWrap:          'wrap',
  },
  actionBtn: {
    borderWidth:      1,
    borderColor:      Colors.border,
    borderRadius:     8,
    paddingHorizontal:10,
    paddingVertical:  6,
  },
  actionBtnText:      { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary },
  actionBtnDanger:    { borderColor: 'rgba(201,107,107,0.3)' },
  actionBtnDangerText:{ color: Colors.red },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 80, paddingTop: 8 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingTop:    16,
    paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily:    Fonts.bodyMedium,
    fontSize:      11,
    color:         Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionBadge: {
    backgroundColor:  Colors.surfaceElevated,
    borderRadius:     10,
    paddingHorizontal:7,
    paddingVertical:  2,
  },
  sectionBadgeText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },

  listItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderColor:       Colors.border,
  },
  listItemChecked: { opacity: 0.35 },
  checkbox: {
    width:       20,
    height:      20,
    borderRadius:4,
    borderWidth: 1,
    borderColor: Colors.borderActive,
    alignItems:  'center',
    justifyContent:'center',
  },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkmark:       { fontSize: 12, color: '#000' },
  listItemBody: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           6,
    flexWrap:      'wrap',
  },
  listItemQty:         { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.gold },
  listItemName:        { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary, flexShrink: 1 },
  listItemTextChecked: { color: Colors.textMuted, textDecorationLine: 'line-through' },
  sourceCount:         { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },

  // Empty state
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyAddBtn: {
    marginTop:       24,
    backgroundColor: Colors.gold,
    borderRadius:    100,
    paddingHorizontal:28,
    paddingVertical: 13,
  },
  emptyAddBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 15, color: '#000' },

  // Free notice
  freeNotice: {
    position:          'absolute',
    bottom:            0,
    left:              0,
    right:             0,
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   10,
    backgroundColor:   Colors.surface,
    borderTopWidth:    1,
    borderTopColor:    Colors.border,
  },
  freeNoticeText:    { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  freeNoticeUpgrade: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.gold },

  // Picker modal
  pickerModal: { flex: 1, backgroundColor: Colors.bg },
  pickerHeader: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    borderBottomWidth: 1,
    borderColor:       Colors.border,
  },
  pickerTitle:       { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary },
  pickerClose:       { padding: 4 },
  pickerCloseText:   { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.gold },
  pickerSearch: {
    paddingHorizontal: 16,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderColor:       Colors.border,
  },
  pickerSearchInput: {
    backgroundColor: Colors.surface,
    borderRadius:    10,
    paddingHorizontal:14,
    paddingVertical: 10,
    fontFamily:      Fonts.body,
    fontSize:        14,
    color:           Colors.textPrimary,
    borderWidth:     1,
    borderColor:     Colors.border,
  },
  pickerLimit: {
    paddingHorizontal: 16,
    paddingVertical:   8,
    backgroundColor:   'rgba(212,168,67,0.07)',
    borderBottomWidth: 1,
    borderColor:       Colors.border,
  },
  pickerLimitText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.gold },
  pickerList:      { paddingHorizontal: 16, paddingVertical: 8 },
  pickerItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               12,
    paddingVertical:   10,
    borderBottomWidth: 1,
    borderColor:       Colors.border,
  },
  pickerItemSelected: { opacity: 0.7 },
  pickerItemBlocked:  { opacity: 0.4 },
  pickerThumb:        { width: 48, height: 48, borderRadius: 8 },
  pickerItemBody:     { flex: 1 },
  pickerItemName:     { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  pickerItemMeta:     { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  pickerCheck: {
    width:          24,
    height:         24,
    borderRadius:   12,
    borderWidth:    1,
    borderColor:    Colors.border,
    alignItems:     'center',
    justifyContent: 'center',
  },
  pickerCheckActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  pickerCheckMark:   { fontSize: 13, color: '#000' },
  pickerLockIcon:    { fontSize: 12 },
  pickerEmpty: {
    fontFamily: Fonts.body,
    fontSize:   14,
    color:      Colors.textMuted,
    textAlign:  'center',
    paddingTop: 40,
  },

  // Crossed-out item (needs swap)
  listItemCrossed: {
    backgroundColor: 'rgba(201,107,107,0.06)',
    borderBottomColor: 'rgba(201,107,107,0.15)',
  },
  checkboxCrossed: {
    backgroundColor: 'rgba(201,107,107,0.15)',
    borderColor: Colors.red,
  },
  crossedIcon: { fontSize: 10, color: Colors.red },
  listItemQtyCrossed: {
    color: Colors.red,
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  listItemNameCrossed: {
    color: Colors.red,
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  revertBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,107,107,0.3)',
  },
  revertBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.red,
  },

  // Swap compliance toggle buttons
  swapToggleActive: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(212,168,67,0.15)',
  },
  swapToggleActiveText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 11,
    color: Colors.gold,
  },
  swapToggleInactive: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  swapToggleInactiveText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Swap replacement item (new gold ingredient)
  listItemSwap: {
    backgroundColor: 'rgba(212,168,67,0.06)',
    borderBottomColor: 'rgba(212,168,67,0.15)',
  },
  checkboxSwap: {
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderColor: Colors.gold,
  },
  swapIcon: { fontSize: 12, color: Colors.gold },
  listItemSwapName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 14,
    color: Colors.gold,
  },
  swapMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  swapProtocolChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
  },
  swapProtocolText: { fontFamily: Fonts.bodyMedium, fontSize: 10 },
  swapSource: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },

  // Diet mode summary line
  dietModeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dietModeAllGoodIcon: { fontSize: 13, color: Colors.green },
  dietModeAllGoodText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.green },
  dietModeSummaryIcon: { fontSize: 13, color: Colors.gold },
  dietModeSummaryText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary },
});
