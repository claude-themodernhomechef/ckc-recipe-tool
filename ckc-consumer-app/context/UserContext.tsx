// ─────────────────────────────────────────────
//  UserContext — user profile and saved recipes
// ─────────────────────────────────────────────

import React, { createContext, useContext, useState } from 'react';

export interface UserProfile {
  tier: 'free' | 'paid';
  protocols: string[];   // active diet protocols from setup
  cuisines: string[];    // preferred cuisines from setup
  proteins: string[];    // preferred proteins from setup
  household: number;     // household size
  savedRecipes: string[]; // saved recipe IDs
}

interface UserContextValue {
  profile: UserProfile;
  savedRecipeIds: string[];
  saveRecipe: (recipeId: string) => void;
  unsaveRecipe: (recipeId: string) => void;
  isSaved: (recipeId: string) => boolean;
  signOut: () => void;
}

const defaultProfile: UserProfile = {
  tier: 'paid', // DEV: set to 'free' to test paywall gates
  protocols: [],
  cuisines: [],
  proteins: [],
  household: 2,
  savedRecipes: [],
};

const UserContext = createContext<UserContextValue>({
  profile: defaultProfile,
  savedRecipeIds: [],
  saveRecipe: () => {},
  unsaveRecipe: () => {},
  isSaved: () => false,
  signOut: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [profile] = useState<UserProfile>(defaultProfile);
  const [savedRecipeIds, setSavedRecipeIds] = useState<string[]>([]);

  function saveRecipe(recipeId: string) {
    setSavedRecipeIds(ids => ids.includes(recipeId) ? ids : [...ids, recipeId]);
  }

  function unsaveRecipe(recipeId: string) {
    setSavedRecipeIds(ids => ids.filter(id => id !== recipeId));
  }

  function isSaved(recipeId: string) {
    return savedRecipeIds.includes(recipeId);
  }

  function signOut() {
    // No-op: auth not wired up in this build
  }

  return (
    <UserContext.Provider value={{ profile, savedRecipeIds, saveRecipe, unsaveRecipe, isSaved, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
