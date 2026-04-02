// ─────────────────────────────────────────────
//  Firestore data fetching — Phase 2
//  Queries the live `recipes` collection.
//  Falls back to SAMPLE_RECIPES on error.
// ─────────────────────────────────────────────

import { collection, query, where, limit, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { SAMPLE_RECIPES, Recipe } from '../data/sampleRecipes';

// Generate a deterministic dark placeholder color from a string
function placeholderColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 25%, 18%)`;
}

// Map a Firestore document to the Recipe type the app uses
function docToRecipe(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    name:             (data.name            as string) || '',
    url:              (data.url             as string) || '',
    cuisine:          (data.cuisine         as string) || '',
    meal_type:        (data.meal_type       as string) || 'entree',
    protein_type:     (data.protein_type    as string) || (data.protein as string) || '',
    menu_description: (data.menu_description as string) || (data.description as string) || '',
    prep_time:        (data.prep_time as number) ?? null,
    image:            (data.image           as string | null) || null,
    photo_url:        (data.photo_url       as string | null) || (data.image as string | null) || null,
    placeholder_color: placeholderColor((data.name as string) || id),
    blogger:          (data.blogger         as string) || '',
    rating:           (data.rating          as string) || '',
    dietTags:         (data.dietTags        as Recipe['dietTags']) || {},
    ingredients:      (data.ingredients     as string[]) || [],
  };
}

// ── Admin: fetch pending / maybe recipes ─────────────────────────────────────

export async function fetchPendingRecipes(): Promise<Recipe[]> {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('status', '==', 'pending'),
      orderBy('sourceAddedAt', 'asc'),
      limit(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => docToRecipe(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn('fetchPendingRecipes failed:', err);
    return [];
  }
}

export async function fetchMaybeRecipes(): Promise<Recipe[]> {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('status', '==', 'maybe'),
      limit(100),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => docToRecipe(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn('fetchMaybeRecipes failed:', err);
    return [];
  }
}

export async function updateRecipeStatus(
  recipeId: string,
  status: 'yes' | 'no' | 'maybe',
): Promise<void> {
  const ref = doc(db, 'recipes', recipeId);
  await updateDoc(ref, { status, decidedAt: new Date().toISOString() });
}

// ── Consumer: fetch approved recipes ─────────────────────────────────────────

// Fetch approved recipes from Firestore.
// Falls back to SAMPLE_RECIPES if the query fails.
export async function fetchRecipes(limitCount: number = 200): Promise<Recipe[]> {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('status', '==', 'yes'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    const recipes = snap.docs
      .map(d => docToRecipe(d.id, d.data() as Record<string, unknown>))
      .filter(r => r.meal_type === 'entree'); // only show entrees in the discover feed

    if (recipes.length === 0) return SAMPLE_RECIPES;
    return recipes;
  } catch (err) {
    console.warn('Firestore fetch failed, using sample data:', err);
    return SAMPLE_RECIPES;
  }
}
