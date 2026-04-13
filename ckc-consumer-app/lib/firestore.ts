// ─────────────────────────────────────────────
//  Firestore data fetching — Phase 2
//  Queries the live `recipes` collection.
//  Falls back to SAMPLE_RECIPES on error.
// ─────────────────────────────────────────────

import { collection, query, where, limit, getDocs, doc, updateDoc, documentId, getDoc, onSnapshot } from 'firebase/firestore';
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
    builtInStarch:    (data.builtInStarch   as boolean) || false,
    builtInVeg:       (data.builtInVeg      as boolean) || false,
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
      limit(500),
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
      where('meal_type', '==', 'entree'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    const recipes = snap.docs.map(d => docToRecipe(d.id, d.data() as Record<string, unknown>));

    if (recipes.length === 0) return SAMPLE_RECIPES;
    return recipes;
  } catch (err) {
    console.warn('Firestore fetch failed, using sample data:', err);
    return SAMPLE_RECIPES;
  }
}

// Fetch specific recipes by their Firestore document IDs (for loading saved recipe details)
export async function fetchRecipesByIds(ids: string[]): Promise<Recipe[]> {
  if (ids.length === 0) return [];
  try {
    const results: Recipe[] = [];
    // Firestore 'in' queries support max 10 items per batch
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const q = query(collection(db, 'recipes'), where(documentId(), 'in', batch));
      const snap = await getDocs(q);
      snap.docs.forEach(d => results.push(docToRecipe(d.id, d.data() as Record<string, unknown>)));
    }
    return results;
  } catch (err) {
    console.warn('fetchRecipesByIds failed:', err);
    return [];
  }
}

// Fetch side dishes from the full CKC library for Chef Sides pairing
export async function fetchSideDishes(): Promise<Recipe[]> {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('status', '==', 'yes'),
      where('meal_type', 'in', ['side', 'salad', 'sauce']),
      limit(300),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => docToRecipe(d.id, d.data() as Record<string, unknown>));
  } catch (err) {
    console.warn('fetchSideDishes failed:', err);
    return [];
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

// Live listener — streams all recipes and calls onData whenever anything changes.
// Returns an unsubscribe function to call on cleanup.
export function subscribeCatalogRecipes(onData: (recipes: Recipe[]) => void): () => void {
  const q = query(collection(db, 'recipes'), limit(5000));
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => docToRecipe(d.id, d.data() as Record<string, unknown>)));
  }, err => {
    console.warn('subscribeCatalogRecipes error:', err);
  });
}

// ── Needs Review ─────────────────────────────────────────────────────────────

export interface ReviewItem {
  protocol:   string;
  ingredient: string;
  reason:     string;
  category:   string;
  caution:    string;
  resolved:   boolean;
  addedAt:    string;
  finalDecision?: string;
  swapNote?:      string;
}

export interface NeedsReviewRecipe {
  id:              string;
  name:            string;
  url:             string;
  image:           string | null;
  placeholder_color: string;
  reviewItems:     ReviewItem[];
  dietTags:        Record<string, Record<string, unknown>>;
}

export async function fetchNeedsReviewRecipes(): Promise<NeedsReviewRecipe[]> {
  try {
    const q = query(
      collection(db, 'recipes'),
      where('processingStatus', '==', 'pending_review'),
      limit(500),
    );
    const snap = await getDocs(q);
    const results: NeedsReviewRecipe[] = [];
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      const items = (data.reviewItems as ReviewItem[]) || [];
      const unresolved = items.filter(i => !i.resolved);
      if (unresolved.length === 0) continue;
      results.push({
        id:               d.id,
        name:             (data.name  as string) || '',
        url:              (data.url   as string) || '',
        image:            (data.image as string | null) || (data.photo_url as string | null) || null,
        placeholder_color: placeholderColor((data.name as string) || d.id),
        reviewItems:      items,
        dietTags:         (data.dietTags as Record<string, Record<string, unknown>>) || {},
      });
    }
    return results;
  } catch (err) {
    console.warn('fetchNeedsReviewRecipes failed:', err);
    return [];
  }
}

// Resolve one reviewItem and update the corresponding dietTag.
// decision: 'compliant' | 'replace' | 'remove' | 'skip'
// swapNote: only used when decision === 'replace'
export async function resolveReviewItem(
  recipeId:  string,
  protocol:  string,
  ingredient: string,
  decision:  'compliant' | 'replace' | 'remove' | 'skip',
  currentDietTags: Record<string, Record<string, unknown>>,
  currentReviewItems: ReviewItem[],
  swapNote?: string,
): Promise<void> {
  const ref = doc(db, 'recipes', recipeId);

  // Update reviewItems — mark the matching item resolved
  const updatedItems = currentReviewItems.map(item => {
    if (item.protocol === protocol && item.ingredient === ingredient && !item.resolved) {
      return { ...item, resolved: true, finalDecision: decision, swapNote: swapNote || '' };
    }
    return item;
  });

  // Update dietTag for this protocol
  const protoTag = { ...(currentDietTags[protocol] || {}) };
  if (decision === 'compliant') {
    protoTag.native   = true;
    protoTag.mod      = false;
    protoTag.uncertain = false;
  } else if (decision === 'replace') {
    protoTag.mod      = true;
    protoTag.native   = false;
    protoTag.uncertain = false;
    if (swapNote) protoTag.notes = swapNote;
  } else if (decision === 'remove') {
    protoTag.native   = false;
    protoTag.mod      = false;
    protoTag.uncertain = false;
  }
  // 'skip' → no dietTag change

  // Check if all items are now resolved
  const allResolved = updatedItems.every(i => i.resolved);

  const update: Record<string, unknown> = {
    reviewItems: updatedItems,
    [`dietTags.${protocol}`]: protoTag,
  };
  if (allResolved) {
    update.processingStatus = 'complete';
  }

  await updateDoc(ref, update);
}

// Update a diet tag (native/mod/notes) on a document in the recipes collection.
export async function updateDietTagInDecisions(
  recipeId: string,
  protocol: string,
  update: { native?: boolean; mod?: boolean; notes?: string },
): Promise<void> {
  const ref = doc(db, 'recipes', recipeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`recipes/${recipeId} not found`);
  const existing = (snap.data().dietTags?.[protocol] ?? {}) as Record<string, unknown>;
  await updateDoc(ref, {
    [`dietTags.${protocol}`]: { ...existing, ...update },
  });
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
