/**
 * ShopScreen — Full shopping list with ingredient aggregation and scaling.
 *
 * Pulls recipes from MenuContext, parses + consolidates their ingredients
 * using ingredientParser.ts, groups by category, and renders a checkable list.
 */

import React, { useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SectionList, Share, Platform, Modal, FlatList, TextInput,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../../constants/theme';
import EmptyState from '../components/EmptyState';
import { useMenu } from '../../context/MenuContext';
import { SAMPLE_RECIPES, Recipe, Ingredient } from '../../data/sampleRecipes';
import {
  parseIngredient, fmtQty, fmtNum, getDairyGroup,
  SHOPPING_CATEGORIES, normalizeProtein,
} from '../../lib/ingredientParser';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

interface AggregatedEntry {
  name: string;
  unitQtys: Record<string, number>;
  category: string;
  sources: string[];
}

interface SectionData {
  title: string;
  key: string;
  data: AggregatedEntry[];
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

    const scale = menuItem.servings; // servings is a multiplier (1 = base)

    for (const ing of recipe.ingredients) {
      // Handle both structured Ingredient objects and raw strings
      let parsed;
      if (typeof ing === 'string') {
        parsed = parseIngredient(ing as unknown as string);
      } else {
        // Structured: { name, quantity, unit }
        const structured = ing as Ingredient;
        parsed = {
          qty: structured.quantity,
          unit: structured.unit === 'pieces' ? '' : structured.unit,
          name: structured.name.toLowerCase(),
          category: 'pantry-staples',
          raw: `${structured.quantity} ${structured.unit} ${structured.name}`,
        };

      }

      if (!parsed.name) continue;

      const key = parsed.name;
      const scaledQty = parsed.qty * scale;
      const unit = parsed.unit || 'count';

      if (agg.has(key)) {
        const entry = agg.get(key)!;
        entry.unitQtys[unit] = (entry.unitQtys[unit] || 0) + scaledQty;
        if (!entry.sources.includes(menuItem.recipeName)) {
          entry.sources.push(menuItem.recipeName);
        }
      } else {
        agg.set(key, {
          name: key,
          unitQtys: { [unit]: scaledQty },
          category: parsed.category,
          sources: [menuItem.recipeName],
        });
      }
    }
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

// ─────────────────────────────────────────────
//  Serving stepper values
// ─────────────────────────────────────────────
const SERVING_STEPS = [0.5, 1, 2, 3, 4, 5];

// ─────────────────────────────────────────────
//  Component
// ─────────────────────────────────────────────

export default function ShopScreen() {
  const { menuItems, checkedItems, addToMenu, removeFromMenu, setServings, toggleChecked, uncheckAll, clearMenu, isInMenu } = useMenu();
  const [hideChecked, setHideChecked] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  // Use sample recipes as the data source (Firestore recipes load in DiscoverScreen)
  const allRecipes = SAMPLE_RECIPES;

  // ── Aggregate ingredients from all menu items ────────────────────────────
  const aggregated = useMemo(() => {
    return aggregateIngredients(menuItems, allRecipes);
  }, [menuItems, allRecipes]);

  // ── Build section list data ──────────────────────────────────────────────
  const sections: SectionData[] = useMemo(() => {
    return SHOPPING_CATEGORIES.map(cat => {
      let items = [...aggregated.values()].filter(e => e.category === cat.key);

      // Sort: protein/produce by name; dairy by group then name
      if (cat.key === 'dairy') {
        items.sort((a, b) => getDairyGroup(a.name) - getDairyGroup(b.name) || a.name.localeCompare(b.name));
      } else {
        items.sort((a, b) => a.name.localeCompare(b.name));
      }

      // Fallback: items with unknown category go to pantry-staples
      if (cat.key === 'pantry-staples') {
        const knownKeys = new Set(SHOPPING_CATEGORIES.map(c => c.key));
        const uncategorized = [...aggregated.values()].filter(e => !knownKeys.has(e.category));
        items = [...items, ...uncategorized].sort((a, b) => a.name.localeCompare(b.name));
      }

      if (hideChecked) {
        items = items.filter(e => !checkedItems.has(e.name));
      }

      return { title: cat.label, key: cat.key, data: items };
    }).filter(s => s.data.length > 0);
  }, [aggregated, checkedItems, hideChecked]);

  // ── Total item count ─────────────────────────────────────────────────────
  const totalItems = useMemo(() => [...aggregated.values()].length, [aggregated]);
  const checkedCount = useMemo(
    () => [...aggregated.values()].filter(e => checkedItems.has(e.name)).length,
    [aggregated, checkedItems],
  );

  // ── Copy list to clipboard ───────────────────────────────────────────────
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

  // ── Picker filtered recipes ──────────────────────────────────────────────
  const pickerRecipes = useMemo(() => {
    const q = pickerSearch.toLowerCase();
    return allRecipes.filter(r =>
      !isInMenu(r.id) &&
      (r.name.toLowerCase().includes(q) ||
        r.cuisine?.toLowerCase().includes(q) ||
        normalizeProtein(r.protein_type).toLowerCase().includes(q))
    );
  }, [allRecipes, pickerSearch, isInMenu]);

  // ─────────────────────────────────────────────
  //  Render
  // ─────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Shopping List</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => { setPickerSearch(''); setPickerVisible(true); }}>
            <Text style={styles.addBtnText}>+ Add Recipe</Text>
          </TouchableOpacity>
        </View>
        {menuItems.length > 0 && (
          <Text style={styles.subtitle}>
            {checkedCount}/{totalItems} items · {menuItems.length} {menuItems.length === 1 ? 'recipe' : 'recipes'}
          </Text>
        )}
      </View>

      {/* ── This Week's Menu strip ────────────────────────────────────────── */}
      {menuItems.length > 0 && (
        <View style={styles.menuStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuStripContent}>
            {menuItems.map(item => (
              <View key={item.recipeId} style={styles.menuChip}>
                <Text style={styles.menuChipName} numberOfLines={1}>{item.recipeName}</Text>
                <View style={styles.menuChipControls}>
                  <TouchableOpacity
                    onPress={() => {
                      const idx = SERVING_STEPS.indexOf(item.servings);
                      if (idx > 0) setServings(item.recipeId, SERVING_STEPS[idx - 1]);
                    }}
                    style={styles.stepperBtn}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.servingsLabel}>{item.servings}×</Text>
                  <TouchableOpacity
                    onPress={() => {
                      const idx = SERVING_STEPS.indexOf(item.servings);
                      if (idx < SERVING_STEPS.length - 1) setServings(item.recipeId, SERVING_STEPS[idx + 1]);
                    }}
                    style={styles.stepperBtn}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeFromMenu(item.recipeId)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>×</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Action row ────────────────────────────────────────────────────── */}
      {menuItems.length > 0 && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setHideChecked(h => !h)}>
            <Text style={styles.actionBtnText}>{hideChecked ? 'Show all' : 'Hide checked'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={handleCopy}>
            <Text style={styles.actionBtnText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={uncheckAll}>
            <Text style={styles.actionBtnText}>Uncheck all</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={clearMenu}>
            <Text style={[styles.actionBtnText, styles.actionBtnDangerText]}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Shopping list ─────────────────────────────────────────────────── */}
      {menuItems.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            title="Your menu is empty"
            body={'Tap "+ Add Recipe" to build this week\'s shopping list.'}
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.name}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
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
                  <Text style={[styles.listItemQty, checked && styles.listItemTextChecked]}>
                    {qtyStr}
                  </Text>
                  <Text style={[styles.listItemName, checked && styles.listItemTextChecked]}>
                    {capFirst(item.name)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          renderSectionFooter={() => <View style={{ height: 8 }} />}
        />
      )}

      {/* ── Recipe Picker Modal ───────────────────────────────────────────── */}
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
              placeholder="Search recipes..."
              placeholderTextColor={Colors.textMuted}
              value={pickerSearch}
              onChangeText={setPickerSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={pickerRecipes}
            keyExtractor={r => r.id}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => {
              const inMenu = isInMenu(item.id);
              return (
                <TouchableOpacity
                  style={[styles.pickerItem, inMenu && styles.pickerItemSelected]}
                  onPress={() => {
                    if (inMenu) {
                      removeFromMenu(item.id);
                    } else {
                      addToMenu({
                        recipeId: item.id,
                        recipeName: item.name,
                        recipeImage: item.photo_url || undefined,
                      });
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
                    </Text>
                  </View>
                  <View style={[styles.pickerCheck, inMenu && styles.pickerCheckActive]}>
                    {inMenu && <Text style={styles.pickerCheckMark}>✓</Text>}
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

    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  // Header
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: Fonts.display, fontSize: 28, color: Colors.textPrimary },
  subtitle: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  addBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  addBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 13, color: '#000' },

  // Menu strip
  menuStrip: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
  },
  menuStripContent: { paddingHorizontal: 16, gap: 8 },
  menuChip: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 140,
    maxWidth: 200,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuChipName: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 12,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  menuChipControls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepperBtn: {
    width: 24, height: 24,
    borderRadius: 12,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  stepperBtnText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  servingsLabel: { fontFamily: Fonts.body, fontSize: 12, color: Colors.gold, minWidth: 24, textAlign: 'center' },
  removeBtn: { marginLeft: 'auto', padding: 2 },
  removeBtnText: { fontFamily: Fonts.body, fontSize: 16, color: Colors.textMuted },

  // Action row
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  actionBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnText: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textSecondary },
  actionBtnDanger: { borderColor: 'rgba(201,107,107,0.3)' },
  actionBtnDangerText: { color: Colors.red },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 40, paddingTop: 8 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 16, paddingBottom: 6,
  },
  sectionTitle: {
    fontFamily: Fonts.bodyMedium, fontSize: 11,
    color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase',
  },
  sectionBadge: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  sectionBadgeText: { fontFamily: Fonts.body, fontSize: 11, color: Colors.textMuted },

  listItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  listItemChecked: { opacity: 0.35 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1, borderColor: Colors.borderActive,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkmark: { fontSize: 12, color: '#000' },

  listItemBody: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  listItemQty: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.gold },
  listItemName: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary, flexShrink: 1 },
  listItemTextChecked: { color: Colors.textMuted, textDecorationLine: 'line-through' },

  // Empty
  emptyWrap: { flex: 1, justifyContent: 'center' },

  // Picker modal
  pickerModal: { flex: 1, backgroundColor: Colors.bg },
  pickerHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderColor: Colors.border,
  },
  pickerTitle: { fontFamily: Fonts.display, fontSize: 24, color: Colors.textPrimary },
  pickerClose: { padding: 4 },
  pickerCloseText: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.gold },
  pickerSearch: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.border },
  pickerSearchInput: {
    backgroundColor: Colors.surface,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontFamily: Fonts.body, fontSize: 14, color: Colors.textPrimary,
    borderWidth: 1, borderColor: Colors.border,
  },
  pickerList: { paddingHorizontal: 16, paddingVertical: 8 },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: 1, borderColor: Colors.border,
  },
  pickerItemSelected: { opacity: 0.7 },
  pickerThumb: { width: 48, height: 48, borderRadius: 8 },
  pickerItemBody: { flex: 1 },
  pickerItemName: { fontFamily: Fonts.bodyMedium, fontSize: 14, color: Colors.textPrimary },
  pickerItemMeta: { fontFamily: Fonts.body, fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  pickerCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pickerCheckActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  pickerCheckMark: { fontSize: 13, color: '#000' },
  pickerEmpty: { fontFamily: Fonts.body, fontSize: 14, color: Colors.textMuted, textAlign: 'center', paddingTop: 40 },
});
