// ─────────────────────────────────────────────
//  MenuContext — shopping list & meal plan state
//
//  Shared between MealPlanScreen (writes plan recipes)
//  and ShopScreen (reads + manually adds recipes).
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState, useMemo } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type RecipeType       = 'entree' | 'side' | 'other';
export type RecipeSource     = 'mealplan' | 'manual';
export type OrganicPreference = 'conventional' | 'dirty-dozen' | 'all-organic';

export interface MenuItem {
  recipeId:    string;
  recipeName:  string;
  recipeImage?: string;
  servings:    number;
  recipeType:  RecipeType;
  source:      RecipeSource;
}

// Input type for addToMenu — recipeType and source are optional (have defaults)
export type AddMenuItemInput = Omit<MenuItem, 'servings' | 'recipeType' | 'source'> & {
  recipeType?: RecipeType;
  source?:     RecipeSource;
};

// Free-tier limits
const FREE_MAX_ENTREES = 2;
const FREE_MAX_TOTAL   = 6;

// ── Context shape ────────────────────────────────────────────────────────────

interface MenuContextValue {
  menuItems:         MenuItem[];
  checkedItems:      Set<string>;
  organicPreference: OrganicPreference;

  // Mutations
  addToMenu:           (item: AddMenuItemInput) => void;
  removeFromMenu:      (recipeId: string) => void;
  isInMenu:            (recipeId: string) => boolean;
  setServings:         (recipeId: string, servings: number) => void;
  toggleChecked:       (ingredientName: string) => void;
  uncheckAll:          () => void;
  clearMenu:           () => void;
  setOrganicPreference:(pref: OrganicPreference) => void;

  // Meal plan sync — replaces all 'mealplan'-sourced items in one call
  syncMealPlan: (items: AddMenuItemInput[]) => void;

  // Diet swap reverts — ingredients the user chose to keep as original
  revertedSwaps:     Set<string>;
  toggleRevertedSwap:(ingredientName: string) => void;

  // Paywall helpers (pass isPaid from UserContext)
  entreeCount:    number;
  totalCount:     number;
  canAddEntree:   (isPaid: boolean) => boolean;
  canAddItem:     (isPaid: boolean) => boolean;
}

// ── Default context ──────────────────────────────────────────────────────────

const MenuContext = createContext<MenuContextValue>({
  menuItems:          [],
  checkedItems:       new Set(),
  organicPreference:  'conventional',
  addToMenu:          () => {},
  removeFromMenu:     () => {},
  isInMenu:           () => false,
  setServings:        () => {},
  toggleChecked:      () => {},
  uncheckAll:         () => {},
  clearMenu:          () => {},
  setOrganicPreference: () => {},
  syncMealPlan:       () => {},
  revertedSwaps:      new Set(),
  toggleRevertedSwap: () => {},
  entreeCount:        0,
  totalCount:         0,
  canAddEntree:       () => true,
  canAddItem:         () => true,
});

// ── Provider ─────────────────────────────────────────────────────────────────

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menuItems,         setMenuItems]         = useState<MenuItem[]>([]);
  const [checkedItems,      setCheckedItems]       = useState<Set<string>>(new Set());
  const [organicPreference, setOrganicPreferenceState] = useState<OrganicPreference>('conventional');
  const [revertedSwaps,     setRevertedSwaps]     = useState<Set<string>>(new Set());

  // ── Derived counts (manual items only — meal plan gated by MealPlanScreen) ──
  const entreeCount = useMemo(
    () => menuItems.filter(m => m.source === 'manual' && m.recipeType === 'entree').length,
    [menuItems],
  );
  const totalCount = useMemo(
    () => menuItems.filter(m => m.source === 'manual').length,
    [menuItems],
  );

  // ── Paywall checks ───────────────────────────────────────────────────────────
  function canAddEntree(isPaid: boolean): boolean {
    if (isPaid) return true;
    return entreeCount < FREE_MAX_ENTREES;
  }
  function canAddItem(isPaid: boolean): boolean {
    if (isPaid) return true;
    return totalCount < FREE_MAX_TOTAL;
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  function addToMenu(item: AddMenuItemInput) {
    setMenuItems(prev =>
      prev.find(m => m.recipeId === item.recipeId)
        ? prev
        : [
            ...prev,
            {
              ...item,
              servings:   1,
              recipeType: item.recipeType ?? 'entree',
              source:     item.source     ?? 'manual',
            },
          ],
    );
  }

  function removeFromMenu(recipeId: string) {
    setMenuItems(prev => prev.filter(m => m.recipeId !== recipeId));
  }

  function isInMenu(recipeId: string): boolean {
    return menuItems.some(m => m.recipeId === recipeId);
  }

  function setServings(recipeId: string, servings: number) {
    setMenuItems(prev =>
      prev.map(m => m.recipeId === recipeId ? { ...m, servings } : m),
    );
  }

  function toggleChecked(ingredientName: string) {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(ingredientName)) next.delete(ingredientName);
      else next.add(ingredientName);
      return next;
    });
  }

  function uncheckAll() {
    setCheckedItems(new Set());
  }

  function clearMenu() {
    setMenuItems([]);
    setCheckedItems(new Set());
  }

  function setOrganicPreference(pref: OrganicPreference) {
    setOrganicPreferenceState(pref);
  }

  function toggleRevertedSwap(ingredientName: string) {
    setRevertedSwaps(prev => {
      const next = new Set(prev);
      if (next.has(ingredientName)) next.delete(ingredientName);
      else next.add(ingredientName);
      return next;
    });
  }

  // ── Meal plan sync ───────────────────────────────────────────────────────────
  // Called by MealPlanScreen whenever its plan state changes.
  // Keeps all 'manual' items intact and replaces all 'mealplan' items.

  function syncMealPlan(items: AddMenuItemInput[]) {
    setMenuItems(prev => {
      const manualItems = prev.filter(m => m.source === 'manual');
      const newMealPlanItems: MenuItem[] = items
        // Don't double-add a recipe already manually added
        .filter(item => !manualItems.find(m => m.recipeId === item.recipeId))
        .map(item => ({
          recipeId:   item.recipeId,
          recipeName: item.recipeName,
          recipeImage:item.recipeImage,
          servings:   1,
          recipeType: item.recipeType ?? 'entree',
          source:     'mealplan' as RecipeSource,
        }));
      return [...manualItems, ...newMealPlanItems];
    });
  }

  return (
    <MenuContext.Provider
      value={{
        menuItems,
        checkedItems,
        organicPreference,
        addToMenu,
        removeFromMenu,
        isInMenu,
        setServings,
        toggleChecked,
        uncheckAll,
        clearMenu,
        setOrganicPreference,
        syncMealPlan,
        revertedSwaps,
        toggleRevertedSwap,
        entreeCount,
        totalCount,
        canAddEntree,
        canAddItem,
      }}
    >
      {children}
    </MenuContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMenu(): MenuContextValue {
  return useContext(MenuContext);
}
