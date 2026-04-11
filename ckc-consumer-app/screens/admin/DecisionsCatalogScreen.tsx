/**
 * DecisionsCatalogScreen
 *
 * Read-only view of the Firestore `decisions` collection.
 * Same filter UI as CatalogScreen — diet chips, status chips, dropdowns, search.
 * Accessible at /catalog/decisions on web.
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import { fetchDecisionsCollection, updateDietTagInDecisions } from '../../lib/firestore';
import { Recipe, getComplianceStatus } from '../../data/sampleRecipes';
import DietTag, { DIET_COLORS } from '../components/DietTag';
import { formatRating } from '../../lib/ingredientParser';

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const DIET_PROTOCOLS = ['AIP', 'DF', 'GF', 'K', 'LF', 'LH', 'V', 'Vg'];

const STATUS_OPTIONS = ['yes', 'no', 'maybe', 'pending'] as const;
type StatusOption = typeof STATUS_OPTIONS[number];

const STATUS_LABELS: Record<StatusOption, string> = {
  yes:     'Approved',
  no:      'Rejected',
  maybe:   'Maybe',
  pending: 'Pending',
};

const STATUS_COLORS: Record<StatusOption, string> = {
  yes:     '#7cb87a',
  no:      '#e07878',
  maybe:   '#d4a843',
  pending: '#888888',
};

const PROTEINS = [
  'Chicken', 'Beef', 'Fish', 'Seafood', 'Pork',
  'Lamb', 'Vegetarian', 'Tofu', 'Pasta',
];

const MEAL_TYPES = [
  'Entree', 'Side', 'Salad', 'Soup', 'Sauce', 'Breakfast', 'Dessert',
];

// ─────────────────────────────────────────────
//  Diet filter chip
// ─────────────────────────────────────────────

function DietChip({ protocol, active, onPress }: { protocol: string; active: boolean; onPress: () => void }) {
  const color = (DIET_COLORS as Record<string, string>)[protocol] || Colors.textPrimary;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        dc.circle,
        { borderColor: color },
        active
          ? { backgroundColor: color }
          : { backgroundColor: color + '28' },
      ]}
    >
      <Text style={[dc.text, { color: active ? '#0f0f0d' : color }]}>{protocol}</Text>
    </TouchableOpacity>
  );
}
const dc = StyleSheet.create({
  circle: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: 6,
  },
  text: { fontFamily: Fonts.bodyMedium, fontSize: 9, letterSpacing: 0.3 },
  clearBtn: {
    height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5,
    borderColor: Colors.border, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surface, marginRight: 6,
  },
  clearText: { fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.textSecondary },
});

// ─────────────────────────────────────────────
//  Dropdown select
// ─────────────────────────────────────────────

function Dropdown({
  label,
  value,
  options,
  onSelect,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const display = value || label;
  const isActive = Boolean(value);

  return (
    <View>
      <TouchableOpacity
        style={[dd.btn, isActive && dd.btnActive]}
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
      >
        <Text style={[dd.btnText, isActive && dd.btnTextActive]} numberOfLines={1}>
          {display}
        </Text>
        <Text style={[dd.arrow, isActive && dd.arrowActive]}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={dd.backdrop} onPress={() => setOpen(false)}>
          <View style={dd.sheet}>
            <View style={dd.sheetHeader}>
              <Text style={dd.sheetTitle}>{label}</Text>
              {value ? (
                <TouchableOpacity onPress={() => { onSelect(''); setOpen(false); }}>
                  <Text style={dd.clearBtn}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <FlatList
              data={options}
              keyExtractor={o => o}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <TouchableOpacity
                    style={[dd.option, selected && dd.optionActive]}
                    onPress={() => { onSelect(item); setOpen(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[dd.optionText, selected && dd.optionTextActive]}>{item}</Text>
                    {selected && <Text style={dd.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const dd = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  btnActive: { borderColor: Colors.borderActive, backgroundColor: Colors.surfaceElevated },
  btnText:       { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, maxWidth: 90 },
  btnTextActive: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  arrow:         { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  arrowActive:   { color: Colors.textPrimary },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingBottom: 32, maxHeight: 480,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sheetTitle:    { fontFamily: Fonts.display, fontSize: 18, color: Colors.textPrimary },
  clearBtn:      { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  optionActive:     { backgroundColor: Colors.surfaceElevated },
  optionText:       { fontFamily: Fonts.body, fontSize: 15, color: Colors.textSecondary },
  optionTextActive: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  check: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.green },
});

// ─────────────────────────────────────────────
//  Claude swap-note regeneration
// ─────────────────────────────────────────────

const ANTHROPIC_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? '';

const REGEN_SYSTEM = `You rewrite diet compliance modification notes for recipes.

Style rules:
- Imperative sentences: "Replace X with Y.", "Remove X entirely.", "Use X instead of Y."
- Specific quantities when known
- Note what stays compliant when helpful
- No bullet points, no headers, no markdown
- No mention of diet protocol names within the note
- End with a period`;

async function regenerateNote(recipeName: string, protocol: string, currentNote: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: REGEN_SYSTEM,
      messages: [{
        role: 'user',
        content: `Recipe: ${recipeName}\nProtocol: ${protocol}\nCurrent note: ${currentNote || '(none)'}\n\nRewrite a correct, specific modification note for this protocol. Focus on what ingredients to swap or remove.`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);
  const data = await res.json();
  return (data.content?.[0]?.text ?? '').trim();
}

// ─────────────────────────────────────────────
//  Recipe row
// ─────────────────────────────────────────────

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const [activeProtocol, setActiveProtocol] = useState<string | null>(null);
  const [noteText, setNoteText]             = useState('');
  const [originalNote, setOriginalNote]     = useState('');
  const [isNative, setIsNative]             = useState(false);
  const [saveState, setSaveState]           = useState<'idle' | 'saving' | 'saved'>('idle');
  const [generating, setGenerating]         = useState(false);
  const debounceRef                         = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeDietTags = DIET_PROTOCOLS
    .map(p => ({ p, status: getComplianceStatus(recipe, p) }))
    .filter(t => t.status !== 'none')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'native' ? -1 : 1;
      return a.p.localeCompare(b.p);
    });

  function handleTagPress(protocol: string) {
    if (activeProtocol === protocol) {
      setActiveProtocol(null);
      return;
    }
    const tag = recipe.dietTags[protocol];
    const note = tag?.notes ?? '';
    setActiveProtocol(protocol);
    setNoteText(note);
    setOriginalNote(note);
    setIsNative(tag?.native === true);
    setSaveState('idle');
  }

  const saveToFirestore = useCallback(async (protocol: string, native: boolean, note: string) => {
    setSaveState('saving');
    try {
      await updateDietTagInDecisions(recipe.id, protocol, {
        native,
        mod: !native,
        notes: note,
      });
      setSaveState('saved');
    } catch (e) {
      console.warn('updateDietTagInDecisions failed:', e);
      setSaveState('idle');
    }
  }, [recipe.id]);

  function handleNoteChange(text: string) {
    setNoteText(text);
    setSaveState('idle');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (activeProtocol) saveToFirestore(activeProtocol, isNative, text);
    }, 800);
  }

  async function handleTypeToggle(native: boolean) {
    setIsNative(native);
    if (activeProtocol) await saveToFirestore(activeProtocol, native, noteText);
  }

  async function handleRegenerate() {
    if (!activeProtocol) return;
    setGenerating(true);
    try {
      const note = await regenerateNote(recipe.name, activeProtocol, noteText);
      setNoteText(note);
      await saveToFirestore(activeProtocol, isNative, note);
    } catch (e) {
      console.warn('regenerateNote failed:', e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRestore() {
    if (!activeProtocol) return;
    setNoteText(originalNote);
    await saveToFirestore(activeProtocol, isNative, originalNote);
  }

  return (
    <View style={row.wrap}>
      {/* Thumbnail */}
      <View style={[row.thumb, { backgroundColor: recipe.placeholder_color }]}>
        {recipe.photo_url ? (
          <Image source={{ uri: recipe.photo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}
      </View>

      {/* Info */}
      <View style={row.info}>
        <Text style={row.name} numberOfLines={1}>{recipe.name}</Text>
        <Text style={row.meta} numberOfLines={1}>
          {[recipe.cuisine, recipe.protein_type, recipe.blogger].filter(Boolean).join('  ·  ')}
        </Text>
        {activeDietTags.length > 0 && (
          <View style={row.tags}>
            {activeDietTags.map(t => (
              <TouchableOpacity key={t.p} onPress={() => handleTagPress(t.p)} activeOpacity={0.7}>
                <DietTag protocol={t.p} variant="circle" status={t.status === 'modified' ? 'modified' : 'native'} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Expanded note editor */}
        {activeProtocol && (
          <View style={row.noteBox}>
            {/* Header: protocol + regenerate + restore */}
            <View style={row.noteHeader}>
              <Text style={row.noteProtocol}>{activeProtocol}</Text>
              <View style={row.noteHeaderBtns}>
                {noteText !== originalNote && (
                  <TouchableOpacity style={row.restoreBtn} onPress={handleRestore} activeOpacity={0.7}>
                    <Text style={row.restoreBtnText}>↺ Restore</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={row.regenBtn} onPress={handleRegenerate} disabled={generating} activeOpacity={0.7}>
                  {generating
                    ? <ActivityIndicator size="small" color={Colors.gold} />
                    : <Text style={row.regenBtnText}>✦ Regenerate</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {/* Native / Mod toggle */}
            <View style={row.typeToggle}>
              <TouchableOpacity
                style={[row.typeBtn, isNative && row.typeBtnActive]}
                onPress={() => handleTypeToggle(true)}
                activeOpacity={0.7}
              >
                <Text style={[row.typeBtnText, isNative && row.typeBtnTextActive]}>● Native</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[row.typeBtn, !isNative && row.typeBtnActive]}
                onPress={() => handleTypeToggle(false)}
                activeOpacity={0.7}
              >
                <Text style={[row.typeBtnText, !isNative && row.typeBtnTextActive]}>◎ Mod</Text>
              </TouchableOpacity>
            </View>

            {/* Editable note */}
            <TextInput
              style={row.noteInput}
              value={noteText}
              onChangeText={handleNoteChange}
              multiline
              placeholder={isNative ? 'Native — no swap needed.' : 'Describe the swap…'}
              placeholderTextColor={Colors.textMuted}
            />

            {/* Save status */}
            {saveState === 'saving' && <Text style={row.saveStatus}>Saving…</Text>}
            {saveState === 'saved'  && <Text style={[row.saveStatus, { color: Colors.green }]}>Saved ✓</Text>}
          </View>
        )}
      </View>

      {/* URL button */}
      {recipe.url ? (
        <TouchableOpacity
          style={row.urlBtn}
          onPress={() => { if (typeof window !== 'undefined') window.open(recipe.url, '_blank'); }}
          activeOpacity={0.7}
        >
          <Text style={row.urlBtnText}>View Recipe ↗</Text>
        </TouchableOpacity>
      ) : null}

      {/* Right: status + rating */}
      <View style={row.right}>
        {recipe.status ? (() => {
          const s = recipe.status as StatusOption;
          const color = STATUS_COLORS[s] ?? '#888';
          return (
            <View style={[row.statusBadge, { borderColor: color, backgroundColor: color + '22' }]}>
              <Text style={[row.statusText, { color }]}>{STATUS_LABELS[s] ?? s}</Text>
            </View>
          );
        })() : null}
        {formatRating(recipe.rating) ? (
          <Text style={row.rating}>★ {formatRating(recipe.rating)}</Text>
        ) : null}
      </View>
    </View>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  thumb:  { width: 48, height: 48, borderRadius: 7, overflow: 'hidden', flexShrink: 0 },
  info:   { flex: 1, gap: 3 },
  name:   { fontFamily: Fonts.display, fontSize: 17, color: Colors.textPrimary },
  meta:   { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  tags:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  right:  { flexShrink: 0, alignItems: 'flex-end', gap: 4 },
  noteBox: {
    marginTop: 6,
    backgroundColor: Colors.surfaceElevated,
    borderLeftWidth: 2, borderLeftColor: Colors.borderActive,
    borderRadius: 4,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  noteProtocol: { fontFamily: Fonts.bodyMedium, fontSize: 10, color: Colors.textMuted, letterSpacing: 0.5 },
  noteText:     { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, lineHeight: 17 },
  noteHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6,
  },
  noteHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  restoreBtn: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 5, borderWidth: 1, borderColor: Colors.border,
  },
  restoreBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 10, color: Colors.textMuted },
  regenBtn: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 5, borderWidth: 1, borderColor: Colors.borderActive,
  },
  regenBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 10, color: Colors.gold },
  typeToggle: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  typeBtn: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 5, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  typeBtnActive:    { borderColor: Colors.borderActive, backgroundColor: Colors.surfaceElevated },
  typeBtnText:      { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  typeBtnTextActive:{ fontFamily: Fonts.bodyMedium, fontSize: 11, color: Colors.textPrimary },
  noteInput: {
    fontFamily: Fonts.body, fontSize: 12, color: Colors.textPrimary,
    backgroundColor: Colors.bg, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 5, paddingHorizontal: 8, paddingVertical: 6,
    minHeight: 56, textAlignVertical: 'top',
  },
  saveStatus: { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted, marginTop: 3 },
  urlBtn: {
    flexShrink: 0, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 6, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  urlBtnText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textSecondary },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  statusText:  { fontFamily: Fonts.bodyMedium, fontSize: 10, letterSpacing: 0.3 },
  rating: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.gold },
});

const sc = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 100, borderWidth: 1.5,
    marginRight: 6,
  },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  label: { fontFamily: Fonts.bodyMedium, fontSize: 11 },
});

// ─────────────────────────────────────────────
//  Main screen
// ─────────────────────────────────────────────

export default function DecisionsCatalogScreen() {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search,  setSearch]        = useState('');

  const [filterDiets,    setFilterDiets]    = useState<Set<string>>(new Set());
  const [filterMealType, setFilterMealType] = useState('');
  const [filterProtein,  setFilterProtein]  = useState('');
  const [filterCuisine,  setFilterCuisine]  = useState('');
  const [filterBlogger,  setFilterBlogger]  = useState('');
  const [filterStatus,   setFilterStatus]   = useState<StatusOption | ''>('');

  useEffect(() => {
    fetchDecisionsCollection().then(r => { setAllRecipes(r); setLoading(false); });
  }, []);

  const cuisines = useMemo(() =>
    Array.from(new Set(allRecipes.map(r => r.cuisine).filter(Boolean))).sort(),
  [allRecipes]);

  const bloggers = useMemo(() =>
    Array.from(new Set(allRecipes.map(r => r.blogger).filter(Boolean))).sort(),
  [allRecipes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allRecipes.filter(r => {
      if (q && ![r.name, r.blogger, r.cuisine, r.protein_type].some(
        s => (s || '').toLowerCase().includes(q),
      )) return false;
      if (filterDiets.size > 0 && ![...filterDiets].every(d => getComplianceStatus(r, d) !== 'none')) return false;
      if (filterMealType && (r.meal_type || '').toLowerCase() !== filterMealType.toLowerCase()) return false;
      if (filterProtein && r.protein_type !== filterProtein) return false;
      if (filterCuisine && r.cuisine !== filterCuisine) return false;
      if (filterBlogger && r.blogger !== filterBlogger) return false;
      if (filterStatus && (r.status || 'yes') !== filterStatus) return false;
      return true;
    });
  }, [allRecipes, search, filterDiets, filterMealType, filterProtein, filterCuisine, filterBlogger, filterStatus]);

  function clearAll() {
    setFilterDiets(new Set()); setFilterMealType(''); setFilterProtein('');
    setFilterCuisine(''); setFilterBlogger(''); setSearch(''); setFilterStatus('');
  }

  const hasFilters = filterDiets.size > 0 || filterMealType || filterProtein || filterCuisine || filterBlogger || filterStatus;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Decisions</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{filtered.length} of {allRecipes.length}</Text>
          {hasFilters && (
            <TouchableOpacity onPress={clearAll} activeOpacity={0.7}>
              <Text style={styles.clearAll}>Clear filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Search ── */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes, blogger, cuisine…"
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* ── Filters ── */}
      <View style={styles.filterSection}>
        {/* Diet chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dietRow}>
          {DIET_PROTOCOLS.map(p => (
            <DietChip
              key={p} protocol={p} active={filterDiets.has(p)}
              onPress={() => setFilterDiets(prev => {
                const next = new Set(prev);
                next.has(p) ? next.delete(p) : next.add(p);
                return next;
              })}
            />
          ))}
          <TouchableOpacity onPress={() => setFilterDiets(new Set())} activeOpacity={0.7} style={dc.clearBtn}>
            <Text style={dc.clearText}>Clear all</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.filterDivider} />

        {/* Status chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusRow}>
          {STATUS_OPTIONS.map(s => {
            const active = filterStatus === s;
            const color = STATUS_COLORS[s];
            return (
              <TouchableOpacity
                key={s}
                style={[sc.chip, { borderColor: color }, active && { backgroundColor: color + '33' }]}
                onPress={() => setFilterStatus(active ? '' : s)}
                activeOpacity={0.7}
              >
                <View style={[sc.dot, { backgroundColor: color }]} />
                <Text style={[sc.label, { color: active ? color : Colors.textSecondary }]}>
                  {STATUS_LABELS[s]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.filterDivider} />

        {/* Dropdown row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropdownRow}>
          <Dropdown label="All Proteins" value={filterProtein}  options={PROTEINS}    onSelect={setFilterProtein} />
          <Dropdown label="All Cuisines" value={filterCuisine}  options={cuisines}    onSelect={setFilterCuisine} />
          <Dropdown label="All Types"    value={filterMealType} options={MEAL_TYPES}  onSelect={setFilterMealType} />
          <Dropdown label="All Bloggers" value={filterBlogger}  options={bloggers}    onSelect={setFilterBlogger} />
        </ScrollView>
      </View>

      {/* ── Recipe list ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No decisions found</Text>
          <Text style={styles.emptyBody}>Try adjusting your filters.</Text>
        </View>
      ) : (
        <FlatList
          style={styles.flatList}
          data={filtered}
          keyExtractor={r => r.id}
          renderItem={({ item }) => <RecipeRow recipe={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCount: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  clearAll:    { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textSecondary },

  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchInput: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary,
  },

  filterSection: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 4,
  },
  filterDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16, marginBottom: 8 },
  dietRow:     { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, alignItems: 'center' },
  statusRow:   { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8, alignItems: 'center' },
  dropdownRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },

  flatList:    { flex: 1 },
  listContent: { paddingBottom: 40 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle:  { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary },
  emptyBody:   { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary },
});
