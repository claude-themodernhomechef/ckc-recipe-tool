/**
 * MenuContext
 *
 * Shared state for "This Week's Menu" — the list of recipes the user
 * has added to their current shopping plan, with per-recipe serving counts.
 *
 * Separate from UserContext.savedRecipes (bookmarked recipes).
 * The menu is a transient weekly plan; saved recipes are a long-term library.
 *
 * Persists to localStorage (web) / AsyncStorage (native) under key 'ckc_menu'.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface MenuEntry {
  recipeId: string;
  recipeName: string;
  recipeImage?: string;
  servings: number; // multiplier: 0.5, 1, 2, 3, 4, 5
}

interface MenuContextValue {
  menuItems: MenuEntry[];
  checkedItems: Set<string>;
  addToMenu: (entry: Omit<MenuEntry, 'servings'>) => void;
  removeFromMenu: (recipeId: string) => void;
  setServings: (recipeId: string, servings: number) => void;
  toggleChecked: (key: string) => void;
  uncheckAll: () => void;
  clearMenu: () => void;
  isInMenu: (recipeId: string) => boolean;
}

// ─────────────────────────────────────────────
//  Storage helpers (web vs. native)
// ─────────────────────────────────────────────

const STORAGE_KEY = 'ckc_menu';
const CHECKED_KEY = 'ckc_menu_checked';

async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    return await AsyncStorage.getItem(key);
  } catch { return null; }
}

async function storageSet(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    await AsyncStorage.setItem(key, value);
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────

const MenuContext = createContext<MenuContextValue>({
  menuItems: [],
  checkedItems: new Set(),
  addToMenu: () => {},
  removeFromMenu: () => {},
  setServings: () => {},
  toggleChecked: () => {},
  uncheckAll: () => {},
  clearMenu: () => {},
  isInMenu: () => false,
});

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuEntry[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // ── Restore from storage on mount ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [menuRaw, checkedRaw] = await Promise.all([
        storageGet(STORAGE_KEY),
        storageGet(CHECKED_KEY),
      ]);
      if (menuRaw) {
        try { setMenuItems(JSON.parse(menuRaw)); } catch { /* ignore */ }
      }
      if (checkedRaw) {
        try { setCheckedItems(new Set(JSON.parse(checkedRaw))); } catch { /* ignore */ }
      }
      setHydrated(true);
    })();
  }, []);

  // ── Persist menu items whenever they change ────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    storageSet(STORAGE_KEY, JSON.stringify(menuItems));
  }, [menuItems, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    storageSet(CHECKED_KEY, JSON.stringify([...checkedItems]));
  }, [checkedItems, hydrated]);

  // ── Actions ────────────────────────────────────────────────────────────────

  function addToMenu(entry: Omit<MenuEntry, 'servings'>) {
    setMenuItems(prev => {
      if (prev.some(m => m.recipeId === entry.recipeId)) return prev;
      return [...prev, { ...entry, servings: 1 }];
    });
  }

  function removeFromMenu(recipeId: string) {
    setMenuItems(prev => prev.filter(m => m.recipeId !== recipeId));
  }

  function setServings(recipeId: string, servings: number) {
    setMenuItems(prev =>
      prev.map(m => m.recipeId === recipeId ? { ...m, servings } : m)
    );
  }

  function toggleChecked(key: string) {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

  function isInMenu(recipeId: string): boolean {
    return menuItems.some(m => m.recipeId === recipeId);
  }

  return (
    <MenuContext.Provider value={{
      menuItems,
      checkedItems,
      addToMenu,
      removeFromMenu,
      setServings,
      toggleChecked,
      uncheckAll,
      clearMenu,
      isInMenu,
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  return useContext(MenuContext);
}
