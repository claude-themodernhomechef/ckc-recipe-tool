/**
 * CatalogScreen
 *
 * Browsable, filterable list of all approved recipes.
 * Migrated from catalog.html.
 *
 * Filters: search · protein · cuisine · diet tag
 * Tap any row → opens the recipe URL in the browser.
 */

import React, { useState, useEffect, useMemo } from 'react';
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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import { fetchRecipes } from '../../lib/firestore';
import { Recipe, getComplianceStatus } from '../../data/sampleRecipes';
import { DIET_COLORS } from '../components/DietTag';
import { formatRating } from '../../lib/ingredientParser';

const SIDEBAR_WIDTH = 220;

const DIET_PROTOCOLS = ['GF', 'DF', 'LF', 'K', 'AIP', 'V', 'Vg', 'LH'];

const PROTEINS = ['Chicken', 'Beef', 'Fish', 'Seafood', 'Pork', 'Lamb', 'Vegetarian', 'Tofu', 'Pasta'];

// ── Diet tag pill ─────────────────────────────────────────────────────────────

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
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 100, borderWidth: 1,
  },
  dot:  { width: 4, height: 4, borderRadius: 2 },
  text: { fontFamily: Fonts.bodyMedium, fontSize: 10, letterSpacing: 0.4 },
});

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({
  label, active, color, onPress,
}: { label: string; active: boolean; color?: string; onPress: () => void }) {
  const c = color || Colors.textPrimary;
  return (
    <TouchableOpacity
      style={[chip.wrap, active && { borderColor: c, backgroundColor: c + '1a' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[chip.text, active && { color: c }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const chip = StyleSheet.create({
  wrap: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1.5,
    borderColor: Colors.border, marginRight: 6, marginBottom: 6,
  },
  text: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textSecondary },
});

// ── Recipe row ────────────────────────────────────────────────────────────────

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const activeDietTags = DIET_PROTOCOLS
    .map(p => ({ p, status: getComplianceStatus(recipe, p) }))
    .filter(t => t.status !== 'none');

  function openUrl() {
    if (recipe.url) Linking.openURL(recipe.url);
  }

  return (
    <TouchableOpacity style={row.wrap} onPress={openUrl} activeOpacity={0.75}>
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

      {/* Rating */}
      {formatRating(recipe.rating) ? (
        <Text style={row.rating}>★ {formatRating(recipe.rating)}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const row = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  thumb: { width: 52, height: 52, borderRadius: 8, overflow: 'hidden', flexShrink: 0 },
  info:  { flex: 1, gap: 3 },
  name:  { fontFamily: Fonts.display, fontSize: 17, color: Colors.textPrimary },
  meta:  { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },
  tags:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  rating: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.gold, flexShrink: 0 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function CatalogScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && windowWidth >= 900;

  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterProtein, setFilterProtein] = useState('');
  const [filterDiet, setFilterDiet]       = useState('');

  useEffect(() => {
    fetchRecipes(500).then(r => { setAllRecipes(r); setLoading(false); });
  }, []);

  // Derive unique cuisines from data
  const cuisines = useMemo(() => {
    const set = new Set(allRecipes.map(r => r.cuisine).filter(Boolean));
    return Array.from(set).sort();
  }, [allRecipes]);

  const [filterCuisine, setFilterCuisine] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allRecipes.filter(r => {
      if (q && !r.name.toLowerCase().includes(q) &&
               !r.blogger.toLowerCase().includes(q) &&
               !(r.cuisine || '').toLowerCase().includes(q)) return false;
      if (filterProtein && r.protein_type !== filterProtein) return false;
      if (filterCuisine && r.cuisine !== filterCuisine) return false;
      if (filterDiet) {
        const status = getComplianceStatus(r, filterDiet);
        if (status === 'none') return false;
      }
      return true;
    });
  }, [allRecipes, search, filterProtein, filterCuisine, filterDiet]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>

      {/* Header */}
      {!isDesktop && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Catalog</Text>
          <Text style={styles.headerCount}>{filtered.length} recipes</Text>
        </View>
      )}
      {isDesktop && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recipe Catalog</Text>
          <Text style={styles.headerCount}>{filtered.length} of {allRecipes.length}</Text>
        </View>
      )}

      {/* Search */}
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

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {/* Diet */}
        {DIET_PROTOCOLS.map(p => (
          <FilterChip
            key={p}
            label={p}
            active={filterDiet === p}
            color={(DIET_COLORS as Record<string, string>)[p]}
            onPress={() => setFilterDiet(filterDiet === p ? '' : p)}
          />
        ))}
        <View style={styles.filterDivider} />
        {/* Protein */}
        {PROTEINS.map(p => (
          <FilterChip
            key={p}
            label={p}
            active={filterProtein === p}
            onPress={() => setFilterProtein(filterProtein === p ? '' : p)}
          />
        ))}
        <View style={styles.filterDivider} />
        {/* Cuisine */}
        {cuisines.map(c => (
          <FilterChip
            key={c}
            label={c}
            active={filterCuisine === c}
            onPress={() => setFilterCuisine(filterCuisine === c ? '' : c)}
          />
        ))}
      </ScrollView>

      {/* Active filters summary */}
      {(filterProtein || filterDiet || filterCuisine) && (
        <View style={styles.activeFilters}>
          <Text style={styles.activeFiltersText}>
            Filtered by:{' '}
            {[filterDiet, filterProtein, filterCuisine].filter(Boolean).join(' · ')}
          </Text>
          <TouchableOpacity onPress={() => {
            setFilterProtein(''); setFilterDiet(''); setFilterCuisine('');
          }}>
            <Text style={styles.clearFilters}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* List */}
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

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },

  header: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  headerTitle: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary },
  headerCount: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },

  searchRow: { paddingHorizontal: 16, paddingBottom: 10 },
  searchInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary,
  },

  filterRow: { paddingHorizontal: 16, paddingBottom: 10, alignItems: 'center' },
  filterDivider: {
    width: 1, height: 20, backgroundColor: Colors.border, marginHorizontal: 6,
  },

  activeFilters: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  activeFiltersText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted },
  clearFilters: { fontFamily: Fonts.bodyMedium, fontSize: 12, color: Colors.textSecondary },

  list:       { paddingBottom: 40 },
  emptyTitle: { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary },
  emptyBody:  { fontFamily: Fonts.body, fontSize: 14, color: Colors.textSecondary },
});
