import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SectionList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Fonts } from '../constants/theme';
import { fetchCatalogRecipes } from '../lib/firestore';
import { normalizeIngredient } from '../lib/ingredientParser';

// ── Ingredient categorisation ─────────────────────────────────────────────────

const PROTEIN_KEYWORDS  = ['chicken','beef','salmon','tuna','shrimp','pork','lamb','turkey','fish','steak','tofu','tempeh','cod','halibut','tilapia','scallop','crab','lobster','duck','veal','bison','sausage','chorizo','bacon','ham','ground beef','ground turkey'];
const DAIRY_KEYWORDS    = ['butter','cream','milk','cheese','yogurt','parmesan','mozzarella','ricotta','feta','brie','cheddar','gouda','sour cream','mascarpone','ghee','kefir','buttermilk','crème fraîche'];
const PRODUCE_KEYWORDS  = ['garlic','onion','tomato','lemon','lime','orange','herb','cilantro','parsley','basil','thyme','rosemary','oregano','mint','dill','pepper','zucchini','eggplant','mushroom','spinach','kale','lettuce','arugula','carrot','celery','broccoli','cauliflower','asparagus','avocado','cucumber','ginger','scallion','shallot','leek','potato','sweet potato','squash','pumpkin'];

function categorise(ingredient: string): Category {
  const lower = ingredient.toLowerCase();
  if (PROTEIN_KEYWORDS.some(k => lower.includes(k))) return 'Protein';
  if (DAIRY_KEYWORDS.some(k => lower.includes(k)))   return 'Dairy';
  if (PRODUCE_KEYWORDS.some(k => lower.includes(k)))  return 'Produce';
  return 'Pantry';
}

type FirestoreRecipe = { id: string; name: string; blogger: string; ingredients: string[] };

function toShoppingRecipe(r: { id: string; name: string; blogger: string; ingredients: string[] }): ShoppingRecipe {
  return {
    id: r.id,
    name: r.name,
    blogger: r.blogger,
    ingredients: r.ingredients
      .filter(i => i && i.trim())
      .map(i => { const norm = normalizeIngredient(i); return { name: norm, category: categorise(norm) }; }),
  };
}

type ShoppingRecipe = { id: string; name: string; blogger: string; ingredients: { name: string; category: Category }[] };

type Category = 'Protein' | 'Produce' | 'DairyEggs' | 'PantryStaples' | 'PantryConsumables' | 'Frozen';

const CATEGORY_ORDER: Category[] = ['Protein', 'Produce', 'DairyEggs', 'PantryStaples', 'PantryConsumables', 'Frozen'];

const CATEGORY_LABELS: Record<Category, string> = {
  Protein: 'Protein',
  Produce: 'Produce',
  Dairy:   'Dairy',
  Pantry:  'Pantry',
};

const CATEGORY_COLORS: Record<Category, string> = {
  Protein:          '#e07878',
  Produce:          '#7cb87a',
  DairyEggs:        '#6aabda',
  PantryStaples:    '#d4a843',
  PantryConsumables:'#c4935a',
  Frozen:           '#7ab8d4',
};

