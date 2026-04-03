/**
 * lib/firestore.ts
 *
 * All Firestore read/write operations.
 *
 * Firestore collections:
 *   /users/{uid}   — user profile document
 *   /recipes/{id}  — recipe documents (mirrors recipes.json schema)
 */

import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Recipe } from '../data/sampleRecipes';

// ─────────────────────────────────────────────
//  User Profile
// ─────────────────────────────────────────────

export interface FirestoreUserProfile {
  email: string;
  protocols: string[];
  household: number;
  proteins: string[];
  cuisines: string[];
  savedRecipes: string[];
  tier: 'free' | 'paid';
  onboardingComplete: boolean;
  createdAt?: ReturnType<typeof serverTimestamp>;
}

/**
 * Create or merge a user profile document.
 * Called from SetupCompleteScreen after onboarding finishes.
 */
export async function saveUserProfile(
  uid: string,
  profile: Omit<FirestoreUserProfile, 'createdAt'>,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    // Merge to preserve any fields we didn't include
    await setDoc(ref, profile, { merge: true });
  } else {
    // First save — add a createdAt timestamp
    await setDoc(ref, { ...profile, createdAt: serverTimestamp() });
  }
}

/**
 * Load a user's profile from Firestore.
 * Returns null if no document exists (e.g. first social sign-in).
 */
export async function getUserProfile(uid: string): Promise<FirestoreUserProfile | null> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as FirestoreUserProfile) : null;
}

/**
 * Sync saved recipe IDs to Firestore.
 * Called automatically from UserContext whenever saved recipes change.
 */
export async function updateSavedRecipes(uid: string, savedRecipes: string[]): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { savedRecipes });
}

/**
 * Update a single field in the user profile (e.g. tier after payment).
 */
export async function updateUserField(
  uid: string,
  fields: Partial<FirestoreUserProfile>,
): Promise<void> {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, fields as Record<string, unknown>);
}

// ─────────────────────────────────────────────
//  Recipes
// ─────────────────────────────────────────────

/**
 * Fetch entree recipes from Firestore.
 * Returns an empty array if the collection is empty (caller falls back to sampleRecipes).
 */
export async function fetchRecipes(limitCount: number = 50): Promise<Recipe[]> {
  try {
    const col = collection(db, 'recipes');
    const q = query(
      col,
      where('meal_type', '==', 'entree'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Recipe));
  } catch {
    return [];
  }
}

/**
 * Fetch a single recipe by document ID.
 * Returns null if not found (caller falls back to sampleRecipes).
 */
export async function fetchRecipeById(id: string): Promise<Recipe | null> {
  try {
    const ref = doc(db, 'recipes', id);
    const snap = await getDoc(ref);
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Recipe) : null;
  } catch {
    return null;
  }
}
