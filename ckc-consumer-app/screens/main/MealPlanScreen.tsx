/**
 * MealPlanScreen — Phase 1E
 *
 * Free:  2 active day slots, Chef Sides button locked behind paywall
 * Paid:  up to 7 days, week navigation, Private Chef side pairings
 *
 * Flow:
 *   1. SetupFlow (4 questions) → auto-populates plan from saved recipes
 *   2. Week view: scrollable day cards with entree + sides
 *   3. Tap day → AddRecipeModal (saved recipes only)
 *   4. ✦ Chef Sides → pairing engine queries full CKC library
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Modal,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Colors, Fonts } from '../../constants/theme';
import PremiumGate from '../components/PremiumGate';
import { useUser } from '../../context/UserContext';
import { useMenu, AddMenuItemInput } from '../../context/MenuContext';
import { Recipe } from '../../data/sampleRecipes';
import { fetchRecipesByIds, fetchSideDishes } from '../../lib/firestore';

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const FREE_DAY_LIMIT = 2;

const PROTEINS  = ['Chicken', 'Beef', 'Fish', 'Pork', 'Lamb', 'Shellfish', 'Vegetarian', 'Other'];
const CUISINES  = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Middle Eastern', 'Indian', 'French'];
const DAY_OPTIONS = [2, 3, 5, 7] as const;

const COOK_TIMES: { label: string; sublabel: string; value: CookTime }[] = [
  { label: 'Quick',   sublabel: 'Under 30 min', value: 'quick'  },
  { label: 'Normal',  sublabel: '30 – 60 min',  value: 'normal' },
  { label: 'Relaxed', sublabel: '60+ min',       value: 'long'   },
];

const STARCH_KEYWORDS = ['rice', 'pasta', 'noodle', 'bread', 'tortilla', 'couscous', 'quinoa', 'potato', 'potatoes', 'orzo', 'polenta'];

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type CookTime    = 'quick' | 'normal' | 'long';
type SetupAnswers = { days: 2 | 3 | 5 | 7; proteins: string[]; cuisines: string[]; cookTime: CookTime };

// A side slot holds the current pick + alternatives for cycling.
// options[0] is the original suggestion; optIdx cycles through all options.
// Manually-added sides have options.length === 1 (no ↻ button shown).
interface SideSlot {
  options: Recipe[];
  optIdx:  number;
}

type DayMeal  = { entree: Recipe | null; sides: SideSlot[] };
type WeekPlan = Record<string, DayMeal>; // key = 'YYYY-MM-DD'

// ─────────────────────────────────────────────
// Date helpers
// ─────────────────────────────────────────────

const DAY_ABBR  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABB = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getWeekDates(offset: number): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(today);
  monday.setDate(today.getDate() + daysToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function toDateKey(d: Date): string { return d.toISOString().slice(0, 10); }

function formatDayHeader(d: Date): string {
  return `${DAY_ABBR[d.getDay()].toUpperCase()} · ${MONTH_ABB[d.getMonth()]} ${d.getDate()}`;
}

function formatWeekRange(dates: Date[]): string {
  const a = dates[0], b = dates[6];
  if (a.getMonth() === b.getMonth()) {
    return `${MONTH_ABB[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`;
  }
  return `${MONTH_ABB[a.getMonth()]} ${a.getDate()} – ${MONTH_ABB[b.getMonth()]} ${b.getDate()}`;
}

function isToday(d: Date): boolean {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// ─────────────────────────────────────────────
// Pairing helpers  (simplified from pairing_analysis.md)
// ─────────────────────────────────────────────

function hasBuiltInStarch(recipe: Recipe): boolean {
  const text = [...(recipe.ingredients || []), recipe.name, recipe.menu_description || '']
    .join(' ').toLowerCase();
  return STARCH_KEYWORDS.some(k => text.includes(k));
}

function cuisineCompatScore(entree: string, side: string): number {
  const e = (entree || '').toLowerCase();
  const s = (side   || '').toLowerCase();
  if (e === s) return 3;
  if (!s || s === 'american') return 2; // universal donor
  const adjacent: Record<string, string[]> = {
    'middle eastern': ['mediterranean'],
    'mediterranean':  ['middle eastern'],
    'asian':          ['thai'],
    'thai':           ['asian'],
  };
  if ((adjacent[e] || []).includes(s)) return 2;
  const blocked: Record<string, string[]> = {
    'asian':   ['italian', 'mexican'],
    'thai':    ['italian', 'mexican'],
    'italian': ['asian', 'thai'],
    'mexican': ['asian', 'thai'],
  };
  if ((blocked[e] || []).includes(s)) return 0;
  return 1;
}

// ── Entree classification helpers ────────────────────────────────────────────

function isStandaloneComplete(entree: Recipe): boolean {
  const n = entree.name.toLowerCase();
  const d = (entree.menu_description || '').toLowerCase();
  const text = `${n} ${d}`;
  // Soups, stews, casseroles, one-pan bakes always stand alone
  if (n.includes('soup') || n.includes('stew') || n.includes('casserole') ||
      entree.meal_type === 'soup') return true;
  // Complete bowls: has protein + grain + vegetable in name/description
  const hasGrain = STARCH_KEYWORDS.some(k => text.includes(k));
  const hasProtein = (entree.protein_type || '') !== '';
  const vegWords = ['broccoli','spinach','zucchini','kale','bok choy','asparagus',
    'pepper','tomato','mushroom','eggplant','cauliflower','brussels','squash'];
  const hasVeg = vegWords.some(v => text.includes(v));
  if (hasGrain && hasProtein && hasVeg) return true;
  return false;
}

function isPastaEntree(entree: Recipe): boolean {
  const text = `${entree.name} ${entree.menu_description || ''}`.toLowerCase();
  return ['pasta','spaghetti','fettuccine','linguine','penne','rigatoni','lasagna',
    'tortellini','gnocchi','noodle','ramen','udon','pad thai','lo mein','chow mein',
    'orzo'].some(k => text.includes(k));
}

function isTacoEntree(entree: Recipe): boolean {
  const n = entree.name.toLowerCase();
  return n.includes('taco') || n.includes('fajita') || n.includes('burrito');
}

function isSandwichEntree(entree: Recipe): boolean {
  const n = entree.name.toLowerCase();
  return ['sandwich','burger','wrap','quesadilla','pita','flatbread'].some(k => n.includes(k));
}

function isHeavyEntree(entree: Recipe): boolean {
  const n = entree.name.toLowerCase();
  return ['braise','braised','pot roast','short rib','short ribs','beef bourguignon',
    'osso buco','carnitas','pulled pork'].some(k => n.includes(k));
}

function isCreamyEntree(entree: Recipe): boolean {
  const n = entree.name.toLowerCase();
  return ['creamy','cream sauce','alfredo','beurre blanc','marry me'].some(k => n.includes(k));
}

function isSweetGlazedEntree(entree: Recipe): boolean {
  const n = entree.name.toLowerCase();
  return ['honey','maple','sweet','glazed','teriyaki','balsamic glaze'].some(k => n.includes(k));
}

// ── Clash prevention ──────────────────────────────────────────────────────────

function isHeavySide(side: Recipe): boolean {
  const n = (side.name || '').toLowerCase();
  return ['braised','braise','gratin','au gratin','casserole','mashed','creamy','cheesy'].some(k => n.includes(k));
}

function isCreamySide(side: Recipe): boolean {
  const n = (side.name || '').toLowerCase();
  return ['creamy','cream','alfredo','gratin','au gratin','polenta','whipped'].some(k => n.includes(k));
}

function isSweetSide(side: Recipe): boolean {
  const n = (side.name || '').toLowerCase();
  return ['honey','maple','sweet','candied','glazed','caramel'].some(k => n.includes(k));
}

// ── Main pairing function ─────────────────────────────────────────────────────

function getSuggestedSides(entree: Recipe, allSides: Recipe[], protocols: string[]): Recipe[] {
  // 1. Classify entree — no sides for standalone complete dishes
  if (isStandaloneComplete(entree)) return [];

  const entreeHasStarch = hasBuiltInStarch(entree);
  const entreeIsPasta   = isPastaEntree(entree);
  const entreeIsTaco    = isTacoEntree(entree);
  const entreeIsSandwich = isSandwichEntree(entree);
  const entreeIsHeavy   = isHeavyEntree(entree);
  const entreeIsCreamy  = isCreamyEntree(entree);
  const entreeIsSweet   = isSweetGlazedEntree(entree);

  // 2. Protocol filtering — prefer native, allow mod, exclude non-compliant
  const isCompliant = (s: Recipe) => protocols.length === 0 ||
    protocols.every(p => { const t = s.dietTags?.[p]; return t && (t.native || t.mod); });

  // Keto override: filter out starch-role sides (they'll be replaced below)
  const isKeto = protocols.includes('K');

  let pool = allSides.filter(isCompliant);

  // 3. Score and filter each candidate
  const scored = pool.map(s => {
    const role = inferSideRole(s);

    // Pasta entrees: only pair with salad or sauce
    if (entreeIsPasta && role !== 'salad' && role !== 'sauce') return null;

    // Hard block: two starches
    if (entreeHasStarch && !entreeIsTaco && !entreeIsSandwich && role === 'starch') return null;

    // Hard block: two heavy dishes
    if (entreeIsHeavy && isHeavySide(s)) return null;

    // Hard block: two competing cream-heavy dishes
    if (entreeIsCreamy && isCreamySide(s)) return null;

    // Hard block: sweet side with sweet-glazed entree
    if (entreeIsSweet && isSweetSide(s)) return null;

    // Cuisine compatibility
    let score = cuisineCompatScore(entree.cuisine || '', s.cuisine || '');
    if (score === 0) return null; // blocked anti-pairing

    // Prefer native compliance
    if (protocols.length > 0 && protocols.every(p => s.dietTags?.[p]?.native)) score += 0.5;

    // Keto: downrank starch sides further (they shouldn't appear unless keto-friendly)
    if (isKeto && role === 'starch') score -= 2;

    return { recipe: s, score, role };
  }).filter(Boolean) as { recipe: Recipe; score: number; role: string }[];

  scored.sort((a, b) => b.score - a.score);

  // 4. Balance the result: aim for 1 starch + 1 vegetable for protein-only entrees,
  //    salad-or-veg for pasta, flexible for tacos/sandwiches.
  if (entreeIsPasta) {
    return scored.slice(0, 2).map(x => x.recipe);
  }

  if (entreeIsTaco || entreeIsSandwich) {
    return scored.slice(0, 3).map(x => x.recipe);
  }

  // Protein-only / simple braise: try to return 1 starch + 1 vegetable
  const starch = scored.find(x => x.role === 'starch');
  const veg    = scored.find(x => x.role === 'vegetable' || x.role === 'salad');
  const sauce  = scored.find(x => x.role === 'sauce');

  const picks: Recipe[] = [];
  if (starch) picks.push(starch.recipe);
  if (veg)    picks.push(veg.recipe);
  if (sauce && picks.length < 3) picks.push(sauce.recipe);

  // If we couldn't fill 2 slots with balanced picks, fill from top scored
  if (picks.length < 2) {
    for (const { recipe } of scored) {
      if (!picks.find(p => p.id === recipe.id)) picks.push(recipe);
      if (picks.length >= 3) break;
    }
  }

  return picks.slice(0, 3);
}

// Infer the functional role of a side dish from its meal_type and name.
// Used so the cycle button only swaps within the same role (starch ↔ starch, etc.)
function inferSideRole(recipe: Recipe): 'starch' | 'vegetable' | 'salad' | 'sauce' {
  if (recipe.meal_type === 'sauce') return 'sauce';
  if (recipe.meal_type === 'salad') return 'salad';
  const name = (recipe.name || '').toLowerCase();
  const starchWords = ['rice', 'pasta', 'noodle', 'bread', 'tortilla', 'couscous', 'quinoa',
    'potato', 'potatoes', 'orzo', 'polenta', 'grits', 'farro', 'mashed', 'bean', 'beans',
    'lentil', 'lentils', 'chickpea', 'chickpeas', 'plantain'];
  if (starchWords.some(k => name.includes(k))) return 'starch';
  return 'vegetable';
}

// Build the alternatives list for a given side: same role, compatible cuisine,
// protocol-compliant, excluding the side itself.
function computeAlternatives(
  side: Recipe,
  allSides: Recipe[],
  entree: Recipe,
  protocols: string[],
): Recipe[] {
  const role = inferSideRole(side);
  return allSides
    .filter(s => {
      if (s.id === side.id) return false;
      if (inferSideRole(s) !== role) return false;
      if (cuisineCompatScore(entree.cuisine || '', s.cuisine || '') === 0) return false;
      if (protocols.length > 0 &&
          !protocols.every(p => { const t = s.dietTags?.[p]; return t && (t.native || t.mod); }))
        return false;
      return true;
    })
    .slice(0, 8);
}

// ─────────────────────────────────────────────
// Plan builder
// ─────────────────────────────────────────────

function buildPlan(dates: Date[], entrees: Recipe[], answers: SetupAnswers, protocols: string[]): WeekPlan {
  const activeDates = dates.slice(0, answers.days);

  let pool = protocols.length > 0
    ? entrees.filter(r => protocols.every(p => { const t = r.dietTags?.[p]; return t && (t.native || t.mod); }))
    : [...entrees];

  // Apply preference filters with fallback if not enough matches
  if (answers.proteins.length > 0) {
    const f = pool.filter(r => answers.proteins.includes(r.protein_type));
    if (f.length >= answers.days) pool = f;
  }
  if (answers.cuisines.length > 0) {
    const f = pool.filter(r => answers.cuisines.includes(r.cuisine));
    if (f.length >= answers.days) pool = f;
  }
  if (answers.cookTime === 'quick') {
    const f = pool.filter(r => r.prep_time != null && r.prep_time <= 30);
    if (f.length >= answers.days) pool = f;
  } else if (answers.cookTime === 'long') {
    const f = pool.filter(r => r.prep_time != null && r.prep_time > 60);
    if (f.length >= answers.days) pool = f;
  }

  // Shuffle for variety
  const shuffled = [...pool].sort(() => Math.random() - 0.5);

  // Assign, avoiding back-to-back same protein
  const plan: WeekPlan = {};
  let lastProtein = '';
  let remaining = [...shuffled];

  for (const date of activeDates) {
    const key = toDateKey(date);
    const diff = remaining.filter(r => r.protein_type !== lastProtein);
    const pick = (diff.length > 0 ? diff : remaining)[0];
    if (pick) {
      plan[key] = { entree: pick, sides: [] };
      lastProtein = pick.protein_type;
      remaining = remaining.filter(r => r.id !== pick.id);
    } else {
      plan[key] = { entree: null, sides: [] };
    }
  }
  return plan;
}

// ─────────────────────────────────────────────
// SetupFlow — 4-question weekly planner onboarding
// ─────────────────────────────────────────────

function SetupFlow({ isPaid, onComplete }: { isPaid: boolean; onComplete: (a: SetupAnswers) => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<SetupAnswers>({
    days: isPaid ? 7 : 2,
    proteins: [],
    cuisines: [],
    cookTime: 'normal',
  });

  // Free users skip the "how many days" step (locked to 2)
  const totalSteps  = isPaid ? 4 : 3;
  const globalStep  = isPaid ? step : step + 1; // map local step → question index

  function toggle<T extends string>(list: T[], item: T): T[] {
    return list.includes(item) ? list.filter(x => x !== item) : [...list, item];
  }

  function advance() {
    if (step < totalSteps - 1) setStep(s => s + 1);
    else onComplete(answers);
  }

  const isLast = step === totalSteps - 1;

  return (
    <View style={sf.overlay}>
      <SafeAreaView style={sf.safe} edges={['top', 'bottom']}>

        {/* Step dots */}
        <View style={sf.dots}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View key={i} style={[sf.dot, i === step && sf.dotActive]} />
          ))}
        </View>

        <ScrollView style={sf.scroll} contentContainerStyle={sf.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Step 0 (paid only): How many days */}
          {isPaid && step === 0 && (
            <>
              <Text style={sf.heading}>How many days{'\n'}are you planning?</Text>
              <View style={sf.dayGrid}>
                {DAY_OPTIONS.map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[sf.dayOption, answers.days === n && sf.dayOptionActive]}
                    onPress={() => setAnswers(a => ({ ...a, days: n }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[sf.dayNum, answers.days === n && sf.dayNumActive]}>{n}</Text>
                    <Text style={[sf.dayLabel, answers.days === n && sf.dayLabelActive]}>days</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Step 1: Proteins */}
          {globalStep === 1 && (
            <>
              <Text style={sf.heading}>Any proteins you want{'\n'}to feature this week?</Text>
              <Text style={sf.sub}>Optional — skip if you're open to anything</Text>
              <View style={sf.chipGrid}>
                {PROTEINS.map(p => (
                  <TouchableOpacity
                    key={p}
                    style={[sf.chip, answers.proteins.includes(p) && sf.chipActive]}
                    onPress={() => setAnswers(a => ({ ...a, proteins: toggle(a.proteins, p) }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[sf.chipText, answers.proteins.includes(p) && sf.chipTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Step 2: Cuisines */}
          {globalStep === 2 && (
            <>
              <Text style={sf.heading}>What cuisines are you{'\n'}feeling this week?</Text>
              <Text style={sf.sub}>Optional — skip if you're open to anything</Text>
              <View style={sf.chipGrid}>
                {CUISINES.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[sf.chip, answers.cuisines.includes(c) && sf.chipActive]}
                    onPress={() => setAnswers(a => ({ ...a, cuisines: toggle(a.cuisines, c) }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[sf.chipText, answers.cuisines.includes(c) && sf.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Step 3: Cook time */}
          {globalStep === 3 && (
            <>
              <Text style={sf.heading}>How much time do you{'\n'}have to cook?</Text>
              <View style={sf.timeList}>
                {COOK_TIMES.map(ct => (
                  <TouchableOpacity
                    key={ct.value}
                    style={[sf.timeOption, answers.cookTime === ct.value && sf.timeOptionActive]}
                    onPress={() => setAnswers(a => ({ ...a, cookTime: ct.value }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[sf.timeLabel, answers.cookTime === ct.value && sf.timeLabelActive]}>{ct.label}</Text>
                    <Text style={[sf.timeSub,   answers.cookTime === ct.value && sf.timeSubActive]}>{ct.sublabel}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

        </ScrollView>

        <View style={sf.footer}>
          <TouchableOpacity style={sf.btn} onPress={advance} activeOpacity={0.85}>
            <Text style={sf.btnText}>{isLast ? 'Build My Plan' : 'Continue'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={advance} activeOpacity={0.6}>
            <Text style={sf.skip}>Skip</Text>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const sf = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.bg, zIndex: 100 },
  safe:         { flex: 1 },
  dots:         { flexDirection: 'row', gap: 6, justifyContent: 'center', paddingTop: 20, paddingBottom: 8 },
  dot:          { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  dotActive:    { backgroundColor: Colors.gold, width: 20 },
  scroll:       { flex: 1 },
  scrollContent:{ paddingHorizontal: 28, paddingTop: 36, paddingBottom: 20, gap: 28 },
  heading:      { fontFamily: Fonts.display, fontSize: 34, color: Colors.textPrimary, lineHeight: 42 },
  sub:          { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: -18 },

  dayGrid:        { flexDirection: 'row', gap: 12 },
  dayOption:      { flex: 1, aspectRatio: 1, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  dayOptionActive:{ borderColor: Colors.gold, backgroundColor: 'rgba(212,168,67,0.10)' },
  dayNum:         { fontFamily: Fonts.display, fontSize: 32, color: Colors.textMuted },
  dayNumActive:   { color: Colors.gold },
  dayLabel:       { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted, letterSpacing: 0.5 },
  dayLabelActive: { color: Colors.gold },

  chipGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:          { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  chipActive:    { borderColor: Colors.gold, backgroundColor: 'rgba(212,168,67,0.10)' },
  chipText:      { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  chipTextActive:{ fontFamily: Fonts.bodyMedium, color: Colors.gold },

  timeList:         { gap: 10 },
  timeOption:       { padding: 18, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, gap: 3 },
  timeOptionActive: { borderColor: Colors.gold, backgroundColor: 'rgba(212,168,67,0.10)' },
  timeLabel:        { fontFamily: Fonts.bodyMedium, fontSize: 16, color: Colors.textSecondary },
  timeLabelActive:  { color: Colors.gold },
  timeSub:          { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },
  timeSubActive:    { color: 'rgba(212,168,67,0.7)' },

  footer:  { paddingHorizontal: 28, paddingBottom: 24, paddingTop: 12, gap: 14, alignItems: 'center' },
  btn:     { alignSelf: 'stretch', backgroundColor: Colors.gold, borderRadius: 100, paddingVertical: 16, alignItems: 'center' },
  btnText: { fontFamily: Fonts.bodyMedium, fontSize: 16, color: '#000' },
  skip:    { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
});

// ─────────────────────────────────────────────
// DayCard
// ─────────────────────────────────────────────

interface DayCardProps {
  date:            Date;
  meal:            DayMeal;
  isLocked:        boolean;
  isPaid:          boolean;
  onAddEntree:     () => void;
  onAddSide:       () => void;
  onRemoveEntree:  () => void;
  onRemoveSide:    (id: string) => void;
  onCycleSide:     (idx: number) => void;
  onChefSides:     () => void;
  onUpgrade:       () => void;
}

function DayCard({ date, meal, isLocked, isPaid, onAddEntree, onAddSide, onRemoveEntree, onRemoveSide, onCycleSide, onChefSides, onUpgrade }: DayCardProps) {
  const today = isToday(date);
  const { entree, sides } = meal;

  if (isLocked) {
    return (
      <View style={dc.wrap}>
        <View style={dc.lockedHeader}>
          <Text style={dc.dayLabel}>{formatDayHeader(date)}</Text>
          <View style={dc.lockPill}><Text style={dc.lockPillText}>PREMIUM</Text></View>
        </View>
        <TouchableOpacity style={dc.lockedBody} onPress={onUpgrade} activeOpacity={0.8}>
          <Text style={dc.lockIcon}>🔒</Text>
          <Text style={dc.lockedText}>Upgrade to plan more than {FREE_DAY_LIMIT} days</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[dc.wrap, today && dc.wrapToday]}>

      {/* Day header */}
      <Text style={[dc.dayLabel, today && dc.dayLabelToday]}>{formatDayHeader(date)}</Text>

      {/* Entree */}
      {entree ? (
        <View style={dc.entreeRow}>
          <View style={dc.entreeMeta}>
            <Text style={dc.entreeName}>{entree.name}</Text>
            {(entree.cuisine || entree.protein_type) ? (
              <Text style={dc.entreeSub}>
                {[entree.cuisine, entree.protein_type].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onRemoveEntree} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={dc.removeX}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={dc.addEntreeBtn} onPress={onAddEntree} activeOpacity={0.7}>
          <Text style={dc.addEntreeBtnText}>+ Add Recipe</Text>
        </TouchableOpacity>
      )}

      {/* Sides — only visible when entree exists */}
      {entree && (
        <View style={dc.sidesSection}>
          <Text style={dc.sidesLabel}>SIDES</Text>

          {sides.map((slot, idx) => {
            const side     = slot.options[slot.optIdx];
            const canCycle = slot.options.length > 1;
            return (
              <View key={`${side.id}-${idx}`} style={dc.sideRow}>
                <Text style={dc.sideBullet}>·</Text>
                <Text style={dc.sideName}>{side.name}</Text>
                {canCycle && (
                  <TouchableOpacity onPress={() => onCycleSide(idx)} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Text style={dc.cycleBtn}>↻</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => onRemoveSide(side.id)} hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}>
                  <Text style={dc.sideRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          <View style={dc.sideActions}>
            <TouchableOpacity style={dc.addSideBtn} onPress={onAddSide} activeOpacity={0.75}>
              <Text style={dc.addSideBtnText}>+ Add Side</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[dc.chefBtn, !isPaid && dc.chefBtnLocked]}
              onPress={isPaid ? onChefSides : onUpgrade}
              activeOpacity={0.8}
            >
              <Text style={[dc.chefBtnText, !isPaid && dc.chefBtnTextLocked]}>
                {!isPaid ? '🔒 ' : ''}✦ Chef Sides
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

    </View>
  );
}

const dc = StyleSheet.create({
  wrap:          { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, padding: 18, gap: 14 },
  wrapToday:     { borderColor: Colors.borderActive },

  dayLabel:      { fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.textMuted, letterSpacing: 1 },
  dayLabelToday: { color: Colors.gold },

  entreeRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  entreeMeta:  { flex: 1, gap: 3 },
  entreeName:  { fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary, lineHeight: 27 },
  entreeSub:   { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, letterSpacing: 0.3 },
  removeX:     { color: Colors.textMuted, fontSize: 14, paddingTop: 2 },

  addEntreeBtn:     { borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  addEntreeBtnText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },

  sidesSection: { gap: 8 },
  sidesLabel:   { fontFamily: Fonts.bodyMedium, fontSize: 10, color: Colors.textMuted, letterSpacing: 1.2 },
  sideRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sideBullet:   { color: Colors.textMuted, fontSize: 16, lineHeight: 20 },
  sideName:     { flex: 1, fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary },
  cycleBtn:     { color: Colors.gold, fontSize: 14, paddingHorizontal: 2 },
  sideRemove:   { color: Colors.textMuted, fontSize: 11 },

  sideActions:      { flexDirection: 'row', gap: 8, marginTop: 2 },
  addSideBtn:       { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.border, borderRadius: 100 },
  addSideBtnText:   { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  chefBtn:          { paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: Colors.gold, borderRadius: 100, backgroundColor: 'rgba(212,168,67,0.08)' },
  chefBtnLocked:    { borderColor: Colors.border, backgroundColor: 'transparent' },
  chefBtnText:      { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.gold },
  chefBtnTextLocked:{ color: Colors.textMuted },

  lockedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lockPill:     { borderWidth: 1, borderColor: Colors.border, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  lockPillText: { fontFamily: Fonts.bodyMedium, fontSize: 9, color: Colors.textMuted, letterSpacing: 1 },
  lockedBody:   { borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 18, alignItems: 'center', gap: 8 },
  lockIcon:     { fontSize: 20 },
  lockedText:   { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
});

// ─────────────────────────────────────────────
// AddRecipeModal — pick from saved recipes
// ─────────────────────────────────────────────

function AddRecipeModal({
  visible, recipes, role, onSelect, onClose, onGoSwipe,
}: {
  visible:   boolean;
  recipes:   Recipe[];
  role:      'entree' | 'side';
  onSelect:  (r: Recipe) => void;
  onClose:   () => void;
  onGoSwipe: () => void;
}) {
  const isEmpty = recipes.length === 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={am.overlay}>
        <TouchableOpacity style={am.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={am.sheet}>
          <View style={am.handle} />
          <View style={am.header}>
            <Text style={am.title}>{role === 'entree' ? 'Choose a Recipe' : 'Add a Side'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={am.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {isEmpty ? (
            <View style={am.empty}>
              <Text style={am.emptyTitle}>No saved recipes yet</Text>
              <Text style={am.emptySub}>
                Swipe recipes you love in Discover to add them to your collection.
              </Text>
              <TouchableOpacity style={am.emptyBtn} onPress={() => { onClose(); onGoSwipe(); }} activeOpacity={0.85}>
                <Text style={am.emptyBtnText}>Go to Discover</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={recipes}
              keyExtractor={r => r.id}
              style={am.list}
              contentContainerStyle={am.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity style={am.row} onPress={() => onSelect(item)} activeOpacity={0.75}>
                  {item.photo_url
                    ? <Image source={{ uri: item.photo_url }} style={am.thumb} />
                    : <View style={[am.thumb, { backgroundColor: item.placeholder_color }]} />}
                  <View style={am.recipeInfo}>
                    <Text style={am.recipeName} numberOfLines={2}>{item.name}</Text>
                    <Text style={am.recipeMeta}>
                      {[item.cuisine, item.protein_type, item.prep_time ? `${item.prep_time} min` : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', paddingBottom: 28, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.border },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:      { fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary },
  close:      { color: Colors.textMuted, fontSize: 18 },
  list:       { flex: 1 },
  listContent:{ paddingHorizontal: 16, paddingTop: 8 },
  row:        { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  thumb:      { width: 56, height: 42, borderRadius: 8, backgroundColor: Colors.surfaceElevated },
  recipeInfo: { flex: 1, gap: 3 },
  recipeName: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  recipeMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  empty:      { padding: 32, alignItems: 'center', gap: 12 },
  emptyTitle: { fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary },
  emptySub:   { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyBtn:   { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Colors.gold, borderRadius: 100 },
  emptyBtnText:{ fontFamily: Fonts.bodyMedium, fontSize: 14, color: '#000' },
});

// ─────────────────────────────────────────────
// ChefSidesModal — pairing suggestions
// ─────────────────────────────────────────────

function ChefSidesModal({
  visible, entree, suggestions, loading, onAdd, onClose,
}: {
  visible:     boolean;
  entree:      Recipe | null;
  suggestions: Recipe[];
  loading:     boolean;
  onAdd:       (r: Recipe) => void;
  onClose:     () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cm.overlay}>
        <TouchableOpacity style={cm.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={cm.sheet}>
          <View style={cm.handle} />
          <View style={cm.header}>
            <View>
              <Text style={cm.title}>✦ Chef Pairings</Text>
              {entree && <Text style={cm.subtitle}>For {entree.name}</Text>}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Text style={cm.close}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={cm.loading}>
              <ActivityIndicator color={Colors.gold} />
              <Text style={cm.loadingText}>Finding the best pairings…</Text>
            </View>
          ) : suggestions.length === 0 ? (
            <View style={cm.empty}>
              <Text style={cm.emptyTitle}>Pairings Coming Soon</Text>
              <Text style={cm.emptySub}>
                Chef-curated sides for this recipe are being added. Check back soon.
              </Text>
            </View>
          ) : (
            <ScrollView style={cm.list} contentContainerStyle={cm.listContent}>
              {suggestions.map(side => (
                <TouchableOpacity key={side.id} style={cm.sideRow} onPress={() => { onAdd(side); onClose(); }} activeOpacity={0.75}>
                  {side.photo_url
                    ? <Image source={{ uri: side.photo_url }} style={cm.thumb} />
                    : <View style={[cm.thumb, { backgroundColor: side.placeholder_color }]} />}
                  <View style={cm.sideInfo}>
                    <Text style={cm.sideName}>{side.name}</Text>
                    <Text style={cm.sideMeta}>
                      {[side.cuisine, side.prep_time ? `${side.prep_time} min` : null].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={cm.addText}>Add</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end' },
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:       { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 32, borderWidth: 1, borderBottomWidth: 0, borderColor: Colors.gold },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:       { fontFamily: Fonts.display, fontSize: 22, color: Colors.gold },
  subtitle:    { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted, marginTop: 2 },
  close:       { color: Colors.textMuted, fontSize: 18, paddingTop: 4 },
  loading:     { padding: 40, alignItems: 'center', gap: 12 },
  loadingText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
  list:        { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 8 },
  sideRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  thumb:       { width: 56, height: 42, borderRadius: 8, backgroundColor: Colors.surfaceElevated },
  sideInfo:    { flex: 1, gap: 3 },
  sideName:    { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary },
  sideMeta:    { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  addText:     { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.gold },
  empty:       { padding: 32, alignItems: 'center', gap: 12 },
  emptyTitle:  { fontFamily: Fonts.display, fontSize: 22, color: Colors.textPrimary },
  emptySub:    { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});

// ─────────────────────────────────────────────
// MealPlanScreen — main export
// ─────────────────────────────────────────────

export default function MealPlanScreen() {
  const navigation   = useNavigation<any>();
  const { profile, savedRecipeIds } = useUser();
  const { syncMealPlan } = useMenu();
  const isPaid = profile.tier === 'paid';

  // Week
  const [weekOffset, setWeekOffset] = useState(0);

  // Setup
  const [setupDone,    setSetupDone]    = useState(false);
  const [setupAnswers, setSetupAnswers] = useState<SetupAnswers | null>(null);

  // Recipe data
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  const [allSides,     setAllSides]     = useState<Recipe[]>([]);

  // Plan
  const [plan, setPlan] = useState<WeekPlan>({});

  // Add recipe modal
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [addingRole,  setAddingRole]  = useState<'entree' | 'side'>('entree');

  // Chef sides modal
  const [chefSidesDay,         setChefSidesDay]         = useState<string | null>(null);
  const [chefSidesSuggestions, setChefSidesSuggestions] = useState<Recipe[]>([]);
  const [chefSidesLoading,     setChefSidesLoading]     = useState(false);

  // Premium upsell modal
  const [premiumVisible, setPremiumVisible] = useState(false);

  // Load saved recipes whenever IDs change
  useEffect(() => {
    if (savedRecipeIds.length === 0) { setSavedRecipes([]); return; }
    fetchRecipesByIds(savedRecipeIds).then(setSavedRecipes);
  }, [savedRecipeIds]);

  // Load CKC side dishes once (for Chef Sides pairing)
  useEffect(() => { fetchSideDishes().then(setAllSides); }, []);

  // ── Sync meal plan → ShopScreen (MenuContext) ────────────────────────────────
  // Any time the plan changes (auto-build, manual add/remove), push all
  // entrees + sides into the shared shopping list so Shop tab stays in sync.
  useEffect(() => {
    if (!setupDone) return;
    const items: AddMenuItemInput[] = [];
    Object.values(plan).forEach(dayMeal => {
      if (dayMeal.entree) {
        items.push({
          recipeId:   dayMeal.entree.id,
          recipeName: dayMeal.entree.name,
          recipeImage:dayMeal.entree.photo_url ?? undefined,
          recipeType: 'entree',
          source:     'mealplan',
        });
      }
      dayMeal.sides.forEach(slot => {
        const side = slot.options[slot.optIdx];
        items.push({
          recipeId:   side.id,
          recipeName: side.name,
          recipeImage:side.photo_url ?? undefined,
          recipeType: 'side',
          source:     'mealplan',
        });
      });
    });
    syncMealPlan(items);
  }, [plan, setupDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Setup complete: auto-build the week ──────────────────────────────────────

  function handleSetupComplete(answers: SetupAnswers) {
    setSetupAnswers(answers);
    const weekDates = getWeekDates(weekOffset);
    const entrees   = savedRecipes.filter(r => !r.meal_type || r.meal_type === 'entree');
    setPlan(buildPlan(weekDates, entrees, answers, profile.protocols));
    setSetupDone(true);
  }

  // ── Week navigation ──────────────────────────────────────────────────────────

  function changeWeek(dir: 1 | -1) {
    const newOffset = weekOffset + dir;
    setWeekOffset(newOffset);
    if (setupAnswers) {
      const newDates = getWeekDates(newOffset);
      const entrees  = savedRecipes.filter(r => !r.meal_type || r.meal_type === 'entree');
      setPlan(buildPlan(newDates, entrees, setupAnswers, profile.protocols));
    }
  }

  // ── Plan mutation helpers ────────────────────────────────────────────────────

  function handleSelectRecipe(recipe: Recipe) {
    if (!addingToDay) return;
    const key = addingToDay;
    setPlan(p => {
      const day = p[key] || { entree: null, sides: [] };
      if (addingRole === 'entree') return { ...p, [key]: { ...day, entree: recipe } };
      if (day.sides.find(s => s.options[s.optIdx].id === recipe.id)) return p;
      // Manually added sides get no alternatives (no ↻ button)
      const slot: SideSlot = { options: [recipe], optIdx: 0 };
      return { ...p, [key]: { ...day, sides: [...day.sides, slot] } };
    });
    setAddingToDay(null);
  }

  function handleRemoveEntree(key: string) {
    setPlan(p => ({ ...p, [key]: { ...(p[key] || { entree: null, sides: [] }), entree: null } }));
  }

  function handleRemoveSide(key: string, sideId: string) {
    setPlan(p => ({
      ...p,
      [key]: { ...(p[key] || { entree: null, sides: [] }), sides: (p[key]?.sides || []).filter(s => s.options[s.optIdx].id !== sideId) },
    }));
  }

  function handleCycleSide(key: string, idx: number) {
    setPlan(p => {
      const day = p[key];
      if (!day) return p;
      const sides = [...day.sides];
      const slot  = sides[idx];
      if (!slot || slot.options.length <= 1) return p;
      sides[idx] = { ...slot, optIdx: (slot.optIdx + 1) % slot.options.length };
      return { ...p, [key]: { ...day, sides } };
    });
  }

  // ── Chef sides ───────────────────────────────────────────────────────────────

  function handleChefSides(key: string) {
    const entree = plan[key]?.entree;
    if (!entree) return;
    setChefSidesDay(key);
    setChefSidesLoading(true);
    setChefSidesSuggestions([]);
    // Run pairing logic (sync — no network call needed since allSides already loaded)
    const suggestions = getSuggestedSides(entree, allSides, profile.protocols);
    setChefSidesSuggestions(suggestions);
    setChefSidesLoading(false);
  }

  function handleAddChefSide(side: Recipe) {
    if (!chefSidesDay) return;
    const key    = chefSidesDay;
    const entree = plan[key]?.entree;
    const alts   = entree ? computeAlternatives(side, allSides, entree, profile.protocols) : [];
    const slot: SideSlot = { options: [side, ...alts], optIdx: 0 };
    setPlan(p => {
      const day = p[key] || { entree: null, sides: [] };
      if (day.sides.find(s => s.options[s.optIdx].id === side.id)) return p;
      return { ...p, [key]: { ...day, sides: [...day.sides, slot] } };
    });
  }

  // ── Render: setup flow ───────────────────────────────────────────────────────

  if (!setupDone) {
    return (
      <View style={s.root}>
        <SetupFlow isPaid={isPaid} onComplete={handleSetupComplete} />
      </View>
    );
  }

  // ── Render: main week view ───────────────────────────────────────────────────

  const weekDates   = getWeekDates(weekOffset);
  const displayDays = setupAnswers ? weekDates.slice(0, setupAnswers.days) : weekDates;
  const weekLabel   = weekOffset === 0 ? 'This Week'
    : weekOffset ===  1 ? 'Next Week'
    : weekOffset === -1 ? 'Last Week'
    : formatWeekRange(weekDates);

  // What to show in the add-recipe modal: entrees from saved, or all saved for sides
  const modalRecipes = addingRole === 'entree'
    ? savedRecipes.filter(r => !r.meal_type || r.meal_type === 'entree')
    : savedRecipes;

  return (
    <SafeAreaView style={s.root} edges={['top']}>

      {/* ── Header ── */}
      <View style={s.header}>
        <Text style={s.title}>Meal Plan</Text>
        <View style={s.weekNav}>
          <TouchableOpacity onPress={() => changeWeek(-1)} style={s.navBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.weekLabel}>{weekLabel}</Text>
          <TouchableOpacity onPress={() => changeWeek(1)} style={s.navBtn} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Day cards ── */}
        {displayDays.map((date, i) => {
          const key      = toDateKey(date);
          const meal     = plan[key] || { entree: null, sides: [] };
          const isLocked = !isPaid && i >= FREE_DAY_LIMIT;

          return (
            <DayCard
              key={key}
              date={date}
              meal={meal}
              isLocked={isLocked}
              isPaid={isPaid}
              onAddEntree={() => { setAddingToDay(key); setAddingRole('entree'); }}
              onAddSide={()   => { setAddingToDay(key); setAddingRole('side');   }}
              onRemoveEntree={() => handleRemoveEntree(key)}
              onRemoveSide={id  => handleRemoveSide(key, id)}
              onCycleSide={idx  => handleCycleSide(key, idx)}
              onChefSides={() => handleChefSides(key)}
              onUpgrade={() => setPremiumVisible(true)}
            />
          );
        })}

        {/* ── Free user upgrade prompt ── */}
        {!isPaid && (
          <PremiumGate
            title="Plan Your Full Week"
            body="Upgrade to plan up to 7 days, unlock Private Chef side pairings, and get a full shopping list built automatically."
            features={[
              '7-day meal calendar with live dates',
              'Private Chef curated side pairings',
              'Consolidated shopping list in the Shop tab',
            ]}
          />
        )}

        {/* ── Replan nudge ── */}
        <TouchableOpacity style={s.replanBtn} onPress={() => setSetupDone(false)} activeOpacity={0.75}>
          <Text style={s.replanBtnText}>↺  Replan this week</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Add recipe modal ── */}
      <AddRecipeModal
        visible={addingToDay !== null}
        recipes={modalRecipes}
        role={addingRole}
        onSelect={handleSelectRecipe}
        onClose={() => setAddingToDay(null)}
        onGoSwipe={() => navigation.navigate('Discover')}
      />

      {/* ── Chef sides modal ── */}
      <ChefSidesModal
        visible={chefSidesDay !== null}
        entree={chefSidesDay ? (plan[chefSidesDay]?.entree ?? null) : null}
        suggestions={chefSidesSuggestions}
        loading={chefSidesLoading}
        onAdd={handleAddChefSide}
        onClose={() => setChefSidesDay(null)}
      />

      {/* ── Premium upsell modal ── */}
      <Modal visible={premiumVisible} transparent animationType="fade" onRequestClose={() => setPremiumVisible(false)}>
        <View style={s.premiumOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setPremiumVisible(false)} activeOpacity={1} />
          <View style={s.premiumCard}>
            <PremiumGate
              title="Private Chef Sides"
              body="Let our chef's pairing intelligence suggest the perfect sides — filtered for your dietary protocols and cuisine style."
              features={[
                'Chef-curated side pairings per meal',
                'Protocol-compliant suggestions only',
                'Full 7-day planning + shopping list',
              ]}
              onPress={() => setPremiumVisible(false)}
            />
            <TouchableOpacity onPress={() => setPremiumVisible(false)} style={s.premiumDismiss}>
              <Text style={s.premiumDismissText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.bg },

  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12, gap: 6, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title:  { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary },

  weekNav:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navBtn:    { paddingVertical: 2 },
  navArrow:  { fontFamily: Fonts.body, fontSize: 22, color: Colors.textMuted, lineHeight: 28 },
  weekLabel: { flex: 1, fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48, gap: 12 },

  replanBtn:     { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  replanBtnText: { fontFamily: Fonts.body, fontSize: 13, color: Colors.textMuted },

  premiumOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  premiumCard:    { width: '100%', maxWidth: 380, gap: 16 },
  premiumDismiss: { alignSelf: 'center' },
  premiumDismissText: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted },
});
