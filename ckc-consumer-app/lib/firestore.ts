// ─────────────────────────────────────────────
//  Firestore data fetching — Phase 2
//  Queries the live `recipes` collection.
//  Falls back to SAMPLE_RECIPES on error.
// ─────────────────────────────────────────────

import { collection, query, where, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { SAMPLE_RECIPES, Recipe } from '../data/sampleRecipes';

// Parse legacy "totalTime" strings like "30 min", "1 hr 15 min" → integer minutes
function parseTotalTimeString(s: unknown): number | null {
  if (typeof s !== 'string' || !s) return null;
  const lower = s.toLowerCase();
  const hours   = parseInt((lower.match(/(\d+)\s*h/) || [])[1] ?? '0', 10) || 0;
  const minutes = parseInt((lower.match(/(\d+)\s*m/) || [])[1] ?? '0', 10) || 0;
  const total = hours * 60 + minutes;
  return total > 0 ? total : null;
}

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
    prep_time:        (typeof data.prep_time === 'number' ? data.prep_time : null)
                      ?? parseTotalTimeString(data.totalTime),
    image:            (data.image           as string | null) || null,
    photo_url:        (data.photo_url       as string | null) || (data.image as string | null) || null,
    placeholder_color: placeholderColor((data.name as string) || id),
    blogger:          (data.blogger         as string) || '',
    rating:           (data.rating          as string) || '',
    dietTags:         (data.dietTags        as Recipe['dietTags']) || {},
    ingredients:      (data.ingredients     as string[]) || [],
    status:           (data.status          as Recipe['status']) || 'yes',
    processingStatus: (data.processingStatus as Recipe['processingStatus']) || undefined,
  };
}

// ── Admin: fetch pending / maybe recipes ─────────────────────────────────────

export async function fetchPendingRecipes(): Promise<Recipe[]> {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('status', '==', 'pending'),
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
// Discover feed — entrees only, capped. Falls back to SAMPLE_RECIPES.
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

// Catalog — ALL recipes (yes + no + maybe + pending), no meal_type filter, up to 5000.
export async function fetchCatalogRecipes(): Promise<Recipe[]> {
  try {
    const q = query(
      collection(db, 'recipes'),
      limit(5000),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => docToRecipe(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn('Firestore catalog fetch failed:', err);
    return [];
  }
}

// Decisions — fetch all docs from the `decisions` collection, mapped to Recipe type.
export async function fetchDecisionsCollection(): Promise<Recipe[]> {
  try {
    const q = query(collection(db, 'decisions'), limit(5000));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const decision = ((data.decision as string) || 'yes').toLowerCase();
      const status = (['yes', 'no', 'maybe', 'pending'].includes(decision)
        ? decision
        : 'yes') as Recipe['status'];
      return {
        id:                d.id,
        name:              (data.name          as string) || '',
        url:               (data.url           as string) || '',
        cuisine:           (data.cuisineStyle  as string) || '',
        meal_type:         (data.mealType      as string) || 'entree',
        protein_type:      (data.protein       as string) || '',
        menu_description:  (data.notes         as string) || '',
        prep_time:         null,
        image:             (data.image         as string | null) || null,
        photo_url:         (data.image         as string | null) || null,
        placeholder_color: placeholderColor((data.name as string) || d.id),
        blogger:           (data.blogger       as string) || '',
        rating:            (data.rating        as string) || '',
        dietTags:          (data.dietTags      as Recipe['dietTags']) || {},
        ingredients:       [],
        status,
      };
    });
  } catch (err) {
    console.warn('Firestore decisions fetch failed:', err);
    return [];
  }
}
