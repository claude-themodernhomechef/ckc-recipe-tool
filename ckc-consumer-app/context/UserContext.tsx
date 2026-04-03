/**
 * UserContext
 *
 * Single source of truth for auth state, user profile, and recipe saving.
 *
 * ── What it manages ──
 *   • Firebase Auth user (from onAuthStateChanged)
 *   • authLoading — true while we're resolving the initial auth state
 *   • onboardingComplete — drives the conditional stack in AppNavigator
 *   • pendingCredentials — email/password stored during onboarding, used to
 *     create the Firebase account in SetupCompleteScreen
 *   • UserProfile — protocols, household, proteins, cuisines, savedRecipes, tier
 *
 * ── Firestore sync ──
 *   • On sign-in: loads profile from /users/{uid}
 *   • On save/unsave: writes savedRecipes to Firestore (fire-and-forget)
 *   • On onboarding complete: writes full profile to Firestore
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged, signOut as authSignOut } from '../lib/auth';
import { getUserProfile, saveUserProfile, updateSavedRecipes } from '../lib/firestore';
import { signUpWithEmail } from '../lib/auth';
import type { User } from '../lib/auth';

// ── Dev bypass ────────────────────────────────────────────────────────────────
// When running on localhost, skip Firebase auth and go straight to the main app.
const DEV_BYPASS =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.hostname === 'localhost';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────

export interface UserProfile {
  protocols: string[];
  household: number;
  proteins: string[];
  cuisines: string[];
  savedRecipes: string[];
  tier: 'free' | 'paid';
}

interface PendingCredentials {
  email: string;
  password: string;
}

interface UserContextValue {
  // Auth state
  authUser: User | null;
  authLoading: boolean;
  onboardingComplete: boolean;

  // Deferred account creation during onboarding
  pendingCredentials: PendingCredentials | null;
  setPendingCredentials: (creds: PendingCredentials | null) => void;

  // Profile
  profile: UserProfile;
  setProfile: (p: UserProfile) => void;

  // Called at the end of onboarding — creates account + saves to Firestore
  completeOnboarding: (profile: UserProfile) => Promise<void>;

  // Recipe bank
  saveRecipe: (id: string) => void;
  unsaveRecipe: (id: string) => void;

  // Sign out
  signOut: () => Promise<void>;
}

// ─────────────────────────────────────────────
//  Defaults
// ─────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  protocols: [],
  household: 4,
  proteins: [],
  cuisines: [],
  savedRecipes: [],
  tier: 'free',
};

const UserContext = createContext<UserContextValue>({
  authUser: null,
  authLoading: true,
  onboardingComplete: false,
  pendingCredentials: null,
  setPendingCredentials: () => {},
  profile: DEFAULT_PROFILE,
  setProfile: () => {},
  completeOnboarding: async () => {},
  saveRecipe: () => {},
  unsaveRecipe: () => {},
  signOut: async () => {},
});

// ─────────────────────────────────────────────
//  Provider
// ─────────────────────────────────────────────

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser]                     = useState<User | null>(
    DEV_BYPASS ? ({ uid: 'dev-user', email: 'dev@localhost' } as unknown as User) : null,
  );
  const [authLoading, setAuthLoading]               = useState(!DEV_BYPASS);
  const [onboardingComplete, setOnboardingComplete] = useState(DEV_BYPASS);
  const [pendingCredentials, setPendingCredentials] = useState<PendingCredentials | null>(null);
  const [profile, setProfileState]                  = useState<UserProfile>(DEFAULT_PROFILE);

  // ── Auth state listener ────────────────────────────────────────────────────

  useEffect(() => {
    if (DEV_BYPASS) return; // skip Firebase auth on localhost

    const unsubscribe = onAuthStateChanged(async (user) => {
      setAuthUser(user);

      if (user) {
        try {
          const firestoreProfile = await getUserProfile(user.uid);
          if (firestoreProfile) {
            setProfileState({
              protocols:    firestoreProfile.protocols,
              household:    firestoreProfile.household,
              proteins:     firestoreProfile.proteins,
              cuisines:     firestoreProfile.cuisines,
              savedRecipes: firestoreProfile.savedRecipes,
              tier:         firestoreProfile.tier,
            });
            setOnboardingComplete(firestoreProfile.onboardingComplete);
          }
          // No profile doc = new social-auth user who hasn't done onboarding yet.
          // onboardingComplete stays false → AuthStack shows → onboarding runs.
        } catch (err) {
          console.warn('[UserContext] Failed to load Firestore profile:', err);
        }
      } else {
        // Signed out — reset everything
        setProfileState(DEFAULT_PROFILE);
        setOnboardingComplete(false);
      }

      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  function setProfile(p: UserProfile) {
    setProfileState(p);
  }

  /**
   * completeOnboarding
   *
   * Called by SetupCompleteScreen when the user taps "Start Exploring Recipes".
   *
   * 1. Creates the Firebase Auth account using pendingCredentials (email/password flow).
   *    If the user already has an auth account (social sign-in), skips this step.
   * 2. Saves the full profile to Firestore with onboardingComplete: true.
   * 3. Sets onboardingComplete in local state, triggering AppNavigator to switch
   *    to the main app stack.
   */
  async function completeOnboarding(newProfile: UserProfile): Promise<void> {
    let uid = authUser?.uid;
    let email = authUser?.email ?? '';

    // Create account if we have pending credentials (email/password sign-up path)
    if (!uid && pendingCredentials) {
      const user = await signUpWithEmail(
        pendingCredentials.email,
        pendingCredentials.password,
      );
      uid   = user.uid;
      email = user.email ?? pendingCredentials.email;
      // Note: onAuthStateChanged will fire after this, but we continue synchronously
      // because we have uid and can proceed with Firestore.
    }

    if (!uid) {
      throw new Error('[UserContext] completeOnboarding: no user UID available.');
    }

    await saveUserProfile(uid, {
      email,
      ...newProfile,
      onboardingComplete: true,
    });

    // Update local state — this triggers AppNavigator to mount the main app stack
    setProfileState(newProfile);
    setPendingCredentials(null);
    setOnboardingComplete(true);
  }

  /**
   * saveRecipe / unsaveRecipe
   *
   * Updates local state immediately (optimistic), then syncs to Firestore.
   * The functional update form prevents stale-closure issues with rapid saves.
   */
  function saveRecipe(id: string) {
    setProfileState(prev => {
      if (prev.savedRecipes.includes(id)) return prev;
      const updated = [...prev.savedRecipes, id];
      if (authUser) {
        updateSavedRecipes(authUser.uid, updated).catch(err =>
          console.warn('[UserContext] Failed to sync save:', err),
        );
      }
      return { ...prev, savedRecipes: updated };
    });
  }

  function unsaveRecipe(id: string) {
    setProfileState(prev => {
      const updated = prev.savedRecipes.filter(r => r !== id);
      if (authUser) {
        updateSavedRecipes(authUser.uid, updated).catch(err =>
          console.warn('[UserContext] Failed to sync unsave:', err),
        );
      }
      return { ...prev, savedRecipes: updated };
    });
  }

  async function signOut(): Promise<void> {
    await authSignOut();
    setProfileState(DEFAULT_PROFILE);
    setOnboardingComplete(false);
    setPendingCredentials(null);
    // authUser is reset via onAuthStateChanged
  }

  return (
    <UserContext.Provider value={{
      authUser,
      authLoading,
      onboardingComplete,
      pendingCredentials,
      setPendingCredentials,
      profile,
      setProfile,
      completeOnboarding,
      saveRecipe,
      unsaveRecipe,
      signOut,
    }}>
      {children}
    </UserContext.Provider>
  );
}

// ─────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────

export function useUser() {
  return useContext(UserContext);
}
