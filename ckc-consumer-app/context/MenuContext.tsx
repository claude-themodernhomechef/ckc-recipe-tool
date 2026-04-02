// ─────────────────────────────────────────────
//  MenuContext — meal plan / weekly menu state
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

// Lightweight menu item — matches what DiscoverScreen passes to addToMenu
export interface MenuItem {
  recipeId: string;
  recipeName: string;
  recipeImage?: string;
}

interface MenuContextValue {
  menuItems: MenuItem[];
  addToMenu: (item: MenuItem) => void;
  removeFromMenu: (recipeId: string) => void;
  isInMenu: (recipeId: string) => boolean;
  clearMenu: () => void;
}

const MenuContext = createContext<MenuContextValue>({
  menuItems: [],
  addToMenu: () => {},
  removeFromMenu: () => {},
  isInMenu: () => false,
  clearMenu: () => {},
});

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  function addToMenu(item: MenuItem) {
    setMenuItems((prev: MenuItem[]) =>
      prev.find((m: MenuItem) => m.recipeId === item.recipeId) ? prev : [...prev, item]
    );
  }

  function removeFromMenu(recipeId: string) {
    setMenuItems((prev: MenuItem[]) => prev.filter((m: MenuItem) => m.recipeId !== recipeId));
  }

  function isInMenu(recipeId: string) {
    return menuItems.some((m: MenuItem) => m.recipeId === recipeId);
  }

  function clearMenu() {
    setMenuItems([]);
  }

  return (
    <MenuContext.Provider value={{ menuItems, addToMenu, removeFromMenu, isInMenu, clearMenu }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu(): MenuContextValue {
  return useContext(MenuContext);
}
