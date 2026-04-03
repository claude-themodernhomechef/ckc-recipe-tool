// ─────────────────────────────────────────────
//  MenuContext — meal plan / weekly menu state
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

export interface MenuItem {
  recipeId: string;
  recipeName: string;
  recipeImage?: string;
  servings: number;
}

interface MenuContextValue {
  menuItems: MenuItem[];
  checkedItems: Set<string>;
  addToMenu: (item: Omit<MenuItem, 'servings'>) => void;
  removeFromMenu: (recipeId: string) => void;
  isInMenu: (recipeId: string) => boolean;
  setServings: (recipeId: string, servings: number) => void;
  toggleChecked: (ingredientName: string) => void;
  uncheckAll: () => void;
  clearMenu: () => void;
}

const MenuContext = createContext<MenuContextValue>({
  menuItems: [],
  checkedItems: new Set(),
  addToMenu: () => {},
  removeFromMenu: () => {},
  isInMenu: () => false,
  setServings: () => {},
  toggleChecked: () => {},
  uncheckAll: () => {},
  clearMenu: () => {},
});

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  function addToMenu(item: Omit<MenuItem, 'servings'>) {
    setMenuItems(prev =>
      prev.find(m => m.recipeId === item.recipeId) ? prev : [...prev, { ...item, servings: 1 }]
    );
  }

  function removeFromMenu(recipeId: string) {
    setMenuItems(prev => prev.filter(m => m.recipeId !== recipeId));
  }

  function isInMenu(recipeId: string) {
    return menuItems.some(m => m.recipeId === recipeId);
  }

  function setServings(recipeId: string, servings: number) {
    setMenuItems(prev =>
      prev.map(m => m.recipeId === recipeId ? { ...m, servings } : m)
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

  return (
    <MenuContext.Provider value={{
      menuItems, checkedItems,
      addToMenu, removeFromMenu, isInMenu,
      setServings, toggleChecked, uncheckAll, clearMenu,
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu(): MenuContextValue {
  return useContext(MenuContext);
}
