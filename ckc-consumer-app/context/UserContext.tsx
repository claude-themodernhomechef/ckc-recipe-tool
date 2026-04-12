// ─────────────────────────────────────────────
//  UserContext — user profile and saved recipes
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

export interface UserProfile {
  tier: 'free' | 'paid';
  name: string;          // user's first name, set during onboarding
  protocols: string[];   // active diet protocols from setup
  cuisines: string[];    // preferred cuisines from setup
  proteins: string[];    // preferred proteins from setup
  household: number;     // household size
  savedRecipes: string[]; // saved recipe IDs
  pantryIngredients: string[]; // ingredients extracted from pantry scans
}

interface UserContextValue {
  profile: UserProfile;
  savedRecipeIds: string[];
  setName: (name: string) => void;
  saveRecipe: (recipeId: string) => void;
  unsaveRecipe: (recipeId: string) => void;
  isSaved: (recipeId: string) => boolean;
  savePantryIngredients: (items: string[]) => void;
  signOut: () => void;
}

const defaultProfile: UserProfile = {
  tier: 'paid', // DEV: set to 'free' to test paywall gates
  name: '',
  protocols: ['LF', 'GF'], // DEV: sample protocols to test diet toggle in Shop tab
  cuisines: [],
  proteins: [],
  household: 2,
  savedRecipes: [],
  pantryIngredients: [],
};

const UserContext = createContext<UserContextValue>({
  profile: defaultProfile,
  savedRecipeIds: [],
  setName: () => {},
  saveRecipe: () => {},
  unsaveRecipe: () => {},
  isSaved: () => false,
  savePantryIngredients: () => {},
  signOut: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(defaultProfile);
  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>([]);

  function setName(name: string) {
    setProfile(p => ({ ...p, name }));
  }

  function saveRecipe(recipeId: string) {
    setSavedRecipeIds(ids => ids.includes(recipeId) ? ids : [...ids, recipeId]);
  }

  function unsaveRecipe(recipeId: string) {
    setSavedRecipeIds(ids => ids.filter(id => id !== recipeId));
  }

  function isSaved(recipeId: string) {
    return savedRecipeIds.includes(recipeId);
  }

  function savePantryIngredients(items: string[]) {
    // Merge with existing, deduplicate by lowercase name
    setProfile(p => {
      const existing = new Set(p.pantryIngredients.map(n => n.toLowerCase()));
      const newItems = items.filter(n => !existing.has(n.toLowerCase()));
      return { ...p, pantryIngredients: [...p.pantryIngredients, ...newItems] };
    });
  }

  function signOut() {
    // No-op: auth not wired up in this build
  }

  return (
    <UserContext.Provider value={{ profile, savedRecipeIds, setName, saveRecipe, unsaveRecipe, isSaved, savePantryIngredients, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
