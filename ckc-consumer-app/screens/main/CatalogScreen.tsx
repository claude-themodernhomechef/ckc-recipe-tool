/**
 * CatalogScreen
 *
 * Filters:
 *   • Diet protocol colored chips (row, always visible)
 *   • Protein / Cuisine / Meal Type / Blogger — styled dropdown selects
 *
 * Tap any row → opens recipe URL in the browser.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  ActivityIndicator,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import { fetchCatalogRecipes } from '../../lib/firestore';
import { Recipe, getComplianceStatus } from '../../data/sampleRecipes';
import { DIET_COLORS } from '../components/DietTag';
import { formatRating } from '../../lib/ingredientParser';

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────

const DIET_PROTOCOLS = ['GF', 'DF', 'LF', 'K', 'AIP', 'V', 'Vg', 'LH'];

const PROTEINS = [
  'Chicken', 'Beef', 'Fish', 'Seafood', 'Pork',
  'Lamb', 'Vegetarian', 'Tofu', 'Pasta',
];

const MEAL_TYPES = [
  'Entree', 'Side', 'Salad', 'Soup', 'Sauce', 'Breakfast', 'Dessert',
];

// ─────────────────────────────────────────────
//  Diet pill (for recipe row tags)
// ─────────────────────────────────────────────

function DietPill({ protocol, mod }: { protocol: string; mod: boolean }) {
  const color = (DIET_COLORS as Record<string, string>)[protocol] || Colors.textMuted;
  return (
    <View style={[pill.wrap, { borderColor: color + '66', backgroundColor: color + '1a' }]}>
      {mod && <View style={[pill.dot, { backgroundColor: color }]} />}
      <Text style={[pill.text, { color }]}>{protocol}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 100, borderWidth: 1 },
  dot:  { width: 4, height: 4, borderRadius: 2 },
  text: { fontFamily: Fonts.bodyMedium, fontSize: 10, letterSpacing: 0.4 },
});

// ─────────────────────────────────────────────
//  Diet filter chip (protocol selector row)
// ─────────────────────────────────────────────

function DietChip({ protocol, active, onPress }: { protocol: string; active: boolean; onPress: () => void }) {
  const color = (DIET_COLORS as Record<string, string>)[protocol] || Colors.textPrimary;
  return (
    <TouchableOpacity
      style={[dc.wrap, active && { borderColor: color, backgroundColor: color + '22' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[dc.text, { color: active ? color : Colors.textSecondary }]}>{protocol}</Text>
    </TouchableOpacity>
  );
}
const dc = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1.5, borderColor: Colors.border, marginRight: 6 },
  text: { fontFamily: Fonts.bodyMedium, fontSize: 12 },
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
  btnText:      { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary, maxWidth: 90 },
  btnTextActive:{ fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  arrow:        { fontFamily: Fonts.body, fontSize: 10, color: Colors.textMuted },
  arrowActive:  { color: Colors.textPrimary },

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
  sheetTitle:   { fontFamily: Fonts.display, fontSize: 18, color: Colors.textPrimary },
  clearBtn:     { fontFamily: Fonts.bodyMedium, fontSize: 13, color: Colors.textSecondary },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  optionActive: { backgroundColor: Colors.surfaceElevated },
  optionText:   { fontFamily: Fonts.body, fontSize: 15, color: Colors.textSecondary },
  optionTextActive: { fontFamily: Fonts.bodyMedium, color: Colors.textPrimary },
  check: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.green },
});

// ─────────────────────────────────────────────
//  Recipe row
// ─────────────────────────────────────────────

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const activeDietTags = DIET_PROTOCOLS
    .map(p => ({ p, status: getComplianceStatus(recipe, p) }))
    .filter(t => t.status !== 'none');

  return (
    <TouchableOpacity
      style={row.wrap}
      onPress={() => { if (recipe.url) Linking.openURL(recipe.url); }}
      activeOpacity={0.75}
    >
      <View style={[row.thumb, { backgroundColor: recipe.placeholder_color }]}>
        {recipe.photo_url ? (
          <Image source={{ uri: recipe.photo_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        ) : null}
      </View>

      <View style={row.info}>
        <Text style={row.name} numberOfLines={1}>{recipe.name}</Text>
        <Text style={row.meta} numberOfLines={1}>
          {[
            recipe.cuisine,
            recipe.protein_type,
            recipe.prep_time ? `${recipe.prep_time} min` : null,
            recipe.blogger,
          ].filter(Boolean).join('  ·  ')}
        </Text>
        {activeDietTags.length > 0 && (
          <View style={row.tags}>
            {activeDietTags.slice(0, 6).map(t => (
              <DietPill key={t.p} protocol={t.p} mod={t.status === 'modified'} />
            ))}
          </View>
        )}
      </View>

      {formatRating(recipe.rating) ? (
        <Text style={row.rating}>★ {formatRating(recipe.rating)}</Text>
      ) : null}
    </TouchableOpacity>
  );
}
const row = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  thumb:  { width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0 },
  info:   { flex: 1, gap: 3 },
  name:   { fontFamily: Fonts.display, fontSize: 17, color: Colors.textPrimary },
  meta:   { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  tags:   { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  rating: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.gold, flexShrink: 0 },
});

// ─────────────────────────────────────────────
//  Main screen
// ─────────────────────────────────────────────

export default function CatalogScreen() {
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search,  setSearch]        = useState('');

  const [filterDiet,     setFilterDiet]     = useState('');
  const [filterMealType, setFilterMealType] = useState('');
  const [filterProtein,  setFilterProtein]  = useState('');
  const [filterCuisine,  setFilterCuisine]  = useState('');
  const [filterBlogger,  setFilterBlogger]  = useState('');

  useEffect(() => {
    fetchCatalogRecipes().then(r => { setAllRecipes(r); setLoading(false); });
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
      if (filterDiet && getComplianceStatus(r, filterDiet) === 'none') return false;
      if (filterMealType && (r.meal_type || '').toLowerCase() !== filterMealType.toLowerCase()) return false;
      if (filterProtein && r.protein_type !== filterProtein) return false;
      if (filterCuisine && r.cuisine !== filterCuisine) return false;
      if (filterBlogger && r.blogger !== filterBlogger) return false;
      return true;
    });
  }, [allRecipes, search, filterDiet, filterMealType, filterProtein, filterCuisine, filterBlogger]);

  function clearAll() {
    setFilterDiet(''); setFilterMealType(''); setFilterProtein('');
    setFilterCuisine(''); setFilterBlogger(''); setSearch('');
  }

  const hasFilters = filterDiet || filterMealType || filterProtein || filterCuisine || filterBlogger;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Recipe Catalog</Text>
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

      {/* ── Diet chips ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dietRow}>
        {DIET_PROTOCOLS.map(p => (
          <DietChip
            key={p} protocol={p} active={filterDiet === p}
            onPress={() => setFilterDiet(filterDiet === p ? '' : p)}
          />
        ))}
      </ScrollView>

      {/* ── Dropdown filter row ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dropdownRow}>
        <Dropdown
          label="All Proteins" value={filterProtein}
          options={PROTEINS} onSelect={setFilterProtein}
        />
        <Dropdown
          label="All Cuisines" value={filterCuisine}
          options={cuisines} onSelect={setFilterCuisine}
        />
        <Dropdown
          label="All Types" value={filterMealType}
          options={MEAL_TYPES} onSelect={setFilterMealType}
        />
        <Dropdown
          label="All Bloggers" value={filterBlogger}
          options={bloggers} onSelect={setFilterBlogger}
        />
      </ScrollView>

      {/* ── Recipe list ── */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.textSecondary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No recipes found</Text>
          <Text style={styles.emptyBody}>Try adjusting your filters.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => r.id}
          renderItem={({ item }) => <RecipeRow recipe={item} />}
          contentContainerStyle={styles.list}
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
  screen:   { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

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

  dietRow:     { paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  dropdownRow: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },

  list:       { paddingBottom: 40 },
  emptyTitle: { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary },
  emptyBody:  { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary },
});