// ─────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────
export default function ShoppingPlannerScreen() {
  const [allRecipes, setAllRecipes] = useState<ShoppingRecipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showRecipePicker, setShowRecipePicker] = useState(false);

  useEffect(() => {
    fetchCatalogRecipes().then(firestoreRecipes => {
      const withIngredients = firestoreRecipes
        .filter(r => r.ingredients && r.ingredients.length > 0)
        .map(r => toShoppingRecipe({ id: r.id, name: r.name, blogger: r.blogger, ingredients: r.ingredients }));
      setAllRecipes(withIngredients);
      setLoadingRecipes(false);
    }).catch(() => setLoadingRecipes(false));
  }, []);

  // Toggle a recipe on/off
  const toggleRecipe = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle an ingredient as checked
  const toggleItem = (key: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Build aggregated shopping list from selected recipes
  const shoppingList = useMemo(() => {
    const byCategory: Record<Category, Map<string, string[]>> = {
      Protein:          new Map(),
      Produce:          new Map(),
      DairyEggs:        new Map(),
      PantryStaples:    new Map(),
      PantryConsumables:new Map(),
      Frozen:           new Map(),
    };

    for (const recipe of allRecipes) {
      if (!selectedIds.has(recipe.id)) continue;
      for (const ing of recipe.ingredients) {
        const key = ing.name.toLowerCase();
        if (!byCategory[ing.category].has(key)) {
          byCategory[ing.category].set(key, []);
        }
        byCategory[ing.category].get(key)!.push(recipe.name);
      }
    }

    return CATEGORY_ORDER
      .map(cat => ({
        title: cat,
        data: Array.from(byCategory[cat].entries())
          .filter(([name]) =>
            !searchQuery || name.includes(searchQuery.toLowerCase())
          )
          .map(([name, recipes]) => ({ name, recipes, key: `${cat}-${name}` })),
      }))
      .filter(section => section.data.length > 0);
  }, [selectedIds, searchQuery]);

  const selectedRecipes = allRecipes.filter(r => selectedIds.has(r.id));
  const totalItems = shoppingList.reduce((acc, s) => acc + s.data.length, 0);
  const checkedCount = shoppingList.reduce(
    (acc, s) => acc + s.data.filter(i => checkedItems.has(i.key)).length, 0
  );

  if (loadingRecipes) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.textSecondary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Shopping Planner</Text>
            {totalItems > 0 && (
              <Text style={styles.headerSub}>
                {checkedCount}/{totalItems} items · {selectedIds.size} recipes
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowRecipePicker(v => !v)}
          >
            <Text style={styles.addBtnText}>{showRecipePicker ? 'Done' : '+ Recipes'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recipe picker (expanded) ── */}
        {showRecipePicker && (
          <View style={styles.pickerPanel}>
            <Text style={styles.pickerLabel}>Select recipes to build your list</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
              {allRecipes.map(recipe => {
                const on = selectedIds.has(recipe.id);
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={[styles.pickerChip, on && styles.pickerChipOn]}
                    onPress={() => toggleRecipe(recipe.id)}
                  >
                    <Text style={[styles.pickerChipText, on && styles.pickerChipTextOn]}>
                      {recipe.name}
                    </Text>
                    {on && <Text style={styles.pickerChipCheck}> ✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Selected recipes row ── */}
        {!showRecipePicker && selectedRecipes.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recipesRow}
          >
            {selectedRecipes.map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.recipeChip}
                onPress={() => toggleRecipe(r.id)}
              >
                <Text style={styles.recipeChipText}>{r.name}</Text>
                <Text style={styles.recipeChipX}>×</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Search ── */}
        {totalItems > 0 && (
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search ingredients…"
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
            />
          </View>
        )}

        {/* ── Empty state ── */}
        {selectedIds.size === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No recipes selected</Text>
            <Text style={styles.emptyBody}>
              Tap "+ Recipes" above to pick what you're cooking this week. Your shopping list will be built automatically.
            </Text>
          </View>
        )}

        {/* ── Categorized list ── */}
        {shoppingList.length > 0 && (
          <SectionList
            sections={shoppingList}
            keyExtractor={item => item.key}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: CATEGORY_COLORS[section.title as Category] }]}>
                  {CATEGORY_LABELS[section.title as Category]}
                </Text>
                <Text style={styles.sectionCount}>{section.data.length}</Text>
              </View>
            )}
            renderItem={({ item }) => {
              const checked = checkedItems.has(item.key);
              return (
                <TouchableOpacity
                  style={[styles.ingredientRow, checked && styles.ingredientRowChecked]}
                  onPress={() => toggleItem(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                    {checked && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <View style={styles.ingredientInfo}>
                    <Text style={[styles.ingredientName, checked && styles.ingredientNameChecked]}>
                      {item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                    </Text>
                    <Text style={styles.ingredientRecipes} numberOfLines={1}>
                      {item.recipes.join(' · ')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {/* ── Clear checked button ── */}
        {checkedCount > 0 && (
          <View style={styles.clearRow}>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setCheckedItems(new Set())}
            >
              <Text style={styles.clearBtnText}>Clear {checkedCount} checked</Text>
            </TouchableOpacity>
          </View>
        )}

      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontFamily: Fonts.display,
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Recipe picker
  pickerPanel: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    gap: 10,
  },
  pickerLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
  },
  pickerScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'transparent',
  },
  pickerChipOn: {
    backgroundColor: 'rgba(124,184,122,0.12)',
    borderColor: Colors.green,
  },
  pickerChipText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pickerChipTextOn: {
    color: Colors.green,
  },
  pickerChipCheck: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.green,
  },

  // Selected recipes scroll
  recipesRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  recipeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  recipeChipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textSecondary,
    maxWidth: 160,
  },
  recipeChipX: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textMuted,
  },

  // Search
  searchRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textPrimary,
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: Fonts.display,
    fontSize: 24,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Fonts.body,
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    flex: 1,
  },
  sectionCount: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: Colors.textMuted,
    backgroundColor: Colors.surface,
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 12,
  },
  ingredientRowChecked: { opacity: 0.45 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderActive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  checkmark: {
    fontSize: 13,
    color: Colors.bg,
    fontFamily: Fonts.bodyMedium,
  },
  ingredientInfo: { flex: 1, gap: 2 },
  ingredientName: {
    fontFamily: Fonts.body,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  ingredientNameChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  ingredientRecipes: {
    fontFamily: Fonts.body,
    fontSize: 11,
    color: Colors.textMuted,
  },

  // Clear button
  clearRow: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  clearBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  clearBtnText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
